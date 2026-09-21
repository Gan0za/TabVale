// Тест кнопки ⟳ обновления иконки в двухшаговых формах.
// Запуск: node .opencoder/tests/refresh-icon.test.mjs
//
// Кнопка стоит справа от поля "URL логотипа" в формах закладки и
// поисковика. По клику она пересчитывает адрес иконки из текущего
// значения поля URL формы (полезно, если при редактировании пользователь
// полностью заменил адрес). Проверяем разметку и поведение через
// заглушки DOM, как init.test.mjs.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(projectRoot, 'newtab', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(projectRoot, 'newtab', 'index.html'), 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(projectRoot, '_locales', 'ru', 'messages.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(projectRoot, '_locales', 'en', 'messages.json'), 'utf8'));

// --- Кнопки есть в разметке и в обоих словарях ---
for (const id of ['refresh-bookmark-icon', 'refresh-search-engine-icon']) {
    assert.ok(html.includes(`id="${id}"`), `в разметке есть кнопка ${id}`);
}
assert.ok(ru.refreshIcon && en.refreshIcon, 'ключ refreshIcon есть в обоих словарях');

// --- Заглушки DOM (как в init.test.mjs) ---
function makeElement(id = '') {
    const listeners = {};
    return {
        id, style: {}, dataset: {}, title: '', textContent: '', value: '', src: '', href: '',
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
        click() { (listeners.click || []).forEach((fn) => fn()); },
        appendChild() {}, append() {}, remove() {}, setAttribute() {},
        querySelector: () => null, querySelectorAll: () => [],
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
const alerts = [];
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
    fetch: async () => ({ ok: true, text: async () => '<title>t</title>', json: async () => ({}) }),
    URL, URLSearchParams,
    Image: class {},
    setTimeout, clearTimeout,
    DOMParser: class { parseFromString() { return { title: '' }; } },
    alert(msg) { alerts.push(msg); },
};

vm.runInNewContext(source, sandbox);
domReady();

// --- Кнопка ⟳ у закладки: иконка пересчитывается из текущего URL ---
byId('show-bookmark-form').click();
byId('bookmark-url-input').value = 'github.com';       // без протокола
byId('add-bookmark').click();                          // шаг 2
byId('bookmark-icon-input').value = 'https://old.example.com/favicon.ico';
byId('refresh-bookmark-icon').click();
assert.equal(
    byId('bookmark-icon-input').value,
    'https://github.com/favicon.ico',
    '⟳ у закладки пересчитывает иконку из текущего URL (добавляя https://)'
);

// Битый URL: поле иконки не трогаем, пользователь получает alert
alerts.length = 0;
byId('bookmark-url-input').value = 'not a url at all';
byId('refresh-bookmark-icon').click();
assert.equal(alerts.length, 1, 'битый URL у закладки: alert без перезаписи иконки');

// --- Кнопка ⟳ у поисковика: работает с шаблоном %s ---
byId('show-search-engine-form').click();
byId('new-search-engine-url').value = 'https://www.bing.com/search?q=%s';
byId('add-search-engine').click(); // шаг 2 (кнопка добавления у поисковика)
byId('new-search-engine-logo').value = 'https://stale.example.com/favicon.ico';
byId('refresh-search-engine-icon').click();
assert.equal(
    byId('new-search-engine-logo').value,
    'https://www.bing.com/favicon.ico',
    '⟳ у поисковика пересчитывает логотип, %s отбрасывается'
);

// Шаблон без %s — отказ без перезаписи
byId('new-search-engine-url').value = 'https://www.bing.com/search';
alerts.length = 0;
byId('refresh-search-engine-icon').click();
assert.equal(alerts.length, 1, 'URL без %s: alert без перезаписи логотипа');

console.log('refresh-icon.test.mjs: все проверки пройдены');
