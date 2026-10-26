// =============================================================================
// Ядро: настройки по умолчанию.
//
// Используются, пока пользователь не внёс свои данные. Файл загружается
// первым (см. порядок <script> в index.html и список в .opencoder/tests/
// _source.mjs): от него зависят storage (getState, сброс) и bootstrap.
// =============================================================================

const DEFAULT_SEARCH_ENGINES = [
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', logo: 'https://icons.duckduckgo.com/ip3/duckduckgo.com.ico' },
    { name: 'Google', url: 'https://www.google.com/search?q=%s', logo: 'https://www.google.com/favicon.ico' },
    { name: 'Bing', url: 'https://www.bing.com/search?q=%s', logo: 'https://www.bing.com/favicon.ico' },
];

const DEFAULT_BOOKMARKS = [
    { title: 'GitHub', url: 'https://github.com', icon: 'https://github.com/favicon.ico' },
    { title: 'Google', url: 'https://www.google.com', icon: 'https://www.google.com/favicon.ico' }
];

const DEFAULT_BACKGROUNDS = [
    { title: 'По умолчанию', url: '' }
];

// Заглушка, показываемая вместо не загрузившейся иконки (серый круг со знаком "?")
const FALLBACK_ICON = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"%3E%3Ccircle cx="25" cy="25" r="20" fill="%23ccc"/%3E%3Ctext x="25" y="30" text-anchor="middle" fill="%23666" font-size="14"%3E%3F%3C/text%3E%3C/svg%3E';
