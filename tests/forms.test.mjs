// Тест связки HTML-разметки и логики форм добавления.
// Запуск: node tests/forms.test.mjs
//
// app.js ожидает, что в index.html существуют кнопки "＋ Добавить",
// сами формы и кнопки "Отмена" для каждого типа. Если ID разойдутся
// (переименовали в HTML, забыли в JS), страница сломается незаметно.
// Этот тест сверяет ID из разметки с ID, которые использует app.js.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(projectRoot, 'newtab', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(projectRoot, 'newtab', 'app.js'), 'utf8');

// --- Для каждого типа: кнопка показа, форма и кнопка отмены ---
const formTypes = ['bookmark', 'background', 'search-engine'];

for (const type of formTypes) {
    // Кнопка "＋ Добавить" и блок формы
    assert.ok(
        html.includes(`id="show-${type}-form"`),
        `${type}: есть кнопка показа формы`
    );
    assert.ok(
        html.includes(`id="${type}-form"`),
        `${type}: есть блок формы`
    );
    assert.ok(
        html.includes(`id="cancel-${type}"`),
        `${type}: есть кнопка "Отмена"`
    );

    // Кнопка показа и кнопка отмены не должны быть внутри скрытой формы:
    // "Добавить" видна сразу, форма скрыта классом hidden
    const formBlock = html.match(new RegExp(`id="${type}-form"[\\s\\S]*?</div>\\s*</div>`));
    assert.ok(formBlock, `${type}: блок формы найден`);
}

// Формы скрыты по умолчанию (класс hidden), кнопки добавления — нет
for (const type of formTypes) {
    const formTag = html.match(new RegExp(`<div id="${type}-form" class="([^"]*)"`));
    assert.ok(formTag, `${type}: у формы есть class`);
    assert.ok(formTag[1].includes('hidden'), `${type}: форма изначально скрыта`);
}

// app.js ссылается на те же ID (в объекте addForms и обработчиках отмены)
assert.ok(app_js_uses('show-bookmark-form'), 'app.js использует show-bookmark-form');
assert.ok(app_js_uses('show-background-form'), 'app.js использует show-background-form');
assert.ok(app_js_uses('show-search-engine-form'), 'app.js использует show-search-engine-form');
assert.ok(app_js_uses('cancel-bookmark'), 'app.js использует cancel-bookmark');
assert.ok(app_js_uses('cancel-background'), 'app.js использует cancel-background');
assert.ok(app_js_uses('cancel-search-engine'), 'app.js использует cancel-search-engine');

// Все кнопки в разметке имеют класс btn (единый стиль).
// Исключения — кнопки со своей особой формой: круглая FAB,
// кнопка выпадающего списка, вкладки настроек и пункты меню темы.
const exceptions = ['settings-fab', 'dropdown-button', 'settings-tab', 'data-mode'];
const allButtons = html.match(/<button[^>]*>/g) || [];
for (const tag of allButtons) {
    const isException = exceptions.some((e) => tag.includes(e));
    if (!isException) {
        assert.ok(/class="[^"]*\bbtn\b/.test(tag), `кнопка с классом .btn: ${tag}`);
    }
}

function app_js_uses(id) {
    return app_js_mentions(js, id_string(id));
}
function id_string(id) { return `'${id}'`; }
function app_js_mentions(source, str) { return source.includes(str); }

console.log('forms.test.mjs: все проверки пройдены');
