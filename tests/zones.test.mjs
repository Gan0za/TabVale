// Тест контекстных меню зон main-container (newtab/app.js).
// Запуск: node tests/zones.test.mjs
//
// Проверяем чистые функции, управляющие составом меню по зонам:
//   getContextMenuItems('bookmarksEmpty') — меню пустого места секции закладок
//     (создать закладку, вставить и создать при URL в буфере, сортировка, настройки)
//   getContextMenuItems('search') — меню зоны поиска (существующее поведение)
// состав меню не зависит от координат, только от типа зоны и данных.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
import { SOURCE as source } from './_source.mjs';

function makeElement(tag) {
    return {
        tagName: tag, className: '', textContent: '', children: [], style: {}, dataset: {},
        appendChild(c) { this.children.push(c); },
        append(...cs) { this.children.push(...cs); },
        setAttribute() {},
    };
}
const documentStub = {
    // documentElement нужен applyTheme (data-theme) и applyLocale (lang):
    // код темы выполняется при вычислении исходника, не в DOMContentLoaded
    documentElement: { lang: '', dataset: {} },
    createElement: makeElement,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: makeElement('body'),
};
const chromeStub = {
    storage: { sync: { get(k, cb) { cb({}); }, set() {} }, onChanged: { addListener() {} } },
};

const ruMessages = JSON.parse(
    fs.readFileSync(path.join(projectRoot, '_locales', 'ru', 'messages.json'), 'utf8')
);

const sandbox = {
    chrome: chromeStub, document: documentStub,
    window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) }, Image: class {}, URL,
};
const { getContextMenuItems } = vm.runInNewContext(
    source + `\n;currentMessages = ${JSON.stringify(ruMessages)};\n;({ getContextMenuItems })`,
    sandbox
);

// --- Меню пустого места секции закладок ---

// Буфер без URL: создать, сортировки А-Я/Я-А, настройки
const emptyNoClipboard = getContextMenuItems('bookmarksEmpty', { hasClipboardUrl: false });
assert.deepEqual(
    Array.from(emptyNoClipboard.filter(i => !i.separator).map(i => i.action)),
    ['addBookmark', 'sortBookmarksAsc', 'sortBookmarksDesc', 'openSettings'],
    'пустое место без URL в буфере: создать закладку, сортировки А-Я/Я-А, настройки'
);

// URL в буфере: первым идёт «Вставить и создать»
const emptyWithClipboard = getContextMenuItems('bookmarksEmpty', { hasClipboardUrl: true });
assert.deepEqual(
    Array.from(emptyWithClipboard.filter(i => !i.separator).map(i => i.action)),
    ['pasteAndCreateBookmark', 'addBookmark', 'sortBookmarksAsc', 'sortBookmarksDesc', 'openSettings'],
    'пустое место с URL в буфере: добавляется «Вставить и создать»'
);
assert.equal(
    emptyWithClipboard.find(i => i.action === 'pasteAndCreateBookmark').label,
    ruMessages.pasteAndCreate.message,
    'подпись «Вставить и создать» берётся из словаря'
);
// «Настройки» — под разделителем, как в остальных меню
const settingsIdx = emptyNoClipboard.findIndex(i => i.action === 'openSettings');
assert.equal(emptyNoClipboard[settingsIdx - 1].separator, true, 'разделитель перед «Настройки»');

// --- Меню зоны поиска не изменилось ---
const searchEmpty = getContextMenuItems('search', { hasText: false, hasClipboardText: false });
assert.deepEqual(
    Array.from(searchEmpty.filter(i => !i.separator).map(i => i.action)),
    ['searchEngineSettings', 'openSettings'],
    'меню зоны поиска (пусто): настройки поисковиков и настройки'
);

// --- Меню фона по-прежнему существует как отдельный тип ---
// hasBackgrounds: true — есть фоны (полный состав меню),
// canSwitchBackground — фонов больше одного, пункт смены на месте
const background = getContextMenuItems('background', { hasBackgrounds: true, canSwitchBackground: true });
assert.deepEqual(
    Array.from(background.filter(i => !i.separator).map(i => i.action)),
    ['nextBackground', 'editBackground', 'backgroundSettings', 'openSettings'],
    'меню фона: следующий фон, редактировать, настройки фонов, настройки'
);

console.log('zones.test.mjs: все проверки пройдены');
