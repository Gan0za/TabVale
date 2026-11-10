// =============================================================================
// Фича: плагины.
//
// Хост плагинов: ставит встроенные пакеты в IndexedDB, рисует док иконок,
// открывает выдвижную панель с sandbox-iframe и обслуживает RPC.
//
// Граница безопасности: sandbox не доверенный. Каждое сообщение
// проверяется по source-окну конкретной панели, каждый метод — по
// манифесту через pluginMethodAllowed; данные плагина пишутся только в
// namespaced-ключи с квотой, сеть — только по allowlist с GET/HEAD.
// =============================================================================

const PLUGIN_PANEL_DEFAULTS = { side: 'right', width: 360, height: 480 };
const PLUGIN_FETCH_LIMIT = 262144;

let pluginDockElement = null;
let pluginPanelInstance = null;
let installedPluginCache = [];
let pluginPlacementsCache = [];
const pluginInstances = new Map();
let pluginInstanceSeq = 0;

function initPlugins() {
    ensurePluginDock();
    window.addEventListener('message', onPluginMessage);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && pluginPanelInstance) closePluginPanel();
    });

    installBuiltinPlugins()
        .then(loadInstalledPlugins)
        .then(loadPluginPlacements)
        .then(() => {
            renderPluginDock();
            renderPluginStrip();
        })
        .catch((error) => console.warn('Плагины недоступны:', error));
}

function ensurePluginDock() {
    if (pluginDockElement) return pluginDockElement;
    pluginDockElement = document.getElementById('plugin-dock');
    if (!pluginDockElement) {
        pluginDockElement = document.createElement('nav');
        pluginDockElement.id = 'plugin-dock';
        pluginDockElement.className = 'plugin-dock';
        pluginDockElement.setAttribute('aria-label', 'Плагины');
        document.body.append(pluginDockElement);
    }
    return pluginDockElement;
}

async function fetchPluginResource(path) {
    const response = await fetch(chrome.runtime.getURL(path));
    if (!response.ok) throw new Error(`Не удалось прочитать ${path}`);
    return response;
}

async function installBuiltinPlugins() {
    let index;
    try {
        index = await (await fetchPluginResource(BUILTIN_PLUGIN_INDEX)).json();
    } catch {
        return;
    }

    const entries = normalizePluginRegistry(index);
    for (const entry of entries) {
        const basePath = `plugins/${entry.path}`;
        try {
            const manifestRaw = await (await fetchPluginResource(basePath + 'manifest.json')).json();
            const result = validatePluginManifest(manifestRaw);
            if (!result.ok) {
                console.warn('Плагин пропущен:', entry.id, result.errors.join('; '));
                continue;
            }
            const existing = await dbGetPlugin(entry.id);
            if (existing && existing.version === entry.version) continue;

            const code = await (await fetchPluginResource(basePath + result.manifest.entry)).text();
            await dbPutPlugin({
                id: result.manifest.id,
                version: result.manifest.version,
                manifest: result.manifest,
                code,
                basePath,
                source: 'builtin',
                enabled: true,
                installedAt: Date.now(),
            });
        } catch (error) {
            console.warn('Не удалось установить плагин:', entry.id, error);
        }
    }
}

async function loadInstalledPlugins() {
    const records = await dbGetAllPlugins();
    installedPluginCache = Array.isArray(records)
        ? records.filter((record) => record && record.enabled !== false && record.manifest)
        : [];
    return installedPluginCache;
}

function pluginDisplayName(record) {
    const locale = document.documentElement.lang || 'en';
    return record.manifest.locales?.[locale]?.name || record.manifest.name;
}

function renderPluginDock() {
    const dock = ensurePluginDock();
    dock.textContent = '';

    for (const record of installedPluginCache) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'plugin-dock-button';
        button.dataset.pluginId = record.id;
        button.title = pluginDisplayName(record);
        button.setAttribute('aria-label', pluginDisplayName(record));

        if (record.manifest.icon && record.basePath) {
            const icon = document.createElement('img');
            icon.src = chrome.runtime.getURL(record.basePath + record.manifest.icon);
            icon.alt = '';
            icon.width = 24;
            icon.height = 24;
            button.append(icon);
        } else {
            button.textContent = pluginDisplayName(record).slice(0, 1).toUpperCase();
        }

        button.addEventListener('click', () => openPluginPanel(record));
        dock.append(button);
    }

    dock.classList.toggle('hidden', installedPluginCache.length === 0);
}

async function loadPluginPlacements() {
    const stored = await new Promise((resolve) => storageLocalGet(PLUGIN_PLACEMENTS_KEY, resolve));
    const hasStored = stored && Object.prototype.hasOwnProperty.call(stored, PLUGIN_PLACEMENTS_KEY);
    let placements = normalizePluginPlacements(stored?.[PLUGIN_PLACEMENTS_KEY]);

    // Первый запуск: встроенные плагины со strip показываем полосой сверху.
    // Если пользователь потом уберёт все размещения, ключ уже существует —
    // повторно не навязываем.
    if (!hasStored && installedPluginCache.length) {
        placements = defaultPluginPlacements(installedPluginCache);
        await new Promise((resolve) => storageLocalSet({ [PLUGIN_PLACEMENTS_KEY]: placements }, resolve));
    }
    pluginPlacementsCache = placements;
}

function ensurePluginStrip(position) {
    const anchor = document.getElementById('bookmarks-section');
    if (!anchor || !anchor.parentNode) return null;

    let strip = document.getElementById(`plugin-strip-${position}`);
    if (!strip) {
        strip = document.createElement('section');
        strip.id = `plugin-strip-${position}`;
        strip.className = 'plugin-strip';
        strip.dataset.position = position;
        strip.setAttribute('aria-label', position === 'top' ? 'Плагины сверху' : 'Плагины снизу');
        if (position === 'top') anchor.parentNode.insertBefore(strip, anchor);
        else anchor.parentNode.insertBefore(strip, anchor.nextSibling);
    }
    return strip;
}

function createPluginInstance(record, surface, root, frame, placement) {
    const instance = { id: ++pluginInstanceSeq, record, surface, root, frame, placement };
    frame.addEventListener('load', () => {
        pluginInstances.set(instance.id, instance);
        frame.contentWindow?.postMessage({
            type: 'tabvale:run',
            context: {
                code: record.code,
                config: {},
                theme: pluginTheme(),
                locale: pluginTheme().locale,
                surface,
            },
        }, '*');
    }, { once: true });
    return instance;
}

function renderPluginStrip() {
    for (const instance of Array.from(pluginInstances.values())) {
        if (instance.surface !== 'strip') continue;
        pluginInstances.delete(instance.id);
        instance.root.remove();
    }

    for (const position of ['top', 'bottom']) {
        const strip = ensurePluginStrip(position);
        if (!strip) continue;
        strip.textContent = '';
        strip.classList.add('hidden');
    }

    const placements = pluginPlacementsCache
        .filter((placement) => placement.surface === 'strip')
        .sort((left, right) => left.order - right.order);

    for (const placement of placements) {
        const record = installedPluginCache.find((item) => item.id === placement.pluginId);
        if (!record || !record.manifest.surfaces?.strip) continue;
        const strip = ensurePluginStrip(placement.position === 'bottom' ? 'bottom' : 'top');
        if (!strip) continue;

        const item = document.createElement('div');
        item.className = 'plugin-strip-item';
        item.dataset.pluginId = record.id;
        item.style.setProperty('--plugin-strip-height', `${placement.height}px`);

        const frame = document.createElement('iframe');
        frame.className = 'plugin-strip-frame';
        frame.title = `${pluginDisplayName(record)} (strip)`;
        frame.src = chrome.runtime.getURL('sandbox/plugin-host.html');

        item.append(frame);
        strip.append(item);
        strip.classList.remove('hidden');
        createPluginInstance(record, 'strip', item, frame, placement);
    }
}

function findPluginInstance(source) {
    for (const instance of pluginInstances.values()) {
        if (instance.frame.contentWindow === source) return instance;
    }
    return null;
}

function removePluginInstance(instance) {
    pluginInstances.delete(instance.id);
    instance.root.remove();
    if (instance.surface === 'strip') {
        pluginPlacementsCache = pluginPlacementsCache
            .filter((placement) => placement.pluginId !== instance.record.id);
        storageLocalSet({ [PLUGIN_PLACEMENTS_KEY]: pluginPlacementsCache });
    }
}

function pluginTheme() {
    const styles = getComputedStyle(document.documentElement);
    const value = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
    return {
        mode: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
        text: value('--text', '#e8f2f8'),
        muted: value('--text-soft', '#9db4c4'),
        accent: value('--accent', '#4db6e2'),
        surface: value('--glass', 'rgba(30, 40, 50, 0.5)'),
        border: value('--border', 'rgba(255,255,255,0.14)'),
        radius: value('--radius', '12px'),
        locale: document.documentElement.lang || navigator.language,
    };
}

function pluginPanelPlacement(record) {
    const requested = { surface: 'panel', side: PLUGIN_PANEL_DEFAULTS.side,
        width: PLUGIN_PANEL_DEFAULTS.width, height: PLUGIN_PANEL_DEFAULTS.height, mode: 'overlay' };
    return clampPlacement(record.manifest, requested)
        || { ...PLUGIN_PANEL_DEFAULTS, mode: 'overlay' };
}

function openPluginPanel(record) {
    closePluginPanel();

    const placement = pluginPanelPlacement(record);
    const root = document.createElement('aside');
    root.className = 'plugin-panel open';
    root.dataset.pluginId = record.id;
    root.dataset.side = placement.side || 'right';
    root.style.setProperty('--plugin-panel-width', `${placement.width}px`);
    root.style.setProperty('--plugin-panel-height', `${placement.height}px`);

    const header = document.createElement('header');
    header.className = 'plugin-panel-header';

    const title = document.createElement('span');
    title.className = 'plugin-panel-title';
    title.textContent = pluginDisplayName(record);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'plugin-panel-close';
    close.setAttribute('aria-label', 'Закрыть плагин');
    close.textContent = '✕';
    close.addEventListener('click', closePluginPanel);

    const frame = document.createElement('iframe');
    frame.className = 'plugin-panel-frame';
    frame.title = `${pluginDisplayName(record)} (panel)`;
    frame.src = chrome.runtime.getURL('sandbox/plugin-host.html');

    header.append(title, close);
    root.append(header, frame);
    document.body.append(root);

    pluginPanelInstance = createPluginInstance(record, 'panel', root, frame, placement);
}

function closePluginPanel() {
    if (!pluginPanelInstance) return;
    pluginInstances.delete(pluginPanelInstance.id);
    pluginPanelInstance.root.remove();
    pluginPanelInstance = null;
}

async function onPluginMessage(event) {
    const instance = findPluginInstance(event.source);
    if (!instance || !instance.frame.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || data.type !== 'tabvale:rpc') return;

    const reply = (result) => instance.frame.contentWindow.postMessage(
        { type: 'tabvale:rpc-result', id: data.id, result }, '*'
    );
    const fail = (message) => instance.frame.contentWindow.postMessage(
        { type: 'tabvale:rpc-result', id: data.id, error: String(message) }, '*'
    );

    if (!pluginMethodAllowed(instance.record.manifest, data.method)) {
        fail('method not allowed');
        return;
    }

    try {
        const params = data.params && typeof data.params === 'object' ? data.params : {};
        switch (data.method) {
            case 'storage.get': {
                if (!isPluginStorageKey(params.key)) throw new Error('invalid storage key');
                const fullKey = pluginStorageKey(instance.record.id, params.key);
                const stored = await new Promise((resolve) => storageLocalGet(fullKey, resolve));
                reply(stored ? stored[fullKey] ?? null : null);
                break;
            }
            case 'storage.set': {
                const check = checkPluginStorageWrite(instance.record.manifest, params.key, params.value);
                if (!check.ok) throw new Error(check.error);
                const fullKey = pluginStorageKey(instance.record.id, params.key);
                await new Promise((resolve) => storageLocalSet({ [fullKey]: params.value }, resolve));
                reply(true);
                break;
            }
            case 'storage.remove': {
                if (!isPluginStorageKey(params.key)) throw new Error('invalid storage key');
                const fullKey = pluginStorageKey(instance.record.id, params.key);
                await new Promise((resolve) => storageLocalRemove(fullKey, resolve));
                reply(true);
                break;
            }
            case 'fetch': {
                if (!pluginAllowsUrl(instance.record.manifest, params.url)) throw new Error('url is not allowed');
                const sanitized = sanitizePluginFetchOptions(params.options);
                if (!sanitized.ok) throw new Error(sanitized.error);
                const response = await fetch(params.url, sanitized.options);
                const text = (await response.text()).slice(0, PLUGIN_FETCH_LIMIT);
                reply({ status: response.status, ok: response.ok, text });
                break;
            }
            case 'ui.ready':
            case 'config.get':
                reply(data.method === 'config.get' ? {} : true);
                break;
            case 'ui.close':
                // Закрытие strip-виджета не удаляет размещение: без
                // менеджера пользователь не смог бы вернуть его обратно.
                if (instance.surface === 'panel') closePluginPanel();
                else instance.root.hidden = true;
                reply(true);
                break;
            case 'ui.resize': {
                if (instance.surface === 'strip') {
                    const next = clampPlacement(instance.record.manifest, {
                        surface: 'strip',
                        position: instance.placement.position,
                        height: params.height,
                    });
                    if (next) {
                        instance.placement = { ...instance.placement, height: next.height };
                        instance.root.style.setProperty('--plugin-strip-height', `${next.height}px`);
                        pluginPlacementsCache = pluginPlacementsCache.map((placement) => (
                            placement.pluginId === instance.record.id
                                ? { ...placement, height: next.height }
                                : placement
                        ));
                        storageLocalSet({ [PLUGIN_PLACEMENTS_KEY]: pluginPlacementsCache });
                    }
                    reply(instance.placement);
                    break;
                }
                const placement = pluginPanelPlacement(instance.record);
                const next = clampPlacement(instance.record.manifest, {
                    surface: 'panel',
                    side: placement.side,
                    width: params.width,
                    height: params.height,
                    mode: 'overlay',
                }) || placement;
                instance.root.style.setProperty('--plugin-panel-width', `${next.width}px`);
                instance.root.style.setProperty('--plugin-panel-height', `${next.height}px`);
                instance.placement = next;
                reply(next);
                break;
            }
            case 'ui.notify':
                console.info(`[plugin ${instance.record.id}]`, params.text);
                reply(true);
                break;
            case 'bookmarks.tree':
            case 'bookmarks.import':
                throw new Error('bookmarks capability is not enabled yet');
            default:
                fail('unknown method');
        }
    } catch (error) {
        fail(error?.message || error);
    }
}
