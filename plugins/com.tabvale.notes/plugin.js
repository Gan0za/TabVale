function mount(api) {
    const ru = api.locale?.startsWith('ru');
    const compact = api.surface === 'strip';
    let text = '';

    if (compact) {
        // В полосе — первая строка заметки, клик открывает панель.
        const preview = document.createElement('button');
        preview.type = 'button';
        preview.style.cssText = 'display:flex;align-items:center;width:100%;height:100%;padding:8px 14px;' +
            'border:0;background:transparent;color:var(--tabvale-muted);cursor:pointer;font:inherit;' +
            'text-align:left;overflow:hidden';
        preview.textContent = ru ? 'Заметка…' : 'Note…';
        preview.addEventListener('click', () => {
            api.ui.openPanel().catch(() => {});
        });
        document.body.append(preview);

        api.storage.get('text').then((value) => {
            text = typeof value === 'string' ? value : '';
            const line = text.split('\n').find((item) => item.trim()) || '';
            preview.textContent = line || (ru ? 'Заметка пуста' : 'Empty note');
            preview.style.color = line ? 'var(--tabvale-text)' : 'var(--tabvale-muted)';
        }).catch(() => {});

        api.ui.ready();
        return;
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:14px;gap:8px';

    const area = document.createElement('textarea');
    area.placeholder = ru ? 'Заметка…' : 'Note…';
    area.style.cssText = 'flex:1;min-height:0;resize:none;border:1px solid var(--tabvale-border);' +
        'border-radius:10px;background:var(--tabvale-surface);color:var(--tabvale-text);' +
        'padding:12px;font:inherit;outline:none';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px';

    const status = document.createElement('div');
    status.style.cssText = 'flex:1;font-size:12px;color:var(--tabvale-muted);min-height:16px';

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = ru ? 'Очистить' : 'Clear';
    clear.style.cssText = 'padding:7px 10px;border:1px solid var(--tabvale-border);border-radius:8px;' +
        'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer;font:inherit;font-size:12.5px';

    row.append(status, clear);
    wrap.append(area, row);
    document.body.append(wrap);

    let timer = null;
    let clearArmed = false;

    function armReset() {
        clearArmed = false;
        clear.textContent = ru ? 'Очистить' : 'Clear';
    }

    api.storage.get('text').then((value) => {
        text = typeof value === 'string' ? value : '';
        area.value = text;
    }).catch(() => {});

    area.addEventListener('input', () => {
        clearTimeout(timer);
        status.textContent = '…';
        timer = setTimeout(async () => {
            text = area.value;
            await api.storage.set('text', text);
            status.textContent = ru ? 'Сохранено' : 'Saved';
        }, 300);
    });

    // Удаление в два шага: в sandbox нет window.confirm.
    clear.addEventListener('click', async () => {
        if (!clearArmed) {
            clearArmed = true;
            clear.textContent = ru ? 'Точно?' : 'Sure?';
            setTimeout(armReset, 3000);
            return;
        }
        clearTimeout(timer);
        area.value = '';
        text = '';
        await api.storage.set('text', '');
        status.textContent = ru ? 'Очищено' : 'Cleared';
        armReset();
    });

    api.ui.ready();
}
