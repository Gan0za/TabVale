# Перечень задач: подготовка расширения к публикации

> Возвращаемся к этому файлу по мере работы. Статусы: ⬜ не начато · 🔧 в работе · ✅ готово
> Ветка для публикационных правок создаётся от `master` (например, `release/prepare`).

## Вердикт аудита (обновлён 2026-11-03)

Код работоспособен: 26 тестов зелёные, экраны и фиксы ревью влиты в `master`.
Публикация блокируется не кодом, а обязательными артефактами магазина:
скриншотами, текстом карточки магазина (EN), тегом версии и ссылкой на
репозиторий. English summary в README уже есть.

---

## Блок 1 — Безопасность

- ✅ **1.1 Валидация импорта bookmarks/backgrounds по элементам** (критично)
  - Готово (f228a8e): isSafeWebUrl (только http/https), sanitizeList для
    bookmarks/backgrounds/searchEngines, счётчик пропущенных в сводке импорта,
    тест import.test.mjs (javascript:/data:/file: отбрасываются).

- ✅ **1.2 Обработка `chrome.runtime.lastError`** (3ed8659)
  - Обёртки storageGet/storageSet в core/storage.js; все вызовы storage
    переведены на них; ошибка записи — warning в консоль без падения UI.

- ✅ **1.3 Обоснование `clipboardRead` для анкеты CWS** (CWS_REVIEW_NOTES.md)
  - Готовые тексты для формы ревью (EN): короткая и полная версии,
    single purpose, обоснование отсутствия remote code.

- ✅ **1.4 Локализация интерфейса с выбором языка** (d6a435a)
  - 13 языков в `_locales` (en, ru, de, fr, es, pt_BR, it, pl, tr, uk, zh_CN, ja, ko), паритет ключей и плейсхолдеров;
  - загрузчик applyLocale + t() с подстановкой переменных;
  - выбор языка: FAB 🌐 + раздел «Общие» (там же тема и импорт/экспорт);
  - 'auto' — язык браузера при первом запуске, дальше явно;
  - тест i18n.test.mjs.

## Блок 2 — Манифест

- ✅ **2.1 `minimum_chrome_version: "107"`** (87e3662)
- ✅ **2.2 `author`** (87e3662); `homepage_url` — отложено до создания GitHub-репозитория
- ✅ **2.3 Локализация name/description** (864452d)
  - `_locales/ru/messages.json`, `_locales/en/messages.json`, `default_locale: "ru"`.
- ✅ **2.4 Убрать мёртвое поле `selected` из DEFAULT_SEARCH_ENGINES** (ad44a42)

## Блок 3 — Релиз-инфраструктура

- ✅ **3.1 LICENSE (MIT)** (eb5bea1)
- ✅ **3.2 PRIVACY.md** (eb5bea1) — данные хранятся в chrome.storage.sync/local, наружу не передаются; описаны clipboardRead, unlimitedStorage и optional host permissions.
- ✅ **3.3 Скрипт упаковки** — `bash package.sh` (Git Bash) и `powershell -ExecutionPolicy Bypass -File .\package.ps1` (Windows) → `dist/tabvale_v{version}.zip` с рантайм-файлами (manifest, background.js, newtab/, assets/icons/icon*.png, _locales/) без tests/, tools/, .gitignore, favicon.svg.
- ✅ **3.4 Скриншоты для листинга** — 12 кадров 1280×800 в `docs/screenshots/`: главная, экраны, фоны, поисковики, контекстное меню, удаление экрана — каждый в тёмной и светлой теме.

## Блок 4 — GitHub и листинг

- 🔧 **4.1 README**: английский полный + 12 коротких переводов и 12 скриншотов;
  осталось добавить ссылку на магазин после публикации.
- ✅ **4.2 Тег релиза v1.1.1**: версия `1.1.1` (переименование в TabVale и новая иконка), пакет собран, тег `v1.1.1` создан; `v1.1.0` остаётся на предыдущем релизе.
- ✅ **4.3 favicon.svg не включается в zip** — package.sh берёт только PNG
- 🔧 **4.4 Карточка CWS**: `docs/CWS_LISTING.md` (EN, short/full description, Data usage, single purpose); 5 скриншотов в `docs/screenshots/cws/`
- 🔧 **4.5 Публичная политика**: `docs/privacy.html` готов; URL `https://gan0za.github.io/TabVale/privacy.html` — включить GitHub Pages
- ✅ **4.6 GitHub-репозиторий и remote**: `https://github.com/Gan0za/TabVale`, remote `origin` настроен; `homepage_url` в манифесте задан
- ⬜ **4.7 Загрузка в CWS**: загрузить `dist/tabvale_v1.1.1.zip`, заполнить карточку и отправить на ревью

## Статус цикла

| Шаг | Статус |
|---|---|
| Анализ готовности | ✅ |
| Блок 1: безопасность | ✅ |
| Блок 2: манифест | ✅ (homepage_url задан: `github.com/Gan0za/TabVale`) |
| Блок 3: релиз-инфраструктура | ✅ |
| Блок 4: GitHub/листинг | 🔧 README, скриншоты, CWS-тексты, privacy.html, репозиторий и тег v1.1.1 готовы; загрузка ⬜ |
| Мерж экранов в master | ✅ (master, tag v1.1.0) |
| Релиз CWS | ⬜ |
