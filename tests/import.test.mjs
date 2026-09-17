// Тест санитизации импортируемых настроек (newtab/app.js).
// Запуск: node tests/import.test.mjs
//
// Импорт настроек принимает чужие JSON-файлы, поэтому списки закладок,
// фонов и поисковиков прогоняются через sanitizeList: элементы с
// небезопасными адресами (javascript: и т.п.) и битыми полями
// отбрасываются, а не попадают в хранилище.
//
// Проверяем:
//   1. isSafeWebUrl пропускает только http/https
//   2. Закладка с javascript:-URL отбрасывается (главный вектор атаки)
//   3. Битые title (число, пустая строка) — отбрасываются
//   4. Поисковик без %s — отбрасывается (requirePlaceholder)
//   5. Иконка с javascript:-URL — элемент отбрасывается
//   6. Счётчик skipped корректен; пустой/не-массивный ввод безопасен

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(projectRoot, 'newtab', 'app.js'), 'utf8');

// --- Минимальные заглушки DOM/браузера (app.js рассчитан на браузер) ---
function makeElement(tag) {
    return {
        tagName: tag, className: '', textContent: '', children: [], style: {}, dataset: {},
        appendChild(c) { this.children.push(c); },
        append(...cs) { this.children.push(...cs); },
        setAttribute() {},
    };
}
const documentStub = {
    createElement: makeElement,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: makeElement('body'),
};
const chromeStub = {
    storage: {
        sync: { get(keys, cb) { cb({}); }, set() {} },
        onChanged: { addListener() {} },
    },
};

// Выполняем app.js в песочнице и забираем санитизирующие функции
const { isSafeWebUrl, sanitizeList } = vm_run(source, {
    chrome: chromeStub,
    document: documentStub,
    window: { addEventListener() {} },
    Image: class {},
    URL,
});

function vm_run(code, context) {
    return vm.runInNewContext(code + '\n;({ isSafeWebUrl, sanitizeList })', context);
}

// --- 1. isSafeWebUrl: только http/https ---
assert.equal(isSafeWebUrl('https://github.com'), true, 'https разрешён');
assert.equal(isSafeWebUrl('http://example.com/page'), true, 'http разрешён');
assert.equal(isSafeWebUrl('javascript:alert(1)'), false, 'javascript: запрещён');
assert.equal(isSafeWebUrl('data:text/html,<script>alert(1)</script>'), false, 'data: запрещён');
assert.equal(isSafeWebUrl('file:///C:/Windows'), false, 'file: запрещён');
assert.equal(isSafeWebUrl('не адрес'), false, 'мусор не адрес');
assert.equal(isSafeWebUrl(undefined), false, 'undefined не адрес');

// --- 2. javascript:-URL в закладке отбрасывается ---
const { items: sanitized } = sanitizeList([
    { title: 'Google', url: 'https://google.com' },
    { title: 'Evil', url: 'javascript:alert(document.cookie)' },
    { title: 'Data', url: 'data:text/html,<h1>x</h1>' },
    { title: 'File', url: 'file:///etc/passwd' },
]);
assert.equal(sanitized.length, 1, 'остался только https-элемент');
assert.equal(sanitized[0].title, 'Google');

// --- 3. Битые названия отбрасываются ---
const badTitles = sanitizeList([
    { title: '', url: 'https://a.com' },
    { title: '   ', url: 'https://b.com' },
    { title: 42, url: 'https://c.com' },
    { url: 'https://d.com' },
    { title: 'OK', url: 'https://ok.com' },
]);
assert.equal(badTitles.items.length, 1, 'только элемент с корректным title');
assert.equal(badTitles.skipped, 4, 'счётчик отброшенных: 4');

// --- 4. Поисковик без %s отбрасывается ---
const engines = sanitizeList([
    { title: 'Google', url: 'https://www.google.com/search?q=%s' },
    { title: 'NoPlaceholder', url: 'https://example.com/search' },
], { requirePlaceholder: true });
assert.equal(engines.items.length, 1, 'остался только движок с %s');
assert.equal(engines.skipped, 1, 'движок без %s отброшен');

// --- 5. Иконка с запрещённым протоколом ---
const badIcon = sanitizeList([
    { title: 'A', url: 'https://a.com', icon: 'javascript:alert(1)' },
    { title: 'Good', url: 'https://b.com', icon: 'https://b.com/i.png' },
]);
assert.equal(badIcon.items.length, 1, 'элемент с плохой иконкой отброшен');
assert.equal(badIcon.skipped, 1, 'один элемент пропущен');

// --- 6. Не-массивный и битый ввод безопасен ---
// Сравниваем длину, а не массивы целиком: deepStrictEqual сверяет
// прототипы, а массив из vm-песочницы живёт в другом контексте
assert.equal(sanitizeList(undefined).items.length, 0, 'undefined — пустой список');
assert.equal(sanitizeList('строка').items.length, 0, 'строка — пустой список');
// Мусорные элементы (null, строка, число) отбрасываются, корректный остаётся
const withJunk = sanitizeList([null, 'текст', 42, { title: 'OK', url: 'https://ok.com' }]);
assert.equal(withJunk.items.length, 1, 'мусорные элементы отброшены');
assert.equal(withJunk.skipped, 3, 'счётчик: 3 элемента пропущено');

console.log('import.test.mjs: все проверки пройдены');
