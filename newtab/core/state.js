// =============================================================================
// Ядро: элементы страницы и текущее состояние приложения.
//
// Единое место деклараций, общих для всех фичевых модулей:
//   - ссылки на DOM-элементы (index.html). Скрипты подключаются в конце
//     <body>, поэтому элементы над ними уже существуют — grabbing можно
//     выполнять сразу при загрузке файла, не дожидаясь DOMContentLoaded;
//   - currentState — всё, что видит пользователь. Живёт в этом объекте
//     и синхронизируется с chrome.storage.sync при каждом изменении;
//   - индексы редактируемых элементов списков.
//
// Ссылки и состояние объявлены на топ-уровне: классические <script>
// шарят глобальную лексическую среду, поэтому фичевые файлы (theme,
// language, bookmarks, ...) видят те же привязки без передачи контекста.
// =============================================================================

// --- Элементы страницы (HTML-разметка в newtab/index.html) ---
const searchInput = document.getElementById('search-input');
const searchEngineDropdownBtn = document.getElementById('search-engine-button');
const searchEngineList = document.getElementById('search-engine-list');
const searchButton = document.getElementById('search-button');
const bookmarksContainer = document.getElementById('bookmarks-container');
const screenDots = document.getElementById('screen-dots');

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

// Форма закладок
const bookmarkManagerList = document.getElementById('bookmark-manager-list');
const bookmarkTitleInput = document.getElementById('bookmark-title-input');
const bookmarkUrlInput = document.getElementById('bookmark-url-input');
const bookmarkIconInput = document.getElementById('bookmark-icon-input');
const bookmarkDetails = document.getElementById('bookmark-details');
const addBookmarkButton = document.getElementById('add-bookmark');
const saveBookmarkButton = document.getElementById('save-bookmark');
const refreshBookmarkIconButton = document.getElementById('refresh-bookmark-icon');

// Форма фонов
const backgroundManagerList = document.getElementById('background-manager-list');
const backgroundTitleInput = document.getElementById('background-title-input');
const backgroundUrlInput = document.getElementById('background-url-input');
const saveBackgroundButton = document.getElementById('save-background');
const backgroundFileInput = document.getElementById('background-file-input');
const backgroundPositionRow = document.getElementById('background-position-row');
const backgroundPositionInput = document.getElementById('background-position-input');
const backgroundColorInput = document.getElementById('background-color-input');
const gradientFromInput = document.getElementById('gradient-from-input');
const gradientToInput = document.getElementById('gradient-to-input');
const gradientAngleInput = document.getElementById('gradient-angle-input');
const gradientPreview = document.getElementById('gradient-preview');
const gradientPresets = document.getElementById('gradient-presets');

// Форма поисковых систем
const searchEnginesList = document.getElementById('search-engines-list');
const newSearchEngineName = document.getElementById('new-search-engine-name');
const newSearchEngineUrl = document.getElementById('new-search-engine-url');
const newSearchEngineLogo = document.getElementById('new-search-engine-logo');
const searchEngineDetails = document.getElementById('search-engine-details');
const addSearchEngineButton = document.getElementById('add-search-engine');
const saveSearchEngineButton = document.getElementById('save-search-engine');
const refreshSearchEngineIconButton = document.getElementById('refresh-search-engine-icon');

// Экраны
const screensManagerList = document.getElementById('screens-manager-list');
const screenTitleInput = document.getElementById('screen-title-input');
const showScreenFormButton = document.getElementById('show-screen-form');
const screenForm = document.getElementById('screen-form');
const saveScreenButton = document.getElementById('save-screen');
const cancelScreenButton = document.getElementById('cancel-screen');
const bookmarkScreenSelect = document.getElementById('bookmark-screen-select');
const screenDeleteModal = document.getElementById('screen-delete-modal');
const screenDeleteText = document.getElementById('screen-delete-text');
const screenDeleteMoveButton = document.getElementById('screen-delete-move');
const screenDeleteAllButton = document.getElementById('screen-delete-all');
const screenDeleteCancelButton = document.getElementById('screen-delete-cancel');
const screenPickerModal = document.getElementById('screen-picker-modal');
const screenPickerList = document.getElementById('screen-picker-list');
const screenPickerCancelButton = document.getElementById('screen-picker-cancel');

// --- Текущее состояние приложения ---
let currentState = {
    screens: [{ id: DEFAULT_SCREEN_ID, title: defaultScreenTitle(0), bookmarks: DEFAULT_BOOKMARKS }],
    currentScreenId: DEFAULT_SCREEN_ID,
    bookmarks: DEFAULT_BOOKMARKS,
    searchEngines: DEFAULT_SEARCH_ENGINES,
    backgrounds: DEFAULT_BACKGROUNDS,
    currentBackgroundIndex: 0,
    currentSearchEngineIndex: 0
};

// Какой элемент списка сейчас редактируется (null = создаётся новый)
let editingBookmarkIndex = null;
let editingBackgroundIndex = null;
let editingSearchEngineIndex = null;
let editingScreenIndex = null;
let editingBookmarkScreenId = null;
let managedScreenId = null;
let screenToDeleteId = null;
let bookmarkToMoveIndex = null;
