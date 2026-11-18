// =============================================================================
// IndexedDB для установленных плагинов.
//
// Код и манифесты не помещаются в chrome.storage: квоты и сериализация там
// для данных, а не для пакетов. IndexedDB живёт в origin расширения и
// очищается вместе с ним.
// =============================================================================

const PLUGIN_DB_NAME = 'tabvale-plugins';
const PLUGIN_DB_VERSION = 1;
const PLUGIN_DB_STORE = 'plugins';

function openPluginDb() {
    return new Promise((resolve) => {
        if (!globalThis.indexedDB) { resolve(null); return; }
        const request = indexedDB.open(PLUGIN_DB_NAME, PLUGIN_DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(PLUGIN_DB_STORE)) {
                db.createObjectStore(PLUGIN_DB_STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

function pluginDbAction(mode, action) {
    return new Promise((resolve) => {
        openPluginDb().then((db) => {
            if (!db) { resolve(null); return; }
            try {
                const tx = db.transaction(PLUGIN_DB_STORE, mode);
                const request = action(tx.objectStore(PLUGIN_DB_STORE));
                request.onsuccess = () => resolve(request.result ?? null);
                request.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    });
}

function dbGetAllPlugins() {
    return pluginDbAction('readonly', (store) => store.getAll());
}

function dbGetPlugin(id) {
    return pluginDbAction('readonly', (store) => store.get(id));
}

function dbPutPlugin(record) {
    return pluginDbAction('readwrite', (store) => store.put(record));
}

function dbDeletePlugin(id) {
    return pluginDbAction('readwrite', (store) => store.delete(id));
}
