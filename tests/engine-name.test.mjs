// Тест обрезки слишком длинного названия поисковика.
// Запуск: node .opencoder/tests/engine-name.test.mjs
//
// Регрессия: длинное название сохранялось как есть — разрывало кнопку
// селектора поисковика и не влезало в пункты выпадающего списка.
// Название обрезается при сохранении, а подписи в UI — многоточием CSS.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
import { SOURCE as source } from './_source.mjs';
const css = fs.readFileSync(path.join(projectRoot, 'newtab', 'styles.css'), 'utf8');

// --- clampSearchName: обрезка названия при сохранении ---
// document-заглушка: после сплита ссылки на элементы захватываются на
// топ-уровне (core/state.js) ещё при вычислении исходника, не в DOMContentLoaded
const sandbox = {
    console,
    window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) }, navigator: { language: 'ru-RU' },
    document: { getElementById: () => null, querySelectorAll: () => [], documentElement: { lang: '', dataset: {} }, addEventListener() {} },
    // chrome-заглушка: код темы при вычислении исходника читает theme из storage
    chrome: { runtime: {}, storage: { sync: { get(k, cb) { cb({}); }, set(i, cb) { cb && cb(); } } } },
};
const { clampSearchName, SEARCH_NAME_MAX } = vm.runInNewContext(
    source + '\n;({ clampSearchName, SEARCH_NAME_MAX })',
    sandbox
);

const short = clampSearchName('Google');
assert.equal(short, 'Google', 'короткое название не меняется');

const longName = 'x'.repeat(SEARCH_NAME_MAX + 10);
const clamped = clampSearchName(longName);
assert.ok(clamped.length <= SEARCH_NAME_MAX, `обрезано до ${SEARCH_NAME_MAX} символов`);
assert.ok(clamped.endsWith('…'), 'длинное название заканчивается многоточием');
assert.equal(clampSearchName('  Имя  '), 'Имя', 'пробелы по краям убираются');
assert.equal(clampSearchName(''), '', 'пустое название остаётся пустым — валидация скажет сама');

// --- Сохранение поисковика использует обрезку ---
const saveSection = source.match(/saveSearchEngineButton\.addEventListener[\s\S]{0,600}/);
assert.ok(saveSection, 'обработчик сохранения поисковика найден');
assert.ok(saveSection[0].includes('clampSearchName('),
    'название обрезается перед сохранением');

// --- CSS: длинная подпись на кнопке селектора не распирает строку ---
const buttonName = css.match(/#selected-engine-name\s*\{[^}]*\}/);
assert.ok(buttonName, 'правило #selected-engine-name существует');
for (const decl of ['min-width: 0', 'overflow: hidden', 'text-overflow: ellipsis', 'white-space: nowrap']) {
    assert.ok(buttonName[0].includes(decl), `#selected-engine-name: ${decl}`);
}

// Сам селектор ограничен по ширине — иначе кнопка растягивается
// вслед за именем и ellipsis не срабатывает
const dropdown = css.match(/\.dropdown\s*\{[^}]*\}/);
assert.ok(dropdown, 'правило .dropdown существует');
assert.ok(/max-width:\s*\d+px/.test(dropdown[0]), 'у селектора есть max-width');

console.log('engine-name.test.mjs: все проверки пройдены');
