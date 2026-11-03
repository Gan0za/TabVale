// =============================================================================
// Ядро: функции отрисовки (создание элементов на странице).
//
// Плитки закладок, дропдаун поисковиков, строки списков в настройках,
// применение фона к body, состав контекстных меню (чистая функция) и
// строковые хелперы названий поиска. Файл зависит от core/i18n.js
// (t) и core/storage.js (swatchDataUrl, backgroundPlacementCss,
// buildBackgroundCss, FALLBACK_ICON из config).
//
// Принцип безопасности: данные пользователя вставляются только через
// textContent — браузер покажет их как текст и не выполнит как код.
// =============================================================================


// =============================================================================
// 3. Функции отрисовки
// =============================================================================

/**
 * Возвращает URL иконки для закладки.
 * Порядок: своя иконка из настроек -> favicon сайта -> заглушка.
 * new URL() может упасть на битом адресе (например, после импорта
 * кривого файла), поэтому обёрнуто в try/catch.
 */
function getIconUrl(bookmark) {
    if (bookmark.icon) return bookmark.icon;
    try {
        return `https://${new URL(bookmark.url).hostname}/favicon.ico`;
    } catch {
        return FALLBACK_ICON;
    }
}

/**
 * Безопасно назначает картинку.
 * Если src пустой, атрибут не ставим вовсе: <img src=""> браузер
 * считает ссылкой на текущую страницу и зря делает лишний запрос.
 */
function setImageSource(img, src, fallback) {
    if (src) {
        img.src = src;
    }
    img.onerror = () => {
        if (fallback) {
            img.onerror = null; // защита от бесконечного цикла, если и заглушка не показалась
            img.src = fallback;
        } else {
            img.style.display = 'none';
        }
    };
}

/**
 * Создаёт плитку закладки на главной странице.
 * Использует createElement/textContent вместо innerHTML, чтобы
 * название или адрес закладки не могли выполнить посторонний код.
 */
function buildBookmarkTile(bookmark, index) {
    const el = document.createElement('div');
    el.className = 'bookmark';
    el.draggable = true;               // плитку можно перетаскивать (сортировка)
    el.dataset.index = index;          // запоминаем номер в списке для drag-n-drop
    el.dataset.url = bookmark.url;     // стабильный ключ для FLIP-анимации перестановки

    const img = document.createElement('img');
    img.alt = 'icon';
    img.draggable = false;
    setImageSource(img, getIconUrl(bookmark), FALLBACK_ICON);

    const link = document.createElement('a');
    link.href = bookmark.url;
    link.target = '_self';
    link.rel = 'noreferrer';
    link.className = 'bookmark-link';
    link.draggable = false;

    const title = document.createElement('div');
    title.className = 'bookmark-title';
    title.textContent = bookmark.title; // textContent = безопасно, innerHTML = нет

    link.appendChild(img);
    link.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'bookmark-actions';
    for (const [className, label, symbol] of [
        ['edit-bookmark', t('edit'), '✎'],
        ['delete-bookmark', t('delete'), '×'],
    ]) {
        const button = document.createElement('button');
        button.className = className;
        button.dataset.index = index;
        button.type = 'button';
        button.setAttribute('aria-label', label);
        button.textContent = symbol;
        actions.appendChild(button);
    }

    el.appendChild(actions);
    el.appendChild(link);
    return el;
}

/**
 * Отрисовывает кнопку и выпадающий список поисковых систем.
 */
function renderSearchEngineDropdown(engines, selectedIndex) {
    const iconEl = document.getElementById('selected-engine-icon');
    const nameEl = document.getElementById('selected-engine-name');
    const listContainer = document.getElementById('search-engine-list');

    // Список может опустеть (пользователь удалил все системы) — тогда
    // просто оставляем кнопку пустой вместо падения
    if (!engines.length) {
        iconEl.style.display = 'none';
        nameEl.textContent = '';
        listContainer.textContent = '';
        return;
    }

    // Индекс мог устареть (движок удалён) — тогда берём первый
    selectedIndex = (selectedIndex >= 0 && selectedIndex < engines.length) ? selectedIndex : 0;
    const selected = engines[selectedIndex];

    if (selected.logo) {
        iconEl.style.display = 'inline';
        setImageSource(iconEl, selected.logo, '');
    } else {
        iconEl.style.display = 'none';
    }
    nameEl.textContent = selected.name;

    // Собираем список заново при каждом вызове — данных немного,
    // зато код проще и всегда соответствует состоянию
    listContainer.textContent = '';
    engines.forEach((engine, index) => {
        const item = document.createElement('div');
        item.className = `dropdown-item${index === selectedIndex ? ' selected' : ''}`;
        // Ключ (URL с %s) храним в dataset — по нему найдём движок при клике
        item.dataset.url = engine.url;

        const img = document.createElement('img');
        setImageSource(img, engine.logo || '', '');

        const label = document.createElement('span');
        label.textContent = engine.name;

        item.appendChild(img);
        item.appendChild(label);
        listContainer.appendChild(item);
    });
}

/**
 * Отрисовывает плитки закладок на главной странице.
 */
function renderBookmarks(container, bookmarks) {
    if (!container) return;
    container.textContent = '';

    if (!bookmarks.length) {
        const empty = document.createElement('div');
        empty.className = 'bookmarks-empty';

        const text = document.createElement('p');
        text.textContent = t('emptyScreen');

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn empty-add-bookmark';
        button.textContent = t('emptyScreenAdd');

        empty.append(text, button);
        container.appendChild(empty);
        return;
    }

    bookmarks.forEach((bookmark, index) => {
        container.appendChild(buildBookmarkTile(bookmark, index));
    });
}

/**
 * Строка в списке внутри модалки настроек (закладка / фон / поисковик).
 * Общая для трёх списков: создаёт карточку и вешает на неё кнопки.
 *
 * @param {Object}   options
 * @param {Array}    options.buttons  — массив [css-класс, текст] для кнопок
 * @param {boolean}  options.selected — подсветить строку как активную
 * @param {?string}  options.imageUrl — картинка слева (иконка/превью)
 * @param {string}   options.emptyImageText — текст вместо картинки, если её нет
 * @param {string}   options.title    — заголовок строки
 * @param {string}   options.subtitle — вторая строка (обычно URL)
 * @param {number}   options.index    — номер в списке, передаётся в кнопки
 * @param {string}   options.rowType  — тип строки ('bookmark' | 'background' |
 *                     'searchEngine'); нужен контекстному меню, чтобы понять,
 *                     над какой строкой кликнули
 */
function buildManagerListItem({ buttons, selected, imageUrl, emptyImageText, title, subtitle, index, rowType }) {
    const item = document.createElement('div');
    item.className = `modal-list-item${selected ? ' selected' : ''}`;
    item.dataset.index = index;
    item.dataset.rowType = rowType;

    // Картинка слева: <img> либо заглушка "Нет"/"✕"
    let imageEl;
    if (imageUrl) {
        imageEl = document.createElement('img');
        setImageSource(imageEl, imageUrl, '');
    } else {
        imageEl = document.createElement('div');
        imageEl.className = 'no-preview no-logo';
        imageEl.textContent = emptyImageText;
    }
    // file-фоны подменяют заглушку на превью асинхронно: данные
    // pictures лежат в storage.local и приходят позже отрисовки
    if (rowType === 'background' && !imageUrl) {
        imageEl.dataset.fileThumb = index; // индекс для последующего поиска
    }

    const info = document.createElement('div');
    info.className = 'item-info';

    const text = document.createElement('div');
    text.className = 'modal-list-text';
    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    const subtitleEl = document.createElement('span');
    subtitleEl.textContent = subtitle;
    text.append(titleEl, subtitleEl);

    const actions = document.createElement('div');
    actions.className = 'modal-list-actions';
    for (const [className, label] of buttons) {
        const btn = document.createElement('button');
        btn.className = className;
        btn.type = 'button';
        btn.textContent = label;
        btn.dataset.index = index;
        actions.appendChild(btn);
    }

    info.append(text, actions);
    item.append(imageEl, info);
    return item;
}

/**
 * Состав контекстного меню для каждого типа элемента.
 * Вызывается по правому клику; возвращает список пунктов:
 * { action, label } — обычный пункт, { separator: true } — линия-разделитель.
 * Чистая функция без обращения к DOM — её легко проверить тестами.
 *
 * @param {string} type — 'bookmark' | 'background' | 'search' | 'settingsRow'
 * @param {Object} [data] — дополнительные данные: для 'search' — есть ли текст
 *                     в поле и в буфере обмена, для 'settingsRow' — есть ли
 *                     у строки кнопка "Выбрать"
 */
function getContextMenuItems(type, data = {}) {
    switch (type) {
        case 'bookmark':
            // Меню плитки закладки: действия над конкретной закладкой
            return [
                { action: 'editBookmark', label: t('edit') },
                { action: 'deleteBookmark', label: t('delete') },
                { action: 'moveBookmark', label: t('moveToScreen') },
                { action: 'openInNewTab', label: t('openInNewTab') },
                { action: 'copyLink', label: t('copyLink') },
                { separator: true },
                { action: 'openSettings', label: t('settings') },
            ];
        case 'screenTab':
            return [
                { action: 'screenRename', label: t('edit') },
                { action: 'screenDelete', label: t('delete') },
                { separator: true },
                { action: 'screenMoveLeft', label: t('moveLeft') },
                { action: 'screenMoveRight', label: t('moveRight') },
            ];
        case 'background':
            // Меню пустого фона: смена фона и переходы в настройки.
            // "Редактировать" открывает редактор текущего (выбранного) фона,
            // "Настройки" — под разделителем, как в меню плитки закладки.
            // "Редактировать" есть, если есть хоть один фон; "Следующий
            // фон" — только при двух и больше: с одним переключать нечего.
            // Если фонов нет, оба пункта скрываются
        {
            const items = [];
            if (data.hasBackgrounds) items.push({ action: 'editBackground', label: t('edit') });
            if (data.canSwitchBackground) {
                items.unshift({ action: 'nextBackground', label: t('nextBackground') });
            }
            items.push({ action: 'backgroundSettings', label: t('backgroundSettings') });
            items.push({ separator: true });
            items.push({ action: 'openSettings', label: t('settings') });
            return items;
        }
        case 'search':
            // Меню поля поиска — динамическое: состав зависит от того,
            // есть ли текст в поле (data.hasText) и в буфере обмена
            // (data.hasClipboardText). Пункты вставки скрываются, если
            // буфер пуст или недоступен. "Настройки" — под разделителем,
            // как в других меню
        {
            const items = [];
            if (data.hasClipboardText) {
                items.push({ action: 'pasteAndSearch', label: t('pasteAndSearch') });
                items.push({ action: 'pasteToSearch', label: t('paste') });
            }
            if (data.hasText) {
                items.push({ action: 'copySearch', label: t('copy') });
                items.push({ action: 'cutSearch', label: t('cut') });
                items.push({ action: 'clearSearch', label: t('clear') });
            }
            items.push({ action: 'searchEngineSettings', label: t('searchEngineSettings') });
            items.push({ separator: true });
            items.push({ action: 'openSettings', label: t('settings') });
            return items;
        }
        case 'settingsRow':
            // Меню строки в модалке настроек — повторяет её кнопки.
            // У закладок нет кнопки "Выбрать", поэтому пункт добавляется по флагу.
        {
            const items = [];
            if (data.selectable) items.push({ action: 'rowSelect', label: t('select') });
            items.push({ action: 'rowEdit', label: t('edit') });
            items.push({ action: 'rowDelete', label: t('delete') });
            return items;
        }
        case 'bookmarksEmpty':
            // Меню пустого места секции закладок. Динамическое: если в буфере
            // обмена корректный веб-адрес (data.hasClipboardUrl), первым идёт
            // пункт "Вставить и создать" — закладка добавится без формы
        {
            const items = [];
            if (data.hasClipboardUrl) {
                items.push({ action: 'pasteAndCreateBookmark', label: t('pasteAndCreate') });
            }
            items.push({ action: 'addBookmark', label: t('createBookmark') });
            items.push({ action: 'sortBookmarksAsc', label: t('sortAsc') });
            items.push({ action: 'sortBookmarksDesc', label: t('sortDesc') });
            items.push({ separator: true });
            items.push({ action: 'openSettings', label: t('settings') });
            return items;
        }
        default:
            return [];
    }
}

/**
 * Заполняет один из трёх списков в модалке настроек.
 */
function renderManagerList(container, items, buildItemFn) {
    if (!container) return;
    container.textContent = '';

    if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'modal-list-empty';
        empty.textContent = t('emptyList');
        container.appendChild(empty);
        return;
    }

    items.forEach((item, index) => container.appendChild(buildItemFn(item, index)));
}

function renderBookmarkManagerItem(bookmark, index) {
    return buildManagerListItem({
        buttons: [
            ['bookmark-manage-edit', t('editShort')],
            ['bookmark-manage-delete', t('delete')],
        ],
        selected: false,
        imageUrl: getIconUrl(bookmark),
        emptyImageText: '✕',
        title: bookmark.title,
        subtitle: bookmark.url,
        index,
        rowType: 'bookmark'
    });
}

function renderBackgroundManagerItem(background, index, currentIndex) {
    // Превью: цвет/градиент рисуются SVG-квадратиком, картинки — собой
    let subtitle;
    if (background.type === 'color') subtitle = background.value || '';
    else if (background.type === 'gradient') subtitle = `${background.from} → ${background.to}`;
    else if (background.type === 'file') subtitle = t('fileBackground');
    else subtitle = background.url || t('defaultBackground');

    return buildManagerListItem({
        buttons: [
            ['background-manage-select', t('select')],
            ['background-manage-edit', t('editShort')],
            ['background-manage-delete', t('delete')],
        ],
        selected: index === currentIndex,
        imageUrl: swatchDataUrlSafe(background) || background.url || null,
        emptyImageText: t('noImage'),
        title: background.title,
        subtitle,
        index,
        rowType: 'background'
    });
}

/**
 * swatchDataUrl обёрнут для устойчивости к отсутствию функции в тестах.
 */
function swatchDataUrlSafe(bg) {
    try {
        return swatchDataUrl(bg);
    } catch {
        return null;
    }
}

function renderSearchEngineManagerItem(engine, index, selectedIndex) {
    return buildManagerListItem({
        buttons: [
            ['search-engine-select', t('select')],
            ['search-engine-edit', t('editShort')],
            ['search-engine-delete', t('delete')],
        ],
        selected: index === selectedIndex,
        imageUrl: engine.logo || null,
        emptyImageText: '✕',
        title: engine.name,
        subtitle: engine.url,
        index,
        rowType: 'searchEngine'
    });
}

function screenDisplayTitle(screen) {
    if (!screen) return '';
    if (screen.titleKey === 'defaultScreen') {
        const label = t('defaultScreen');
        return label === 'defaultScreen' ? (screen.title || 'Главная') : label;
    }
    if (screen.titleKey === 'screenName') {
        const label = t('screenName', screen.titleVars || { n: 1 });
        return label === 'screenName' ? (screen.title || '') : label;
    }
    return screen.title || '';
}

function renderScreenManagerItem(screen, index, currentId) {
    return buildManagerListItem({
        buttons: [
            ['screen-manage-up', '↑'],
            ['screen-manage-down', '↓'],
            ['screen-manage-edit', t('editShort')],
            ['screen-manage-delete', t('delete')],
        ],
        selected: screen.id === currentId,
        imageUrl: null,
        emptyImageText: '▦',
        title: screenDisplayTitle(screen),
        subtitle: t('bookmarksCount', { n: screen.bookmarks.length }),
        index,
        rowType: 'screen'
    });
}

/**
 * Применяет выбранный фон к странице.
 * Для file-фона data:URL сначала читается из storage.local — применяем
 * асинхронно, когда данные придут.
 */
function setBackground(backgrounds, currentBackgroundIndex) {
    const background = backgrounds[currentBackgroundIndex];
    if (!background) {
        document.body.style.backgroundImage = '';
        return;
    }

    const isPicture = background.type === 'url' || background.type === 'file' || background.url;

    const apply = (cssValue) => {
        document.body.style.background = cssValue;
        // Свойство из CSS сбрасывается записью background — возвращаем,
        // чтобы фон не уезжал при прокрутке страницы
        document.body.style.backgroundAttachment = 'fixed';
        // Положение задаём только картинкам; заливки и градиенты
        // заполняют экран сами (сброс на значения по умолчанию из CSS)
        if (isPicture) {
            const placement = backgroundPlacementCss(background.position);
            document.body.style.backgroundSize = placement.size;
            document.body.style.backgroundPosition = placement.position;
            document.body.style.backgroundRepeat = placement.repeat;
        } else {
            document.body.style.backgroundSize = '';
            document.body.style.backgroundPosition = '';
            document.body.style.backgroundRepeat = '';
        }
    };

    if (background.type === 'color' || background.type === 'gradient') {
        apply(buildBackgroundCss(background));
        return;
    }

    if (background.type === 'file') {
        if (!background.fileId) { apply(''); return; }
        chrome.storage.local.get(fileKey(background.fileId), (result) => {
            const err = chrome.runtime?.lastError;
            apply(buildBackgroundCss(background, err ? '' : (result || {})[fileKey(background.fileId)]));
        });
        return;
    }

    apply(buildBackgroundCss(background));
}

/* Максимальная длина названия поисковика: длинное разрывало бы кнопку
   селектора; всё сверх лимита отрезается с многоточием */
const SEARCH_NAME_MAX = 24;

/**
 * Обрезает название поисковика до SEARCH_NAME_MAX символов, ставя
 * многоточие. Применяется при сохранении: в хранилище попадает уже
 * короткое имя, а подписи в UI дополнительно поджимаются CSS.
 */
function clampSearchName(name) {
    const trimmed = String(name).trim();
    if (trimmed.length <= SEARCH_NAME_MAX) return trimmed;
    return trimmed.slice(0, SEARCH_NAME_MAX - 1) + '…';
}

/**
 * Название по умолчанию из адреса: https://www.github.com -> Github.
 * Поддерживает адреса поисковиков с %s (шаблоны вида
 * https://www.google.com/search?q=%s) — %s отбрасывается до разбора.
 */
function suggestNameFromUrl(urlString) {
    try {
        const hostname = new URL(String(urlString).replace('%s', '')).hostname;
        const first = hostname.replace(/^www\./, '').split('.')[0];
        return first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
    } catch {
        return '';
    }
}

/**
 * Приводит адрес пользователя к виду с протоколом: "github.com" ->
 * "https://github.com". Возвращает '' для некорректных адресов.
 */
function normalizeUrl(rawUrl) {
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    try {
        new URL(url);
        return url;
    } catch {
        return '';
    }
}
