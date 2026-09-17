// =============================================================================
// Логика страницы "Новая вкладка".
//
// Файл устроен так:
//   1. Настройки по умолчанию
//   2. Работа с хранилищем (chrome.storage.sync)
//   3. Функции отрисовки (создание элементов на странице)
//   4. Главный модуль: чтение состояния, обработчики событий
//
// Принцип безопасности: любые данные пользователя (названия, URL)
// вставляются на страницу только через textContent — браузер покажет
// их как текст и никогда не выполнит как код. Это важно, потому что
// настройки можно импортировать из чужого JSON-файла.
// =============================================================================

// =============================================================================
// 1. Настройки по умолчанию
// =============================================================================

// Используются, пока пользователь не внёс свои данные
const DEFAULT_SEARCH_ENGINES = [
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', logo: 'https://icons.duckduckgo.com/ip3/duckduckgo.com.ico', selected: true },
    { name: 'Google', url: 'https://www.google.com/search?q=%s', logo: 'https://www.google.com/favicon.ico', selected: false },
    { name: 'Bing', url: 'https://www.bing.com/search?q=%s', logo: 'https://www.bing.com/favicon.ico', selected: false },
];

const DEFAULT_BOOKMARKS = [
    { title: 'GitHub', url: 'https://github.com', icon: 'https://github.com/favicon.ico' },
    { title: 'Google', url: 'https://www.google.com', icon: 'https://www.google.com/favicon.ico' }
];

const DEFAULT_BACKGROUNDS = [
    { title: 'По умолчанию', url: '' }
];

// Заглушка, показываемая вместо не загрузившейся иконки (серый круг со знаком "?")
const FALLBACK_ICON = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"%3E%3Ccircle cx="25" cy="25" r="20" fill="%23ccc"/%3E%3Ctext x="25" y="30" text-anchor="middle" fill="%23666" font-size="14"%3E%3F%3C/text%3E%3C/svg%3E';

// =============================================================================
// 2. Работа с хранилищем
// =============================================================================

/**
 * Сохраняет переданные поля в chrome.storage.sync.
 * Пример: saveState({ bookmarks: [...] }) — обновить только закладки.
 */
function saveState({ searchEngines, bookmarks, backgrounds, currentBackgroundIndex, currentSearchEngineIndex }) {
    const payload = {};
    if (searchEngines) payload.searchEngines = searchEngines;
    if (bookmarks) payload.bookmarks = bookmarks;
    if (backgrounds) payload.backgrounds = backgrounds;
    if (currentBackgroundIndex !== undefined) payload.currentBackgroundIndex = currentBackgroundIndex;
    if (currentSearchEngineIndex !== undefined) payload.currentSearchEngineIndex = currentSearchEngineIndex;
    chrome.storage.sync.set(payload);
}

/**
 * Читает всё состояние из хранилища.
 * Если какого-то поля нет (первый запуск) — подставляет значения по умолчанию.
 */
function getState(callback) {
    chrome.storage.sync.get(['searchEngines', 'bookmarks', 'backgrounds', 'currentBackgroundIndex', 'currentSearchEngineIndex'], (result) => {
        callback({
            searchEngines: result.searchEngines || DEFAULT_SEARCH_ENGINES,
            bookmarks: result.bookmarks || DEFAULT_BOOKMARKS,
            backgrounds: result.backgrounds || DEFAULT_BACKGROUNDS,
            currentBackgroundIndex: result.currentBackgroundIndex ?? 0,
            currentSearchEngineIndex: result.currentSearchEngineIndex ?? 0
        });
    });
}

// =============================================================================
// 3. Функции отрисовки
// =============================================================================

/**
 * Возвращает URL иконки для закладки.
 * Порядок: своя иконка из настроек -> favicon сайта -> заглушка.
 * new URL() может упасть на битом адресе (например, после импорта
 * кривого файла), поэтому обёрнуто в try/catch.
 */
function getIconUrl(bookmark) {
    if (bookmark.icon) return bookmark.icon;
    try {
        return `https://${new URL(bookmark.url).hostname}/favicon.ico`;
    } catch {
        return FALLBACK_ICON;
    }
}

/**
 * Безопасно назначает картинку.
 * Если src пустой, атрибут не ставим вовсе: <img src=""> браузер
 * считает ссылкой на текущую страницу и зря делает лишний запрос.
 */
function setImageSource(img, src, fallback) {
    if (src) {
        img.src = src;
    }
    img.onerror = () => {
        if (fallback) {
            img.onerror = null; // защита от бесконечного цикла, если и заглушка не показалась
            img.src = fallback;
        } else {
            img.style.display = 'none';
        }
    };
}

/**
 * Создаёт плитку закладки на главной странице.
 * Использует createElement/textContent вместо innerHTML, чтобы
 * название или адрес закладки не могли выполнить посторонний код.
 */
function buildBookmarkTile(bookmark, index) {
    const el = document.createElement('div');
    el.className = 'bookmark';
    el.draggable = true;               // плитку можно перетаскивать (сортировка)
    el.dataset.index = index;          // запоминаем номер в списке для drag-n-drop
    el.dataset.url = bookmark.url;     // стабильный ключ для FLIP-анимации перестановки

    const img = document.createElement('img');
    img.alt = 'icon';
    img.draggable = false;
    setImageSource(img, getIconUrl(bookmark), FALLBACK_ICON);

    const link = document.createElement('a');
    link.href = bookmark.url;
    link.target = '_self';
    link.rel = 'noreferrer';
    link.className = 'bookmark-link';
    link.draggable = false;

    const title = document.createElement('div');
    title.className = 'bookmark-title';
    title.textContent = bookmark.title; // textContent = безопасно, innerHTML = нет

    link.appendChild(img);
    link.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'bookmark-actions';
    for (const [className, label, symbol] of [
        ['edit-bookmark', 'Редактировать', '✎'],
        ['delete-bookmark', 'Удалить', '×'],
    ]) {
        const button = document.createElement('button');
        button.className = className;
        button.dataset.index = index;
        button.type = 'button';
        button.setAttribute('aria-label', label);
        button.textContent = symbol;
        actions.appendChild(button);
    }

    el.appendChild(actions);
    el.appendChild(link);
    return el;
}

/**
 * Отрисовывает кнопку и выпадающий список поисковых систем.
 */
function renderSearchEngineDropdown(engines, selectedIndex) {
    const iconEl = document.getElementById('selected-engine-icon');
    const nameEl = document.getElementById('selected-engine-name');
    const listContainer = document.getElementById('search-engine-list');

    // Список может опустеть (пользователь удалил все системы) — тогда
    // просто оставляем кнопку пустой вместо падения
    if (!engines.length) {
        iconEl.style.display = 'none';
        nameEl.textContent = '';
        listContainer.textContent = '';
        return;
    }

    // Индекс мог устареть (движок удалён) — тогда берём первый
    selectedIndex = (selectedIndex >= 0 && selectedIndex < engines.length) ? selectedIndex : 0;
    const selected = engines[selectedIndex];

    if (selected.logo) {
        iconEl.style.display = 'inline';
        setImageSource(iconEl, selected.logo, '');
    } else {
        iconEl.style.display = 'none';
    }
    nameEl.textContent = selected.name;

    // Собираем список заново при каждом вызове — данных немного,
    // зато код проще и всегда соответствует состоянию
    listContainer.textContent = '';
    engines.forEach((engine, index) => {
        const item = document.createElement('div');
        item.className = `dropdown-item${index === selectedIndex ? ' selected' : ''}`;
        // Ключ (URL с %s) храним в dataset — по нему найдём движок при клике
        item.dataset.url = engine.url;

        const img = document.createElement('img');
        setImageSource(img, engine.logo || '', '');

        const label = document.createElement('span');
        label.textContent = engine.name;

        item.appendChild(img);
        item.appendChild(label);
        listContainer.appendChild(item);
    });
}

/**
 * Отрисовывает плитки закладок на главной странице.
 */
function renderBookmarks(container, bookmarks) {
    container.textContent = '';
    bookmarks.forEach((bookmark, index) => {
        container.appendChild(buildBookmarkTile(bookmark, index));
    });
}

/**
 * Строка в списке внутри модалки настроек (закладка / фон / поисковик).
 * Общая для трёх списков: создаёт карточку и вешает на неё кнопки.
 *
 * @param {Object}   options
 * @param {Array}    options.buttons  — массив [css-класс, текст] для кнопок
 * @param {boolean}  options.selected — подсветить строку как активную
 * @param {?string}  options.imageUrl — картинка слева (иконка/превью)
 * @param {string}   options.emptyImageText — текст вместо картинки, если её нет
 * @param {string}   options.title    — заголовок строки
 * @param {string}   options.subtitle — вторая строка (обычно URL)
 * @param {number}   options.index    — номер в списке, передаётся в кнопки
 * @param {string}   options.rowType  — тип строки ('bookmark' | 'background' |
 *                     'searchEngine'); нужен контекстному меню, чтобы понять,
 *                     над какой строкой кликнули
 */
function buildManagerListItem({ buttons, selected, imageUrl, emptyImageText, title, subtitle, index, rowType }) {
    const item = document.createElement('div');
    item.className = `modal-list-item${selected ? ' selected' : ''}`;
    item.dataset.index = index;
    item.dataset.rowType = rowType;

    // Картинка слева: <img> либо заглушка "Нет"/"✕"
    let imageEl;
    if (imageUrl) {
        imageEl = document.createElement('img');
        setImageSource(imageEl, imageUrl, '');
    } else {
        imageEl = document.createElement('div');
        imageEl.className = 'no-preview no-logo';
        imageEl.textContent = emptyImageText;
    }

    const info = document.createElement('div');
    info.className = 'item-info';

    const text = document.createElement('div');
    text.className = 'modal-list-text';
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    const subtitleEl = document.createElement('span');
    subtitleEl.textContent = subtitle;
    text.append(titleEl, subtitleEl);

    const actions = document.createElement('div');
    actions.className = 'modal-list-actions';
    for (const [className, label] of buttons) {
        const btn = document.createElement('button');
        btn.className = className;
        btn.type = 'button';
        btn.textContent = label;
        btn.dataset.index = index;
        actions.appendChild(btn);
    }

    info.append(text, actions);
    item.append(imageEl, info);
    return item;
}

/**
 * Состав контекстного меню для каждого типа элемента.
 * Вызывается по правому клику; возвращает список пунктов:
 * { action, label } — обычный пункт, { separator: true } — линия-разделитель.
 * Чистая функция без обращения к DOM — её легко проверить тестами.
 *
 * @param {string} type — 'bookmark' | 'background' | 'search' | 'settingsRow'
 * @param {Object} [data] — дополнительные данные: для 'search' — есть ли текст
 *                     в поле и в буфере обмена, для 'settingsRow' — есть ли
 *                     у строки кнопка "Выбрать"
 */
function getContextMenuItems(type, data = {}) {
    switch (type) {
        case 'bookmark':
            // Меню плитки закладки: действия над конкретной закладкой
            return [
                { action: 'editBookmark', label: 'Редактировать' },
                { action: 'deleteBookmark', label: 'Удалить' },
                { action: 'openInNewTab', label: 'Открыть в новой вкладке' },
                { action: 'copyLink', label: 'Копировать ссылку' },
                { separator: true },
                { action: 'openSettings', label: 'Настройки' },
            ];
        case 'background':
            // Меню пустого фона: смена фона и переходы в настройки.
            // "Редактировать" открывает редактор текущего (выбранного) фона,
            // "Настройки" — под разделителем, как в меню плитки закладки
            return [
                { action: 'nextBackground', label: 'Следующий фон' },
                { action: 'editBackground', label: 'Редактировать' },
                { action: 'backgroundSettings', label: 'Настройки фонов' },
                { separator: true },
                { action: 'openSettings', label: 'Настройки' },
            ];
        case 'search':
            // Меню поля поиска — динамическое: состав зависит от того,
            // есть ли текст в поле (data.hasText) и в буфере обмена
            // (data.hasClipboardText). Пункты вставки скрываются, если
            // буфер пуст или недоступен. "Настройки" — под разделителем,
            // как в других меню
        {
            const items = [];
            if (data.hasClipboardText) {
                items.push({ action: 'pasteAndSearch', label: 'Вставить и искать' });
                items.push({ action: 'pasteToSearch', label: 'Вставить' });
            }
            if (data.hasText) {
                items.push({ action: 'copySearch', label: 'Копировать' });
                items.push({ action: 'cutSearch', label: 'Вырезать' });
                items.push({ action: 'clearSearch', label: 'Очистить' });
            }
            items.push({ action: 'searchEngineSettings', label: 'Настройки поисковиков' });
            items.push({ separator: true });
            items.push({ action: 'openSettings', label: 'Настройки' });
            return items;
        }
        case 'settingsRow':
            // Меню строки в модалке настроек — повторяет её кнопки.
            // У закладок нет кнопки "Выбрать", поэтому пункт добавляется по флагу.
        {
            const items = [];
            if (data.selectable) items.push({ action: 'rowSelect', label: 'Выбрать' });
            items.push({ action: 'rowEdit', label: 'Редактировать' });
            items.push({ action: 'rowDelete', label: 'Удалить' });
            return items;
        }
        default:
            return [];
    }
}

/**
 * Заполняет один из трёх списков в модалке настроек.
 */
function renderManagerList(container, items, buildItemFn) {
    if (!container) return;
    container.textContent = '';

    if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'modal-list-empty';
        empty.textContent = 'Список пуст.';
        container.appendChild(empty);
        return;
    }

    items.forEach((item, index) => container.appendChild(buildItemFn(item, index)));
}

function renderBookmarkManagerItem(bookmark, index) {
    return buildManagerListItem({
        buttons: [
            ['bookmark-manage-edit', 'Ред.'],
            ['bookmark-manage-delete', 'Удалить'],
        ],
        selected: false,
        imageUrl: getIconUrl(bookmark),
        emptyImageText: '✕',
        title: bookmark.title,
        subtitle: bookmark.url,
        index,
        rowType: 'bookmark'
    });
}

function renderBackgroundManagerItem(background, index, currentIndex) {
    return buildManagerListItem({
        buttons: [
            ['background-manage-select', 'Выбрать'],
            ['background-manage-edit', 'Ред.'],
            ['background-manage-delete', 'Удалить'],
        ],
        selected: index === currentIndex,
        imageUrl: background.url || null,
        emptyImageText: 'Нет',
        title: background.title,
        subtitle: background.url || 'По умолчанию',
        index,
        rowType: 'background'
    });
}

function renderSearchEngineManagerItem(engine, index, selectedIndex) {
    return buildManagerListItem({
        buttons: [
            ['search-engine-select', 'Выбрать'],
            ['search-engine-edit', 'Ред.'],
            ['search-engine-delete', 'Удалить'],
        ],
        selected: index === selectedIndex,
        imageUrl: engine.logo || null,
        emptyImageText: '✕',
        title: engine.name,
        subtitle: engine.url,
        index,
        rowType: 'searchEngine'
    });
}

/**
 * Применяет выбранный фон к странице.
 */
function setBackground(backgrounds, currentBackgroundIndex) {
    const background = backgrounds[currentBackgroundIndex];
    if (background?.url) {
        document.body.style.backgroundImage = `url('${background.url}')`;
    } else {
        document.body.style.backgroundImage = '';
    }
    // Само правило background-size живёт в styles.css (body) — тут только картинка
}

/**
 * Ищет логотип сайта, по очереди проверяя источники.
 * Первая картинка, которая успешно загрузилась за 3 секунды, выигрывает.
 */
async function fetchLogoWithFallback(urlString) {
    try {
        const domain = new URL(urlString).hostname;

        // Возвращает true, если картинка по ссылке реально загружается
        const checkImage = (imgUrl, timeout = 3000) => {
            return new Promise((resolve) => {
                const img = new Image();
                const timer = setTimeout(() => resolve(false), timeout);
                img.onload = () => { clearTimeout(timer); resolve(true); };
                img.onerror = () => { clearTimeout(timer); resolve(false); };
                img.src = imgUrl;
            });
        };

        const sources = [
            `https://${domain}/favicon.ico`,
            `https://${domain}/favicon.svg`,
            `https://${domain}/favicon.png`,
            `https://icons.duckduckgo.com/ip3/${domain}.ico`,
            `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
        ];

        for (const src of sources) {
            if (await checkImage(src)) return src;
        }
        return '';
    } catch {
        return '';
    }
}

// =============================================================================
// 4. Главный модуль
// =============================================================================

window.addEventListener('DOMContentLoaded', () => {
    // --- Элементы страницы (HTML-разметка в newtab/index.html) ---
    const searchInput = document.getElementById('search-input');
    const searchEngineDropdownBtn = document.getElementById('search-engine-button');
    const searchEngineList = document.getElementById('search-engine-list');
    const searchButton = document.getElementById('search-button');
    const bookmarksContainer = document.getElementById('bookmarks-container');

    const contextMenu = document.getElementById('custom-context-menu');
    const overlay = document.getElementById('overlay');
    const settingsModal = document.getElementById('settings-modal');
    const settingsButton = document.getElementById('settings-button');
    const closeSettingsButton = document.getElementById('close-settings');
    const exportSettingsJsonButton = document.getElementById('export-settings-json');
    const importSettingsJsonButton = document.getElementById('import-settings-json');
    const importSettingsFileInput = document.getElementById('import-settings-file');
    const settingsTabs = document.querySelectorAll('.settings-tab');
    const settingsPanes = document.querySelectorAll('.settings-pane');

    // Форма закладок
    const bookmarkManagerList = document.getElementById('bookmark-manager-list');
    const bookmarkTitleInput = document.getElementById('bookmark-title-input');
    const bookmarkUrlInput = document.getElementById('bookmark-url-input');
    const bookmarkIconInput = document.getElementById('bookmark-icon-input');
    const findBookmarkLogoButton = document.getElementById('find-bookmark-logo');
    const saveBookmarkButton = document.getElementById('save-bookmark');

    // Форма фонов
    const backgroundManagerList = document.getElementById('background-manager-list');
    const backgroundTitleInput = document.getElementById('background-title-input');
    const backgroundUrlInput = document.getElementById('background-url-input');
    const saveBackgroundButton = document.getElementById('save-background');

    // Форма поисковых систем
    const searchEnginesList = document.getElementById('search-engines-list');
    const newSearchEngineName = document.getElementById('new-search-engine-name');
    const newSearchEngineUrl = document.getElementById('new-search-engine-url');
    const newSearchEngineLogo = document.getElementById('new-search-engine-logo');
    const findSearchEngineLogoButton = document.getElementById('find-search-engine-logo');
    const addSearchEngineButton = document.getElementById('add-search-engine');

    // --- Текущее состояние приложения ---
    // Всё, что видит пользователь, живёт в этом объекте и синхронизируется
    // с chrome.storage.sync при каждом изменении.
    let currentState = {
        searchEngines: DEFAULT_SEARCH_ENGINES,
        bookmarks: DEFAULT_BOOKMARKS,
        backgrounds: DEFAULT_BACKGROUNDS,
        currentBackgroundIndex: 0,
        currentSearchEngineIndex: 0
    };

    // Какой элемент списка сейчас редактируется (null = создаётся новый)
    let editingBookmarkIndex = null;
    let editingBackgroundIndex = null;
    let editingSearchEngineIndex = null;

    // =============================================================================
    // Тема оформления
    //
    // Три режима: 'auto' (следовать за настройкой ОС), 'light', 'dark'.
    // Выбор хранится в chrome.storage.sync. Итоговая тема применяется
    // к <html> через атрибут data-theme — по нему CSS включает нужные
    // переменные (см. styles.css).
    // =============================================================================

    const themeToggle = document.getElementById('theme-toggle');
    const themeMenu = document.getElementById('theme-menu');

    // Иконка кнопки меняется вместе с режимом: авто — половинка,
    // светлая — солнце, тёмная — луна (см. index.html, data-mode)
    const THEME_ICONS = { auto: '🌗', light: '☀️', dark: '🌙' };

    /**
     * Применяет тему к странице.
     * mode — 'auto' | 'light' | 'dark' (что выбрал пользователь).
     * При 'auto' смотрим на системную настройку через window.matchMedia.
     */
    function applyTheme(mode) {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        // При "auto" тема определяется системой, иначе — выбором пользователя
        const isDark = mode === 'dark' || (mode === 'auto' && systemDark);

        // Светлая тема — отсутствие атрибута (переменные :root по умолчанию)
        if (isDark) {
            document.documentElement.dataset.theme = 'dark';
        } else {
            delete document.documentElement.dataset.theme;
        }
        // Иконка кнопки подсказывает текущий режим
        if (themeToggle) themeToggle.textContent = THEME_ICONS[mode] || THEME_ICONS.auto;
        // Подсвечиваем активный пункт меню переключателя
        themeMenu?.querySelectorAll('button').forEach((b) => {
            b.classList.toggle('active', b.dataset.mode === mode);
        });
    }

    // Реагируем на переключение темы в системе, пока активен режим "auto"
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        chrome.storage.sync.get('theme', (result) => {
            if ((result.theme || 'auto') === 'auto') applyTheme('auto');
        });
    });

    // Загружаем сохранённый режим и включаем переключатель
    chrome.storage.sync.get('theme', (result) => applyTheme(result.theme || 'auto'));
    themeToggle?.addEventListener('click', (e) => {
        // Показать/спрять мини-меню выбора темы.
        // stopPropagation: иначе клик дойдёт до document и тут же закроет меню
        e.stopPropagation();
        themeMenu.classList.toggle('hidden');
    });
    themeMenu?.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        if (!mode) return;
        chrome.storage.sync.set({ theme: mode });
        applyTheme(mode);
        themeMenu.classList.add('hidden');
    });

    // Клик мимо меню темы закрывает его (клик по самой кнопке не доходит
    // до document из-за stopPropagation выше)
    document.addEventListener('click', (e) => {
        if (!themeMenu.contains(e.target)) themeMenu.classList.add('hidden');
    });

    // =============================================================================
    // Вспомогательные функции UI
    // =============================================================================

    function resetBookmarkForm() {
        editingBookmarkIndex = null;
        bookmarkTitleInput.value = '';
        bookmarkUrlInput.value = '';
        bookmarkIconInput.value = '';
    }

    function resetBackgroundForm() {
        editingBackgroundIndex = null;
        backgroundTitleInput.value = '';
        backgroundUrlInput.value = '';
    }

    function resetSearchEngineForm() {
        editingSearchEngineIndex = null;
        newSearchEngineName.value = '';
        newSearchEngineUrl.value = '';
        newSearchEngineLogo.value = '';
    }

    // --- Раскрывающиеся формы добавления ---
    // Форма всегда в разметке, но свернута (grid-строка 0fr, см. styles.css).
    // addForms связывает кнопку показа, саму форму и функцию сброса
    // для каждого типа: 'bookmark' | 'background' | 'searchEngine'
    const addForms = {
        bookmark: {
            showButton: document.getElementById('show-bookmark-form'),
            form: document.getElementById('bookmark-form'),
            reset: resetBookmarkForm,
        },
        background: {
            showButton: document.getElementById('show-background-form'),
            form: document.getElementById('background-form'),
            reset: resetBackgroundForm,
        },
        searchEngine: {
            showButton: document.getElementById('show-search-engine-form'),
            form: document.getElementById('search-engine-form'),
            reset: resetSearchEngineForm,
        },
    };

    // Показывает форму добавления, пряча кнопку "+ Добавить"
    function showAddForm(form) {
        addForms[form].showButton.classList.add('hidden');
        addForms[form].form.classList.add('open'); // grid 0fr -> 1fr: плавное раскрытие
        // Сразу ставим курсор в первое поле — можно печатать
        addForms[form].form.querySelector('input')?.focus();
    }

    // Прячет форму и сбрасывает её поля
    function hideAddForm(form) {
        addForms[form].showButton.classList.remove('hidden');
        addForms[form].form.classList.remove('open'); // плавное сворачивание
        addForms[form].reset();
    }

    function openSettingsModal(tab = 'bookmarks') {
        // Показываем нужную вкладку модалки и прячем остальные
        settingsTabs.forEach(t => t.classList.remove('active'));
        settingsPanes.forEach(p => p.classList.remove('active'));
        document.querySelector(`.settings-tab[data-tab="${tab}"]`)?.classList.add('active');
        document.querySelector(`.settings-pane[data-pane="${tab}"]`)?.classList.add('active');
        settingsModal.classList.remove('hidden');
        overlay.classList.remove('hidden');

        const focusMap = { bookmarks: bookmarkTitleInput, backgrounds: backgroundTitleInput, 'search-engines': newSearchEngineName };
        focusMap[tab]?.focus();
    }

    function closeSettingsModal() {
        settingsModal.classList.add('hidden');
        overlay.classList.add('hidden');
        hideAddForm('bookmark');
        hideAddForm('background');
        hideAddForm('searchEngine');
    }

    function closeContextMenu() {
        contextMenu.classList.add('hidden');
    }

    /**
     * Перерисовывает все списки по currentState.
     * Вызывается после каждого изменения данных.
     */
    function refreshUI() {
        renderSearchEngineDropdown(currentState.searchEngines, currentState.currentSearchEngineIndex);
        renderBookmarks(bookmarksContainer, currentState.bookmarks);
        renderManagerList(bookmarkManagerList, currentState.bookmarks, renderBookmarkManagerItem);
        renderManagerList(backgroundManagerList, currentState.backgrounds, (bg, idx) => renderBackgroundManagerItem(bg, idx, currentState.currentBackgroundIndex));
        renderManagerList(searchEnginesList, currentState.searchEngines, (eng, idx) => renderSearchEngineManagerItem(eng, idx, currentState.currentSearchEngineIndex));
        setBackground(currentState.backgrounds, currentState.currentBackgroundIndex);
    }

    /**
     * Заполняет поля формы данными выбранного элемента списка.
     * index — номер элемента в currentState; form — 'bookmark' | 'background' | 'searchEngine'.
     */
    function startEditing(index, form) {
        const fillers = {
            bookmark: () => {
                editingBookmarkIndex = index;
                const b = currentState.bookmarks[index];
                bookmarkTitleInput.value = b.title || '';
                bookmarkUrlInput.value = b.url || '';
                bookmarkIconInput.value = b.icon || '';
            },
            background: () => {
                editingBackgroundIndex = index;
                const bg = currentState.backgrounds[index];
                backgroundTitleInput.value = bg.title || '';
                backgroundUrlInput.value = bg.url || '';
            },
            searchEngine: () => {
                editingSearchEngineIndex = index;
                const e = currentState.searchEngines[index];
                newSearchEngineName.value = e.name || '';
                newSearchEngineUrl.value = e.url || '';
                newSearchEngineLogo.value = e.logo || '';
            }
        };
        fillers[form]();
        showAddForm(form); // форма добавления — она же форма редактирования
        // Имя вкладки модалки совпадает с ключом формы
        openSettingsModal(form === 'searchEngine' ? 'search-engines' : form + 's');
    }

    /**
     * Удаляет элемент списка по кнопке (с пересчётом выбранного индекса).
     * listKey — имя поля в currentState, indexKey — имя поля-индекса выбранного.
     */
    function deleteItem(listKey, indexKey, index) {
        currentState[listKey].splice(index, 1);
        // Если после удаления выбранный индекс вышел за пределы списка
        // (например, удалили последний фон), сдвигаем его к последнему элементу
        if (currentState[indexKey] >= currentState[listKey].length) {
            currentState[indexKey] = Math.max(0, currentState[listKey].length - 1);
        }
        saveState({ [listKey]: currentState[listKey], [indexKey]: currentState[indexKey] });
        refreshUI();
    }

    /**
     * URL поисковой системы, выбранной в данный момент.
     * Берём индекс из состояния, а не текст из кнопки: если у двух
     * систем одинаковое имя, поиск по имени дал бы неверный результат.
     */
    function getCurrentSearchUrl() {
        const engine = currentState.searchEngines[currentState.currentSearchEngineIndex];
        return engine?.url || currentState.searchEngines[0]?.url || '';
    }

    /**
     * Подставляет поисковый запрос в URL выбранной системы и переходит.
     */
    function runSearch() {
        const query = searchInput.value.trim();
        if (!query) return;
        // %s в шаблоне URL — место, куда вставляется запрос
        const url = getCurrentSearchUrl().replace('%s', encodeURIComponent(query));
        window.location.href = url;
    }

    // =============================================================================
    // Загрузка начального состояния
    // =============================================================================

    getState((state) => {
        currentState = state;
        refreshUI();
    });

    // Страница открыта с ?settings=1 — её открыло контекстное меню иконки
    // расширения (background.js). Сразу показываем окно настроек.
    if (new URLSearchParams(window.location.search).has('settings')) {
        openSettingsModal('bookmarks');
    }

    // =============================================================================
    // Поиск
    // =============================================================================

    searchButton.addEventListener('click', runSearch);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });

    // Открытие/закрытие выпадающего списка
    searchEngineDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // чтобы клик не закрыл список тут же обработчиком document
        searchEngineList.classList.toggle('open');
    });

    // Выбор поисковой системы из выпадающего списка
    searchEngineList.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;

        // Ищем выбранный движок по адресу (ключу из dataset)
        const url = item.dataset.url;
        const index = currentState.searchEngines.findIndex(engine => engine.url === url);
        if (index !== -1) {
            currentState.currentSearchEngineIndex = index;
            saveState({ currentSearchEngineIndex: index });
            renderSearchEngineDropdown(currentState.searchEngines, index);
        }
        searchEngineList.classList.remove('open');
    });

    // Закрытие списка при клике в любом другом месте страницы
    document.addEventListener('click', () => {
        searchEngineList.classList.remove('open');
    });

    // =============================================================================
    // Модальное окно настроек: открытие, вкладки, импорт/экспорт
    // =============================================================================

    settingsButton.addEventListener('click', () => openSettingsModal('bookmarks'));
    closeSettingsButton.addEventListener('click', closeSettingsModal);
    overlay.addEventListener('click', closeSettingsModal);

    // Клик по вкладкам (Закладки / Фоны / Поисковые системы)
    settingsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            settingsTabs.forEach(t => t.classList.remove('active'));
            settingsPanes.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.querySelector(`.settings-pane[data-pane="${tabName}"]`)?.classList.add('active');
        });
    });

    // Закрытие модалки клавишей Escape — привычное поведение
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSettingsModal();
            closeContextMenu();
        }
    });

    // --- Экспорт: скачивание JSON-файла со всеми настройками ---
    exportSettingsJsonButton.addEventListener('click', () => {
        // Тема — тоже настройка: экспортируем текущий режим вместе с данными
        chrome.storage.sync.get('theme', (result) => {
            const json = JSON.stringify({ ...currentState, theme: result.theme || 'auto' }, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'self_tabs_settings.json';
            a.click();
            URL.revokeObjectURL(a.href);
        });
    });

    // --- Импорт: чтение JSON-файла и аккуратная проверка полей ---
    importSettingsJsonButton.addEventListener('click', () => importSettingsFileInput.click());
    importSettingsFileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const payload = JSON.parse(await file.text());
            const newState = { ...currentState };
            // Каждое поле копируем, только если оно подходящего типа:
            // испорченный файл не должен сломать настройки целиком
            if (Array.isArray(payload.searchEngines)) newState.searchEngines = payload.searchEngines;
            if (Array.isArray(payload.bookmarks)) newState.bookmarks = payload.bookmarks;
            if (Array.isArray(payload.backgrounds)) newState.backgrounds = payload.backgrounds;
            if (typeof payload.currentBackgroundIndex === 'number') newState.currentBackgroundIndex = payload.currentBackgroundIndex;
            if (typeof payload.currentSearchEngineIndex === 'number') newState.currentSearchEngineIndex = payload.currentSearchEngineIndex;
            // Режим темы: импортируем только корректные значения,
            // а старые файлы без поля theme не трогаем
            const themeModes = ['auto', 'light', 'dark'];
            let importedTheme = null;
            if (themeModes.includes(payload.theme)) importedTheme = payload.theme;
            saveState(newState);
            if (importedTheme) {
                chrome.storage.sync.set({ theme: importedTheme });
                applyTheme(importedTheme);
            }
            currentState = newState;
            refreshUI();
            alert('Настройки импортированы');
        } catch (err) {
            alert('Ошибка импорта: ' + err.message);
        } finally {
            // Сбрасываем input, чтобы выбор того же файла снова сработал
            importSettingsFileInput.value = '';
        }
    });

    // =============================================================================
    // Закладки
    // =============================================================================

    // Кнопки "＋ Добавить" и "Отмена" — показ/скрытие формы
    addForms.bookmark.showButton.addEventListener('click', () => showAddForm('bookmark'));
    document.getElementById('cancel-bookmark').addEventListener('click', () => hideAddForm('bookmark'));

    // Кнопка "Сохранить" в форме закладок
    saveBookmarkButton.addEventListener('click', () => {
        const title = bookmarkTitleInput.value.trim();
        const rawUrl = bookmarkUrlInput.value.trim();
        const icon = bookmarkIconInput.value.trim();

        if (!title || !rawUrl) { alert('Введите название и URL.'); return; }

        // Если пользователь ввёл адрес без "https://", добавим его сами
        const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        let urlObj;
        try { urlObj = new URL(normalizedUrl); } catch { alert('Введите корректный URL.'); return; }

        const bookmarkData = { title, url: normalizedUrl, icon: icon || `https://${urlObj.hostname}/favicon.ico` };

        if (editingBookmarkIndex !== null) {
            currentState.bookmarks[editingBookmarkIndex] = bookmarkData;
        } else {
            currentState.bookmarks.push(bookmarkData);
        }

        saveState({ bookmarks: currentState.bookmarks });
        refreshUI();
        hideAddForm('bookmark'); // прячем форму после сохранения
    });

    // Кнопка "Найти логотип": запускает перебор источников favicon
    findBookmarkLogoButton.addEventListener('click', async () => {
        const url = bookmarkUrlInput.value.trim();
        if (!url) { alert('Введите URL закладки.'); return; }
        findBookmarkLogoButton.disabled = true;
        findBookmarkLogoButton.textContent = 'Поиск...';
        try {
            const logoUrl = await fetchLogoWithFallback(url);
            if (logoUrl) {
                bookmarkIconInput.value = logoUrl;
                alert('Логотип найден!');
            } else {
                alert('Логотип не найден.');
            }
        } finally {
            findBookmarkLogoButton.disabled = false;
            findBookmarkLogoButton.textContent = 'Найти логотип';
        }
    });

    // --- Кнопки "Ред."/"Удалить" в списке настроек закладок ---
    bookmarkManagerList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.bookmark-manage-edit');
        if (editBtn) {
            startEditing(Number(editBtn.dataset.index), 'bookmark');
            return;
        }

        const deleteBtn = e.target.closest('.bookmark-manage-delete');
        if (deleteBtn) {
            currentState.bookmarks.splice(Number(deleteBtn.dataset.index), 1);
            saveState({ bookmarks: currentState.bookmarks });
            refreshUI();
        }
    });

    // --- Кнопки на плитках закладок на главной странице ---
    // Обработчик один на весь контейнер (делегирование): он ловит клики
    // всех плиток, включая созданные позже — не нужно вешать обработчик
    // на каждую кнопку отдельно
    bookmarksContainer.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-bookmark');
        if (editBtn) {
            e.stopPropagation(); // не даём плитке открыть ссылку
            startEditing(Number(editBtn.dataset.index), 'bookmark');
            return;
        }

        const deleteBtn = e.target.closest('.delete-bookmark');
        if (deleteBtn) {
            e.stopPropagation();
            currentState.bookmarks.splice(Number(deleteBtn.dataset.index), 1);
            saveState({ bookmarks: currentState.bookmarks });
            refreshUI();
        }
    });

    // =============================================================================
    // Фоны
    // =============================================================================

    // Кнопки "＋ Добавить" и "Отмена" — показ/скрытие формы
    addForms.background.showButton.addEventListener('click', () => showAddForm('background'));
    document.getElementById('cancel-background').addEventListener('click', () => hideAddForm('background'));

    saveBackgroundButton.addEventListener('click', () => {
        const title = backgroundTitleInput.value.trim();
        if (!title) { alert('Введите название.'); return; }
        const backgroundData = { title, url: backgroundUrlInput.value.trim() };

        if (editingBackgroundIndex !== null) {
            currentState.backgrounds[editingBackgroundIndex] = backgroundData;
        } else {
            currentState.backgrounds.push(backgroundData);
        }

        saveState({ backgrounds: currentState.backgrounds });
        refreshUI();
        hideAddForm('background');
    });

    backgroundManagerList.addEventListener('click', (e) => {
        const selectBtn = e.target.closest('.background-manage-select');
        if (selectBtn) {
            currentState.currentBackgroundIndex = Number(selectBtn.dataset.index);
            saveState({ currentBackgroundIndex: currentState.currentBackgroundIndex });
            refreshUI();
            return;
        }

        const editBtn = e.target.closest('.background-manage-edit');
        if (editBtn) {
            startEditing(Number(editBtn.dataset.index), 'background');
            return;
        }

        const deleteBtn = e.target.closest('.background-manage-delete');
        if (deleteBtn) {
            deleteItem('backgrounds', 'currentBackgroundIndex', Number(deleteBtn.dataset.index));
        }
    });

    // =============================================================================
    // Поисковые системы
    // =============================================================================

    // Кнопки "＋ Добавить" и "Отмена" — показ/скрытие формы
    addForms.searchEngine.showButton.addEventListener('click', () => showAddForm('searchEngine'));
    document.getElementById('cancel-search-engine').addEventListener('click', () => hideAddForm('searchEngine'));

    addSearchEngineButton.addEventListener('click', () => {
        const name = newSearchEngineName.value.trim();
        const url = newSearchEngineUrl.value.trim();
        const logo = newSearchEngineLogo.value.trim();

        // %s в URL обязателен — иначе некуда подставлять запрос
        if (!name || !url || !url.includes('%s')) { alert('Введите название и URL с %s.'); return; }

        const engineData = { name, url, logo };
        if (editingSearchEngineIndex !== null) {
            currentState.searchEngines[editingSearchEngineIndex] = engineData;
        } else {
            currentState.searchEngines.push(engineData);
        }

        saveState({ searchEngines: currentState.searchEngines });
        refreshUI();
        hideAddForm('searchEngine');
    });

    findSearchEngineLogoButton.addEventListener('click', async () => {
        const url = newSearchEngineUrl.value.trim();
        if (!url || !url.includes('%s')) { alert('Введите URL с %s.'); return; }
        findSearchEngineLogoButton.disabled = true;
        findSearchEngineLogoButton.textContent = 'Поиск...';
        try {
            const logoUrl = await fetchLogoWithFallback(url);
            if (logoUrl) {
                newSearchEngineLogo.value = logoUrl;
                alert('Логотип найден!');
            } else {
                alert('Логотип не найден.');
            }
        } finally {
            findSearchEngineLogoButton.disabled = false;
            findSearchEngineLogoButton.textContent = 'Найти логотип';
        }
    });

    searchEnginesList.addEventListener('click', (e) => {
        const selectBtn = e.target.closest('.search-engine-select');
        if (selectBtn) {
            currentState.currentSearchEngineIndex = Number(selectBtn.dataset.index);
            saveState({ currentSearchEngineIndex: currentState.currentSearchEngineIndex });
            refreshUI();
            return;
        }

        const editBtn = e.target.closest('.search-engine-edit');
        if (editBtn) {
            startEditing(Number(editBtn.dataset.index), 'searchEngine');
            return;
        }

        const deleteBtn = e.target.closest('.search-engine-delete');
        if (deleteBtn) {
            deleteItem('searchEngines', 'currentSearchEngineIndex', Number(deleteBtn.dataset.index));
        }
    });

    // =============================================================================
    // Drag & Drop — перетаскивание плиток закладок для сортировки.
    //
    // Как на рабочем столе смартфона: пока тащишь плитку над соседями,
    // они плавно расступаются. Механика: на каждое пересечение новой
    // плитки элемент переставляется в массиве и список перерисовывается,
    // а FLIP-анимация (см. renderBookmarksAnimated) делает сдвиг плавным.
    // =============================================================================

    let draggedIndex = null;

    /**
     * Перерисовывает плитки с FLIP-анимацией.
     * First — запоминаем позиции плиток до перерисовки; Last — после;
     * Invert — ставим плитку в старую позицию; Play — отпускаем, и
     * CSS-transition доезжает до новой. Анимируются только сдвинувшиеся
     * плитки; перетаскиваемая остаётся "приглушенной".
     */
    function renderBookmarksAnimated() {
        const before = new Map();
        bookmarksContainer.querySelectorAll('.bookmark').forEach((el) => {
            before.set(el.dataset.url, el.getBoundingClientRect());
        });

        renderBookmarks(bookmarksContainer, currentState.bookmarks);

        bookmarksContainer.querySelectorAll('.bookmark').forEach((el) => {
            const isDragged = Number(el.dataset.index) === draggedIndex;
            // Перетаскиваемая плитка приглушена и на новой позиции тоже
            el.classList.toggle('dragging', isDragged);

            const prev = before.get(el.dataset.url);
            if (!prev) return; // новая плитка — анимировать не откуда
            const now = el.getBoundingClientRect();
            const dx = prev.left - now.left;
            const dy = prev.top - now.top;
            if (!dx && !dy) return;

            // Перетаскиваемая плитка едет с сохранением поворота:
            // если задать ей только сдвиг, при отпускании стилей поворот
            // из класса .dragging "моргнёт" — выглядит как дёргание
            const rotate = isDragged ? ' rotate(5deg)' : '';

            el.style.transition = 'none';
            el.style.transform = `translate(${dx}px, ${dy}px)` + rotate;
            el.getBoundingClientRect(); // форсируем reflow, иначе браузер слепит кадры
            el.style.transition = '';
            // В итоге перетаскиваемая остаётся повёрнутой (как в .dragging),
            // соседи — без сдвига
            el.style.transform = isDragged ? 'rotate(5deg)' : '';
        });
    }

    bookmarksContainer.addEventListener('dragstart', (e) => {
        const el = e.target.closest('.bookmark');
        if (!el) return;
        draggedIndex = Number(el.dataset.index);
        el.classList.add('dragging');
        e.dataTransfer?.setData('text/plain', String(draggedIndex));
    });

    bookmarksContainer.addEventListener('dragend', (e) => {
        // После перерисовок исходная плитка могла быть заменена новой,
        // поэтому класс и поворот снимаем со всех плиток контейнера —
        // иначе плитка может зависнуть повёрнутой после установки
        bookmarksContainer.querySelectorAll('.bookmark').forEach((el) => {
            el.classList.remove('dragging');
            el.style.transform = ''; // сбрасываем и FLIP-сдвиги
        });
        // Перенос мог быть отменён (Esc, drop вне списка) — сбрасываем,
        // иначе следующий dragover переставит элементы со старым индексом
        draggedIndex = null;
    });

    // Пока тащим: каждый вход над новой плиткой переставляет элемент.
    // preventDefault обязателен — без него браузер не даст сделать drop
    bookmarksContainer.addEventListener('dragover', (e) => {
        if (draggedIndex === null) return;
        const target = e.target.closest('.bookmark');
        if (!target) return;
        e.preventDefault();

        const targetIndex = Number(target.dataset.index);
        if (Number.isNaN(targetIndex) || targetIndex === draggedIndex) return;

        // Вынимаем перетаскиваемый элемент и вставляем на новое место.
        // После splice он всегда оказывается ровно на позиции targetIndex
        const [item] = currentState.bookmarks.splice(draggedIndex, 1);
        currentState.bookmarks.splice(targetIndex, 0, item);
        draggedIndex = targetIndex;
        renderBookmarksAnimated();
    });

    bookmarksContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        // Порядок уже переставлен в dragover — здесь только сохраняем.
        // Один раз за перенос, а не на каждый hover над соседями
        if (draggedIndex !== null) {
            saveState({ bookmarks: currentState.bookmarks });
        }
        // Завершаем перенос: убираем приглушение/поворот со всех плиток,
        // чтобы ни одна не осталась повёрнутой после установки
        bookmarksContainer.querySelectorAll('.bookmark').forEach((el) => {
            el.classList.remove('dragging');
            el.style.transform = '';
        });
        draggedIndex = null;
    });

    // =============================================================================
    // Собственные контекстные меню (правая кнопка мыши)
    //
    // Одно всплывающее меню на всю страницу, но его состав зависит от того,
    // на каком элементе произошёл клик: у плитки закладки, пустого фона,
    // поля поиска и строк настроек — свои наборы действий.
    // =============================================================================

    /**
     * Показывает меню с заданными пунктами в координатах клика.
     * Меню подстраивается под края экрана: рядом с правой или нижней
     * границей оно раскрывается внутрь, а не обрезается.
     */
    function openContextMenu(x, y, items) {
        // Собираем меню заново на каждый клик — пункты зависят от элемента
        contextMenu.textContent = '';
        const list = document.createElement('ul');
        for (const item of items) {
            const li = document.createElement('li');
            if (item.separator) {
                li.className = 'separator';
            } else {
                li.textContent = item.label;
                li.dataset.action = item.action;
            }
            list.appendChild(li);
        }
        contextMenu.appendChild(list);

        // Сначала показываем меню невидимым, чтобы замерить его реальный
        // размер (он зависит от количества и длины пунктов)
        contextMenu.classList.remove('hidden');
        contextMenu.style.visibility = 'hidden';
        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;
        const margin = 8; // отступ от края экрана

        // Если меню не влезает вправо/вниз — сдвигаем влево/внутрь
        const left = Math.max(margin, Math.min(x, window.innerWidth - menuWidth - margin));
        const top = Math.max(margin, Math.min(y, window.innerHeight - menuHeight - margin));

        contextMenu.style.left = left + 'px';
        contextMenu.style.top = top + 'px';
        contextMenu.style.visibility = '';
    }

    // Префиксы css-классов кнопок строк настроек (см. buildManagerListItem):
    // bookmark-manage-*, background-manage-*, search-engine-*
    const ROW_BUTTON_PREFIX = {
        bookmark: 'bookmark-manage',
        background: 'background-manage',
        searchEngine: 'search-engine'
    };

    // Данные элемента, на котором открыли меню. Запоминаются в момент
    // правого клика: когда пользователь выбирает пункт, под курсором
    // уже сам пункт меню, и определять элемент заново было бы нельзя
    let contextMenuData = {};

    /**
     * Действия пунктов меню. Каждое действие — короткая функция,
     * переиспользующая уже существующую логику приложения.
     */
    const contextActions = {
        openSettings: () => openSettingsModal('bookmarks'),
        backgroundSettings: () => openSettingsModal('backgrounds'),
        searchEngineSettings: () => openSettingsModal('search-engines'),

        editBookmark: (data) => startEditing(data.index, 'bookmark'),
        deleteBookmark: (data) => {
            currentState.bookmarks.splice(data.index, 1);
            saveState({ bookmarks: currentState.bookmarks });
            refreshUI();
        },
        openInNewTab: (data) => window.open(data.url, '_blank'),
        copyLink: (data) => navigator.clipboard.writeText(data.url),

        nextBackground: () => {
            if (!currentState.backgrounds.length) return;
            // "% length" — переход по кругу: последний фон сменяется первым
            currentState.currentBackgroundIndex =
                (currentState.currentBackgroundIndex + 1) % currentState.backgrounds.length;
            saveState({ currentBackgroundIndex: currentState.currentBackgroundIndex });
            refreshUI();
        },
        editBackground: () => {
            // Список фонов может опустеть (удалили все фоны) — редактировать нечего
            if (!currentState.backgrounds.length) return;
            // Открываем редактор того фона, который выбран сейчас
            startEditing(currentState.currentBackgroundIndex, 'background');
        },
        // Вставка из буфера в поле. Текст буфера уже прочитан к моменту
        // показа меню и лежит в data.clipboardText — читать буфер повторно не нужно
        pasteToSearch: (data) => {
            const text = (data.clipboardText || '').trim();
            if (!text) return;
            // Дописываем в конец; если поле пусто — просто кладём текст.
            // Пробел-разделитель нужен, чтобы слова не слиплись
            searchInput.value = searchInput.value ? searchInput.value + ' ' + text : text;
            searchInput.focus();
        },
        pasteAndSearch: (data) => {
            contextActions.pasteToSearch(data); // вставили...
            runSearch();                        // ...и сразу ищем
        },
        copySearch: () => {
            const text = searchInput.value;
            if (!text.trim()) return;
            navigator.clipboard.writeText(text).catch(() => {
                alert('Не удалось скопировать текст.');
            });
        },
        cutSearch: () => {
            const text = searchInput.value;
            if (!text.trim()) return;
            navigator.clipboard.writeText(text)
                .then(() => {
                    searchInput.value = '';
                    searchInput.focus();
                })
                .catch(() => {
                    alert('Не удалось вырезать текст.');
                });
        },
        clearSearch: () => {
            searchInput.value = '';
            searchInput.focus();
        },

        // Действия строк настроек "нажимают" те же кнопки, что видны в строке.
        // Имя кнопки складывается из префикса строки (ROW_BUTTON_PREFIX)
        rowSelect: (data) => {
            const prefix = ROW_BUTTON_PREFIX[data.rowType];
            document.querySelector(`[data-row-type="${data.rowType}"][data-index="${data.index}"] .${prefix}-select`)?.click();
        },
        rowEdit: (data) => {
            const prefix = ROW_BUTTON_PREFIX[data.rowType];
            document.querySelector(`[data-row-type="${data.rowType}"][data-index="${data.index}"] .${prefix}-edit`)?.click();
        },
        rowDelete: (data) => {
            const prefix = ROW_BUTTON_PREFIX[data.rowType];
            document.querySelector(`[data-row-type="${data.rowType}"][data-index="${data.index}"] .${prefix}-delete`)?.click();
        },
    };

    /**
     * Определяет, над каким элементом кликнули, и возвращает
     * тип меню + данные (индекс закладки, URL и т.п.).
     */
    function detectMenuTarget(target) {
        const bookmarkTile = target.closest('.bookmark');
        if (bookmarkTile) {
            const index = Number(bookmarkTile.dataset.index);
            return { type: 'bookmark', data: { index, url: currentState.bookmarks[index]?.url } };
        }

        // Клик по модалке настроек: интересуют только строки списков
        const settingsRow = target.closest('.modal-list-item');
        if (settingsRow) {
            return {
                type: 'settingsRow',
                data: {
                    index: Number(settingsRow.dataset.index),
                    rowType: settingsRow.dataset.rowType,
                    selectable: !!settingsRow.querySelector('.search-engine-select, .background-manage-select'),
                }
            };
        }

        // Поле поиска и кнопка рядом с ним
        if (target.closest('#search-input, #search-button, #search-engine-button')) {
            // hasText — есть ли текст в поле: от этого зависят пункты
            // "Копировать"/"Вырезать"/"Очистить"
            return { type: 'search', data: { hasText: !!searchInput.value.trim() } };
        }

        // Всё остальное (пустое место, заголовки) считаем фоном страницы
        return { type: 'background', data: {} };
    }

    // Правый клик: определяем элемент и показываем соответствующее меню
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const modalOpen = !overlay.classList.contains('hidden');
        const { type, data } = detectMenuTarget(e.target);
        // При открытой модалке меню нужно только для её строк —
        // остальное уходит под оверлей
        if (modalOpen && type !== 'settingsRow') { closeContextMenu(); return; }
        contextMenuData = data; // запоминаем для обработчика выбора пункта

        if (type === 'search') {
            // Состав меню поиска зависит от содержимого буфера обмена,
            // поэтому перед показом меню буфер нужно прочитать.
            // Чтение асинхронное — меню появляется с небольшой задержкой.
            // Если браузер запретил доступ к буферу, считаем его пустым:
            // пункты вставки просто не покажутся
            navigator.clipboard.readText()
                .catch(() => '')
                .then((text) => {
                    data.clipboardText = text || '';
                    data.hasClipboardText = !!data.clipboardText.trim();
                    contextMenuData = data;
                    openContextMenu(e.pageX, e.pageY, getContextMenuItems(type, data));
                });
            return;
        }

        openContextMenu(e.pageX, e.pageY, getContextMenuItems(type, data));
    });

    // Левый клик мимо меню закрывает его
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) closeContextMenu();
    });

    // Выбор пункта меню: выполняем действие с данными, запомненными
    // в момент правого клика (contextMenuData)
    contextMenu.addEventListener('click', (e) => {
        const action = e.target.getAttribute('data-action');
        if (!action || !contextActions[action]) return;
        closeContextMenu();
        contextActions[action](contextMenuData);
    });
});
