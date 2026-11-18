// Иконки сайтов: ключ кэша, адреса и политика «кэш важнее сети».
// Запуск: node tests/icons.test.mjs
//
// Правило, которое нельзя сломать: сохранённая иконка отдаётся даже
// когда сайт недоступен или сети нет; неудачное обновление её не стирает.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const source = [
    fs.readFileSync(path.join(projectRoot, 'newtab', 'core', 'config.js'), 'utf8'),
    fs.readFileSync(path.join(projectRoot, 'newtab', 'core', 'icon-store.js'), 'utf8'),
].join('\n');

const chromeStub = {
    runtime: { getURL: (file) => `chrome-extension://test${file}` },
};
const api = vm.runInNewContext(
    source + `\n;({
        FALLBACK_ICON, iconCacheKey, defaultIconUrl, faviconApiUrl,
        resolveBookmarkIcon, refreshIconCache, cachedIconOnly, ensureCachedIcon, iconRecordStale,
    })`,
    { URL, chrome: chromeStub, btoa, console }
);

// 1. Ключ кэша — origin: схема и порт различают сайты
assert.equal(api.iconCacheKey('https://github.com/user/repo?x=1'), 'https://github.com');
assert.equal(api.iconCacheKey('http://intranet.local:8080/app'), 'http://intranet.local:8080');
assert.equal(api.iconCacheKey('https://intranet.local:8080/'), 'https://intranet.local:8080');
assert.notEqual(api.iconCacheKey('http://portal.local'), api.iconCacheKey('https://portal.local'));
assert.equal(api.iconCacheKey('ftp://files.local'), '', 'не http(s) — без кэша');
assert.equal(api.iconCacheKey('не-адрес'), '', 'битый адрес — без кэша');

// 2. Адрес по умолчанию сохраняет схему (важно для http-порталов)
assert.equal(api.defaultIconUrl('https://github.com/a'), 'https://github.com/favicon.ico');
assert.equal(api.defaultIconUrl('http://portal.local/app'), 'http://portal.local/favicon.ico');
assert.equal(api.defaultIconUrl('https://portal.local:8443/'), 'https://portal.local:8443/favicon.ico');
assert.equal(api.defaultIconUrl('не-адрес'), api.FALLBACK_ICON);

// 3. Заглушка — нейтральный глобус, а не знак вопроса
assert.ok(api.FALLBACK_ICON.startsWith('data:image/svg'), 'заглушка — svg');
assert.ok(!api.FALLBACK_ICON.includes('%3F'), 'в заглушке нет знака вопроса');
assert.ok(api.FALLBACK_ICON.includes('circle'), 'заглушка — контурный глобус');

// 4. Адрес favicon-кэша браузера
const faviconUrl = api.faviconApiUrl('http://portal.local/app');
assert.ok(faviconUrl.includes('/_favicon/'), 'используется favicon-кэш браузера');
assert.ok(faviconUrl.includes(encodeURIComponent('http://portal.local/app')), 'адрес страницы закодирован');
assert.ok(faviconUrl.includes('size=32'), 'размер иконки задан');

// 5. Кэш отдаётся первым и не требует сети
const cachedRecord = { key: 'https://github.com', dataUrl: 'data:image/png;base64,AAA', updatedAt: Date.now() };
let fetchCalls = 0;
const cacheHit = await api.resolveBookmarkIcon(
    { url: 'https://github.com', icon: 'https://github.com/favicon.ico' },
    { get: async () => cachedRecord, fetchFavicon: async () => { fetchCalls += 1; return ''; } }
);
assert.equal(cacheHit.src, cachedRecord.dataUrl, 'из кэша берётся сохранённая иконка');
assert.equal(cacheHit.cached, true);
assert.equal(cacheHit.stale, false, 'свежая запись не устарела');
assert.equal(fetchCalls, 0, 'при попадании в кэш сеть не трогается');

// 6. Устаревшая запись тоже отдаётся (и помечается stale)
const oldRecord = { ...cachedRecord, updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 };
const staleHit = await api.resolveBookmarkIcon(
    { url: 'https://github.com' },
    { get: async () => oldRecord, fetchFavicon: async () => '' }
);
assert.equal(staleHit.src, cachedRecord.dataUrl, 'устаревшая иконка не теряется');
assert.equal(staleHit.stale, true, 'запись помечена устаревшей для фонового обновления');
assert.equal(api.iconRecordStale(oldRecord), true);

// 7. Промах кэша: иконка берётся из favicon браузера и сохраняется
const saved = [];
const missResolved = await api.resolveBookmarkIcon(
    { url: 'http://portal.local/app' },
    {
        get: async () => null,
        put: async (record) => { saved.push(record); },
        fetchFavicon: async () => 'data:image/png;base64,BBB',
    }
);
assert.equal(missResolved.src, 'data:image/png;base64,BBB');
assert.equal(saved.length, 1, 'полученная иконка сохранена');
assert.equal(saved[0].key, 'http://portal.local', 'ключ — origin страницы');

// 8. Сайт недоступен: своя ссылка, затем ссылка по умолчанию
const explicit = await api.resolveBookmarkIcon(
    { url: 'https://a.local', icon: 'https://cdn.local/i.png' },
    { get: async () => null, put: async () => {}, fetchFavicon: async () => '' }
);
assert.equal(explicit.src, 'https://cdn.local/i.png', 'без кэша берётся своя ссылка');

const fallbackUrl = await api.resolveBookmarkIcon(
    { url: 'http://portal.local/app' },
    { get: async () => null, put: async () => {}, fetchFavicon: async () => '' }
);
assert.equal(fallbackUrl.src, 'http://portal.local/favicon.ico', 'последняя попытка — favicon по своему адресу');

const placeholder = await api.resolveBookmarkIcon(
    { url: 'не-адрес' },
    { get: async () => null, put: async () => {}, fetchFavicon: async () => '' }
);
assert.equal(placeholder.src, api.FALLBACK_ICON, 'без адреса — заглушка');

// 9. Неудачное обновление не стирает кэш
const putCalls = [];
const refreshFailed = await api.refreshIconCache('https://github.com', {
    put: async (record) => { putCalls.push(record); },
    fetchFavicon: async () => '',
});
assert.equal(refreshFailed, false, 'оффлайн — обновления нет');
assert.equal(putCalls.length, 0, 'старая иконка не перезаписана');

const refreshOk = await api.refreshIconCache('https://github.com', {
    put: async (record) => { putCalls.push(record); },
    fetchFavicon: async () => 'data:image/png;base64,CCC',
});
assert.equal(refreshOk, true);
assert.equal(putCalls.length, 1, 'успешное обновление сохраняется');
assert.equal(putCalls[0].dataUrl, 'data:image/png;base64,CCC');

// 10. Для списков читается только кэш
assert.equal(
    await api.cachedIconOnly('https://github.com', { get: async () => cachedRecord }),
    cachedRecord.dataUrl
);
assert.equal(await api.cachedIconOnly('https://github.com', { get: async () => null }), '');

// 11. Догрев кэша: пустой кэш заполняется, попадание сеть не трогает
let warmFetches = 0;
let warmStore = null;
const warmed = await api.ensureCachedIcon('https://search.local/?q=%s', {
    get: async () => warmStore,
    put: async (record) => { warmStore = record; },
    fetchFavicon: async () => { warmFetches += 1; return 'data:image/png;base64,DDD'; },
});
assert.equal(warmed, 'data:image/png;base64,DDD', 'пустой кэш догревается');
assert.equal(warmFetches, 1);

let hits = 0;
const warmHit = await api.ensureCachedIcon('https://github.com', {
    get: async () => cachedRecord,
    put: async () => {},
    fetchFavicon: async () => { hits += 1; return ''; },
});
assert.equal(warmHit, cachedRecord.dataUrl);
assert.equal(hits, 0, 'при наличии кэша favicon не запрашивается');

const warmFail = await api.ensureCachedIcon('https://offline.local', {
    get: async () => null,
    put: async () => {},
    fetchFavicon: async () => '',
});
assert.equal(warmFail, '', 'без сети и кэша — пусто, без исключения');

console.log('icons.test.mjs: все проверки пройдены');
