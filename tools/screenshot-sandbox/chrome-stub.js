// Заглушка chrome.* для скриншотов. Загружается до core/config.js.
// Данные вымышленные; иконки отдаёт локальный сервер sandbox (HTTP).
(function () {
    const params = new URLSearchParams(location.search);
    const theme = params.get('theme') === 'light' ? 'light' : 'dark';
    const base = location.origin;

    const icon = (key) => `${base}/sandbox/icons/${key}.svg`;

    const screens = [
        {
            id: 'main',
            title: 'Home',
            titleKey: 'defaultScreen',
            bookmarks: [
                { title: 'GitHub', url: 'https://github.com', icon: icon('gh') },
                { title: 'GitLab', url: 'https://gitlab.com', icon: icon('gl') },
                { title: 'Stack Overflow', url: 'https://stackoverflow.com', icon: icon('so') },
                { title: 'MDN', url: 'https://developer.mozilla.org', icon: icon('mdn') },
                { title: 'YouTube', url: 'https://youtube.com', icon: icon('yt') },
                { title: 'Reddit', url: 'https://reddit.com', icon: icon('reddit') },
                { title: 'X', url: 'https://x.com', icon: icon('x') },
                { title: 'Wikipedia', url: 'https://wikipedia.org', icon: icon('wiki') },
            ],
        },
        {
            id: 'work',
            title: 'Work',
            bookmarks: [
                { title: 'Jira', url: 'https://jira.example.com', icon: icon('jira') },
                { title: 'Confluence', url: 'https://confluence.example.com', icon: icon('conf') },
                { title: 'Figma', url: 'https://figma.com', icon: icon('figma') },
                { title: 'Notion', url: 'https://notion.so', icon: icon('notion') },
                { title: 'Slack', url: 'https://slack.com', icon: icon('slack') },
                { title: 'Linear', url: 'https://linear.app', icon: icon('linear') },
            ],
        },
        {
            id: 'study',
            title: 'Study',
            bookmarks: [
                { title: 'Coursera', url: 'https://coursera.org', icon: icon('coursera') },
                { title: 'LeetCode', url: 'https://leetcode.com', icon: icon('leetcode') },
                { title: 'arXiv', url: 'https://arxiv.org', icon: icon('arxiv') },
                { title: 'Duolingo', url: 'https://duolingo.com', icon: icon('duolingo') },
                { title: 'Khan Academy', url: 'https://khanacademy.org', icon: icon('khan') },
            ],
        },
    ];

    const syncData = {
        screens,
        backgrounds: [
            { type: 'gradient', title: 'Midnight', from: '#0f172a', to: '#334155', angle: 135 },
            { type: 'gradient', title: 'Morning', from: '#eef2ff', to: '#e0e7ff', angle: 135 },
        ],
        currentBackgroundIndex: theme === 'light' ? 1 : 0,
        searchEngines: [
            { name: 'Google', url: 'https://www.google.com/search?q=%s', logo: icon('google') },
            { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', logo: icon('ddg') },
            { name: 'Bing', url: 'https://www.bing.com/search?q=%s', logo: icon('bing') },
        ],
        currentSearchEngineIndex: 0,
        theme,
        lang: 'en',
    };

    const localData = { currentScreenId: 'main' };

    function pick(data, keys) {
        if (keys === null || keys === undefined) return { ...data };
        const list = Array.isArray(keys) ? keys : [keys];
        const result = {};
        for (const key of list) {
            if (Object.prototype.hasOwnProperty.call(data, key)) result[key] = data[key];
        }
        return result;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    // На обычной HTTP-странице Chrome уже создаёт window.chrome (loadTimes,
    // csi и т.п.), поэтому не заменяем объект, а дополняем его.
    const chromeApi = window.chrome || {};
    chromeApi.runtime = {
        get lastError() { return undefined; },
        getURL(path) { return `/${String(path).replace(/^\/+/, '')}`; },
    };
    chromeApi.permissions = {
        request(_permissions, callback) { callback?.(false); },
    };
    chromeApi.storage = {
        sync: {
            get(keys, callback) { callback?.(clone(pick(syncData, keys))); },
            set(items, callback) { Object.assign(syncData, clone(items)); callback?.(); },
            remove(keys, callback) {
                const list = Array.isArray(keys) ? keys : [keys];
                for (const key of list) delete syncData[key];
                callback?.();
            },
            onChanged: { addListener() {} },
        },
        local: {
            get(keys, callback) { callback?.(clone(pick(localData, keys))); },
            set(items, callback) { Object.assign(localData, clone(items)); callback?.(); },
            remove(keys, callback) {
                const list = Array.isArray(keys) ? keys : [keys];
                for (const key of list) delete localData[key];
                callback?.();
            },
            onChanged: { addListener() {} },
        },
        onChanged: { addListener() {} },
    };
    window.chrome = chromeApi;
})();
