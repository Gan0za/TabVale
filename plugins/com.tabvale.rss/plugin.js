function mount(api) {
    const ru = api.locale?.startsWith('ru');
    const compact = api.surface === 'strip';
    const FEED = 'https://habr.com/ru/rss/news/';

    async function loadItems() {
        const response = await api.fetch(FEED);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const xml = new DOMParser().parseFromString(response.text, 'text/xml');
        return [...xml.querySelectorAll('item')].slice(0, 8).map((item) => ({
            title: item.querySelector('title')?.textContent?.trim() || '',
            link: item.querySelector('link')?.textContent?.trim() || '',
        })).filter((item) => item.title);
    }

    if (compact) {
        // В полосе — свежая новость, клик открывает её.
        const button = document.createElement('button');
        button.type = 'button';
        button.style.cssText = 'display:flex;align-items:center;width:100%;height:100%;padding:8px 14px;' +
            'border:0;background:transparent;color:var(--tabvale-text);cursor:pointer;font:inherit;' +
            'text-align:left;overflow:hidden;white-space:nowrap;text-overflow:ellipsis';
        button.textContent = '…';
        document.body.append(button);

        let latest = '';
        button.addEventListener('click', () => {
            if (latest) api.ui.openExternal(latest).catch(() => {});
        });

        loadItems().then((items) => {
            if (!items.length) {
                button.textContent = ru ? 'Нет новостей' : 'No stories';
                button.style.color = 'var(--tabvale-muted)';
                return;
            }
            button.textContent = items[0].title;
            button.title = items[0].title;
            latest = items[0].link;
        }).catch(() => {
            button.textContent = ru ? 'Нет ленты' : 'Feed unavailable';
            button.style.color = 'var(--tabvale-muted)';
        });

        api.ui.ready();
        return;
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;height:100%;padding:14px';

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px';

    const title = document.createElement('span');
    title.textContent = 'Habr';
    title.style.cssText = 'font-size:13px;font-weight:600;color:var(--tabvale-text)';

    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.textContent = '↻';
    refresh.title = ru ? 'Обновить' : 'Refresh';
    refresh.style.cssText = 'width:28px;height:28px;border:1px solid var(--tabvale-border);border-radius:8px;' +
        'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer;font:inherit';

    head.append(title, refresh);

    const status = document.createElement('div');
    status.style.cssText = 'font-size:12px;color:var(--tabvale-muted);min-height:16px';

    const list = document.createElement('div');
    list.style.cssText = 'flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column';

    wrap.append(head, status, list);
    document.body.append(wrap);

    function setStatus(text) {
        status.textContent = text;
    }

    function renderItems(items) {
        list.textContent = '';
        for (const item of items) {
            const link = document.createElement('a');
            link.textContent = item.title;
            link.href = '#';
            link.style.cssText = 'color:var(--tabvale-text);text-decoration:none;font-size:14px;' +
                'padding:8px 0;border-bottom:1px solid var(--tabvale-border);display:block';
            link.addEventListener('click', (event) => {
                event.preventDefault();
                if (item.link) api.ui.openExternal(item.link).catch(() => {});
            });
            list.append(link);
        }
    }

    async function load() {
        refresh.disabled = true;
        setStatus(ru ? 'Загрузка…' : 'Loading…');
        list.textContent = '';
        try {
            const items = await loadItems();
            if (!items.length) {
                setStatus(ru ? 'В ленте нет новостей' : 'The feed is empty');
                return;
            }
            setStatus('');
            renderItems(items);
        } catch {
            setStatus(ru ? 'Не удалось загрузить ленту' : 'Could not load the feed');
        } finally {
            refresh.disabled = false;
        }
    }

    refresh.addEventListener('click', load);
    load();
    api.ui.ready();
}
