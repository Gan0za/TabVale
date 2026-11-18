// =============================================================================
// Ядро: реестр встроенных плагинов.
//
// plugins/index.json перечисляет пакеты, которые идут в комплекте. При
// первом запуске хост читает индекс, проверяет манифесты и кладёт записи
// в IndexedDB. Сторонние плагины добавляются тем же путём — из файла.
// =============================================================================

const BUILTIN_PLUGIN_INDEX = 'plugins/index.json';

/**
 * Нормализует запись индекса: { id, version, path }.
 * path — каталог внутри plugins/, без выхода наружу.
 */
function normalizeRegistryEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!isValidPluginId(raw.id)) return null;
    if (typeof raw.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(raw.version)) return null;
    const dir = typeof raw.path === 'string' ? raw.path : '';
    if (!dir || dir.startsWith('/') || dir.includes('..') || !/^[\w./-]+\/$/.test(dir)) return null;
    return { id: raw.id.trim(), version: raw.version, path: dir };
}

/**
 * Проверяет массив индекса и отбрасывает битые/дублирующиеся записи.
 */
function normalizePluginRegistry(rawIndex) {
    if (!Array.isArray(rawIndex)) return [];
    const seen = new Set();
    const entries = [];
    for (const item of rawIndex) {
        const entry = normalizeRegistryEntry(item);
        if (!entry || seen.has(entry.id)) continue;
        seen.add(entry.id);
        entries.push(entry);
    }
    return entries;
}

/**
 * Собирает запись для IndexedDB из манифеста и исходника кода.
 * Код не исполняется здесь — только сохраняется вместе с хешем.
 */
async function buildPluginRecord(entry, manifestResult, code) {
    if (!manifestResult?.ok) return null;
    const manifest = manifestResult.manifest;
    if (manifest.id !== entry.id || manifest.version !== entry.version) return null;
    const hash = await sha256Hex(code);
    return {
        id: manifest.id,
        version: manifest.version,
        manifest,
        code,
        hash,
        source: 'builtin',
        enabled: true,
        installedAt: Date.now(),
    };
}

/** SHA-256 через WebCrypto; в тестах подменяется. */
async function sha256Hex(value) {
    if (!globalThis.crypto?.subtle) return '';
    const data = new TextEncoder().encode(String(value));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
