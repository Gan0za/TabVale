// Манифест плагина: валидация, нормализация, зажим зон и сетевой allowlist.
// Запуск: node tests/plugins.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const source = [
    fs.readFileSync(path.join(projectRoot, 'newtab', 'core', 'storage.js'), 'utf8'),
    fs.readFileSync(path.join(projectRoot, 'newtab', 'core', 'plugins.js'), 'utf8'),
].join('\n');

const api = vm.runInNewContext(
    source + `\n;({ validatePluginManifest, clampPlacement, pluginAllowsUrl, isValidPluginId, parsePluginPackage })`,
    { URL, console }
);

const validManifest = {
    schema: 1,
    id: 'com.example.clock',
    name: 'Clock',
    version: '1.0.0',
    apiVersion: 1,
    entry: 'plugin.js',
    icon: 'icon.svg',
    description: 'A clock widget',
    permissions: {
        network: ['https://api.open-meteo.com/*'],
        capabilities: ['bookmarks.read'],
        storageKB: 64,
    },
    surfaces: {
        tiles: { span: [1, 2] },
        strip: { positions: ['top'], height: [64, 120] },
        panel: { sides: ['right'], width: [320, 560], height: [240, 900], mode: ['overlay'] },
        rail: { positions: ['top'] },
    },
    locales: { ru: { name: 'Часы', description: 'Виджет часов' } },
};

// 1. Корректный манифест проходит и нормализуется
const good = api.validatePluginManifest(validManifest);
assert.equal(good.ok, true, good.errors.join('; '));
assert.equal(good.manifest.id, 'com.example.clock');
assert.deepEqual(Array.from(good.manifest.permissions.network), ['https://api.open-meteo.com/*']);
assert.deepEqual(Array.from(good.manifest.permissions.capabilities), ['bookmarks.read']);
assert.deepEqual(Array.from(good.manifest.surfaces.panel.sides), ['right']);
assert.equal(good.manifest.locales.ru.name, 'Часы');

const withStripDefault = api.validatePluginManifest({
    ...validManifest,
    surfaces: {
        ...validManifest.surfaces,
        strip: { positions: ['top'], height: [64, 120], default: true },
    },
});
assert.equal(withStripDefault.ok, true, withStripDefault.errors.join('; '));
assert.equal(withStripDefault.manifest.surfaces.strip.default, true, 'strip.default сохраняется');

// 2. Неверные поля отбрасываются с ошибками
const badCases = [
    [{ ...validManifest, id: 'Clock' }, 'id'],
    [{ ...validManifest, version: '1.0' }, 'version'],
    [{ ...validManifest, apiVersion: 2 }, 'apiVersion'],
    [{ ...validManifest, entry: '../plugin.js' }, 'entry'],
    [{ ...validManifest, surfaces: {} }, 'surface'],
    [{ ...validManifest, permissions: { ...validManifest.permissions, network: ['http://x.com/*'] } }, 'network'],
    [{ ...validManifest, permissions: { ...validManifest.permissions, capabilities: ['tabs.read'] } }, 'capability'],
    [{ ...validManifest, permissions: { ...validManifest.permissions, storageKB: 0 } }, 'storageKB'],
];
for (const [manifest, label] of badCases) {
    const result = api.validatePluginManifest(manifest);
    assert.equal(result.ok, false, `${label}: манифест должен быть отклонён`);
    assert.ok(result.errors.length > 0, `${label}: есть текст ошибки`);
}

// 3. Зоны зажимаются в диапазоны манифеста
const panel = api.clampPlacement(good.manifest, {
    surface: 'panel', side: 'left', width: 5000, height: 100, mode: 'push',
});
assert.equal(panel.side, 'right', 'недоступная сторона заменена');
assert.equal(panel.width, 560, 'ширина зажата максимумом манифеста');
assert.equal(panel.height, 240, 'высота зажата минимумом');
assert.equal(panel.mode, 'overlay', 'недоступный режим заменён');

const strip = api.clampPlacement(good.manifest, { surface: 'strip', position: 'bottom', height: 300 });
assert.equal(strip.position, 'top');
assert.equal(strip.height, 120);

const tiles = api.clampPlacement(good.manifest, { surface: 'tiles', span: 5 });
assert.equal(tiles.span, 2);

assert.equal(api.clampPlacement(good.manifest, { surface: 'floating' }), null, 'неразрешённая поверхность');

// 4. Сетевой allowlist: только https, свой хост, путь и порт
assert.equal(api.pluginAllowsUrl(good.manifest, 'https://api.open-meteo.com/v1/forecast'), true);
assert.equal(api.pluginAllowsUrl(good.manifest, 'http://api.open-meteo.com/v1/forecast'), false);
assert.equal(api.pluginAllowsUrl(good.manifest, 'https://evil.example/v1/forecast'), false);
assert.equal(api.pluginAllowsUrl(good.manifest, 'https://api.open-meteo.com.evil.example/v1'), false);

const wildcard = api.validatePluginManifest({
    ...validManifest,
    permissions: { ...validManifest.permissions, network: ['https://*.example.com/api/*'] },
}).manifest;
assert.equal(api.pluginAllowsUrl(wildcard, 'https://a.example.com/api/x'), true);
assert.equal(api.pluginAllowsUrl(wildcard, 'https://example.com/api/x'), false);
assert.equal(api.pluginAllowsUrl(wildcard, 'https://a.example.com/other'), false);

// 5. id — обратный домен
assert.equal(api.isValidPluginId('com.example.clock'), true);
assert.equal(api.isValidPluginId('clock'), false);
assert.equal(api.isValidPluginId('Com.Example.Clock'), false);
assert.equal(api.isValidPluginId('com..clock'), false);

// 6. Пакет установки: JSON с манифестом и кодом
const packageJson = JSON.stringify({ manifest: validManifest, code: 'function mount() {}' });
const parsedPackage = api.parsePluginPackage(packageJson);
assert.equal(parsedPackage.ok, true, parsedPackage.errors.join('; '));
assert.equal(parsedPackage.manifest.id, 'com.example.clock');
assert.ok(parsedPackage.code.includes('mount'));

assert.equal(api.parsePluginPackage('{').ok, false, 'битый JSON отклонён');
assert.equal(api.parsePluginPackage(JSON.stringify({ manifest: validManifest })).ok, false, 'без кода отклонён');
assert.deepEqual(Array.from(api.parsePluginPackage(JSON.stringify(validManifest)).errors), ['manifest-only'], 'сырой манифест распознан отдельно');
assert.equal(api.parsePluginPackage(JSON.stringify({ manifest: { ...validManifest, id: 'bad' }, code: 'x' })).ok, false, 'плохой манифест отклонён');

console.log('plugins.test.mjs: все проверки пройдены');
