// Тест всплывающих селекторов (тема/язык/поисковик) и их стилей.
// Запуск: node tests/popovers.test.mjs
//
// Регрессия: пункты селекторов «Общих» настроек — кнопки, и без сброса
// браузерных стилей они выпирали из рамок меню; клик по одной кнопке не
// закрывал чужие селекторы (stopPropagation не доходит до document),
// из-за чего меню перекрывали друг друга.
//
// Проверяем:
//   1. Все переключатели вызывают closeAllPopovers перед открытием
//   2. closeAllPopovers разделяет механизмы: FAB-меню -> hidden,
//      dropdown-меню -> снятие open (mixing ломает открытие: display:none
//      !important перебивает .open)
//   3. buildLanguageMenu закрывает hidden только FAB-меню (класс theme-menu)
//   4. CSS: у .dropdown-item сброшены браузерные стили кнопки
//   5. Флаги — картинки 3:2, иконки поисковика остались квадратными

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
import { SOURCE as js } from './_source.mjs';
const css = fs.readFileSync(path.join(projectRoot, 'newtab', 'styles.css'), 'utf8');

// --- 1. Все переключатели поповеров закрывают чужие меню ---
const toggles = [
    ['themeToggle', "closeAllPopovers(themeMenu)"],
    ['themeGeneralButton', 'closeAllPopovers(themeGeneralList)'],
    ['languageToggle', 'closeAllPopovers(languageMenu)'],
    ['languageButton', 'closeAllPopovers(languageList)'],
    ['searchEngineDropdownBtn', 'closeAllPopovers(searchEngineList)'],
];
for (const [name, call] of toggles) {
    assert.ok(js.includes(call), `${name}: обработчик закрывает чужие поповеры`);
}

// --- 2. Механизмы видимости не смешиваются ---
// FAB-меню скрываются через hidden, dropdown'ы — через снятие open.
// Если closeAllPopovers добавляет hidden dropdown'у, тот навсегда закрыт.
const fnMatch = js.match(/function closeAllPopovers\(except\) \{[\s\S]*?\r?\n\}/);
assert.ok(fnMatch, 'closeAllPopovers объявлена');
const fn = fnMatch[0];
assert.ok(fn.includes("menu.classList.add('hidden')"), 'FAB-меню закрываются hidden');
assert.ok(fn.includes("menu.classList.remove('open')"), 'dropdown-меню закрываются снятием open');
// В закрытии dropdown'ов не должно быть add('hidden')
const openLoopStart = fn.indexOf('[themeGeneralList');
assert.ok(openLoopStart !== -1, 'closeAllPopovers: найден цикл закрытия dropdown-меню');
const openLoop = fn.slice(openLoopStart, openLoopStart + 250);
assert.ok(!openLoop.includes("add('hidden')"),
    'dropdown-меням hidden не добавляется — иначе .open перестаёт работать');

// --- 3. buildLanguageMenu: hidden только для FAB-меню (theme-menu) ---
// \r? — файлы с CRLF: без этого закрывающая скобка функции не находится
const builderMatch = js.match(/function buildLanguageMenu[\s\S]*?\r?\n\}\r?\n/);
assert.ok(builderMatch, 'buildLanguageMenu объявлена');
const builder = builderMatch[0];
assert.ok(builder.includes("contains('theme-menu')"),
    'hidden добавляется только меню с классом theme-menu (FAB), не dropdown в модалке');
// Порядок важен: сначала remove('open'), затем условный add('hidden')
assert.ok(builder.indexOf("remove('open')") < builder.indexOf("add('hidden')"),
    'сначала снимается open, потом условно ставится hidden');

// --- 4. CSS: сброс браузерных стилей кнопок-пунктов ---
const itemBlock = css.match(/\.dropdown-item \{[\s\S]*?\}/);
assert.ok(itemBlock, 'блок .dropdown-item найден');
const itemCss = itemBlock[0];
for (const decl of ['border: none', 'background: transparent', 'font-family: inherit', 'text-align: left']) {
    assert.ok(itemCss.includes(decl), `.dropdown-item: ${decl} (сброс стилей кнопки)`);
}

// --- 5. Флаги 3:2 в пунктах и на кнопке, favicon поисковика не тронут ---
// Базовое правило для пунктов — квадрат 20x20 (круглые логотипы
// поисковиков не обрезаются), флаг переопределяется классом flag-icon
const itemImg = css.match(/\.dropdown-item img \{[\s\S]*?\}/);
assert.ok(itemImg && itemImg[0].includes('width: 20px') && itemImg[0].includes('height: 20px'),
    'иконка в пунктах меню — квадрат 20x20, без обрезки');
const itemFlag = css.match(/\.dropdown-item img\.flag-icon \{[\s\S]*?\}/);
assert.ok(itemFlag && itemFlag[0].includes('height: 14px') && itemFlag[0].includes('object-fit: cover'),
    'флаг в пунктах меню — 20x14 (3:2)');
const buttonFlag = css.match(/\.dropdown-button \.flag-icon \{[\s\S]*?\}/);
assert.ok(buttonFlag && buttonFlag[0].includes('height: 14px'),
    'флаг на кнопке селектора — 20x14');
// Общее правило для иконок кнопки не сплющивает favicon поисковика:
// оно должно задавать 20x20 (квадрат), а флаг переопределяется классом
const btnImg = css.match(/\.dropdown-button img \{[\s\S]*?\}/);
assert.ok(btnImg && btnImg[0].includes('width: 20px') && btnImg[0].includes('height: 20px'),
    'favicon поисковика на кнопке — квадрат 20x20');

// --- 5. SVG-флаги существуют и лежат по путям из LANGUAGES ---
for (const m of js.matchAll(/flag: '([^']+)'/g)) {
    const flagPath = path.join(projectRoot, m[1].replace(/\//g, path.sep));
    assert.ok(fs.existsSync(flagPath), `файл флага существует: ${m[1]}`);
}

console.log('popovers.test.mjs: все проверки пройдены');
