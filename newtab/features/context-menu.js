// =============================================================================
// Фича: собственные контекстные меню (правая кнопка мыши, long-press).
//
// Одно всплывающее меню на всю страницу; состав зависит от зоны клика
// (плитка, фон, поиск, пустая секция закладок, строки настроек).
// Пункты собирает чистая функция getContextMenuItems (core/render.js);
// асинхронные ветки чтения буфера защищены токеном contextMenuToken:
// устаревший ответ не перезаписывает актуальное меню, закрытие меню
// тоже инвалидирует ждущий ответ.
//
// Состояние (contextMenuData/contextMenuToken) и функции — на топ-уровне:
// их используют features/drag.js (showContextMenu на long-press) и
// бутстрап app.js (closeContextMenu в Escape).
// =============================================================================

// =============================================================================
// Собственные контекстные меню (правая кнопка мыши)
//
// Одно всплывающее меню на всю страницу, но его состав зависит от того,
// на каком элементе произошёл клик: у плитки закладки, пустого фона,
// поля поиска и строк настроек — свои наборы действий.
// =============================================================================

/**
 * Показывает меню с заданными пунктами в координатах клика.
 * Меню подстраивается под края экрана: рядом с правой или нижней
 * границей оно раскрывается внутрь, а не обрезается.
 */
function openContextMenu(x, y, items) {
    // Собираем меню заново на каждый клик — пункты зависят от элемента
    contextMenu.textContent = '';
    const list = document.createElement('ul');
    for (const item of items) {
        const li = document.createElement('li');
        if (item.separator) {
            li.className = 'separator';
        } else {
            li.textContent = item.label;
            li.dataset.action = item.action;
        }
        list.appendChild(li);
    }
    contextMenu.appendChild(list);

    // Сначала показываем меню невидимым, чтобы замерить его реальный
    // размер (он зависит от количества и длины пунктов)
    contextMenu.classList.remove('hidden');
    contextMenu.style.visibility = 'hidden';
    const menuWidth = contextMenu.offsetWidth;
    const menuHeight = contextMenu.offsetHeight;
    const margin = 8; // отступ от края экрана

    // Если меню не влезает вправо/вниз — сдвигаем влево/внутрь
    const left = Math.max(margin, Math.min(x, window.innerWidth - menuWidth - margin));
    const top = Math.max(margin, Math.min(y, window.innerHeight - menuHeight - margin));

    contextMenu.style.left = left + 'px';
    contextMenu.style.top = top + 'px';
    contextMenu.style.visibility = '';
}

// Префиксы css-классов кнопок строк настроек (см. buildManagerListItem):
// bookmark-manage-*, background-manage-*, search-engine-*
const ROW_BUTTON_PREFIX = {
    bookmark: 'bookmark-manage',
    background: 'background-manage',
    searchEngine: 'search-engine'
};

// Данные элемента, на котором открыли меню. Запоминаются в момент
// правого клика: когда пользователь выбирает пункт, под курсором
// уже сам пункт меню, и определять элемент заново было бы нельзя
let contextMenuData = {};
// Счётчик вызовов showContextMenu: пока асинхронный ответ (чтение
// буфера) ждёт, могли открыть другое меню — устаревший ответ
// отбрасывается по токену и не перезаписывает актуальное меню
let contextMenuToken = 0;

/**
 * Действия пунктов меню. Каждое действие — короткая функция,
 * переиспользующая уже существующую логику приложения.
 */
const contextActions = {
    openSettings: () => openSettingsModal('bookmarks'),
    backgroundSettings: () => openSettingsModal('backgrounds'),
    searchEngineSettings: () => openSettingsModal('search-engines'),

    editBookmark: (data) => startEditing(data.index, 'bookmark'),
    deleteBookmark: (data) => {
        currentState.bookmarks.splice(data.index, 1);
        saveState({ bookmarks: currentState.bookmarks });
        refreshUI();
    },
    // opener гасим: открытый сайт не должен получать ссылку на страницу
    // расширения (обратный табнабинг; у плиточных ссылок для этого
    // стоит rel="noreferrer")
    openInNewTab: (data) => window.open(data.url, '_blank', 'noopener,noreferrer'),
    // Без catch — unhandled rejection, если запись в буфер запрещена
    copyLink: (data) => navigator.clipboard.writeText(data.url).catch(() => {
        alert(t('copyFailed'));
    }),

    // Создание новой закладки: открываем форму закладок в настройках
    addBookmark: () => {
        openSettingsModal('bookmarks');
        hideAddForm('bookmark');      // сброс полей и флага редактирования
        showAddForm('bookmark');
    },
    // Сортировка плиток по алфавиту (регистронезависимо, по названию)
    sortBookmarksAsc: () => {
        currentState.bookmarks.sort((a, b) =>
            (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
        );
        saveState({ bookmarks: currentState.bookmarks });
        refreshUI();
    },
    // Тот же порядок, но наоборот (Я-А): сортируем по возрастанию
    // и разворачиваем результат
    sortBookmarksDesc: () => {
        currentState.bookmarks.sort((a, b) =>
            (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
        ).reverse();
        saveState({ bookmarks: currentState.bookmarks });
        refreshUI();
    },
    // Вставка адреса из буфера: уже проверен при показе меню
    // (isSafeWebUrl в data.clipboardUrl) — сразу добавляем закладку
    pasteAndCreateBookmark: (data) => {
        const url = (data.clipboardText || '').trim();
        if (!isSafeWebUrl(url)) return;
        let hostname;
        try { hostname = new URL(url).hostname; } catch { return; }
        currentState.bookmarks.push({
            title: hostname,
            url,
            icon: `https://${hostname}/favicon.ico`,
        });
        saveState({ bookmarks: currentState.bookmarks });
        refreshUI();
    },

    nextBackground: () => {
        if (!currentState.backgrounds.length) return;
        // "% length" — переход по кругу: последний фон сменяется первым
        currentState.currentBackgroundIndex =
            (currentState.currentBackgroundIndex + 1) % currentState.backgrounds.length;
        saveState({ currentBackgroundIndex: currentState.currentBackgroundIndex });
        refreshUI();
    },
    editBackground: () => {
        // Список фонов может опустеть (удалили все фоны) — редактировать нечего
        if (!currentState.backgrounds.length) return;
        // Открываем редактор того фона, который выбран сейчас
        startEditing(currentState.currentBackgroundIndex, 'background');
    },
    // Вставка из буфера в поле. Текст буфера уже прочитан к моменту
    // показа меню и лежит в data.clipboardText — читать буфер повторно не нужно
    pasteToSearch: (data) => {
        const text = (data.clipboardText || '').trim();
        if (!text) return;
        // Дописываем в конец; если поле пусто — просто кладём текст.
        // Пробел-разделитель нужен, чтобы слова не слиплись
        searchInput.value = searchInput.value ? searchInput.value + ' ' + text : text;
        searchInput.focus();
    },
    pasteAndSearch: (data) => {
        contextActions.pasteToSearch(data); // вставили...
        runSearch();                        // ...и сразу ищем
    },
    copySearch: () => {
        const text = searchInput.value;
        if (!text.trim()) return;
        navigator.clipboard.writeText(text).catch(() => {
            alert(t('copyFailed'));
        });
    },
    cutSearch: () => {
        const text = searchInput.value;
        if (!text.trim()) return;
        navigator.clipboard.writeText(text)
            .then(() => {
                searchInput.value = '';
                searchInput.focus();
            })
            .catch(() => {
                alert(t('cutFailed'));
            });
    },
    clearSearch: () => {
        searchInput.value = '';
        searchInput.focus();
    },

    // Действия строк настроек "нажимают" те же кнопки, что видны в строке.
    // Имя кнопки складывается из префикса строки (ROW_BUTTON_PREFIX)
    rowSelect: (data) => {
        const prefix = ROW_BUTTON_PREFIX[data.rowType];
        document.querySelector(`[data-row-type="${data.rowType}"][data-index="${data.index}"] .${prefix}-select`)?.click();
    },
    rowEdit: (data) => {
        const prefix = ROW_BUTTON_PREFIX[data.rowType];
        document.querySelector(`[data-row-type="${data.rowType}"][data-index="${data.index}"] .${prefix}-edit`)?.click();
    },
    rowDelete: (data) => {
        const prefix = ROW_BUTTON_PREFIX[data.rowType];
        document.querySelector(`[data-row-type="${data.rowType}"][data-index="${data.index}"] .${prefix}-delete`)?.click();
    },
};

/**
 * Определяет, над каким элементом кликнули, и возвращает
 * тип меню + данные (индекс закладки, URL и т.п.).
 */
function detectMenuTarget(target) {
    const bookmarkTile = target.closest('.bookmark');
    if (bookmarkTile) {
        const index = Number(bookmarkTile.dataset.index);
        return { type: 'bookmark', data: { index, url: currentState.bookmarks[index]?.url } };
    }

    // Клик по модалке настроек: интересуют только строки списков
    const settingsRow = target.closest('.modal-list-item');
    if (settingsRow) {
        return {
            type: 'settingsRow',
            data: {
                index: Number(settingsRow.dataset.index),
                rowType: settingsRow.dataset.rowType,
                selectable: !!settingsRow.querySelector('.search-engine-select, .background-manage-select'),
            }
        };
    }

    // Зона поиска: сама секция целиком (включая заголовок страницы —
    // он над поиском) плюс плитки закладок отдельно (см. ниже)
    const searchContainer = target.closest('#search-container');
    if (searchContainer) {
        return { type: 'search', data: { hasText: !!searchInput.value.trim() } };
    }
    if (target.closest('#main-container h1')) {
        return { type: 'search', data: { hasText: !!searchInput.value.trim() } };
    }

    // Пустое место секции закладок: клик по любой точке секции,
    // включая заголовок h2 (плитки перехвачены проверкой выше)
    if (target.closest('#bookmarks-section')) {
        return { type: 'bookmarksEmpty', data: {} };
    }

    // Всё остальное (пустое место, заголовки) считаем фоном страницы.
    // hasBackgrounds решает, показывать ли пункт правки, а
    // canSwitchBackground (нужно >= 2 фонов) — пункт смены фона
    const hasBackgrounds = currentState.backgrounds.length > 0;
    return {
        type: 'background',
        data: { hasBackgrounds, canSwitchBackground: currentState.backgrounds.length > 1 },
    };
}

// Правый клик: определяем элемент и показываем соответствующее меню
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (touchDrag) return; // посреди сенсорного переноса меню не открываем
    showContextMenu(e.clientX, e.clientY, e.target);
});

/**
 * Показывает контекстное меню для элемента target в координатах
 * вьюпорта (clientX, clientY). Общий вход для правого клика мыши и
 * для long-press на сенсорном экране. Асинхронные ветки (буфер
 * обмена) защищены токеном: устаревший ответ не открывает меню.
 */
function showContextMenu(clientX, clientY, target) {
    const modalOpen = !overlay.classList.contains('hidden');
    const { type, data } = detectMenuTarget(target);
    // При открытой модалке меню нужно только для её строк —
    // остальное уходит под оверлей
    if (modalOpen && type !== 'settingsRow') { closeContextMenu(); return; }
    const token = ++contextMenuToken;
    contextMenuData = data; // запоминаем для обработчика выбора пункта

    if (type === 'search') {
        // Состав меню поиска зависит от содержимого буфера обмена,
        // поэтому перед показом меню буфер нужно прочитать.
        // Чтение асинхронное — меню появляется с небольшой задержкой.
        // Если браузер запретил доступ к буферу, считаем его пустым:
        // пункты вставки просто не покажутся
        navigator.clipboard.readText()
            .catch(() => '')
            .then((text) => {
                // Пока читали буфер, могли открыть другое меню —
                // устаревший ответ не должен его перезаписать
                if (token !== contextMenuToken) return;
                data.clipboardText = text || '';
                data.hasClipboardText = !!data.clipboardText.trim();
                contextMenuData = data;
                openContextMenu(clientX, clientY, getContextMenuItems(type, data));
            });
        return;
    }

    if (type === 'bookmarksEmpty') {
        // Как и для поиска, состав меню зависит от буфера обмена:
        // если там безопасный веб-адрес, показываем "Вставить и создать"
        navigator.clipboard.readText()
            .catch(() => '')
            .then((text) => {
                if (token !== contextMenuToken) return; // открыли другое меню
                text = (text || '').trim();
                data.clipboardText = text;
                data.hasClipboardUrl = isSafeWebUrl(text);
                contextMenuData = data;
                openContextMenu(clientX, clientY, getContextMenuItems(type, data));
            });
        return;
    }

    openContextMenu(clientX, clientY, getContextMenuItems(type, data));
}



/**
 * Закрывает контекстное меню.
 * Закрытие (Esc, клик мимо) тоже инвалидирует ждущий асинхронный ответ:
 * иначе устаревшее чтение буфера переоткрыло бы меню.
 */
function closeContextMenu() {
    contextMenu.classList.add('hidden');
    contextMenuToken++;
}

/**
 * Вешает слушатели правого клика, клика мимо и выбора пункта.
 * Вызывается из бутстрапа app.js.
 */
function initContextMenu() {
    // Левый клик мимо меню закрывает его
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) closeContextMenu();
    });

    // Выбор пункта меню: выполняем действие с данными, запомненными
    // в момент правого клика (contextMenuData)
    contextMenu.addEventListener('click', (e) => {
        const action = e.target.getAttribute('data-action');
        if (!action || !contextActions[action]) return;
        closeContextMenu();
        contextActions[action](contextMenuData);
    });
}
