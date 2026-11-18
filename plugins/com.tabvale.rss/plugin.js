function mount(api) {
    const ru = api.locale?.startsWith('ru');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;height:100%;padding:14px;overflow:auto';
    wrap.textContent = ru ? 'Загрузка…' : 'Loading…';
    document.body.append(wrap);

    async function load() {
        try {
            const response = await api.fetch('https://habr.com/ru/rss/news/');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const documentXml = new DOMParser().parseFromString(response.text, 'text/xml');
            const items = [...documentXml.querySelectorAll('item')].slice(0, 6);
            wrap.textContent = '';
            if (!items.length) throw new Error('no items');

            for (const item of items) {
                const title = item.querySelector('title')?.textContent || '';
                const link = item.querySelector('link')?.textContent || '';
                const element = document.createElement('a');
                element.textContent = title;
                element.href = '#';
                element.style.cssText = 'color:var(--tabvale-text);text-decoration:none;font-size:14px;' +
                    'padding:8px 0;border-bottom:1px solid var(--tabvale-border);display:block';
                element.addEventListener('click', (event) => {
                    event.preventDefault();
                    if (link) api.ui.openExternal(link);
                });
                wrap.append(element);
            }
        } catch {
            wrap.textContent = ru ? 'Не удалось загрузить ленту' : 'Could not load the feed';
        }
    }

    load();
    api.ui.ready();
}
