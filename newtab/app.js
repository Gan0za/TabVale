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

// Связка с главным модулем: refreshUI объявлен внутри обработчика
// DOMContentLoaded и сверху недоступен. Модуль регистрирует здесь свою
// функцию перерисовки, чтобы applyLocale могла обновить динамические
// списки при смене языка на лету (кнопки Select/Edit/Delete и т.п.),
// не дожидаясь перезагрузки страницы. До инициализации — null.
let uiRefresher = null;

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

    // Динамические списки перерисовываем, если главный модуль уже
    // зарегистрировал перерисовку и данные загружены
    if (uiRefresher) uiRefresher();
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
 * (а не title); у фонов пустой url допустим (фон "По умолчанию").
 * Фоны проверяются отдельно (normalizeBackground) — у них свои типы.
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
function sanitizeList(raw, { requirePlaceholder = false } = {}) {
    if (!Array.isArray(raw)) return { items: [], skipped: 0 };
    let skipped = 0;
    const items = raw.filter((item) => {
        if (isValidImportedItem(item, { requirePlaceholder })) return true;
        skipped++;
        return false;
    });
    return { items, skipped };
}

/**
 * Приводит фон к нормализованному виду с полем type. Типы:
 *   url      — картинка по ссылке (url)
 *   file     — картинка с устройства (fileId; сами данные в storage.local)
 *   color    — сплошная заливка (value)
 *   gradient — градиент (from, to, angle)
 * Старые записи без type — картинки по ссылке. Возвращает null,
 * если запись некорректна (в импорте такие отбрасываются).
 */
function normalizeBackground(bg) {
    if (!bg || typeof bg !== 'object') return null;
    const title = typeof bg.title === 'string' && bg.title.trim() ? bg.title : '';
    if (!title) return null;

    const type = bg.type || 'url';

    if (type === 'color') {
        // Только hex —css-имена вроде "red; background:url(...)" не пропускаем
        return /^#[0-9a-fA-F]{6}$/.test(bg.value) ? { type, title, value: bg.value } : null;
    }

    if (type === 'gradient') {
        const from = /^#[0-9a-fA-F]{6}$/.test(bg.from) ? bg.from : '';
        const to = /^#[0-9a-fA-F]{6}$/.test(bg.to) ? bg.to : '';
        if (!from || !to) return null;
        const angle = Number.isFinite(Number(bg.angle))
            ? Math.min(360, Math.max(0, Number(bg.angle)))
            : 160;
        return { type, title, from, to, angle };
    }

    if (type === 'file') {
        const fileId = typeof bg.fileId === 'string' && bg.fileId ? bg.fileId : '';
        // data у записи бывает только в импортируемом файле: при экспорте
        // мы её подкладываем, а в хранилище держим отдельно в storage.local
        const data = typeof bg.data === 'string'
            && bg.data.startsWith('data:image/')
            && bg.data.length <= 15_000_000
            ? bg.data
            : '';
        const position = bg.position ? keyOfPlacement(bg.position) : undefined;
        if (data) {
            const entry = { type, title, fileId: fileId || makeFileId(), data };
            if (position) entry.position = position;
            return entry;
        }
        if (!fileId) return null;
        const entry = { type, title, fileId };
        if (position) entry.position = position;
        return entry;
    }

    // url — текущий и legacy-формат
    const url = bg.url || '';
    if (url && !isSafeWebUrl(url)) return null;
    const entry = { type: 'url', title, url };
    if (bg.position) entry.position = keyOfPlacement(bg.position);
    return entry;
}

/**
 * Санитизация списка фонов при импорте: normalizeBackground для каждого
 * элемента + счётчик отброшенных. У file-фонов попутно генерируется
 * fileId, если его нет.
 */
function sanitizeBackgrounds(raw) {
    if (!Array.isArray(raw)) return { items: [], skipped: 0 };
    const items = [];
    let skipped = 0;
    for (const item of raw) {
        const bg = normalizeBackground(item);
        if (bg) items.push(bg);
        else skipped++;
    }
    return { items, skipped };
}

/**
 * CSS-значение фона для body. file требует dataUrl из local-хранилища —
 * без него вернётся '' (останется градиент из styles.css).
 */
function buildBackgroundCss(bg, fileDataUrl) {
    if (!bg) return '';
    if (bg.type === 'color' && bg.value) return bg.value;
    if (bg.type === 'gradient' && bg.from && bg.to) {
        return `linear-gradient(${bg.angle || 160}deg, ${bg.from}, ${bg.to})`;
    }
    if (bg.type === 'file') return fileDataUrl ? `url("${fileDataUrl}")` : '';
    if (bg.url) return `url("${bg.url}")`;
    return '';
}

/**
 * Превью заливки для списка настроек: маленький SVG-квадрат с тем же
 * цветом или градиентом. Для картинок вернётся null — там превью сама
 * картинка.
 */
function swatchDataUrl(bg) {
    if (bg?.type === 'color' && bg.value) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="50" height="50" fill="${bg.value}"/></svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
    if (bg?.type === 'gradient' && bg.from && bg.to) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50">`
            + `<defs><linearGradient id="g" gradientTransform="rotate(${bg.angle || 160}, 25, 25)">`
            + `<stop offset="0" stop-color="${bg.from}"/>`
            + `<stop offset="1" stop-color="${bg.to}"/>`
            + `</linearGradient></defs>`
            + `<rect width="50" height="50" fill="url(#g)"/></svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
    return null;
}

/**
 * Положение картинки-фона (поле position записи) в css-свойства
 * background-size/position/repeat. Допустимые значения: cover, contain,
 * tile (замостить), center (1:1 по центру). Всё неизвестное -> cover.
 */
const BG_POSITIONS = ['cover', 'contain', 'tile', 'center'];

function keyOfPlacement(position) {
    return BG_POSITIONS.includes(position) ? position : 'cover';
}

function backgroundPlacementCss(position) {
    switch (keyOfPlacement(position)) {
        case 'contain': return { size: 'contain', position: 'center', repeat: 'no-repeat' };
        case 'tile': return { size: 'auto', position: 'top left', repeat: 'repeat' };
        case 'center': return { size: 'auto', position: 'center', repeat: 'no-repeat' };
        default: return { size: 'cover', position: 'center', repeat: 'no-repeat' };
    }
}

// Пресеты градиентов [от, до, угол] — клик заполняет конструктор
const GRADIENT_PRESETS = [
    ['#a8c8e8', '#e8d8c8', 160],
    ['#667eea', '#764ba2', 135],
    ['#f093fb', '#f5576c', 135],
    ['#4facfe', '#00f2fe', 135],
    ['#43e97b', '#38f9d7', 135],
    ['#fa709a', '#fee140', 160],
    ['#30cfd0', '#330867', 160],
    ['#232526', '#414345', 160],
];

/**
 * Ключ записи data:URL в storage.local для file-фона.
 */
function fileKey(fileId) {
    return `bgFile:${fileId}`;
}

function makeFileId() {
    return 'bg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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
    // file-фоны подменяют заглушку на превью асинхронно: данные
    // pictures лежат в storage.local и приходят позже отрисовки
    if (rowType === 'background' && !imageUrl) {
        imageEl.dataset.fileThumb = index; // индекс для последующего поиска
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
            // "Настройки" — под разделителем, как в меню плитки закладки.
            // "Редактировать" есть, если есть хоть один фон; "Следующий
            // фон" — только при двух и больше: с одним переключать нечего.
            // Если фонов нет, оба пункта скрываются
        {
            const items = [];
            if (data.hasBackgrounds) items.push({ action: 'editBackground', label: t('edit') });
            if (data.canSwitchBackground) {
                items.unshift({ action: 'nextBackground', label: t('nextBackground') });
            }
            items.push({ action: 'backgroundSettings', label: t('backgroundSettings') });
            items.push({ separator: true });
            items.push({ action: 'openSettings', label: t('settings') });
            return items;
        }
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
        case 'bookmarksEmpty':
            // Меню пустого места секции закладок. Динамическое: если в буфере
            // обмена корректный веб-адрес (data.hasClipboardUrl), первым идёт
            // пункт "Вставить и создать" — закладка добавится без формы
        {
            const items = [];
            if (data.hasClipboardUrl) {
                items.push({ action: 'pasteAndCreateBookmark', label: t('pasteAndCreate') });
            }
            items.push({ action: 'addBookmark', label: t('createBookmark') });
            items.push({ action: 'sortBookmarksAsc', label: t('sortAsc') });
            items.push({ action: 'sortBookmarksDesc', label: t('sortDesc') });
            items.push({ separator: true });
            items.push({ action: 'openSettings', label: t('settings') });
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
    // Превью: цвет/градиент рисуются SVG-квадратиком, картинки — собой
    let subtitle;
    if (background.type === 'color') subtitle = background.value || '';
    else if (background.type === 'gradient') subtitle = `${background.from} → ${background.to}`;
    else if (background.type === 'file') subtitle = t('fileBackground');
    else subtitle = background.url || t('defaultBackground');

    return buildManagerListItem({
        buttons: [
            ['background-manage-select', t('select')],
            ['background-manage-edit', t('editShort')],
            ['background-manage-delete', t('delete')],
        ],
        selected: index === currentIndex,
        imageUrl: swatchDataUrlSafe(background) || background.url || null,
        emptyImageText: t('noImage'),
        title: background.title,
        subtitle,
        index,
        rowType: 'background'
    });
}

/**
 * swatchDataUrl обёрнут для устойчивости к отсутствию функции в тестах.
 */
function swatchDataUrlSafe(bg) {
    try {
        return swatchDataUrl(bg);
    } catch {
        return null;
    }
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
 * Для file-фона data:URL сначала читается из storage.local — применяем
 * асинхронно, когда данные придут.
 */
function setBackground(backgrounds, currentBackgroundIndex) {
    const background = backgrounds[currentBackgroundIndex];
    if (!background) {
        document.body.style.backgroundImage = '';
        return;
    }

    const isPicture = background.type === 'url' || background.type === 'file' || background.url;

    const apply = (cssValue) => {
        document.body.style.background = cssValue;
        // Свойство из CSS сбрасывается записью background — возвращаем,
        // чтобы фон не уезжал при прокрутке страницы
        document.body.style.backgroundAttachment = 'fixed';
        // Положение задаём только картинкам; заливки и градиенты
        // заполняют экран сами (сброс на значения по умолчанию из CSS)
        if (isPicture) {
            const placement = backgroundPlacementCss(background.position);
            document.body.style.backgroundSize = placement.size;
            document.body.style.backgroundPosition = placement.position;
            document.body.style.backgroundRepeat = placement.repeat;
        } else {
            document.body.style.backgroundSize = '';
            document.body.style.backgroundPosition = '';
            document.body.style.backgroundRepeat = '';
        }
    };

    if (background.type === 'color' || background.type === 'gradient') {
        apply(buildBackgroundCss(background));
        return;
    }

    if (background.type === 'file') {
        if (!background.fileId) { apply(''); return; }
        chrome.storage.local.get(fileKey(background.fileId), (result) => {
            const err = chrome.runtime?.lastError;
            apply(buildBackgroundCss(background, err ? '' : (result || {})[fileKey(background.fileId)]));
        });
        return;
    }

    apply(buildBackgroundCss(background));
}

/* Максимальная длина названия поисковика: длинное разрывало бы кнопку
   селектора; всё сверх лимита отрезается с многоточием */
const SEARCH_NAME_MAX = 24;

/**
 * Обрезает название поисковика до SEARCH_NAME_MAX символов, ставя
 * многоточие. Применяется при сохранении: в хранилище попадает уже
 * короткое имя, а подписи в UI дополнительно поджимаются CSS.
 */
function clampSearchName(name) {
    const trimmed = String(name).trim();
    if (trimmed.length <= SEARCH_NAME_MAX) return trimmed;
    return trimmed.slice(0, SEARCH_NAME_MAX - 1) + '…';
}

/**
 * Название по умолчанию из адреса: https://www.github.com -> Github.
 * Поддерживает адреса поисковиков с %s (шаблоны вида
 * https://www.google.com/search?q=%s) — %s отбрасывается до разбора.
 */
function suggestNameFromUrl(urlString) {
    try {
        const hostname = new URL(String(urlString).replace('%s', '')).hostname;
        const first = hostname.replace(/^www\./, '').split('.')[0];
        return first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
    } catch {
        return '';
    }
}

/**
 * Приводит адрес пользователя к виду с протоколом: "github.com" ->
 * "https://github.com". Возвращает '' для некорректных адресов.
 */
function normalizeUrl(rawUrl) {
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    try {
        new URL(url);
        return url;
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
    const bookmarkDetails = document.getElementById('bookmark-details');
    const addBookmarkButton = document.getElementById('add-bookmark');
    const saveBookmarkButton = document.getElementById('save-bookmark');
    const refreshBookmarkIconButton = document.getElementById('refresh-bookmark-icon');

    // Форма фонов
    const backgroundManagerList = document.getElementById('background-manager-list');
    const backgroundTitleInput = document.getElementById('background-title-input');
    const backgroundUrlInput = document.getElementById('background-url-input');
    const saveBackgroundButton = document.getElementById('save-background');
    const backgroundFileInput = document.getElementById('background-file-input');
    const backgroundPositionRow = document.getElementById('background-position-row');
    const backgroundPositionInput = document.getElementById('background-position-input');
    const backgroundColorInput = document.getElementById('background-color-input');
    const gradientFromInput = document.getElementById('gradient-from-input');
    const gradientToInput = document.getElementById('gradient-to-input');
    const gradientAngleInput = document.getElementById('gradient-angle-input');
    const gradientPreview = document.getElementById('gradient-preview');
    const gradientPresets = document.getElementById('gradient-presets');

    // Форма поисковых систем
    const searchEnginesList = document.getElementById('search-engines-list');
    const newSearchEngineName = document.getElementById('new-search-engine-name');
    const newSearchEngineUrl = document.getElementById('new-search-engine-url');
    const newSearchEngineLogo = document.getElementById('new-search-engine-logo');
    const searchEngineDetails = document.getElementById('search-engine-details');
    const addSearchEngineButton = document.getElementById('add-search-engine');
    const saveSearchEngineButton = document.getElementById('save-search-engine');
    const refreshSearchEngineIconButton = document.getElementById('refresh-search-engine-icon');

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
    themeMenu?.addEventListener('click', (e) => {
        // Клик по пункту или его тексту: ищем кнопку с data-mode
        const item = e.target.closest('button[data-mode]');
        if (!item) return;
        const mode = item.dataset.mode;
        currentThemeMode = mode;
        storageSet({ theme: mode });
        applyTheme(mode);
        themeMenu.classList.add('hidden');
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
        bookmarkUrlInput.value = '';
        collapseDetails(bookmarkDetails);
        bookmarkTitleInput.value = '';
        bookmarkIconInput.value = '';
        toggleBookmarkStep({ editing: false });
    }

    function resetBackgroundForm() {
        editingBackgroundIndex = null;
        backgroundTitleInput.value = '';
        switchBackgroundType('url');
        backgroundUrlInput.value = '';
        backgroundFileInput.value = '';
        backgroundPositionInput.value = 'cover';
        const previewBox = document.getElementById('background-file-preview');
        previewBox.classList.add('hidden');
        delete previewBox.dataset.pendingDataUrl; // кеш выбранного файла сброшен
        backgroundColorInput.value = '#4db6e2';
        updateColorValueLabel();
        applyGradientPreset(GRADIENT_PRESETS[0]);
        refreshUI();
    }

    function resetSearchEngineForm() {
        editingSearchEngineIndex = null;
        newSearchEngineUrl.value = '';
        collapseDetails(searchEngineDetails);
        newSearchEngineName.value = '';
        newSearchEngineLogo.value = '';
        toggleSearchEngineStep({ editing: false });
    }

    // =============================================================================
    // Двухшаговые формы закладок и поисковиков
    //
    // Шаг 1 ("Добавить"): видно только поле URL. Шаг 2 ("Сохранить"):
    // после ввода URL раскрываются поля "Название" и "URL логотипа",
    // заполненные предложенными значениями. Форма фонов остаётся одношаговой.
    // =============================================================================

    /**
     * Раскрывает/сворачивает блок полей второго шага (grid 0fr -> 1fr).
     */
    function expandDetails(el) {
        el?.classList.add('open');
    }

    function collapseDetails(el) {
        el?.classList.remove('open');
    }

    /**
     * Переключает кнопки шага: на шаге 1 видна "Добавить", на шаге 2 —
     * "Сохранить". Признак editing заставляет форму открыться сразу
     * на втором шаге (правка существующего элемента).
     */
    function toggleFormStep({ editing, addButton, saveButton }) {
        addButton.classList.toggle('hidden', editing);
        saveButton.classList.toggle('hidden', !editing);
    }

    function toggleBookmarkStep({ editing }) {
        toggleFormStep({ editing, addButton: addBookmarkButton, saveButton: saveBookmarkButton });
    }

    function toggleSearchEngineStep({ editing }) {
        toggleFormStep({ editing, addButton: addSearchEngineButton, saveButton: saveSearchEngineButton });
    }

    /**
     * Заголовок страницы по её адресу. Разрешение на конкретный сайт
     * запрашивается опционально (пользователь видит промт и может
     * отказать — тогда сразу предлагаем hostname). Если разрешение
     * выдано, страница скачивается через fetch и из её HTML берётся
     * <title>: с host-разрешением расширение может читать ответ, как
     * обычная страница. Никаких вкладок не открывается.
     * В любом случае поле заголовка остаётся редактируемым — предложение
     * можно стереть и вписать своё.
     */
    async function fetchPageTitle(urlString) {
        try {
            const url = new URL(urlString);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
            const granted = await new Promise((resolve) => {
                chrome.permissions.request({ origins: [url.origin + '/*'] }, (ok) => {
                    void chrome.runtime?.lastError;
                    resolve(!!ok);
                });
            });
            if (!granted) return '';
            // Таймаут 5с: сайт может отвечать вечно — ждём его не дольше
            const response = await Promise.race([
                fetch(urlString),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
            ]);
            if (!response.ok) return '';
            const html = await response.text();
            const title = new DOMParser().parseFromString(html, 'text/html').title;
            return title.trim();
        } catch {
            return '';
        }
    }

    /**
     * Заполняет поля второго шага формы: предлагает заголовок страницы
     * (hostname, если <title> недоступен) и адрес favicon.
     */
    function fillBookmarkDetails(urlString) {
        const hostname = suggestNameFromUrl(urlString);
        bookmarkTitleInput.value = hostname;
        bookmarkIconInput.value = `https://${new URL(urlString).hostname}/favicon.ico`;
        // <title> получаем в фоне и подставляем, если пользователь ещё
        // не начал печатать своё название
        fetchPageTitle(urlString).then((title) => {
            if (title && !bookmarkTitleInput.value.trim()) {
                bookmarkTitleInput.value = title;
            }
        });
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

        const focusMap = { bookmarks: bookmarkUrlInput, backgrounds: backgroundTitleInput, 'search-engines': newSearchEngineUrl };
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
        loadFileBackgroundThumbs();
    }

    /**
     * Дозагрузка превью file-фонов в списке настроек. Картинки хранятся
     * в storage.local, а отрисовка строки синхронная — поэтому строки с
     * заглушкой (data-file-thumb) дополняются миниатюрами, когда данные
     * придут из хранилища.
     */
    function loadFileBackgroundThumbs() {
        const fileBackdrops = currentState.backgrounds
            .map((bg, index) => ({ bg, index }))
            .filter(({ bg }) => bg.type === 'file' && bg.fileId);
        if (!fileBackdrops.length) return;

        chrome.storage.local.get(
            fileBackdrops.map(({ bg }) => fileKey(bg.fileId)),
            (result) => {
                const err = chrome.runtime?.lastError;
                if (err) return;
                for (const { bg, index } of fileBackdrops) {
                    const dataUrl = result[fileKey(bg.fileId)];
                    if (!dataUrl) continue;
                    // Строки перерисовываются целиком — ищем заглушку заново
                    const row = backgroundManagerList.querySelector?.(
                        `.modal-list-item[data-index="${index}"]`
                    );
                    const placeholder = row?.querySelector?.('[data-file-thumb]');
                    if (!placeholder) continue;
                    const img = document.createElement('img');
                    setImageSource(img, dataUrl, '');
                    placeholder.replaceWith(img);
                }
            }
        );
    }

    // Смена языка на лету: applyLocale перерисовывает динамические списки
    // через этот делегат (см. uiRefresher в начале файла)
    uiRefresher = refreshUI;

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
                const type = bg.type || 'url';
                // Диалог файла нельзя заполнить программно: сбрасываем кеш
                // выбранного файла — превью прежней картинки покажет
                // showFilePreview (вызвается из switchBackgroundType)
                delete document.getElementById('background-file-preview').dataset.pendingDataUrl;
                switchBackgroundType(type);
                backgroundUrlInput.value = bg.url || '';
                backgroundFileInput.value = '';
                backgroundPositionInput.value = keyOfPlacement(bg.position);
                backgroundColorInput.value = bg.type === 'color' ? bg.value : '#4db6e2';
                updateColorValueLabel();
                if (bg.type === 'gradient') {
                    gradientFromInput.value = bg.from || '#667eea';
                    gradientToInput.value = bg.to || '#764ba2';
                    gradientAngleInput.value = bg.angle ?? 160;
                    updateGradientPreview();
                }
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
        // Редактирование начинается сразу со второго шага: все поля
        // заполнены, видна кнопка "Сохранить"
        if (form === 'bookmark') {
            expandDetails(bookmarkDetails);
            toggleBookmarkStep({ editing: true });
        } else if (form === 'searchEngine') {
            expandDetails(searchEngineDetails);
            toggleSearchEngineStep({ editing: true });
        }
        // Имя вкладки модалки совпадает с ключом формы
        openSettingsModal(form === 'searchEngine' ? 'search-engines' : form + 's');
    }

    /**
     * Удаляет элемент списка по кнопке (с пересчётом выбранного индекса).
     * listKey — имя поля в currentState, indexKey — имя поля-индекса выбранного.
     * Для file-фонов попутно чистит bgFile:* в storage.local: без этого
     * картинки оставались в хранилище навсегда и засоряли квоту.
     */
    function deleteItem(listKey, indexKey, index) {
        const removed = currentState[listKey].splice(index, 1)[0];
        // Если после удаления выбранный индекс вышел за пределы списка
        // (например, удалили последний фон), сдвигаем его к последнему элементу
        if (currentState[indexKey] >= currentState[listKey].length) {
            currentState[indexKey] = Math.max(0, currentState[listKey].length - 1);
        }
        saveState({ [listKey]: currentState[listKey], [indexKey]: currentState[indexKey] });
        // Чистка только когда удаляются именно фоны и это file-фон
        if (listKey === 'backgrounds' && removed?.type === 'file' && removed.fileId) {
            chrome.storage.local.remove(fileKey(removed.fileId));
        }
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
            // file-фоны живут данными в storage.local — на экспорт их
            // нужно подтянуть, иначе на другом устройстве фон потеряется
            const fileBackdrops = currentState.backgrounds.filter((b) => b.type === 'file');
            const keys = fileBackdrops.map((b) => fileKey(b.fileId)).filter(Boolean);
            if (!fileBackdrops.length) {
                downloadJson({ ...currentState, theme: result.theme || 'auto' });
                return;
            }
            chrome.storage.local.get(keys, (files) => {
                void chrome.runtime?.lastError;
                const withData = currentState.backgrounds.map((bg) => (
                    bg.type === 'file' ? { ...bg, data: (files || {})[fileKey(bg.fileId)] || '' } : bg
                ));
                downloadJson({ ...currentState, backgrounds: withData, theme: result.theme || 'auto' });
            });
        });
    });

    /**
     * Скачивает JSON со настройками (общий хвост экспорта).
     */
    function downloadJson(json) {
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'self_tabs_settings.json';
        a.click();
        URL.revokeObjectURL(a.href);
    }

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
            // отбрасываются, остальное импортируется. У фонов своя
            // санитизация: у них типы (url/file/color/gradient)
            const bookmarks = sanitizeList(payload.bookmarks);
            const backgrounds = sanitizeBackgrounds(payload.backgrounds);
            const searchEngines = sanitizeList(payload.searchEngines, { requirePlaceholder: true });

            if (payload.bookmarks !== undefined) newState.bookmarks = bookmarks.items;
            if (payload.backgrounds !== undefined) {
                newState.backgrounds = backgrounds.items;
                // file-фоны из импорта несут data (data:URL) — раскладываем
                // их в storage.local, в sync остаются только fileId
                const fileData = {};
                for (const bg of backgrounds.items) {
                    if (bg.type === 'file' && bg.data) {
                        fileData[fileKey(bg.fileId)] = bg.data;
                        delete bg.data;
                    }
                }
                if (Object.keys(fileData).length) {
                    chrome.storage.local.set(fileData);
                }
            }
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

    // --- Сброс настроек: дефолтные списки, чистка file-фонов, тема auto ---
    document.getElementById('reset-settings').addEventListener('click', () => {
        if (!confirm(t('resetConfirm'))) return;

        // Картинки file-фонов живут в storage.local под ключами bgFile:*:
        // при сбросе записей о фонах они бы остались навсегда
        const staleFileKeys = currentState.backgrounds
            .filter((bg) => bg.type === 'file' && bg.fileId)
            .map((bg) => fileKey(bg.fileId));
        if (staleFileKeys.length) {
            chrome.storage.local.remove(staleFileKeys);
        }

        currentState = {
            searchEngines: DEFAULT_SEARCH_ENGINES,
            bookmarks: DEFAULT_BOOKMARKS,
            backgrounds: DEFAULT_BACKGROUNDS,
            currentBackgroundIndex: 0,
            currentSearchEngineIndex: 0,
        };
        saveState(currentState);
        // Тема возвращается к авто: хранится отдельным ключом, saveState
        // её не затрагивает
        storageSet({ theme: 'auto' });
        applyTheme('auto');

        refreshUI();
        alert(t('resetDone'));
    });

    // =============================================================================
    // Закладки
    // =============================================================================

    // Кнопки "＋ Добавить" и "Отмена" — показ/скрытие формы
    addForms.bookmark.showButton.addEventListener('click', () => showAddForm('bookmark'));
    document.getElementById('cancel-bookmark').addEventListener('click', () => hideAddForm('bookmark'));

    // Кнопка "Добавить" (шаг 1): проверяет URL, предлагает название и
    // иконку, раскрывает остальные поля формы
    addBookmarkButton.addEventListener('click', () => {
        const rawUrl = bookmarkUrlInput.value.trim();
        if (!rawUrl) { alert(t('errBookmarkUrl')); return; }
        const normalizedUrl = normalizeUrl(rawUrl);
        if (!normalizedUrl) { alert(t('errInvalidUrl')); return; }

        fillBookmarkDetails(normalizedUrl);
        expandDetails(bookmarkDetails);
        toggleBookmarkStep({ editing: true });
        bookmarkTitleInput.focus();
        bookmarkTitleInput.select(); // предложенное название легко заменить
    });

    // Enter в поле URL — тот же переход на шаг 2
    bookmarkUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addBookmarkButton.click(); }
    });

    // Кнопка ⟳ у поля "URL логотипа": пересчитать иконку из текущего
    // адреса. Нужна после полной замены URL при редактировании
    refreshBookmarkIconButton.addEventListener('click', () => {
        const normalizedUrl = normalizeUrl(bookmarkUrlInput.value.trim());
        if (!normalizedUrl) { alert(t('errInvalidUrl')); return; }
        bookmarkIconInput.value = `https://${new URL(normalizedUrl).hostname}/favicon.ico`;
    });

    // Кнопка "Сохранить" в форме закладок
    saveBookmarkButton.addEventListener('click', () => {
        const title = bookmarkTitleInput.value.trim();
        const rawUrl = bookmarkUrlInput.value.trim();
        const icon = bookmarkIconInput.value.trim();

        if (!title || !rawUrl) { alert(t('errTitleAndUrl')); return; }

        // Если пользователь ввёл адрес без "https://", добавим его сами
        const normalizedUrl = normalizeUrl(rawUrl);
        if (!normalizedUrl) { alert(t('errInvalidUrl')); return; }
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
    // Фоны. Четыре типа: url (картинка по ссылке), file (загрузка с
    // устройства, данные в storage.local), color (заливка), gradient.
    // =============================================================================

    // Текущий тип в форме: 'url' | 'file' | 'color' | 'gradient'
    let currentBackgroundType = 'url';

    /**
     * Показывает поля выбранного типа и прячет остальные.
     */
    function switchBackgroundType(type) {
        document.querySelectorAll('.bg-type-tab').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.bgType === type);
        });
        backgroundUrlInput.classList.toggle('hidden', type !== 'url');
        backgroundFileInput.classList.toggle('hidden', type !== 'file');
        // Положение картинки выбирается только у url- и file-фонов
        backgroundPositionRow.classList.toggle('hidden', type !== 'url' && type !== 'file');
        document.getElementById('background-color-row').classList.toggle('hidden', type !== 'color');
        document.getElementById('background-gradient-box').classList.toggle('hidden', type !== 'gradient');
        // Превью выбранного файла принадлежит вкладке "Устройство":
        // на других вкладках его прячем, при возврате — восстанавливаем
        const previewBox = document.getElementById('background-file-preview');
        if (type !== 'file') {
            previewBox.classList.add('hidden');
        } else if (previewBox.dataset.pendingDataUrl) {
            previewBox.classList.remove('hidden');
        } else if (editingBackgroundIndex !== null) {
            showFilePreview(currentState.backgrounds[editingBackgroundIndex]);
        }
    }

    // Клик по вкладкам типа
    document.querySelectorAll('.bg-type-tab').forEach((tab) => {
        tab.addEventListener('click', () => switchBackgroundType(tab.dataset.bgType));
    });

    /**
     * Ставит конструктор градиента в заданный пресет [from, to, angle]
     * и обновляет превью.
     */
    function applyGradientPreset([from, to, angle]) {
        gradientFromInput.value = from;
        gradientToInput.value = to;
        gradientAngleInput.value = angle;
        updateGradientPreview();
    }

    function updateGradientPreview() {
        gradientPreview.style.background =
            `linear-gradient(${gradientAngleInput.value}deg, ${gradientFromInput.value}, ${gradientToInput.value})`;
    }

    function updateColorValueLabel() {
        document.getElementById('background-color-value').textContent = backgroundColorInput.value;
    }

    /**
     * Превью file-фона при редактировании. Диалог выбора файла нельзя
     * заполнить программно, поэтому вместо него показываем миниатюру
     * уже прикреплённой картинки (data:URL из storage.local) и её fileId.
     * Пока превью показано, сохранение не требует повторного выбора.
     */
    function showFilePreview(bg) {
        const box = document.getElementById('background-file-preview');
        if (!bg || bg.type !== 'file' || !bg.fileId) {
            box.classList.add('hidden');
            return;
        }
        chrome.storage.local.get(fileKey(bg.fileId), (result) => {
            const err = chrome.runtime?.lastError;
            const dataUrl = err ? '' : (result || {})[fileKey(bg.fileId)];
            if (!dataUrl) {
                box.classList.add('hidden');
                return;
            }
            setImageSource(document.getElementById('background-file-thumb'), dataUrl, '');
            document.getElementById('background-file-name').textContent = t('fileBackground');
            box.classList.remove('hidden');
        });
    }

    // Выбор файла в диалоге: сразу показываем его миниатюру в форме
    // (и при создании, и при замене при редактировании)
    backgroundFileInput.addEventListener('change', () => {
        const file = backgroundFileInput.files?.[0];
        const box = document.getElementById('background-file-preview');
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = typeof reader.result === 'string' ? reader.result : '';
            if (!dataUrl) return;
            // Кешируем: сохранение возьмёт готовый data:URL из превью
            box.dataset.pendingDataUrl = dataUrl;
            setImageSource(document.getElementById('background-file-thumb'), dataUrl, '');
            document.getElementById('background-file-name').textContent = file.name;
            box.classList.remove('hidden');
        };
        reader.onerror = () => box.classList.add('hidden');
        reader.readAsDataURL(file);
    });

    // Конструктор градиента: любое изменение сразу видно в превью
    [gradientFromInput, gradientToInput, gradientAngleInput].forEach((input) => {
        input.addEventListener('input', updateGradientPreview);
    });
    backgroundColorInput.addEventListener('input', updateColorValueLabel);

    // Пресеты: клик заполняет конструктор
    GRADIENT_PRESETS.forEach(([from, to, angle]) => {
        const preset = document.createElement('button');
        preset.type = 'button';
        preset.className = 'gradient-preset';
        preset.title = `${from} → ${to}`;
        preset.style.background = `linear-gradient(${angle}deg, ${from}, ${to})`;
        preset.addEventListener('click', () => {
            gradientFromInput.value = from;
            gradientToInput.value = to;
            gradientAngleInput.value = angle;
            updateGradientPreview();
        });
        gradientPresets.appendChild(preset);
    });

    /**
     * Читает выбранный файл с устройства и кладёт data:URL в
     * storage.local под сгенерированным fileId. sync квоты не тратит:
     * картинки локальны по своей природе (решение 1a).
     */
    function readBackgroundFile() {
        const file = backgroundFileInput.files?.[0];
        if (!file) return Promise.resolve('');
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = typeof reader.result === 'string' ? reader.result : '';
                if (dataUrl) {
                    chrome.storage.local.set({ [fileKey(makeFileId())]: dataUrl });
                }
                resolve(dataUrl);
            };
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
        });
    }

    // Кнопки "＋ Добавить" и "Отмена" — показ/скрытие формы
    addForms.background.showButton.addEventListener('click', () => showAddForm('background'));
    document.getElementById('cancel-background').addEventListener('click', () => hideAddForm('background'));

    saveBackgroundButton.addEventListener('click', () => {
        const title = backgroundTitleInput.value.trim();
        if (!title) { alert(t('errTitle')); return; }

        // Тип берём из активной вкладки переключателя
        const activeTab = document.querySelector('.bg-type-tab.active');
        const type = activeTab ? activeTab.dataset.bgType : 'url';

        if (type === 'color') {
            const backgroundData = { type, title, value: backgroundColorInput.value };
            commitBackground(backgroundData);
            return;
        }

        if (type === 'gradient') {
            const backgroundData = {
                type,
                title,
                from: gradientFromInput.value,
                to: gradientToInput.value,
                angle: Number(gradientAngleInput.value),
            };
            commitBackground(backgroundData);
            return;
        }

        if (type === 'file') {
            const position = backgroundPositionInput.value;
            const file = backgroundFileInput.files?.[0];
            // Запись data:URL в storage.local с проверкой квоты: без неё
            // ошибка терялась в консоль (Unchecked runtime.lastError),
            // а фон молча не сохранялся
            const saveFileData = (dataUrl) => {
                const fileId = makeFileId();
                chrome.storage.local.set({ [fileKey(fileId)]: dataUrl }, () => {
                    const err = chrome.runtime?.lastError;
                    if (err) { alert(t('errFileTooBig')); return; }
                    commitBackground({ type, title, fileId, position });
                });
            };
            // Файл не выбран: берём data:URL из превью (пользователь выбрал
            // файл, но input был сброшен) либо прежнюю картинку при
            // редактировании; при создании без файла — отказ
            if (!file) {
                const pendingDataUrl = document.getElementById('background-file-preview')
                    .dataset.pendingDataUrl;
                if (pendingDataUrl) {
                    saveFileData(pendingDataUrl);
                    return;
                }
                const editing = editingBackgroundIndex !== null
                    ? currentState.backgrounds[editingBackgroundIndex]
                    : null;
                if (editingBackgroundIndex !== null && editing
                    && editing.type === 'file' && editing.fileId) {
                    commitBackground({ type, title, fileId: editing.fileId, position });
                } else {
                    alert(t('errNoFile'));
                }
                return;
            }
            // Читаем файл асинхронно, затем сохраняем
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = typeof reader.result === 'string' ? reader.result : '';
                if (!dataUrl) { alert(t('errNoFile')); return; }
                saveFileData(dataUrl);
            };
            reader.onerror = () => alert(t('importError', { error: 'FileReader' }));
            reader.readAsDataURL(file);
            return;
        }

        // url — картинка по ссылке (пустой url допустим: "По умолчанию")
        commitBackground({ type: 'url', title, url: backgroundUrlInput.value.trim(), position: backgroundPositionInput.value });
    });

    /**
     * Записывает фон в список (учитывая режим редактирования) и закрывает
     * форму. Проверка normalizeBackground отсеет битые значения.
     */
    function commitBackground(backgroundData) {
        const normalized = normalizeBackground(backgroundData);
        if (!normalized) { alert(t('errTitle')); return; }
        let addedIndex = null;
        if (editingBackgroundIndex !== null) {
            // При редактировании сохраняем fileId старой записи, если новый
            // файл не выбирали (normalized fileId сгенерирован заново)
            currentState.backgrounds[editingBackgroundIndex] = normalized;
        } else {
            currentState.backgrounds.push(normalized);
            // Новый фон сразу становится текущим: пользователь только что
            // его настроил и ожидает увидеть на экране, а не прежний фон
            editingBackgroundIndex = currentState.backgrounds.length - 1;
            currentState.currentBackgroundIndex = editingBackgroundIndex;
        }
        saveState({
            backgrounds: currentState.backgrounds,
            currentBackgroundIndex: currentState.currentBackgroundIndex,
        });
        editingBackgroundIndex = null;
        refreshUI();
        hideAddForm('background');
    }

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

    // Кнопка "Добавить" (шаг 1): проверяет URL с %s, предлагает название
    // и логотип, раскрывает остальные поля
    addSearchEngineButton.addEventListener('click', () => {
        const rawUrl = newSearchEngineUrl.value.trim();
        // %s в URL обязателен — иначе некуда подставлять запрос
        if (!rawUrl || !rawUrl.includes('%s')) { alert(t('errEngineUrl')); return; }
        const normalizedUrl = normalizeUrl(rawUrl);
        if (!normalizedUrl || !normalizedUrl.includes('%s')) { alert(t('errEngineUrl')); return; }

        newSearchEngineName.value = suggestNameFromUrl(normalizedUrl);
        newSearchEngineLogo.value = `https://${new URL(normalizedUrl.replace('%s', '')).hostname}/favicon.ico`;
        expandDetails(searchEngineDetails);
        toggleSearchEngineStep({ editing: true });
        newSearchEngineName.focus();
        newSearchEngineName.select();
    });

    // Enter в поле URL — тот же переход на шаг 2
    newSearchEngineUrl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addSearchEngineButton.click(); }
    });

    // Кнопка ⟳ у поля "URL логотипа": пересчитать логотип из текущего
    // адреса с %s (шаблон поисковика)
    refreshSearchEngineIconButton.addEventListener('click', () => {
        const normalizedUrl = normalizeUrl(newSearchEngineUrl.value.trim());
        if (!normalizedUrl || !normalizedUrl.includes('%s')) { alert(t('errEngineUrl')); return; }
        newSearchEngineLogo.value = `https://${new URL(normalizedUrl.replace('%s', '')).hostname}/favicon.ico`;
    });

    saveSearchEngineButton.addEventListener('click', () => {
        const name = newSearchEngineName.value.trim();
        const url = newSearchEngineUrl.value.trim();
        const logo = newSearchEngineLogo.value.trim();

        // %s в URL обязателен — иначе некуда подставлять запрос
        if (!name || !url || !url.includes('%s')) { alert(t('errNameAndUrl')); return; }

        const engineData = { name: clampSearchName(name), url, logo };
        if (editingSearchEngineIndex !== null) {
            currentState.searchEngines[editingSearchEngineIndex] = engineData;
        } else {
            currentState.searchEngines.push(engineData);
        }

        saveState({ searchEngines: currentState.searchEngines });
        refreshUI();
        hideAddForm('searchEngine');
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
        // "моргал" бы наклон.
        // При сенсорном переносе её не трогаем вовсе: она вынута из
        // потока (position: fixed) и едет за пальцем — FLIP-сдвиги
        // вернули бы её в сетку, и плитка «скакала» бы
        bookmarksContainer.querySelectorAll('.bookmark').forEach((el) => {
            if (touchDrag?.active && el === touchDrag.el) return;
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
     *
     * skipEl — перетаскиваемая плитка сенсорного переноса: она вынута из
     * потока и едет за пальцем; без исключения она создаёт фантомный
     * ряд под курсором, и список прыгает.
     */
    function getDropIndex(mouseX, mouseY, skipEl) {
        const tiles = [...bookmarksContainer.querySelectorAll('.bookmark')]
            .filter((tile) => tile !== skipEl);
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
    // Сенсорный перенос — гибрид с мышью.
    //
    // HTML5 drag-n-drop на тачскринах не работает: добавляем те же шаги
    // через touch-события. Логика общая: long-press (350 мс) запускает
    // перенос, дальше работает тот же getDropIndex + reorderBookmarksAnimated,
    // а отпускание пальца сохраняет порядок как drop у мыши. Короткий тап
    // по-прежнему открывает закладку, свайп — скроллит страницу.
    // =============================================================================

    const TOUCH_DRAG_DELAY = 350; // long-press до старта переноса
    const TOUCH_DRAG_SLOP = 10;   // движение пальца раньше — это скролл

    let touchDrag = null;      // { el, index, grabX, grabY, startX, startY, active }
    let touchTimer = null;
    let touchOrderChanged = false;

    // Инлайновые стили сенсорного переноса: endTouchDrag обязан снять их
    // все, иначе остатки (position: fixed, transition: none) ломают и
    // вёрстку, и последующие переносы мышью
    const TOUCH_DRAG_STYLES = ['position', 'left', 'top', 'width', 'height', 'zIndex', 'transform', 'transition'];

    /**
     * Поднимает плитку над сеткой: выходит из потока (position: fixed,
     * left/top в координатах вьюпорта — родитель с backdrop-filter не
     * создаёт для неё containing block) и едет за точкой пальца.
     * Соседи замеряются ДО выхода из потока и плавно закрывают зазор.
     */
    function liftTouchTile(el) {
        const rect = el.getBoundingClientRect();

        // FLIP First: позиции соседей ДО выхода плитки из потока
        const before = new Map();
        bookmarksContainer.querySelectorAll('.bookmark').forEach((other) => {
            if (other !== el) before.set(other, other.getBoundingClientRect());
        });

        el.style.width = rect.width + 'px';
        el.style.height = rect.height + 'px';
        el.style.position = 'fixed';
        el.style.left = rect.left + 'px';
        el.style.top = rect.top + 'px';
        el.style.zIndex = '2';
        el.classList.add('dragging');
        touchDrag.grabX = touchDrag.startX - rect.left;
        touchDrag.grabY = touchDrag.startY - rect.top;

        // FLIP Play: соседи плавно закрывают освободившийся зазор
        before.forEach((oldRect, other) => {
            const now = other.getBoundingClientRect();
            const ddx = oldRect.left - now.left;
            const ddy = oldRect.top - now.top;
            if (!ddx && !ddy) return;
            other.style.transition = 'none';
            other.style.transform = `translate(${ddx}px, ${ddy}px)`;
            other.getBoundingClientRect();
            other.style.transition = '';
            other.style.transform = '';
        });
    }

    /**
     * Завершает сенсорный перенос: возвращает плитку в поток плавной
     * доездкой на её место в сетке, сохраняет порядок (если он менялся)
     * и сбрасывает состояние.
     * save=true — порядок сохранить, false — только откатить визуал.
     */
    function endTouchDrag(save) {
        clearTimeout(touchTimer);
        if (touchDrag?.active) {
            const el = touchDrag.el;
            // Позиция до возврата в поток — для плавной доездки на место
            const from = el.getBoundingClientRect();
            TOUCH_DRAG_STYLES.forEach((prop) => { el.style[prop] = ''; });
            el.classList.remove('dragging');
            const to = el.getBoundingClientRect();
            const dx = from.left - to.left;
            const dy = from.top - to.top;
            if (dx || dy) {
                el.style.transition = 'none';
                el.style.transform = `translate(${dx}px, ${dy}px)`;
                el.getBoundingClientRect();
                el.style.transition = '';
                el.style.transform = '';
            }
            if (save && touchOrderChanged) {
                saveState({ bookmarks: currentState.bookmarks });
            }
            draggedIndex = null;
        }
        touchDrag = null;
    }

    bookmarksContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const el = e.target.closest('.bookmark');
        if (!el) return;
        const touch = e.touches[0];
        touchOrderChanged = false;
        touchDrag = {
            el,
            index: Number(el.dataset.index),
            startX: touch.clientX,
            startY: touch.clientY,
            grabX: 0,
            grabY: 0,
            active: false,
        };
        // Нативный drag не должен перехватывать касание: иначе long-press
        // на тачскрине включал бы браузерный drag, плитка зависала бы в
        // режиме переноса и не двигалась за пальцем
        el.draggable = false;
        // Long-press запускает перенос; до него тап и скролл работают как
        // обычно. Если мышиный перенос уже идёт — сенсорный не начинаем,
        // чтобы таймер ладони не перебил draggedIndex активного переноса
        touchTimer = setTimeout(() => {
            if (!touchDrag || draggedIndex !== null) return;
            touchDrag.active = true;
            draggedIndex = touchDrag.index;
            liftTouchTile(el);
        }, TOUCH_DRAG_DELAY);
    }, { passive: true });

    bookmarksContainer.addEventListener('touchmove', (e) => {
        if (!touchDrag) return;
        const touch = e.touches[0];

        if (!touchDrag.active) {
            // Палец сместился раньше long-press — это скролл, перенос отменён
            const dx = touch.clientX - touchDrag.startX;
            const dy = touch.clientY - touchDrag.startY;
            if (dx * dx + dy * dy > TOUCH_DRAG_SLOP * TOUCH_DRAG_SLOP) {
                clearTimeout(touchTimer);
                touchDrag = null;
            }
            return;
        }

        // Активный перенос: страница не скроллится, палец двигает плитку
        e.preventDefault();
        // Плитка следует за пальцем: position: fixed + left/top — без
        // transform, чтобы не конфликтовать с FLIP-анимацией соседей
        touchDrag.el.style.left = (touch.clientX - touchDrag.grabX) + 'px';
        touchDrag.el.style.top = (touch.clientY - touchDrag.grabY) + 'px';

        // Плитка под пальцем исключена из расчёта рядов: иначе её позиция
        // у пальца создавала бы фантомный ряд и список прыгал.
        // Слот без самой плитки — готовый индекс вставки: no-op только
        // на своей текущей позиции, без смещения -1
        const slot = getDropIndex(touch.clientX, touch.clientY, touchDrag.el);
        if (slot !== draggedIndex) {
            reorderBookmarksAnimated(draggedIndex, slot);
            touchOrderChanged = true;
        }
    }, { passive: false });

    bookmarksContainer.addEventListener('touchend', (e) => {
        if (!touchDrag) return;
        const wasActive = touchDrag.active;
        // preventDefault на touchend гасит клик по ссылке — иначе после
        // переноса открывался бы сайт под пальцем
        if (wasActive) e.preventDefault();
        touchDrag.el.draggable = true; // возвращаем нативный drag для мыши
        endTouchDrag(wasActive);
    });

    bookmarksContainer.addEventListener('touchcancel', () => {
        // Порядок к моменту отмены валиден — сохраняем, если менялся
        if (touchDrag) touchDrag.el.draggable = true;
        endTouchDrag(true);
    });

    // Long-press на Android нативно открывает контекстное меню — во время
    // переноса (и его старта) гасим, иначе палец «отваливается» от плитки
    bookmarksContainer.addEventListener('contextmenu', (e) => {
        if (touchDrag && e.target.closest('.bookmark')) e.preventDefault();
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

        // Создание новой закладки: открываем форму закладок в настройках
        addBookmark: () => {
            openSettingsModal('bookmarks');
            hideAddForm('bookmark');      // сброс полей и флага редактирования
            showAddForm('bookmark');
        },
        // Сортировка плиток по алфавиту (регистронезависимо, по названию)
        sortBookmarksAsc: () => {
            currentState.bookmarks.sort((a, b) =>
                (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
            );
            saveState({ bookmarks: currentState.bookmarks });
            refreshUI();
        },
        // Тот же порядок, но наоборот (Я-А): сортируем по возрастанию
        // и разворачиваем результат
        sortBookmarksDesc: () => {
            currentState.bookmarks.sort((a, b) =>
                (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
            ).reverse();
            saveState({ bookmarks: currentState.bookmarks });
            refreshUI();
        },
        // Вставка адреса из буфера: уже проверен при показе меню
        // (isSafeWebUrl в data.clipboardUrl) — сразу добавляем закладку
        pasteAndCreateBookmark: (data) => {
            const url = (data.clipboardText || '').trim();
            if (!isSafeWebUrl(url)) return;
            let hostname;
            try { hostname = new URL(url).hostname; } catch { return; }
            currentState.bookmarks.push({
                title: hostname,
                url,
                icon: `https://${hostname}/favicon.ico`,
            });
            saveState({ bookmarks: currentState.bookmarks });
            refreshUI();
        },

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

        // Зона поиска: сама секция целиком (включая заголовок страницы —
        // он над поиском) плюс плитки закладок отдельно (см. ниже)
        const searchContainer = target.closest('#search-container');
        if (searchContainer) {
            return { type: 'search', data: { hasText: !!searchInput.value.trim() } };
        }
        if (target.closest('#main-container h1')) {
            return { type: 'search', data: { hasText: !!searchInput.value.trim() } };
        }

        // Пустое место секции закладок: клик по любой точке секции,
        // включая заголовок h2 (плитки перехвачены проверкой выше)
        if (target.closest('#bookmarks-section')) {
            return { type: 'bookmarksEmpty', data: {} };
        }

        // Всё остальное (пустое место, заголовки) считаем фоном страницы.
        // hasBackgrounds решает, показывать ли пункт правки, а
        // canSwitchBackground (нужно >= 2 фонов) — пункт смены фона
        const hasBackgrounds = currentState.backgrounds.length > 0;
        return {
            type: 'background',
            data: { hasBackgrounds, canSwitchBackground: currentState.backgrounds.length > 1 },
        };
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

        if (type === 'bookmarksEmpty') {
            // Как и для поиска, состав меню зависит от буфера обмена:
            // если там безопасный веб-адрес, показываем "Вставить и создать"
            navigator.clipboard.readText()
                .catch(() => '')
                .then((text) => {
                    text = (text || '').trim();
                    data.clipboardText = text;
                    data.hasClipboardUrl = isSafeWebUrl(text);
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
