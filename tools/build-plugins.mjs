// Сборка каталога плагинов для сайта: каждый плагин из plugins/index.json
// упаковывается в .tvp (zip с manifest.json, кодом и иконкой), рядом
// кладётся catalog.json с локализованными именами для страницы плагинов.
//
// Запуск: node tools/build-plugins.mjs
// Результат: docs/plugins/<id>.tvp и docs/plugins/catalog.json

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginsRoot = path.join(root, 'plugins');
const outDir = path.join(root, 'docs', 'plugins');

const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buffer) {
    let crc = 0xFFFFFFFF;
    for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Минимальный zip: локальные заголовки, центральный каталог, EOCD. */
function buildZip(files) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const file of files) {
        const name = Buffer.from(file.name, 'utf8');
        const data = Buffer.from(file.data);
        const payload = zlib.deflateRawSync(data);
        const crc = crc32(data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6); // UTF-8 имена
        local.writeUInt16LE(8, 8);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(payload.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        localParts.push(local, name, payload);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt32LE(crc, 16);
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

    return Buffer.concat([...localParts, centralBuffer, end]);
}

const index = JSON.parse(fs.readFileSync(path.join(pluginsRoot, 'index.json'), 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const catalog = [];
for (const entry of index) {
    const dir = path.join(pluginsRoot, entry.path);
    const manifestRaw = fs.readFileSync(path.join(dir, 'manifest.json'));
    const manifest = JSON.parse(manifestRaw.toString('utf8'));
    const files = [
        { name: 'manifest.json', data: manifestRaw },
        { name: manifest.entry, data: fs.readFileSync(path.join(dir, manifest.entry)) },
    ];
    if (manifest.icon && fs.existsSync(path.join(dir, manifest.icon))) {
        files.push({ name: manifest.icon, data: fs.readFileSync(path.join(dir, manifest.icon)) });
    }

    const file = `${manifest.id}.tvp`;
    fs.writeFileSync(path.join(outDir, file), buildZip(files));

    // Иконка отдельным файлом — для карточек каталога на сайте.
    let icon = '';
    if (manifest.icon && fs.existsSync(path.join(dir, manifest.icon))) {
        icon = `${manifest.id}.svg`;
        fs.copyFileSync(path.join(dir, manifest.icon), path.join(outDir, icon));
    }

    catalog.push({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        file,
        icon,
        description: manifest.description || '',
        locales: manifest.locales || {},
    });
    console.log(`${file}: ${manifest.name} v${manifest.version}`);
}

fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(`catalog.json: ${catalog.length} plugins`);
