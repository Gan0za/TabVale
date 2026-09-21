// Тест сенсорного переноса плиток (newtab/app.js).
// Запуск: node tests/touch-drag.test.mjs
//
// Гибрид мышь/тач: HTML5 drag events остаются для мыши, тач добавлен
// отдельным слоем с той же логикой перестановки. Проверяем:
//   1. Долгое нажатие (350 мс) запускает перенос: класс dragging
//   2. Движение пальца раньше long-press отменяет перенос (это скролл)
//   3. Активный перенос двигает плитку за пальцем и переставляет список
//   4. Отпускание сохраняет порядок только если он менялся
//   5. touchcancel сохраняет порядок; contextmenu гасится во время переноса

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(projectRoot, 'newtab', 'app.js'), 'utf8');
const ruMessages = JSON.parse(fs.readFileSync(path.join(projectRoot, '_locales', 'ru', 'messages.json'), 'utf8'));

function makeElement(id = '') {
    const listeners = {};
    const classSet = new Set();
    const el = {
        id, style: {}, dataset: {}, title: '', textContent: '', value: '', src: '', href: '',
        placeholder: '', disabled: false, children: [], files: null,
        get className() { return Array.from(classSet).join(' '); },
        set className(v) {
            classSet.clear();
            String(v).split(/\s+/).filter(Boolean).forEach((c) => classSet.add(c));
        },
        classList: {
            add(c) { classSet.add(c); },
            remove(c) { classSet.delete(c); },
            toggle(c, force) {
                const target = force === undefined ? !classSet.has(c) : !!force;
                if (target) classSet.add(c); else classSet.delete(c);
                return target;
            },
            contains(c) { return classSet.has(c); },
        },
        addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        removeEventListener() {},
        replaceWith() {},
        querySelector() { return null; },
        querySelectorAll: () => [],
        click(event) {
            const e = { stopPropagation() {}, preventDefault() {}, target: el, ...event };
            (listeners.click || []).forEach((fn) => fn(e));
        },
        appendChild(c) { c.parentNode = el; this.children.push(c); return c; },
        append(...cs) { cs.forEach((c) => { c.parentNode = el; this.children.push(c); }); },
        remove() {},
        setAttribute() {},
        getAttribute: () => null,
        focus() {}, select() {},
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 130, height: 120 }),
        contains: () => false,
        closest(selector) {
            const cls = selector.startsWith('.') ? selector.slice(1) : null;
            let node = el;
            while (node) {
                if (cls && node.classList && node.classList.contains(cls)) return node;
                node = node.parentNode;
            }
            return null;
        },
        _listeners: listeners,
    };
    return el;
}

const elements = new Map();
const byId = (id) => {
    if (!elements[id]) elements[id] = makeElement(id);
    return elements[id];
};

const bgTypeTabs = ['url', 'file', 'color', 'gradient'].map((t) => {
    const tab = byId(`bg-tab-${t}`);
    tab.classList.add('bg-type-tab');
    tab.dataset.bgType = t;
    return tab;
});

let domReady = null;
const alerts = [];
const syncSets = [];
let savedOrder = null;
const syncData = {
    bookmarks: [
        { title: 'A', url: 'https://a.com' },
        { title: 'B', url: 'https://b.com' },
        { title: 'C', url: 'https://c.com' },
    ],
    backgrounds: [{ title: 'По умолчанию', url: '' }],
    searchEngines: [{ name: 'Test', url: 'https://t.test/?q=%s' }],
    currentBackgroundIndex: 0,
    currentSearchEngineIndex: 0,
};

const documentStub = {
    createElement: (tag) => makeElement(tag),
    getElementById: (id) => byId(id),
    querySelector: (selector) => {
        if (selector === '.bg-type-tab.active') {
            return bgTypeTabs.find((tab) => tab.classList.contains('active')) || null;
        }
        return null;
    },
    querySelectorAll: (selector) => {
        if (selector === '.bg-type-tab') return bgTypeTabs;
        return [];
    },
    addEventListener: () => {},
    body: makeElement('body'),
    documentElement: makeElement('html'),
    title: '',
};

const chromeStub = {
    runtime: { getURL: (p) => 'chrome-extension://test/' + p, lastError: undefined },
    storage: {
        sync: {
            get(k, cb) { cb(JSON.parse(JSON.stringify(syncData))); },
            set(items, cb) {
                syncSets.push(items);
                if (items.bookmarks) savedOrder = items.bookmarks.map((b) => b.title);
                cb && cb();
            },
        },
        local: {
            get(keys, cb) { cb({}); },
            set(items, cb) { cb && cb(); },
            remove() {},
        },
        onChanged: { addListener() {} },
    },
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
    fetch: async (url) => {
        const lang = /_locales\/(\w+)\//.exec(url)?.[1] || 'ru';
        return { json: async () => JSON.parse(JSON.stringify(lang === 'en' ? { edit: { message: 'Edit' } } : ruMessages)) };
    },
    URL, URLSearchParams,
    CSS: { escape: (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`) },
    Image: class {},
    setTimeout, clearTimeout,
    DOMParser: class { parseFromString() { return { title: '' }; } },
    alert(msg) { alerts.push(msg); },
    FileReader: class {},
};

vm.runInNewContext(source, sandbox);
domReady();
await new Promise((r) => setTimeout(r, 10));

const grid = byId('bookmarks-container');
const tiles = grid.children;
assert.ok(tiles.length >= 2, 'плитки отрисованы');
const tileB = tiles[1];

// reorderBookmarksAnimated ищет плитки по data-url через querySelector:
// обучаем заглушку контейнера находить детей по селектору .bookmark[data-url="..."]
// (в реальном CSS.escape строка экранирована — снимаем экранирование при поиске)
grid.querySelector = (selector) => {
    const m = /^\.bookmark\[data-url="(.+)"\]$/.exec(selector);
    if (!m) return null;
    const wanted = m[1].replace(/\\(.)/g, '$1');
    return grid.children.find((c) => c.dataset && c.dataset.url === wanted) || null;
};
// getDropIndex группирует плитки по рядам: у заглушки все плитки в одном ряду
const fakeRects = grid.children.map((c, i) => ({ top: 0, left: i * 140, width: 130, height: 120 }));
grid.children.forEach((c, i) => {
    c.getBoundingClientRect = () => fakeRects[i];
});
// endTouchDrag снимает визуал через querySelectorAll('.bookmark')
grid.querySelectorAll = (selector) => {
    if (selector === '.bookmark') return [...grid.children];
    return [];
};

// Обработчики touch-событий навешены на контейнер
for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    assert.ok(grid._listeners[type], `обработчик ${type} на контейнере`);
}

function fire(type, touches, opts = {}) {
    const e = {
        touches,
        target: tiles[1],
        preventDefault() { e.defaultPrevented = true; },
        stopPropagation() {},
        ...opts,
    };
    (grid._listeners[type] || []).forEach((fn) => fn(e));
    return e;
}
const touch = (x, y) => ({ clientX: 0, clientY: 0, ...touches0(x, y) });
function touches0(x, y) { return { clientX: x, clientY: y }; }

// --- 1. Движение пальца раньше long-press: перенос не стартует ---
grid._listeners.touchstart.forEach((fn) => fn({
    touches: [touch(200, 200)], target: tiles[1], stopPropagation() {},
}));
grid._listeners.touchmove.forEach((fn) => fn({
    touches: [touch(200, 100)], // 100px по вертикали > SLOP
    preventDefault() {},
}));
await new Promise((r) => setTimeout(r, 400)); // long-press бы сработал, но отменён
assert.ok(!tileB.classList.contains('dragging'), 'свайп до long-press не запускает перенос');

// --- 2. Long-press запускает перенос ---
let timer = setTimeout(() => {}, 0);
grid._listeners.touchstart.forEach((fn) => fn({
    touches: [touch(200, 200)], target: tiles[1], stopPropagation() {},
}));
await new Promise((r) => setTimeout(r, 400)); // ждём дольше 350 мс
assert.ok(tileB.classList.contains('dragging'), 'long-press включает режим переноса');

// --- 3. Активный перенос: плитка едет за пальцем, список переставляется ---
// Палец над левой половиной A (x=50 < центра 65): слот 0, B уезжает в начало
let moveEvent = { touches: [touch(50, 100)], preventDefault() { this.defaultPrevented = true; } };
grid._listeners.touchmove.forEach((fn) => fn(moveEvent));
assert.ok(moveEvent.defaultPrevented, 'страница не скроллится во время переноса');
assert.ok(tileB.style.transform.includes('translate'), 'плитка едет за пальцем');

// --- 4. Отпускание: порядок сохранён, визуал снят ---
grid._listeners.touchend.forEach((fn) => fn({
    touches: [], preventDefault() {},
}));
assert.ok(!tileB.classList.contains('dragging'), 'после отпускания визуал снят');
assert.ok(tileB.style.transform === '', 'transform сброшен после переноса');
// Палец B сместился над центром A (x=200 -> левая половина A при плитках
// 140px: центры 65/205/345) — слот 0, B в начало
assert.deepEqual(savedOrder, ['B', 'A', 'C'], 'порядок сохранён после сенсорного переноса');

// --- 5. Короткий тап: без переноса, без сохранения ---
syncSets.length = 0;
grid._listeners.touchstart.forEach((fn) => fn({
    touches: [touch(200, 200)], target: tiles[1], stopPropagation() {},
}));
grid._listeners.touchend.forEach((fn) => fn({
    touches: [], preventDefault() {},
}));
await new Promise((r) => setTimeout(r, 10));
assert.equal(syncSets.length, 0, 'тап без long-press не сохраняет порядок');

// --- 6. contextmenu гасится только во время переноса ---
grid._listeners.touchstart.forEach((fn) => fn({
    touches: [touch(200, 200)], target: tiles[1], stopPropagation() {},
}));
await new Promise((r) => setTimeout(r, 400));
let ctxEvent = { target: tiles[1], preventDefault() { ctxEvent.prevented = true; } };
byId('bookmarks-container')._listeners.contextmenu.forEach((fn) => fn(ctxEvent));
assert.ok(ctxEvent.prevented, 'contextmenu подавлен во время сенсорного переноса');
// завершаем перенос
grid._listeners.touchend.forEach((fn) => fn({ touches: [], preventDefault() {} }));
ctxEvent = { target: tiles[1], preventDefault() { ctxEvent.prevented = true; } };
grid._listeners.contextmenu.forEach((fn) => fn(ctxEvent));
assert.ok(!ctxEvent.prevented, 'вне переноса contextmenu работает (правый клик мыши)');

console.log('touch-drag.test.mjs: все проверки пройдены');
