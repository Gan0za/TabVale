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
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', logo: 'https://icons.duckduckgo.com/ip3/duckduckgo.com.ico' },
    { name: 'Google', url: 'https://www.google.com/search?q=%s', logo: 'https://www.google.com/favicon.ico' },
    { name: 'Bing', url: 'https://www.bing.com/search?q=%s', logo: 'https://www.bing.com/favicon.ico' },
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
// 1.5 Локализация интерфейса
//
// chrome.i18n.getMessage умеет читать только язык браузера и не умеет
// переключаться на лету, поэтому делаем свой загрузчик: при смене языка
// читаем _locales/<код>/messages.json и подставляем строки заново.
// =============================================================================

// Справочник языков: код = имя папки в _locales, flag = SVG-картинка в
// newtab/flags/. Флаги — картинки, а не эмодзи: Windows/Chrome не рисуют
// эмодзи-флаги (вместо флага видны буквы RU/GB).
const LANGUAGES = [
    { code: 'auto', flag: null, name: 'Auto' },
    { code: 'ru', flag: 'newtab/flags/ru.svg', name: 'Русский' },
    { code: 'en', flag: 'newtab/flags/gb.svg', name: 'English' },
];

// Текущий режим темы — нужен, чтобы после смены языка обновить подпись
// кнопки селектора темы (она содержит переведённое слово)
let currentThemeMode = 'auto';

// Кэш загруженных переводов текущего языка (заполняет applyLocale)
let currentMessages = {};

/**
 * Возвращает строку перевода по ключу с подстановкой переменных.
 * t('importSkipped', { count: 3 }) подставит $count$ = 3.
 * Если ключа нет — возвращаем ключ, чтобы пропуски были видны сразу.
 */
function t(key, vars) {
    let text = currentMessages[key]?.message || key;
    if (vars) {
        for (const [name, value] of Object.entries(vars)) {
            text = text.replaceAll(`$${name}$`, value);
        }
    }
    return text;
}

/**
 * Подпись кнопки селектора темы: иконка + переведённое название режима.
 * Используется и в applyTheme, и в applyLocale (после смены словаря).
 */
function themeLabel(mode) {
    const icons = { auto: '🌗', light: '☀️', dark: '🌙' };
    const keys = { auto: 'themeAuto', light: 'themeLight', dark: 'themeDark' };
    return `${icons[mode] || icons.auto} ${t(keys[mode])}`;
}

/**
 * Определяет код языка из настройки пользователя.
 * 'auto' — берём язык браузера (первые 2 символа: 'ru-RU' -> 'ru').
 * Если языка нет в _locales — откатываемся на русский.
 */
function resolveLocale(langSetting) {
    const browserLang = (navigator.language || 'ru').slice(0, 2);
    const lang = langSetting && langSetting !== 'auto' ? langSetting : browserLang;
    return LANGUAGES.some((l) => l.code === lang) ? lang : 'ru';
}

/**
 * Применяет язык ко всему интерфейсу:
 *  1) загружает словарь _locales/<lang>/messages.json,
 *  2) заменяет тексты в статической разметке (data-i18n),
 *  3) перерисовывает динамические части (контекстные меню, списки).
 * Вызывается при старте и при смене языка пользователем.
 */
async function applyLocale(langSetting) {
    const lang = resolveLocale(langSetting);
    // Словарь лежит рядом со страницей расширения — fetch отдаст его
    // из пакета расширения без сети
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const response = await fetch(url);
    currentMessages = await response.json();
    document.documentElement.lang = lang;

    // Статическая разметка: <h1 data-i18n="pageTitle">
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = t(el.dataset.i18n);
    });
    // Плейсхолдеры полей: data-i18n-placeholder="searchPlaceholder"
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    // Aria-подписи кнопок без текста
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
        el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
    document.title = t('pageTitle');

    // Подпись кнопки темы содержит переведённое слово — обновляем
    const selectedThemeName = document.getElementById('selected-theme-name');
    if (selectedThemeName) {
        selectedThemeName.textContent = themeLabel(currentThemeMode);
    }

    // Динамические списки перерисовываем, если данные уже загружены
    if (typeof currentState === 'object' && currentState?.searchEngines) {
        refreshUI();
    }
    return lang;
}

/**
 * Строит выпадающий список языков: пункт с флагом-картинкой и названием.
 * Пункты собираются из справочника LANGUAGES — добавили папку в
 * _locales и строку здесь — язык появился в списке.
 */
function buildLanguageMenu(container, currentLangCode, onPick) {
    if (!container) return;
    container.textContent = '';
    for (const lang of LANGUAGES) {
        const item = document.createElement('button');
        item.className = `dropdown-item${lang.code === currentLangCode ? ' selected' : ''}`;
        item.dataset.lang = lang.code;

        // Флаг — SVG-картинка (эмодзи-флаги Windows не рисует).
        // У 'auto' флага нет — оставляем пустой отступ, названия выравнены
        const flag = document.createElement('img');
        flag.className = 'flag-icon';
        if (lang.flag) {
            setImageSource(flag, chrome.runtime.getURL(lang.flag), '');
        } else {
            setImageSource(flag, '', '');
            flag.style.visibility = 'hidden';
        }
        item.appendChild(flag);

        const label = document.createElement('span');
        label.textContent = lang.name;
        item.appendChild(label);

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            onPick(lang.code);
            // Меню двух видов: у FAB-меню видимость управляется классом
            // hidden, у dropdown в модалке — классом open. Закрываем по типу:
            // dropdown'у hidden добавлять нельзя — .hidden { display: none
            // !important } перебьёт .open и меню больше не откроется.
            container.classList.remove('open');
            if (container.classList.contains('theme-menu')) {
                container.classList.add('hidden');
            }
        });
        container.appendChild(item);
    }
}


// =============================================================================
// 2. Работа с хранилищем
// =============================================================================

/**
 * Проверяет, что строка — безопасный веб-адрес (http или https).
 * Запрещены javascript:, data:, file: и всё, что не парсится как URL:
 * данные могут прийти из импортированного чужого файла, и адрес,
 * который браузер выполнит как код, не должен попадать в хранилище.
 */
function isSafeWebUrl(value) {
    try {
        const parsed = new URL(String(value));
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Проверяет один элемент импорта. Возвращает true, если элемент можно
 * безопасно перенести в хранилище, false — если отбросить.
 *
 * Типы различаются структурой: у поисковиков имя хранится в поле name
 * (а не title), у фонов пустой url допустим — это фон "По умолчанию".
 */
function isValidImportedItem(item, { requirePlaceholder = false, allowEmptyUrl = false } = {}) {
    if (!item || typeof item !== 'object') return false;

    // URL: http/https; для фонов разрешён пустой (фон "По умолчанию")
    if (item.url === '' || item.url === undefined) {
        if (!allowEmptyUrl) return false;
    } else if (!isSafeWebUrl(item.url)) {
        return false;
    }

    // У поисковых систем URL должен содержать %s — место для запроса
    if (requirePlaceholder && !String(item.url).includes('%s')) return false;

    // Название: непустая строка (name у поисковиков, title у остальных)
    const title = requirePlaceholder ? item.name : item.title;
    if (typeof title !== 'string' || !title.trim()) return false;

    // Иконка/логотип, если указан, тоже должен быть безопасным адресом
    const iconValue = item.icon || item.logo || '';
    if (iconValue && !isSafeWebUrl(iconValue)) return false;

    return true;
}

/**
 * Санитизация импортированного списка: возвращает только корректные
 * элементы и число отброшенных. Битый элемент не отменяет импорт
 * целиком — просто пропускается.
 */
function sanitizeList(raw, { requirePlaceholder = false, allowEmptyUrl = false } = {}) {
    if (!Array.isArray(raw)) return { items: [], skipped: 0 };
    let skipped = 0;
    const items = raw.filter((item) => {
        if (isValidImportedItem(item, { requirePlaceholder, allowEmptyUrl })) return true;
        skipped++;
        return false;
    });
    return { items, skipped };
}

/**
 * Читает данные из chrome.storage.sync.
 *
 * Зачем обёртка: каждый колбэк chrome.* обязан проверять
 * chrome.runtime.lastError — если этого не делать, при реальной ошибке
 * (например, квота хранилища) браузер пишет в консоль
 * "Unchecked runtime.lastError", и это претензия ревью Chrome Web Store.
 * Одна обёртка проверяет ошибку в одном месте вместо каждого вызова.
 *
 * keys — строка или массив ключей; callback(result) получит результат
 * даже при ошибке (тогда result будет пустым объектом).
 */
function storageGet(keys, callback) {
    chrome.storage.sync.get(keys, (result) => {
        // Читаем lastError ДО всего остального — иначе браузер сочтёт,
        // что мы его проигнорировали
        void chrome.runtime?.lastError;
        callback(result || {});
    });
}

/**
 * Записывает данные в chrome.storage.sync с проверкой ошибки.
 * Ошибка не прерывает работу интерфейса: пользователь продолжит работать,
 * а проблема будет видна в консоли (WARN-лог).
 */
function storageSet(items, callback) {
    chrome.storage.sync.set(items, () => {
        const error = chrome.runtime?.lastError;
        if (error) {
            console.warn('Не удалось сохранить настройки:', error.message);
        }
        callback?.();
    });
}

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
    storageSet(payload);
}

/**
 * Читает всё состояние из хранилища.
 * Если какого-то поля нет (первый запуск) — подставляет значения по умолчанию.
 */
function getState(callback) {
    storageGet(['searchEngines', 'bookmarks', 'backgrounds', 'currentBackgroundIndex', 'currentSearchEngineIndex'], (result) => {
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
        ['edit-bookmark', t('edit'), '✎'],
        ['delete-bookmark', t('delete'), '×'],
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
                { action: 'editBookmark', label: t('edit') },
                { action: 'deleteBookmark', label: t('delete') },
                { action: 'openInNewTab', label: t('openInNewTab') },
                { action: 'copyLink', label: t('copyLink') },
                { separator: true },
                { action: 'openSettings', label: t('settings') },
            ];
        case 'background':
            // Меню пустого фона: смена фона и переходы в настройки.
            // "Редактировать" открывает редактор текущего (выбранного) фона,
            // "Настройки" — под разделителем, как в меню плитки закладки
            return [
                { action: 'nextBackground', label: t('nextBackground') },
                { action: 'editBackground', label: t('edit') },
                { action: 'backgroundSettings', label: t('backgroundSettings') },
                { separator: true },
                { action: 'openSettings', label: t('settings') },
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
                items.push({ action: 'pasteAndSearch', label: t('pasteAndSearch') });
                items.push({ action: 'pasteToSearch', label: t('paste') });
            }
            if (data.hasText) {
                items.push({ action: 'copySearch', label: t('copy') });
                items.push({ action: 'cutSearch', label: t('cut') });
                items.push({ action: 'clearSearch', label: t('clear') });
            }
            items.push({ action: 'searchEngineSettings', label: t('searchEngineSettings') });
            items.push({ separator: true });
            items.push({ action: 'openSettings', label: t('settings') });
            return items;
        }
        case 'settingsRow':
            // Меню строки в модалке настроек — повторяет её кнопки.
            // У закладок нет кнопки "Выбрать", поэтому пункт добавляется по флагу.
        {
            const items = [];
            if (data.selectable) items.push({ action: 'rowSelect', label: t('select') });
            items.push({ action: 'rowEdit', label: t('edit') });
            items.push({ action: 'rowDelete', label: t('delete') });
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
        empty.textContent = t('emptyList');
        container.appendChild(empty);
        return;
    }

    items.forEach((item, index) => container.appendChild(buildItemFn(item, index)));
}

function renderBookmarkManagerItem(bookmark, index) {
    return buildManagerListItem({
        buttons: [
            ['bookmark-manage-edit', t('editShort')],
            ['bookmark-manage-delete', t('delete')],
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
            ['background-manage-select', t('select')],
            ['background-manage-edit', t('editShort')],
            ['background-manage-delete', t('delete')],
        ],
        selected: index === currentIndex,
        imageUrl: background.url || null,
        emptyImageText: t('noImage'),
        title: background.title,
        subtitle: background.url || t('defaultBackground'),
        index,
        rowType: 'background'
    });
}

function renderSearchEngineManagerItem(engine, index, selectedIndex) {
    return buildManagerListItem({
        buttons: [
            ['search-engine-select', t('select')],
            ['search-engine-edit', t('editShort')],
            ['search-engine-delete', t('delete')],
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
        // Подпись и подсветка в селекторе темы («Общие» настройки)
        currentThemeMode = mode;
        const selectedThemeName = document.getElementById('selected-theme-name');
        if (selectedThemeName) selectedThemeName.textContent = themeLabel(mode);
        document.querySelectorAll('#theme-general-list .dropdown-item').forEach((b) => {
            b.classList.toggle('selected', b.dataset.mode === mode);
        });
    }

    // Реагируем на переключение темы в системе, пока активен режим "auto"
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        storageGet('theme', (result) => {
            if ((result.theme || 'auto') === 'auto') applyTheme('auto');
        });
    });

    // Загружаем сохранённый режим и включаем переключатель
    storageGet('theme', (result) => {
        currentThemeMode = result.theme || 'auto';
        applyTheme(currentThemeMode);
    });
    themeToggle?.addEventListener('click', (e) => {
        // Показать/спрять мини-меню выбора темы.
        // stopPropagation: иначе клик дойдёт до document и тут же закроет меню
        e.stopPropagation();
        closeAllPopovers(themeMenu);
        themeMenu.classList.toggle('hidden');
    });

    // Селектор темы в модалке («Общие»): работает как dropdown поисковика,
    // открывается классом open (CSS display: none -> block)
    const themeGeneralButton = document.getElementById('theme-general-button');
    const themeGeneralList = document.getElementById('theme-general-list');
    themeGeneralButton?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllPopovers(themeGeneralList);
        themeGeneralList.classList.toggle('open');
    });
    themeGeneralList?.addEventListener('click', (e) => {
        // Клик по пункту или по его иконке: ищем кнопку пункта
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        const mode = item.dataset.mode;
        if (!mode) return;
        currentThemeMode = mode;
        storageSet({ theme: mode });
        applyTheme(mode);
        themeGeneralList.classList.remove('open');
    });

    // =============================================================================
    // Выбор языка интерфейса
    // =============================================================================

    const languageToggle = document.getElementById('language-toggle');
    const languageMenu = document.getElementById('language-menu');
    const languageButton = document.getElementById('language-button');
    const languageList = document.getElementById('language-list');

    /**
     * Закрывает все всплывающие меню, кроме указанного (except).
     *
     * Зачем: кнопки-переключатели вызывают stopPropagation — клик по ним
     * не доходит до document и не закрывает чужие меню. Без явного закрытия
     * селекторы остаются открытыми и перекрывают друг друга.
     *
     * Меню двух видов, у каждого свой механизм видимости:
     *   - FAB-меню (тема и язык на главном экране): скрыты классом hidden;
     *   - dropdown-меню (селекторы в «Общих», поисковик): видны по классу open.
     * Если dropdown'у добавить hidden, он навсегда потеряет видимость
     * (display: none !important перебивает .open), поэтому механизмы
     * не смешиваются.
     */
    function closeAllPopovers(except) {
        for (const menu of [themeMenu, languageMenu]) {
            if (menu && menu !== except) menu.classList.add('hidden');
        }
        for (const menu of [themeGeneralList, languageList, searchEngineList]) {
            if (menu && menu !== except) menu.classList.remove('open');
        }
    }

    /**
     * Показывает выбранный язык на кнопках обоих переключателей
     * (🌐 FAB и кнопка в «Общих» настройках).
     */
    function updateLanguageButton(langSetting) {
        const lang = resolveLocale(langSetting);
        const info = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];
        const nameEl = document.getElementById('selected-language-name');
        const iconEl = document.getElementById('selected-language-icon');
        if (nameEl) {
            // Для 'auto' подписываем, что это язык браузера
            nameEl.textContent = langSetting === 'auto'
                ? `${info.name} (${t('langAuto')})`
                : info.name;
        }
        if (iconEl) {
            if (info.flag) {
                iconEl.classList.remove('hidden');
                setImageSource(iconEl, chrome.runtime.getURL(info.flag), '');
            } else {
                iconEl.classList.add('hidden');
            }
        }
        if (languageButton) languageButton.title = info.name;
    }

    /**
     * Смена языка: сохранить настройку и применить словарь на лету,
     * без перезагрузки страницы
     */
    function changeLanguage(code) {
        storageSet({ lang: code });
        applyLocale(code).then(() => updateLanguageButton(code));
    }

    // Оба меню (🌐 и селектор в «Общих») наполняются одинаково
    storageGet('lang', (result) => {
        const langSetting = result.lang || 'auto';
        buildLanguageMenu(languageMenu, resolveLocale(langSetting), changeLanguage);
        buildLanguageMenu(languageList, resolveLocale(langSetting), changeLanguage);
        updateLanguageButton(langSetting);
    });

    languageToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllPopovers(languageMenu);
        languageMenu.classList.toggle('hidden');
        // При каждом открытии обновить подсветку текущего языка
        if (!languageMenu.classList.contains('hidden')) {
            storageGet('lang', (result) => {
                buildLanguageMenu(languageMenu, resolveLocale(result.lang || 'auto'), changeLanguage);
            });
        }
    });
    languageButton?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllPopovers(languageList);
        // dropdown-menu открывается классом open (display: none -> block);
        // hidden снят closeAllPopovers только у чужих меню — у своего его
        // и не было
        languageList.classList.toggle('open');
        if (languageList.classList.contains('open')) {
            storageGet('lang', (result) => {
                buildLanguageMenu(languageList, resolveLocale(result.lang || 'auto'), changeLanguage);
            });
        }
    });
    // Клик мимо меню языка закрывает его
    document.addEventListener('click', (e) => {
        if (!languageMenu.contains(e.target)) languageMenu.classList.add('hidden');
        if (!languageList.contains(e.target)) languageList.classList.remove('open');
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

    // Сначала язык: applyLocale перерисует статические тексты и (после
    // загрузки состояния) динамические списки. Затем обычная загрузка данных.
    getState((state) => {
        currentState = state;
        storageGet('lang', (result) => {
            applyLocale(result.lang || 'auto').then(() => {
                refreshUI();
                updateLanguageButton(result.lang || 'auto');
            });
        });
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
        closeAllPopovers(searchEngineList);
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
        storageGet('theme', (result) => {
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
            // Каждый список прогоняем через санитизацию: элементы с
            // небезопасными адресами (javascript: и т.п.) и битыми полями
            // отбрасываются, остальное импортируется
            const bookmarks = sanitizeList(payload.bookmarks);
            const backgrounds = sanitizeList(payload.backgrounds, { allowEmptyUrl: true });
            const searchEngines = sanitizeList(payload.searchEngines, { requirePlaceholder: true });

            if (payload.bookmarks !== undefined) newState.bookmarks = bookmarks.items;
            if (payload.backgrounds !== undefined) newState.backgrounds = backgrounds.items;
            if (payload.searchEngines !== undefined) newState.searchEngines = searchEngines.items;
            if (typeof payload.currentBackgroundIndex === 'number') newState.currentBackgroundIndex = payload.currentBackgroundIndex;
            if (typeof payload.currentSearchEngineIndex === 'number') newState.currentSearchEngineIndex = payload.currentSearchEngineIndex;
            // Режим темы: импортируем только корректные значения,
            // а старые файлы без поля theme не трогаем
            const themeModes = ['auto', 'light', 'dark'];
            let importedTheme = null;
            if (themeModes.includes(payload.theme)) importedTheme = payload.theme;
            saveState(newState);
            if (importedTheme) {
                storageSet({ theme: importedTheme });
                applyTheme(importedTheme);
            }
            currentState = newState;
            refreshUI();
            // Сообщаем не только об успехе, но и о пропущенных элементах:
            // молчаливое отбрасывание выглядело бы как потеря данных
            const totalSkipped = bookmarks.skipped + backgrounds.skipped + searchEngines.skipped;
            // Сообщаем не только об успехе, но и о пропущенных элементах:
            // молчаливое отбрасывание выглядело бы как потеря данных
            alert(totalSkipped
                ? t('importSkipped', { count: totalSkipped })
                : t('importSuccess'));
        } catch (err) {
            alert(t('importError', { error: err.message }));
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

        if (!title || !rawUrl) { alert(t('errTitleAndUrl')); return; }

        // Если пользователь ввёл адрес без "https://", добавим его сами
        const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        let urlObj;
        try { urlObj = new URL(normalizedUrl); } catch { alert(t('errInvalidUrl')); return; }

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
        if (!url) { alert(t('errBookmarkUrl')); return; }
        findBookmarkLogoButton.disabled = true;
        findBookmarkLogoButton.textContent = t('searchButton') + '...';
        try {
            const logoUrl = await fetchLogoWithFallback(url);
            if (logoUrl) {
                bookmarkIconInput.value = logoUrl;
                alert(t('logoFound'));
            } else {
                alert(t('logoNotFound'));
            }
        } finally {
            findBookmarkLogoButton.disabled = false;
            findBookmarkLogoButton.textContent = t('findLogo');
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
        if (!title) { alert(t('errTitle')); return; }
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
        if (!name || !url || !url.includes('%s')) { alert(t('errNameAndUrl')); return; }

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
        if (!url || !url.includes('%s')) { alert(t('errEngineUrl')); return; }
        findSearchEngineLogoButton.disabled = true;
        findSearchEngineLogoButton.textContent = t('searchButton') + '...';
        try {
            const logoUrl = await fetchLogoWithFallback(url);
            if (logoUrl) {
                newSearchEngineLogo.value = logoUrl;
                alert(t('logoFound'));
            } else {
                alert(t('logoNotFound'));
            }
        } finally {
            findSearchEngineLogoButton.disabled = false;
            findSearchEngineLogoButton.textContent = t('findLogo');
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
    // Как на рабочем столе смартфона: пока тащишь плитку, соседи плавно
    // расступаются. Точка вставки вычисляется геометрически (по позиции
    // курсора относительно центров плиток), узлы плиток не пересоздаются —
    // FLIP-анимация плавно доезжает до новых мест без моргания.
    // =============================================================================

    let draggedIndex = null;

    /**
     * Обновляет позиции плиток в DOM без их пересоздания.
     *
     * Ключевое отличие от полной перерисовки: узлы плиток живут столько,
     * сколько длится перенос. Это убирает две проблемы прежней версии:
     * 1) dragend не срабатывал на пересозданном узле — плитка зависала
     *    повёрнутой; 2) переназначение обработчиков и inline-стилей
     * "моргало" на каждой перестановке.
     */
    function reorderBookmarksAnimated(fromIndex, toIndex) {
        const [moved] = currentState.bookmarks.splice(fromIndex, 1);
        currentState.bookmarks.splice(toIndex, 0, moved);
        draggedIndex = toIndex;

        // FLIP: First — позиции плиток до перестановки (узлы те же)
        const before = new Map();
        bookmarksContainer.querySelectorAll('.bookmark').forEach((el) => {
            before.set(el.dataset.url, el.getBoundingClientRect());
        });

        // Last: переставляем существующие узлы в новом порядке
        const ordered = currentState.bookmarks.map((b) =>
            bookmarksContainer.querySelector(`.bookmark[data-url="${CSS.escape(b.url)}"]`)
        );
        ordered.forEach((el) => bookmarksContainer.appendChild(el));

        // Синхронизируем индексы с новым порядком: от dataset.index
        // зависят редактирование/удаление по клику и подсчёт слотов ниже
        bookmarksContainer.querySelectorAll('.bookmark').forEach((el, i) => {
            el.dataset.index = i;
        });

        // Invert + Play: едем из старой позиции в новую.
        // Перетаскиваемая плитка анимируется тоже, но с сохранением
        // поворота из .dragging — иначе при каждом перестроении
        // "моргал" бы наклон
        bookmarksContainer.querySelectorAll('.bookmark').forEach((el) => {
            const isDragged = Number(el.dataset.index) === draggedIndex;
            const prev = before.get(el.dataset.url);
            if (!prev) return;
            const now = el.getBoundingClientRect();
            const dx = prev.left - now.left;
            const dy = prev.top - now.top;
            if (!dx && !dy) return;

            el.style.transition = 'none';
            el.style.transform = `translate(${dx}px, ${dy}px)` + (isDragged ? ' rotate(5deg)' : '');
            el.getBoundingClientRect(); // форсируем reflow, иначе браузер слепит кадры
            el.style.transition = '';
            el.style.transform = isDragged ? 'rotate(5deg)' : '';
        });
    }

    /**
     * Слот вставки по координатам курсора. Сетка закладок многострочная,
     * поэтому слот считается в два шага:
     *   1. Плитки группируются в ряды по вертикальной позиции (близкий
     *      top — один ряд). Выбирается ряд, ближайший к курсору.
     *   2. Слот = число плиток в рядах выше + число центров, пройденных
     *      курсором внутри этого ряда (слева направо).
     * Так курсор на нижнем ряду не "проходит" центры верхнего — иначе
     * слот прыгал бы через 2-3 позиции и элемент улетал вверх.
     */
    function getDropIndex(mouseX, mouseY) {
        const tiles = [...bookmarksContainer.querySelectorAll('.bookmark')];
        if (!tiles.length) return 0;

        // Группировка в ряды: плитки с top в пределах 10px — один ряд
        const rows = [];
        tiles.forEach((tile) => {
            const top = tile.getBoundingClientRect().top;
            const row = rows.find((r) => Math.abs(r.top - top) <= 10);
            if (row) row.tiles.push(tile);
            else rows.push({ top, tiles: [tile] });
        });

        // Ряд, ближайший к курсору по вертикали
        let nearest = rows[0];
        let nearestDist = Infinity;
        rows.forEach((row) => {
            const rect = row.tiles[0].getBoundingClientRect();
            const dist = Math.abs(rect.top + rect.height / 2 - mouseY);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = row;
            }
        });

        // Слот: плитки до ряда курсора целиком + пройденные центры ряда
        let slot = 0;
        for (const row of rows) {
            if (row === nearest) {
                row.tiles.forEach((tile) => {
                    const rect = tile.getBoundingClientRect();
                    if (mouseX > rect.left + rect.width / 2) slot++;
                });
                return slot;
            }
            slot += row.tiles.length;
        }
        return slot;
    }

    bookmarksContainer.addEventListener('dragstart', (e) => {
        const el = e.target.closest('.bookmark');
        if (!el) return;
        draggedIndex = Number(el.dataset.index);
        el.classList.add('dragging');
        e.dataTransfer?.setData('text/plain', String(draggedIndex));
    });

    bookmarksContainer.addEventListener('dragend', (e) => {
        // Узлы не пересоздаются, но класс и возможные FLIP-сдвиги всё
        // равно нужно снять со всех плиток — перенос завершён
        bookmarksContainer.querySelectorAll('.bookmark').forEach((el) => {
            el.classList.remove('dragging');
            el.style.transform = '';
        });
        // Перенос мог быть отменён (Esc, drop вне списка) — сбрасываем,
        // иначе следующий dragover переставит элементы со старым индексом
        draggedIndex = null;
    });

    // Пока тащим: точка вставки вычисляется геометрически — сколько
    // центров плиток прошёл курсор. dragover повешен на контейнер,
    // поэтому зазоры между плитками тоже работают
    bookmarksContainer.addEventListener('dragover', (e) => {
        if (draggedIndex === null) return;
        e.preventDefault(); // без этого браузер не даст сделать drop

        const slot = getDropIndex(e.clientX, e.clientY);
        // Слот "до" или "после" перетаскиваемой плитки — она уже на месте
        if (slot === draggedIndex || slot === draggedIndex + 1) return;

        // Слот в текущем списке включает сам перетаскиваемый элемент,
        // поэтому после его удаления индекс вставки смещается на -1
        const insertIndex = slot > draggedIndex ? slot - 1 : slot;
        reorderBookmarksAnimated(draggedIndex, insertIndex);
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
                alert(t('copyFailed'));
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
                    alert(t('cutFailed'));
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
