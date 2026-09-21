// Тест смены языка на лету (newtab/app.js).
// Запуск: node .opencoder/tests/language-switch.test.mjs
//
// Баг: кнопки Select/Edit/Delete в списках настроек перерисовываются
// только при загрузке страницы — applyLocale не могла вызвать refreshUI
// (он объявлен внутри DOMContentLoaded). После исправления applyLocale
// дергает делегат uiRefresher, и подписи кнопок обновляются сразу.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(projectRoot, 'newtab', 'app.js'), 'utf8');
const ruMessages = JSON.parse(fs.readFileSync(path.join(projectRoot, '_locales', 'ru', 'messages.json'), 'utf8'));
const enMessages = JSON.parse(fs.readFileSync(path.join(projectRoot, '_locales', 'en', 'messages.json'), 'utf8'));

const dictionaries = { ru: ruMessages, en: enMessages };

// --- Заглушки DOM (как в init.test.mjs) ---
function makeElement(id = '') {
    const listeners = {};
    return {
        id, style: {}, dataset: {}, title: '', textContent: '', value: '', src: '', href: '',
        placeholder: '',
        className: '',
        disabled: false,
        children: [],
        classList: {
            _set: new Set(),
            add(c) { this._set.add(c); },
            remove(c) { this._set.delete(c); },
            toggle(c) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); },
            contains(c) { return this._set.has(c); },
        },
        addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        removeEventListener() {},
        click(event) {
            // Минимальный объект события: обработчики вызывают stopPropagation
            const e = { stopPropagation() {}, preventDefault() {}, ...event };
            (listeners.click || []).forEach((fn) => fn(e));
        },
        appendChild(c) { this.children.push(c); },
        append(...cs) { this.children.push(...cs); },
        remove() {},
        setAttribute(name, value) { this[name] = value; },
        getAttribute: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        focus() {}, select() {},
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
        contains: () => false,
    };
}
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
    runtime: { getURL: (p) => 'chrome-extension://test/' + p, lastError: undefined },
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
    // fetch отдаёт словарь запрошенного языка — имитируем реальные _locales
    fetch: async (url) => {
        const lang = /_locales\/(\w+)\//.exec(url)?.[1] || 'ru';
        const dict = dictionaries[lang] || dictionaries.ru;
        return { json: async () => JSON.parse(JSON.stringify(dict)) };
    },
    URL, URLSearchParams,
    Image: class {},
    setTimeout, clearTimeout,
    DOMParser: class { parseFromString() { return { title: '' }; } },
    alert() {},
};

vm.runInNewContext(source, sandbox);
domReady();

// --- Счётчик перерисовок списков настроек ---
let managerRerenders = 0;
const bookmarkManagerList = byId('bookmark-manager-list');
const originalAppendChild = bookmarkManagerList.appendChild.bind(bookmarkManagerList);
bookmarkManagerList.appendChild = (c) => { managerRerenders++; originalAppendChild(c); };
// textContent = '' в начале renderManagerList тоже сигнализирует о перерисовке
let clears = 0;
Object.defineProperty(bookmarkManagerList, 'textContent', {
    set() { clears++; },
    get() { return ''; },
});

// Стартовая загрузка: applyLocale вызывается автоматически -> одна перерисовка
await new Promise((r) => setTimeout(r, 10));
const rendersAfterInit = clears;
assert.ok(rendersAfterInit > 0, 'при инициализации списки перерисовываются');

// --- Смена языка на лету ---
// changeLanguage сохраняет lang в storage и вызывает applyLocale(code).
// buildLanguageMenu наполняет меню через appendChild(item) — после
// инициализации в children меню лежат пункты auto/ru/en с обработчиком
// клика, выбираем пункт en и кликаем
const langMenu = byId('language-menu');
const enOption = langMenu.children.find((c) => c.dataset?.lang === 'en');
assert.ok(enOption, 'в меню языков есть пункт en');
enOption.click();
await new Promise((r) => setTimeout(r, 10));

// Кнопки списков перерисованы: renderManagerList очищает контейнер
assert.ok(clears > rendersAfterInit,
    'после смены языка списки перерисовались без перезагрузки страницы');

console.log('language-switch.test.mjs: все проверки пройдены');
