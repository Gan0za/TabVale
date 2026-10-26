// Тест основных функций newtab/app.js.
// Запуск: node tests/app.test.mjs
//
// app.js рассчитан на браузерное окружение (DOM + chrome.storage),
// поэтому тест подставляет минимальные заглушки и проверяет:
//   1. getIconUrl не падает на битых URL и возвращает заглушку
//   2. Плитка закладки вставляет название через textContent (защита от XSS)
//   3. setImageSource не ставит src="" и вешает fallback на onerror

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
import { SOURCE as source } from './_source.mjs';

// --- Минимальные заглушки DOM ---
// Элемент хранит свойства и детей, чтобы код app.js мог с ним работать
function makeElement(tag) {
    return {
        tagName: tag,
        className: '',
        textContent: '',
        children: [],
        style: {},
        dataset: {},
        appendChild(child) { this.children.push(child); },
        append(...children) { this.children.push(...children); },
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

// Заглушка Image нужна setImageSource (используется только через new Image
// в fetchLogoWithFallback, но пусть будет).
class ImageStub {}

// Выполняем app.js в песочнице и сразу же возвращаем из неё нужные
// функции (объявления функций живут в рамках одного вызова vm).
const { getIconUrl, buildBookmarkTile, setImageSource } = vm.runInNewContext(
    source + '\n;({ getIconUrl, buildBookmarkTile, setImageSource })',
    {
        chrome: chromeStub,
        document: documentStub,
        window: { addEventListener() {} },
        Image: ImageStub,
        URL,
    }
);

// --- Тест 1: getIconUrl устойчива к битым данным ---
assert.equal(
    getIconUrl({ url: 'https://github.com', icon: 'https://x.com/i.png' }),
    'https://x.com/i.png',
    'своя иконка имеет приоритет'
);
assert.equal(
    getIconUrl({ url: 'https://github.com' }),
    'https://github.com/favicon.ico',
    'без своей иконки берётся favicon домена'
);
assert.ok(
    getIconUrl({ url: 'не-адрес' }).startsWith('data:image/svg'),
    'битый URL -> заглушка, без исключения'
);
assert.ok(
    getIconUrl({}).startsWith('data:image/svg'),
    'пустой объект -> заглушка, без исключения'
);

// --- Тест 2: защита от XSS в плитке закладки ---
// Название с HTML-кодом должно вставиться как текст, а не разметка
const tile = buildBookmarkTile({ title: '<img src=x onerror=alert(1)>', url: 'https://a.com' }, 0);
const link = tile.children.find((c) => c.className === 'bookmark-link');
const titleEl = link.children.find((c) => c.className === 'bookmark-title');
assert.equal(titleEl.textContent, '<img src=x onerror=alert(1)>', 'название — как текст');
assert.ok(!titleEl.children.length, 'внутри нет DOM-детей из названия');

// --- Тест 3: setImageSource ---
const img = makeElement('img');
setImageSource(img, '', '');
assert.ok(!('src' in img), 'пустой src не назначается');
img.onerror(); // при пустом fallback картинка просто прячется
assert.equal(img.style.display, 'none', 'без fallback картинка прячется');

console.log('app.test.mjs: все проверки пройдены');
