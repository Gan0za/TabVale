// Тест вёрстки без постоянного скролла: при малом числе закладок панель
// тянется ровно на экран и прокрутки нет; когда закладки доходят до низа
// экрана — появляется обычная прокрутка страницы. Строки решётки не
// растягиваются на свободную высоту, решётка не зажата внутренним скроллом.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const css = fs.readFileSync(path.join(projectRoot, 'newtab', 'styles.css'), 'utf8');

// body: минимальная высота в экран; flex-колонка не даёт margin панели
// схлопнуться наружу — из-за схлопывания страница скроллилась всегда
const bodyRule = css.match(/body\s*\{[^}]*\}/);
assert.ok(bodyRule, 'правило body существует');
assert.ok(/min-height:\s*100vh/.test(bodyRule[0]), 'body занимает не меньше экрана');
assert.ok(/display:\s*flex/.test(bodyRule[0]), 'body раскладывает содержимое колонкой');
assert.ok(!/overflow:\s*hidden/.test(bodyRule[0]), 'страница прокручивается, когда контента много');
assert.ok(!/(?<!min-)height:\s*100vh/.test(bodyRule[0]), 'body не зажат жёсткой высотой');
assert.ok(/background-attachment:\s*fixed/.test(bodyRule[0]), 'фон прибит к экрану и не уезжает при скролле');

// Контейнер высотой по содержимому: растёт вместе с закладками и не
// растянут на весь экран, когда рядов мало
const container = css.match(/\.container\s*\{[^}]*\}/);
assert.ok(container, 'правило .container существует');
assert.ok(!/flex:\s*1/.test(container[0]), 'контейнер не растянут на свободную высоту экрана');
assert.ok(!/min-height:\s*0/.test(container[0]), 'контейнер не сжат — растёт за закладками');

// Решётка без внутренней прокрутки и без растяжения строк по высоте
const grid = css.match(/#bookmarks-container\s*\{[^}]*\}/);
assert.ok(grid, 'правило #bookmarks-container существует');
assert.ok(!/overflow-y:\s*auto/.test(grid[0]), 'решётка не прокручивается внутри');
assert.ok(!/flex:\s*1/.test(grid[0]), 'решётка не растянута на свободную высоту');

// Кнопки в углу зафиксированы и собраны в вертикальную колонку,
// отстоящую от контента нижним отступом панели
const stack = css.match(/\.fab-stack\s*\{[^}]*\}/);
assert.ok(stack, 'правило .fab-stack существует');
assert.ok(/position:\s*fixed/.test(stack[0]), 'колонка кнопок не уезжает при скролле');
assert.ok(/flex-direction:\s*column/.test(stack[0]), 'кнопки выстроены вертикально');

console.log('no-scroll.test.mjs: все проверки пройдены');
