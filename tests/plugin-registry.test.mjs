// Реестр плагинов: индекс, встроенный пакет и его манифест.
// Запуск: node tests/plugin-registry.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const source = ['newtab/core/plugins.js', 'newtab/core/plugin-registry.js'].map(read).join('\n');
const api = vm.runInNewContext(
    source + '\n;({ normalizePluginRegistry, normalizeRegistryEntry, validatePluginManifest, isValidPluginId })',
    { URL, console }
);

// 1. Индекс: корректные записи проходят, битые и дубли отбрасываются
const registry = api.normalizePluginRegistry([
    { id: 'com.example.clock', version: '1.0.0', path: 'com.example.clock/' },
    { id: 'com.example.clock', version: '2.0.0', path: 'com.example.clock/' },
    { id: 'com.example.bad', version: '1.0.0', path: '../escape/' },
    { id: 'com.example.bad2', version: '1.0', path: 'bad2/' },
    null,
]);
assert.equal(registry.length, 1, 'осталась одна уникальная корректная запись');
assert.equal(registry[0].id, 'com.example.clock');

assert.equal(api.normalizeRegistryEntry({ id: 'x', version: '1.0.0', path: 'x/' }), null, 'id без домена');
assert.equal(api.normalizeRegistryEntry({ id: 'com.x', version: '1.0.0', path: '/abs/' }), null, 'абсолютный путь');
assert.ok(api.normalizeRegistryEntry({ id: 'com.x', version: '1.0.0', path: 'com.x/' }));

// 2. Встроенный пакет: индекс, манифест, код и иконка согласованы
const builtinIndex = JSON.parse(read('plugins/index.json'));
const builtins = api.normalizePluginRegistry(builtinIndex);
assert.ok(builtins.length >= 1, 'в индексе есть встроенные плагины');

for (const entry of builtins) {
    const dir = path.join(root, 'plugins', entry.path);
    const manifestRaw = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    const result = api.validatePluginManifest(manifestRaw);
    assert.equal(result.ok, true, `${entry.id}: ${result.errors.join('; ')}`);
    assert.equal(result.manifest.id, entry.id, 'id манифеста совпадает с индексом');
    assert.equal(result.manifest.version, entry.version, 'версия совпадает с индексом');
    assert.ok(fs.existsSync(path.join(dir, result.manifest.entry)), 'код плагина существует');
    assert.ok(fs.existsSync(path.join(dir, result.manifest.icon)), 'иконка существует');
    const code = fs.readFileSync(path.join(dir, result.manifest.entry), 'utf8');
    assert.ok(/function mount\s*\(/.test(code), 'плагин экспортирует mount(api, config)');
}

console.log('plugin-registry.test.mjs: все проверки пройдены');
