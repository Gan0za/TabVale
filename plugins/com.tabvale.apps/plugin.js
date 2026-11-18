function mount(api) {
    const ru = api.locale?.startsWith('ru');
    const compact = api.surface === 'strip';
    const ALLOWED = ['https:', 'http:', 'obsidian:', 'vscode:'];

    const DEFAULT_APPS = [
        { title: 'Obsidian', description: ru ? 'Открыть хранилище' : 'Open vault', url: 'obsidian://open' },
        { title: 'VS Code', description: ru ? 'Открыть редактор' : 'Open editor', url: 'vscode://' },
    ];
    let apps = DEFAULT_APPS.map((app) => ({ ...app }));

    const wrap = document.createElement('div');
    wrap.style.cssText = compact
        ? 'display:flex;align-items:stretch;gap:8px;height:100%;padding:8px;overflow-x:auto'
        : 'display:flex;flex-direction:column;height:100%;padding:12px;gap:8px';

    const list = document.createElement('div');
    list.style.cssText = compact
        ? 'display:flex;gap:8px;align-items:stretch;min-width:0'
        : 'flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column';

    const addRow = document.createElement('div');
    addRow.style.cssText = 'display:flex;flex-direction:column;gap:6px;flex:0 0 auto';

    const urlInput = input(ru ? 'Ссылка приложения' : 'App URL');
    const titleInput = input(ru ? 'Название' : 'Title');
    const descInput = input(ru ? 'Описание (необязательно)' : 'Description (optional)');

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.textContent = ru ? 'Добавить приложение' : 'Add application';
    addButton.style.cssText = 'padding:8px 10px;border:1px solid var(--tabvale-border);border-radius:8px;' +
        'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer;font:inherit';

    const status = document.createElement('div');
    status.style.cssText = 'font-size:12px;color:var(--tabvale-muted);min-height:15px';

    function input(placeholder) {
        const field = document.createElement('input');
        field.type = 'text';
        field.placeholder = placeholder;
        field.style.cssText = 'padding:7px 9px;border:1px solid var(--tabvale-border);border-radius:8px;' +
            'background:var(--tabvale-surface);color:var(--tabvale-text);font:inherit';
        return field;
    }

    function letter(title) {
        const span = document.createElement('span');
        span.textContent = (title || '?').slice(0, 1).toUpperCase();
        span.style.cssText = 'width:20px;height:20px;flex:0 0 auto;display:inline-flex;align-items:center;' +
            'justify-content:center;border-radius:5px;background:var(--tabvale-surface);color:var(--tabvale-text);' +
            'font-size:11px;font-weight:600';
        return span;
    }

    // Иконка приложения: favicon сайта из кэша браузера, иначе буква.
    function icon(app, size) {
        const box = document.createElement('span');
        box.style.cssText = `width:${size}px;height:${size}px;flex:0 0 auto;display:inline-flex;` +
            'align-items:center;justify-content:center';
        let parsed = null;
        try { parsed = new URL(app.url); } catch { /* не ссылка */ }
        if (parsed && (parsed.protocol === 'https:' || parsed.protocol === 'http:')) {
            box.append(letter(app.title));
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
            return box;
        }
        box.append(letter(app.title));
        return box;
    }

    function isWebUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'https:' || parsed.protocol === 'http:';
        } catch {
            return false;
        }
    }

    function open(app) {
        api.ui.openExternal(app.url).catch(() => {
            status.textContent = ru ? 'Не удалось открыть приложение' : 'Could not open the application';
        });
    }

    function render() {
        list.textContent = '';

        for (const app of apps) {
            const button = document.createElement('button');
            button.type = 'button';
            button.style.cssText = compact
                ? 'flex:1 0 auto;display:flex;align-items:center;gap:6px;padding:6px 10px;' +
                  'border:1px solid var(--tabvale-border);border-radius:8px;background:var(--tabvale-surface);' +
                  'color:var(--tabvale-text);cursor:pointer;font:600 13px system-ui,sans-serif;white-space:nowrap'
                : 'display:flex;align-items:center;gap:10px;padding:10px 4px;border:0;border-bottom:1px solid var(--tabvale-border);' +
                  'background:transparent;color:var(--tabvale-text);cursor:pointer;font:inherit;text-align:left';
            button.addEventListener('click', () => open(app));

            const text = document.createElement('span');
            text.style.cssText = compact ? 'display:flex;align-items:center' : 'display:flex;flex-direction:column;gap:2px;flex:1;min-width:0';

            const title = document.createElement('span');
            title.textContent = app.title;
            if (!compact) title.style.fontWeight = '600';
            text.append(title);

            if (!compact && app.description) {
                const description = document.createElement('span');
                description.textContent = app.description;
                description.style.cssText = 'font-size:12px;color:var(--tabvale-muted);overflow:hidden;text-overflow:ellipsis';
                text.append(description);
            }

            // В полосе имя уже есть, поэтому без иконки сайта буква-заглушка
            // только дублирует первую букву названия.
            if (!compact || isWebUrl(app.url)) button.append(text, icon(app, compact ? 16 : 22));
            else button.append(text);

            if (!compact) {
                const remove = document.createElement('span');
                remove.textContent = '×';
                remove.title = ru ? 'Удалить' : 'Remove';
                remove.style.cssText = 'padding:0 6px;color:var(--tabvale-muted);font-size:16px';
                remove.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    apps = apps.filter((item) => item !== app);
                    await api.storage.set('apps', apps);
                    render();
                });
                button.append(remove);
            }

            list.append(button);
        }
    }

    async function addApp() {
        const url = urlInput.value.trim();
        const title = titleInput.value.trim();
        if (!url || !title) {
            status.textContent = ru ? 'Нужны ссылка и название' : 'A URL and a title are required';
            return;
        }
        let parsed;
        try { parsed = new URL(url); } catch {
            status.textContent = ru ? 'Некорректная ссылка' : 'Invalid URL';
            return;
        }
        if (!ALLOWED.includes(parsed.protocol)) {
            status.textContent = ru ? 'Поддерживаются https, http, obsidian:// и vscode://' : 'Supported: https, http, obsidian:// and vscode://';
            return;
        }
        if (apps.some((app) => app.url === url)) {
            status.textContent = ru ? 'Такое приложение уже есть' : 'This application is already in the list';
            return;
        }
        apps = [...apps, { title, description: descInput.value.trim(), url }];
        urlInput.value = '';
        titleInput.value = '';
        descInput.value = '';
        status.textContent = '';
        await api.storage.set('apps', apps);
        render();
    }

    addButton.addEventListener('click', addApp);
    for (const field of [urlInput, titleInput, descInput]) {
        field.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') addApp();
        });
    }

    if (compact) {
        wrap.append(list);
    } else {
        addRow.append(urlInput, titleInput, descInput, addButton, status);
        wrap.append(list, addRow);
    }
    document.body.append(wrap);

    api.storage.get('apps').then((saved) => {
        if (Array.isArray(saved) && saved.length) {
            apps = saved
                .filter((app) => app && typeof app.title === 'string' && typeof app.url === 'string')
                .map((app) => ({ title: app.title, description: String(app.description || ''), url: app.url }));
        }
        render();
    }).catch(() => render());

    render();
    api.ui.ready();
}
