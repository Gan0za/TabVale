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
import { SOURCE as js } from './_source.mjs';

// --- Статические проверки: ключевые части нового механизма на месте ---
assert.ok(js.includes('reorderBookmarksAnimated'), 'есть перестановка с FLIP без пересоздания узлов');
assert.ok(!js.includes('renderBookmarksAnimated'), 'старая полная перерисовка удалена');
assert.ok(js.includes('appendChild(el)'), 'узлы плиток перемещаются, а не пересоздаются');
assert.ok(js.includes('el.dataset.index = i'), 'dataset.index синхронизируется после перестановки');
// Перестановка ищет узлы по очередям на каждый URL — дубликаты URL не теряются
assert.ok(/queues\.get\(b\.url\)/.test(js), 'узлы ищутся очередями по url (дубликаты безопасны)');
// Мышь — нативный HTML5 drag (dragend сбрасывает состояние), тач — touchend
assert.ok(/dragend[\s\S]*?draggedIndex = null;/.test(js), 'dragend сбрасывает draggedIndex');
assert.ok(/touchend[\s\S]*?endTouchDrag\(wasActive\)/.test(js), 'touchend сохраняет порядок');
// Плитка остаётся draggable: мышиный перенос работает нативно
assert.ok(js.includes('el.draggable = true'), 'плитка draggable для мыши');

// --- Слот вставки: счёт центров, пройденных курсором ---
// Эмуляция getDropIndex для ОДНОГО ряда: tiles — центры плиток по X
function dropSlot(centers, mouseX) {
    let slot = 0;
    for (const center of centers) {
        if (mouseX > center) slot++;
    }
    return slot;
}

// Многострочная сетка: getDropIndex группирует плитки в ряды по вертикали
// (близкий top — один ряд), берёт ряд, ближайший к курсору, и считает
// слот как "плитки рядов выше целиком + пройденные центры ряда курсора"
function dropSlotGrid(rows, mouseX, mouseY) {
    // rows: [{top, height, centers}] — геометрия рядов
    let nearest = null;
    let nearestDist = Infinity;
    for (const row of rows) {
        const dist = Math.abs(row.top + row.height / 2 - mouseY);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = row;
        }
    }
    let slot = 0;
    for (const row of rows) {
        if (row === nearest) return slot + dropSlot(row.centers, mouseX);
        slot += row.centers.length;
    }
    return slot;
}

// Два ряда по две плитки (как на экране 130px плитки, ряды по 140px)
const grid = [
    { top: 0, height: 120, centers: [65, 205] },   // A B
    { top: 140, height: 120, centers: [65, 205] }, // C D
];

// Курсор на нижнем ряду НЕ проходит центры верхнего: слот = 2 (ряд выше) + 0..2
assert.equal(dropSlotGrid(grid, 40, 200), 2, 'нижний ряд, левая половина C: слот 2 (прыжка через 2-3 нет)');
assert.equal(dropSlotGrid(grid, 70, 200), 3, 'нижний ряд, правая половина C: слот 3');
assert.equal(dropSlotGrid(grid, 40, 60), 0, 'верхний ряд, левая половина A: слот 0');
assert.equal(dropSlotGrid(grid, 70, 60), 1, 'верхний ряд, правая половина A: слот 1');

// Зазоры и пустое место ряда работают без мёртвых зон
assert.equal(dropSlotGrid(grid, 140, 200), 3, 'зазор между C и D — слот 3 (после C)');
assert.equal(dropSlotGrid(grid, 600, 200), 4, 'пустое место справа от нижнего ряда — конец списка');

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

// Однострочная сетка для трассировки переноса (те же 130px плитки)
const centers = [65, 205, 345, 485];

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
