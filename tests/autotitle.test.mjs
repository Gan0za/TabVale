// Тест автовыбора заголовка и иконки (newtab/app.js).
// Запуск: node .opencoder/tests/autotitle.test.mjs
//
// Двухшаговая форма: по URL предлагаются название и иконка. Проверяем
// чистые функции, на которых строится автозаполнение:
//   suggestNameFromUrl — название из адреса (Github для github.com)
//   normalizeUrl       — дописывает https://, отбрасывает битые адреса

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

const sandbox = {
    chrome: chromeStub, document: documentStub,
    window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) }, navigator: { language: 'ru-RU' }, Image: class {}, URL,
};
const { suggestNameFromUrl, normalizeUrl } = vm.runInNewContext(
    source + '\n;({ suggestNameFromUrl, normalizeUrl })',
    sandbox
);

// --- suggestNameFromUrl: название из адреса ---
assert.equal(suggestNameFromUrl('https://github.com'), 'Github', 'github.com -> Github');
assert.equal(suggestNameFromUrl('https://www.github.com'), 'Github', 'www отбрасывается');
assert.equal(suggestNameFromUrl('https://ru.stackoverflow.com/questions'), 'Ru', 'первый сегмент hostname');
assert.equal(suggestNameFromUrl('https://www.google.com/search?q=%s'), 'Google', 'шаблон поисковика с %s');
assert.equal(suggestNameFromUrl('не адрес'), '', 'битый адрес -> пустая строка');
assert.equal(suggestNameFromUrl(''), '', 'пустая строка -> пустое название');

// --- normalizeUrl: протокол и валидация ---
assert.equal(normalizeUrl('github.com'), 'https://github.com', 'https:// дописывается');
assert.equal(normalizeUrl('https://github.com'), 'https://github.com', 'полный адрес не меняется');
assert.equal(normalizeUrl('http://a.ru'), 'http://a.ru', 'http не ломается');
assert.equal(normalizeUrl('https://www.google.com/search?q=%s'), 'https://www.google.com/search?q=%s', 'шаблон с %s проходит');
assert.equal(normalizeUrl(''), '', 'пустая строка -> пустая строка');
assert.equal(normalizeUrl('ht!tp://###'), 'https://ht!tp://###', 'браузер парсит как валидный URL (hostname ht!tp)');

console.log('autotitle.test.mjs: все проверки пройдены');
