// Тест редактирования file-фона (newtab/app.js).
// Запуск: node .opencoder/tests/file-background-edit.test.mjs
//
// Баг: при нажатии "Ред." у file-фона диалог выбора файла пуст (браузер
// запрещает программно заполнять input[type=file]), и сохранить было
// нельзя — расширение требовало выбрать файл заново.
//
// Проверяем:
//   1. При редактировании file-фона превью подгружается из storage.local
//   2. Сохранение без нового файла оставляет прежний fileId (данные целы)
//   3. Создание file-фона без файла по-прежнему требует файл (alert)

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(projectRoot, 'newtab', 'app.js'), 'utf8');
const ruMessages = JSON.parse(fs.readFileSync(path.join(projectRoot, '_locales', 'ru', 'messages.json'), 'utf8'));

// --- Заглушки DOM с цепочкой родителей (для closest в делегатах) ---
function makeElement(id = '') {
    const listeners = {};
    const classSet = new Set();
    const el = {
        id, style: {}, dataset: {}, title: '', textContent: '', value: '', src: '', href: '',
        placeholder: '', disabled: false, children: [], files: null,
        // className синхронизирован с classList: app.js присваивает классы
        // и строкой (btn.className = ...), и через classList.add
        get className() {
            return Array.from(classSet).join(' ');
        },
        set className(v) {
            classSet.clear();
            String(v).split(/\s+/).filter(Boolean).forEach((c) => classSet.add(c));
        },
        classList: {
            add(c) { classSet.add(c); },
            remove(c) { classSet.delete(c); },
            // toggle с force (второй аргумент) — так switchBackgroundType
            // выставляет активную вкладку
            toggle(c, force) {
                const target = force === undefined ? !classSet.has(c) : !!force;
                if (target) classSet.add(c); else classSet.delete(c);
                return target;
            },
            contains(c) { return classSet.has(c); },
        },
        addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        removeEventListener() {},
        // Делегаты читают e.target и вызывают у него closest
        click(event) {
            const e = { stopPropagation() {}, preventDefault() {}, target: el, ...event };
            (listeners.click || []).forEach((fn) => fn(e));
        },
        appendChild(c) { c.parentNode = el; this.children.push(c); return c; },
        append(...cs) { cs.forEach((c) => { c.parentNode = el; this.children.push(c); }); },
        remove() {},
        setAttribute() {}, getAttribute: () => null,
        querySelector: () => null, querySelectorAll: () => [],
        focus() {}, select() {},
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
        contains: () => false,
        closest(selector) {
            const cls = selectorClass(selector);
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

function selectorClass(selector) {
    return selector.startsWith('.') ? selector.slice(1) : null;
}

const elements = new Map();
const byId = (id) => {
    if (!elements[id]) elements[id] = makeElement(id);
    return elements[id];
};

// Вкладки типа фона создаются из HTML — в заглушках их создаём заранее
const bgTypeTabs = ['url', 'file', 'color', 'gradient'].map((t) => {
    const tab = byId(`bg-tab-${t}`);
    tab.classList.add('bg-type-tab');
    tab.dataset.bgType = t;
    return tab;
});

let domReady = null;
const alerts = [];
const syncSets = [];
const localFiles = { 'bgFile:bg1': 'data:image/png;base64,AAAA' };

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
            get(k, cb) { cb({ backgrounds: [{ type: 'file', title: 'Фото', fileId: 'bg1' }] }); },
            set(items) { syncSets.push(items); },
        },
        local: {
            get(keys, cb) {
                const out = {};
                for (const key of [].concat(keys)) out[key] = localFiles[key];
                cb(out);
            },
            set(items) { Object.assign(localFiles, items); },
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
        return {
            json: async () => JSON.parse(JSON.stringify(
                lang === 'en' ? { edit: { message: 'Edit' } } : ruMessages
            )),
        };
    },
    URL, URLSearchParams,
    Image: class {},
    setTimeout, clearTimeout,
    DOMParser: class { parseFromString() { return { title: '' }; } },
    alert(msg) { alerts.push(msg); },
    FileReader: class { readAsDataURL() { /* создание file-фона в тесте не читаем */ } },
};

vm.runInNewContext(source, sandbox);
domReady();
await new Promise((r) => setTimeout(r, 10));

// --- 1. Клик "Ред." в строке file-фона ---
// Строка отрисована в background-manager-list; делегат списка ловит клик
const managerList = byId('background-manager-list');
const row = managerList.children[0];
assert.ok(row, 'строка file-фона отрисована');
// Ищем кнопку edit в отрисованной строке: className может быть задан
// строкой (className = '...') или через classList
function findClass(node, cls) {
    const has = node.classList && node.classList._set && node.classList._set.has(cls);
    if (has || (node.className || '').split(/\s+/).includes(cls)) return node;
    for (const child of node.children || []) {
        const found = findClass(child, cls);
        if (found) return found;
    }
    return null;
}
const editButton = findClass(row, 'background-manage-edit');
assert.ok(editButton, 'в строке есть кнопка "Ред."');

// Клик по делегату списка с target = кнопка
managerList._listeners.click.forEach((fn) => fn({ target: editButton, stopPropagation() {} }));
await new Promise((r) => setTimeout(r, 10));

// Превью старой картинки показано (подгружена из storage.local)
const previewBox = byId('background-file-preview');
assert.ok(!previewBox.classList.contains('hidden'),
    'при редактировании file-фона показано превью текущей картинки');
assert.equal(byId('background-file-thumb').src,
    'data:image/png;base64,AAAA', 'превью использует data:URL из storage.local');

// --- 2. Сохранение без нового файла: fileId не меняется, alert нет ---
alerts.length = 0;
byId('save-background').click();
await new Promise((r) => setTimeout(r, 10));

assert.equal(alerts.length, 0, 'сохранение без замены файла не показывает ошибку');
assert.ok(syncSets.length > 0, 'изменение сохранено в sync');
const savedPayload = syncSets[syncSets.length - 1];
assert.equal(savedPayload.backgrounds[0].fileId, 'bg1',
    'fileId прежней картинки сохранён — данные в storage.local не потеряны');
assert.equal(savedPayload.backgrounds[0].title, 'Фото');

// --- 3. Создание file-фона без файла: отказ ---
// resetBackgroundForm переключает тип на url; возвращаем активную вкладку
// file (как будто пользователь сам её выбрал) и сохраняем без файла
alerts.length = 0;
syncSets.length = 0;
byId('show-background-form').click();
byId('bg-tab-file').click();
byId('background-title-input').value = 'Новое';
byId('save-background').click();
await new Promise((r) => setTimeout(r, 10));
assert.equal(alerts.length, 1, 'создание file-фона без файла показывает ошибку');
assert.equal(syncSets.length, 0, 'пустой file-фон не сохранён');

console.log('file-background-edit.test.mjs: все проверки пройдены');
