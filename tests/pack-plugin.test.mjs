// Упаковщик сторонних плагинов: .tvp из папки читается установщиком.
// Запуск: node tests/pack-plugin.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
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

const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tabvale-pack-')), 'clock.tvp');
execFileSync(process.execPath, [
    path.join(root, 'tools', 'pack-plugin.mjs'),
    path.join(root, 'plugins', 'com.tabvale.clock'),
    out,
], { stdio: 'pipe' });

const bytes = fs.readFileSync(out);
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const parsed = await parsePluginArchive(buffer);
assert.equal(parsed.ok, true, parsed.errors.join('; '));
assert.equal(parsed.manifest.id, 'com.tabvale.clock', 'id из манифеста');
assert.ok(parsed.code.includes('mount'), 'код внутри пакета');
assert.ok(parsed.icon.startsWith('data:image/svg'), 'иконка внутри пакета');

// Папка без манифеста — понятная ошибка, а не пустой архив.
const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tabvale-pack-empty-'));
assert.throws(
    () => execFileSync(process.execPath, [path.join(root, 'tools', 'pack-plugin.mjs'), emptyDir], { stdio: 'pipe' }),
    /Command failed|status 1/,
    'упаковщик без манифеста завершается ошибкой'
);

console.log('pack-plugin.test.mjs: все проверки пройдены');
