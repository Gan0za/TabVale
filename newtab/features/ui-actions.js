// =============================================================================
// Фича: общие действия интерфейса.
//
// Слой общего назначения, используемый всеми доменами (закладки, фоны,
// поиск, настройки, контекстное меню):
//   - сброс и раскрытие форм добавления (двухшаговые формы)
//   - openSettingsModal/closeSettingsModal
//   - refreshUI — центральная перерисовка (зарегистрирована в i18n как
//     uiRefresher: applyLocale дёргает её при смене языка на лету)
//   - startEditing/deleteItem — правка и удаление элементов списков
//   - runSearch/getCurrentSearchUrl — переход по выбранному поисковику
// Код выполняется при загрузке файла; функции вызываются позже — из
// обработчиков и бутстрапа app.js.
// =============================================================================

function resetBookmarkForm() {
    editingBookmarkIndex = null;
    bookmarkUrlInput.value = '';
    collapseDetails(bookmarkDetails);
    bookmarkTitleInput.value = '';
    bookmarkIconInput.value = '';
    toggleBookmarkStep({ editing: false });
}

function resetBackgroundForm() {
    editingBackgroundIndex = null;
    backgroundTitleInput.value = '';
    switchBackgroundType('url');
    backgroundUrlInput.value = '';
    backgroundFileInput.value = '';
    backgroundPositionInput.value = 'cover';
    const previewBox = document.getElementById('background-file-preview');
    previewBox.classList.add('hidden');
    delete previewBox.dataset.pendingDataUrl; // кеш выбранного файла сброшен
    backgroundColorInput.value = '#4db6e2';
    updateColorValueLabel();
    applyGradientPreset(GRADIENT_PRESETS[0]);
    refreshUI();
}

function resetSearchEngineForm() {
    editingSearchEngineIndex = null;
    newSearchEngineUrl.value = '';
    collapseDetails(searchEngineDetails);
    newSearchEngineName.value = '';
    newSearchEngineLogo.value = '';
    toggleSearchEngineStep({ editing: false });
}

/**
 * Раскрывает/сворачивает блок полей второго шага (grid 0fr -> 1fr).
 */
function expandDetails(el) {
    el?.classList.add('open');
}

function collapseDetails(el) {
    el?.classList.remove('open');
}

/**
 * Переключает кнопки шага: на шаге 1 видна "Добавить", на шаге 2 —
 * "Сохранить". Признак editing заставляет форму открыться сразу
 * на втором шаге (правка существующего элемента).
 */
function toggleFormStep({ editing, addButton, saveButton }) {
    addButton.classList.toggle('hidden', editing);
    saveButton.classList.toggle('hidden', !editing);
}

function toggleBookmarkStep({ editing }) {
    toggleFormStep({ editing, addButton: addBookmarkButton, saveButton: saveBookmarkButton });
}

function toggleSearchEngineStep({ editing }) {
    toggleFormStep({ editing, addButton: addSearchEngineButton, saveButton: saveSearchEngineButton });
}

/**
 * Заголовок страницы по её адресу. Разрешение на конкретный сайт
 * запрашивается опционально (пользователь видит промт и может
 * отказать — тогда сразу предлагаем hostname). Если разрешение
 * выдано, страница скачивается через fetch и из её HTML берётся
 * <title>: с host-разрешением расширение может читать ответ, как
 * обычная страница. Никаких вкладок не открывается.
 * В любом случае поле заголовка остаётся редактируемым — предложение
 * можно стереть и вписать своё.
 */
async function fetchPageTitle(urlString) {
    try {
        const url = new URL(urlString);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
        const granted = await new Promise((resolve) => {
            chrome.permissions.request({ origins: [url.origin + '/*'] }, (ok) => {
                void chrome.runtime?.lastError;
                resolve(!!ok);
            });
        });
        if (!granted) return '';
        // Таймаут 5с: сайт может отвечать вечно — ждём его не дольше
        const response = await Promise.race([
            fetch(urlString),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]);
        if (!response.ok) return '';
        const html = await response.text();
        const title = new DOMParser().parseFromString(html, 'text/html').title;
        return title.trim();
    } catch {
        return '';
    }
}

/**
 * Заполняет поля второго шага формы: предлагает заголовок страницы
 * (hostname, если <title> недоступен) и адрес favicon.
 */
function fillBookmarkDetails(urlString) {
    const hostname = suggestNameFromUrl(urlString);
    bookmarkTitleInput.value = hostname;
    bookmarkIconInput.value = `https://${new URL(urlString).hostname}/favicon.ico`;
    // <title> получаем в фоне и подставляем, если пользователь ещё
    // не начал печатать своё название
    fetchPageTitle(urlString).then((title) => {
        if (title && !bookmarkTitleInput.value.trim()) {
            bookmarkTitleInput.value = title;
        }
    });
}

// --- Раскрывающиеся формы добавления ---
// Форма всегда в разметке, но свернута (grid-строка 0fr, см. styles.css).
// addForms связывает кнопку показа, саму форму и функцию сброса
// для каждого типа: 'bookmark' | 'background' | 'searchEngine'
const addForms = {
    bookmark: {
        showButton: document.getElementById('show-bookmark-form'),
        form: document.getElementById('bookmark-form'),
        reset: resetBookmarkForm,
    },
    background: {
        showButton: document.getElementById('show-background-form'),
        form: document.getElementById('background-form'),
        reset: resetBackgroundForm,
    },
    searchEngine: {
        showButton: document.getElementById('show-search-engine-form'),
        form: document.getElementById('search-engine-form'),
        reset: resetSearchEngineForm,
    },
};

// Показывает форму добавления, пряча кнопку "+ Добавить"
function showAddForm(form) {
    addForms[form].showButton.classList.add('hidden');
    addForms[form].form.classList.add('open'); // grid 0fr -> 1fr: плавное раскрытие
    // Сразу ставим курсор в первое поле — можно печатать
    addForms[form].form.querySelector('input')?.focus();
}

// Прячет форму и сбрасывает её поля
function hideAddForm(form) {
    addForms[form].showButton.classList.remove('hidden');
    addForms[form].form.classList.remove('open'); // плавное сворачивание
    addForms[form].reset();
}

function openSettingsModal(tab = 'bookmarks') {
    // Показываем нужную вкладку модалки и прячем остальные
    settingsTabs.forEach(t => t.classList.remove('active'));
    settingsPanes.forEach(p => p.classList.remove('active'));
    document.querySelector(`.settings-tab[data-tab="${tab}"]`)?.classList.add('active');
    document.querySelector(`.settings-pane[data-pane="${tab}"]`)?.classList.add('active');
    settingsModal.classList.remove('hidden');
    overlay.classList.remove('hidden');

    const focusMap = { bookmarks: bookmarkUrlInput, backgrounds: backgroundTitleInput, 'search-engines': newSearchEngineUrl };
    focusMap[tab]?.focus();
}

function closeSettingsModal() {
    settingsModal.classList.add('hidden');
    overlay.classList.add('hidden');
    hideAddForm('bookmark');
    hideAddForm('background');
    hideAddForm('searchEngine');
}


/**
 * Перерисовывает все списки по currentState.
 * Вызывается после каждого изменения данных.
 */
function refreshUI() {
    // Активный сенсорный перенос держит узел плитки: перерисовка
    // отвязала бы его от DOM, и плитка зависла бы fixed под пальцем
    endTouchDrag(false);
    renderSearchEngineDropdown(currentState.searchEngines, currentState.currentSearchEngineIndex);
    renderBookmarks(bookmarksContainer, currentState.bookmarks);
    renderManagerList(bookmarkManagerList, currentState.bookmarks, renderBookmarkManagerItem);
    renderManagerList(backgroundManagerList, currentState.backgrounds, (bg, idx) => renderBackgroundManagerItem(bg, idx, currentState.currentBackgroundIndex));
    renderManagerList(searchEnginesList, currentState.searchEngines, (eng, idx) => renderSearchEngineManagerItem(eng, idx, currentState.currentSearchEngineIndex));
    setBackground(currentState.backgrounds, currentState.currentBackgroundIndex);
    loadFileBackgroundThumbs();
}

/**
 * Дозагрузка превью file-фонов в списке настроек. Картинки хранятся
 * в storage.local, а отрисовка строки синхронная — поэтому строки с
 * заглушкой (data-file-thumb) дополняются миниатюрами, когда данные
 * придут из хранилища.
 */
function loadFileBackgroundThumbs() {
    const fileBackdrops = currentState.backgrounds
        .map((bg, index) => ({ bg, index }))
        .filter(({ bg }) => bg.type === 'file' && bg.fileId);
    if (!fileBackdrops.length) return;

    chrome.storage.local.get(
        fileBackdrops.map(({ bg }) => fileKey(bg.fileId)),
        (result) => {
            const err = chrome.runtime?.lastError;
            if (err) return;
            for (const { bg, index } of fileBackdrops) {
                const dataUrl = result[fileKey(bg.fileId)];
                if (!dataUrl) continue;
                // Строки перерисовываются целиком — ищем заглушку заново
                const row = backgroundManagerList.querySelector?.(
                    `.modal-list-item[data-index="${index}"]`
                );
                const placeholder = row?.querySelector?.('[data-file-thumb]');
                if (!placeholder) continue;
                const img = document.createElement('img');
                setImageSource(img, dataUrl, '');
                placeholder.replaceWith(img);
            }
        }
    );
}

// Смена языка на лету: applyLocale перерисовывает динамические списки
// через этот делегат (см. uiRefresher в начале файла)
uiRefresher = refreshUI;

/**
 * Заполняет поля формы данными выбранного элемента списка.
 * index — номер элемента в currentState; form — 'bookmark' | 'background' | 'searchEngine'.
 */
function startEditing(index, form) {
    const fillers = {
        bookmark: () => {
            editingBookmarkIndex = index;
            const b = currentState.bookmarks[index];
            bookmarkTitleInput.value = b.title || '';
            bookmarkUrlInput.value = b.url || '';
            bookmarkIconInput.value = b.icon || '';
        },
        background: () => {
            editingBackgroundIndex = index;
            const bg = currentState.backgrounds[index];
            backgroundTitleInput.value = bg.title || '';
            const type = bg.type || 'url';
            // Диалог файла нельзя заполнить программно: сбрасываем кеш
            // выбранного файла — превью прежней картинки покажет
            // showFilePreview (вызвается из switchBackgroundType)
            delete document.getElementById('background-file-preview').dataset.pendingDataUrl;
            switchBackgroundType(type);
            backgroundUrlInput.value = bg.url || '';
            backgroundFileInput.value = '';
            backgroundPositionInput.value = keyOfPlacement(bg.position);
            backgroundColorInput.value = bg.type === 'color' ? bg.value : '#4db6e2';
            updateColorValueLabel();
            if (bg.type === 'gradient') {
                gradientFromInput.value = bg.from || '#667eea';
                gradientToInput.value = bg.to || '#764ba2';
                gradientAngleInput.value = bg.angle ?? 160;
                updateGradientPreview();
            }
        },
        searchEngine: () => {
            editingSearchEngineIndex = index;
            const e = currentState.searchEngines[index];
            newSearchEngineName.value = e.name || '';
            newSearchEngineUrl.value = e.url || '';
            newSearchEngineLogo.value = e.logo || '';
        }
    };
    fillers[form]();
    showAddForm(form); // форма добавления — она же форма редактирования
    // Редактирование начинается сразу со второго шага: все поля
    // заполнены, видна кнопка "Сохранить"
    if (form === 'bookmark') {
        expandDetails(bookmarkDetails);
        toggleBookmarkStep({ editing: true });
    } else if (form === 'searchEngine') {
        expandDetails(searchEngineDetails);
        toggleSearchEngineStep({ editing: true });
    }
    // Имя вкладки модалки совпадает с ключом формы
    openSettingsModal(form === 'searchEngine' ? 'search-engines' : form + 's');
}

/**
 * Удаляет элемент списка по кнопке (с пересчётом выбранного индекса).
 * listKey — имя поля в currentState, indexKey — имя поля-индекса выбранного.
 * Для file-фонов попутно чистит bgFile:* в storage.local: без этого
 * картинки оставались в хранилище навсегда и засоряли квоту.
 */
function deleteItem(listKey, indexKey, index) {
    const removed = currentState[listKey].splice(index, 1)[0];
    // Если после удаления выбранный индекс вышел за пределы списка
    // (например, удалили последний фон), сдвигаем его к последнему элементу
    if (currentState[indexKey] >= currentState[listKey].length) {
        currentState[indexKey] = Math.max(0, currentState[listKey].length - 1);
    }
    saveState({ [listKey]: currentState[listKey], [indexKey]: currentState[indexKey] });
    // Чистка только когда удаляются именно фоны и это file-фон
    if (listKey === 'backgrounds' && removed?.type === 'file' && removed.fileId) {
        chrome.storage.local.remove(fileKey(removed.fileId));
    }
    refreshUI();
}

/**
 * URL поисковой системы, выбранной в данный момент.
 * Берём индекс из состояния, а не текст из кнопки: если у двух
 * систем одинаковое имя, поиск по имени дал бы неверный результат.
 */
function getCurrentSearchUrl() {
    const engine = currentState.searchEngines[currentState.currentSearchEngineIndex];
    return engine?.url || currentState.searchEngines[0]?.url || '';
}

/**
 * Подставляет поисковый запрос в URL выбранной системы и переходит.
 */
function runSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    // %s в шаблоне URL — место, куда вставляется запрос
    const url = getCurrentSearchUrl().replace('%s', encodeURIComponent(query));
    window.location.href = url;

}
