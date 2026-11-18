// Каталог плагинов для сайта: собранные .tvp читаются установщиком.
// Запуск: node tests/plugin-catalog.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const source = [
    fs.readFileSync(path.join(root, 'newtab', 'core', 'storage.js'), 'utf8'),
    fs.readFileSync(path.join(root, 'newtab', 'core', 'plugins.js'), 'utf8'),
].join('\n');

const { parsePluginArchive } = vm.runInNewContext(
    source + '\n;({ parsePluginArchive })',
    { URL, console, TextDecoder, Blob, Response, DecompressionStream, btoa }
);

const catalogFile = path.join(root, 'docs', 'plugins', 'catalog.json');
assert.ok(fs.existsSync(catalogFile), 'каталог собран: docs/plugins/catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(root, 'plugins', 'index.json'), 'utf8'));

assert.equal(catalog.length, index.length, 'в каталоге все плагины из реестра');

for (const entry of catalog) {
    const file = path.join(root, 'docs', 'plugins', entry.file);
    assert.ok(fs.existsSync(file), `${entry.file} существует`);

    const bytes = fs.readFileSync(file);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const parsed = await parsePluginArchive(buffer);
    assert.equal(parsed.ok, true, `${entry.file} читается установщиком: ${parsed.errors.join('; ')}`);
    assert.equal(parsed.manifest.id, entry.id, `${entry.file}: id совпадает`);
    assert.equal(parsed.manifest.version, entry.version, `${entry.file}: версия совпадает`);
    assert.ok(parsed.code.trim().length > 0, `${entry.file}: код внутри`);
    assert.ok(parsed.icon.startsWith('data:image/'), `${entry.file}: иконка внутри`);

    // У часов английское имя базовое и в локалях не дублируется.
    assert.ok(entry.locales?.ru?.name, `${entry.id}: русское имя для каталога`);
    assert.equal(typeof entry.description, 'string', `${entry.id}: описание для каталога`);
}

console.log('plugin-catalog.test.mjs: все проверки пройдены');
