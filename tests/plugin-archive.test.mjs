// Пакет .tvp: разбор zip-архива плагина (manifest.json + файл кода).
// Запуск: node tests/plugin-archive.test.mjs
//
// Пакет читается без сторонних библиотек: оглавление zip и записи
// разбираются вручную, сжатые данные распаковывает DecompressionStream.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const source = [
    fs.readFileSync(path.join(projectRoot, 'newtab', 'core', 'storage.js'), 'utf8'),
    fs.readFileSync(path.join(projectRoot, 'newtab', 'core', 'plugins.js'), 'utf8'),
].join('\n');

const { parsePluginArchive, isPluginArchive } = vm.runInNewContext(
    source + '\n;({ parsePluginArchive, isPluginArchive })',
    { URL, console, TextDecoder, Blob, Response, DecompressionStream }
);

const manifest = {
    schema: 1,
    id: 'com.example.archive',
    name: 'Archive plugin',
    version: '1.0.0',
    apiVersion: 1,
    entry: 'plugin.js',
    permissions: { network: [], capabilities: [], storageKB: 32 },
    surfaces: { panel: { sides: ['right'], width: [320, 520], height: [240, 700], mode: ['overlay'] } },
};
const code = 'function mount(api) { api.ui.ready(); }\n';

/**
 * Собирает минимальный zip: локальные заголовки, оглавление и EOCD.
 * Поля CRC и времени не заполняются — разборщик их не читает.
 */
function buildZip(files) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const file of files) {
        const name = Buffer.from(file.name, 'utf8');
        const data = Buffer.from(file.data, 'utf8');
        const stored = file.store === true;
        const payload = stored ? data : zlib.deflateRawSync(data);
        const method = stored ? 0 : 8;

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(method, 8);
        local.writeUInt16LE(name.length, 26);
        localParts.push(local, name, payload);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(method, 10);
        central.writeUInt32LE(payload.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(offset, 42);
        centralParts.push(central, name);

        offset += 30 + name.length + payload.length;
    }

    const centralBuffer = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralBuffer.length, 12);
    end.writeUInt32LE(offset, 16);

    const zip = Buffer.concat([...localParts, centralBuffer, end]);
    return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength);
}

const manifestJson = JSON.stringify(manifest);
const toArrayBuffer = (buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

// 1. Сжатый пакет: manifest.json и код распаковываются
const packed = buildZip([
    { name: 'manifest.json', data: manifestJson },
    { name: 'plugin.js', data: code },
]);
assert.equal(isPluginArchive(new Uint8Array(packed)), true, 'сигнатура zip распознаётся');
const packedResult = await parsePluginArchive(packed);
assert.equal(packedResult.ok, true, 'сжатый пакет разбирается');
assert.equal(packedResult.manifest.id, 'com.example.archive', 'id из манифеста');
assert.equal(packedResult.code, code, 'код извлекается без изменений');

// 2. Данные без сжатия (method 0) тоже поддерживаются
const stored = buildZip([
    { name: 'manifest.json', data: manifestJson, store: true },
    { name: 'plugin.js', data: code, store: true },
]);
const storedResult = await parsePluginArchive(stored);
assert.equal(storedResult.ok, true, 'несжатый пакет разбирается');
assert.equal(storedResult.code, code, 'код из несжатой записи');

// 3. Общая папка внутри архива не мешает
const nested = buildZip([
    { name: 'my-plugin/manifest.json', data: manifestJson },
    { name: 'my-plugin/plugin.js', data: code },
]);
const nestedResult = await parsePluginArchive(nested);
assert.equal(nestedResult.ok, true, 'пакет с папкой внутри разбирается');
assert.equal(nestedResult.manifest.id, 'com.example.archive');

// 4. Без manifest.json пакет отклоняется
const noManifest = await parsePluginArchive(buildZip([{ name: 'plugin.js', data: code }]));
assert.equal(noManifest.ok, false);
assert.ok(noManifest.errors.includes('manifest.json is missing'), 'сообщение о пропавшем манифесте');

// 5. Без файла кода пакет отклоняется
const noCode = await parsePluginArchive(buildZip([{ name: 'manifest.json', data: manifestJson }]));
assert.equal(noCode.ok, false);
assert.ok(noCode.errors.includes('code is missing'), 'сообщение о пропавшем коде');

// 6. Битый файл и пустой буфер отклоняются
const notZip = await parsePluginArchive(toArrayBuffer(Buffer.from('{"manifest":{}}')));
assert.equal(notZip.ok, false);
assert.ok(notZip.errors.includes('invalid archive'), 'не-zip отклоняется');
assert.equal(isPluginArchive(new Uint8Array([0x50, 0x4b])), false, 'слишком короткий файл не считается zip');
assert.equal((await parsePluginArchive(new ArrayBuffer(0))).ok, false, 'пустой файл отклоняется');

// 7. Слишком большой архив отклоняется до разбора
const huge = new Uint8Array(1024 * 1024 + 8);
huge.set([0x50, 0x4b, 0x03, 0x04]);
const hugeResult = await parsePluginArchive(huge.buffer);
assert.equal(hugeResult.ok, false);
assert.ok(hugeResult.errors.includes('package is too large'), 'архив больше 1 МБ отклоняется');

console.log('plugin-archive.test.mjs: все проверки пройдены');
