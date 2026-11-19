function mount(api) {
    const ru = api.locale?.startsWith('ru');
    const compact = api.surface === 'strip';
    let items = [];

    function normalize(value) {
        if (!Array.isArray(value)) return [];
        return value
            .filter((item) => item && typeof item.text === 'string' && item.text.trim())
            .map((item) => ({ id: String(item.id || item.text), text: item.text.trim().slice(0, 200), done: item.done === true }));
    }

    async function persist() {
        try { await api.storage.set('items', items); } catch { /* квота */ }
    }

    if (compact) {
        const button = document.createElement('button');
        button.type = 'button';
        button.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;height:100%;padding:8px 14px;' +
            'border:0;background:transparent;color:var(--tabvale-text);cursor:pointer;font:inherit;' +
            'text-align:left;overflow:hidden;white-space:nowrap;text-overflow:ellipsis';
        button.textContent = ru ? 'Задачи' : 'Tasks';
        button.addEventListener('click', () => api.ui.openPanel().catch(() => {}));
        document.body.append(button);

        function renderStrip() {
            const left = items.filter((item) => !item.done);
            if (!items.length) {
                button.textContent = ru ? 'Задач нет' : 'No tasks';
                button.style.color = 'var(--tabvale-muted)';
                return;
            }
            const first = left[0]?.text || (ru ? 'Всё выполнено' : 'All done');
            button.textContent = left.length ? `${left.length} · ${first}` : first;
            button.title = button.textContent;
            button.style.color = left.length ? 'var(--tabvale-text)' : 'var(--tabvale-muted)';
        }

        api.storage.get('items').then((value) => {
            items = normalize(value);
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

    const addToggle = document.createElement('button');
    addToggle.type = 'button';
    addToggle.textContent = ru ? '＋ Добавить задачу' : '＋ Add task';
    addToggle.style.cssText = 'padding:8px 10px;border:1px solid var(--tabvale-border);border-radius:8px;' +
        'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer;font:inherit;flex:0 0 auto';

    const form = document.createElement('div');
    form.style.cssText = 'display:none;gap:6px;flex:0 0 auto';
    form.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = ru ? 'Что сделать?' : 'What to do?';
    input.style.cssText = 'flex:1;min-width:0;padding:7px 9px;border:1px solid var(--tabvale-border);' +
        'border-radius:8px;background:var(--tabvale-surface);color:var(--tabvale-text);font:inherit';

    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = ru ? 'Добавить' : 'Add';
    save.style.cssText = 'padding:7px 10px;border:1px solid var(--tabvale-border);border-radius:8px;' +
        'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer;font:inherit';

    form.append(input, save);
    wrap.append(list, addToggle, form);
    document.body.append(wrap);

    function renderPanel() {
        list.textContent = '';
        if (!items.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:12px 4px;font-size:13px;color:var(--tabvale-muted)';
            empty.textContent = ru ? 'Задач пока нет' : 'No tasks yet';
            list.append(empty);
            return;
        }

        for (const item of items) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 0;' +
                'border-bottom:1px solid var(--tabvale-border)';

            const box = document.createElement('input');
            box.type = 'checkbox';
            box.checked = item.done;
            box.addEventListener('change', async () => {
                item.done = box.checked;
                await persist();
                renderPanel();
            });

            const text = document.createElement('span');
            text.textContent = item.text;
            text.style.cssText = 'flex:1;min-width:0;font-size:14px;color:' +
                (item.done ? 'var(--tabvale-muted)' : 'var(--tabvale-text)') +
                ';text-decoration:' + (item.done ? 'line-through' : 'none') +
                ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap';

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = '×';
            remove.title = ru ? 'Удалить' : 'Remove';
            remove.style.cssText = 'flex:0 0 auto;border:0;background:transparent;color:var(--tabvale-muted);' +
                'font-size:16px;cursor:pointer';
            remove.addEventListener('click', async () => {
                items = items.filter((entry) => entry !== item);
                await persist();
                renderPanel();
            });

            row.append(box, text, remove);
            list.append(row);
        }
    }

    function showForm() {
        form.style.display = 'flex';
        addToggle.style.display = 'none';
        input.focus();
    }

    function hideForm() {
        form.style.display = 'none';
        addToggle.style.display = '';
        input.value = '';
    }

    async function addItem() {
        const text = input.value.trim();
        if (!text) return;
        items = [...items, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, done: false }];
        await persist();
        hideForm();
        renderPanel();
    }

    addToggle.addEventListener('click', showForm);
    save.addEventListener('click', addItem);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') addItem();
        if (event.key === 'Escape') hideForm();
    });

    api.storage.get('items').then((value) => {
        items = normalize(value);
        renderPanel();
    }).catch(() => renderPanel());

    renderPanel();
    api.ui.ready();
}
