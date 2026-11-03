// Smoke-тест инициализации страницы (newtab/app.js).
// Запуск: node tests/init.test.mjs
//
// Прогоняет весь обработчик DOMContentLoaded на универсальных заглушках
// DOM. Ловит ReferenceError вроде "resetBackgroundForm is not defined":
// такие ошибки не видят тесты, читающие только текст файла, но страница
// с ними не запускается вовсе. После инициализации дёргает кнопки
// показа/отмены всех форм — они вызывают reset-функции через addForms.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
import { SOURCE as source } from './_source.mjs';

// --- Универсальная заглушка элемента: любые свойства и методы ---
function makeElement(id = '') {
    const listeners = {};
    return {
        id,
        style: {},
        dataset: {},
        title: '',
        textContent: '',
        value: '',
        src: '',
        href: '',
        disabled: false,
        classList: {
            _set: new Set(),
            add(c) { this._set.add(c); },
            remove(c) { this._set.delete(c); },
            toggle(c) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); },
            contains(c) { return this._set.has(c); },
        },
        addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        removeEventListener() {},
        // Клик: запускает зарегистрированные обработчики
        click() { (listeners.click || []).forEach((fn) => fn()); },
        appendChild() {},
        append() {},
        remove() {},
        setAttribute() {},
        querySelector: () => null,
        querySelectorAll: () => [],
        focus() {},
        select() {},
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
        contains: () => false,
        _listeners: listeners,
    };
}

// Единый кэш: getElementById('x') всегда возвращает один и тот же узел
const elements = new Map();
const byId = (id) => {
    if (!elements[id]) elements[id] = makeElement(id);
    return elements[id];
};

let domReady = null;
const documentStub = {
    createElement: (tag) => makeElement(tag),
    getElementById: (id) => byId(id),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: makeElement('body'),
    documentElement: makeElement('html'),
    title: '',
};

const chromeStub = {
    runtime: {
        getURL: (p) => 'chrome-extension://test/' + p,
        lastError: undefined,
    },
    storage: { sync: { get(k, cb) { cb({}); }, set() {} }, onChanged: { addListener() {} } },
};

const sandbox = {
    chrome: chromeStub,
    document: documentStub,
    window: {
        addEventListener(type, cb) { if (type === 'DOMContentLoaded') domReady = cb; },
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        location: { search: '' },
        open() {},
    },
    navigator: { language: 'ru-RU' },
    fetch: async () => ({ json: async () => ({}), ok: true, text: async () => '<title>t</title>' }),
    URL, URLSearchParams,
    Image: class {},
    setTimeout, clearTimeout,
    DOMParser: class {
        parseFromString() { return { title: '' }; }
    },
    alert() {},
};

vm.runInNewContext(source, sandbox);

assert.equal(typeof domReady, 'function', 'app.js регистрирует обработчик DOMContentLoaded');

// Полная инициализация: любая забытая функция (например, resetBackgroundForm)
// уронит этот вызов с ReferenceError ещё до взаимодействия с UI
domReady();

// Кнопки показа/отмены всех трёх форм: hideAddForm вызывает reset() —
// именно здесь пользователь ловил ReferenceError
byId('show-bookmark-form').click();
byId('cancel-bookmark').click();
byId('show-background-form').click();
byId('cancel-background').click();
byId('show-search-engine-form').click();
byId('cancel-search-engine').click();

// --- Шаг 1 -> шаг 2 формы закладки: НЕ должно открывать вкладок ---
// Регрессия: раньше заголовок считывался через скрытую вкладку
// (chrome.tabs.create) — вкладка мелькала в панели при каждом "Добавить"
let tabsCreated = 0;
let permissionsRequested = false;
chromeStub.tabs = {
    create(opts, cb) { tabsCreated++; cb({ id: 1 }); },
    remove() {},
};
chromeStub.permissions = {
    request(opts, cb) { permissionsRequested = true; cb(true); },
};
chromeStub.scripting = { executeScript() {} };

byId('show-bookmark-form').click();
byId('bookmark-url-input').value = 'https://github.com';
byId('add-bookmark').click();
// Дождаться асинхронного fetchPageTitle (fetch + DOMParser)
await new Promise((r) => setTimeout(r, 10));

assert.equal(tabsCreated, 0, 'шаг 2 формы не открывает вкладок');
assert.ok(permissionsRequested, 'запрашивается разрешение на чтение заголовка');

console.log('init.test.mjs: все проверки пройдены');
