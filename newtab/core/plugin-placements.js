// =============================================================================
// Ядро: размещения плагинов.
//
// Размещение — выбор пользователя поверх разрешённых манифестом зон:
// strip сверху/снизу, panel, tiles, floating. Хранится отдельно от
// манифеста, чтобы обновление плагина не сбрасывало выбор.
// =============================================================================

const PLUGIN_PLACEMENTS_KEY = 'pluginPlacements';
const PLUGIN_PLACEMENT_SURFACES = ['strip', 'panel', 'tiles', 'floating'];
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
function defaultPluginPlacements(records) {
    if (!Array.isArray(records)) return [];
    return records
        .filter((record) => record?.manifest?.surfaces?.strip)
        .sort((left, right) => left.manifest.name.localeCompare(right.manifest.name))
        .slice(0, 3)
        .map((record, index) => ({
            pluginId: record.id,
            surface: 'strip',
            position: 'top',
            height: PLUGIN_STRIP_DEFAULT_HEIGHT,
            order: index,
        }));
}
