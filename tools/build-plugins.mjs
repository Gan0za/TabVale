// Сборка каталога плагинов для сайта: каждый плагин из plugins/index.json
// упаковывается в .tvp (zip с manifest.json, кодом и иконкой), рядом
// кладётся catalog.json с локализованными именами для страницы плагинов.
//
// Запуск: node tools/build-plugins.mjs
// Результат: docs/plugins/<id>.tvp и docs/plugins/catalog.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildZip } from './zip.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginsRoot = path.join(root, 'plugins');
const outDir = path.join(root, 'docs', 'plugins');

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
