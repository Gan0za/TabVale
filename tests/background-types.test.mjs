// Тест типов фонов: цвет, градиент, файл с устройства (newtab/app.js).
// Запуск: node tests/background-types.test.mjs
//
// Фон — не только картинка по ссылке: добавились типы color (hex-заливка),
// gradient (from/to/angle) и file (картинка с устройства, данные в
// storage.local). Проверяем чистые функции:
//   normalizeBackground — валидация и нормализация записи фона
//   buildBackgroundCss  — CSS-значение для body
//   swatchDataUrl       — SVG-превью заливки

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
    storage: {
        sync: { get(k, cb) { cb({}); }, set() {} },
        local: { get(k, cb) { cb({}); }, set() {} },
        onChanged: { addListener() {} },
    },
};

const sandbox = {
    chrome: chromeStub, document: documentStub,
    window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) }, navigator: { language: 'ru-RU' }, Image: class {}, URL,
};
const { normalizeBackground, buildBackgroundCss, swatchDataUrl, GRADIENT_PRESETS, backgroundPlacementCss } =
    vm.runInNewContext(
        source + '\n;({ normalizeBackground, buildBackgroundCss, swatchDataUrl, GRADIENT_PRESETS, backgroundPlacementCss })',
        sandbox
    );

// --- normalizeBackground: color ---
assert.deepEqual(
    JSON.parse(JSON.stringify(normalizeBackground({ title: 'Море', type: 'color', value: '#0044ff' }))),
    { type: 'color', title: 'Море', value: '#0044ff' },
    'корректный hex-цвет сохраняется'
);
assert.equal(
    normalizeBackground({ title: 'X', type: 'color', value: 'red; background:url(x)' }),
    null,
    'css-инъекция через value отбрасывается'
);
assert.equal(normalizeBackground({ title: 'X', type: 'color', value: '#004' }), null, 'короткий hex отброшен');

// --- normalizeBackground: градиент ---
assert.deepEqual(
    JSON.parse(JSON.stringify(normalizeBackground({ title: 'G', type: 'gradient', from: '#111111', to: '#222222', angle: 45 }))),
    { type: 'gradient', title: 'G', from: '#111111', to: '#222222', angle: 45 },
    'градиент с углом сохраняется'
);
assert.equal(normalizeBackground({ title: 'G', type: 'gradient', from: 'zzz', to: '#222222' }), null, 'битый from отбрасывается');
const noAngle = normalizeBackground({ title: 'G', type: 'gradient', from: '#111111', to: '#222222' });
assert.equal(noAngle.angle, 160, 'угол по умолчанию 160');
const bigAngle = normalizeBackground({ title: 'G', type: 'gradient', from: '#111111', to: '#222222', angle: 999 });
assert.equal(bigAngle.angle, 360, 'угол ограничен 360');

// --- normalizeBackground: file ---
assert.deepEqual(
    JSON.parse(JSON.stringify(normalizeBackground({ title: 'F', type: 'file', fileId: 'bg1' }))),
    { type: 'file', title: 'F', fileId: 'bg1' },
    'file-фон с fileId сохраняется'
);
assert.equal(normalizeBackground({ title: 'F', type: 'file' }), null, 'file без fileId и data отбрасывается');
const withData = normalizeBackground({ title: 'F', type: 'file', data: 'data:image/png;base64,AAA' });
assert.ok(withData.fileId, 'file-фон с data получает сгенерированный fileId');
assert.equal(withData.data, 'data:image/png;base64,AAA', 'data сохраняется для раскладывания в local');

// --- Выбор положения картинки (url и file) ---
// Поле position: cover (по умолчанию), contain, tile, center. У записей,
// где положение не задавалось, поля нет — при применении берётся cover
assert.deepEqual(
    JSON.parse(JSON.stringify(normalizeBackground({ title: 'P', type: 'url', url: 'https://a.com/b.jpg', position: 'contain' }))),
    { type: 'url', title: 'P', url: 'https://a.com/b.jpg', position: 'contain' },
    'url-фон сохраняет положение contain'
);
const filePos = normalizeBackground({ title: 'F2', type: 'file', fileId: 'bg9', position: 'tile' });
assert.equal(filePos.position, 'tile', 'file-фон сохраняет положение tile');
// Некорректное положение отбрасывается, у записи без position — cover
assert.equal(
    normalizeBackground({ title: 'P', type: 'url', url: 'https://a.com/b.jpg', position: 'drop table' }).position,
    'cover',
    'битое положение заменяется на cover'
);
assert.equal(
    normalizeBackground({ title: 'P', type: 'url', url: 'https://a.com/b.jpg' }).position,
    undefined,
    'запись без position не хранит поле — при применении берётся cover'
);
assert.deepEqual(
    JSON.parse(JSON.stringify(normalizeBackground({ title: 'Legacy', url: 'https://a.com/bg.jpg' }))),
    { type: 'url', title: 'Legacy', url: 'https://a.com/bg.jpg' },
    'запись без type считается url-картинкой'
);
assert.equal(normalizeBackground({ title: 'X', url: 'javascript:alert(1)' }), null, 'javascript:-url отбрасывается');
assert.equal(normalizeBackground({ url: 'https://a.com' }), null, 'фон без названия отбрасывается');
assert.equal(normalizeBackground(null), null, 'null отбрасывается');

// --- buildBackgroundCss ---
assert.equal(
    buildBackgroundCss({ type: 'color', title: 'C', value: '#a8c8e8' }),
    '#a8c8e8',
    'цвет применяется как значение background'
);
assert.equal(
    buildBackgroundCss({ type: 'gradient', title: 'G', from: '#111111', to: '#222222', angle: 45 }),
    'linear-gradient(45deg, #111111, #222222)',
    'градиент строится из from/to/angle'
);
assert.equal(
    buildBackgroundCss({ type: 'gradient', title: 'G', from: '#111111', to: '#222222' }),
    'linear-gradient(160deg, #111111, #222222)',
    'угол по умолчанию 160deg'
);
assert.equal(
    buildBackgroundCss({ type: 'file', title: 'F', fileId: 'x' }, 'data:image/png;base64,AAA'),
    'url("data:image/png;base64,AAA")',
    'file применяет data:URL из local'
);
assert.equal(
    buildBackgroundCss({ type: 'file', title: 'F', fileId: 'x' }, ''),
    '',
    'file без данных -> пустой CSS (останется градиент темы)'
);
assert.equal(
    buildBackgroundCss({ type: 'url', title: 'U', url: 'https://a.com/b.jpg' }),
    'url("https://a.com/b.jpg")',
    'url-картинка как раньше'
);

// --- swatchDataUrl: SVG-превью заливок ---
const colorSwatch = swatchDataUrl({ type: 'color', title: 'C', value: '#0044ff' });
assert.ok(colorSwatch.startsWith('data:image/svg+xml,'), 'превью цвета — SVG data:URL');
assert.ok(decodeURIComponent(colorSwatch).includes('#0044ff'), 'превью цвета содержит значение');
const gradSwatch = swatchDataUrl({ type: 'gradient', title: 'G', from: '#111111', to: '#222222', angle: 45 });
assert.ok(gradSwatch.startsWith('data:image/svg+xml,'), 'превью градиента — SVG data:URL');
const decodedGrad = decodeURIComponent(gradSwatch);
assert.ok(decodedGrad.includes('#111111') && decodedGrad.includes('#222222') && decodedGrad.includes('rotate(45'),
    'превью градиента содержит from/to и поворот угла');
assert.equal(swatchDataUrl({ type: 'url', title: 'U', url: 'https://a.com' }), null, 'у url-фона нет swatch');

// --- Пресеты градиентов ---
assert.ok(Array.isArray(GRADIENT_PRESETS) && GRADIENT_PRESETS.length >= 8, 'есть пресеты градиентов');
for (const [from, to, angle] of GRADIENT_PRESETS) {
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(from) && /^#[0-9a-fA-F]{6}$/.test(to), `пресет ${from} содержит корректные hex`);
    assert.ok(angle >= 0 && angle <= 360, `пресет ${from} имеет корректный угол`);
}

// --- backgroundPlacementCss: положение в css size/position/repeat ---
// Объекты из vm-песочницы не равны локальным по прототипу, поэтому
// сверяем через JSON-раундтрип
assert.deepEqual(
    JSON.parse(JSON.stringify(backgroundPlacementCss('cover'))),
    { size: 'cover', position: 'center', repeat: 'no-repeat' },
    'cover: растянуть, центр, без повторов'
);
assert.deepEqual(
    JSON.parse(JSON.stringify(backgroundPlacementCss('contain'))),
    { size: 'contain', position: 'center', repeat: 'no-repeat' },
    'contain: вписать целиком'
);
assert.deepEqual(
    JSON.parse(JSON.stringify(backgroundPlacementCss('tile'))),
    { size: 'auto', position: 'top left', repeat: 'repeat' },
    'tile: замостить без масштабирования'
);
assert.deepEqual(
    JSON.parse(JSON.stringify(backgroundPlacementCss('center'))),
    { size: 'auto', position: 'center', repeat: 'no-repeat' },
    'center: 1:1 по центру'
);
assert.deepEqual(
    JSON.parse(JSON.stringify(backgroundPlacementCss('hack; background:url(x)'))),
    { size: 'cover', position: 'center', repeat: 'no-repeat' },
    'некорректное положение -> значения по умолчанию'
);

// buildBackgroundCss учитывает положение
assert.equal(
    buildBackgroundCss({ type: 'url', title: 'U', url: 'https://a.com/b.jpg', position: 'tile' }),
    'url("https://a.com/b.jpg")',
    'url-картинка: значение background не меняется (положение применяется отдельно)'
);

console.log('background-types.test.mjs: все проверки пройдены');
