// Тест логики drag-n-drop с живой перестановкой (newtab/app.js).
// Запуск: node tests/dragflip.test.mjs
//
// Проверяем главный контракт нового поведения:
//   1. dragover над соседней плиткой переставляет элементы в массиве
//      сразу (живое расступание), а не только при drop
//   2. dragover с тем же индексом — no-op (без лишних перестановок)
//   3. drop сохраняет порядок в storage
//   4. dragend сбрасывает draggedIndex — отмена переноса (Esc) не ломает
//      следующий перенос
//
// app.js целиком не запускается (требует полноценный DOM); вместо этого
// извлекаем логику перестановки и воспроизводим последовательность
// событий так, как её описывают обработчики.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const js = fs.readFileSync(path.join(projectRoot, 'newtab', 'app.js'), 'utf8');

// --- Статические проверки: новые части на месте ---
assert.ok(js.includes('renderBookmarksAnimated'), 'есть FLIP-перерисовка');
assert.ok(js.includes("dataset.url = bookmark.url"), 'у плитки есть стабильный ключ (dataset.url)');
assert.ok(js.includes('before.get(el.dataset.url)'), 'FLIP сопоставляет плитки по url');
assert.ok(js.includes("draggedIndex = targetIndex"), 'dragover обновляет draggedIndex после перестановки');
// dragend сбрасывает индекс (проверяем через regex — переводы строк в
// файле могут быть CRLF, поэтому \s, а не \n)
assert.ok(/dragend[\s\S]*?draggedIndex = null;/.test(js), 'dragend сбрасывает draggedIndex');
// Сохранение при drop, а не при каждом перестроении
const dropBlock = js.match(/drop'\s*,\s*\(e\) => \{[\s\S]*?\}\);/);
assert.ok(dropBlock && dropBlock[0].includes('saveState'), 'drop сохраняет порядок');

// --- Проверка перестановки как таковой ---
// Эмулируем ту же последовательность, что в обработчике dragover:
// splice(dragged, 1) + splice(target, 0, item) + draggedIndex = target
function reorderAfterDragOver(list, draggedIndex, targetIndex) {
    if (Number.isNaN(targetIndex) || targetIndex === draggedIndex) return false;
    const [item] = list.splice(draggedIndex, 1);
    list.splice(targetIndex, 0, item);
    return true;
}

// Плитки A B C D: тащим D (индекс 3) над B (индекс 1)
let list = ['A', 'B', 'C', 'D'];
assert.equal(reorderAfterDragOver(list, 3, 1), true);
assert.deepEqual(list, ['A', 'D', 'B', 'C'], 'D встал на место B, остальные расступились');

// Тащим A (0) над C (после перестановки индекс 2)
assert.equal(reorderAfterDragOver(list, 0, 2), true);
assert.deepEqual(list, ['D', 'B', 'A', 'C'], 'A переехал к C');

// dragover над той же плиткой — перестановки нет
const frozen = [...list];
assert.equal(reorderAfterDragOver(list, 1, 1), false);
assert.deepEqual(list, frozen, 'dragover на себе не меняет порядок');

// Полный перенос через несколько промежуточных позиций (как мышь по экрану)
let drag = ['A', 'B', 'C', 'D', 'E'];
let from = 4;
for (const target of [3, 2, 1, 0]) {
    reorderAfterDragOver(drag, from, target);
    from = target;
}
assert.deepEqual(drag, ['E', 'A', 'B', 'C', 'D'], 'последовательность промежуточных перестановок');

// Битый целевой индекс (приходит из dataset и может быть NaN) не роняет
// логику; draggedIndex NaN быть не может — он ставится в dragstart
assert.equal(reorderAfterDragOver(drag, 0, NaN), false);

console.log('dragflip.test.mjs: все проверки пройдены');
