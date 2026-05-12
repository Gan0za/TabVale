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

const FALLBACK_ICON = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"%3E%3Ccircle cx="25" cy="25" r="20" fill="%23ccc"/%3E%3Ctext x="25" y="30" text-anchor="middle" fill="%23666" font-size="14"%3E%3F%3C/text%3E%3C/svg%3E';

function getIconUrl(bookmark) {
    return bookmark.icon || `https://${new URL(bookmark.url).hostname}/favicon.ico`;
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
        callback({
            searchEngines: result.searchEngines || DEFAULT_SEARCH_ENGINES,
            bookmarks: result.bookmarks || DEFAULT_BOOKMARKS,
            backgrounds: result.backgrounds || DEFAULT_BACKGROUNDS,
            currentBackgroundIndex: result.currentBackgroundIndex ?? 0,
            currentSearchEngineIndex: result.currentSearchEngineIndex ?? 0
        });
    });
}

function buildBookmarkTile(bookmark, index) {
    const el = document.createElement('div');
    el.className = 'bookmark';
    el.draggable = true;
    el.dataset.index = index;

    const img = document.createElement('img');
    img.alt = 'icon';
    img.draggable = false;
    img.src = getIconUrl(bookmark);
    img.onerror = () => { img.src = FALLBACK_ICON; };

    const link = document.createElement('a');
    link.href = bookmark.url;
    link.target = '_self';
    link.rel = 'noreferrer';
    link.className = 'bookmark-link';
    link.draggable = false;

    const title = document.createElement('div');
    title.className = 'bookmark-title';
    title.textContent = bookmark.title;

    link.appendChild(img);
    link.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'bookmark-actions';
    actions.innerHTML = `
        <button class="edit-bookmark" data-index="${index}" type="button" aria-label="Редактировать">✎</button>
        <button class="delete-bookmark" data-index="${index}" type="button" aria-label="Удалить">×</button>
    `;
    el.appendChild(actions);
    el.appendChild(link);
    return el;
}

function renderSearchEngines(select, engines, selectedIndex) {
    select.innerHTML = '';
    selectedIndex = (selectedIndex >= 0 && selectedIndex < engines.length) ? selectedIndex : 0;
    engines.forEach((engine, index) => {
        const option = document.createElement('option');
        option.value = engine.url;
        option.textContent = engine.name;
        if (index === selectedIndex) option.selected = true;
        select.appendChild(option);
    });
}

function renderBookmarks(container, bookmarks) {
    container.innerHTML = '';
    bookmarks.forEach((bookmark, index) => {
        container.appendChild(buildBookmarkTile(bookmark, index));
    });
}

async function renderManagerList(container, items, renderFn) {
    if (!container) return;
    container.innerHTML = '';

    if (!items.length) {
        container.innerHTML = '<div class="modal-list-empty">Список пуст.</div>';
        return;
    }

    for (const [index, item] of items.entries()) {
        const el = await renderFn(item, index);
        container.appendChild(el);
    }
}

function renderBookmarkManagerItem(bookmark, index) {
    const item = document.createElement('div');
    item.className = 'modal-list-item';
    item.innerHTML = `
        <img src="${getIconUrl(bookmark)}" alt="${bookmark.title}" onerror="this.src='${FALLBACK_ICON}'">
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
    return item;
}

function renderBackgroundManagerItem(background, index, currentIndex) {
    const item = document.createElement('div');
    item.className = `modal-list-item ${index === currentIndex ? 'selected' : ''}`;
    const preview = background.url
        ? `<img src="${background.url}" alt="${background.title}" onerror="this.style.display='none'">`
        : '<div class="no-preview">Нет</div>';
    item.innerHTML = `
        ${preview}
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
    return item;
}

function renderSearchEngineManagerItem(engine, index, selectedIndex) {
    const item = document.createElement('div');
    item.className = `modal-list-item ${index === selectedIndex ? 'selected' : ''}`;
    const logoHtml = engine.logo
        ? `<img src="${engine.logo}" alt="${engine.name}" onerror="this.style.display='none'">`
        : '<div class="no-logo">✕</div>';
    item.innerHTML = `
        ${logoHtml}
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
    return item;
}

function setBackground(backgrounds, currentBackgroundIndex) {
    const background = backgrounds[currentBackgroundIndex];
    if (background?.url) {
        document.body.style.backgroundImage = `url('${background.url}')`;
    } else {
        document.body.style.backgroundImage = '';
    }
    document.body.style.backgroundSize = 'cover';
}

async function fetchLogoWithFallback(urlString) {
    try {
        const url = new URL(urlString);
        const domain = url.hostname;

        const checkImage = (imgUrl, timeout = 3000) => {
            return new Promise((resolve) => {
                const img = new Image();
                const timer = setTimeout(() => resolve(false), timeout);
                img.onload = () => { clearTimeout(timer); resolve(true); };
                img.onerror = () => { clearTimeout(timer); resolve(false); };
                img.src = imgUrl;
            });
        };

        const sources = [
            `https://${domain}/favicon.ico`,
            `https://${domain}/favicon.svg`,
            `https://${domain}/favicon.png`,
            `https://icons.duckduckgo.com/ip3/${domain}.ico`,
            `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
        ];

        for (const src of sources) {
            if (await checkImage(src)) return src;
        }
        return '';
    } catch {
        return '';
    }
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

    let currentState = {
        searchEngines: DEFAULT_SEARCH_ENGINES,
        bookmarks: DEFAULT_BOOKMARKS,
        backgrounds: DEFAULT_BACKGROUNDS,
        currentBackgroundIndex: 0,
        currentSearchEngineIndex: 0
    };
    let editingBookmarkIndex = null;
    let editingBackgroundIndex = null;
    let editingSearchEngineIndex = null;

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
        settingsTabs.forEach(t => t.classList.remove('active'));
        settingsPanes.forEach(p => p.classList.remove('active'));
        document.querySelector(`.settings-tab[data-tab="${tab}"]`)?.classList.add('active');
        document.querySelector(`.settings-pane[data-pane="${tab}"]`)?.classList.add('active');
        settingsModal.classList.remove('hidden');
        overlay.classList.remove('hidden');

        const focusMap = { bookmarks: bookmarkTitleInput, backgrounds: backgroundTitleInput, 'search-engines': newSearchEngineName };
        focusMap[tab]?.focus();
    }

    function closeSettingsModal() {
        settingsModal.classList.add('hidden');
        overlay.classList.add('hidden');
        resetBookmarkForm();
        resetBackgroundForm();
        resetSearchEngineForm();
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
        renderBookmarks(bookmarksContainer, currentState.bookmarks);
        await renderManagerList(bookmarkManagerList, currentState.bookmarks, renderBookmarkManagerItem);
        await renderManagerList(backgroundManagerList, currentState.backgrounds, (bg, idx) => renderBackgroundManagerItem(bg, idx, currentState.currentBackgroundIndex));
        await renderManagerList(searchEnginesList, currentState.searchEngines, (eng, idx) => renderSearchEngineManagerItem(eng, idx, currentState.currentSearchEngineIndex));
        setBackground(currentState.backgrounds, currentState.currentBackgroundIndex);
    }

    getState(async (state) => {
        currentState = state;
        await refreshUI();
    });

    function runSearch() {
        const query = searchInput.value.trim();
        if (!query) return;
        const url = searchEngineSelect.value.replace('%s', encodeURIComponent(query));
        window.location.href = url;
    }

    searchButton.addEventListener('click', runSearch);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });
    settingsButton.addEventListener('click', () => openSettingsModal('bookmarks'));
    closeSettingsButton.addEventListener('click', closeSettingsModal);
    overlay.addEventListener('click', closeSettingsModal);

    exportSettingsJsonButton.addEventListener('click', () => {
        const json = JSON.stringify(currentState, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'self_tabs_settings.json';
        a.click();
        URL.revokeObjectURL(a.href);
    });

    importSettingsJsonButton.addEventListener('click', () => importSettingsFileInput.click());
    importSettingsFileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const payload = JSON.parse(await file.text());
            const newState = { ...currentState };
            if (Array.isArray(payload.searchEngines)) newState.searchEngines = payload.searchEngines;
            if (Array.isArray(payload.bookmarks)) newState.bookmarks = payload.bookmarks;
            if (Array.isArray(payload.backgrounds)) newState.backgrounds = payload.backgrounds;
            if (typeof payload.currentBackgroundIndex === 'number') newState.currentBackgroundIndex = payload.currentBackgroundIndex;
            if (typeof payload.currentSearchEngineIndex === 'number') newState.currentSearchEngineIndex = payload.currentSearchEngineIndex;
            saveState(newState);
            currentState = newState;
            await refreshUI();
            alert('Настройки импортированы');
        } catch (err) {
            alert('Ошибка импорта: ' + err.message);
        } finally {
            importSettingsFileInput.value = '';
        }
    });

    settingsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            settingsTabs.forEach(t => t.classList.remove('active'));
            settingsPanes.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.querySelector(`.settings-pane[data-pane="${tabName}"]`)?.classList.add('active');
        });
    });

    saveBookmarkButton.addEventListener('click', async () => {
        const title = bookmarkTitleInput.value.trim();
        const rawUrl = bookmarkUrlInput.value.trim();
        const icon = bookmarkIconInput.value.trim();

        if (!title || !rawUrl) { alert('Введите название и URL.'); return; }

        const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        let urlObj;
        try { urlObj = new URL(normalizedUrl); } catch { alert('Введите корректный URL.'); return; }

        const bookmarkData = { title, url: normalizedUrl, icon: icon || `https://${urlObj.hostname}/favicon.ico` };

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
        if (!url) { alert('Введите URL закладки.'); return; }
        findBookmarkLogoButton.disabled = true;
        findBookmarkLogoButton.textContent = 'Поиск...';
        try {
            const logoUrl = await fetchLogoWithFallback(url);
            if (logoUrl) {
                bookmarkIconInput.value = logoUrl;
                alert('Логотип найден!');
            } else {
                alert('Логотип не найден.');
            }
        } finally {
            findBookmarkLogoButton.disabled = false;
            findBookmarkLogoButton.textContent = 'Найти логотип';
        }
    });

    saveBackgroundButton.addEventListener('click', async () => {
        const title = backgroundTitleInput.value.trim();
        if (!title) { alert('Введите название.'); return; }
        const backgroundData = { title, url: backgroundUrlInput.value.trim() };

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

        if (!name || !url || !url.includes('%s')) { alert('Введите название и URL с %s.'); return; }

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
        if (!url || !url.includes('%s')) { alert('Введите URL с %s.'); return; }
        findSearchEngineLogoButton.disabled = true;
        findSearchEngineLogoButton.textContent = 'Поиск...';
        try {
            const logoUrl = await fetchLogoWithFallback(url);
            if (logoUrl) {
                newSearchEngineLogo.value = logoUrl;
                alert('Логотип найден!');
            } else {
                alert('Логотип не найден.');
            }
        } finally {
            findSearchEngineLogoButton.disabled = false;
            findSearchEngineLogoButton.textContent = 'Найти логотип';
        }
    });

    searchEnginesList.addEventListener('click', async (e) => {
        const selectBtn = e.target.closest('.search-engine-select');
        if (selectBtn) {
            currentState.currentSearchEngineIndex = Number(selectBtn.dataset.index);
            saveState({ currentSearchEngineIndex: currentState.currentSearchEngineIndex });
            await refreshUI();
            return;
        }

        const editBtn = e.target.closest('.search-engine-edit');
        if (editBtn) {
            const idx = Number(editBtn.dataset.index);
            const engine = currentState.searchEngines[idx];
            editingSearchEngineIndex = idx;
            newSearchEngineName.value = engine.name || '';
            newSearchEngineUrl.value = engine.url || '';
            newSearchEngineLogo.value = engine.logo || '';
            openSettingsModal('search-engines');
            return;
        }

        const deleteBtn = e.target.closest('.search-engine-delete');
        if (deleteBtn) {
            const idx = Number(deleteBtn.dataset.index);
            currentState.searchEngines.splice(idx, 1);
            if (currentState.currentSearchEngineIndex >= currentState.searchEngines.length) {
                currentState.currentSearchEngineIndex = Math.max(0, currentState.searchEngines.length - 1);
            }
            saveState({ searchEngines: currentState.searchEngines, currentSearchEngineIndex: currentState.currentSearchEngineIndex });
            await refreshUI();
        }
    });

    bookmarkManagerList.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.bookmark-manage-edit');
        if (editBtn) {
            const idx = Number(editBtn.dataset.index);
            const bookmark = currentState.bookmarks[idx];
            editingBookmarkIndex = idx;
            bookmarkTitleInput.value = bookmark.title || '';
            bookmarkUrlInput.value = bookmark.url || '';
            bookmarkIconInput.value = bookmark.icon || '';
            openSettingsModal('bookmarks');
            return;
        }

        const deleteBtn = e.target.closest('.bookmark-manage-delete');
        if (deleteBtn) {
            currentState.bookmarks.splice(Number(deleteBtn.dataset.index), 1);
            saveState({ bookmarks: currentState.bookmarks });
            await refreshUI();
        }
    });

    backgroundManagerList.addEventListener('click', async (e) => {
        const selectBtn = e.target.closest('.background-manage-select');
        if (selectBtn) {
            currentState.currentBackgroundIndex = Number(selectBtn.dataset.index);
            saveState({ currentBackgroundIndex: currentState.currentBackgroundIndex });
            await refreshUI();
            return;
        }

        const editBtn = e.target.closest('.background-manage-edit');
        if (editBtn) {
            const idx = Number(editBtn.dataset.index);
            const bg = currentState.backgrounds[idx];
            editingBackgroundIndex = idx;
            backgroundTitleInput.value = bg.title || '';
            backgroundUrlInput.value = bg.url || '';
            openSettingsModal('backgrounds');
            return;
        }

        const deleteBtn = e.target.closest('.background-manage-delete');
        if (deleteBtn) {
            currentState.backgrounds.splice(Number(deleteBtn.dataset.index), 1);
            if (currentState.currentBackgroundIndex >= currentState.backgrounds.length) {
                currentState.currentBackgroundIndex = Math.max(0, currentState.backgrounds.length - 1);
            }
            saveState({ backgrounds: currentState.backgrounds, currentBackgroundIndex: currentState.currentBackgroundIndex });
            await refreshUI();
        }
    });

    bookmarksContainer.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-bookmark');
        if (editBtn) {
            e.stopPropagation();
            const idx = Number(editBtn.dataset.index);
            const bookmark = currentState.bookmarks[idx];
            editingBookmarkIndex = idx;
            bookmarkTitleInput.value = bookmark.title || '';
            bookmarkUrlInput.value = bookmark.url || '';
            bookmarkIconInput.value = bookmark.icon || '';
            openSettingsModal('bookmarks');
            return;
        }

        const deleteBtn = e.target.closest('.delete-bookmark');
        if (deleteBtn) {
            e.stopPropagation();
            currentState.bookmarks.splice(Number(deleteBtn.dataset.index), 1);
            saveState({ bookmarks: currentState.bookmarks });
            await refreshUI();
        }
    });

    let draggedIndex = null;

    bookmarksContainer.addEventListener('dragstart', (e) => {
        const el = e.target.closest('.bookmark');
        if (!el) return;
        draggedIndex = Number(el.dataset.index);
        el.classList.add('dragging');
        e.dataTransfer?.setData('text/plain', String(draggedIndex));
    });

    bookmarksContainer.addEventListener('dragend', (e) => {
        e.target.closest('.bookmark')?.classList.remove('dragging');
    });

    bookmarksContainer.addEventListener('dragover', (e) => {
        if (e.target.closest('.bookmark')) e.preventDefault();
    });

    bookmarksContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        const target = e.target.closest('.bookmark');
        if (!target || draggedIndex === null) { draggedIndex = null; return; }

        const targetIndex = Number(target.dataset.index);
        if (Number.isNaN(targetIndex) || draggedIndex === targetIndex) { draggedIndex = null; return; }

        const [item] = currentState.bookmarks.splice(draggedIndex, 1);
        currentState.bookmarks.splice(targetIndex, 0, item);
        saveState({ bookmarks: currentState.bookmarks });
        await refreshUI();
        draggedIndex = null;
    });

    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!overlay.classList.contains('hidden')) { closeContextMenu(); return; }
        openContextMenu(e.pageX, e.pageY);
    });

    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) closeContextMenu();
    });

    contextMenu.addEventListener('click', (e) => {
        if (e.target.getAttribute('data-action') === 'openSettings') {
            closeContextMenu();
            openSettingsModal('bookmarks');
        }
    });
});