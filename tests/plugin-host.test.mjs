// Хост плагинов: подключение файлов, док/панель и граница безопасности.
// Запуск: node tests/plugin-host.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const html = read('newtab/index.html');
const source = read('newtab/features/plugins.js');
const db = read('newtab/core/plugin-db.js');
const css = read('newtab/styles.css');
const app = read('newtab/app.js');
const settings = read('newtab/features/settings.js');
const manifest = JSON.parse(read('manifest.json'));

// 1. Файлы подключены в правильном порядке
const dbIndex = html.indexOf('core/plugin-db.js');
const hostIndex = html.indexOf('features/plugins.js');
const appIndex = html.indexOf('src="app.js"');
assert.ok(dbIndex > 0 && hostIndex > dbIndex && appIndex > hostIndex, 'порядок скриптов корректен');
assert.ok(app.includes('initPlugins()'), 'бутстрап вызывает initPlugins');

// 2. Док и панель описаны в разметке/стилях
assert.ok(css.includes('.plugin-dock'), 'есть стили дока');
assert.ok(css.includes('.plugin-panel'), 'есть стили панели');
assert.ok(css.includes('.plugin-panel-frame'), 'панель содержит iframe');

// 3. Хост использует только правила брокера, не доверяет sandbox
assert.ok(source.includes('findPluginInstance(event.source)'), 'проверяется source-окно');
assert.ok(source.includes('pluginMethodAllowed'), 'метод проверяется по манифесту');
assert.ok(source.includes('checkPluginStorageWrite'), 'запись проверяется по квоте');
assert.ok(source.includes('pluginStorageKey'), 'ключи хранилища namespaced');
assert.ok(source.includes('pluginAllowsUrl'), 'сеть проверяется по allowlist');
assert.ok(source.includes('instance.root.hidden = true'), 'закрытие strip скрывает виджет, не удаляя размещение');
assert.ok(source.includes("sandbox/plugin-host.html"), 'панель грузит sandbox-страницу');
assert.ok(source.includes('renderPluginStrip'), 'есть рендер полосы плагинов');
assert.ok(css.includes('.plugin-strip-item'), 'есть стили элемента полосы');
assert.ok(source.includes('renderPluginTiles'), 'есть рендер плиток плагинов');
assert.ok(css.includes('.plugin-tile'), 'есть стили плитки плагина');
assert.ok(html.includes('data-tab="plugins"'), 'есть вкладка плагинов');
assert.ok(source.includes("surface === 'tiles'"), 'менеджер умеет ставить плитку');
assert.ok(html.includes('plugins-manager-list'), 'есть контейнер менеджера');
assert.ok(html.includes('install-plugin-file'), 'есть установка из файла');
assert.ok(source.includes('parsePluginPackage'), 'пакет разбирается перед установкой');
assert.ok(source.includes('renderPluginManager'), 'есть рендер менеджера');
assert.ok(source.includes('setPluginPlacement'), 'размещение меняется из менеджера');
assert.ok(source.includes('removePlugin'), 'плагин можно удалить');
assert.ok(source.includes('pluginRemovedBuiltins'), 'удалённые встроенные запоминаются');
assert.ok(source.includes("t('pluginRestore')"), 'есть восстановление встроенных');
assert.ok(source.includes("t('pluginOpen')"), 'кнопки менеджера локализованы');
assert.ok(source.includes("t('pluginRemoveConfirm'"), 'подтверждение удаления локализовано');
assert.ok(css.includes('.plugin-manager-item'), 'есть стили менеджера');

// 4. IndexedDB используется для пакетов, а не chrome.storage
assert.ok(db.includes('indexedDB.open'), 'пакеты лежат в IndexedDB');
assert.ok(source.includes('dbDeletePlugin'), 'менеджер удаляет пакет из IndexedDB');
assert.ok(source.includes('dbPutPlugin'), 'установка пишет пакет в IndexedDB');
assert.ok(settings.includes('finishExport') && settings.includes('plugins'), 'бэкап включает пакеты плагинов');
assert.ok(settings.includes('payload.plugins'), 'импорт восстанавливает пакеты плагинов');
assert.ok(settings.includes('pluginData') && settings.includes('pluginPlacements'), 'бэкап хранит данные и размещения');
assert.ok(settings.includes("t('pluginInstallConfirm'"), 'импорт плагина спрашивает права');
assert.ok(source.includes('watchPluginThemeAndLocale'), 'тема и язык транслируются в плагины');
assert.ok(source.includes("case 'ui.openExternal'"), 'внешние ссылки открываются через хост');
assert.ok(manifest.optional_permissions?.includes('bookmarks'), 'доступ к закладкам запрашивается опционально');
assert.ok(source.includes('chrome.bookmarks.getTree'), 'хост читает дерево закладок');
assert.ok(source.includes('requestBookmarksPermission'), 'есть явный запрос доступа к закладкам');
assert.ok(source.includes('plugin-manager-grant'), 'в менеджере есть кнопка разрешения');
assert.ok(source.includes("case 'ui.openManager'"), 'панель может привести к менеджеру');
assert.ok(css.includes('.plugin-manager-highlight'), 'нужная строка менеджера подсвечивается');
assert.ok(read('sandbox/plugin-host.js').includes('openManager'), 'метод openManager есть в sandbox-API');
assert.ok(read('plugins/com.tabvale.bookmarks/plugin.js').includes('api.ui.openManager'), 'импортёр ведёт к выдаче доступа');
assert.ok(source.includes('tabvale:bookmarks-permission'), 'хост принимает сообщение о выданном доступе');
assert.ok(source.includes('onBookmarksPermission'), 'выдача доступа применяется к открытым панелям');
assert.ok(source.includes("t('pluginGrantPending')"), 'кнопка показывает ожидание подтверждения');
assert.ok(source.includes("t('pluginGrantHint')"), 'есть подсказка про иконку браузера');
assert.ok(read('background.js').includes('chrome.action.onClicked'), 'иконка расширения тоже запрашивает доступ');
assert.ok(db.includes('PLUGIN_DB_STORE'), 'есть object store плагинов');

console.log('plugin-host.test.mjs: все проверки пройдены');
