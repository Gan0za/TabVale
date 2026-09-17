// Тест связки переключателя темы: index.html <-> app.js <-> styles.css.
// Запуск: node tests/theme.test.mjs
//
// Тема работает так: app.js читает режим ('auto'|'light'|'dark') из
// chrome.storage.sync, решает, тёмная ли тема сейчас, и ставит атрибут
// data-theme="dark" на <html>. CSS включает тёмные переменные по этому
// атрибуту. Тест проверяет, что все части цепочки на месте и созвучны.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(projectRoot, 'newtab', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(projectRoot, 'newtab', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(projectRoot, 'newtab', 'styles.css'), 'utf8');

// --- HTML: есть переключатель и три варианта выбора ---
assert.ok(html.includes('id="theme-toggle"'), 'кнопка переключателя темы');
assert.ok(html.includes('id="theme-menu"'), 'меню выбора темы');
for (const mode of ['auto', 'light', 'dark']) {
    assert.ok(
        html.includes(`data-mode="${mode}"`),
        `пункт меню темы: ${mode}`
    );
}

// --- app.js: логика применяет атрибут data-theme и слушает смену темы ОС ---
assert.ok(js.includes('applyTheme'), 'app.js: функция applyTheme');
assert.ok(js.includes("dataset.theme"), 'app.js ставит data-theme на <html>');
assert.ok(js.includes("matchMedia('(prefers-color-scheme: dark)')"),
    'app.js учитывает системную тему для режима auto');
assert.ok(js.includes("storageGet('theme'"), 'app.js читает режим из storage (через обёртку)');
assert.ok(js.includes("storageSet({ theme: mode })"), 'app.js сохраняет выбранный режим');
assert.ok(js.includes("addEventListener('change'"), 'app.js реагирует на смену темы ОС');

// --- Иконка кнопки меняется вместе с режимом ---
assert.ok(js.includes('THEME_ICONS'), 'app.js: таблица иконок темы');
for (const [mode, icon] of [['auto', '🌗'], ['light', '☀️'], ['dark', '🌙']]) {
    assert.ok(js.includes(`${mode}: '${icon}'`), `иконка для ${mode}: ${icon}`);
}
assert.ok(js.includes('themeToggle.textContent'), 'app.js обновляет иконку кнопки');

// --- Тема участвует в импорте/экспорте ---
assert.ok(js.includes('...currentState, theme:'), 'экспорт включает текущий режим темы');
assert.ok(js.includes("themeModes.includes(payload.theme)"),
    'импорт принимает только корректные режимы темы');

// --- CSS: тёмная тема вешается на data-theme, а не только на media query ---
assert.ok(css.includes(":root[data-theme='dark'"),
    'тёмные переменные включаются через data-theme (ручное переключение)');
assert.ok(css.includes('color-scheme: dark'), 'тёмная тема объявляет color-scheme: dark');
assert.ok(css.includes('color-scheme: light'), 'светлая тема объявляет color-scheme: light');

// --- Скроллбары оформлены ---
assert.ok(css.includes('scrollbar-width: thin'), 'тонкий скроллбар для Firefox');
assert.ok(css.includes('::-webkit-scrollbar'), 'стили скроллбара для Chromium');

// --- Контекстное меню адаптивно: ширина по содержимому, а не фиксированная ---
assert.ok(!css.includes('width: 220px'), 'нет жёсткой ширины меню');
assert.ok(css.includes('min-width: 180px') && css.includes('max-width: 280px'),
    'меню ограничено минимальной и максимальной шириной');

// --- Модалка настроек: фиксированная высота, прокрутка внутри ---
assert.ok(css.includes('width: min(92vw, 640px)'), 'модалка шире прежних 520px');
// Высота фиксирована — размер не "прыгает" при открытии форм и списков
assert.ok(css.includes('height: min(85vh, 720px)'), 'высота модалки фиксирована');
// Прокрутка lives внутри списков (modal-list), а не у всей модалки
assert.ok(css.includes('overflow: hidden'), 'модалка не прокручивается целиком');
assert.ok(/\.modal-list \{[\s\S]*?overflow-y: auto/.test(css),
    'списки внутри модалки прокручиваются');

console.log('theme.test.mjs: все проверки пройдены');
