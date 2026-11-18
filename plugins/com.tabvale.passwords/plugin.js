function mount(api) {
    const CHARSET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*_-+=?';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;justify-content:center;gap:12px;padding:16px';

    const output = document.createElement('input');
    output.readOnly = true;
    output.style.cssText = 'padding:12px;border:1px solid var(--tabvale-border);border-radius:10px;' +
        'background:var(--tabvale-surface);color:var(--tabvale-text);font:600 16px ui-monospace,monospace';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px';

    const length = document.createElement('input');
    length.type = 'range';
    length.min = '12';
    length.max = '32';
    length.value = '20';
    length.style.cssText = 'flex:1';

    const lengthLabel = document.createElement('span');
    lengthLabel.style.cssText = 'font-size:12px;color:var(--tabvale-muted);min-width:24px';
    lengthLabel.textContent = length.value;

    const generate = document.createElement('button');
    generate.textContent = api.locale?.startsWith('ru') ? 'Сгенерировать' : 'Generate';
    generate.style.cssText = 'padding:10px 14px;border:1px solid var(--tabvale-border);border-radius:8px;' +
        'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer;font:inherit';

    function randomPassword(size) {
        const bytes = new Uint32Array(size);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (value) => CHARSET[value % CHARSET.length]).join('');
    }

    function update() {
        lengthLabel.textContent = length.value;
        output.value = randomPassword(Number(length.value));
    }

    length.addEventListener('input', update);
    generate.addEventListener('click', update);

    row.append(length, lengthLabel);
    wrap.append(output, row, generate);
    document.body.append(wrap);
    update();

    api.ui.ready();
}
