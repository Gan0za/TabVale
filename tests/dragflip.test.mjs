// Тест логики drag-n-drop с живой перестановкой (newtab/app.js).
// Запуск: node tests/dragflip.test.mjs
//
// Поведение "как на смартфоне": пока тащишь плитку, соседи плавно
// расступаются. Проверяем контракты:
//   1. Слот вставки = число центров плиток, пройденных курсором
//      (работает над зазорами и пустым местом в конце ряда)
//   2. Перестановка: splice(from, 1) + splice(to, 0, item)
//   3. Слоты "до"/"после" перетаскиваемой плитки — no-op
//   4. dragend/drop сбрасывают состояние — отмена не ломает следующий перенос
//   5. dataset.index синхронизируется после перестановки (edit/delete
//      по клику читают его из разметки)

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const js = fs.readFileSync(path.join(projectRoot, 'newtab', 'app.js'), 'utf8');

// --- Статические проверки: ключевые части нового механизма на месте ---
assert.ok(js.includes('reorderBookmarksAnimated'), 'есть перестановка с FLIP без пересоздания узлов');
assert.ok(!js.includes('renderBookmarksAnimated'), 'старая полная перерисовка удалена');
assert.ok(js.includes('appendChild(el)'), 'узлы плиток перемещаются, а не пересоздаются');
assert.ok(js.includes('el.dataset.index = i'), 'dataset.index синхронизируется после перестановки');
assert.ok(js.includes('CSS.escape(b.url)'), 'поиск плитки по url защищён CSS.escape');
// dragend сбрасывает индекс (regex — переводы строк в файле могут быть CRLF)
assert.ok(/dragend[\s\S]*?draggedIndex = null;/.test(js), 'dragend сбрасывает draggedIndex');
// Сохранение при drop, а не при каждой перестановке
const dropBlock = js.match(/drop'\s*,\s*\(e\) => \{[\s\S]*?\}\);/);
assert.ok(dropBlock && dropBlock[0].includes('saveState'), 'drop сохраняет порядок');

// --- Слот вставки: счёт центров, пройденных курсором ---
// Эмуляция getDropIndex: tiles — центры плиток по X (как после render)
function dropSlot(centers, mouseX) {
    let slot = 0;
    for (const center of centers) {
        if (mouseX > center) slot++;
    }
    return slot;
}

// Список A B C D; плитки по 130px с шагом 140 (130 + 12 зазор)
const centers = [65, 205, 345, 485];
// Курсор в самом левом зазоре (между 0 и первой плиткой) — слот 0
assert.equal(dropSlot(centers, 10), 0, 'курсор до всех центров — слот 0');
// В зазоре между A и B: пройден только центр A — слот 1 (мёртвых зон нет)
assert.equal(dropSlot(centers, 140), 1, 'зазор между плитками работает');
// Правее всех центров — конец списка
assert.equal(dropSlot(centers, 600), 4, 'курсор после всех центров — конец списка');

// --- Перестановка: слот -> индекс вставки -> порядок ---
// dragover-обработчик: слоты "до"/"после" draggedIndex — no-op,
// иначе вставка со смещением -1 при движении вправо
function applyDragOver(list, draggedIndex, mouseX, centers) {
    const slot = dropSlot(centers, mouseX);
    if (slot === draggedIndex || slot === draggedIndex + 1) return false;
    const insertIndex = slot > draggedIndex ? slot - 1 : slot;
    const [moved] = list.splice(draggedIndex, 1);
    list.splice(insertIndex, 0, moved);
    return true;
}

// A B C D, тащим D (draggedIndex = 3):
let list = ['A', 'B', 'C', 'D'];
// Курсор на 210 (правая половина B): пройдены центры A и B -> слот 2.
// Слот 2 < draggedIndex 3 -> вставка без смещения
assert.equal(applyDragOver(list, 3, 210, centers), true);
assert.deepEqual(list, ['A', 'B', 'D', 'C'], 'D встал после B (курсор на правой половине B)');

// draggedIndex теперь 2. Курсор на 70 (правая половина A): пройден
// центр A -> слот 1. Слот 1 < draggedIndex 2 -> вставка в 1
assert.equal(applyDragOver(list, 2, 70, centers), true);
assert.deepEqual(list, ['A', 'D', 'B', 'C'], 'D влево на место B');

// Курсор в крайний левый зазор: слот 0 -> вставка в начало
assert.equal(applyDragOver(list, 1, 10, centers), true);
assert.deepEqual(list, ['D', 'A', 'B', 'C'], 'D в начало списка');

// Вправо: draggedIndex 0, курсор на 140 (зазор A/B, слот 1 = draggedIndex+1)
// — no-op: плитка уже в начале
assert.equal(applyDragOver(list, 0, 140, centers), false);
assert.deepEqual(list, ['D', 'A', 'B', 'C'], 'слот после своей плитки — no-op');

// Курсор на 300 (правая половина A, слот 2) — реальный перенос вправо
assert.equal(applyDragOver(list, 0, 300, centers), true);
assert.deepEqual(list, ['A', 'D', 'B', 'C'], 'D вправо между A и B');

// Курсор после всех центров (слот 4) — в конец списка
assert.equal(applyDragOver(list, 1, 999, centers), true);
assert.deepEqual(list, ['A', 'B', 'C', 'D'], 'D в конец списка');

// Длинный перенос вправо: A (0), курсор прошёл 3 центра из 5 (слот 3),
// вставка со смещением (slot-1 = 2 после удаления)
let wide = ['A', 'B', 'C', 'D', 'E'];
const wideCenters = [65, 205, 345, 485, 625];
assert.equal(applyDragOver(wide, 0, 400, wideCenters), true);
assert.deepEqual(wide, ['B', 'C', 'A', 'D', 'E'], 'перенос вправо через нескольких соседей');

// Битый mouseX (NaN) не даёт ни одного пройденного центра -> слот 0:
// вставка в начало, без исключений
let safe = ['A', 'B', 'C'];
assert.equal(applyDragOver(safe, 2, NaN, [65, 205, 345]), true);
assert.deepEqual(safe, ['C', 'A', 'B'], 'NaN не роняет логику: элемент уехал в начало');

console.log('dragflip.test.mjs: все проверки пройдены');
