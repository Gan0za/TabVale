// Тест модели экранов: миграция legacy bookmarks, алиас активного экрана,
// переключение и сохранение в chrome.storage.sync.
// Запуск: node .opencoder/tests/screens.test.mjs

import assert from 'node:assert/strict';
import vm from 'node:vm';
import { SOURCE as source } from './_source.mjs';

function makeClassList(el) {
    return {
        add(c) { el._classes.add(c); },
        remove(c) { el._classes.delete(c); },
        contains(c) { return el._classes.has(c); },
        toggle(c, force) {
            if (force === undefined) force = !el._classes.has(c);
            if (force) el._classes.add(c); else el._classes.delete(c);
            return force;
        },
    };
}

function makeElement(tag = 'div') {
    const el = {
        tagName: tag, className: '', textContent: '', children: [], style: {}, dataset: {},
        _classes: new Set(),
        appendChild(c) { this.children.push(c); return c; },
        append(...cs) { this.children.push(...cs); },
        setAttribute() {},
        addEventListener() {},
    };
    el.classList = makeClassList(el);
    return el;
}

const bookmarksContainer = makeElement('div');
const screenDots = makeElement('nav');

const documentStub = {
    documentElement: { lang: '', dataset: {} },
    body: makeElement('body'),
    createElement: makeElement,
    getElementById(id) {
        if (id === 'bookmarks-container') return bookmarksContainer;
        if (id === 'screen-dots') return screenDots;
        return null;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
};

const syncGets = [];
const syncSets = [];
const syncData = {
    bookmarks: [{ title: 'A', url: 'https://a.com' }],
    searchEngines: [],
    backgrounds: [],
};

const chromeStub = {
    runtime: { lastError: undefined },
    storage: {
        sync: {
            get(keys, cb) { syncGets.push(keys); cb(JSON.parse(JSON.stringify(syncData))); },
            set(items, cb) { syncSets.push(items); cb?.(); },
            remove(keys, cb) { cb?.(); },
        },
        local: {
            get(keys, cb) { cb({}); },
            set(items, cb) { cb?.(); },
        },
    },
};

const sandbox = {
    chrome: chromeStub,
    document: documentStub,
    window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    navigator: { language: 'ru-RU' },
    URL,
    console,
};
const ctx = vm.createContext(sandbox);
vm.runInContext(source + `
;({ normalizeScreens, setActiveScreen, activeScreen, currentState, saveState, getState, renderScreens })
`, ctx);

const api = vm.runInContext('({ normalizeScreens, setActiveScreen, activeScreen, currentState, saveState, getState, renderScreens, moveScreenInList })', ctx);

// 1. Legacy bookmarks -> один экран main
const migrated = api.normalizeScreens(undefined, [{ title: 'A', url: 'https://a.com' }]);
assert.equal(migrated.length, 1, 'legacy превращается в один экран');
assert.equal(migrated[0].id, 'main', 'id главного экрана стабилен');
assert.equal(migrated[0].bookmarks.length, 1, 'закладка перенесена');
assert.equal(migrated[0].bookmarks[0].title, 'A');

// 2. Битые URL отбрасываются, дубли id разводятся
const sanitized = api.normalizeScreens([
    { id: 'x', title: 'X', bookmarks: [{ title: 'bad', url: 'javascript:alert(1)' }] },
    { id: 'x', title: 'Y', bookmarks: [{ title: 'ok', url: 'https://ok.com' }] },
], []);
assert.equal(sanitized.length, 2);
assert.notEqual(sanitized[0].id, sanitized[1].id, 'дубли id разведены');
assert.equal(sanitized[0].bookmarks.length, 0, 'небезопасный URL отброшен');
assert.equal(sanitized[1].bookmarks.length, 1);

// 3. Переключение меняет алиас currentState.bookmarks
api.currentState.screens = [
    { id: 'main', title: 'Главная', bookmarks: [{ title: 'A', url: 'https://a.com' }] },
    { id: 'work', title: 'Работа', bookmarks: [{ title: 'W', url: 'https://w.com' }] },
];
api.currentState.currentScreenId = 'main';
api.currentState.bookmarks = api.currentState.screens[0].bookmarks;
api.setActiveScreen('work', { persist: false });
assert.equal(api.currentState.currentScreenId, 'work');
assert.equal(api.currentState.bookmarks[0].title, 'W', 'алиас указывает на закладки активного экрана');
assert.equal(api.activeScreen().id, 'work');

// 4. saveState({ bookmarks }) пишет screens, а не legacy-ключ
api.currentState.bookmarks.push({ title: 'W2', url: 'https://w2.com' });
api.saveState({ bookmarks: api.currentState.bookmarks });
const lastSet = syncSets.at(-1);
assert.ok(lastSet.screens, 'в storage уходит screens');
assert.equal(lastSet.bookmarks, undefined, 'legacy-ключ bookmarks не пишется');
assert.equal(lastSet.screens.find((s) => s.id === 'work').bookmarks.length, 2);

// 5. getState: legacy bookmarks -> screens, миграция сохраняется
syncSets.length = 0;
let state = null;
api.getState((s) => { state = s; });
assert.ok(Array.isArray(state.screens) && state.screens.length === 1);
assert.equal(state.screens[0].id, 'main');
assert.equal(state.bookmarks, state.screens[0].bookmarks, 'bookmarks — алиас активного экрана');
assert.ok(syncSets.some((items) => items.screens), 'миграция записана в storage');

// 6. Точки: две штуки, активная отмечена
api.renderScreens();
assert.equal(screenDots.children.length, 3, 'две точки + кнопка добавления');
assert.ok(screenDots.children[1].className.includes('active'), 'активная точка — work');

// 7. Сдвиг экрана: меняет местами соседей и не выходит за границы
const order = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
assert.equal(api.moveScreenInList(order, 'b', -1), true);
assert.deepEqual(order.map((s) => s.id), ['b', 'a', 'c'], 'экран сдвинут влево');
assert.equal(api.moveScreenInList(order, 'b', -1), false, 'левый край защищён');
assert.equal(api.moveScreenInList(order, 'c', 1), false, 'правый край защищён');

console.log('screens.test.mjs: все проверки пройдены');
