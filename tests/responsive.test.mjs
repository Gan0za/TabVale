// Тест адаптивной вёрстки: media-запросы для планшетов, вертикальных
// экранов и телефонов.
// Запуск: node tests/responsive.test.mjs
//
// Проверяем, что каждый формат получает свои правила и что все
// media-запросы собраны в конце styles.css (после базовых).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const css = fs.readFileSync(path.join(projectRoot, 'newtab', 'styles.css'), 'utf8');

// --- Media-запросы существуют и покрывают форматы ---
const breakpoints = [1024, 768, 600, 420];
for (const bp of breakpoints) {
    assert.ok(css.includes(`(max-width: ${bp}px)`), `есть media-запрос max-width: ${bp}px`);
}
assert.ok(css.includes('(max-height: 480px)'), 'есть запрос низкого ландшафта');
assert.ok(css.includes('orientation: landscape'), 'ландшафтный запрос использует orientation');

// --- Все media-правила стоят в конце файла (адаптивный блок) ---
const lastMediaPos = css.lastIndexOf('@media');
const desktopPos = css.indexOf('.context-menu');
assert.ok(lastMediaPos > desktopPos, 'media-запросы не перебивают десктоп в середине файла');

// --- Планшет <= 1024: панель прижата к краям, модалка шире ---
const tablet = css.match(/@media \(max-width: 1024px\) \{[\s\S]*?\n\}/);
assert.ok(tablet, 'блок планшета найден');
assert.ok(tablet[0].includes('max-width: none'), 'панель растягивается на узком десктопе');

// --- Вертикальный планшет: компактные плитки и кнопки ---
const portrait = css.match(/@media \(max-width: 768px\) \{[\s\S]*?\n\}/);
assert.ok(portrait, 'блок вертикального планшета найден');
assert.ok(portrait[0].includes('width: 112px'), 'плитки уже на планшете');
assert.ok(portrait[0].includes('right: 12px'), 'колонка кнопок прижата к краю');

// --- Мобильный: поиск колонкой, модалка fullscreen ---
const mobile = css.match(/@media \(max-width: 600px\) \{[\s\S]*?\n\}/);
assert.ok(mobile, 'блок мобильного найден');
assert.ok(mobile[0].includes('flex-wrap: wrap'), 'поисковая строка переносится');
assert.ok(mobile[0].includes('flex-basis: 100%'), 'поле поиска на всю строку');
assert.ok(mobile[0].includes('width: 100vw') && mobile[0].includes('height: 100vh'),
    'модалка настроек разворачивается на весь экран');
assert.ok(mobile[0].includes('font-size: 16px'), 'поле поиска не зумится iOS');

// --- Маленький телефон: тапабельные кнопки списков ---
const small = css.match(/@media \(max-width: 420px\) \{[\s\S]*?\n\}/);
assert.ok(small, 'блок маленького телефона найден');
assert.ok(small[0].includes('width: 96px'), 'плитки компактнее на маленьких экранах');
assert.ok(/padding:\s*8px 12px/.test(small[0]), 'кнопки списков тапабельны');

console.log('responsive.test.mjs: все проверки пройдены');
