// Хост плагинов: подключение файлов, док/панель и граница безопасности.
// Запуск: node tests/plugin-host.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const html = read('newtab/index.html');
const source = read('newtab/features/plugins.js');
const db = read('newtab/core/plugin-db.js');
const css = read('newtab/styles.css');
const app = read('newtab/app.js');

// 1. Файлы подключены в правильном порядке
const dbIndex = html.indexOf('core/plugin-db.js');
const hostIndex = html.indexOf('features/plugins.js');
const appIndex = html.indexOf('src="app.js"');
assert.ok(dbIndex > 0 && hostIndex > dbIndex && appIndex > hostIndex, 'порядок скриптов корректен');
assert.ok(app.includes('initPlugins()'), 'бутстрап вызывает initPlugins');

// 2. Док и панель описаны в разметке/стилях
assert.ok(css.includes('.plugin-dock'), 'есть стили дока');
assert.ok(css.includes('.plugin-panel'), 'есть стили панели');
assert.ok(css.includes('.plugin-panel-frame'), 'панель содержит iframe');

// 3. Хост использует только правила брокера, не доверяет sandbox
assert.ok(source.includes('event.source !== state.frame.contentWindow'), 'проверяется source-окно');
assert.ok(source.includes('pluginMethodAllowed'), 'метод проверяется по манифесту');
assert.ok(source.includes('checkPluginStorageWrite'), 'запись проверяется по квоте');
assert.ok(source.includes('pluginStorageKey'), 'ключи хранилища namespaced');
assert.ok(source.includes('pluginAllowsUrl'), 'сеть проверяется по allowlist');
assert.ok(source.includes("sandbox/plugin-host.html"), 'панель грузит sandbox-страницу');

// 4. IndexedDB используется для пакетов, а не chrome.storage
assert.ok(db.includes('indexedDB.open'), 'пакеты лежат в IndexedDB');
assert.ok(db.includes('PLUGIN_DB_STORE'), 'есть object store плагинов');

console.log('plugin-host.test.mjs: все проверки пройдены');
