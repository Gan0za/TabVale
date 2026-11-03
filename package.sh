#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Скрипт упаковки расширения для публикации.
#
# Собирает dist/self_tabs_v{VERSION}.zip — ровно тот архив, который
# загружается в Chrome Web Store. В zip попадают ТОЛЬКО рантайм-файлы:
#
#   manifest.json, background.js, newtab/, assets/icons/icon*.png,
#   _locales/
#
# Что НЕ попадает и почему:
#   - tests/, tools/, .gitignore, TODO_PUBLICATION.md — рабочие файлы разработки
#   - self_tabs_settings.json — личные данные (в .gitignore)
#   - assets/icons/favicon.svg — манифест использует только PNG, лишний
#     файл в архиве увеличивает вес и вызывает вопросы у ревью
#
# Запуск из корня проекта:  bash package.sh
# -----------------------------------------------------------------------------
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Версию берём из манифеста — единого источника правды о версии
VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('manifest.json','utf8')).version)")

# tar (bsdtar) с флагом -a создаёт zip по расширению .zip; есть в Windows 10+
DIST_DIR="dist"
ZIP_NAME="$DIST_DIR/self_tabs_v${VERSION}.zip"
TAR="/c/WINDOWS/system32/tar.exe"
command -v tar >/dev/null && TAR="tar"

mkdir -p "$DIST_DIR"

# Список рантайм-файлов — синхронизирован с manifest.json
"$TAR" -a -c -f "$ZIP_NAME" \
    manifest.json \
    background.js \
    newtab \
    assets/icons/icon16.png \
    assets/icons/icon48.png \
    assets/icons/icon128.png \
    _locales

echo "Готово: $ZIP_NAME"
"$TAR" -tf "$ZIP_NAME"
