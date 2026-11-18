// Плагин смены раскладки: три режима, как на allcalc (На русский, На
// латиницу, Смешанный), исходный текст не меняется, результат отдельно.
// Запуск: node tests/layout-plugin.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(projectRoot, 'plugins', 'com.tabvale.layout', 'plugin.js'), 'utf8');

function makeElement(tag) {
    return {
        tagName: tag,
        style: {},
        textContent: '',
        value: '',
        placeholder: '',
        children: [],
        listeners: {},
        append(...children) { this.children.push(...children); },
        addEventListener(type, fn) { this.listeners[type] = fn; },
        focus() {},
    };
}

const body = makeElement('body');
const documentStub = {
    createElement: makeElement,
    body,
};

const api = { locale: 'ru', ui: { ready() {} } };
const mount = vm.runInNewContext(`${source}\n;mount`, { document: documentStub, console });
mount(api);

const wrap = body.children[0];
assert.ok(wrap, 'плагин отрисован');
const [sourceLabel, textarea, row, resultLabel, result] = wrap.children;

assert.equal(sourceLabel.textContent, 'Исходный текст');
assert.equal(resultLabel.textContent, 'Результат');
assert.ok(textarea && result, 'два поля');
assert.deepEqual(Array.from(row.children, (button) => button.textContent), ['На русский', 'На латиницу', 'Смешанный']);

const [toRu, toLatin, mixed] = row.children;
const run = (button, text) => {
    textarea.value = text;
    button.listeners.click();
    return result.value;
};

// 1. Английская раскладка -> русская: заглавные, знаки и цифры
assert.equal(run(toRu, 'GHBDTN? Vbh! 123'), 'ПРИВЕТ, Мир! 123');
assert.equal(textarea.value, 'GHBDTN? Vbh! 123', 'исходный текст не меняется');

// 2. Смешанный ввод: кириллица остаётся при переводе на русский
assert.equal(run(toRu, 'Привет vbh!'), 'Привет мир!');

// 3. На латиницу: латиница остаётся, кириллица переводится
assert.equal(run(toLatin, 'Привет vbh!'), 'Ghbdtn vbh!');

// 4. Смешанный режим: меняются обе стороны
assert.equal(run(mixed, 'Привет vbh!'), 'Ghbdtn мир!');

// 5. Спорные символы в смешанном режиме считаются русскими
assert.equal(run(mixed, '";%?'), '@$%&');

// 6. Обычный английский текст без изменений в смешанном режиме не ломается
assert.equal(run(mixed, 'hello world'), 'руддщ цщкдв');

console.log('layout-plugin.test.mjs: все проверки пройдены');
