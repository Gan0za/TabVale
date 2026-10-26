// Тест обёрток chrome.storage с проверкой chrome.runtime.lastError
// (newtab/app.js). Запуск: node tests/storage.test.mjs
//
// Зачем: колбэк chrome.* без чтения chrome.runtime.lastError вызывает
// предупреждение "Unchecked runtime.lastError" в консоли — за это цепляется
// ревью Chrome Web Store. Обёртки storageGet/storageSet должны:
//   1. Читать lastError при каждой ошибке (иначе предупреждение)
//   2. Не ронять callback при ошибке (result = пустой объект)
//   3. Пробрасывать данные при успешной операции
//   4. saveState/getState в app.js пользоваться обёртками, а не
//      chrome.storage напрямую

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
import { SOURCE as source } from './_source.mjs';

// --- Заглушки DOM (app.js рассчитан на браузер) ---
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

/**
 * Собирает заглушку chrome.storage.sync.
 * lastErrorValue — что вернёт chrome.runtime.lastError в колбэках
 * (объект ошибки или undefined).
 */
function makeChromeStub({ lastError, data }) {
    let getArgs = null;
    const chromeStub = {
        runtime: { get lastError() { return lastError; } },
        storage: {
            sync: {
                get(keys, cb) { getArgs = { keys }; cb(lastError ? {} : data); },
                set(items, cb) { cb?.(); },
            },
        },
    };
    return { chromeStub, getGetArgs: () => getArgs };
}

// --- Заглушка БЕЗ поля runtime: код должен использовать optional chaining ---
// и не падать в тестовой среде (node), и в старых браузерах
const documentNoRuntime = { ...documentStub };

const { storageGet, storageSet } = vm.runInNewContext(
    source + '\n;({ storageGet, storageSet })',
    {
        chrome: makeChromeStub({ lastError: undefined, data: { theme: 'dark' } }).chromeStub,
        document: documentNoRuntime,
        window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
        URL,
    }
);

// --- 1. Успешное чтение: данные пробрасываются, lastError не мешает ---
storageGet('theme', (result) => {
    assert.equal(result.theme, 'dark', 'успешный get возвращает данные');
});

// --- 2. Ошибка: callback вызывается с пустым объектом, без исключения ---
const failing = makeChromeStub({ lastError: new Error('quota exceeded'), data: {} });
const { storageGet: failingGet } = vm.runInNewContext(
    source + '\n;({ storageGet, storageSet })',
    { chrome: failing.chromeStub, document: documentNoRuntime, window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) }, URL }
);
let called = false;
failingGet('theme', (result) => {
    called = true;
    assert.deepEqual(result, {}, 'при ошибке result — пустой объект');
});
assert.ok(called, 'callback вызывается даже при ошибке');

// --- 3. saveState/getState используют обёртки, а не chrome.storage напрямую ---
// (прямые вызовы без проверки lastError — источник претензий ревью).
// Вызовы внутри самих обёрток (storageGet/storageSet) — разрешены,
// поэтому вырезаем тела обёрток перед проверкой.
const wrappersStripped = source
    .replace(/function storageGet[\s\S]*?\r?\n\}\r?\n/, '')
    .replace(/function storageSet[\s\S]*?\r?\n\}\r?\n/, '');
const directCalls = wrappersStripped.match(/chrome\.storage\.sync\.(get|set)\(/g) || [];
assert.equal(directCalls.length, 0, 'прямых вызовов chrome.storage.sync нет — только обёртки');

// --- 4. getState подставляет значения по умолчанию через обёртку ---
const { getState } = vm.runInNewContext(
    source + '\n;({ getState })',
    { chrome: makeChromeStub({ lastError: undefined, data: {} }).chromeStub, document: documentNoRuntime, window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) }, URL }
);
getState((state) => {
    assert.ok(state.searchEngines.length > 0, 'дефолтные движки подставлены');
    assert.ok(state.bookmarks.length > 0, 'дефолтные закладки подставлены');
});

console.log('storage.test.mjs: все проверки пройдены');
