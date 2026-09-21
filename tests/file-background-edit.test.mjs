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
        // replaceWith нужен для дозагрузки превью file-фонов
        replaceWith(replacement) {
            const parent = el.parentNode;
            if (!parent) return;
            const pos = parent.children.indexOf(el);
            if (pos !== -1) parent.children[pos] = replacement;
            replacement.parentNode = parent;
        },
        // Минимальный querySelector: .modal-list-item[data-index="N"] на
        // списке и [data-file-thumb] на строке (см. loadFileBackgroundThumbs)
        querySelector(selector) {
            const rowMatch = /\.modal-list-item\[data-index="(\d+)"\]/.exec(selector);
            if (rowMatch && el.children[0] && String(el.children[0].dataset.index) === rowMatch[1]) {
                return el.children[0];
            }
            if (selector === '[data-file-thumb]') {
                return (el.children || []).find((c) => c.dataset && c.dataset.fileThumb !== undefined) || null;
            }
            return null;
        },
        // Делегаты читают e.target и вызывают у него closest
        click(event) {
            const e = { stopPropagation() {}, preventDefault() {}, target: el, ...event };
            (listeners.click || []).forEach((fn) => fn(e));
        },
        appendChild(c) { c.parentNode = el; this.children.push(c); return c; },
        append(...cs) { cs.forEach((c) => { c.parentNode = el; this.children.push(c); }); },
        remove() {},
        setAttribute(name, value) {
            if (name === 'data-file-thumb') el.dataset.fileThumb = value;
        },
        getAttribute: () => null,
        querySelectorAll: () => [],
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

// Поиск descendant с классом (для querySelector заглушки)
function findDescendant(node, cls) {
    for (const child of node.children || []) {
        const className = node.className || '';
        if (className.split(/\s+/).includes(cls)) return child;
        const found = findDescendant(child, cls);
        if (found) return found;
    }
    return null;
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
            // callback обязателен: app.js сохраняет фон после local.set
            set(items, cb) {
                Object.assign(localFiles, items);
                cb && cb();
            },
            remove(keys, cb) {
                for (const key of [].concat(keys)) delete localFiles[key];
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

// --- 4. Превью в строке списка: заглушка заменяется на <img> с data:URL ---
// loadFileBackgroundThumbs срабатывает при каждой отрисовке списка;
// строка file-фона получает <img> с картинкой из storage.local
const rowAfter = managerList.children[0];
assert.ok(rowAfter, 'строка file-фона отрисована после обновления');
const thumbImg = (rowAfter.children || []).find?.((c) => c.tagName === 'img')
    || findClass(rowAfter, '__none__') === null && findImg(rowAfter);
assert.ok(thumbImg, 'в строке file-фона есть <img> с превью');
assert.equal(thumbImg.src, 'data:image/png;base64,AAAA',
    'превью строки использует data:URL из storage.local');

// Вспомогательный поиск первого <img> в дереве строки
function findImg(node) {
    for (const child of node.children || []) {
        if (node.tagName === 'img' || (child.src || '').startsWith('data:image/')) return child;
        const found = findImg(child);
        if (found) return found;
    }
    return node.tagName === 'img' ? node : null;
}

// Ключ storage.local для fileId (тот же формат, что в app.js: fileKey)
function fileKeyStub(fileId) {
    return `bgFile:${fileId}`;
}

// --- 5. Выбор нового файла в диалоге: превью сразу показывает картинку ---
// FileReader заглушки отдаёт data:URL выбранного файла синхронно
const fileInput = byId('background-file-input');
byId('bg-tab-file').click(); // пользователь переключился на вкладку "Устройство"
sandbox.FileReader = class {
    readAsDataURL() {
        this.result = 'data:image/jpeg;base64,BBBB';
        this.onload && this.onload();
    }
};
fileInput.files = [{ name: 'photo.jpg' }];
fileInput._listeners.change.forEach((fn) => fn({ target: fileInput }));
await new Promise((r) => setTimeout(r, 10));

assert.ok(!previewBox.classList.contains('hidden'),
    'после выбора файла превью сразу показано');
assert.equal(byId('background-file-thumb').src,
    'data:image/jpeg;base64,BBBB', 'превью показывает только что выбранный файл');
assert.equal(previewBox.dataset.pendingDataUrl,
    'data:image/jpeg;base64,BBBB', 'data:URL выбранного файла закеширован');

// Сохранение с выбранным файлом: data уходит в storage.local, фон с новым fileId
alerts.length = 0;
byId('background-title-input').value = 'С фото';
byId('save-background').click();
await new Promise((r) => setTimeout(r, 10));
assert.equal(alerts.length, 0, 'сохранение с выбранным файлом без ошибок');
const newBg = syncSets[syncSets.length - 1].backgrounds[1];
assert.ok(newBg.fileId && newBg.fileId !== 'bg1', 'новый file-фон сохранён с новым fileId');
assert.equal(localFiles[fileKeyStub(newBg.fileId)], 'data:image/jpeg;base64,BBBB',
    'data:URL нового файла записан в storage.local');

// --- 6. Смена файла при редактировании: превью обновляется, а не пропадает ---
alerts.length = 0;
syncSets.length = 0;
managerList._listeners.click.forEach((fn) => fn({
    target: findClass(managerList.children[0], 'background-manage-edit'),
    stopPropagation() {},
}));
await new Promise((r) => setTimeout(r, 10));
sandbox.FileReader = class {
    readAsDataURL() {
        this.result = 'data:image/gif;base64,CCCC';
        this.onload && this.onload();
    }
};
fileInput.files = [{ name: 'replacement.gif' }];
fileInput._listeners.change.forEach((fn) => fn({ target: fileInput }));
await new Promise((r) => setTimeout(r, 10));
assert.ok(!previewBox.classList.contains('hidden'),
    'при замене файла превью не пропадает — показывает новый файл');
assert.equal(byId('background-file-thumb').src,
    'data:image/gif;base64,CCCC', 'превью заменённого файла актуально');

// --- 7. Смена вкладки типа: превью файла не висит на чужих вкладках ---
byId('bg-tab-color').click();
assert.ok(previewBox.classList.contains('hidden'),
    'на вкладке "Цвет" превью файла спрятано');
byId('bg-tab-gradient').click();
assert.ok(previewBox.classList.contains('hidden'),
    'на вкладке "Градиент" превью файла спрятано');
byId('bg-tab-url').click();
assert.ok(previewBox.classList.contains('hidden'),
    'на вкладке "Ссылка" превью файла спрятано');
// Возврат на "Устройство": превью снова показано, данные не потеряны
byId('bg-tab-file').click();
assert.ok(!previewBox.classList.contains('hidden'),
    'возврат на "Устройство" снова показывает превью');
assert.equal(previewBox.dataset.pendingDataUrl, 'data:image/gif;base64,CCCC',
    'кешированный data:URL пережил переключение вкладок');

// --- 8. Новый file-фон выбирается сразу после сохранения ---
// Регрессия: фон добавлялся в конец списка, но currentBackgroundIndex
// оставался на прежнем элементе — на экране оставался прежний/дефолтный
// фон, и казалось, что файл "потерялся" после сохранения
const syncBefore = syncSets.length;
byId('show-background-form').click();
byId('bg-tab-file').click();
sandbox.FileReader = class {
    readAsDataURL() {
        this.result = 'data:image/webp;base64,DDDD';
        this.onload && this.onload();
    }
};
fileInput.files = [{ name: 'pick.webp' }];
fileInput._listeners.change.forEach((fn) => fn({ target: fileInput }));
byId('background-title-input').value = 'Auto-selected';
byId('save-background').click();
await new Promise((r) => setTimeout(r, 10));
const addedPayload = syncSets[syncSets.length - 1];
assert.equal(addedPayload.currentBackgroundIndex, 1,
    'новый file-фон выбран сразу после сохранения');
assert.equal(localFiles['bgFile:bg1'], 'data:image/png;base64,AAAA',
    'данные прежнего file-фона (bg1) в storage.local не тронуты');

// --- 9. Ошибка квоты при записи файла: понятное сообщение ---
// Регрессия: chrome.storage.local.set без callback и проверки lastError
// терял ошибку квоты в консоль (Unchecked runtime.lastError), фон молча
// не сохранялся
const origSet = chromeStub.storage.local.set;
let quotaExceeded = false;
chromeStub.storage.local.set = function (items, cb) {
    // Квота «кончилась»: ничего не пишем, но callback вызываем.
    // lastError живёт на chrome.runtime, как в настоящем Chrome
    quotaExceeded = true;
    chromeStub.runtime.lastError = { message: 'QUOTA_BYTES quota exceeded' };
    if (cb) cb();
    delete chromeStub.runtime.lastError;
};
alerts.length = 0;
byId('show-background-form').click();
byId('bg-tab-file').click();
sandbox.FileReader = class {
    readAsDataURL() {
        this.result = 'data:image/png;base64,HUGE';
        this.onload && this.onload();
    }
};
fileInput.files = [{ name: 'big.jpg' }];
fileInput._listeners.change.forEach((fn) => fn({ target: fileInput }));
byId('background-title-input').value = 'Too big';
byId('save-background').click();
await new Promise((r) => setTimeout(r, 10));
assert.equal(alerts.length, 1, 'ошибка квоты показывает сообщение пользователю');
assert.ok(!syncSets.some((p) => p.backgrounds?.some((b) => b.title === 'Too big')),
    'фон с незаписанным файлом не попадает в список');
chromeStub.storage.local.set = origSet;

// --- 10. Удаление file-фона чистит storage.local ---
// Регрессия: bgFile:* оставались в хранилище навсегда и засоряли квоту
// Первая строка списка — последний file-фон из сценария 8 ('Auto-selected').
const deletedFileId = syncSets[syncSets.length - 1].backgrounds[0].fileId;
byId('background-manager-list')._listeners.click.forEach((fn) => fn({
    target: findClass(managerList.children[0], 'background-manage-delete'),
    stopPropagation() {},
}));
await new Promise((r) => setTimeout(r, 10));
assert.ok(!('bgFile:' + deletedFileId in localFiles) && localFiles['bgFile:' + deletedFileId] === undefined,
    'данные удалённого file-фона удалены из storage.local');

console.log('file-background-edit.test.mjs: все проверки пройдены');
