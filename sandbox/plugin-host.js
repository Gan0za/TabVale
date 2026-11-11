// =============================================================================
// Sandbox-оболочка плагина.
//
// Живёт на странице, объявленной в manifest.sandbox.pages: уникальный origin,
// никакого chrome.*, никакого доступа к DOM хоста. Код плагина приходит
// строкой от родителя и исполняется здесь через new Function; вся связь —
// postMessage с request/response по id.
//
// Плагин не грузит код по сети: строка приходит из IndexedDB хоста, то есть
// является установленным пользователем пакетом. Сеть — только через брокер
// родителя (api.fetch), который проверяет allowlist манифеста.
// =============================================================================

(function () {
    'use strict';

    const pending = new Map();
    const handlers = new Map();
    let sequence = 0;

    function post(message) {
        parent.postMessage(message, '*');
    }

    function rpc(method, params) {
        return new Promise((resolve, reject) => {
            const id = 'r' + (++sequence).toString(36);
            pending.set(id, { resolve, reject });
            post({ type: 'tabvale:rpc', id, method, params });
        });
    }

    function emit(name, payload) {
        for (const handler of handlers.get(name) || []) {
            try { handler(payload); } catch (error) { console.error(error); }
        }
    }

    function applyTheme(theme) {
        const root = document.documentElement;
        const map = {
            '--tabvale-bg': theme?.background,
            '--tabvale-text': theme?.text,
            '--tabvale-muted': theme?.muted,
            '--tabvale-accent': theme?.accent,
            '--tabvale-surface': theme?.surface,
            '--tabvale-border': theme?.border,
            '--tabvale-radius': theme?.radius,
        };
        for (const [name, value] of Object.entries(map)) {
            if (typeof value === 'string' && value) root.style.setProperty(name, value);
        }
        root.dataset.theme = theme?.mode === 'light' ? 'light' : 'dark';
        root.lang = typeof theme?.locale === 'string' ? theme.locale : '';
    }

    function buildApi(context) {
        return Object.freeze({
            version: 1,
            surface: context.surface,
            locale: context.locale,
            theme: context.theme,
            storage: {
                get: (key) => rpc('storage.get', { key }),
                set: (key, value) => rpc('storage.set', { key, value }),
                remove: (key) => rpc('storage.remove', { key }),
            },
            fetch: (url, options) => rpc('fetch', { url, options }),
            bookmarks: {
                tree: () => rpc('bookmarks.tree'),
                import: (screenId, items) => rpc('bookmarks.import', { screenId, items }),
            },
            ui: {
                ready: () => rpc('ui.ready'),
                close: () => rpc('ui.close'),
                resize: (size) => rpc('ui.resize', size || {}),
                notify: (text, level) => rpc('ui.notify', { text, level }),
            },
            on: (name, handler) => {
                if (typeof handler !== 'function') return;
                if (!handlers.has(name)) handlers.set(name, []);
                handlers.get(name).push(handler);
            },
        });
    }

    function start(context) {
        if (!context || typeof context.code !== 'string' || !context.code) {
            post({ type: 'tabvale:error', message: 'plugin code is missing' });
            return;
        }

        document.title = `${context.pluginId || 'plugin'} (${context.surface || 'panel'})`;
        applyTheme(context.theme);
        const api = buildApi(context);

        try {
            // Код исполняется только здесь: sandbox origin, без chrome.*,
            // без доступа к DOM хоста и без сетевых запросов напрямую.
            const factory = new Function(
                'api', 'config',
                '"use strict";\n' + context.code + '\n;return typeof mount === "function" ? mount : null;'
            );
            const mount = factory(api, context.config || {});
            if (typeof mount === 'function') mount(api, context.config || {});
            else if (typeof globalThis.mount === 'function') globalThis.mount(api, context.config || {});
            else post({ type: 'tabvale:error', message: 'plugin does not export mount(api, config)' });
        } catch (error) {
            post({ type: 'tabvale:error', message: String((error && error.message) || error) });
        }
    }

    window.addEventListener('message', (event) => {
        // Единственный доверенный отправитель — родительское окно хоста.
        // Проверка source, а не origin: sandbox-страница имеет opaque origin.
        if (event.source !== parent) return;
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'tabvale:run') {
            start(data.context);
            return;
        }

        if (data.type === 'tabvale:rpc-result') {
            const entry = pending.get(data.id);
            if (!entry) return;
            pending.delete(data.id);
            if (data.error) entry.reject(new Error(String(data.error)));
            else entry.resolve(data.result);
            return;
        }

        if (data.type === 'tabvale:event') {
            if (data.name === 'theme') applyTheme(data.payload);
            emit(data.name, data.payload);
        }
    });
}());
