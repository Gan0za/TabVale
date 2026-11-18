function mount(api) {
    const ru = api.locale?.startsWith('ru');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;gap:10px;padding:12px';

    const status = document.createElement('div');
    status.style.cssText = 'font-size:12px;color:var(--tabvale-muted);min-height:16px';

    const list = document.createElement('div');
    list.style.cssText = 'flex:1;overflow:auto;display:flex;flex-direction:column;gap:2px';

    const add = document.createElement('button');
    add.textContent = ru ? 'Добавить выбранные' : 'Add selected';
    add.style.cssText = 'padding:10px;border:1px solid var(--tabvale-border);border-radius:8px;' +
        'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer;font:inherit';

    // Без доступа список пуст — вместо него показываем переход к менеджеру,
    // где кнопка разрешения нажимается настоящим кликом.
    const grant = document.createElement('button');
    grant.type = 'button';
    grant.textContent = ru ? 'Разрешить доступ' : 'Allow access';
    grant.style.cssText = add.style.cssText;
    grant.hidden = true;
    grant.addEventListener('click', async () => {
        grant.disabled = true;
        try {
            await api.ui.openManager();
        } finally {
            grant.disabled = false;
        }
    });

    wrap.append(list, status, grant, add);
    document.body.append(wrap);

    const checked = new Set();
    const items = new Map();

    function row(depth, label, isFolder) {
        const element = document.createElement('label');
        element.style.cssText = `display:flex;align-items:center;gap:8px;padding:5px 6px 5px ${6 + depth * 14}px;` +
            'font-size:13px;border-radius:6px;cursor:pointer;color:' + (isFolder ? 'var(--tabvale-muted)' : 'var(--tabvale-text)');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.disabled = isFolder;
        const text = document.createElement('span');
        text.textContent = label;
        text.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        element.append(box, text);
        return { element, box };
    }

    function render(nodes, depth, path) {
        for (const node of nodes) {
            if (node.url) {
                const key = node.id;
                const { element, box } = row(depth, node.title || node.url, false);
                items.set(key, { title: node.title || node.url, url: node.url });
                box.addEventListener('change', () => {
                    if (box.checked) checked.add(key); else checked.delete(key);
                });
                list.append(element);
            } else if (Array.isArray(node.children) && node.children.length) {
                const title = depth === 0 && !node.title ? (ru ? 'Закладки' : 'Bookmarks') : node.title;
                if (title) list.append(row(depth, title, true).element);
                render(node.children, depth + 1, path);
            }
        }
    }

    async function load() {
        try {
            const tree = await api.bookmarks.tree();
            render(tree, 0, '');
            grant.hidden = true;
            add.hidden = false;
            if (!items.size) status.textContent = ru ? 'В браузере нет закладок' : 'No browser bookmarks';
        } catch (error) {
            status.textContent = ru
                ? 'Нет доступа к закладкам.'
                : 'Bookmark access is not granted.';
            grant.hidden = false;
            add.hidden = true;
        }
    }

    add.addEventListener('click', async () => {
        const selected = [...checked].map((key) => items.get(key)).filter(Boolean);
        if (!selected.length) {
            status.textContent = ru ? 'Отметьте хотя бы одну закладку' : 'Select at least one bookmark';
            return;
        }
        try {
            const result = await api.bookmarks.import(null, selected);
            status.textContent = ru
                ? `Добавлено: ${result.added}, пропущено: ${result.skipped}`
                : `Added ${result.added}, skipped ${result.skipped}`;
            checked.clear();
            [...list.querySelectorAll('input[type=checkbox]')].forEach((box) => { box.checked = false; });
        } catch {
            status.textContent = ru ? 'Не удалось добавить закладки' : 'Could not add bookmarks';
        }
    });

    load();
    api.ui.ready();
}
