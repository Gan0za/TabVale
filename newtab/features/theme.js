// =============================================================================
// Фича: тема оформления.
//
// Три режима: 'auto' (следовать за настройкой ОС), 'light', 'dark'.
// Выбор хранится в chrome.storage.sync. Итоговая тема применяется
// к <html> через атрибут data-theme — по нему CSS включает нужные
// переменные (см. styles.css).
//
// Код выполняется при загрузке файла (скрипт в конце <body>): вешаем
// слушатели и читаем сохранённый режим сразу, не дожидаясь
// DOMContentLoaded. Зависимости: core/state.js (refs), core/storage.js
// (storageGet/storageSet), core/i18n.js (themeLabel, currentThemeMode),
// features/popovers.js (closeAllPopovers).
// =============================================================================

const themeToggle = document.getElementById('theme-toggle');
const themeMenu = document.getElementById('theme-menu');

// Иконка кнопки меняется вместе с режимом: авто — половинка,
// светлая — солнце, тёмная — луна (см. index.html, data-mode)
const THEME_ICONS = { auto: '🌗', light: '☀️', dark: '🌙' };

/**
 * Применяет тему к странице.
 * mode — 'auto' | 'light' | 'dark' (что выбрал пользователь).
 * При 'auto' смотрим на системную настройку через window.matchMedia.
 */
function applyTheme(mode) {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    // При "auto" тема определяется системой, иначе — выбором пользователя
    const isDark = mode === 'dark' || (mode === 'auto' && systemDark);

    // Светлая тема — отсутствие атрибута (переменные :root по умолчанию)
    if (isDark) {
        document.documentElement.dataset.theme = 'dark';
    } else {
        delete document.documentElement.dataset.theme;
    }
    // Иконка кнопки подсказывает текущий режим
    if (themeToggle) themeToggle.textContent = THEME_ICONS[mode] || THEME_ICONS.auto;
    // Подсвечиваем активный пункт меню переключателя
    themeMenu?.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });
    // Подпись и подсветка в селекторе темы («Общие» настройки)
    currentThemeMode = mode;
    const selectedThemeName = document.getElementById('selected-theme-name');
    if (selectedThemeName) selectedThemeName.textContent = themeLabel(mode);
    document.querySelectorAll('#theme-general-list .dropdown-item').forEach((b) => {
        b.classList.toggle('selected', b.dataset.mode === mode);
    });
}

// Реагируем на переключение темы в системе, пока активен режим "auto"
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    storageGet('theme', (result) => {
        if ((result.theme || 'auto') === 'auto') applyTheme('auto');
    });
});

// Загружаем сохранённый режим и включаем переключатель
storageGet('theme', (result) => {
    currentThemeMode = result.theme || 'auto';
    applyTheme(currentThemeMode);
});
themeToggle?.addEventListener('click', (e) => {
    // Показать/спрять мини-меню выбора темы.
    // stopPropagation: иначе клик дойдёт до document и тут же закроет меню
    e.stopPropagation();
    closeAllPopovers(themeMenu);
    themeMenu.classList.toggle('hidden');
});
themeMenu?.addEventListener('click', (e) => {
    // Клик по пункту или его тексту: ищем кнопку с data-mode
    const item = e.target.closest('button[data-mode]');
    if (!item) return;
    const mode = item.dataset.mode;
    currentThemeMode = mode;
    storageSet({ theme: mode });
    applyTheme(mode);
    themeMenu.classList.add('hidden');
});

// Селектор темы в модалке («Общие»): работает как dropdown поисковика,
// открывается классом open (CSS display: none -> block)
const themeGeneralButton = document.getElementById('theme-general-button');
const themeGeneralList = document.getElementById('theme-general-list');
themeGeneralButton?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllPopovers(themeGeneralList);
    themeGeneralList.classList.toggle('open');
});
themeGeneralList?.addEventListener('click', (e) => {
    // Клик по пункту или по его иконке: ищем кнопку пункта
    const item = e.target.closest('.dropdown-item');
    if (!item) return;
    const mode = item.dataset.mode;
    if (!mode) return;
    currentThemeMode = mode;
    storageSet({ theme: mode });
    applyTheme(mode);
    themeGeneralList.classList.remove('open');
});
