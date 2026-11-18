// =============================================================================
// Фича: Модалка настроек: открытие/закрытие, вкладки, импорт/экспорт JSON,
// сброс к дефолтам, закрытие по Escape
//
// Wiring — в initSettings(), вызывается из бутстрапа app.js на месте
// старой секции. Декларации — на топ-уровне (глобальная лексическая
// среда классических <script>).
// =============================================================================

/**
 * Регистрирует слушатели секции. Вызывается из бутстрапа app.js.
 */
function initSettings() {
        settingsButton.addEventListener('click', () => {
            managedScreenId = currentState.currentScreenId;
            openSettingsModal('bookmarks');
        });
        closeSettingsButton.addEventListener('click', closeSettingsModal);
        overlay.addEventListener('click', closeSettingsModal);

        // Клик по вкладкам (Закладки / Фоны / Поисковые системы)
        settingsTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                settingsTabs.forEach(t => t.classList.remove('active'));
                settingsPanes.forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.querySelector(`.settings-pane[data-pane="${tabName}"]`)?.classList.add('active');
            });
        });

        // Закрытие модалки клавишей Escape — привычное поведение
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSettingsModal();
                closeContextMenu();
            }
        });

        // --- Экспорт: скачивание JSON-файла со всеми настройками ---
        exportSettingsJsonButton.addEventListener('click', () => {
            // Тема — тоже настройка: экспортируем текущий режим вместе с данными
            storageGet('theme', (result) => {
                // file-фоны живут данными в storage.local — на экспорт их
                // нужно подтянуть, иначе на другом устройстве фон потеряется
                const fileBackdrops = currentState.backgrounds.filter((b) => b.type === 'file');
                const keys = fileBackdrops.map((b) => fileKey(b.fileId)).filter(Boolean);
                if (!fileBackdrops.length) {
                    finishExport(currentState.backgrounds, result.theme);
                    return;
                }
                chrome.storage.local.get(keys, (files) => {
                    void chrome.runtime?.lastError;
                    const withData = currentState.backgrounds.map((bg) => (
                        bg.type === 'file' ? { ...bg, data: (files || {})[fileKey(bg.fileId)] || '' } : bg
                    ));
                    finishExport(withData, result.theme);
                });
            });
        });

        // Плагинов по умолчанию больше нет: в бэкап входит всё, что
        // установлено, — иначе после переноса на другое устройство их
        // пришлось бы ставить заново.
        function finishExport(backgrounds, theme) {
            dbGetAllPlugins().then((records) => {
                const plugins = (Array.isArray(records) ? records : [])
                    .filter((record) => record && record.manifest && typeof record.code === 'string')
                    .map(({ manifest, code, enabled, icon }) => ({ manifest, code, enabled, icon }));

                storageLocalGet(null, (localAll) => {
                    const pluginData = {};
                    for (const [key, value] of Object.entries(localAll || {})) {
                        if (key.startsWith('plugin:')) pluginData[key] = value;
                    }
                    const pluginPlacements = Array.isArray(localAll?.[PLUGIN_PLACEMENTS_KEY])
                        ? localAll[PLUGIN_PLACEMENTS_KEY]
                        : [];
                    downloadJson({ ...buildExportPayload(backgrounds, theme), plugins, pluginData, pluginPlacements });
                });
            });
        }

        function buildExportPayload(backgrounds, theme) {
            return {
                version: 2,
                screens: currentState.screens,
                searchEngines: currentState.searchEngines,
                backgrounds,
                currentBackgroundIndex: currentState.currentBackgroundIndex,
                currentSearchEngineIndex: currentState.currentSearchEngineIndex,
                theme: theme || 'auto',
            };
        }

        /**
         * Скачивает JSON со настройками (общий хвост экспорта).
         */
        function downloadJson(json) {
            const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'tabvale_settings.json';
            a.click();
            URL.revokeObjectURL(a.href);
        }

        // --- Импорт: чтение JSON-файла и аккуратная проверка полей ---
        importSettingsJsonButton.addEventListener('click', () => importSettingsFileInput.click());
        importSettingsFileInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const payload = JSON.parse(await file.text());
                const newState = { ...currentState };
                // Каждый список прогоняем через санитизацию: элементы с
                // небезопасными адресами (javascript: и т.п.) и битыми полями
                // отбрасываются, остальное импортируется. У фонов своя
                // санитизация: у них типы (url/file/color/gradient)
                const rawBookmarks = Array.isArray(payload.screens)
                    ? payload.screens.flatMap((s) => Array.isArray(s?.bookmarks) ? s.bookmarks : [])
                    : (payload.bookmarks || []);
                const bookmarks = sanitizeList(rawBookmarks);
                const backgrounds = sanitizeBackgrounds(payload.backgrounds);
                const searchEngines = sanitizeList(payload.searchEngines, { requirePlaceholder: true });
                const importedScreens = payload.screens !== undefined || payload.bookmarks !== undefined
                    ? normalizeScreens(payload.screens, payload.bookmarks)
                    : null;

                if (importedScreens) {
                    newState.screens = importedScreens;
                    newState.currentScreenId = importedScreens[0].id;
                    newState.bookmarks = importedScreens[0].bookmarks;
                }
                if (payload.backgrounds !== undefined) {
                    newState.backgrounds = backgrounds.items;
                    // file-фоны из импорта несут data (data:URL) — раскладываем
                    // их в storage.local, в sync остаются только fileId
                    const fileData = {};
                    for (const bg of backgrounds.items) {
                        if (bg.type === 'file' && bg.data) {
                            fileData[fileKey(bg.fileId)] = bg.data;
                            delete bg.data;
                        }
                    }
                    if (Object.keys(fileData).length) {
                        chrome.storage.local.set(fileData);
                    }
                }
                if (payload.searchEngines !== undefined) newState.searchEngines = searchEngines.items;
                if (typeof payload.currentBackgroundIndex === 'number') newState.currentBackgroundIndex = payload.currentBackgroundIndex;
                if (typeof payload.currentSearchEngineIndex === 'number') newState.currentSearchEngineIndex = payload.currentSearchEngineIndex;
                // Режим темы: импортируем только корректные значения,
                // а старые файлы без поля theme не трогаем
                const themeModes = ['auto', 'light', 'dark'];
                let importedTheme = null;
                if (themeModes.includes(payload.theme)) importedTheme = payload.theme;
                saveState(newState);
                if (importedTheme) {
                    storageSet({ theme: importedTheme });
                    applyTheme(importedTheme);
                }
                currentState = newState;
                refreshUI();

                let pluginsSkipped = 0;
                if (Array.isArray(payload.plugins) && typeof parsePluginPackage === 'function') {
                    for (const item of payload.plugins) {
                        const parsed = parsePluginPackage(JSON.stringify(item));
                        if (!parsed.ok) { pluginsSkipped++; continue; }

                        // Бэкап не отменяет экран прав: код ставится только с согласия.
                        const permissions = [
                            t('pluginPermNetwork', { count: parsed.manifest.permissions.network.length }),
                            t('pluginPermStorage', { kb: parsed.manifest.permissions.storageKB }),
                            ...parsed.manifest.permissions.capabilities,
                        ].join(', ');
                        if (!window.confirm(t('pluginInstallConfirm', {
                            name: parsed.manifest.name,
                            permissions,
                        }))) {
                            pluginsSkipped++;
                            continue;
                        }

                        const stored = await dbPutPlugin({
                            id: parsed.manifest.id,
                            version: parsed.manifest.version,
                            manifest: parsed.manifest,
                            code: parsed.code,
                            icon: parsed.icon || item.icon || '',
                            basePath: '',
                            source: 'imported',
                            enabled: item.enabled !== false,
                            installedAt: Date.now(),
                        });
                        if (!stored) pluginsSkipped++;
                    }

                    if (payload.pluginData && typeof payload.pluginData === 'object') {
                        const data = {};
                        for (const [key, value] of Object.entries(payload.pluginData)) {
                            if (key.startsWith('plugin:')) data[key] = value;
                        }
                        if (Object.keys(data).length) chrome.storage.local.set(data);
                    }
                    if (Array.isArray(payload.pluginPlacements)) {
                        await new Promise((resolve) => storageLocalSet({
                            [PLUGIN_PLACEMENTS_KEY]: payload.pluginPlacements,
                        }, resolve));
                    }

                    if (typeof loadInstalledPlugins === 'function') {
                        await loadInstalledPlugins();
                        await loadPluginPlacements();
                        renderPluginDock();
                        renderPluginStrip();
                        renderPluginFloating();
                        renderPluginTiles();
                        renderPluginManager();
                    }
                }
                // Сообщаем не только об успехе, но и о пропущенных элементах:
                // молчаливое отбрасывание выглядело бы как потеря данных
                const totalSkipped = bookmarks.skipped + backgrounds.skipped + searchEngines.skipped + pluginsSkipped;
                // Сообщаем не только об успехе, но и о пропущенных элементах:
                // молчаливое отбрасывание выглядело бы как потеря данных
                alert(totalSkipped
                    ? t('importSkipped', { count: totalSkipped })
                    : t('importSuccess'));
            } catch (err) {
                alert(t('importError', { error: err.message }));
            } finally {
                // Сбрасываем input, чтобы выбор того же файла снова сработал
                importSettingsFileInput.value = '';
            }
        });

        // --- Сброс настроек: дефолтные списки, чистка file-фонов, тема auto ---
        document.getElementById('reset-settings').addEventListener('click', () => {
            if (!confirm(t('resetConfirm'))) return;

            // Картинки file-фонов живут в storage.local под ключами bgFile:*:
            // при сбросе записей о фонах они бы остались навсегда
            const staleFileKeys = currentState.backgrounds
                .filter((bg) => bg.type === 'file' && bg.fileId)
                .map((bg) => fileKey(bg.fileId));
            if (staleFileKeys.length) {
                chrome.storage.local.remove(staleFileKeys);
            }

            currentState = {
                screens: [{ id: DEFAULT_SCREEN_ID, title: defaultScreenTitle(0), bookmarks: DEFAULT_BOOKMARKS }],
                currentScreenId: DEFAULT_SCREEN_ID,
                searchEngines: DEFAULT_SEARCH_ENGINES,
                bookmarks: DEFAULT_BOOKMARKS,
                backgrounds: DEFAULT_BACKGROUNDS,
                currentBackgroundIndex: 0,
                currentSearchEngineIndex: 0,
            };
            saveState(currentState);
            // Тема возвращается к авто: хранится отдельным ключом, saveState
            // её не затрагивает
            storageSet({ theme: 'auto' });
            applyTheme('auto');

            refreshUI();
            alert(t('resetDone'));
        });
}
