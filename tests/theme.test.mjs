// Тест связки переключателя темы: index.html <-> app.js <-> styles.css.
// Запуск: node .opencoder/tests/theme.test.mjs
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

// --- Мини-меню темы на главной странице обрабатывает клики по пунктам ---
// Регрессия: при переделке селектора в «Общих» обработчик клика по
// пунктам FAB-меню (#theme-menu) был потерян — меню открывалось, но
// выбор Авто/Светлая/Тёмная не работал
assert.ok(
    /themeMenu\??\.addEventListener\('click'[\s\S]*?dataset\.mode[\s\S]*?applyTheme\(/.test(js),
    'app.js: клик по пункту FAB-меню темы читает data-mode и применяет тему'
);

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

// --- Селектор положения картинки: непрозрачный фон в обеих темах ---
// Регрессия: полупрозрачное стекло на <select> заставляет Chromium рисовать
// нативный попап на белой подложке — на тёмной теме текст нечитаем
assert.ok(css.includes('--surface:'), 'в design system есть плотный цвет поверхности');
assert.ok((css.match(/--surface:/g) || []).length >= 2,
    '--surface задан и в светлой, и в тёмной теме');
const posSelectBlock = css.match(/\.bg-position-row select\s*\{[\s\S]*?\}/);
assert.ok(posSelectBlock, 'стили селектора положения найдены');
assert.ok(posSelectBlock[0].includes('background-color: var(--surface)'),
    'селектор положения использует непрозрачный --surface');
assert.ok(css.includes('.bg-position-row select option'),
    'пункты <option> стилизованы явно — попап не остаётся белым');

// --- Контекстное меню адаптивно: ширина по содержимому, а не фиксированная ---
const cm = css.match(/\.context-menu\s*\{[^}]*\}/);
assert.ok(cm && !/(?<![-a-z])width:\s*\d/.test(cm[0]), 'нет жёсткой ширины меню');
assert.ok(cm && cm[0].includes('min-width: 180px') && cm[0].includes('max-width: 280px'),
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
