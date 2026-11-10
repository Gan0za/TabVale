// =============================================================================
// Ядро: правила брокера плагинов.
//
// Sandbox — не граница доверия: код плагина и RPC-клиент живут в одной
// странице, поэтому плагин может отправить родителю любой method. Хост
// обязан проверять метод по манифесту и правам конкретного инстанса.
// Здесь собраны чистые правила этой проверки; сам брокер вызывает их
// перед каждым действием.
// =============================================================================

const PLUGIN_STORAGE_PREFIX = 'plugin:';
const PLUGIN_STORAGE_KEY_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const PLUGIN_FETCH_HEADERS = ['accept', 'accept-language', 'content-type'];

/** Ключ chrome.storage.local для данных плагина. */
function pluginStorageKey(pluginId, key) {
    return `${PLUGIN_STORAGE_PREFIX}${pluginId}:${key}`;
}

function isPluginStorageKey(key) {
    return typeof key === 'string' && PLUGIN_STORAGE_KEY_PATTERN.test(key);
}

/**
 * Разрешён ли RPC-метод для манифеста. ui.* и storage.* доступны всем,
 * сеть — только при непустом allowlist, закладки — только с capability.
 */
function pluginMethodAllowed(manifest, method) {
    const capabilities = manifest?.permissions?.capabilities || [];
    switch (method) {
        case 'storage.get':
        case 'storage.set':
        case 'storage.remove':
        case 'config.get':
        case 'ui.ready':
        case 'ui.close':
        case 'ui.resize':
        case 'ui.notify':
            return true;
        case 'fetch':
            return Array.isArray(manifest?.permissions?.network)
                && manifest.permissions.network.length > 0;
        case 'bookmarks.tree':
        case 'bookmarks.import':
            return capabilities.includes('bookmarks.read');
        default:
            return false;
    }
}

/**
 * Проверяет запись в хранилище плагина: ключ и размер значения.
 * Лимит — permissions.storageKB манифеста (по умолчанию 64 КБ).
 */
function checkPluginStorageWrite(manifest, key, value) {
    if (!isPluginStorageKey(key)) return { ok: false, error: 'invalid storage key' };
    const limitBytes = (manifest?.permissions?.storageKB || 64) * 1024;
    let serialized;
    try { serialized = JSON.stringify(value); } catch { return { ok: false, error: 'value is not serializable' }; }
    if (utf8ByteLength(serialized) > limitBytes) {
        return { ok: false, error: 'storage quota exceeded' };
    }
    return { ok: true, error: '' };
}

/**
 * Оставляет только безопасные заголовки и методы GET/HEAD. Плагин не
 * может подставить Authorization или cookie — сеть идёт без учётных данных.
 */
function sanitizePluginFetchOptions(options) {
    const raw = options && typeof options === 'object' ? options : {};
    const method = String(raw.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
        return { ok: false, error: 'only GET and HEAD are allowed' };
    }
    const headers = {};
    if (raw.headers && typeof raw.headers === 'object') {
        for (const [name, value] of Object.entries(raw.headers)) {
            if (PLUGIN_FETCH_HEADERS.includes(name.toLowerCase())) {
                headers[name] = String(value).slice(0, 200);
            }
        }
    }
    return { ok: true, options: { method, headers, credentials: 'omit', redirect: 'error' } };
}

/** Сравнение semver без зависимостей: -1 / 0 / 1. */
function comparePluginVersions(left, right) {
    const parse = (value) => String(value || '0.0.0').split('.').map((part) => Number(part) || 0);
    const a = parse(left);
    const b = parse(right);
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    }
    return 0;
}

function isPluginCompatible(manifest, appVersion) {
    return !manifest?.minAppVersion || comparePluginVersions(manifest.minAppVersion, appVersion) <= 0;
}
