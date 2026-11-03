// =============================================================================
// Ядро: работа с хранилищем и модель данных.
//
// Всё, что живёт в chrome.storage.sync и всё, что проверяет/нормализует
// данные перед попаданием в хранилище:
//   - валидация импорта (isSafeWebUrl, isValidImportedItem, sanitizeList)
//   - модель фонов (normalizeBackground, buildBackgroundCss, свотчи,
//     placement, пресеты градиентов)
//   - обёртки chrome.storage.sync с проверкой lastError (storageGet,
//     storageSet) и работа с состоянием (saveState, getState)
//   - ключи file-фонов в storage.local (fileKey, makeFileId)
//
// Загружается после core/config.js (использует DEFAULT_* в getState)
// и до render-части. Принцип безопасности: данные пользователя (названия,
// URL) вставляются на страницу только через textContent — настройки можно
// импортировать из чужого JSON-файла, и адрес, который браузер выполнит
// как код, не должен попадать в хранилище.
// =============================================================================

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

// --- Экраны: несколько независимых наборов закладок ---

const DEFAULT_SCREEN_ID = 'main';

function makeScreenId() {
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Название экрана по умолчанию. Первый — «Главная», остальные — «Экран N».
 * t() возвращает ключ, если перевода ещё нет — тогда используем русский
 * литерал, чтобы миграция не показывала пользователю сырой ключ.
 */
function defaultScreenTitle(index) {
    if (index === 0) {
        const label = typeof t === 'function' ? t('defaultScreen') : 'defaultScreen';
        return label !== 'defaultScreen' ? label : 'Главная';
    }
    const label = typeof t === 'function' ? t('screenName', { n: index + 1 }) : 'screenName';
    return label !== 'screenName' ? label : `Экран ${index + 1}`;
}

/**
 * Приводит список экранов к нормализованному виду. Если экранов нет,
 * оборачивает legacy-массив закладок в один экран «Главная» — миграция
 * старого формата без отдельного шага.
 */
function normalizeScreens(rawScreens, legacyBookmarks) {
    const rawList = Array.isArray(rawScreens) && rawScreens.length
        ? rawScreens
        : [{ id: DEFAULT_SCREEN_ID, title: defaultScreenTitle(0), bookmarks: legacyBookmarks || DEFAULT_BOOKMARKS }];

    const usedIds = new Set();
    return rawList.map((raw, index) => {
        const item = raw && typeof raw === 'object' ? raw : {};
        let id = typeof item.id === 'string' && item.id.trim()
            ? item.id.trim()
            : (index === 0 ? DEFAULT_SCREEN_ID : makeScreenId());
        while (usedIds.has(id)) id = makeScreenId();
        usedIds.add(id);

        let title = typeof item.title === 'string' ? item.title.trim() : '';
        if (!title) title = defaultScreenTitle(index);

        const sourceBookmarks = Array.isArray(item.bookmarks)
            ? item.bookmarks
            : (index === 0 ? legacyBookmarks : []);
        const bookmarks = sanitizeList(sourceBookmarks).items;

        return { id, title, bookmarks };
    });
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
        callback?.(error);
    });
}

/** Удаляет ключи из chrome.storage.sync с проверкой lastError. */
function storageRemove(keys, callback) {
    if (!chrome.storage?.sync?.remove) { callback?.(); return; }
    chrome.storage.sync.remove(keys, () => {
        void chrome.runtime?.lastError;
        callback?.();
    });
}

/** Читает chrome.storage.local (файлы фонов, активный экран). */
function storageLocalGet(keys, callback) {
    if (!chrome.storage?.local) { callback?.({}); return; }
    chrome.storage.local.get(keys, (result) => {
        void chrome.runtime?.lastError;
        callback(result || {});
    });
}

/** Пишет chrome.storage.local с проверкой lastError. */
function storageLocalSet(items, callback) {
    if (!chrome.storage?.local) { callback?.(); return; }
    chrome.storage.local.set(items, () => {
        void chrome.runtime?.lastError;
        callback?.();
    });
}

/**
 * Сохраняет переданные поля в chrome.storage.sync.
 * Пример: saveState({ bookmarks: [...] }) — обновить только закладки.
 */
function saveState({ searchEngines, bookmarks, backgrounds, screens, currentBackgroundIndex, currentSearchEngineIndex }) {
    const payload = {};
    if (searchEngines) payload.searchEngines = searchEngines;
    if (screens) {
        payload.screens = screens;
    } else if (bookmarks) {
        // Старые вызовы saveState({ bookmarks }) обновляют активный экран:
        // так не приходится переписывать все точки сохранения сразу.
        const hasScreens = typeof currentState !== 'undefined'
            && Array.isArray(currentState.screens)
            && currentState.screens.length;
        if (hasScreens) {
            const active = currentState.screens.find((s) => s.id === currentState.currentScreenId)
                || currentState.screens[0];
            active.bookmarks = bookmarks;
            payload.screens = currentState.screens;
        } else {
            payload.bookmarks = bookmarks;
        }
    }
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
    storageGet(['screens', 'bookmarks', 'searchEngines', 'backgrounds', 'currentBackgroundIndex', 'currentSearchEngineIndex'], (result) => {
        const screens = normalizeScreens(result.screens, result.bookmarks);
        const active = screens[0];

        // Первый запуск после обновления: сохраняем новый формат и убираем
        // legacy-ключ bookmarks, чтобы не дублировать закладки в квоте.
        if (!Array.isArray(result.screens)) {
            storageSet({ screens }, (error) => {
                if (!error) storageRemove('bookmarks');
            });
        }

        callback({
            screens,
            currentScreenId: active.id,
            bookmarks: active.bookmarks,
            searchEngines: result.searchEngines || DEFAULT_SEARCH_ENGINES,
            backgrounds: result.backgrounds || DEFAULT_BACKGROUNDS,
            currentBackgroundIndex: result.currentBackgroundIndex ?? 0,
            currentSearchEngineIndex: result.currentSearchEngineIndex ?? 0
        });
    });
}
