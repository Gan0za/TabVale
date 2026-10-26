// Тест локализации интерфейса (newtab/app.js + _locales/).
// Запуск: node .opencoder/tests/i18n.test.mjs
//
// Как устроена локализация: строки интерфейса лежат в _locales/<код>/messages.json,
// статическая разметка помечена data-i18n (текст), data-i18n-placeholder
// (плейсхолдер), data-i18n-aria (aria-label). applyLocale загружает словарь
// выбранного языка и расставляет тексты; t(key, vars) — перевод с подстановкой.
//
// Проверяем:
//   1. Паритет ключей ru/en — расхождение = забытый перевод
//   2. Все data-i18n*/data-i18n-placeholder из HTML есть в обоих словарях
//   3. t() подставляет переменные ($count$) и возвращает ключ для пропуска
//   4. resolveLocale: 'auto' -> язык браузера, неизвестный -> 'ru'

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
import { SOURCE as source } from './_source.mjs';
const html = fs.readFileSync(path.join(projectRoot, 'newtab', 'index.html'), 'utf8');

const ru = JSON.parse(fs.readFileSync(path.join(projectRoot, '_locales', 'ru', 'messages.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(projectRoot, '_locales', 'en', 'messages.json'), 'utf8'));

// --- 1. Паритет ключей словарей ---
const ruKeys = Object.keys(ru).sort();
const enKeys = Object.keys(en).sort();
assert.deepEqual(enKeys, ruKeys, 'словари ru и en содержат одни и те же ключи');
assert.ok(ruKeys.length > 40, 'словарь содержит все строки интерфейса');

// --- 2. Все data-i18n ключи из HTML есть в словарях ---
const i18nAttrs = [...html.matchAll(/data-i18n(?:-placeholder|-aria)?="([^"]+)"/g)].map((m) => m[1]);
assert.ok(i18nAttrs.length > 15, 'в разметке есть локализуемые элементы');
for (const key of i18nAttrs) {
    assert.ok(ruKeys.includes(key), `data-i18n="${key}" есть в ru-словаре`);
    assert.ok(enKeys.includes(key), `data-i18n="${key}" есть в en-словаре`);
}

// --- 2.5. Каждая $var$ в message объявлена в placeholders ---
// Валидатор Chrome отвергает messages.json, где использована $переменная$,
// но не объявлена секция placeholders — расширение не загрузится.
for (const [lang, dict] of [['ru', ru], ['en', en]]) {
    for (const [key, val] of Object.entries(dict)) {
        const used = val.message.match(/\$[a-zA-Z]+\$/g) || [];
        for (const token of used) {
            const name = token.slice(1, -1);
            assert.ok(
                val.placeholders?.[name],
                `${lang}/${key}: ${token} объявлена в placeholders`
            );
        }
        // и наоборот: объявленная, но не использованная переменная — ошибка
        for (const name of Object.keys(val.placeholders || {})) {
            assert.ok(
                val.message.includes(`$${name}$`),
                `${lang}/${key}: плейсхолдер ${name} использован в message`
            );
        }
    }
}

// --- Минимальные заглушки DOM/браузера ---
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
    documentElement: makeElement('html'),
};
const chromeStub = {
    runtime: { getURL: (p) => 'file://' + p },
    storage: { sync: { get(k, cb) { cb({}); }, set() {} }, onChanged: { addListener() {} } },
};

const { t, resolveLocale } = vm.runInNewContext(
    source + '\n;({ t, resolveLocale })',
    {
        chrome: chromeStub, document: documentStub,
        window: { addEventListener() {} },
        navigator: { language: 'en-US' },
        fetch: async () => { throw new Error('не нужен в тесте'); },
        URL,
    }
);

// --- 3. t(): подстановка переменных и ключ вместо пропуска ---
// currentMessages пуст — t возвращает сам ключ (пропуски видны сразу)
assert.equal(t('nonexistentKey'), 'nonexistentKey', 'нет ключа — возвращается сам ключ');

// Заполняем словарь внутри песочницы (как это делает applyLocale) и
// проверяем подстановку переменных
const sandbox2 = {
    chrome: chromeStub, document: documentStub,
    window: { addEventListener() {} }, navigator: { language: 'en-US' }, URL,
};
const { t: tFilled } = vm.runInNewContext(
    source + '\ncurrentMessages = { importSkipped: { message: "Пропущено: $count$" }, plain: { message: "Просто строка" } };\n;({ t })',
    sandbox2
);
assert.equal(tFilled('plain'), 'Просто строка', 'готовая строка возвращается как есть');
assert.equal(
    tFilled('importSkipped', { count: 3 }),
    'Пропущено: 3',
    'переменная $count$ подставляется'
);

// --- 4. resolveLocale: авто = язык браузера, неизвестный = ru ---
assert.equal(resolveLocale('ru'), 'ru', 'явный ru остаётся ru');
assert.equal(resolveLocale('en'), 'en', 'явный en остаётся en');
assert.equal(resolveLocale('auto'), 'en', 'auto берёт язык браузера (en-US -> en)');
assert.equal(resolveLocale('xx'), 'ru', 'неизвестный язык -> откат на ru');
assert.equal(resolveLocale(undefined), 'en', 'undefined = авто = язык браузера');

console.log('i18n.test.mjs: все проверки пройдены');
