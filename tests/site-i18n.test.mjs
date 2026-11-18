// Переводы сайта: все ключи разметки есть во всех 13 языках.
// Запуск: node tests/site-i18n.test.mjs
//
// Сайт — статическая страница docs/index.html; тексты размечены
// data-i18n / data-i18n-attr, переводы лежат в docs/site-i18n.js.
// Тест ловит пропущенный перевод и расхождение кодов языков с _locales.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(projectRoot, 'docs', 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(projectRoot, 'docs', 'site-i18n.js'), 'utf8');

// Скрипт не инициализируется (readyState = loading), поэтому DOM не нужен.
const windowStub = {};
vm.runInNewContext(source, {
    window: windowStub,
    document: { readyState: 'loading', addEventListener() {} },
    navigator: { language: 'en' },
    localStorage: { getItem: () => null, setItem() {} },
    console,
});

const { DICT, LANGUAGES, normalizeLang } = windowStub.__tabvaleSiteI18n;
assert.ok(DICT && LANGUAGES, 'словарь и список языков доступны');

// 1. Ровно те же 13 языков, что в _locales, с кодами сайта
const localeDirs = fs.readdirSync(path.join(projectRoot, '_locales')).sort();
const siteCodes = Array.from(LANGUAGES, ([code]) => code).sort();
const expected = ['de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt-BR', 'ru', 'tr', 'uk', 'zh-CN'].sort();
assert.deepEqual(siteCodes, expected, 'список языков сайта совпадает с набором локалей');
assert.equal(localeDirs.length, 13, 'в _locales тринадцать языков');

// 2. Ключи разметки: data-i18n и data-i18n-attr
const keys = new Set();
for (const match of html.matchAll(/data-i18n="([^"]+)"/g)) keys.add(match[1]);
for (const match of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const pair of match[1].split(',')) {
        const key = pair.split(':')[1];
        if (key) keys.add(key);
    }
}
assert.ok(keys.size > 30, `в разметке размечены тексты (${keys.size})`);
assert.ok(keys.has('title') && keys.has('description'), 'мета-тексты размечены');

// 3. Каждый ключ переведён на каждый язык, без пустых строк
for (const [code] of LANGUAGES) {
    const dict = DICT[code];
    assert.ok(dict, `есть словарь ${code}`);
    for (const key of keys) {
        assert.equal(typeof dict[key], 'string', `${code}: ключ ${key} есть`);
        assert.ok(dict[key].trim().length > 0, `${code}: ключ ${key} не пустой`);
    }
}

// 4. Коды браузера приводятся к кодам сайта
assert.equal(normalizeLang('ru-RU'), 'ru');
assert.equal(normalizeLang('en-US'), 'en');
assert.equal(normalizeLang('de'), 'de');
assert.equal(normalizeLang('pt-br'), 'pt-BR');
assert.equal(normalizeLang('pt-PT'), 'pt-BR');
assert.equal(normalizeLang('zh-CN'), 'zh-CN');
assert.equal(normalizeLang('zh-Hans'), 'zh-CN');
assert.equal(normalizeLang('ja-JP'), 'ja');
assert.equal(normalizeLang('xx-YY'), 'en', 'неизвестный язык — английский');
assert.equal(normalizeLang(''), 'en');

// 5. Страница подключает словарь
assert.ok(html.includes('site-i18n.js'), 'index.html подключает переводы');
assert.ok(html.includes('id="site-lang"'), 'есть переключатель языка');

console.log('site-i18n.test.mjs: все проверки пройдены');
