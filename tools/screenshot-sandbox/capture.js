// Скрипт песочницы: ждёт загрузку данных, применяет состояние и
// оставляет страницу в нужном виде для headless-снимка.
(function () {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function waitFor(condition, timeout = 4000) {
        const started = Date.now();
        while (Date.now() - started < timeout) {
            if (condition()) return true;
            await sleep(50);
        }
        return false;
    }

    window.addEventListener('load', async () => {
        const params = new URLSearchParams(location.search);
        const shot = params.get('shot') || 'main';
        const theme = params.get('theme') === 'light' ? 'light' : 'dark';

        await waitFor(() => document.querySelector('#bookmarks-container .bookmark'));
        await applyLocale('en');
        applyTheme(theme);

        if (shot === 'screens') {
            openSettingsModal('screens');
        } else if (shot === 'backgrounds') {
            openSettingsModal('backgrounds');
        } else if (shot === 'search-engines') {
            openSettingsModal('search-engines');
        } else if (shot === 'context-menu') {
            const tile = document.querySelector('#bookmarks-container .bookmark');
            if (tile) {
                const index = Number(tile.dataset.index);
                const data = { index, url: tile.dataset.url };
                contextMenuData = data;
                const rect = tile.getBoundingClientRect();
                openContextMenu(rect.left, rect.bottom + 8, getContextMenuItems('bookmark', data));
            }
        } else if (shot === 'delete-screen') {
            openScreenDeleteDialog('work');
        }

        document.activeElement?.blur?.();
        await sleep(600);
        document.body.dataset.shotReady = '1';
    });
})();
