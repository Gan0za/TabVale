const DEFAULT_SEARCH_ENGINES = [
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', logo: 'https://icons.duckduckgo.com/ip3/duckduckgo.com.ico', selected: true },
    { name: 'Google', url: 'https://www.google.com/search?q=%s', logo: 'https://www.google.com/favicon.ico', selected: false },
    { name: 'Bing', url: 'https://www.bing.com/search?q=%s', logo: 'https://www.bing.com/favicon.ico', selected: false },
];

const DEFAULT_BOOKMARKS = [
    { title: 'GitHub', url: 'https://github.com', icon: 'https://github.com/favicon.ico' },
    { title: 'Google', url: 'https://www.gogle.com', icon: 'https://www.gogle.com/favicon.ico' }
];

const DEFAULT_BACKGROUNDS = [
    { title: 'По умолчанию', url: '' }
];

// Кэш для изображений
const imageCache = {};

// Функция для загрузки изображения и конвертации в base64
async function loadImageAsBase64(url) {
    if (!url) return '';
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Попытка обойти CORS
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const dataURL = canvas.toDataURL('image/png');
                resolve(dataURL);
            } catch (error) {
                console.error('Error converting image to base64:', error);
                resolve('');
            }
        };
        img.onerror = () => {
            resolve('');
        };
        img.src = url;
    });
}

// Функция для получения изображения из кэша или загрузки
async function getCachedImage(url) {
    if (!url) return '';
    if (imageCache[url]) {
        return imageCache[url];
    }
    // Проверяем chrome.storage
    const result = await new Promise(resolve => chrome.storage.local.get([url], resolve));
    if (result[url]) {
        imageCache[url] = result[url];
        return result[url];
    }
    // Загружаем и кэшируем
    const base64 = await loadImageAsBase64(url);
    if (base64) {
        imageCache[url] = base64;
        chrome.storage.local.set({ [url]: base64 });
    }
    return base64;
}

function saveState({ searchEngines, bookmarks, backgrounds, currentBackgroundIndex, currentSearchEngineIndex }) {
    const payload = {};
    if (searchEngines) payload.searchEngines = searchEngines;
    if (bookmarks) payload.bookmarks = bookmarks;
    if (backgrounds) payload.backgrounds = backgrounds;
    if (currentBackgroundIndex !== undefined) payload.currentBackgroundIndex = currentBackgroundIndex;
    if (currentSearchEngineIndex !== undefined) payload.currentSearchEngineIndex = currentSearchEngineIndex;
    chrome.storage.sync.set(payload);
}

function getState(callback) {
    chrome.storage.sync.get(['searchEngines', 'bookmarks', 'backgrounds', 'currentBackgroundIndex', 'currentSearchEngineIndex'], (result) => {
        const backgrounds = result.backgrounds || DEFAULT_BACKGROUNDS;
        const currentBackgroundIndex = result.currentBackgroundIndex !== undefined ? result.currentBackgroundIndex : 0;
        const searchEngines = result.searchEngines || DEFAULT_SEARCH_ENGINES;
        const currentSearchEngineIndex = result.currentSearchEngineIndex !== undefined ? result.currentSearchEngineIndex : 0;
        callback({
            searchEngines,
            bookmarks: result.bookmarks || DEFAULT_BOOKMARKS,
            backgrounds,
            currentBackgroundIndex,
            currentSearchEngineIndex
        });
    });
}

function buildBookmarkTile(bookmark, index) {
    const el = document.createElement('div');
    el.className = 'bookmark';
    el.draggable = true;
    el.dataset.index = index;
    const iconUrl = bookmark.icon || `https://${new URL(bookmark.url).hostname}/favicon.ico`;
    el.innerHTML = `
        <div class="bookmark-actions">
            <button class="edit-bookmark" data-index="${index}" type="button" aria-label="Редактировать закладку">✎</button>
            <button class="delete-bookmark" data-index="${index}" type="button" aria-label="Удалить закладку">×</button>
        </div>
        <a href="${bookmark.url}" target="_self" rel="noreferrer" class="bookmark-link" draggable="false">
            <img src="" alt="icon" draggable="false" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIGZpbGw9IiNkZGQiIHJ4PSI4Ii8+PHRleHQgeD0iMjQiIHk9IjI2IiBmb250LXNpemU9IjI0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4/PC90ZXh0Pjwvc3ZnPg==';">
            <div class="bookmark-title">${bookmark.title}</div>
        </a>
    `;
    // Асинхронно загружаем иконку
    getCachedImage(iconUrl).then(base64 => {
        const img = el.querySelector('img');
        if (img && base64) {
            img.src = base64;
        }
    });
    return el;
}
//     return el;
// }

function renderSearchEngines(select, engines, selectedIndex) {
    select.innerHTML = '';
    if (selectedIndex === undefined || selectedIndex < 0 || selectedIndex >= engines.length) {
        selectedIndex = 0;
    }
    engines.forEach((engine, index) => {
        const option = document.createElement('option');
        option.value = engine.url;
        option.textContent = engine.name;
        if (index === selectedIndex) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

async function renderBookmarks(container, bookmarks) {
    container.innerHTML = '';
    for (const bookmark of bookmarks) {
        const tile = buildBookmarkTile(bookmark, bookmarks.indexOf(bookmark));
        container.appendChild(tile);
    }
}

function renderBookmarkManagerList(container, bookmarks) {
    if (!container) return;

    container.innerHTML = '';
    if (!bookmarks.length) {
        container.innerHTML = '<div class="modal-list-empty">Список закладок пока пуст.</div>';
        return;
    }

    bookmarks.forEach(async (bookmark, index) => {
        const iconUrl = bookmark.icon || `https://${new URL(bookmark.url).hostname}/favicon.ico`;
        const base64 = await getCachedImage(iconUrl);
        const item = document.createElement('div');
        item.className = 'modal-list-item';
        item.innerHTML = `
            <img src="${base64 || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjUiIGN5PSIyNSIgcj0iMjUiIGZpbGw9IiNjY2MiLz4KPHRleHQgeD0iMjUiIHk9IjMwIiBmb250LXNpemU9IjE1IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5OP0wvdGV4dD4KPHN2Zz4='}" alt="${bookmark.title}">
            <div class="item-info">
                <div class="modal-list-text">
                    <strong>${bookmark.title}</strong>
                    <span>${bookmark.url}</span>
                </div>
                <div class="modal-list-actions">
                    <button class="bookmark-manage-edit" data-index="${index}" type="button">Ред.</button>
                    <button class="bookmark-manage-delete" data-index="${index}" type="button">Удалить</button>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

function renderBackgroundManagerList(container, backgrounds, currentBackgroundIndex) {
    if (!container) return;

    container.innerHTML = '';
    if (!backgrounds.length) {
        container.innerHTML = '<div class="modal-list-empty">Список фонов пока пуст.</div>';
        return;
    }

    backgrounds.forEach(async (background, index) => {
        const base64 = background.url ? await getCachedImage(background.url) : '';
        const item = document.createElement('div');
        item.className = `modal-list-item ${index === currentBackgroundIndex ? 'selected' : ''}`;
        item.innerHTML = `
            ${background.url ? `<img src="${base64 || background.url}" alt="${background.title}">` : '<div style="width:50px;height:50px;background:#ccc;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#666;font-size:12px;">Нет</div>'}
            <div class="item-info">
                <div class="modal-list-text">
                    <strong>${background.title}</strong>
                    <span>${background.url || 'По умолчанию'}</span>
                </div>
                <div class="modal-list-actions">
                    <button class="background-manage-select" data-index="${index}" type="button">Выбрать</button>
                    <button class="background-manage-edit" data-index="${index}" type="button">Ред.</button>
                    <button class="background-manage-delete" data-index="${index}" type="button">Удалить</button>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

async function setBackground(backgrounds, currentBackgroundIndex) {
    const background = backgrounds[currentBackgroundIndex];
    if (background && background.url) {
        const base64 = await getCachedImage(background.url);
        document.body.style.backgroundImage = `url('${base64 || background.url}')`;
    } else {
        document.body.style.backgroundImage = '';
    }
    document.body.style.backgroundSize = 'cover';
}

/**
 * Поиск логотипа для поисковой системы или закладки с обработкой ошибок
 * @param {string} urlString - URL для поиска логотипа
 * @returns {Promise<string>} - URL логотипа или пустая строка
 */
async function fetchLogoWithFallback(urlString) {
    try {
        const url = new URL(urlString);
        const domain = url.hostname;
        
        // Функция для проверки доступности изображения с timeout
        const checkImage = (imgUrl, timeout = 3000) => {
            return new Promise((resolve) => {
                const img = new Image();
                const timer = setTimeout(() => {
                    resolve(false);
                }, timeout);
                
                img.onload = () => {
                    clearTimeout(timer);
                    resolve(true);
                };
                
                img.onerror = () => {
                    clearTimeout(timer);
                    resolve(false);
                };
                
                img.src = imgUrl;
            });
        };

        // Массив источников для логотипов
        const logoSources = [
            { url: `https://${domain}/favicon.ico`, name: 'DirectIco' },
            { url: `https://${domain}/favicon.svg`, name: 'DirectSvg' },
            { url: `https://${domain}/favicon.png`, name: 'DirectPng' },
            { url: `https://icons.duckduckgo.com/ip3/${domain}.ico`, name: 'DuckDuckGo' },
            { url: `https://www.google.com/s2/favicons?domain=${domain}&sz=256`, name: 'Google' },
            { url: `https://www.google.com/favicon.ico`, name: 'Stock' },
        ];

        for (const source of logoSources) {
            try {
                const isValid = await checkImage(source.url);
                if (isValid) {
                    return source.url;
                }
            } catch (e) {
                // Продолжаем со следующего источника
                continue;
            }
        }
        
        return '';
    } catch (error) {
        console.error('Error fetching logo:', error);
        return '';
    }
}

function renderSearchEngineManagerList(container, searchEngines, selectedIndex) {
    if (!container) return;

    container.innerHTML = '';
    if (!searchEngines.length) {
        container.innerHTML = '<div class="modal-list-empty">Список поисковых систем пока пуст.</div>';
        return;
    }

    searchEngines.forEach(async (engine, index) => {
        const logoUrl = engine.logo || '';
        const base64 = logoUrl ? await getCachedImage(logoUrl) : '';
        const item = document.createElement('div');
        item.className = `modal-list-item ${index === selectedIndex ? 'selected' : ''}`;
        item.innerHTML = `
            ${logoUrl ? `<img src="${base64 || logoUrl}" alt="${engine.name}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjUiIGN5PSIyNSIgcj0iMjUiIGZpbGw9IiNlZWUiLz4KPHRleHQgeD0iMjUiIHk9IjMwIiBmb250LXNpemU9IjE4IiBmaWxsPSIjYWFhIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj4/PC90ZXh0Pjwvc3ZnPg==';">` : ''}
            ${!logoUrl ? `<div style="width:50px;height:50px;background:#eee;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:14px;font-weight:bold;">✕</div>` : ''}
            <div class="item-info">
                <div class="modal-list-text">
                    <strong>${engine.name}</strong>
                    <span>${engine.url}</span>
                </div>
                <div class="modal-list-actions">
                    <button class="search-engine-select" data-index="${index}" type="button">Выбрать</button>
                    <button class="search-engine-edit" data-index="${index}" type="button">Ред.</button>
                    <button class="search-engine-delete" data-index="${index}" type="button">Удалить</button>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

window.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const searchEngineSelect = document.getElementById('search-engine-select');
    const searchButton = document.getElementById('search-button');
    const bookmarksContainer = document.getElementById('bookmarks-container');

    const contextMenu = document.getElementById('custom-context-menu');
    const overlay = document.getElementById('overlay');

    const settingsModal = document.getElementById('settings-modal');
    const settingsButton = document.getElementById('settings-button');
    const closeSettingsButton = document.getElementById('close-settings');
    const exportSettingsJsonButton = document.getElementById('export-settings-json');
    const importSettingsJsonButton = document.getElementById('import-settings-json');
    const importSettingsFileInput = document.getElementById('import-settings-file');
    const settingsTabs = document.querySelectorAll('.settings-tab');
    const settingsPanes = document.querySelectorAll('.settings-pane');

    const bookmarkManagerList = document.getElementById('bookmark-manager-list');
    const bookmarkTitleInput = document.getElementById('bookmark-title-input');
    const bookmarkUrlInput = document.getElementById('bookmark-url-input');
    const bookmarkIconInput = document.getElementById('bookmark-icon-input');
    const findBookmarkLogoButton = document.getElementById('find-bookmark-logo');
    const saveBookmarkButton = document.getElementById('save-bookmark');

    const backgroundManagerList = document.getElementById('background-manager-list');
    const backgroundTitleInput = document.getElementById('background-title-input');
    const backgroundUrlInput = document.getElementById('background-url-input');
    const saveBackgroundButton = document.getElementById('save-background');

    const searchEnginesList = document.getElementById('search-engines-list');
    const newSearchEngineName = document.getElementById('new-search-engine-name');
    const newSearchEngineUrl = document.getElementById('new-search-engine-url');
    const newSearchEngineLogo = document.getElementById('new-search-engine-logo');
    const findSearchEngineLogoButton = document.getElementById('find-search-engine-logo');
    const addSearchEngineButton = document.getElementById('add-search-engine');

    let editingBackgroundIndex = null;
    let editingSearchEngineIndex = null;

    let currentState = { searchEngines: [], bookmarks: [], backgrounds: [], currentBackgroundIndex: 0, currentSearchEngineIndex: 0 };
    let editingBookmarkIndex = null;

    function resetBookmarkForm() {
        editingBookmarkIndex = null;
        bookmarkTitleInput.value = '';
        bookmarkUrlInput.value = '';
        bookmarkIconInput.value = '';
    }

    function resetBackgroundForm() {
        editingBackgroundIndex = null;
        backgroundTitleInput.value = '';
        backgroundUrlInput.value = '';
    }

    function resetSearchEngineForm() {
        editingSearchEngineIndex = null;
        newSearchEngineName.value = '';
        newSearchEngineUrl.value = '';
        newSearchEngineLogo.value = '';
    }

    function openSettingsModal(tab = 'bookmarks') {
        // Переключаемся на нужную вкладку
        settingsTabs.forEach(t => t.classList.remove('active'));
        settingsPanes.forEach(p => p.classList.remove('active'));
        
        const activeTab = document.querySelector(`.settings-tab[data-tab="${tab}"]`);
        const activePane = document.querySelector(`.settings-pane[data-pane="${tab}"]`);
        
        if (activeTab) activeTab.classList.add('active');
        if (activePane) activePane.classList.add('active');

        openModal(settingsModal);
        
        // Фокус на соответствующее поле ввода
        if (tab === 'bookmarks') {
            bookmarkTitleInput.focus();
        } else if (tab === 'backgrounds') {
            backgroundTitleInput.focus();
        } else if (tab === 'search-engines') {
            newSearchEngineName.focus();
        }
    }

    function closeSettingsModal() {
        closeModal(settingsModal);
        resetBookmarkForm();
        resetBackgroundForm();
        resetSearchEngineForm();
    }

    function openModal(modal) {
        modal.classList.remove('hidden');
        overlay.classList.remove('hidden');
    }

    function closeModal(modal) {
        modal.classList.add('hidden');
        overlay.classList.add('hidden');
    }

    function openContextMenu(x, y) {
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        contextMenu.classList.remove('hidden');
    }

    function closeContextMenu() {
        contextMenu.classList.add('hidden');
    }

    async function refreshUI() {
        renderSearchEngines(searchEngineSelect, currentState.searchEngines, currentState.currentSearchEngineIndex);
        await renderBookmarks(bookmarksContainer, currentState.bookmarks);
        await renderBookmarkManagerList(bookmarkManagerList, currentState.bookmarks);
        await renderBackgroundManagerList(backgroundManagerList, currentState.backgrounds, currentState.currentBackgroundIndex);
        await renderSearchEngineManagerList(searchEnginesList, currentState.searchEngines, currentState.currentSearchEngineIndex);
        await setBackground(currentState.backgrounds, currentState.currentBackgroundIndex);
    }

    getState(async (state) => {
        currentState = state;
        await refreshUI();
    });

    function runSearch() {
        const query = searchInput.value.trim();
        if (!query) return;
        const template = searchEngineSelect.value;
        const url = template.replace('%s', encodeURIComponent(query));
        window.location.href = url;
    }

    searchButton.addEventListener('click', runSearch);

    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            runSearch();
        }
    });

    settingsButton.addEventListener('click', () => openSettingsModal('bookmarks'));

    closeSettingsButton.addEventListener('click', () => closeSettingsModal());

    // Экспорт настроек в JSON
    exportSettingsJsonButton.addEventListener('click', () => {
        const payload = {
            searchEngines: currentState.searchEngines,
            bookmarks: currentState.bookmarks,
            backgrounds: currentState.backgrounds,
            currentBackgroundIndex: currentState.currentBackgroundIndex,
            currentSearchEngineIndex: currentState.currentSearchEngineIndex
        };
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'self_tabs_settings.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Настройки экспортированы в self_tabs_settings.json');
    });

    // Импорт настроек из JSON
    importSettingsJsonButton.addEventListener('click', () => {
        // открыть диалог выбора файла
        importSettingsFileInput.click();
    });

    importSettingsFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const payload = JSON.parse(text);
            if (typeof payload !== 'object' || payload === null) {
                throw new Error('Неверный формат JSON');
            }
            // Применяем только известные поля
            const newState = { ...currentState };
            if (Array.isArray(payload.searchEngines)) newState.searchEngines = payload.searchEngines;
            if (Array.isArray(payload.bookmarks)) newState.bookmarks = payload.bookmarks;
            if (Array.isArray(payload.backgrounds)) newState.backgrounds = payload.backgrounds;
            if (typeof payload.currentBackgroundIndex === 'number') newState.currentBackgroundIndex = payload.currentBackgroundIndex;
            if (typeof payload.currentSearchEngineIndex === 'number') newState.currentSearchEngineIndex = payload.currentSearchEngineIndex;

            // Сохранение и перерисовка интерфейса
            saveState({
                searchEngines: newState.searchEngines,
                bookmarks: newState.bookmarks,
                backgrounds: newState.backgrounds,
                currentBackgroundIndex: newState.currentBackgroundIndex,
                currentSearchEngineIndex: newState.currentSearchEngineIndex
            });
            currentState = newState;
            await refreshUI();
            alert('Настройки импортированы из JSON');
        } catch (err) {
            alert('Ошибка импорта: ' + (err?.message || err));
        } finally {
            // Сброс значения файла, чтобы можно импортировать повторно выбранный файл
            importSettingsFileInput.value = '';
        }
    });

    // Обработчики вкладок настроек
    settingsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            settingsTabs.forEach(t => t.classList.remove('active'));
            settingsPanes.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.querySelector(`.settings-pane[data-pane="${tabName}"]`).classList.add('active');
        });
    });

    saveBookmarkButton.addEventListener('click', async () => {
        const title = bookmarkTitleInput.value.trim();
        const rawUrl = bookmarkUrlInput.value.trim();
        const icon = bookmarkIconInput.value.trim();
        
        if (!title || !rawUrl) {
            alert('Введите название и URL.');
            return;
        }

        const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        let bookmarkData;

        try {
            const urlObj = new URL(normalizedUrl);
            bookmarkData = {
                title,
                url: normalizedUrl,
                icon: icon || `https://${urlObj.hostname}/favicon.ico`
            };
        } catch {
            alert('Введите корректный URL, например https://example.com');
            return;
        }

        if (editingBookmarkIndex !== null) {
            currentState.bookmarks[editingBookmarkIndex] = bookmarkData;
        } else {
            currentState.bookmarks.push(bookmarkData);
        }

        saveState({ bookmarks: currentState.bookmarks });
        await refreshUI();
        resetBookmarkForm();
    });

    findBookmarkLogoButton.addEventListener('click', async () => {
        const url = bookmarkUrlInput.value.trim();
        if (!url) {
            alert('Введите URL закладки.');
            return;
        }

        findBookmarkLogoButton.disabled = true;
        findBookmarkLogoButton.textContent = 'Поиск...';

        try {
            const logoUrl = await fetchLogoWithFallback(url);
            if (logoUrl) {
                bookmarkIconInput.value = logoUrl;
                alert('Логотип найден!');
            } else {
                alert('Не удалось найти логотип. Попробуйте указать URL вручную.');
            }
        } catch (error) {
            alert('Ошибка при поиске логотипа: ' + error.message);
        } finally {
            findBookmarkLogoButton.disabled = false;
            findBookmarkLogoButton.textContent = 'Найти логотип';
        }
    });

    saveBackgroundButton.addEventListener('click', async () => {
        const title = backgroundTitleInput.value.trim();
        const url = backgroundUrlInput.value.trim();

        if (!title) {
            alert('Введите название фона.');
            return;
        }

        const backgroundData = { title, url };

        if (editingBackgroundIndex !== null) {
            currentState.backgrounds[editingBackgroundIndex] = backgroundData;
        } else {
            currentState.backgrounds.push(backgroundData);
        }

        saveState({ backgrounds: currentState.backgrounds });
        await refreshUI();
        resetBackgroundForm();
    });

    addSearchEngineButton.addEventListener('click', async () => {
        const name = newSearchEngineName.value.trim();
        const url = newSearchEngineUrl.value.trim();
        const logo = newSearchEngineLogo.value.trim();

        if (!name || !url || !url.includes('%s')) {
            alert('Введите название и корректный URL с %s для запроса.');
            return;
        }

        const engineData = { name, url, logo };

        if (editingSearchEngineIndex !== null) {
            currentState.searchEngines[editingSearchEngineIndex] = engineData;
        } else {
            currentState.searchEngines.push(engineData);
        }

        saveState({ searchEngines: currentState.searchEngines });
        await refreshUI();
        resetSearchEngineForm();
    });

    findSearchEngineLogoButton.addEventListener('click', async () => {
        const url = newSearchEngineUrl.value.trim();
        if (!url) {
            alert('Введите URL поисковой системы.');
            return;
        }

        if (!url.includes('%s')) {
            alert('URL должен содержать %s для поиска.');
            return;
        }

        findSearchEngineLogoButton.disabled = true;
        findSearchEngineLogoButton.textContent = 'Поиск...';

        try {
            const logoUrl = await fetchLogoWithFallback(url);
            if (logoUrl) {
                newSearchEngineLogo.value = logoUrl;
                alert('Логотип найден!');
            } else {
                alert('Не удалось найти логотип. Попробуйте указать URL вручную.');
            }
        } catch (error) {
            alert('Ошибка при поиске логотипа: ' + error.message);
        } finally {
            findSearchEngineLogoButton.disabled = false;
            findSearchEngineLogoButton.textContent = 'Найти логотип';
        }
    });

    searchEnginesList.addEventListener('click', async (event) => {
        const selectButton = event.target.closest('.search-engine-select');
        if (selectButton) {
            const index = Number(selectButton.dataset.index);
            currentState.currentSearchEngineIndex = index;
            saveState({ currentSearchEngineIndex: currentState.currentSearchEngineIndex });
            await refreshUI();
            return;
        }

        const editButton = event.target.closest('.search-engine-edit');
        if (editButton) {
            const index = Number(editButton.dataset.index);
            const engine = currentState.searchEngines[index];
            if (!engine) return;
            
            editingSearchEngineIndex = index;
            newSearchEngineName.value = engine.name || '';
            newSearchEngineUrl.value = engine.url || '';
            newSearchEngineLogo.value = engine.logo || '';
            
            openSettingsModal('search-engines');
            newSearchEngineName.focus();
            return;
        }

        const deleteButton = event.target.closest('.search-engine-delete');
        if (!deleteButton) return;

        const index = Number(deleteButton.dataset.index);
        currentState.searchEngines.splice(index, 1);
        if (currentState.currentSearchEngineIndex >= currentState.searchEngines.length) {
            currentState.currentSearchEngineIndex = Math.max(0, currentState.searchEngines.length - 1);
        }
        saveState({ searchEngines: currentState.searchEngines, currentSearchEngineIndex: currentState.currentSearchEngineIndex });
        await refreshUI();
        resetSearchEngineForm();
    });

    overlay.addEventListener('click', () => {
        closeSettingsModal();
        closeContextMenu();
    });

    document.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        if (!overlay.classList.contains('hidden')) {
            closeContextMenu();
            return;
        }
        openContextMenu(event.pageX, event.pageY);
    });

    document.addEventListener('click', (event) => {
        if (!contextMenu.contains(event.target)) {
            closeContextMenu();
        }
    });

    contextMenu.addEventListener('click', (event) => {
        const action = event.target.getAttribute('data-action');
        if (!action) return;

        closeContextMenu();

        if (action === 'openSettings') {
            openSettingsModal('bookmarks');
        }
    });

    bookmarkManagerList.addEventListener('click', async (event) => {
        const editButton = event.target.closest('.bookmark-manage-edit');
        if (editButton) {
            const index = Number(editButton.dataset.index);
            const bookmark = currentState.bookmarks[index];
            if (!bookmark) return;
            
            editingBookmarkIndex = index;
            bookmarkTitleInput.value = bookmark.title || '';
            bookmarkUrlInput.value = bookmark.url || '';
            bookmarkIconInput.value = bookmark.icon || '';
            
            // Переключаемся на вкладку закладок
            openSettingsModal('bookmarks');
            bookmarkTitleInput.focus();
            return;
        }

        const deleteButton = event.target.closest('.bookmark-manage-delete');
        if (!deleteButton) return;

        const index = Number(deleteButton.dataset.index);
        currentState.bookmarks.splice(index, 1);
        saveState({ bookmarks: currentState.bookmarks });
        await refreshUI();
        resetBookmarkForm();
    });

    backgroundManagerList.addEventListener('click', async (event) => {
        const selectButton = event.target.closest('.background-manage-select');
        if (selectButton) {
            const index = Number(selectButton.dataset.index);
            currentState.currentBackgroundIndex = index;
            saveState({ currentBackgroundIndex: currentState.currentBackgroundIndex });
            await refreshUI();
            return;
        }

        const editButton = event.target.closest('.background-manage-edit');
        if (editButton) {
            const index = Number(editButton.dataset.index);
            const background = currentState.backgrounds[index];
            if (!background) return;
            
            editingBackgroundIndex = index;
            backgroundTitleInput.value = background.title || '';
            backgroundUrlInput.value = background.url || '';
            
            // Переключаемся на вкладку фонов
            openSettingsModal('backgrounds');
            backgroundTitleInput.focus();
            return;
        }

        const deleteButton = event.target.closest('.background-manage-delete');
        if (!deleteButton) return;

        const index = Number(deleteButton.dataset.index);
        currentState.backgrounds.splice(index, 1);
        if (currentState.currentBackgroundIndex >= currentState.backgrounds.length) {
            currentState.currentBackgroundIndex = Math.max(0, currentState.backgrounds.length - 1);
        }
        saveState({ backgrounds: currentState.backgrounds, currentBackgroundIndex: currentState.currentBackgroundIndex });
        await refreshUI();
        resetBackgroundForm();
    });

    bookmarksContainer.addEventListener('click', async (event) => {
        const editButton = event.target.closest('.edit-bookmark');
        if (editButton) {
            event.preventDefault();
            event.stopPropagation();
            const index = Number(editButton.dataset.index);
            const bookmark = currentState.bookmarks[index];
            if (!bookmark) return;
            
            editingBookmarkIndex = index;
            openSettingsModal('bookmarks');
            bookmarkTitleInput.value = bookmark.title || '';
            bookmarkUrlInput.value = bookmark.url || '';
            bookmarkIconInput.value = bookmark.icon || '';
            bookmarkTitleInput.focus();
            return;
        }

        const deleteButton = event.target.closest('.delete-bookmark');
        if (!deleteButton) return;

        event.preventDefault();
        event.stopPropagation();

        const index = Number(deleteButton.dataset.index);
        currentState.bookmarks.splice(index, 1);
        saveState({ bookmarks: currentState.bookmarks });
        await refreshUI();
    });

    // Drag and drop для закладок
    let draggedIndex = null;

    bookmarksContainer.addEventListener('dragstart', (event) => {
        const bookmarkElement = event.target.closest('.bookmark');
        if (!bookmarkElement) return;

        draggedIndex = Number(bookmarkElement.dataset.index);
        bookmarkElement.classList.add('dragging');

        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(draggedIndex));
        }
    });

    bookmarksContainer.addEventListener('dragend', (event) => {
        const bookmarkElement = event.target.closest('.bookmark');
        if (!bookmarkElement) return;
        bookmarkElement.classList.remove('dragging');
    });

    bookmarksContainer.addEventListener('dragover', (event) => {
        if (!event.target.closest('.bookmark')) return;
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    });

    bookmarksContainer.addEventListener('drop', (event) => {
        event.preventDefault();
        const target = event.target.closest('.bookmark');
        if (!target || draggedIndex === null) {
            draggedIndex = null;
            return;
        }

        const targetIndex = Number(target.dataset.index);
        if (Number.isNaN(targetIndex) || draggedIndex === targetIndex) {
            draggedIndex = null;
            return;
        }

        const [draggedBookmark] = currentState.bookmarks.splice(draggedIndex, 1);
        currentState.bookmarks.splice(targetIndex, 0, draggedBookmark);
        saveState({ bookmarks: currentState.bookmarks });
        refreshUI();
        draggedIndex = null;
    });
});
