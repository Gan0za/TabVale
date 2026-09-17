// Тест фонового скрипта (background.js) — логики контекстного меню.
// Запуск: node .opencoder/tests/background.test.mjs
//
// background.js использует chrome.* API, которого в Node нет.
// Поэтому мы подставляем фейковые реализации chrome.contextMenus и
// chrome.tabs, выполняем код скрипта и проверяем, что:
//   1. В меню создаётся единственный пункт "Настройки"
//   2. Клик по нему открывает страницу новой вкладки с ?settings=1

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Тест лежит в .opencoder/tests/, корень проекта — на два уровня выше
const projectRoot = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(projectRoot, 'background.js'), 'utf8');

// --- Заглушки chrome API ---
let clickHandler = null;
const createdMenus = [];
const createdTabs = [];

const chromeStub = {
    runtime: {
        onInstalled: { addListener(fn) { installHandler = fn; } },
        getURL: (path) => `chrome-extension://testid/${path}`,
    },
    contextMenus: {
        create: (item) => createdMenus.push(item),
        onClicked: { addListener(fn) { clickHandler = fn; } },
    },
    tabs: {
        create: (tab) => createdTabs.push(tab),
    },
};

let installHandler = null;

// Выполняем background.js в песочнице. URL нужен скрипту для getURL-логики.
vm.runInNewContext(source, { chrome: chromeStub, URL });

// --- Тест 1: меню создаётся при установке и содержит только "Настройки" ---
assert.ok(installHandler, 'background.js должен подписаться на onInstalled');
installHandler(); // имитируем установку расширения

assert.equal(createdMenus.length, 1, 'в меню один пункт');
assert.equal(createdMenus[0].id, 'openSettings', 'id пункта — openSettings');
assert.equal(createdMenus[0].title, 'Настройки');

// --- Тест 2: клик по пункту открывает страницу настроек ---
assert.ok(clickHandler, 'background.js должен подписаться на onClicked');
clickHandler({ menuItemId: 'openSettings' }, {});

assert.equal(createdTabs.length, 1, 'открыта одна вкладка');
assert.ok(
    createdTabs[0].url.includes('newtab/index.html?settings=1'),
    'URL содержит параметр settings=1'
);

// Клик по несуществующему пункту ничего не открывает
clickHandler({ menuItemId: 'unknownItem' }, {});
assert.equal(createdTabs.length, 1, 'неизвестный пункт игнорируется');

console.log('background.test.mjs: все проверки пройдены');
