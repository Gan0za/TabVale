// Инвариант сплита: единый список скриптов в трёх местах.
// Запуск: node .opencoder/tests/script-order.test.mjs
//
// После разделения app.js на файлы список рантайм-скриптов существует в
// трёх копиях: порядок <script> в newtab/index.html, SCRIPT_FILES в
// _source.mjs (харнесс тестов) и упаковка package.sh (каталог newtab
// целиком — проверяем, что все файлы списка лежат в newtab/).
// Тест ловит расхождение: забытый <script> в HTML или файл, не попавший
// в харнесс, — то, что vm-тесты и браузер расходятся молча.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRoot, SCRIPT_FILES } from './_source.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- index.html: теги <script> в порядке появления ---
const html = fs.readFileSync(path.join(projectRoot, 'newtab', 'index.html'), 'utf8');
// Пути в index.html относительны newtab/ — нормализуем к виду харнесса
const htmlScripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
    .map((m) => 'newtab/' + m[1].replace(/^\.\//, ''));

assert.ok(htmlScripts.length >= 2, 'в index.html больше одного скрипта (сплит выполнен)');
assert.deepEqual(
    htmlScripts,
    SCRIPT_FILES,
    'порядок <script> в index.html совпадает со SCRIPT_FILES харнесса'
);

// --- все файлы списка существуют и лежат в newtab/ (для package.sh) ---
for (const file of SCRIPT_FILES) {
    assert.ok(file.startsWith('newtab/'), `${file} лежит в newtab/ (zip кладёт каталог целиком)`);
    assert.ok(fs.existsSync(path.join(projectRoot, file)), `${file} существует`);
}

// --- app.js остаётся последним: он bootstrap (DOMContentLoaded) ---
assert.equal(SCRIPT_FILES[SCRIPT_FILES.length - 1], 'newtab/app.js',
    'app.js (bootstrap) загружается последним');

console.log('script-order.test.mjs: все проверки пройдены');
