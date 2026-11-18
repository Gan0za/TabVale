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
    const element = {
        tagName: tag,
        type: '',
        style: {},
        children: [],
        listeners: {},
        attrs: {},
        value: '',
        placeholder: '',
        min: '',
        max: '',
        _text: '',
        append(...children) { this.children.push(...children); },
        addEventListener(type, fn) { this.listeners[type] = fn; },
        setAttribute(name, value) { this.attrs[name] = String(value); },
        focus() {},
    };
    // Как в DOM: установка текста заменяет детей, пустая строка очищает.
    Object.defineProperty(element, 'textContent', {
        get() { return this._text; },
        set(value) {
            this._text = String(value);
            if (this._text === '') this.children.length = 0;
        },
    });
    return element;
}

const documentStub = {
    createElement: makeElement,
    createElementNS: (ns, tag) => makeElement(tag),
    body: makeElement('body'),
};

function mountPlugin(file, { api, documentOverride = documentStub } = {}) {
    const source = read(file);
    const mount = vm.runInNewContext(`${source}\n;mount`, { document: documentOverride, console, api, URL });
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

// ---- Приложения: иконки, форма по кнопке, полоса из трёх и окно ----
{
    const stored = {};
    const opened = [];
    let faviconCalls = 0;
    const api = {
        locale: 'ru',
        surface: 'panel',
        ui: {
            ready() {},
            openExternal: (url) => { opened.push(url); return Promise.resolve(true); },
            openPanel: () => { opened.push('PANEL'); return Promise.resolve(true); },
        },
        storage: {
            get: async (key) => stored[key] ?? null,
            set: async (key, value) => { stored[key] = value; },
        },
        icon: {
            favicon: async () => { faviconCalls += 1; return 'data:image/png;base64,AAA'; },
        },
    };
    const sandboxDocument = { ...documentStub, body: makeElement('body') };
    const wrap = mountPlugin('plugins/com.tabvale.apps/plugin.js', { api, documentOverride: sandboxDocument });
    await flush();

    const list = wrap.children[0];
    const addToggle = wrap.children[1];
    const form = wrap.children[2];
    assert.equal(list.children.length, 2, 'два приложения по умолчанию');
    assert.equal(form.style.display, 'none', 'форма добавления скрыта');
    for (const row of list.children) {
        assert.equal(row.children[1].children[0].tagName, 'svg', 'у приложения значок, а не буква');
    }
    list.children[0].children[0].listeners.click();
    assert.deepEqual(opened, ['obsidian://open'], 'клик открывает приложение');

    addToggle.listeners.click();
    assert.equal(form.style.display, 'flex', 'форма открылась по кнопке');
    assert.equal(addToggle.style.display, 'none', 'кнопка спряталась');

    const [urlInput, titleInput, descInput, actions, status] = form.children;
    const [save, cancel] = actions.children;
    urlInput.value = 'https://example.com/app';
    titleInput.value = 'Example';
    descInput.value = 'Демо';
    save.listeners.click();
    await flush();
    await flush();

    assert.equal(stored.apps.length, 3, 'приложение сохранено');
    assert.equal(list.children.length, 3, 'строка появилась в списке');
    assert.equal(form.style.display, 'none', 'после сохранения форма скрыта');
    assert.equal(addToggle.style.display, '', 'кнопка добавления вернулась');
    assert.ok(faviconCalls >= 1, 'для http-ссылки запрошена иконка сайта');
    assert.equal(list.children[2].children[1].children[0].tagName, 'img', 'подставлен favicon');

    list.children[2].children[2].listeners.click();
    await flush();
    assert.equal(stored.apps.length, 2, 'приложение удалено');

    addToggle.listeners.click();
    urlInput.value = 'steam://run/440';
    titleInput.value = 'Steam';
    cancel.listeners.click();
    assert.equal(form.style.display, 'none', 'отмена скрывает форму');
    assert.equal(stored.apps.length, 2, 'отмена ничего не добавила');

    addToggle.listeners.click();
    urlInput.value = 'steam://run/440';
    titleInput.value = 'Steam';
    save.listeners.click();
    await flush();
    await flush();
    assert.equal(stored.apps.length, 3, 'приложение со своим протоколом принимается');

    addToggle.listeners.click();
    urlInput.value = 'javascript:alert(1)';
    titleInput.value = 'Bad';
    save.listeners.click();
    await flush();
    assert.ok(String(status.textContent).includes('не поддерживается'), 'опасная схема отклоняется');
    assert.equal(stored.apps.length, 3, 'опасная схема не сохраняется');

    // Полоса: первые три приложения значками и кнопка оконного режима.
    const stripStored = {
        apps: Array.from({ length: 5 }, (_, index) => ({
            title: `App ${index}`, description: '', url: `https://a${index}.example`,
        })),
    };
    const stripApi = {
        ...api,
        surface: 'strip',
        storage: { get: async (key) => stripStored[key] ?? null, set: async () => {} },
    };
    const stripDocument = { ...documentStub, body: makeElement('body') };
    const stripWrap = mountPlugin('plugins/com.tabvale.apps/plugin.js', { api: stripApi, documentOverride: stripDocument });
    await flush();
    await flush();
    assert.equal(stripWrap.children.length, 4, 'три приложения и кнопка окна');
    for (const button of stripWrap.children) {
        assert.equal(button.children.length, 1, 'в полосе только значки');
    }
    stripWrap.children[3].listeners.click();
    await flush();
    assert.ok(opened.includes('PANEL'), 'кнопка окна открывает панель');
}

// ---- GitHub: список своих репозиториев в панели, звёзды в полосе ----
{
    const stored = {};
    const api = {
        locale: 'ru',
        surface: 'panel',
        ui: { ready() {} },
        storage: {
            get: async (key) => stored[key] ?? null,
            set: async (key, value) => { stored[key] = value; },
        },
        fetch: async (url) => ({
            ok: true,
            text: JSON.stringify({
                stargazers_count: url.includes('foo/bar') ? 7 : 12,
                forks_count: 3,
                open_issues_count: 1,
            }),
        }),
    };
    const sandboxDocument = { ...documentStub, body: makeElement('body') };
    const wrap = mountPlugin('plugins/com.tabvale.github/plugin.js', { api, documentOverride: sandboxDocument });
    await flush();
    await flush();

    const [summary, list, addRow] = wrap.children;
    assert.ok(summary.textContent.includes('Репозитории: 1'), 'сводка по умолчанию');
    assert.ok(list.children[0].children[1].textContent.includes('★ 12'), 'статистика репозитория');

    const [input, addButton] = addRow.children;
    input.value = 'https://github.com/foo/bar';
    addButton.listeners.click();
    await flush();
    await flush();

    assert.deepEqual(Array.from(stored.repos), ['Gan0za/TabVale', 'foo/bar'], 'репозиторий сохранён');
    assert.equal(list.children.length, 2, 'две строки в списке');
    assert.ok(summary.textContent.includes('Репозитории: 2'));

    // Полоса показывает первые два репозитория из списка.
    const stripStored = { repos: ['Gan0za/TabVale', 'foo/bar'] };
    const stripApi = {
        ...api,
        surface: 'strip',
        storage: { get: async (key) => stripStored[key] ?? null, set: async () => {} },
    };
    const stripDocument = { ...documentStub, body: makeElement('body') };
    const stripWrap = mountPlugin('plugins/com.tabvale.github/plugin.js', { api: stripApi, documentOverride: stripDocument });
    await flush();
    await flush();
    const badges = stripWrap.children[0].children.map((span) => span.textContent).join(' ');
    assert.ok(badges.includes('★ 12') && badges.includes('★ 7'), 'в полосе звёзды двух репозиториев');
}

console.log('plugin-widgets.test.mjs: все проверки пройдены');
