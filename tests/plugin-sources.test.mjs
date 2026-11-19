// Стандарт исходников плагинов: sandbox-API вместо chrome.*, аккуратные
// ключи хранилища, обязательный mount(api). Запуск: node tests/plugin-sources.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pluginsRoot = path.join(root, 'plugins');
const dirs = fs.readdirSync(pluginsRoot).filter((name) => name.startsWith('com.tabvale.'));
const index = JSON.parse(fs.readFileSync(path.join(pluginsRoot, 'index.json'), 'utf8'));

assert.ok(dirs.length >= 11, `в проекте не меньше одиннадцати плагинов (${dirs.length})`);
assert.equal(index.length, dirs.length, 'реестр перечисляет все плагины');

const STORAGE_KEY = /^[A-Za-z0-9._-]{1,64}$/;

for (const dir of dirs) {
    const manifest = JSON.parse(fs.readFileSync(path.join(pluginsRoot, dir, 'manifest.json'), 'utf8'));
    const code = fs.readFileSync(path.join(pluginsRoot, dir, manifest.entry), 'utf8');

    assert.equal(manifest.id, dir, `${dir}: id совпадает с папкой`);
    assert.ok(/function\s+mount\s*\(\s*api\s*\)/.test(code), `${dir}: есть mount(api)`);
    assert.ok(!/\bchrome\./.test(code), `${dir}: код не трогает chrome.* напрямую`);
    assert.ok(!/\blocalStorage\b|\bindexedDB\b/.test(code), `${dir}: нет прямого доступа к хранилищу браузера`);

    assert.ok(manifest.icon, `${dir}: манифест объявляет иконку`);
    assert.ok(fs.existsSync(path.join(pluginsRoot, dir, manifest.icon)), `${dir}: файл иконки существует`);
    assert.ok(fs.existsSync(path.join(root, 'docs', 'plugins', `${manifest.id}.tvp`)), `${dir}: пакет собран`);

    for (const match of code.matchAll(/api\.storage\.(?:get|set|remove)\(\s*'([^']*)'/g)) {
        assert.match(match[1], STORAGE_KEY, `${dir}: ключ хранилища «${match[1]}» корректен`);
    }

    const registry = index.find((entry) => entry.id === manifest.id);
    assert.ok(registry, `${dir}: есть в реестре`);
    assert.equal(registry.version, manifest.version, `${dir}: версия совпадает с реестром`);
}

console.log('plugin-sources.test.mjs: все проверки пройдены');
