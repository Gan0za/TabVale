// Sandbox-оболочка: манифест, CSP, файлы и упаковка.
// Запуск: node tests/sandbox.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const manifest = JSON.parse(read('manifest.json'));
const sandboxCsp = manifest.content_security_policy?.sandbox || '';

// 1. страница объявлена и CSP разрешает только исполнение внутри sandbox
assert.deepEqual(manifest.sandbox?.pages, ['sandbox/plugin-host.html']);
assert.ok(sandboxCsp.includes('sandbox allow-scripts'), 'CSP начинается с sandbox allow-scripts');
assert.ok(sandboxCsp.includes("'unsafe-eval'"), 'sandbox разрешает new Function');
assert.ok(sandboxCsp.includes("connect-src 'none'"), 'прямая сеть из sandbox запрещена');

// 2. файлы оболочки существуют и связаны
assert.ok(fs.existsSync(path.join(root, 'sandbox', 'plugin-host.html')));
assert.ok(fs.existsSync(path.join(root, 'sandbox', 'plugin-host.js')));
const html = read('sandbox/plugin-host.html');
assert.ok(html.includes('<script src="plugin-host.js"></script>'), 'HTML загружает оболочку');

// 3. оболочка не использует chrome.* и проверяет отправителя
const host = read('sandbox/plugin-host.js');
assert.equal(/\bchrome\.(storage|runtime|tabs|bookmarks)/.test(host), false, 'sandbox не обращается к chrome.*');
assert.ok(host.includes('event.source !== parent'), 'сообщения принимаются только от родителя');
assert.ok(host.includes('new Function'), 'код плагина исполняется через new Function');
assert.ok(host.includes("type: 'tabvale:rpc'"), 'есть RPC-протокол к хосту');

// 4. пакет включает sandbox и в bash-, и в PowerShell-сборке
const packageSh = read('package.sh');
assert.ok(/^\s*sandbox$/m.test(packageSh), 'package.sh кладёт sandbox в архив');
const packagePs1 = read('package.ps1');
assert.ok(packagePs1.includes("'sandbox'"), 'package.ps1 кладёт sandbox в архив');
assert.ok(packagePs1.includes('sandbox/plugin-host.html'), 'проверка архива ждёт sandbox-страницу');

console.log('sandbox.test.mjs: все проверки пройдены');
