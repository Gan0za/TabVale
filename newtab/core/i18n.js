// =============================================================================
// Ядро: локализация интерфейса.
//
// chrome.i18n.getMessage умеет читать только язык браузера и не умеет
// переключаться на лету, поэтому делаем свой загрузчик: при смене языка
// читаем _locales/<код>/messages.json и подставляем строки заново.
// Зависимость: core/render.js (setImageSource используется в
// buildLanguageMenu; render загружается по порядку скриптов позже).
// =============================================================================

// Справочник языков: код = имя папки в _locales, flag = SVG-картинка в
// newtab/flags/. Флаги — картинки, а не эмодзи: Windows/Chrome не рисуют
// эмодзи-флаги (вместо флага видны буквы RU/GB).
const LANGUAGES = [
    { code: 'auto', flag: null, name: 'Auto' },
    { code: 'en', flag: 'newtab/flags/gb.svg', name: 'English' },
    { code: 'ru', flag: 'newtab/flags/ru.svg', name: 'Русский' },
    { code: 'de', flag: 'newtab/flags/de.svg', name: 'Deutsch' },
    { code: 'fr', flag: 'newtab/flags/fr.svg', name: 'Français' },
    { code: 'es', flag: 'newtab/flags/es.svg', name: 'Español' },
    { code: 'pt_BR', flag: 'newtab/flags/pt-br.svg', name: 'Português (Brasil)' },
    { code: 'it', flag: 'newtab/flags/it.svg', name: 'Italiano' },
    { code: 'pl', flag: 'newtab/flags/pl.svg', name: 'Polski' },
    { code: 'tr', flag: 'newtab/flags/tr.svg', name: 'Türkçe' },
    { code: 'uk', flag: 'newtab/flags/ua.svg', name: 'Українська' },
    { code: 'zh_CN', flag: 'newtab/flags/zh-cn.svg', name: '中文' },
    { code: 'ja', flag: 'newtab/flags/ja.svg', name: '日本語' },
    { code: 'ko', flag: 'newtab/flags/ko.svg', name: '한국어' },
];

// Текущий режим темы — нужен, чтобы после смены языка обновить подпись
// кнопки селектора темы (она содержит переведённое слово)
let currentThemeMode = 'auto';

// Кэш загруженных переводов текущего языка (заполняет applyLocale)
let currentMessages = {};

// Связка с главным модулем: refreshUI объявлен внутри обработчика
// DOMContentLoaded и сверху недоступен. Модуль регистрирует здесь свою
// функцию перерисовки, чтобы applyLocale могла обновить динамические
// списки при смене языка на лету (кнопки Select/Edit/Delete и т.п.),
// не дожидаясь перезагрузки страницы. До инициализации — null.
let uiRefresher = null;

/**
 * Возвращает строку перевода по ключу с подстановкой переменных.
 * t('importSkipped', { count: 3 }) подставит $count$ = 3.
 * Если ключа нет — возвращаем ключ, чтобы пропуски были видны сразу.
 */
function t(key, vars) {
    let text = currentMessages[key]?.message || key;
    if (vars) {
        for (const [name, value] of Object.entries(vars)) {
            text = text.replaceAll(`$${name}$`, value);
        }
    }
    return text;
}

/**
 * Подпись кнопки селектора темы: иконка + переведённое название режима.
 * Используется и в applyTheme, и в applyLocale (после смены словаря).
 */
function themeLabel(mode) {
    const icons = { auto: '🌗', light: '☀️', dark: '🌙' };
    const keys = { auto: 'themeAuto', light: 'themeLight', dark: 'themeDark' };
    return `${icons[mode] || icons.auto} ${t(keys[mode])}`;
}

/**
 * Определяет код языка из настройки пользователя.
 * 'auto' — берём язык браузера (первые 2 символа: 'ru-RU' -> 'ru').
 * Если языка нет в _locales — откатываемся на русский.
 */
function normalizeLocaleCode(value) {
    const raw = String(value || '').replace('_', '-').toLowerCase();
    if (!raw) return '';
    if (raw === 'pt' || raw.startsWith('pt-')) return 'pt_BR';
    if (raw === 'zh' || raw.startsWith('zh-')) return 'zh_CN';
    return raw.split('-')[0];
}

function resolveLocale(langSetting) {
    const raw = langSetting && langSetting !== 'auto'
        ? langSetting
        : (navigator.language || 'en');
    const lang = normalizeLocaleCode(raw);
    return LANGUAGES.some((l) => l.code === lang && l.code !== 'auto') ? lang : 'en';
}

/**
 * Применяет язык ко всему интерфейсу:
 *  1) загружает словарь _locales/<lang>/messages.json,
 *  2) заменяет тексты в статической разметке (data-i18n),
 *  3) перерисовывает динамические части (контекстные меню, списки).
 * Вызывается при старте и при смене языка пользователем.
 */
async function applyLocale(langSetting) {
    const lang = resolveLocale(langSetting);
    // Словарь лежит рядом со страницей расширения — fetch отдаст его
    // из пакета расширения без сети
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const response = await fetch(url);
    currentMessages = await response.json();
    document.documentElement.lang = lang;

    // Статическая разметка: <h1 data-i18n="pageTitle">
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = t(el.dataset.i18n);
    });
    // Плейсхолдеры полей: data-i18n-placeholder="searchPlaceholder"
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    // Aria-подписи кнопок без текста
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
        el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
    document.title = t('pageTitle');

    // Подпись кнопки темы содержит переведённое слово — обновляем
    const selectedThemeName = document.getElementById('selected-theme-name');
    if (selectedThemeName) {
        selectedThemeName.textContent = themeLabel(currentThemeMode);
    }

    // Динамические списки перерисовываем, если главный модуль уже
    // зарегистрировал перерисовку и данные загружены
    if (uiRefresher) uiRefresher();
    return lang;
}

/**
 * Строит выпадающий список языков: пункт с флагом-картинкой и названием.
 * Пункты собираются из справочника LANGUAGES — добавили папку в
 * _locales и строку здесь — язык появился в списке.
 */
function buildLanguageMenu(container, currentLangCode, onPick) {
    if (!container) return;
    container.textContent = '';
    for (const lang of LANGUAGES) {
        const item = document.createElement('button');
        item.className = `dropdown-item${lang.code === currentLangCode ? ' selected' : ''}`;
        item.dataset.lang = lang.code;

        // Флаг — SVG-картинка (эмодзи-флаги Windows не рисует).
        // У 'auto' флага нет — оставляем пустой отступ, названия выравнены
        const flag = document.createElement('img');
        flag.className = 'flag-icon';
        if (lang.flag) {
            setImageSource(flag, chrome.runtime.getURL(lang.flag), '');
        } else {
            setImageSource(flag, '', '');
            flag.style.visibility = 'hidden';
        }
        item.appendChild(flag);

        const label = document.createElement('span');
        label.textContent = lang.name;
        item.appendChild(label);

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            onPick(lang.code);
            // Меню двух видов: у FAB-меню видимость управляется классом
            // hidden, у dropdown в модалке — классом open. Закрываем по типу:
            // dropdown'у hidden добавлять нельзя — .hidden { display: none
            // !important } перебьёт .open и меню больше не откроется.
            container.classList.remove('open');
            if (container.classList.contains('theme-menu')) {
                container.classList.add('hidden');
            }
        });
        container.appendChild(item);
    }
}
