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
const PLUGIN_REMOVED_KEY = 'pluginRemovedBuiltins';
let removedBuiltinIds = new Set();

function initPlugins() {
    ensurePluginDock();
    window.addEventListener('message', onPluginMessage);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && pluginPanelInstance) closePluginPanel();
    });

    loadRemovedBuiltins()
        .then(installBuiltinPlugins)
        .then(loadInstalledPlugins)
        .then(loadPluginPlacements)
        .then(() => {
            renderPluginDock();
            renderPluginStrip();
            renderPluginManager();
        })
        .catch((error) => console.warn('Плагины недоступны:', error));

    document.addEventListener('click', (event) => {
        const tab = event.target.closest?.('.settings-tab');
        if (tab && tab.dataset.tab === 'plugins') renderPluginManager();
    });

    initPluginInstall();
    watchPluginThemeAndLocale();
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

async function loadRemovedBuiltins() {
    const stored = await new Promise((resolve) => storageLocalGet(PLUGIN_REMOVED_KEY, resolve));
    const list = stored?.[PLUGIN_REMOVED_KEY];
    removedBuiltinIds = new Set(Array.isArray(list) ? list.filter((id) => typeof id === 'string') : []);
}

async function saveRemovedBuiltins() {
    await new Promise((resolve) => storageLocalSet({ [PLUGIN_REMOVED_KEY]: [...removedBuiltinIds] }, resolve));
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
        // Удалённый пользователем встроенный плагин не возвращаем сами.
        if (removedBuiltinIds.has(entry.id)) continue;
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
    const locales = record.manifest.locales || {};
    const candidates = [locale, locale.replace('_', '-'), locale.split(/[-_]/)[0]];
    for (const candidate of candidates) {
        if (locales[candidate]?.name) return locales[candidate].name;
    }
    return record.manifest.name;
}

function renderPluginDock() {
    const dock = ensurePluginDock();
    dock.textContent = '';

    for (const record of installedPluginCache) {
        const placement = placementFor(pluginPlacementsCache, record.id);
        // Док — это поверхность «панель». Плагин в полосе живёт только
        // в полосе, а «выкл.» не показывает его нигде.
        if (!placement || placement.surface !== 'panel') continue;

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
    let changed = !hasStored;

    // У каждого установленного плагина должно быть явное размещение:
    // panel, strip, off. Иначе иконка в доке жила отдельно от выбора.
    for (const record of installedPluginCache) {
        const placement = ensureDefaultPlacement(record, placements);
        if (!placement) continue;
        placements = withPlacement(placements, placement);
        changed = true;
    }

    if (changed) {
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
                pluginId: record.id,
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

function broadcastPluginEvent(name, payload) {
    for (const instance of pluginInstances.values()) {
        instance.frame.contentWindow?.postMessage({ type: 'tabvale:event', name, payload }, '*');
    }
}

function watchPluginThemeAndLocale() {
    if (typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.attributeName === 'data-theme') {
                broadcastPluginEvent('theme', pluginTheme());
                renderPluginManager();
            }
            if (mutation.attributeName === 'lang') {
                broadcastPluginEvent('locale', document.documentElement.lang);
                renderPluginManager();
            }
        }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'lang'] });
}

function initPluginInstall() {
    const button = document.getElementById('install-plugin-file');
    const input = document.getElementById('plugin-package-file');
    if (!button || !input) return;

    button.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;

        const parsed = parsePluginPackage(await file.text());
        if (!parsed.ok) {
            window.alert(t('pluginInstallInvalid', { error: parsed.errors.slice(0, 3).join('; ') }));
            return;
        }

        const manifest = parsed.manifest;
        const permissions = [
            t('pluginPermNetwork', { count: manifest.permissions.network.length }),
            t('pluginPermStorage', { kb: manifest.permissions.storageKB }),
            ...manifest.permissions.capabilities,
        ].join(', ');

        if (!window.confirm(t('pluginInstallConfirm', { name: manifest.name, permissions }))) return;

        await dbPutPlugin({
            id: manifest.id,
            version: manifest.version,
            manifest,
            code: parsed.code,
            basePath: '',
            source: 'imported',
            enabled: true,
            installedAt: Date.now(),
        });
        await loadInstalledPlugins();
        await loadPluginPlacements();
        renderPluginDock();
        renderPluginStrip();
        renderPluginManager();
    });
}

function pluginPlacementValue(record) {
    const placement = placementFor(pluginPlacementsCache, record.id);
    if (!placement) return 'off';
    if (placement.surface === 'strip') return `strip:${placement.position || 'top'}`;
    return placement.surface;
}

async function setPluginPlacement(record, value) {
    const previous = placementFor(pluginPlacementsCache, record.id);
    let placements = pluginPlacementsCache.filter((placement) => placement.pluginId !== record.id);

    if (value === 'off') {
        placements = withPlacement(placements, { pluginId: record.id, surface: 'off' });
    } else if (value === 'panel') {
        placements = withPlacement(placements, { pluginId: record.id, surface: 'panel', side: 'right' });
    } else if (value === 'strip:top' || value === 'strip:bottom') {
        placements = withPlacement(placements, {
            pluginId: record.id,
            surface: 'strip',
            position: value === 'strip:bottom' ? 'bottom' : 'top',
            height: previous?.height || PLUGIN_STRIP_DEFAULT_HEIGHT,
            order: placements.length,
        });
    }

    pluginPlacementsCache = placements;
    await new Promise((resolve) => storageLocalSet({ [PLUGIN_PLACEMENTS_KEY]: placements }, resolve));

    // Зоны исключающие: уходя из панели в полосу/off, закрываем её.
    if (value !== 'panel' && pluginPanelInstance?.record.id === record.id) {
        closePluginPanel();
    }

    renderPluginDock();
    renderPluginStrip();
}

async function removePlugin(record) {
    if (!window.confirm(t('pluginRemoveConfirm', { name: record.manifest.name }))) return;
    if (record.source === 'builtin') {
        removedBuiltinIds.add(record.id);
        await saveRemovedBuiltins();
    }
    await dbDeletePlugin(record.id);
    pluginPlacementsCache = pluginPlacementsCache.filter((placement) => placement.pluginId !== record.id);
    await new Promise((resolve) => storageLocalSet({ [PLUGIN_PLACEMENTS_KEY]: pluginPlacementsCache }, resolve));
    installedPluginCache = installedPluginCache.filter((item) => item.id !== record.id);
    renderPluginDock();
    renderPluginStrip();
    renderPluginManager();
}

function renderPluginManager() {
    const list = document.getElementById('plugins-manager-list');
    if (!list) return;
    list.textContent = '';

    if (removedBuiltinIds.size) {
        const restore = document.createElement('button');
        restore.type = 'button';
        restore.className = 'btn plugin-manager-restore';
        restore.textContent = t('pluginRestore');
        restore.addEventListener('click', async () => {
            removedBuiltinIds.clear();
            await saveRemovedBuiltins();
            await installBuiltinPlugins();
            await loadInstalledPlugins();
            await loadPluginPlacements();
            renderPluginDock();
            renderPluginStrip();
            renderPluginManager();
        });
        list.append(restore);
    }

    if (!installedPluginCache.length) {
        const empty = document.createElement('p');
        empty.className = 'plugin-manager-empty';
        empty.textContent = t('pluginsEmpty');
        list.append(empty);
        return;
    }

    for (const record of installedPluginCache) {
        const item = document.createElement('div');
        item.className = 'plugin-manager-item';
        item.dataset.pluginId = record.id;

        const info = document.createElement('div');
        info.className = 'plugin-manager-info';

        const name = document.createElement('div');
        name.className = 'plugin-manager-name';
        name.textContent = pluginDisplayName(record);

        const meta = document.createElement('div');
        meta.className = 'plugin-manager-meta';
        const network = record.manifest.permissions?.network?.length || 0;
        const permissions = record.manifest.permissions?.capabilities || [];
        meta.textContent = [
            `v${record.manifest.version}`,
            t('pluginPermNetwork', { count: network }),
            ...permissions,
            t('pluginPermStorage', { kb: record.manifest.permissions?.storageKB || 64 }),
        ].join(' · ');

        info.append(name, meta);

        const select = document.createElement('select');
        select.className = 'plugin-manager-surface';
        select.setAttribute('aria-label', t('pluginPlacementLabel', { name: pluginDisplayName(record) }));
        const options = [];
        if (record.manifest.surfaces?.panel) options.push(['panel', t('surfacePanel')]);
        if (record.manifest.surfaces?.strip) {
            options.push(['strip:top', t('surfaceStripTop')]);
            options.push(['strip:bottom', t('surfaceStripBottom')]);
        }
        options.push(['off', t('surfaceOff')]);
        for (const [value, label] of options) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            select.append(option);
        }
        select.value = pluginPlacementValue(record);
        select.addEventListener('change', () => setPluginPlacement(record, select.value));

        item.append(info, select);

        if (record.manifest.surfaces?.panel) {
            const open = document.createElement('button');
            open.type = 'button';
            open.className = 'btn plugin-manager-open';
            open.textContent = t('pluginOpen');
            open.addEventListener('click', async () => {
                // «Открыть» — это выбор панели, а не второй поверхности.
                await setPluginPlacement(record, 'panel');
                openPluginPanel(record);
            });
            item.append(open);
        }

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn-danger plugin-manager-remove';
        remove.textContent = t('pluginRemove');
        remove.addEventListener('click', () => removePlugin(record));
        item.append(remove);

        list.append(item);
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
        // Плотная поверхность: iframe рисует собственный канвас, и
        // прозрачный фон даёт белое поле со светлым текстом в тёмной теме.
        background: value('--surface', '#24303c'),
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
