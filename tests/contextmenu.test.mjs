// Тест состава контекстных меню (newtab/app.js, функция getContextMenuItems).
// Запуск: node tests/contextmenu.test.mjs
//
// getContextMenuItems — чистая функция: по типу элемента возвращает список
// пунктов меню. Здесь проверяем, что для каждого типа элемента меню
// содержит ожидаемые действия, а разделители стоят на своих местах.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(projectRoot, 'newtab', 'app.js'), 'utf8');

// Минимальные заглушки DOM/бrowser — app.js рассчитан на браузер
function makeElement(tag) {
    return {
        tagName: tag, className: '', textContent: '', children: [], style: {}, dataset: {},
        appendChild(c) { this.children.push(c); },
        append(...cs) { this.children.push(...cs); },
        setAttribute() {},
    };
}
const documentStub = {
    createElement: makeElement,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: makeElement('body'),
};
const chromeStub = {
    storage: { sync: { get(k, cb) { cb({}); }, set() {} }, onChanged: { addListener() {} } },
};

const { getContextMenuItems } = vm.runInNewContext(
    source + '\n;({ getContextMenuItems })',
    { chrome: chromeStub, document: documentStub, window: { addEventListener() {} }, Image: class {}, URL }
);

// --- Меню плитки закладки ---
const bookmark = getContextMenuItems('bookmark', { index: 0, url: 'https://a.com' });
const bookmarkActions = Array.from(bookmark.filter(i => !i.separator).map(i => i.action));
assert.deepEqual(
    bookmarkActions,
    ['editBookmark', 'deleteBookmark', 'openInNewTab', 'copyLink', 'openSettings'],
    'меню плитки: редактировать, удалить, новая вкладка, копировать, настройки'
);
// Разделитель — перед пунктом "Настройки" (индексы берём в полном списке,
// куда разделители тоже входят)
assert.deepEqual(bookmark.filter(i => i.separator).length, 1, 'один разделитель');
const settingsIdx = bookmark.findIndex(i => i.action === 'openSettings');
assert.equal(bookmark[settingsIdx - 1].separator, true,
    'разделитель идёт перед пунктом "Настройки"');

// --- Меню пустого фона ---
const background = getContextMenuItems('background', {});
// Разделители не имеют action, поэтому при сверке действий их отфильтровываем
assert.deepEqual(
    Array.from(background.filter(i => !i.separator).map(i => i.action)),
    ['nextBackground', 'editBackground', 'backgroundSettings', 'openSettings'],
    'меню фона: следующий фон, редактировать, настройки фонов, настройки'
);
// "Настройки" — под разделителем, как в меню плитки закладки
const bgSettingsIdx = background.findIndex(i => i.action === 'openSettings');
assert.equal(background[bgSettingsIdx - 1].separator, true, 'разделитель перед "Настройки"');
assert.equal(background[bgSettingsIdx].label, 'Настройки', 'пункт называется "Настройки"');
// Пункт редактирования текущего фона присутствует
assert.equal(
    background.find(i => i.action === 'editBackground').label,
    'Редактировать',
    'пункт редактирования фона называется "Редактировать"'
);

// --- Меню поля поиска (динамическое) ---

// Буфер пуст и поле пусто: только настройки
const searchEmpty = getContextMenuItems('search', { hasText: false, hasClipboardText: false });
assert.deepEqual(
    Array.from(searchEmpty.filter(i => !i.separator).map(i => i.action)),
    ['searchEngineSettings', 'openSettings'],
    'пустое поле и пустой буфер: только настройки'
);

// Текст в поле: появляются копирование, вырезание и очистка
const searchWithText = getContextMenuItems('search', { hasText: true, hasClipboardText: false });
assert.deepEqual(
    Array.from(searchWithText.filter(i => !i.separator).map(i => i.action)),
    ['copySearch', 'cutSearch', 'clearSearch', 'searchEngineSettings', 'openSettings'],
    'поле с текстом: копировать, вырезать, очистить'
);

// Текст в буфере: появляются оба пункта вставки
const searchWithClipboard = getContextMenuItems('search', { hasText: false, hasClipboardText: true });
assert.deepEqual(
    Array.from(searchWithClipboard.filter(i => !i.separator).map(i => i.action)),
    ['pasteAndSearch', 'pasteToSearch', 'searchEngineSettings', 'openSettings'],
    'буфер с текстом: вставить и искать, вставить'
);

// Текст и в поле, и в буфере: полный состав в порядке "действия -> настройки"
const searchFull = getContextMenuItems('search', { hasText: true, hasClipboardText: true });
assert.deepEqual(
    Array.from(searchFull.filter(i => !i.separator).map(i => i.action)),
    ['pasteAndSearch', 'pasteToSearch', 'copySearch', 'cutSearch', 'clearSearch', 'searchEngineSettings', 'openSettings'],
    'полный состав меню поиска'
);
// "Настройки" — под разделителем, как в других меню
const searchSettingsIdx = searchFull.findIndex(i => i.action === 'openSettings');
assert.equal(searchFull[searchSettingsIdx - 1].separator, true, 'разделитель перед "Настройки"');
assert.equal(searchFull[searchSettingsIdx].label, 'Настройки', 'пункт называется "Настройки"');

// --- Меню строки настроек ---
const rowPlain = Array.from(getContextMenuItems('settingsRow', { selectable: false, rowType: 'bookmark' }).map(i => i.action));
assert.deepEqual(rowPlain, ['rowEdit', 'rowDelete'], 'невыбираемая строка: редактировать и удалить без "Выбрать"');

const rowSelectable = Array.from(getContextMenuItems('settingsRow', { selectable: true, rowType: 'background' }).map(i => i.action));
assert.deepEqual(rowSelectable, ['rowSelect', 'rowEdit', 'rowDelete'], 'выбираемая строка содержит "Выбрать"');

// --- Неизвестный тип: пустое меню без падения ---
assert.equal(getContextMenuItems('unknown', {}).length, 0, 'неизвестный тип -> пустой список');

// Каждый пункт имеет подпись для отображения
for (const type of ['bookmark', 'background', 'search', 'settingsRow']) {
    const data = type === 'settingsRow' ? { selectable: true } : {};
    for (const item of getContextMenuItems(type, data)) {
        assert.ok(item.separator || item.label, `${type}: у пункта есть текст`);
    }
}

console.log('contextmenu.test.mjs: все проверки пройдены');
