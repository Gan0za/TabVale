// Тест действий контекстного меню и гонки его открытия (newtab/app.js).
// Запуск: node .opencoder/tests/menu-actions.test.mjs
//
// Покрывает ревью-фиксы 2026-10-26:
//   1. openInNewTab гасит opener: window.open с 'noopener,noreferrer'
//      (обратный табнабинг; у плиточных ссылок для этого rel="noreferrer")
//   2. copyLink обрабатывает отказ буфера обмена (alert copyFailed),
//      а не падает unhandled rejection
//   3. Гонка меню: пока асинхронное чтение буфера ждёт, открыли другое
//      меню — устаревший ответ не перезаписывает актуальное (токен)

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(projectRoot, 'newtab', 'app.js'), 'utf8');
const ruMessages = JSON.parse(fs.readFileSync(path.join(projectRoot, '_locales', 'ru', 'messages.json'), 'utf8'));

// Заглушки DOM — как в touch-drag.test.mjs, плюс поддержка селекторов по id
// (detectMenuTarget ищет зоны через closest('#search-container') и т.п.)
function makeElement(id = '') {
    const listeners = {};
    const classSet = new Set();
    const el = {
        id, style: {}, dataset: {}, title: '', value: '', src: '', href: '',
        placeholder: '', disabled: false, children: [], files: null,
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
        appendChild(c) { c.parentNode = el; this.children.push(c); return c; },
        append(...cs) { cs.forEach((c) => { c.parentNode = el; this.children.push(c); }); },
        remove() {},
        setAttribute() {},
        getAttribute: () => null,
        focus() {}, select() {},
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 130, height: 120 }),
        contains: () => false,
        closest(selector) {
            const id = selector.startsWith('#') ? selector.slice(1) : null;
            const cls = selector.startsWith('.') ? selector.slice(1) : null;
            let node = el;
            while (node) {
                if (id && node.id === id) return node;
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

let domReady = null;
const alerts = [];
const opened = [];
let readTextImpl = async () => '';
let writeTextImpl = async () => {};
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
    querySelector: () => null,
    querySelectorAll: () => [],
    body: makeElement('body'),
    documentElement: makeElement('html'),
    title: '',
};
// обработчики на document (contextmenu, click, keydown) — собираем
const documentListeners = {};
documentStub.addEventListener = (type, fn) => { (documentListeners[type] ||= []).push(fn); };
function fireDocument(type, event) {
    (documentListeners[type] || []).forEach((fn) => fn(event));
}

const chromeStub = {
    runtime: { getURL: (p) => 'chrome-extension://test/' + p, lastError: undefined },
    storage: {
        sync: {
            get(k, cb) { cb(JSON.parse(JSON.stringify(syncData))); },
            set(items, cb) { cb && cb(); },
        },
        local: { get(keys, cb) { cb({}); }, set(items, cb) { cb && cb(); }, remove() {} },
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
        innerWidth: 1000,
        innerHeight: 800,
        // open записывает вызовы: проверяем фичи opener-гашения
        open(url, target, features) { opened.push([url, target, features]); return {}; },
    },
    navigator: {
        language: 'ru-RU',
        clipboard: {
            readText: () => readTextImpl(),
            writeText: (text) => writeTextImpl(text),
        },
    },
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
const tileB = grid.children.find((c) => c.dataset.url === 'https://b.com');
assert.ok(tileB, 'плитка B отрисована');
const contextMenu = byId('custom-context-menu');
byId('overlay').classList.add('hidden'); // модалка закрыта — меню разрешено
contextMenu.offsetWidth = 120;
contextMenu.offsetHeight = 40;

const menuActions = () => contextMenu.children[0].children
    .filter((li) => li.dataset.action).map((li) => li.dataset.action);
const clickAction = (action) => {
    (contextMenu._listeners.click || []).forEach((fn) => fn({
        target: { getAttribute: (a) => (a === 'data-action' ? action : null) },
    }));
};

// --- 1. openInNewTab: opener погашен фичами окна ---
fireDocument('contextmenu', { clientX: 100, clientY: 100, target: tileB, preventDefault() {} });
assert.ok(!contextMenu.classList.contains('hidden'), 'меню плитки открыто');
assert.deepEqual(
    menuActions(),
    ['editBookmark', 'deleteBookmark', 'openInNewTab', 'copyLink', 'openSettings'],
    'состав меню плитки не изменился');
clickAction('openInNewTab');
assert.deepEqual(opened, [['https://b.com', '_blank', 'noopener,noreferrer']],
    'openInNewTab передаёт noopener,noreferrer — сайт не получает window.opener');

// --- 2. copyLink: отказ буфера -> alert, успех -> тихо ---
writeTextImpl = () => Promise.reject(new Error('denied'));
fireDocument('contextmenu', { clientX: 100, clientY: 100, target: tileB, preventDefault() {} });
clickAction('copyLink');
await new Promise((r) => setTimeout(r, 10));
assert.ok(alerts.includes(ruMessages.copyFailed.message),
    'отказ буфера при копировании ссылки показывает copyFailed');
// успешная запись не добавляет alert
const alertsBefore = alerts.length;
writeTextImpl = async () => {};
fireDocument('contextmenu', { clientX: 100, clientY: 100, target: tileB, preventDefault() {} });
clickAction('copyLink');
await new Promise((r) => setTimeout(r, 10));
assert.equal(alerts.length, alertsBefore, 'успешное копирование молча');

// --- 3. Гонка меню: устаревший ответ буфера не перезаписывает новое меню ---
// Первый правый клик по зоне поиска: чтение буфера висит (меню ещё нет).
// Второй — по плитке: открывается сразу (синхронная ветка). Когда первый
// ответ наконец приходит, он должен быть отброшен по токену
const searchContainer = byId('search-container');
let resolveFirst;
readTextImpl = () => new Promise((res) => { resolveFirst = res; });
fireDocument('contextmenu', { clientX: 10, clientY: 10, target: searchContainer, preventDefault() {} });
assert.ok(contextMenu.classList.contains('hidden'),
    'асинхронная ветка (буфер) ещё не показала меню');
fireDocument('contextmenu', { clientX: 120, clientY: 10, target: tileB, preventDefault() {} });
assert.ok(!contextMenu.classList.contains('hidden'), 'синхронное меню плитки открыто');
assert.ok(menuActions().includes('editBookmark'), 'на экране меню плитки');
resolveFirst('hello');
await new Promise((r) => setTimeout(r, 10));
assert.ok(menuActions().includes('editBookmark') && !menuActions().includes('pasteAndSearch'),
    'устаревший ответ поиска не перезаписал меню плитки (токен отбросил его)');

// --- 3b. Закрытие меню (Esc) инвалидирует ждущий ответ буфера ---
// Иначе устаревшее чтение переоткрыло бы меню после явного закрытия
let resolveSecond;
readTextImpl = () => new Promise((res) => { resolveSecond = res; });
fireDocument('contextmenu', { clientX: 10, clientY: 10, target: searchContainer, preventDefault() {} });
fireDocument('keydown', { key: 'Escape' }); // Esc закрывает меню
assert.ok(contextMenu.classList.contains('hidden'), 'Esc закрыл меню');
resolveSecond('hello');
await new Promise((r) => setTimeout(r, 10));
assert.ok(contextMenu.classList.contains('hidden'),
    'ответ буфера после закрытия меню не переоткрывает его (токен в closeContextMenu)');

console.log('menu-actions.test.mjs: все проверки пройдены');
