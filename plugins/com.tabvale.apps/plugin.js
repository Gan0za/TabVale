function mount(api) {
    const ru = api.locale?.startsWith('ru');
    const compact = api.surface === 'strip';
    const NS = 'http://www.w3.org/2000/svg';
    const BLOCKED = ['javascript:', 'data:', 'blob:', 'vbscript:', 'file:'];
    const STRIP_LIMIT = 3;

    const DEFAULT_APPS = [
        { title: 'Obsidian', description: ru ? 'Открыть хранилище' : 'Open vault', url: 'obsidian://open' },
        { title: 'VS Code', description: ru ? 'Открыть редактор' : 'Open editor', url: 'vscode://' },
    ];
    let apps = DEFAULT_APPS.map((app) => ({ ...app }));

    // Контурные значки: у известных приложений свои, у остальных — окно.
    const GLYPHS = {
        'obsidian:': ['M12 3l6 5-2.5 13h-7L6 8l6-5Z', 'M6 8h12'],
        'vscode:': ['M9 8l-4 4 4 4', 'M15 8l4 4-4 4'],
        window: ['M4 6h16v12H4z', 'M4 10h16', 'M7 8h.01'],
        grid: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
    };

    function glyph(paths, size) {
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.8');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.style.cssText = `width:${size}px;height:${size}px;flex:0 0 auto;color:var(--tabvale-muted)`;
        for (const d of paths) {
            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', d);
            svg.append(path);
        }
        return svg;
    }

    function parseUrl(url) {
        try { return new URL(url); } catch { return null; }
    }

    function isWeb(url) {
        const parsed = parseUrl(url);
        return !!parsed && (parsed.protocol === 'https:' || parsed.protocol === 'http:');
    }

    // Иконка приложения: своя у известных, favicon у сайтов, окно у прочих.
    function appIcon(app, size) {
        const box = document.createElement('span');
        box.style.cssText = `width:${size}px;height:${size}px;flex:0 0 auto;display:inline-flex;` +
            'align-items:center;justify-content:center';

        const parsed = parseUrl(app.url);
        const protocol = parsed ? parsed.protocol : '';
        box.append(glyph(GLYPHS[protocol] || GLYPHS.window, size));

        if (isWeb(app.url)) {
            api.icon.favicon(app.url).then((dataUrl) => {
                if (!dataUrl) return;
                const image = document.createElement('img');
                image.src = dataUrl;
                image.alt = '';
                image.width = size;
                image.height = size;
                image.style.cssText = `width:${size}px;height:${size}px;border-radius:5px;display:block`;
                box.textContent = '';
                box.append(image);
            }).catch(() => {});
        }
        return box;
    }

    function open(app) {
        api.ui.openExternal(app.url).catch(() => {
            if (!compact) status.textContent = ru ? 'Не удалось открыть приложение' : 'Could not open the application';
        });
    }

    function field(placeholder) {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.style.cssText = 'padding:7px 9px;border:1px solid var(--tabvale-border);border-radius:8px;' +
            'background:var(--tabvale-surface);color:var(--tabvale-text);font:inherit';
        return input;
    }

    function flatButton(text) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.style.cssText = 'padding:8px 10px;border:1px solid var(--tabvale-border);border-radius:8px;' +
            'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer;font:inherit';
        return button;
    }

    if (compact) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;height:100%;' +
            'padding:8px;overflow:hidden';

        function stripButton(app) {
            const button = document.createElement('button');
            button.type = 'button';
            button.title = app.title;
            button.setAttribute('aria-label', app.title);
            button.style.cssText = 'width:34px;height:34px;flex:0 0 auto;display:inline-flex;align-items:center;' +
                'justify-content:center;padding:0;border:1px solid var(--tabvale-border);border-radius:9px;' +
                'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer';
            button.append(appIcon(app, 20));
            button.addEventListener('click', () => open(app));
            return button;
        }

        function renderStrip() {
            wrap.textContent = '';
            for (const app of apps.slice(0, STRIP_LIMIT)) wrap.append(stripButton(app));

            // Кнопка оконного режима: полный список и добавление приложений.
            const windowButton = document.createElement('button');
            windowButton.type = 'button';
            windowButton.title = ru ? 'Открыть список' : 'Open the list';
            windowButton.setAttribute('aria-label', ru ? 'Открыть список' : 'Open the list');
            windowButton.style.cssText = 'width:34px;height:34px;flex:0 0 auto;display:inline-flex;align-items:center;' +
                'justify-content:center;padding:0;border:1px solid var(--tabvale-border);border-radius:9px;' +
                'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer';
            windowButton.append(glyph(GLYPHS.grid, 18));
            windowButton.addEventListener('click', () => {
                api.ui.openPanel().catch(() => {});
            });
            wrap.append(windowButton);
        }

        document.body.append(wrap);
        api.storage.get('apps').then((saved) => {
            if (Array.isArray(saved) && saved.length) {
                apps = saved
                    .filter((app) => app && typeof app.title === 'string' && typeof app.url === 'string')
                    .map((app) => ({ title: app.title, description: String(app.description || ''), url: app.url }));
            }
            renderStrip();
        }).catch(() => renderStrip());

        renderStrip();
        api.ui.ready();
        return;
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:12px;gap:8px';

    const list = document.createElement('div');
    list.style.cssText = 'flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column';

    const addToggle = flatButton(ru ? '＋ Добавить приложение' : '＋ Add application');
    addToggle.style.flex = '0 0 auto';

    const form = document.createElement('div');
    form.style.cssText = 'display:none;flex-direction:column;gap:6px;flex:0 0 auto;padding-top:8px;' +
        'border-top:1px solid var(--tabvale-border)';
    form.style.display = 'none';

    const urlInput = field(ru ? 'Ссылка приложения' : 'App URL');
    const titleInput = field(ru ? 'Название' : 'Title');
    const descInput = field(ru ? 'Описание (необязательно)' : 'Description (optional)');

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:6px';
    const saveButton = flatButton(ru ? 'Сохранить' : 'Save');
    const cancelButton = flatButton(ru ? 'Отмена' : 'Cancel');
    actions.append(saveButton, cancelButton);

    const status = document.createElement('div');
    status.style.cssText = 'font-size:12px;color:var(--tabvale-muted);min-height:15px';

    wrap.append(list, addToggle, form);
    form.append(urlInput, titleInput, descInput, actions, status);
    document.body.append(wrap);

    function showForm() {
        form.style.display = 'flex';
        addToggle.style.display = 'none';
        status.textContent = '';
        urlInput.focus();
    }

    function hideForm() {
        form.style.display = 'none';
        addToggle.style.display = '';
        urlInput.value = '';
        titleInput.value = '';
        descInput.value = '';
        status.textContent = '';
    }

    function renderPanel() {
        list.textContent = '';
        if (!apps.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:12px 4px;font-size:13px;color:var(--tabvale-muted)';
            empty.textContent = ru ? 'Пока нет приложений' : 'No applications yet';
            list.append(empty);
        }

        for (const app of apps) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 0;' +
                'border-bottom:1px solid var(--tabvale-border)';

            const text = document.createElement('button');
            text.type = 'button';
            text.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;padding:0;' +
                'border:0;background:transparent;color:var(--tabvale-text);cursor:pointer;font:inherit;text-align:left';
            text.addEventListener('click', () => open(app));

            const title = document.createElement('span');
            title.textContent = app.title;
            title.style.cssText = 'font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
            text.append(title);

            if (app.description) {
                const description = document.createElement('span');
                description.textContent = app.description;
                description.style.cssText = 'font-size:12px;color:var(--tabvale-muted);overflow:hidden;' +
                    'text-overflow:ellipsis;white-space:nowrap';
                text.append(description);
            }

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = '×';
            remove.title = ru ? 'Удалить' : 'Remove';
            remove.style.cssText = 'flex:0 0 auto;border:0;background:transparent;color:var(--tabvale-muted);' +
                'font-size:16px;cursor:pointer';
            remove.addEventListener('click', async () => {
                apps = apps.filter((item) => item !== app);
                await api.storage.set('apps', apps);
                renderPanel();
            });

            row.append(text, appIcon(app, 22), remove);
            list.append(row);
        }
    }

    async function saveApp() {
        const url = urlInput.value.trim();
        const title = titleInput.value.trim();
        if (!url || !title) {
            status.textContent = ru ? 'Нужны ссылка и название' : 'A URL and a title are required';
            return;
        }
        const parsed = parseUrl(url);
        if (!parsed) {
            status.textContent = ru ? 'Некорректная ссылка' : 'Invalid URL';
            return;
        }
        if (BLOCKED.includes(parsed.protocol)) {
            status.textContent = ru ? 'Эта схема ссылки не поддерживается' : 'This URL scheme is not supported';
            return;
        }
        if (apps.some((app) => app.url === url)) {
            status.textContent = ru ? 'Такое приложение уже есть' : 'This application is already in the list';
            return;
        }
        apps = [...apps, { title, description: descInput.value.trim(), url }];
        await api.storage.set('apps', apps);
        hideForm();
        renderPanel();
    }

    addToggle.addEventListener('click', showForm);
    saveButton.addEventListener('click', saveApp);
    cancelButton.addEventListener('click', hideForm);
    for (const input of [urlInput, titleInput, descInput]) {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') saveApp();
        });
    }

    api.storage.get('apps').then((saved) => {
        if (Array.isArray(saved) && saved.length) {
            apps = saved
                .filter((app) => app && typeof app.title === 'string' && typeof app.url === 'string')
                .map((app) => ({ title: app.title, description: String(app.description || ''), url: app.url }));
        }
        renderPanel();
    }).catch(() => renderPanel());

    renderPanel();
    api.ui.ready();
}
