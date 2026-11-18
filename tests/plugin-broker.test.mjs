// Брокер плагинов: права на методы, namespaced-хранилище, квоты, fetch.
// Запуск: node tests/plugin-broker.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const source = [
    'newtab/core/storage.js',
    'newtab/core/plugins.js',
    'newtab/core/plugin-broker.js',
].map(read).join('\n');

const api = vm.runInNewContext(
    source + `\n;({
        pluginMethodAllowed, pluginStorageKey, isPluginStorageKey,
        checkPluginStorageWrite, sanitizePluginFetchOptions,
        comparePluginVersions, isPluginCompatible
    })`,
    { URL, console }
);

const noNetwork = { permissions: { network: [], capabilities: [], storageKB: 16 } };
const withNetwork = { permissions: { network: ['https://api.example.com/*'], capabilities: [], storageKB: 16 } };
const withBookmarks = { permissions: { network: [], capabilities: ['bookmarks.read'], storageKB: 64 } };

// 1. Методы: базовые разрешены всем, сеть — по allowlist, закладки — по capability
for (const method of ['storage.get', 'storage.set', 'storage.remove', 'ui.ready', 'ui.close', 'ui.resize', 'ui.notify', 'config.get']) {
    assert.equal(api.pluginMethodAllowed(noNetwork, method), true, `${method} разрешён без прав`);
}
assert.equal(api.pluginMethodAllowed(noNetwork, 'fetch'), false, 'fetch без сети запрещён');
assert.equal(api.pluginMethodAllowed(withNetwork, 'fetch'), true, 'fetch с allowlist разрешён');
assert.equal(api.pluginMethodAllowed(noNetwork, 'bookmarks.tree'), false, 'закладки без capability запрещены');
assert.equal(api.pluginMethodAllowed(withBookmarks, 'bookmarks.tree'), true, 'закладки с capability разрешены');
assert.equal(api.pluginMethodAllowed(withBookmarks, 'bookmarks.import'), true);
assert.equal(api.pluginMethodAllowed(noNetwork, 'eval'), false, 'неизвестный метод запрещён');
assert.equal(api.pluginMethodAllowed(noNetwork, 'ui.openExternal'), true, 'открытие внешней ссылки разрешено');
assert.equal(api.pluginMethodAllowed(noNetwork, 'ui.openManager'), true, 'переход в менеджер разрешён');
assert.equal(api.pluginMethodAllowed(noNetwork, 'icon.favicon'), true, 'иконка сайта доступна всем');

// 2. Ключи хранилища namespaced и валидируются
assert.equal(api.pluginStorageKey('com.example.clock', 'draft'), 'plugin:com.example.clock:draft');
assert.equal(api.isPluginStorageKey('draft'), true);
assert.equal(api.isPluginStorageKey(''), false);
assert.equal(api.isPluginStorageKey('a b'), false);
assert.equal(api.isPluginStorageKey('x'.repeat(65)), false);

// 3. Квота записи из манифеста
const tiny = { permissions: { network: [], capabilities: [], storageKB: 1 } };
assert.equal(api.checkPluginStorageWrite(noNetwork, 'draft', 'ok').ok, true);
const tooBig = api.checkPluginStorageWrite(tiny, 'draft', 'x'.repeat(2048));
assert.equal(tooBig.ok, false, 'значение больше storageKB отклонено');
assert.equal(api.checkPluginStorageWrite(noNetwork, 'bad key', 'x').ok, false, 'битый ключ отклонён');

// 4. fetch: только GET/HEAD, без Authorization и cookie
assert.equal(api.sanitizePluginFetchOptions({ method: 'POST' }).ok, false);
const sanitized = api.sanitizePluginFetchOptions({
    method: 'GET',
    headers: { Authorization: 'secret', Accept: 'application/json', Cookie: 'x' },
});
assert.equal(sanitized.ok, true);
assert.deepEqual(Object.keys(sanitized.options.headers), ['Accept']);
assert.equal(sanitized.options.credentials, 'omit');
assert.equal(sanitized.options.redirect, 'error');

// 5. Совместимость версий
assert.equal(api.comparePluginVersions('1.2.0', '1.2.1'), -1);
assert.equal(api.comparePluginVersions('1.2.0', '1.2.0'), 0);
assert.equal(api.comparePluginVersions('2.0.0', '1.9.9'), 1);
assert.equal(api.isPluginCompatible({ minAppVersion: '1.2.0' }, '1.2.0'), true);
assert.equal(api.isPluginCompatible({ minAppVersion: '1.3.0' }, '1.2.0'), false);
assert.equal(api.isPluginCompatible({}, '1.2.0'), true);

console.log('plugin-broker.test.mjs: все проверки пройдены');
