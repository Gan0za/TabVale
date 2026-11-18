// Упаковка плагина в .tvp для установки через «Настройки → Плагины →
// Установить из файла…». Принимает папку с manifest.json, файлом кода и
// необязательной иконкой.
//
// Запуск: node tools/pack-plugin.mjs <папка-плагина> [выходной-файл.tvp]
// Без выходного файла пишет <id>.tvp в текущую папку.
//
// Требования к манифесту проверяет само расширение при установке; здесь
// только базовые проверки, чтобы не собрать заведомо битый пакет.

import fs from 'node:fs';
import path from 'node:path';
import { buildZip } from './zip.mjs';

const [dirArg, outArg] = process.argv.slice(2);
if (!dirArg) {
    console.error('Использование: node tools/pack-plugin.mjs <папка-плагина> [выходной-файл.tvp]');
    process.exit(1);
}

const dir = path.resolve(dirArg);
const manifestPath = path.join(dir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
    console.error(`Нет manifest.json в ${dir}`);
    process.exit(1);
}

const manifestRaw = fs.readFileSync(manifestPath);
let manifest;
try {
    manifest = JSON.parse(manifestRaw.toString('utf8'));
} catch (error) {
    console.error(`manifest.json не разбирается: ${error.message}`);
    process.exit(1);
}

if (typeof manifest.id !== 'string' || !/^[a-z0-9][a-z0-9._-]*\.[a-z0-9._-]+$/.test(manifest.id)) {
    console.error('manifest.id должен быть в обратном домене, например com.example.clock');
    process.exit(1);
}
if (typeof manifest.entry !== 'string' || !fs.existsSync(path.join(dir, manifest.entry))) {
    console.error(`Файл кода из manifest.entry не найден: ${manifest.entry}`);
    process.exit(1);
}

const files = [
    { name: 'manifest.json', data: manifestRaw },
    { name: manifest.entry, data: fs.readFileSync(path.join(dir, manifest.entry)) },
];

if (manifest.icon) {
    const iconPath = path.join(dir, manifest.icon);
    if (!fs.existsSync(iconPath)) {
        console.error(`Иконка из manifest.icon не найдена: ${manifest.icon}`);
        process.exit(1);
    }
    files.push({ name: manifest.icon, data: fs.readFileSync(iconPath) });
}

const out = outArg ? path.resolve(outArg) : path.join(process.cwd(), `${manifest.id}.tvp`);
const zip = buildZip(files);
fs.writeFileSync(out, zip);

if (zip.length > 1024 * 1024) {
    console.warn('Внимание: пакет больше 1 МБ — установщик его отклонит.');
}
console.log(`${out}: ${manifest.id} v${manifest.version}, ${zip.length} байт`);
