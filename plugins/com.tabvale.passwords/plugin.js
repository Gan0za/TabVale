function mount(api) {
    const ru = api.locale?.startsWith('ru');
    const compact = api.surface === 'strip';
    const LOWER = 'abcdefghijkmnopqrstuvwxyz';
    const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const DIGITS = '23456789';
    const SYMBOLS = '!@#$%^&*_-+=?';

    let settings = { length: 20, digits: true, symbols: true };

    function charset() {
        return LOWER + UPPER
            + (settings.digits ? DIGITS : '')
            + (settings.symbols ? SYMBOLS : '');
    }

    function randomFrom(source, size) {
        const bytes = new Uint32Array(size);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (value) => source[value % source.length]).join('');
    }

    // Гарантируем хотя бы один символ из каждого включённого набора.
    function randomPassword(size) {
        const pools = [LOWER, UPPER];
        if (settings.digits) pools.push(DIGITS);
        if (settings.symbols) pools.push(SYMBOLS);

        const chars = pools.map((pool) => randomFrom(pool, 1));
        while (chars.length < size) chars.push(randomFrom(pools[chars.length % pools.length], 1));
        const bytes = new Uint32Array(chars.length);
        crypto.getRandomValues(bytes);
        for (let i = chars.length - 1; i > 0; i--) {
            const j = bytes[i] % (i + 1);
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        return chars.slice(0, size).join('');
    }

    async function persist() {
        try { await api.storage.set('settings', settings); } catch { /* квота */ }
    }

    function outputField() {
        const output = document.createElement('input');
        output.readOnly = true;
        output.spellcheck = false;
        output.style.cssText = 'min-width:0;padding:10px;border:1px solid var(--tabvale-border);' +
            'border-radius:10px;background:var(--tabvale-surface);color:var(--tabvale-text);' +
            'font:600 15px ui-monospace,SFMono-Regular,Consolas,monospace';
        return output;
    }

    function selectAll(field) {
        field.focus();
        field.select?.();
        field.setSelectionRange?.(0, field.value.length);
    }

    function actionButton(text, small) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.style.cssText = (small ? 'padding:6px 10px;font-size:12.5px;' : 'padding:9px 12px;') +
            'border:1px solid var(--tabvale-border);border-radius:8px;background:var(--tabvale-surface);' +
            'color:var(--tabvale-text);cursor:pointer;font:inherit;flex:0 0 auto';
        return button;
    }

    if (compact) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%;height:100%;padding:8px';

        const output = outputField();
        output.style.flex = '1';
        output.style.fontSize = '13px';
        output.title = ru ? 'Нажмите, чтобы выделить' : 'Click to select';
        output.addEventListener('click', () => selectAll(output));

        const again = actionButton('↻', true);
        again.title = ru ? 'Сгенерировать заново' : 'Generate again';
        again.addEventListener('click', () => {
            output.value = randomPassword(settings.length);
        });

        api.storage.get('settings').then((saved) => {
            if (saved && Number.isFinite(Number(saved.length))) {
                settings = {
                    length: Math.min(40, Math.max(12, Math.round(Number(saved.length)))),
                    digits: saved.digits !== false,
                    symbols: saved.symbols !== false,
                };
            }
            output.value = randomPassword(settings.length);
        }).catch(() => {
            output.value = randomPassword(settings.length);
        });

        row.append(output, again);
        document.body.append(row);
        api.ui.ready();
        return;
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;justify-content:center;gap:12px;padding:16px';

    const output = outputField();
    output.addEventListener('click', () => selectAll(output));

    const lengthRow = document.createElement('div');
    lengthRow.style.cssText = 'display:flex;align-items:center;gap:10px';

    const length = document.createElement('input');
    length.type = 'range';
    length.min = '12';
    length.max = '40';
    length.value = String(settings.length);
    length.style.cssText = 'flex:1';

    const lengthLabel = document.createElement('span');
    lengthLabel.style.cssText = 'font-size:12px;color:var(--tabvale-muted);min-width:24px;text-align:right';
    lengthLabel.textContent = String(settings.length);

    lengthRow.append(length, lengthLabel);

    function checkbox(labelText, key) {
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;color:var(--tabvale-text)';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = settings[key];
        box.addEventListener('change', () => {
            settings[key] = box.checked;
            persist();
            update();
        });
        label.append(box, document.createTextNode(labelText));
        return label;
    }

    const optionsRow = document.createElement('div');
    optionsRow.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap';
    optionsRow.append(
        checkbox(ru ? 'Цифры' : 'Digits', 'digits'),
        checkbox(ru ? 'Символы' : 'Symbols', 'symbols')
    );

    const buttonsRow = document.createElement('div');
    buttonsRow.style.cssText = 'display:flex;gap:8px';

    const generate = actionButton(ru ? 'Сгенерировать' : 'Generate');
    const select = actionButton(ru ? 'Выделить' : 'Select');

    buttonsRow.append(generate, select);

    wrap.append(output, lengthRow, optionsRow, buttonsRow);
    document.body.append(wrap);

    function update() {
        lengthLabel.textContent = length.value;
        output.value = randomPassword(Number(length.value));
    }

    length.addEventListener('input', () => {
        settings.length = Number(length.value);
        lengthLabel.textContent = length.value;
        persist();
        output.value = randomPassword(settings.length);
    });
    generate.addEventListener('click', update);
    select.addEventListener('click', () => selectAll(output));

    api.storage.get('settings').then((saved) => {
        if (saved && Number.isFinite(Number(saved.length))) {
            settings = {
                length: Math.min(40, Math.max(12, Math.round(Number(saved.length)))),
                digits: saved.digits !== false,
                symbols: saved.symbols !== false,
            };
            length.value = String(settings.length);
            optionsRow.querySelectorAll('input[type=checkbox]').forEach((box, index) => {
                box.checked = index === 0 ? settings.digits : settings.symbols;
            });
        }
        update();
    }).catch(() => update());

    update();
    api.ui.ready();
}
