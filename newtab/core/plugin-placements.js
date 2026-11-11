// =============================================================================
// Ядро: размещения плагинов.
//
// Размещение — выбор пользователя поверх разрешённых манифестом зон:
// strip сверху/снизу, panel, tiles, floating. Хранится отдельно от
// манифеста, чтобы обновление плагина не сбрасывало выбор.
// =============================================================================

const PLUGIN_PLACEMENTS_KEY = 'pluginPlacements';
const PLUGIN_PLACEMENT_SURFACES = ['strip', 'panel', 'tiles', 'floating', 'off'];
const PLUGIN_STRIP_DEFAULT_HEIGHT = 88;

function normalizePluginPlacement(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.pluginId !== 'string' || !raw.pluginId.trim()) return null;
    if (!PLUGIN_PLACEMENT_SURFACES.includes(raw.surface)) return null;

    const placement = {
        pluginId: raw.pluginId.trim(),
        surface: raw.surface,
        order: Number.isFinite(Number(raw.order)) ? Math.max(0, Math.round(Number(raw.order))) : 0,
    };

    if (raw.surface === 'off') return placement;

    if (raw.surface === 'strip') {
        placement.position = raw.position === 'bottom' ? 'bottom' : 'top';
        const height = Number(raw.height);
        placement.height = Number.isFinite(height)
            ? Math.min(200, Math.max(48, Math.round(height)))
            : PLUGIN_STRIP_DEFAULT_HEIGHT;
    }

    if (raw.surface === 'panel') {
        placement.side = ['left', 'right', 'top', 'bottom'].includes(raw.side) ? raw.side : 'right';
    }

    if (raw.surface === 'floating') {
        placement.side = ['left', 'right'].includes(raw.side) ? raw.side : 'right';
        // Позиция окна задаётся в пикселях от левого верхнего угла; при
        // отсутствии хост подставит место по умолчанию. Размер зажат,
        // чтобы окно не оказалось микроскопическим или огромным.
        const clamp = (value, low, high) => Math.min(high, Math.max(low, Math.round(Number(value))));
        if (Number.isFinite(Number(raw.x))) placement.x = clamp(raw.x, 0, 10000);
        if (Number.isFinite(Number(raw.y))) placement.y = clamp(raw.y, 0, 10000);
        if (Number.isFinite(Number(raw.width))) placement.width = clamp(raw.width, 160, 900);
        if (Number.isFinite(Number(raw.height))) placement.height = clamp(raw.height, 120, 900);
    }

    return placement;
}

function normalizePluginPlacements(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const placements = [];
    for (const item of raw) {
        const placement = normalizePluginPlacement(item);
        if (!placement || seen.has(placement.pluginId)) continue;
        seen.add(placement.pluginId);
        placements.push(placement);
    }
    return placements;
}

function placementFor(placements, pluginId) {
    return (Array.isArray(placements) ? placements : [])
        .find((placement) => placement.pluginId === pluginId) || null;
}

function withPlacement(placements, next) {
    const normalized = normalizePluginPlacement(next);
    if (!normalized) return normalizePluginPlacements(placements);
    const rest = normalizePluginPlacements(placements)
        .filter((placement) => placement.pluginId !== normalized.pluginId);
    return [...rest, normalized];
}

/**
 * Стартовые размещения: встроенные плагины, у которых манифест разрешает
 * strip, ставятся полосой сверху. Пользователь меняет это в менеджере.
 */
/**
 * Стартовое размещение для одного плагина: до трёх strip-виджетов,
 * остальные — панелью, иначе off. Возвращает null, если размещение уже есть.
 */
function ensureDefaultPlacement(record, placements) {
    if (!record || placementFor(placements, record.id)) return null;
    const stripCount = (Array.isArray(placements) ? placements : [])
        .filter((placement) => placement.surface === 'strip').length;
    const surfaces = record.manifest?.surfaces || {};

    // Полосу по умолчанию получают только плагины с явным default:true
    // (часы, помодоро, погода). Остальные с панелью идут в панель, но
    // пользователь может выбрать им полосу в менеджере.
    const stripPreferred = surfaces.strip?.default === true || !surfaces.panel;
    if (stripPreferred && surfaces.strip && stripCount < 3) {
        return {
            pluginId: record.id,
            surface: 'strip',
            position: 'top',
            height: PLUGIN_STRIP_DEFAULT_HEIGHT,
            order: stripCount,
        };
    }
    if (surfaces.panel) return { pluginId: record.id, surface: 'panel', side: 'right' };
    return { pluginId: record.id, surface: 'off' };
}

function defaultPluginPlacements(records) {
    if (!Array.isArray(records)) return [];
    const placements = [];
    for (const record of [...records].sort((left, right) => left.manifest.name.localeCompare(right.manifest.name))) {
        const placement = ensureDefaultPlacement(record, placements);
        if (placement) placements.push(placement);
    }
    return placements;
}
