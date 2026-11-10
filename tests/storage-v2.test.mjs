// Хранилище v2: метаданные экранов отдельно, закладки отдельными ключами,
// крупные экраны — в storage.local, миграция старого формата и фолбэк квоты.
// Запуск: node tests/storage-v2.test.mjs

import assert from 'node:assert/strict';
import vm from 'node:vm';
import { SOURCE as source } from './_source.mjs';

function makeChrome({ sync = {}, local = {}, failSyncScreens = false } = {}) {
    const syncData = JSON.parse(JSON.stringify(sync));
    const localData = JSON.parse(JSON.stringify(local));
    const calls = { syncSets: [], localSets: [], syncRemoved: [] };
    let lastError;

    const pick = (store, keys) => {
        const out = {};
        if (keys == null) { Object.assign(out, store); return out; }
        for (const key of [].concat(keys)) {
            if (key in store) out[key] = JSON.parse(JSON.stringify(store[key]));
        }
        return out;
    };

    const chrome = {
        runtime: { get lastError() { return lastError; } },
        storage: {
            sync: {
                get(keys, cb) { cb(pick(syncData, keys)); },
                set(items, cb) {
                    const screenKey = Object.keys(items).find((key) => key.startsWith('screen:'));
                    if (failSyncScreens && screenKey) {
                        lastError = new Error('QUOTA_BYTES_PER_ITEM');
                        cb?.();
                        lastError = undefined;
                        return;
                    }
                    calls.syncSets.push(JSON.parse(JSON.stringify(items)));
                    Object.assign(syncData, JSON.parse(JSON.stringify(items)));
                    cb?.();
                },
                remove(keys, cb) {
                    for (const key of [].concat(keys)) { delete syncData[key]; }
                    calls.syncRemoved.push(...[].concat(keys));
                    cb?.();
                },
            },
            local: {
                get(keys, cb) { cb(pick(localData, keys)); },
                set(items, cb) {
                    calls.localSets.push(JSON.parse(JSON.stringify(items)));
                    Object.assign(localData, JSON.parse(JSON.stringify(items)));
                    cb?.();
                },
                remove(keys, cb) {
                    for (const key of [].concat(keys)) { delete localData[key]; }
                    cb?.();
                },
            },
        },
    };

    return { chrome, calls, syncData, localData };
}

function load(chrome) {
    const context = {
        chrome,
        document: {
            documentElement: { lang: '', dataset: {} },
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: () => {},
            createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {} }),
            body: { appendChild() {} },
        },
        window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
        navigator: { language: 'ru-RU' },
        URL,
        console,
    };
    vm.runInNewContext(source + `\n;({ persistScreens, getState, saveState, screenStorageKey, currentState })`, context);
    return vm.runInNewContext('({ persistScreens, getState, saveState, screenStorageKey, currentState })', context);
}

const bookmarks = [
    { title: 'A', url: 'https://a.com' },
    { title: 'B', url: 'https://b.com' },
];

// 1. Маленький экран: screensMeta + screen:<id> в sync
{
    const { chrome, calls } = makeChrome();
    const api = load(chrome);
    api.persistScreens([{ id: 'main', title: 'Main', titleKey: 'defaultScreen', bookmarks }]);

    const meta = calls.syncSets.find((items) => Array.isArray(items.screensMeta));
    const screen = calls.syncSets.find((items) => items['screen:main']);
    assert.ok(meta, 'метаданные записаны в sync');
    assert.ok(screen, 'закладки записаны отдельным ключом');
    assert.equal(meta.screensMeta[0].storage, 'sync');
    assert.equal(screen['screen:main'].bookmarks.length, 2);
}

// 2. Большой экран уходит в local, getState собирает его обратно
{
    const { chrome, calls } = makeChrome();
    const api = load(chrome);
    const many = Array.from({ length: 140 }, (_, i) => ({
        title: `Bookmark number ${i} with a long enough title`,
        url: `https://example.com/page/${i}`,
    }));
    api.persistScreens([{ id: 'big', title: 'Big', bookmarks: many }]);

    const meta = calls.syncSets.find((items) => Array.isArray(items.screensMeta));
    const local = calls.localSets.find((items) => items['screen:big']);
    assert.ok(local, 'большой экран записан в storage.local');
    assert.equal(meta.screensMeta[0].storage, 'local');

    let state = null;
    api.getState((s) => { state = s; });
    assert.equal(state.screens[0].id, 'big');
    assert.equal(state.bookmarks.length, 140, 'getState читает закладки из local');
}

// 3. Миграция старого ключа screens
{
    const { chrome, calls } = makeChrome({
        sync: { screens: [{ id: 'main', title: 'Main', bookmarks }], bookmarks },
    });
    const api = load(chrome);
    let state = null;
    api.getState((s) => { state = s; });

    assert.equal(state.bookmarks.length, 2);
    assert.ok(calls.syncSets.some((items) => Array.isArray(items.screensMeta)), 'миграция записала метаданные');
    assert.ok(calls.syncSets.some((items) => items['screen:main']), 'миграция записала экран');
    assert.ok(calls.syncRemoved.includes('screens'), 'старый ключ удалён');
}

// 4. Ошибка квоты sync: данные переносятся в local, ничего не теряется
{
    const { chrome, calls } = makeChrome({ failSyncScreens: true });
    const api = load(chrome);
    api.persistScreens([{ id: 'main', title: 'Main', bookmarks }]);

    const meta = calls.syncSets.find((items) => Array.isArray(items.screensMeta));
    const local = calls.localSets.find((items) => items['screen:main']);
    assert.ok(local, 'при квоте закладки ушли в local');
    assert.equal(meta.screensMeta[0].storage, 'local');

    let state = null;
    api.getState((s) => { state = s; });
    assert.equal(state.bookmarks.length, 2, 'данные читаются после фолбэка');
}

console.log('storage-v2.test.mjs: все проверки пройдены');
