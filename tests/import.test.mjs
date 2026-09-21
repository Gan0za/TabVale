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
const { isSafeWebUrl, sanitizeList, sanitizeBackgrounds } = vm_run(source, {
    chrome: chromeStub,
    document: documentStub,
    window: { addEventListener() {} },
    Image: class {},
    URL,
});

function vm_run(code, context) {
    return vm.runInNewContext(
        code + '\n;({ isSafeWebUrl, sanitizeList, sanitizeBackgrounds })',
        context
    );
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
// Имя движка хранится в поле name (см. реальный файл настроек)
const engines = sanitizeList([
    { name: 'Google', url: 'https://www.google.com/search?q=%s' },
    { name: 'NoPlaceholder', url: 'https://example.com/search' },
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

// --- 7. Поисковые системы: имя в поле name, а не title ---
// Регрессия: валидатор требовал title у всех типов, из-за чего при
// импорте реального файла пропали все поисковые системы
const enginesFix = sanitizeList([
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', logo: 'https://icons.duckduckgo.com/ip3/duckduckgo.com.ico' },
    { name: 'Корп сайт', url: 'http://my.svo.aero/search/?q=%s', logo: 'https://icons.duckduckgo.com/ip3/my.svo.aero.ico' },
    { title: 'Битый', url: 'https://example.com/search' }, // без %s и с name вместо title — отброс
], { requirePlaceholder: true });
assert.equal(enginesFix.items.length, 2, 'оба движка с name прошли санитизацию');
assert.equal(enginesFix.skipped, 1, 'движок без %s отброшен');

// --- 8. Фоны: свои типы (url/file/color/gradient) ---
const bgFix = sanitizeBackgrounds([
    { title: 'По умолчанию', url: '' },                     // legacy -> url
    { title: 'Картинка', url: 'https://example.com/bg.jpg' },
    { title: 'Плохой', url: 'javascript:alert(1)' },        // отброс
    { title: 'Заливка', type: 'color', value: '#ff0000' },
    { title: 'Плохая заливка', type: 'color', value: 'red; background:url(x)' }, // отброс
    { title: 'Градиент', type: 'gradient', from: '#111111', to: '#222222', angle: 45 },
    { title: 'Нет цвета', type: 'color' },                  // отброс
]);
assert.equal(bgFix.items.length, 4, 'пустой url допустим, javascript: и битые отброшены');
assert.equal(bgFix.skipped, 3, 'счётчик: 3 пропущено (javascript:, не-hex, нет цвета)');
assert.deepEqual(
    JSON.parse(JSON.stringify(bgFix.items.map((b) => b.type))),
    ['url', 'url', 'color', 'gradient'],
    'legacy-фон нормализуется в type=url, типы сохраняются'
);

// --- 9.javascript: в списке закладок по-прежнему отбрасывается ---
const bookmarkGuard = sanitizeList([
    { title: 'тест', url: 'javascript:alert("test")' },
    { title: 'OK', url: 'https://ok.com' },
]);
assert.equal(bookmarkGuard.items.length, 1, 'javascript:-закладка отброшена');

console.log('import.test.mjs: все проверки пройдены');
