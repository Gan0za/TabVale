// Единый загрузчик исходников для всех тестов.
// Канонический порядок скриптов = порядок <script> в newtab/index.html
// и список файлов в package.sh. Сплит app.js на файлы меняет только
// список FILES здесь; сами тесты остаются без изменений.
//
// Семантика совпадает с браузером: топ-уровневые const/function/let
// классических <script>-ов шарятся через глобальную лексическую среду,
// поэтому конкатенация в vm эквивалентна набору тегов <script>.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, '..', '..');

// Порядок загрузки: сначала ядро (config, i18n, storage, render),
// затем фичи, последним — bootstrap (см. refactor/split).
export const SCRIPT_FILES = [
    'newtab/core/config.js',
    'newtab/app.js',
];

export const SOURCE = SCRIPT_FILES
    .map((f) => fs.readFileSync(path.join(projectRoot, f), 'utf8'))
    .join('\n');
