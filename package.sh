#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Скрипт упаковки расширения для публикации.
#
# Собирает dist/tabvale_v{VERSION}.zip — ровно тот архив, который
# загружается в Chrome Web Store. В zip попадают ТОЛЬКО рантайм-файлы:
#
#   manifest.json, background.js, newtab/, assets/icons/icon*.png,
#   _locales/
#
# Что НЕ попадает и почему:
#   - tests/, tools/, .gitignore, TODO_PUBLICATION.md — рабочие файлы разработки
#   - tabvale_settings.json — личные данные (в .gitignore)
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

# Только bsdtar умеет -a (zip по расширению). GNU tar из Git Bash
# создаёт невалидный .zip, поэтому его не используем.
DIST_DIR="dist"
ZIP_NAME="$DIST_DIR/tabvale_v${VERSION}.zip"
if [ -x "/c/WINDOWS/system32/tar.exe" ]; then
    TAR="/c/WINDOWS/system32/tar.exe"
elif command -v bsdtar >/dev/null 2>&1; then
    TAR="bsdtar"
else
    echo "Нужен bsdtar: Windows tar.exe или bsdtar в PATH." >&2
    exit 1
fi

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
