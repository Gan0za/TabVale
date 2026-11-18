function mount(api) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:14px;gap:8px';

    const area = document.createElement('textarea');
    area.placeholder = api.locale?.startsWith('ru') ? 'Заметка…' : 'Note…';
    area.style.cssText = 'flex:1;resize:none;border:1px solid var(--tabvale-border);border-radius:10px;' +
        'background:var(--tabvale-surface);color:var(--tabvale-text);padding:12px;font:inherit;outline:none';

    const status = document.createElement('div');
    status.style.cssText = 'font-size:12px;color:var(--tabvale-muted);min-height:16px';

    wrap.append(area, status);
    document.body.append(wrap);

    let timer = null;
    api.storage.get('text').then((value) => {
        area.value = typeof value === 'string' ? value : '';
    });
    area.addEventListener('input', () => {
        clearTimeout(timer);
        status.textContent = '…';
        timer = setTimeout(async () => {
            await api.storage.set('text', area.value);
            status.textContent = api.locale?.startsWith('ru') ? 'Сохранено' : 'Saved';
        }, 300);
    });

    api.ui.ready();
}
