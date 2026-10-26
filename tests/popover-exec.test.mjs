// Исполняющий тест переключателей поповеров и wiring-инициализации.
// Запуск: node .opencoder/tests/popover-exec.test.mjs
//
// Регрессии сплита app.js (2026-10-26), которые пропустили текстовые
// проверки popovers.test.mjs (они читают исходник, но не исполняют его):
//   B1: closeAllPopovers ссылалась на themeGeneralList — после выноса
//       ссылок в core/state.js и селектора в initTheme() имя стало
//       недоступным на топ-уровне (ReferenceError на каждый клик
//       переключателя: FAB тема/язык, селекторы «Общих», поисковик).
//   B2: initSearch() вызывался дважды (бутстрап app.js + конец
//       initBookmarks) — слушатели дублировались, двойной toggle
//       закрывал дропдаун поисковиков сразу после открытия.
//
// Проверяем исполнением в vm-песочнице:
//   1. closeAllPopovers не падает и закрывает оба механизма видимости
//   2. Клик по каждому переключателю открывает своё меню (single toggle)
//   3. Слушатели секции поиска зарегистрированы ровно один раз

import assert from 'node:assert/strict';
import vm from 'node:vm';
import { SOURCE } from './_source.mjs';

// --- Заглушки DOM: элементы с подсчётом слушателей и классами ---
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
        classList: {
            _set: new Set(),
            add(c) { this._set.add(c); },
            remove(c) { this._set.delete(c); },
            toggle(c) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); },
            contains(c) { return this._set.has(c); },
        },
        addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        removeEventListener() {},
        // Клик передаёт минимальное событие: обработчики зовут stopPropagation
        click(ev = { stopPropagation() {} }) { (listeners.click || []).forEach((fn) => fn(ev)); },
        appendChild() {},
        append() {},
        setAttribute() {},
        querySelector: () => null,
        querySelectorAll: () => [],
        focus() {},
        select() {},
        contains: () => false,
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
        _listeners: listeners,
    };
}

const elements = new Map();
const byId = (id) => {
    if (!elements[id]) elements[id] = makeElement(id);
    return elements[id];
};

let domReady = null;
const sandbox = {
    chrome: {
        runtime: { getURL: (p) => 'chrome-extension://test/' + p, lastError: undefined },
        storage: {
            sync: { get(k, cb) { cb({}); }, set() {} },
            local: { get(k, cb) { cb({}); }, set() {}, remove() {} },
        },
        permissions: { request(opts, cb) { cb(false); } },
    },
    document: {
        createElement: (tag) => makeElement(tag),
        getElementById: (id) => byId(id),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        body: makeElement('body'),
        documentElement: makeElement('html'),
        title: '',
    },
    window: {
        addEventListener(type, cb) { if (type === 'DOMContentLoaded') domReady = cb; },
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        location: { search: '' },
        open() {},
    },
    navigator: { language: 'ru-RU', clipboard: { readText: async () => '', writeText: async () => {} } },
    fetch: async () => ({ json: async () => ({}), ok: true, text: async () => '' }),
    URL, URLSearchParams,
    setTimeout, clearTimeout,
    DOMParser: class { parseFromString() { return { title: '' }; } },
    alert() {},
    confirm() { return false; },
    FileReader: class { readAsDataURL() {} },
    Blob: class {},
};

vm.runInNewContext(SOURCE, sandbox);

assert.equal(typeof domReady, 'function', 'app.js регистрирует обработчик DOMContentLoaded');
assert.doesNotThrow(() => domReady(), 'полная инициализация без исключений');

// --- 1. closeAllPopovers исполняется и закрывает оба механизма ---
// B1: до фикса здесь ReferenceError: themeGeneralList is not defined
const searchEngineList = byId('search-engine-list');
const themeMenu = byId('theme-menu');
searchEngineList.classList.add('open');
themeMenu.classList.remove('hidden');
assert.doesNotThrow(
    () => sandbox.closeAllPopovers(null),
    'closeAllPopovers не падает (B1: themeGeneralList доступен на топ-уровне)'
);
assert.ok(!searchEngineList.classList.contains('open'), 'closeAllPopovers закрывает dropdown-меню');
assert.ok(themeMenu.classList.contains('hidden'), 'closeAllPopovers закрывает FAB-меню');

// --- 2. Каждый переключатель открывает своё меню (single toggle) ---
// Клик по FAB темы: меню открыто после первого клика
byId('theme-toggle').click();
assert.ok(!themeMenu.classList.contains('hidden'), 'клик по FAB темы открывает меню');

// B2: двойная регистрация давала бы toggle+toggle — меню оставалось бы закрытым
const dropdown = byId('search-engine-list');
byId('search-engine-button').click();
assert.ok(dropdown.classList.contains('open'), 'клик по селектору поисковиков открывает список (B2: initSearch один раз)');

// Селектор темы в «Общих» тоже открывается (его closeAllPopovers видит)
byId('theme-general-button').click();
assert.ok(byId('theme-general-list').classList.contains('open'), 'селектор темы в «Общих» открывается');

// Селектор языка в «Общих»
byId('language-button').click();
assert.ok(byId('language-list').classList.contains('open'), 'селектор языка в «Общих» открывается');

// --- 3. Слушатели поиска зарегистрированы ровно по одному разу ---
assert.equal(byId('search-engine-button')._listeners.click.length, 1,
    'у кнопки селектора поисковиков один click-обработчик (B2: нет дубля initSearch)');
assert.equal(byId('search-button')._listeners.click.length, 1, 'у кнопки поиска один click-обработчик');
assert.equal(byId('search-input')._listeners.keydown.length, 1, 'у поля поиска один keydown-обработчик');

console.log('popover-exec.test.mjs: все проверки пройдены');
