document.addEventListener('DOMContentLoaded', () => {
    const searchEnginesList = document.getElementById('search-engines-list');
    const addSearchEngineButton = document.getElementById('add-search-engine');
    const searchEngineNameInput = document.getElementById('new-search-engine-name');
    const searchEngineUrlInput = document.getElementById('new-search-engine-url');

    const bookmarkList = document.getElementById('bookmark-list');
    const addBookmarkButton = document.getElementById('add-bookmark');
    const bookmarkTitleInput = document.getElementById('new-bookmark-title');
    const bookmarkUrlInput = document.getElementById('new-bookmark-url');

    const DEFAULT_SEARCH_ENGINES = [
        { name: 'Google', url: 'https://www.google.com/search?q=%s' },
        { name: 'Bing', url: 'https://www.bing.com/search?q=%s' },
        { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' }
    ];

    const DEFAULT_BOOKMARKS = [
        { title: 'GitHub', url: 'https://github.com' },
        { title: 'Microsoft Edge', url: 'https://www.microsoft.com/edge' }
    ];

    function loadSettings(callback) {
        chrome.storage.sync.get(['searchEngines', 'bookmarks'], data => {
            callback({
                searchEngines: data.searchEngines || DEFAULT_SEARCH_ENGINES,
                bookmarks: data.bookmarks || DEFAULT_BOOKMARKS
            });
        });
    }

    function saveSettings(searchEngines, bookmarks) {
        chrome.storage.sync.set({ searchEngines, bookmarks });
    }

    function renderSearchEngines(searchEngines) {
        searchEnginesList.innerHTML = '';
        searchEngines.forEach((engine, index) => {
            const row = document.createElement('div');
            row.className = 'search-engine-item';
            row.innerHTML = `
                <div>${engine.name} — ${engine.url}</div>
                <button data-index="${index}" class="remove-engine">Удалить</button>
            `;
            searchEnginesList.appendChild(row);
        });
    }

    function renderBookmarks(bookmarks) {
        bookmarkList.innerHTML = '';
        bookmarks.forEach((bookmark, index) => {
            const row = document.createElement('div');
            row.className = 'search-engine-item';
            row.innerHTML = `
                <div>${bookmark.title} — ${bookmark.url}</div>
                <button data-index="${index}" class="remove-bookmark">Удалить</button>
            `;
            bookmarkList.appendChild(row);
        });
    }

    let searchEnginesStorage = [];
    let bookmarksStorage = [];

    loadSettings((state) => {
        searchEnginesStorage = state.searchEngines;
        bookmarksStorage = state.bookmarks;
        renderSearchEngines(searchEnginesStorage);
        renderBookmarks(bookmarksStorage);
    });

    searchEnginesList.addEventListener('click', (event) => {
        if (!event.target.classList.contains('remove-engine')) return;
        const idx = Number(event.target.dataset.index);
        searchEnginesStorage.splice(idx, 1);
        saveSettings(searchEnginesStorage, bookmarksStorage);
        renderSearchEngines(searchEnginesStorage);
    });

    bookmarkList.addEventListener('click', (event) => {
        if (!event.target.classList.contains('remove-bookmark')) return;
        const idx = Number(event.target.dataset.index);
        bookmarksStorage.splice(idx, 1);
        saveSettings(searchEnginesStorage, bookmarksStorage);
        renderBookmarks(bookmarksStorage);
    });

    addSearchEngineButton.addEventListener('click', () => {
        const name = searchEngineNameInput.value.trim();
        const url = searchEngineUrlInput.value.trim();
        if (!name || !url || !url.includes('%s')) {
            alert('Введите имя и URL с %s.');
            return;
        }
        searchEnginesStorage.push({ name, url });
        saveSettings(searchEnginesStorage, bookmarksStorage);
        renderSearchEngines(searchEnginesStorage);
        searchEngineNameInput.value = '';
        searchEngineUrlInput.value = '';
    });

    addBookmarkButton.addEventListener('click', () => {
        const title = bookmarkTitleInput.value.trim();
        const url = bookmarkUrlInput.value.trim();
        if (!title || !url) {
            alert('Введите название и ссылку закладки.');
            return;
        }
        bookmarksStorage.push({ title, url });
        saveSettings(searchEnginesStorage, bookmarksStorage);
        renderBookmarks(bookmarksStorage);
        bookmarkTitleInput.value = '';
        bookmarkUrlInput.value = '';
    });
});