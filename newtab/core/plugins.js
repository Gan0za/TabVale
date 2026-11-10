// =============================================================================
// Ядро: манифест плагина и проверка размещения.
//
// Плагин — zip-пакет (.tvp) с manifest.json и кодом. Манифест объявляет
// права (сеть, возможности, хранилище) и поверхности, где плагин может
// жить. Код плагина исполняется только в sandbox-странице; этот модуль
// ничего не запускает и не читает chrome.* — только проверяет данные.
//
// Принцип: манифест только разрешает варианты, конкретное место выбирает
// пользователь. Всё, что выходит за диапазоны, отбрасывается или зажимается.
// =============================================================================

const PLUGIN_API_VERSION = 1;
const PLUGIN_SCHEMA_VERSION = 1;
const PLUGIN_LIMITS = {
    name: 60,
    description: 400,
    networkRules: 10,
    storageKB: 1024,
    panelWidth: [200, 800],
    panelHeight: [160, 1200],
    stripHeight: [48, 200],
    floatingWidth: [200, 640],
    floatingHeight: [160, 800],
};

const PLUGIN_CAPABILITIES = ['bookmarks.read', 'clipboard.read'];
const PLUGIN_SURFACES = ['tiles', 'strip', 'panel', 'floating', 'rail'];

/**
 * id в обратном домене: com.example.clock. Строчные буквы, цифры,
 * точка, дефис и подчёркивание; хотя бы одна точка.
 */
function isValidPluginId(value) {
    return typeof value === 'string'
        && value.length >= 3
        && value.length <= 80
        && /^[a-z0-9][a-z0-9._-]*\.[a-z0-9._-]+$/.test(value)
        && !value.includes('..');
}

function isSemver(value) {
    return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
}

/** Относительный путь внутри пакета без выхода наружу. */
function isSafePackagePath(value, extensions) {
    if (typeof value !== 'string' || !value || value.length > 160) return false;
    if (value.startsWith('/') || value.startsWith('\\') || value.includes('..')) return false;
    if (!/^[\w./-]+$/.test(value)) return false;
    return extensions.some((ext) => value.toLowerCase().endsWith(ext));
}

/**
 * Шаблон сети: только https, хост с необязательной звёздочкой,
 * необязательный путь. Без логина/пароля, query и hash.
 */
function normalizeNetworkRule(rule) {
    if (typeof rule !== 'string') return null;
    const value = rule.trim();
    const match = /^https:\/\/(\*\.)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)(:\d{1,5})?(\/[^\s]*)?$/i.exec(value);
    if (!match) return null;
    const path = match[4] || '';
    if (path.includes('..') || path.includes('?') || path.includes('#')) return null;
    return value;
}

function normalizeRange(value, fallback, limits) {
    const range = Array.isArray(value) ? value : fallback;
    const min = Number(range?.[0]);
    const max = Number(range?.[1]);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    const low = Math.max(limits[0], Math.min(min, max));
    const high = Math.min(limits[1], Math.max(min, max));
    return low <= high ? [low, high] : null;
}

function normalizeSides(value, allowed) {
    if (!Array.isArray(value)) return [];
    return allowed.filter((side) => value.includes(side));
}

function normalizeSurfaces(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const surfaces = {};

    if (source.tiles) {
        const span = Array.isArray(source.tiles.span) ? source.tiles.span : [1, 2];
        const low = Math.max(1, Math.min(2, Number(span[0]) || 1));
        const high = Math.max(low, Math.min(2, Number(span[1]) || low));
        surfaces.tiles = { span: [low, high] };
    }

    if (source.strip) {
        const positions = normalizeSides(source.strip.positions, ['top', 'bottom']);
        const height = normalizeRange(source.strip.height, [64, 120], PLUGIN_LIMITS.stripHeight);
        if (positions.length && height) surfaces.strip = { positions, height };
    }

    if (source.panel) {
        const sides = normalizeSides(source.panel.sides, ['left', 'right', 'top', 'bottom']);
        const width = normalizeRange(source.panel.width, [320, 560], PLUGIN_LIMITS.panelWidth);
        const height = normalizeRange(source.panel.height, [240, 900], PLUGIN_LIMITS.panelHeight);
        const modes = normalizeSides(source.panel.mode, ['overlay', 'push']);
        if (sides.length && width && height) {
            surfaces.panel = { sides, width, height, mode: modes.length ? modes : ['overlay'] };
        }
    }

    if (source.floating) {
        const sides = normalizeSides(source.floating.sides, ['left', 'right']);
        const width = normalizeRange(source.floating.width, [240, 480], PLUGIN_LIMITS.floatingWidth);
        const height = normalizeRange(source.floating.height, [200, 600], PLUGIN_LIMITS.floatingHeight);
        if (sides.length && width && height) surfaces.floating = { sides, width, height };
    }

    if (source.rail) {
        const positions = normalizeSides(
            typeof source.rail === 'object' ? source.rail.positions : ['top', 'bottom'],
            ['top', 'bottom']
        );
        surfaces.rail = { positions: positions.length ? positions : ['top', 'bottom'] };
    }

    return surfaces;
}

function normalizeLocales(raw, fallbackName, fallbackDescription) {
    if (!raw || typeof raw !== 'object') return {};
    const out = {};
    for (const [locale, value] of Object.entries(raw)) {
        if (!/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(locale)) continue;
        if (!value || typeof value !== 'object') continue;
        const entry = {};
        if (typeof value.name === 'string' && value.name.trim()) {
            entry.name = value.name.trim().slice(0, PLUGIN_LIMITS.name);
        }
        if (typeof value.description === 'string' && value.description.trim()) {
            entry.description = value.description.trim().slice(0, PLUGIN_LIMITS.description);
        }
        if (Object.keys(entry).length) out[locale] = entry;
    }
    return out;
}

/**
 * Проверяет и нормализует манифест. Возвращает { ok, errors, manifest }.
 * manifest заполнен только при ok: true.
 */
function validatePluginManifest(raw) {
    const errors = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, errors: ['manifest is not an object'], manifest: null };
    }

    if (raw.schema !== PLUGIN_SCHEMA_VERSION) errors.push('schema must be 1');
    if (!isValidPluginId(raw.id)) errors.push('id must be a reverse-domain identifier');
    if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > PLUGIN_LIMITS.name) {
        errors.push('name is missing or too long');
    }
    if (!isSemver(raw.version)) errors.push('version must be semver');
    if (Number(raw.apiVersion) !== PLUGIN_API_VERSION) errors.push('apiVersion must be 1');
    if (!isSafePackagePath(raw.entry, ['.js', '.html'])) errors.push('entry must be a safe .js or .html path');
    if (raw.icon !== undefined && !isSafePackagePath(raw.icon, ['.svg', '.png'])) {
        errors.push('icon must be a safe .svg or .png path');
    }
    if (raw.minAppVersion !== undefined && !isSemver(raw.minAppVersion)) {
        errors.push('minAppVersion must be semver');
    }
    if (raw.description !== undefined
        && (typeof raw.description !== 'string' || raw.description.length > PLUGIN_LIMITS.description)) {
        errors.push('description is too long');
    }

    const permissions = raw.permissions && typeof raw.permissions === 'object' ? raw.permissions : {};
    const network = [];
    if (permissions.network !== undefined) {
        if (!Array.isArray(permissions.network) || permissions.network.length > PLUGIN_LIMITS.networkRules) {
            errors.push('permissions.network must be an array of at most 10 rules');
        } else {
            for (const rule of permissions.network) {
                const normalized = normalizeNetworkRule(rule);
                if (!normalized) errors.push(`invalid network rule: ${rule}`);
                else network.push(normalized);
            }
        }
    }

    const capabilities = Array.isArray(permissions.capabilities) ? permissions.capabilities : [];
    for (const capability of capabilities) {
        if (!PLUGIN_CAPABILITIES.includes(capability)) errors.push(`unknown capability: ${capability}`);
    }
    if (new Set(capabilities).size !== capabilities.length) errors.push('duplicate capability');

    const storageKB = permissions.storageKB === undefined ? 64 : Number(permissions.storageKB);
    if (!Number.isFinite(storageKB) || storageKB < 1 || storageKB > PLUGIN_LIMITS.storageKB) {
        errors.push('permissions.storageKB must be between 1 and 1024');
    }

    const surfaces = normalizeSurfaces(raw.surfaces);
    if (!Object.keys(surfaces).length) errors.push('at least one surface is required');

    if (errors.length) return { ok: false, errors, manifest: null };

    return {
        ok: true,
        errors: [],
        manifest: {
            schema: PLUGIN_SCHEMA_VERSION,
            id: raw.id,
            name: raw.name.trim(),
            description: typeof raw.description === 'string' ? raw.description.trim() : '',
            author: typeof raw.author === 'string' ? raw.author.trim().slice(0, 80) : '',
            version: raw.version,
            apiVersion: PLUGIN_API_VERSION,
            minAppVersion: raw.minAppVersion || '1.2.0',
            entry: raw.entry,
            icon: raw.icon || '',
            permissions: {
                network,
                capabilities: Array.from(new Set(capabilities)),
                storageKB: Math.round(storageKB),
            },
            surfaces,
            locales: normalizeLocales(raw.locales, raw.name, raw.description),
        },
    };
}

function surfaceRange(manifest, surface, key) {
    return manifest?.surfaces?.[surface]?.[key] || null;
}

function clampNumber(value, range) {
    const number = Number(value);
    if (!range) return null;
    if (!Number.isFinite(number)) return range[0];
    return Math.min(range[1], Math.max(range[0], Math.round(number)));
}

/**
 * Зажимает запрошенное размещение в диапазоны манифеста.
 * Возвращает null, если поверхность плагином не разрешена.
 */
function clampPlacement(manifest, requested) {
    if (!manifest || !requested || typeof requested !== 'object') return null;
    const surface = requested.surface;
    const rangeKey = surface === 'tiles'
        ? 'span'
        : (surface === 'strip' || surface === 'rail' ? 'positions' : 'sides');
    const allowed = surfaceRange(manifest, surface, rangeKey);
    if (!allowed) return null;

    if (surface === 'tiles') {
        return { surface, span: clampNumber(requested.span, allowed) };
    }
    if (surface === 'strip') {
        const positions = surfaceRange(manifest, 'strip', 'positions') || [];
        const position = positions.includes(requested.position) ? requested.position : positions[0];
        return {
            surface,
            position,
            height: clampNumber(requested.height, surfaceRange(manifest, 'strip', 'height')),
        };
    }
    if (surface === 'panel') {
        const sides = surfaceRange(manifest, 'panel', 'sides') || [];
        const modes = surfaceRange(manifest, 'panel', 'mode') || ['overlay'];
        return {
            surface,
            side: sides.includes(requested.side) ? requested.side : sides[0],
            width: clampNumber(requested.width, surfaceRange(manifest, 'panel', 'width')),
            height: clampNumber(requested.height, surfaceRange(manifest, 'panel', 'height')),
            mode: modes.includes(requested.mode) ? requested.mode : modes[0],
        };
    }
    if (surface === 'floating') {
        const sides = surfaceRange(manifest, 'floating', 'sides') || [];
        return {
            surface,
            side: sides.includes(requested.side) ? requested.side : sides[0],
            width: clampNumber(requested.width, surfaceRange(manifest, 'floating', 'width')),
            height: clampNumber(requested.height, surfaceRange(manifest, 'floating', 'height')),
        };
    }
    if (surface === 'rail') {
        const positions = surfaceRange(manifest, 'rail', 'positions') || ['top', 'bottom'];
        return {
            surface,
            position: positions.includes(requested.position) ? requested.position : positions[0],
        };
    }
    return null;
}

/**
 * Проверяет адрес против сетевых правил манифеста (для брокера fetch).
 * Возвращает true только для https и точного хоста/поддомена из правила.
 */
function pluginAllowsUrl(manifest, value) {
    let url;
    try { url = new URL(String(value)); } catch { return false; }
    if (url.protocol !== 'https:') return false;

    return (manifest?.permissions?.network || []).some((rule) => {
        const match = /^https:\/\/(\*\.)?([^/:]+)(?::(\d+))?(\/[^\s]*)?$/i.exec(rule);
        if (!match) return false;
        const [, wildcard, host, port, path] = match;
        // * в шаблоне означает только поддомены, не сам домен:
        // api.example.com подходит для *.example.com, example.com — нет.
        if (wildcard) {
            if (!url.hostname.endsWith('.' + host)) return false;
        } else if (url.hostname !== host) {
            return false;
        }
        if (port && url.port !== port) return false;
        if (path && path !== '/*' && !path.endsWith('*') && url.pathname !== path) return false;
        if (path && path.endsWith('*')) {
            const prefix = path.slice(0, -1);
            if (!url.pathname.startsWith(prefix)) return false;
        }
        return true;
    });
}
