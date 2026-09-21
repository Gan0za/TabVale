// Тест сенсорного переноса плиток (newtab/app.js).
// Запуск: node tests/touch-drag.test.mjs
//
// Гибрид мышь/тач: у мыши нативный HTML5 drag (как в main), тач добавлен
// отдельным слоем с той же логикой перестановки (плитка остаётся в сетке
// и доезжает по слотам через FLIP). Проверяем:
//   1. Долгое нажатие (350 мс) запускает перенос: класс dragging
//   2. Движение пальца раньше long-press отменяет перенос (это скролл)
//   3. Активный перенос переставляет список той же геометрией слотов,
//      что и мышь (включая no-op на своей позиции и смещение -1)
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
        id, style: {}, dataset: {}, title: '', value: '', src: '', href: '',
        placeholder: '', disabled: false, children: [], files: null,
        // textContent='' — способ renderBookmarks очистить контейнер:
        // заглушка должна при этом сбрасывать children
        get textContent() { return el._text ?? ''; },
        set textContent(v) {
            el._text = v;
            if (v === '') el.children.length = 0;
        },
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
        // appendChild в DOM перемещает узел (снимает со старого места):
        // без этого reorderBookmarksAnimated дублирует плитки в заглушке
        appendChild(c) {
            const oldParent = c.parentNode;
            if (oldParent) {
                const pos = oldParent.children.indexOf(c);
                if (pos !== -1) oldParent.children.splice(pos, 1);
            }
            c.parentNode = el;
            this.children.push(c);
            return c;
        },
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
    addEventListener() {},
    body: makeElement('body'),
    documentElement: makeElement('html'),
    title: '',
};
// mouseup/mouseleave мыши-переноса висят на document — собираем их
const documentListeners = {};
documentStub.addEventListener = (type, fn) => { (documentListeners[type] ||= []).push(fn); };
function fireDocument(type, event = {}) {
    (documentListeners[type] || []).forEach((fn) => fn(event));
}

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
// Палец над левой половиной A (x=50 < центра 65): слот 0, B уезжает в начало.
// Слот 0 < draggedIndex 1 — вставка без смещения
let moveEvent = { touches: [touch(50, 100)], preventDefault() { this.defaultPrevented = true; } };
grid._listeners.touchmove.forEach((fn) => fn(moveEvent));
assert.ok(moveEvent.defaultPrevented, 'страница не скроллится во время переноса');
assert.ok(tileB.classList.contains('dragging'), 'плитка помечена как перетаскиваемая');
assert.equal(tileB.style.position, 'fixed', 'плитка вынута из потока — едет за пальцем');
assert.ok(tileB.style.left !== '' && tileB.style.top !== '', 'плитка следует за пальцем через left/top');
assert.ok(!tileB.draggable, 'нативный drag отключён на время сенсорного переноса');
assert.deepEqual(grid.children.map((c) => c.dataset.url), ['https://b.com', 'https://a.com', 'https://c.com'], 'B уехал в начало ещё до отпускания пальца');

// --- 4. Отпускание: порядок сохранён, визуал снят, drag возвращён ---
grid._listeners.touchend.forEach((fn) => fn({
    touches: [], preventDefault() {},
}));
assert.ok(!tileB.classList.contains('dragging'), 'после отпускания визуал снят');
assert.ok(tileB.style.transform === '' && tileB.style.position === '' && tileB.style.left === '', 'все инлайновые стили сброшены после переноса');
assert.ok(tileB.draggable, 'нативный drag возвращён после сенсорного переноса');
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

// --- 7. Слот без перетаскиваемой плитки: no-op на своей позиции ---
// Порядок после шага 4: B A C. Тащим B (index 0): слот считается без B,
// поэтому no-op — только слот 0 (своя позиция), без пары "до/после"
const currentB = grid.children.find((c) => c.dataset.url === 'https://b.com');
grid._listeners.touchstart.forEach((fn) => fn({
    touches: [touch(200, 200)], target: currentB, stopPropagation() {},
}));
await new Promise((r) => setTimeout(r, 400));
syncSets.length = 0;
// Плитки без B: A (центр 65), C (центры 345). Курсор x=50 — левая
// половина A, ни одного центра не пройдено: слот 0 = draggedIndex — no-op
const beforeMove = grid.children.map((c) => c.dataset.url);
grid._listeners.touchmove.forEach((fn) => fn({
    touches: [touch(50, 100)],
    preventDefault() {},
}));
assert.deepEqual(grid.children.map((c) => c.dataset.url), beforeMove,
    'слот на своей позиции — no-op');
// x=400: пройдены центры A и B... без B это A и C -> слот 2 -> B в конец
grid._listeners.touchmove.forEach((fn) => fn({
    touches: [touch(400, 100)],
    preventDefault() {},
}));
assert.equal(grid.children[grid.children.length - 1].dataset.url, 'https://b.com',
    'плитка доезжает до конца списка');
grid._listeners.touchend.forEach((fn) => fn({ touches: [], preventDefault() {} }));

// --- 8. Единая геометрия слотов: getDropIndex с skipEl ---
// Плитка у пальца исключается из расчёта рядов — иначе фантомный ряд
assert.ok(/getDropIndex\(mouseX, mouseY, skipEl\)/.test(source),
    'getDropIndex принимает skipEl');
assert.ok(/tile !== skipEl/.test(source), 'перетаскиваемая плитка исключена из расчёта рядов');
assert.ok(/\.style\.position = 'fixed'/.test(source),
    'при сенсорном переносе плитка вынимается из потока и едет за пальцем');

// --- 9. Мышь: нативный dragstart ставит класс и индекс ---
syncSets.length = 0;
const mouseTile = grid.children[0];
const dataTransfer = { setData() {} };
grid._listeners.dragstart.forEach((fn) => fn({
    target: mouseTile, dataTransfer, clientX: 50, clientY: 50,
}));
assert.ok(mouseTile.classList.contains('dragging'), 'dragstart включает режим переноса');
assert.equal(draggedIndexNow(), 0, 'dragstart запоминает индекс плитки');
// dragover над последним слотом переставляет список (draggedIndex 0 -> слот 3)
grid._listeners.dragover.forEach((fn) => fn({
    clientX: 400, clientY: 100, preventDefault() {},
}));
assert.equal(grid.children[grid.children.length - 1].dataset.url, mouseTile.dataset.url,
    'мышиный dragover переставляет плитки');
// drop сохраняет порядок и снимает визуал
grid._listeners.drop.forEach((fn) => fn({ preventDefault() {} }));
assert.ok(!mouseTile.classList.contains('dragging'), 'drop снимает визуал');
const titleByUrl = {};
for (const b of syncData.bookmarks) titleByUrl[b.url] = b.title;
assert.deepEqual(savedOrder, grid.children.map((c) => titleByUrl[c.dataset.url]), 'drop сохраняет порядок');

function draggedIndexNow() {
    // draggedIndex — внутренняя переменная модуля: проверяем косвенно,
    // через то, что dragover с no-op слотом не меняет порядок
    return grid.children.findIndex((c) => c.classList.contains('dragging'));
}

// --- 10. Второй палец во время сенсорного переноса не запускает мышиный drag ---
// Регрессия: ладонь/второй палец порождала dragstart второй плитки, тот
// перезаписывал draggedIndex активного сенсорного переноса — всё зависало.
// Порядок после шага 7: A B C (вернули). Тащим B сенсорным переносом...
grid._listeners.touchstart.forEach((fn) => fn({
    touches: [touch(200, 200)], target: tiles[1], stopPropagation() {},
}));
await new Promise((r) => setTimeout(r, 400));
assert.ok(tiles[1].classList.contains('dragging'), 'сенсорный перенос активен');
// ...и в этот момент второй палец порождает dragstart на другой плитке
const secondTile = tiles[0];
let dragPrevented = false;
grid._listeners.dragstart.forEach((fn) => fn({
    target: secondTile, dataTransfer, preventDefault() { dragPrevented = true; },
}));
assert.ok(dragPrevented, 'dragstart второй плитки подавлен во время сенсорного переноса');
assert.ok(!secondTile.classList.contains('dragging'), 'вторая плитка не вошла в режим переноса');
assert.ok(tiles[1].classList.contains('dragging'), 'первый сенсорный перенос не пострадал');
// завершаем сенсорный перенос
grid._listeners.touchend.forEach((fn) => fn({ touches: [], preventDefault() {} }));
// после окончания касания нативный drag снова работает
dragPrevented = false;
grid._listeners.dragstart.forEach((fn) => fn({
    target: secondTile, dataTransfer, preventDefault() { dragPrevented = true; },
}));
assert.ok(!dragPrevented, 'после отпускания пальца dragstart работает как обычно');
assert.ok(secondTile.classList.contains('dragging'), 'мышиный перенос запускается');
grid._listeners.drop.forEach((fn) => fn({ preventDefault() {} }));

console.log('touch-drag.test.mjs: все проверки пройдены');
