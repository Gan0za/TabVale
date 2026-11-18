// =============================================================================
// Кэш иконок сайтов в IndexedDB.
//
// Иконка хранится как байты (data:URL), а не как ссылка: иначе при
// отсутствии сети или недоступном сайте плитка теряет картинку.
// Источник байтов — favicon-кэш браузера (chrome _favicon): он работает
// без сети, для http и внутренних порталов с самоподписанным
// сертификатом. Сеть нужна только на первую загрузку.
// =============================================================================

const ICON_DB_NAME = 'tabvale-icons';
const ICON_DB_VERSION = 1;
const ICON_DB_STORE = 'icons';
const ICON_SIZE = 32;
const ICON_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ICON_MAX_BYTES = 64 * 1024;

function openIconDb() {
    return new Promise((resolve) => {
        if (!globalThis.indexedDB) { resolve(null); return; }
        const request = indexedDB.open(ICON_DB_NAME, ICON_DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(ICON_DB_STORE)) {
                db.createObjectStore(ICON_DB_STORE, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

function iconDbAction(mode, action) {
    return new Promise((resolve) => {
        openIconDb().then((db) => {
            if (!db) { resolve(null); return; }
            try {
                const tx = db.transaction(ICON_DB_STORE, mode);
                const request = action(tx.objectStore(ICON_DB_STORE));
                request.onsuccess = () => resolve(request.result ?? null);
                request.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    });
}

/**
 * Ключ кэша — origin страницы. Схема и порт сохраняются: внутренний
 * http-портал и его https-версия — разные сайты с разными иконками.
 */
function iconCacheKey(pageUrl) {
    try {
        const url = new URL(String(pageUrl));
        if (!/^https?:$/.test(url.protocol)) return '';
        return url.origin;
    } catch {
        return '';
    }
}

/** Адрес иконки по умолчанию: схема и порт берутся из адреса закладки. */
function defaultIconUrl(pageUrl) {
    const key = iconCacheKey(pageUrl);
    return key ? `${key}/favicon.ico` : FALLBACK_ICON;
}

/**
 * Адрес favicon-кэша браузера. Отдаёт иконку уже посещённого сайта
 * независимо от доступности сети и валидности сертификата.
 */
function faviconApiUrl(pageUrl, size = ICON_SIZE) {
    if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return '';
    return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(String(pageUrl))}&size=${size}`);
}

function iconBytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

/** Читает иконку из кэша браузера и возвращает её как data:URL. */
async function fetchFaviconDataUrl(pageUrl) {
    const url = faviconApiUrl(pageUrl);
    if (!url) return '';
    try {
        const response = await fetch(url);
        if (!response.ok) return '';
        const buffer = await response.arrayBuffer();
        if (!buffer.byteLength || buffer.byteLength > ICON_MAX_BYTES) return '';
        const type = response.headers.get('content-type') || 'image/png';
        return `data:${type};base64,${iconBytesToBase64(new Uint8Array(buffer))}`;
    } catch {
        return '';
    }
}

async function iconCacheGet(key, deps = {}) {
    if (!key) return null;
    const get = deps.get || ((name) => iconDbAction('readonly', (store) => store.get(name)));
    const record = await get(key);
    return record && record.dataUrl ? record : null;
}

async function iconCachePut(record, deps = {}) {
    const put = deps.put || ((item) => iconDbAction('readwrite', (store) => store.put(item)));
    return put(record);
}

function iconRecordStale(record, now = Date.now()) {
    return !record?.updatedAt || (now - record.updatedAt) > ICON_CACHE_TTL_MS;
}

/**
 * Иконка закладки. Порядок: кэш -> favicon браузера -> своя ссылка ->
 * ссылка по умолчанию -> заглушка. Кэш отдаётся первым, поэтому
 * недоступный сайт или отсутствие сети картинку не отнимают.
 */
async function resolveBookmarkIcon(bookmark, deps = {}) {
    const fallback = deps.fallback || FALLBACK_ICON;
    const fetchFavicon = deps.fetchFavicon || fetchFaviconDataUrl;
    const pageUrl = typeof bookmark?.url === 'string' ? bookmark.url : '';
    const key = iconCacheKey(pageUrl);

    const cached = await iconCacheGet(key, deps);
    if (cached) {
        return { src: cached.dataUrl, key, cached: true, stale: iconRecordStale(cached) };
    }

    if (key) {
        const dataUrl = await fetchFavicon(pageUrl);
        if (dataUrl) {
            await iconCachePut({ key, dataUrl, updatedAt: Date.now() }, deps);
            return { src: dataUrl, key, cached: false, stale: false };
        }
    }

    if (bookmark?.icon) return { src: bookmark.icon, key, cached: false, stale: false };
    if (key) return { src: defaultIconUrl(pageUrl), key, cached: false, stale: false };
    return { src: fallback, key, cached: false, stale: false };
}

/**
 * Обновляет кэш иконки. Неудача (оффлайн, сайт недоступен) не трогает
 * сохранённую иконку — она остаётся.
 */
async function refreshIconCache(pageUrl, deps = {}) {
    const fetchFavicon = deps.fetchFavicon || fetchFaviconDataUrl;
    const key = iconCacheKey(pageUrl);
    if (!key) return false;
    const dataUrl = await fetchFavicon(pageUrl);
    if (!dataUrl) return false;
    await iconCachePut({ key, dataUrl, updatedAt: Date.now() }, deps);
    return true;
}

/** Иконка только из кэша — для списков, где сеть не нужна. */
async function cachedIconOnly(pageUrl, deps = {}) {
    const record = await iconCacheGet(iconCacheKey(pageUrl), deps);
    return record ? record.dataUrl : '';
}

/**
 * Кэш с догревом: если иконки ещё нет, берём её из favicon браузера.
 * Нужен для поисковиков — их логотипы приходят ссылками и без кэша
 * пропадают в оффлайне.
 */
async function ensureCachedIcon(pageUrl, deps = {}) {
    const key = iconCacheKey(pageUrl);
    if (!key) return '';
    const cached = await iconCacheGet(key, deps);
    if (cached) return cached.dataUrl;
    const fetched = await refreshIconCache(pageUrl, deps);
    if (!fetched) return '';
    return (await iconCacheGet(key, deps))?.dataUrl || '';
}
