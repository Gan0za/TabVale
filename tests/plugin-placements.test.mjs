// Размещения плагинов: нормализация, замена и стартовые strip-слоты.
// Запуск: node tests/plugin-placements.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'newtab', 'core', 'plugin-placements.js'), 'utf8');
const api = vm.runInNewContext(
    code + `\n;({ normalizePluginPlacement, normalizePluginPlacements, placementFor, withPlacement, defaultPluginPlacements, ensureDefaultPlacement })`,
    {}
);

// 1. Strip: позиция, высота и порядок нормализуются
const strip = api.normalizePluginPlacement({
    pluginId: 'com.example.clock', surface: 'strip', position: 'bottom', height: 999, order: 4,
});
assert.equal(strip.position, 'bottom');
assert.equal(strip.height, 200, 'высота зажата максимумом');
assert.equal(strip.order, 4);

const defaulted = api.normalizePluginPlacement({ pluginId: 'com.example.clock', surface: 'strip' });
assert.equal(defaulted.position, 'top');
assert.equal(defaulted.height, 88, 'высота по умолчанию');

// 2. Неверные записи отбрасываются, дубли — тоже
const list = api.normalizePluginPlacements([
    { pluginId: 'com.a', surface: 'strip' },
    { pluginId: 'com.a', surface: 'panel' },
    { pluginId: 'com.b', surface: 'nowhere' },
    { surface: 'strip' },
    null,
]);
assert.equal(list.length, 1, 'осталась одна уникальная запись');
assert.equal(list[0].pluginId, 'com.a');
assert.equal(api.normalizePluginPlacement({ pluginId: 'com.a', surface: 'off' }).surface, 'off');
assert.equal(api.normalizePluginPlacement({ pluginId: 'com.a', surface: 'tiles' }).surface, 'tiles');

// 2.5. Плавающее окно хранит позицию и размер в допустимых пределах
const floating = api.normalizePluginPlacement({
    pluginId: 'com.example.notes',
    surface: 'floating',
    side: 'left',
    x: -50,
    y: 120,
    width: 5000,
    height: 100,
});
assert.equal(floating.surface, 'floating');
assert.equal(floating.side, 'left');
assert.equal(floating.x, 0, 'отрицательная позиция прижата к нулю');
assert.equal(floating.y, 120, 'позиция сохраняется');
assert.equal(floating.width, 900, 'ширина зажата максимумом');
assert.equal(floating.height, 120, 'высота зажата минимумом');

const floatingDefaults = api.normalizePluginPlacement({ pluginId: 'com.example.notes', surface: 'floating' });
assert.equal(floatingDefaults.side, 'right', 'сторона по умолчанию — справа');
assert.equal('x' in floatingDefaults, false, 'позицию подставит хост');
assert.equal(api.normalizePluginPlacement({ pluginId: 'com.a', surface: 'floating', side: 'top' }).side, 'right');

// 3. placementFor и withPlacement
assert.equal(api.placementFor(list, 'com.a').pluginId, 'com.a');
assert.equal(api.placementFor(list, 'com.b'), null);

const replaced = api.withPlacement(list, { pluginId: 'com.a', surface: 'panel', side: 'left' });
assert.equal(replaced.length, 1);
assert.equal(replaced[0].surface, 'panel');
assert.equal(replaced[0].side, 'left');

// 4. Стартовые размещения: только плагины со strip, максимум три, по имени
const records = [
    { id: 'com.c', manifest: { name: 'C', surfaces: { strip: { positions: ['top'] } } } },
    { id: 'com.a', manifest: { name: 'A', surfaces: { strip: { positions: ['top'] } } } },
    { id: 'com.b', manifest: { name: 'B', surfaces: { panel: { sides: ['right'] } } } },
    { id: 'com.d', manifest: { name: 'D', surfaces: { strip: { positions: ['top'] } } } },
    { id: 'com.e', manifest: { name: 'E', surfaces: { strip: { positions: ['top'] } } } },
];
const defaults = api.defaultPluginPlacements(records);
assert.equal(defaults.length, 5, 'размещение есть у каждого плагина');
assert.deepEqual(Array.from(defaults.map((item) => item.pluginId)), ['com.a', 'com.b', 'com.c', 'com.d', 'com.e']);
assert.equal(defaults.filter((item) => item.surface === 'strip').length, 3, 'не больше трёх виджетов в полосе');
assert.equal(defaults.find((item) => item.pluginId === 'com.b').surface, 'panel');
assert.equal(defaults.find((item) => item.pluginId === 'com.e').surface, 'off');

const preferred = api.ensureDefaultPlacement({
    id: 'com.panel.strip',
    manifest: {
        name: 'Preferred',
        surfaces: {
            panel: { sides: ['right'] },
            strip: { positions: ['top'], height: [64, 120], default: true },
        },
    },
}, []);
assert.equal(preferred.surface, 'strip', 'strip.default важнее панели');

console.log('plugin-placements.test.mjs: все проверки пройдены');
