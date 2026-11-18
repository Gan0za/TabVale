// Виджеты: таймер с пользовательскими минутами, погода с городом,
// иконки приложений. Код плагинов исполняется в песочнице с заглушками
// DOM и api, поэтому проверяется реальное поведение, а не строки.
// Запуск: node tests/plugin-widgets.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function makeElement(tag) {
    return {
        tagName: tag,
        type: '',
        style: {},
        children: [],
        listeners: {},
        attrs: {},
        textContent: '',
        value: '',
        placeholder: '',
        min: '',
        max: '',
        append(...children) { this.children.push(...children); },
        addEventListener(type, fn) { this.listeners[type] = fn; },
        setAttribute(name, value) { this.attrs[name] = String(value); },
        focus() {},
    };
}

const documentStub = {
    createElement: makeElement,
    createElementNS: (ns, tag) => makeElement(tag),
    body: makeElement('body'),
};

function mountPlugin(file, { api, documentOverride = documentStub } = {}) {
    const source = read(file);
    const mount = vm.runInNewContext(`${source}\n;mount`, { document: documentOverride, console, api });
    mount(api);
    return documentOverride.body.children.at(-1);
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// ---- Таймер: минуты задаёт пользователь, идёт обратный отсчёт ----
{
    const stored = {};
    let now = 1_000_000;
    let tickFn = null;
    const api = {
        locale: 'ru',
        surface: 'panel',
        ui: { ready() {}, notify() {} },
        storage: {
            get: async (key) => stored[key] ?? null,
            set: async (key, value) => { stored[key] = value; },
        },
    };
    const sandboxDocument = { ...documentStub, body: makeElement('body') };
    const source = read('plugins/com.tabvale.pomodoro/plugin.js');
    const mount = vm.runInNewContext(`${source}\n;mount`, {
        document: sandboxDocument,
        console,
        api,
        Date: { now: () => now },
        setInterval: (fn) => { tickFn = fn; return 1; },
        clearInterval: () => { tickFn = null; },
    });
    mount(api);
    await flush();

    const wrap = sandboxDocument.body.children[0];
    const [time, , minutesRow, controls] = wrap.children;
    const minutesInput = minutesRow.children[0];
    const [toggle, reset] = controls.children;

    assert.equal(time.textContent, '05:00', 'по умолчанию пять минут');
    assert.equal(minutesInput.value, '5', 'поле минут заполнено');

    minutesInput.value = '2';
    minutesInput.listeners.change();
    assert.equal(time.textContent, '02:00', 'минуты применяются сразу');
    assert.equal(stored.minutes, 2, 'минуты сохранены в хранилище плагина');

    toggle.listeners.click();
    assert.equal(toggle.textContent, 'Пауза', 'кнопка стала «Пауза»');
    now += 5000;
    tickFn();
    assert.equal(time.textContent, '01:55', 'отсчёт идёт');

    now += 115000;
    tickFn();
    assert.equal(time.textContent, '00:00', 'таймер дошёл до нуля');
    assert.equal(toggle.textContent, 'Старт', 'после нуля — снова «Старт»');
    assert.equal(wrap.children[1].textContent, 'Время вышло', 'подпись о завершении');

    reset.listeners.click();
    assert.equal(time.textContent, '02:00', 'сброс возвращает заданные минуты');
}

// ---- Погода: город ищется и сохраняется, ошибка сети понятна ----
{
    const stored = {};
    const calls = [];
    const api = {
        locale: 'ru',
        surface: 'panel',
        ui: { ready() {} },
        storage: {
            get: async (key) => stored[key] ?? null,
            set: async (key, value) => { stored[key] = value; },
        },
        fetch: async (url) => {
            calls.push(url);
            if (url.startsWith('https://geocoding-api.open-meteo.com/')) {
                return { ok: true, text: JSON.stringify({ results: [{ name: 'Казань', latitude: 55.79, longitude: 49.1 }] }) };
            }
            return { ok: true, text: JSON.stringify({ current: { temperature_2m: 12.4, weather_code: 0 } }) };
        },
    };
    const sandboxDocument = { ...documentStub, body: makeElement('body') };
    const wrap = mountPlugin('plugins/com.tabvale.weather/plugin.js', { api, documentOverride: sandboxDocument });
    await flush();

    const [value, description] = wrap.children;
    assert.equal(value.textContent, '12°', 'температура показана');
    assert.ok(description.textContent.includes('Ясно') && description.textContent.includes('Москва'), 'погода и город');

    const cityRow = wrap.children[2];
    const [cityInput, find] = cityRow.children;
    cityInput.value = 'Казань';
    find.listeners.click();
    await flush();

    assert.equal(stored.place.name, 'Казань', 'город сохранён');
    assert.ok(calls.some((url) => url.includes('latitude=55.79')), 'погода запрошена для нового города');
    assert.ok(description.textContent.includes('Казань'), 'подпись обновилась');

    const failing = {
        ...api,
        storage: { get: async () => null, set: async () => {} },
        fetch: async () => { throw new Error('offline'); },
    };
    const failingDocument = { ...documentStub, body: makeElement('body') };
    const failingWrap = mountPlugin('plugins/com.tabvale.weather/plugin.js', { api: failing, documentOverride: failingDocument });
    await flush();
    assert.equal(failingWrap.children[0].textContent, '—', 'без сети — прочерк');
    assert.equal(failingWrap.children[1].textContent, 'Нет связи с Open-Meteo', 'ошибка названа понятно');
}

// ---- Приложения: у каждой кнопки есть иконка, клик открывает приложение ----
{
    const opened = [];
    const api = {
        locale: 'ru',
        surface: 'panel',
        ui: { ready() {}, openExternal: (url) => opened.push(url) },
        storage: { get: async () => null, set: async () => {} },
    };
    const sandboxDocument = { ...documentStub, body: makeElement('body') };
    const wrap = mountPlugin('plugins/com.tabvale.apps/plugin.js', { api, documentOverride: sandboxDocument });

    assert.equal(wrap.children.length, 2, 'две кнопки приложений');
    for (const button of wrap.children) {
        const icon = button.children.at(-1);
        assert.equal(icon.tagName, 'svg', 'иконка приложения есть');
        assert.equal(icon.children.length, 2, 'иконка нарисована из двух контуров');
    }
    wrap.children[0].listeners.click();
    wrap.children[1].listeners.click();
    assert.deepEqual(opened, ['obsidian://open', 'vscode://'], 'клики открывают приложения');
}

console.log('plugin-widgets.test.mjs: все проверки пройдены');
