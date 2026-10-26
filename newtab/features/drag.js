// =============================================================================
// Фича: перетаскивание плиток закладок (сортировка).
//
// Мышиный путь — нативный HTML5 drag; тач — отдельный слой поверх него:
// long-press (350 мс) запускает перенос, дальше та же геометрия слотов.
// Общее: FLIP-перестановка reorderBookmarksAnimated (узлы плиток не
// пересоздаются), точка вставки getDropIndex считается геометрически.
//
// Состояние переноса (draggedIndex, mouseOrderChanged, touchDrag и
// флаги) и функции — на топ-уровне: их используют refreshUI
// (features/ui-actions.js: endTouchDrag перед перерисовкой) и
// features/context-menu.js (гашение меню во время переноса).
// Wiring слушателей — в initDrag(), вызывается из бутстрапа app.js.
// =============================================================================

let draggedIndex = null;
// Порядок менялся в мыши-переносе: dragend/drop пишут storage только
// когда перестановки были (у сенсорного переноса есть touchOrderChanged)
let mouseOrderChanged = false;

/**
 * FLIP-доездка плитки на место: из визуального сдвига (dx, dy) —
 * в её текущую позицию в потоке. transition=none → transform →
 * принудительный reflow → отдача стиля под CSS-переход.
 */
function flipSnap(el, dx, dy) {
    if (!dx && !dy) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.getBoundingClientRect(); // форсируем reflow, иначе браузер слепит кадры
    el.style.transition = '';
    el.style.transform = '';
}

/**
 * Обновляет позиции плиток в DOM без их пересоздания.
 *
 * Ключевое отличие от полной перерисовки: узлы плиток живут столько,
 * сколько длится перенос. Это убирает две проблемы прежней версии:
 * 1) dragend не срабатывал на пересозданном узле — плитка зависала
 *    повёрнутой; 2) переназначение обработчиков и inline-стилей
 * "моргало" на каждой перестановке.
 */
function reorderBookmarksAnimated(fromIndex, toIndex) {
    const [moved] = currentState.bookmarks.splice(fromIndex, 1);
    currentState.bookmarks.splice(toIndex, 0, moved);
    draggedIndex = toIndex;

    // FLIP First: позиции плиток до перестановки (узлы те же).
    // Ключ — сам узел: у закладок могут совпадать URL, поиск по
    // data-url тогда возвращал бы всегда первую плитку
    const before = new Map();
    bookmarksContainer.querySelectorAll('.bookmark').forEach((el) => {
        before.set(el, el.getBoundingClientRect());
    });

    // Last: переставляем существующие узлы в новом порядке.
    // На каждый URL — очередь узлов: дубликаты не теряются
    const queues = new Map();
    bookmarksContainer.querySelectorAll('.bookmark').forEach((el) => {
        const queue = queues.get(el.dataset.url) || [];
        queue.push(el);
        queues.set(el.dataset.url, queue);
    });
    currentState.bookmarks
        .map((b) => queues.get(b.url)?.shift())
        .filter(Boolean)
        .forEach((el) => bookmarksContainer.appendChild(el));

    // Синхронизируем индексы с новым порядком (от dataset.index зависят
    // редактирование/удаление по клику) и одним проходом снимаем новые
    // позиции — чтения до записей, иначе лишние reflow на каждую плитку
    const tiles = [...bookmarksContainer.querySelectorAll('.bookmark')];
    const nowRects = tiles.map((el, i) => {
        el.dataset.index = i;
        return el.getBoundingClientRect();
    });

    // Invert: все плитки разом ставим в старые позиции (только записи).
    // Перетаскиваемую плитку при сенсорном переносе не трогаем: она
    // вынута из потока (position: fixed) и едет за пальцем — FLIP-сдвиги
    // вернули бы её в сетку, и плитка «скакала» бы
    const shifted = [];
    tiles.forEach((el, i) => {
        if (touchDrag?.active && el === touchDrag.el) return;
        const prev = before.get(el);
        if (!prev) return;
        const dx = prev.left - nowRects[i].left;
        const dy = prev.top - nowRects[i].top;
        if (!dx && !dy) return;
        const isDragged = i === draggedIndex;
        el.style.transition = 'none';
        el.style.transform = `translate(${dx}px, ${dy}px)` + (isDragged ? ' rotate(5deg)' : '');
        shifted.push({ el, isDragged });
    });

    // Play: один принудительный reflow — и все сдвинутые плитки едут
    if (shifted.length) {
        bookmarksContainer.getBoundingClientRect();
        shifted.forEach(({ el, isDragged }) => {
            el.style.transition = '';
            el.style.transform = isDragged ? 'rotate(5deg)' : '';
        });
    }
}

/**
 * Слот вставки по координатам курсора. Сетка закладок многострочная,
 * поэтому слот считается в два шага:
 *   1. Плитки группируются в ряды по вертикальной позиции (близкий
 *      top — один ряд). Выбирается ряд, ближайший к курсору.
 *   2. Слот = число плиток в рядах выше + число центров, пройденных
 *      курсором внутри этого ряда (слева направо).
 * Так курсор на нижнем ряду не "проходит" центры верхнего — иначе
 * слот прыгал бы через 2-3 позиции и элемент улетал вверх.
 *
 * skipEl — перетаскиваемая плитка сенсорного переноса: она вынута из
 * потока и едет за пальцем; без исключения она создаёт фантомный
 * ряд под курсором, и список прыгает.
 */
function getDropIndex(mouseX, mouseY, skipEl) {
    const tiles = [...bookmarksContainer.querySelectorAll('.bookmark')]
        .filter((tile) => tile !== skipEl);
    if (!tiles.length) return 0;

    // Группировка в ряды: плитки с top в пределах 10px — один ряд
    const rows = [];
    tiles.forEach((tile) => {
        const top = tile.getBoundingClientRect().top;
        const row = rows.find((r) => Math.abs(r.top - top) <= 10);
        if (row) row.tiles.push(tile);
        else rows.push({ top, tiles: [tile] });
    });

    // Ряд, ближайший к курсору по вертикали
    let nearest = rows[0];
    let nearestDist = Infinity;
    rows.forEach((row) => {
        const rect = row.tiles[0].getBoundingClientRect();
        const dist = Math.abs(rect.top + rect.height / 2 - mouseY);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = row;
        }
    });

    // Слот: плитки до ряда курсора целиком + пройденные центры ряда
    let slot = 0;
    for (const row of rows) {
        if (row === nearest) {
            row.tiles.forEach((tile) => {
                const rect = tile.getBoundingClientRect();
                if (mouseX > rect.left + rect.width / 2) slot++;
            });
            return slot;
        }
        slot += row.tiles.length;
    }
    return slot;
}


/**
 * Убирает визуал переноса со всех плиток: класс .dragging и
 * остатки FLIP-сдвигов. Общий хвост dragend и drop.
 */
function clearDragVisual() {
    bookmarksContainer.querySelectorAll('.bookmark').forEach((el) => {
        el.classList.remove('dragging');
        el.style.transform = '';
    });
}

const TOUCH_DRAG_DELAY = 350; // long-press до старта переноса
const TOUCH_DRAG_SLOP = 10;   // движение пальца раньше — это скролл

let touchDrag = null;      // { el, index, grabX, grabY, startX, startY, lastX, lastY, active, moved }
let touchTimer = null;
let touchOrderChanged = false;

// Инлайновые стили сенсорного переноса: endTouchDrag обязан снять их
// все, иначе остатки (position: fixed, transition: none) ломают и
// вёрстку, и последующие переносы мышью
const TOUCH_DRAG_STYLES = ['position', 'left', 'top', 'width', 'height', 'zIndex', 'transform', 'transition'];

/**
 * Поднимает плитку над сеткой: выходит из потока (position: fixed,
 * left/top в координатах вьюпорта — родитель с backdrop-filter не
 * создаёт для неё containing block) и едет за точкой пальца.
 * Соседи замеряются ДО выхода из потока и плавно закрывают зазор.
 */
function liftTouchTile(el) {
    const rect = el.getBoundingClientRect();

    // FLIP First: позиции соседей ДО выхода плитки из потока
    const before = new Map();
    bookmarksContainer.querySelectorAll('.bookmark').forEach((other) => {
        if (other !== el) before.set(other, other.getBoundingClientRect());
    });

    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
    el.style.position = 'fixed';
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    // zIndex остаётся в .bookmark.dragging (styles.css)
    el.classList.add('dragging');
    // Граб-смещение от последней позиции пальца, а не от точки касания:
    // за 350 мс long-press палец мог сместиться в пределах slop — иначе
    // на первом движении плитка дёргается обратно к точке касания
    touchDrag.grabX = touchDrag.lastX - rect.left;
    touchDrag.grabY = touchDrag.lastY - rect.top;

    // FLIP Play: соседи плавно закрывают освободившийся зазор
    before.forEach((oldRect, other) => {
        const ddx = oldRect.left - other.getBoundingClientRect().left;
        const ddy = oldRect.top - other.getBoundingClientRect().top;
        flipSnap(other, ddx, ddy);
    });
}

/**
 * Завершает сенсорный перенос: возвращает плитку в поток плавной
 * доездкой на её место в сетке, сохраняет порядок (если он менялся)
 * и сбрасывает состояние.
 * save=true — порядок сохранить, false — только откатить визуал.
 */
function endTouchDrag(save) {
    clearTimeout(touchTimer);
    if (touchDrag?.active) {
        const el = touchDrag.el;
        // Позиция до возврата в поток — для плавной доездки на место
        const from = el.getBoundingClientRect();
        TOUCH_DRAG_STYLES.forEach((prop) => { el.style[prop] = ''; });
        el.classList.remove('dragging');
        const to = el.getBoundingClientRect();
        flipSnap(el, from.left - to.left, from.top - to.top);
        if (save && touchOrderChanged) {
            saveState({ bookmarks: currentState.bookmarks });
        }
        draggedIndex = null;
    }
    touchDrag = null;
}

/**
 * Регистрирует слушатели переноса (мышь + тач + подавление нативного
 * меню). Вызывается из бутстрапа app.js на месте старой секции.
 */
function initDrag() {
        bookmarksContainer.addEventListener('dragstart', (e) => {
            // Пока палец касается плитки (long-press засечён или перенос идёт),
            // нативный drag запрещён: иначе второй палец/ладонь запускают
            // браузерный перенос второй плитки, он перезаписывает draggedIndex
            // активного сенсорного переноса — и всё зависает
            if (touchDrag) {
                e.preventDefault();
                return;
            }
            const el = e.target.closest('.bookmark');
            if (!el) return;
            draggedIndex = Number(el.dataset.index);
            mouseOrderChanged = false;
            el.classList.add('dragging');
            e.dataTransfer?.setData('text/plain', String(draggedIndex));
        });

        bookmarksContainer.addEventListener('dragend', (e) => {
            // Узлы не пересоздаются, но класс и возможные FLIP-сдвиги всё
            // равно нужно снять со всех плиток — перенос завершён.
            // Порядок на экране уже новый: сохраняем его даже при отмене
            // (Esc, drop вне окна) — иначе экран и storage расходятся.
            // Но если перестановок не было вовсе, storage не трогаем
            clearDragVisual();
            if (draggedIndex !== null && mouseOrderChanged) {
                saveState({ bookmarks: currentState.bookmarks });
            }
            draggedIndex = null;
        });

        // Пока тащим: точка вставки вычисляется геометрически — сколько
        // центров плиток прошёл курсор. dragover повешен на контейнер,
        // поэтому зазоры между плитками тоже работают
        bookmarksContainer.addEventListener('dragover', (e) => {
            if (draggedIndex === null) return;
            e.preventDefault(); // без этого браузер не даст сделать drop

            const slot = getDropIndex(e.clientX, e.clientY);
            // Слот "до" или "после" перетаскиваемой плитки — она уже на месте
            if (slot === draggedIndex || slot === draggedIndex + 1) return;

            // Слот в текущем списке включает сам перетаскиваемый элемент,
            // поэтому после его удаления индекс вставки смещается на -1
            const insertIndex = slot > draggedIndex ? slot - 1 : slot;
            mouseOrderChanged = true;
            reorderBookmarksAnimated(draggedIndex, insertIndex);
        });

        bookmarksContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            // Порядок уже переставлен в dragover — здесь только сохраняем.
            // Один раз за перенос, а не на каждый hover над соседями; без
            // перестановок писать нечего
            if (draggedIndex !== null && mouseOrderChanged) {
                saveState({ bookmarks: currentState.bookmarks });
            }
            // Завершаем перенос: убираем приглушение/поворот со всех плиток,
            // чтобы ни одна не осталась повёрнутой после установки
            clearDragVisual();
            draggedIndex = null;
        });

        bookmarksContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const el = e.target.closest('.bookmark');
            if (!el) return;
            const touch = e.touches[0];
            touchOrderChanged = false;
            touchDrag = {
                el,
                index: Number(el.dataset.index),
                startX: touch.clientX,
                startY: touch.clientY,
                lastX: touch.clientX, // последняя позиция пальца до старта переноса
                lastY: touch.clientY,
                grabX: 0,
                grabY: 0,
                active: false,
                moved: false,
            };
            // Нативный drag не должен перехватывать касание: иначе long-press
            // на тачскрине включал бы браузерный drag, плитка зависала бы в
            // режиме переноса и не двигалась за пальцем
            el.draggable = false;
            // Long-press запускает перенос; до него тап и скролл работают как
            // обычно. Если мышиный перенос уже идёт — сенсорный не начинаем,
            // чтобы таймер ладони не перебил draggedIndex активного переноса
            touchTimer = setTimeout(() => {
                if (!touchDrag || draggedIndex !== null) return;
                touchDrag.active = true;
                draggedIndex = touchDrag.index;
                liftTouchTile(el);
                // moved initialised в touchstart: если палец поедет — это перенос,
                // если отпустится на месте — открываем контекстное меню
            }, TOUCH_DRAG_DELAY);
        }, { passive: true });

        bookmarksContainer.addEventListener('touchmove', (e) => {
            if (!touchDrag) return;
            const touch = e.touches[0];

            if (!touchDrag.active) {
                // Палец мог дрейфовать в пределах slop: запоминаем последнюю
                // позицию — от неё позже считается граб-смещение (liftTouchTile)
                touchDrag.lastX = touch.clientX;
                touchDrag.lastY = touch.clientY;
                // Палец сместился раньше long-press — это скролл, перенос отменён
                const dx = touch.clientX - touchDrag.startX;
                const dy = touch.clientY - touchDrag.startY;
                if (dx * dx + dy * dy > TOUCH_DRAG_SLOP * TOUCH_DRAG_SLOP) {
                    clearTimeout(touchTimer);
                    // draggable гасится в touchstart — возвращаем и здесь,
                    // иначе после свайпа мышиный перенос по плитке не работает
                    touchDrag.el.draggable = true;
                    touchDrag = null;
                }
                return;
            }

            // Активный перенос: страница не скроллится, палец двигает плитку
            e.preventDefault();
            // Движение после long-press — это перенос, а не запрос меню
            touchDrag.moved = true;
            // Плитка следует за пальцем: position: fixed + left/top — без
            // transform, чтобы не конфликтовать с FLIP-анимацией соседей
            touchDrag.el.style.left = (touch.clientX - touchDrag.grabX) + 'px';
            touchDrag.el.style.top = (touch.clientY - touchDrag.grabY) + 'px';

            // Плитка под пальцем исключена из расчёта рядов: иначе её позиция
            // у пальца создавала бы фантомный ряд и список прыгал.
            // Слот без самой плитки — готовый индекс вставки: no-op только
            // на своей текущей позиции, без смещения -1
            const slot = getDropIndex(touch.clientX, touch.clientY, touchDrag.el);
            if (slot !== draggedIndex) {
                reorderBookmarksAnimated(draggedIndex, slot);
                touchOrderChanged = true;
            }
        }, { passive: false });

        bookmarksContainer.addEventListener('touchend', (e) => {
            if (!touchDrag) return;
            const wasActive = touchDrag.active;
            const openedMenu = wasActive && !touchDrag.moved;
            const menuTarget = touchDrag.el;
            // preventDefault на touchend гасит клик по ссылке — иначе после
            // переноса открывался бы сайт под пальцем
            if (wasActive) e.preventDefault();
            touchDrag.el.draggable = true; // возвращаем нативный drag для мыши
            endTouchDrag(wasActive);
            if (openedMenu) {
                // Long-press без движения — как правый клик: меню на месте плитки.
                // Меню position: fixed — нужны координаты вьюпорта, без прокрутки
                const rect = menuTarget.getBoundingClientRect();
                showContextMenu(rect.left + rect.width / 2, rect.top + rect.height / 2, menuTarget);
            }
        });

        bookmarksContainer.addEventListener('touchcancel', () => {
            // Порядок к моменту отмены валиден — сохраняем, если менялся
            if (touchDrag) touchDrag.el.draggable = true;
            endTouchDrag(true);
        });

        // Long-press на Android нативно открывает контекстное меню — во время
        // переноса (и его старта) гасим, иначе палец «отваливается» от плитки.
        // stopPropagation не даёт событию дойти до документного обработчика,
        // который открыл бы наше меню прямо посреди переноса
        bookmarksContainer.addEventListener('contextmenu', (e) => {
            if (touchDrag && e.target.closest('.bookmark')) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
}
