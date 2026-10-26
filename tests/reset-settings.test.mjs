// Тест кнопки сброса настроек (раздел «Общие»).
// Запуск: node .opencoder/tests/reset-settings.test.mjs
//
// Проверяем:
//   1. Кнопка есть в разметке и в app.js
//   2. После подтверждения: дефолтные списки в sync, bgFile:* очищены,
//      тема вернулась в 'auto', UI перерисован
//   3. Отмена в confirm ничего не трогает

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
import { SOURCE as source } from './_source.mjs';
const html = fs.readFileSync(path.join(projectRoot, 'newtab', 'index.html'), 'utf8');
const ruMessages = JSON.parse(fs.readFileSync(path.join(projectRoot, '_locales', 'ru', 'messages.json'), 'utf8'));
const enMessages = JSON.parse(fs.readFileSync(path.join(projectRoot, '_locales', 'en', 'messages.json'), 'utf8'));

// Кнопка сброса есть в разметке рядом с импортом/экспортом
assert.ok(html.includes('id="reset-settings"'), 'в index.html есть кнопка сброса');
assert.ok(ruMessages.resetButton, 'локаль ru: ключ resetButton');
assert.ok(enMessages.resetButton?.message, 'локаль en: ключ resetButton');
assert.ok(ruMessages.resetConfirm?.message, 'локаль ru: ключ resetConfirm');

// --- Заглушки DOM (минимальные, как в file-background-edit.test.mjs) ---
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
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
        contains: () => false,
        closest: () => null,
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
let localRemoved = [];
let syncData = {
    backgrounds: [{ type: 'file', title: 'Фото', fileId: 'bg1' }],
    bookmarks: [{ title: 'Example', url: 'https://example.com' }],
    searchEngines: [{ name: 'Test', url: 'https://t.test/?q=%s' }],
    currentBackgroundIndex: 0,
    currentSearchEngineIndex: 0,
};
const localFiles = { 'bgFile:bg1': 'data:image/png;base64,AAAA', 'other': 'keep me' };

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
            set(items, cb) { syncSets.push(items); Object.assign(syncData, items); cb && cb(); },
        },
        local: {
            get(keys, cb) {
                const out = {};
                for (const key of [].concat(keys)) out[key] = localFiles[key];
                cb(out);
            },
            set(items, cb) { Object.assign(localFiles, items); cb && cb(); },
            remove(keys, cb) {
                for (const key of [].concat(keys)) { delete localFiles[key]; }
                localRemoved.push(...[].concat(keys));
                cb && cb();
            },
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
        return { json: async () => JSON.parse(JSON.stringify(lang === 'en' ? enMessages : ruMessages)) };
    },
    URL, URLSearchParams,
    Image: class {},
    setTimeout, clearTimeout,
    DOMParser: class { parseFromString() { return { title: '' }; } },
    alert(msg) { alerts.push(msg); },
    confirm() { return true; },
    FileReader: class {},
};

vm.runInNewContext(source, sandbox);
domReady();
await new Promise((r) => setTimeout(r, 10));

// --- 1. Отмена: ничего не меняется ---
sandbox.confirm = () => false;
const syncCountBefore = syncSets.length;
byId('reset-settings').click();
await new Promise((r) => setTimeout(r, 10));
assert.equal(syncSets.length, syncCountBefore, 'отмена в confirm не сохраняет ничего');
assert.ok(localFiles['bgFile:bg1'], 'отмена не трогает file-фоны');

// --- 2. Подтверждение: дефолты записаны, bgFile:* вычищены, тема auto ---
sandbox.confirm = () => true;
byId('reset-settings').click();
await new Promise((r) => setTimeout(r, 10));

// saveState пишет состояние, storageSet({theme}) — отдельный вызов после
const saved = syncSets.find((s) => s.bookmarks);
assert.ok(saved, 'после сброса состояние сохранено');
assert.equal(saved.bookmarks.length, 2, 'закладки — дефолтный набор');
assert.equal(saved.searchEngines.length, 3, 'поисковики — дефолтный набор');
assert.equal(saved.backgrounds.length, 1, 'фоны — дефолтный набор');
assert.equal(saved.currentBackgroundIndex, 0, 'выбран первый дефолтный фон');
assert.equal(saved.currentSearchEngineIndex, 0, 'выбран первый дефолтный поисковик');

assert.ok(localRemoved.includes('bgFile:bg1'), 'картинка file-фона удалена из storage.local');
assert.equal(localFiles['other'], 'keep me', 'чужие ключи storage.local не тронуты');

const themeSet = syncSets.find((s) => s.theme === 'auto');
assert.ok(themeSet, 'тема сброшена в auto');

console.log('reset-settings.test.mjs: все проверки пройдены');
