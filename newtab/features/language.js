// =============================================================================
// Фича: выбор языка интерфейса.
//
// Два переключателя: FAB 🌐 на главном экране и селектор в «Общих»
// настройках. Оба наполняются buildLanguageMenu из core/i18n.js.
// Код выполняется при загрузке файла (скрипт в конце <body>).
// Зависимости: core/state.js (refs), core/storage.js (storageGet/Set),
// core/i18n.js (LANGUAGES, resolveLocale, buildLanguageMenu, applyLocale,
// t), core/render.js (setImageSource), features/popovers.js.
// =============================================================================

const languageToggle = document.getElementById('language-toggle');
const languageMenu = document.getElementById('language-menu');
const languageButton = document.getElementById('language-button');
const languageList = document.getElementById('language-list');


/**
 * Показывает выбранный язык на кнопках обоих переключателей
 * (🌐 FAB и кнопка в «Общих» настройках).
 */
function updateLanguageButton(langSetting) {
    const lang = resolveLocale(langSetting);
    const info = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];
    const nameEl = document.getElementById('selected-language-name');
    const iconEl = document.getElementById('selected-language-icon');
    if (nameEl) {
        // Для 'auto' подписываем, что это язык браузера
        nameEl.textContent = langSetting === 'auto'
            ? `${info.name} (${t('langAuto')})`
            : info.name;
    }
    if (iconEl) {
        if (info.flag) {
            iconEl.classList.remove('hidden');
            setImageSource(iconEl, chrome.runtime.getURL(info.flag), '');
        } else {
            iconEl.classList.add('hidden');
        }
    }
    if (languageButton) languageButton.title = info.name;
}

/**
 * Смена языка: сохранить настройку и применить словарь на лету,
 * без перезагрузки страницы
 */
function changeLanguage(code) {
    storageSet({ lang: code });
    applyLocale(code).then(() => updateLanguageButton(code));
}


/**
 * Наполняет оба меню языками и вешает слушатели переключателей.
 * Вызывается из бутстрапа app.js.
 */
function initLanguage() {
    // Оба меню (🌐 и селектор в «Общих») наполняются одинаково
    storageGet('lang', (result) => {
        const langSetting = result.lang || 'auto';
        buildLanguageMenu(languageMenu, resolveLocale(langSetting), changeLanguage);
        buildLanguageMenu(languageList, resolveLocale(langSetting), changeLanguage);
        updateLanguageButton(langSetting);
    });

    languageToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllPopovers(languageMenu);
        languageMenu.classList.toggle('hidden');
        // При каждом открытии обновить подсветку текущего языка
        if (!languageMenu.classList.contains('hidden')) {
            storageGet('lang', (result) => {
                buildLanguageMenu(languageMenu, resolveLocale(result.lang || 'auto'), changeLanguage);
            });
        }
    });
    languageButton?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllPopovers(languageList);
        // dropdown-menu открывается классом open (display: none -> block);
        // hidden снят closeAllPopovers только у чужих меню — у своего его
        // и не было
        languageList.classList.toggle('open');
        if (languageList.classList.contains('open')) {
            storageGet('lang', (result) => {
                buildLanguageMenu(languageList, resolveLocale(result.lang || 'auto'), changeLanguage);
            });
        }
    });
    // Клик мимо меню языка закрывает его
    document.addEventListener('click', (e) => {
        if (!languageMenu.contains(e.target)) languageMenu.classList.add('hidden');
        if (!languageList.contains(e.target)) languageList.classList.remove('open');
    });
}
