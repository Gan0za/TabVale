function mount(api) {
    const EN = '`qwertyuiop[]asdfghjkl;\'zxcvbnm,./~!@#$%^&*()_+{}|:"<>?';
    const RU = 'ёйцукенгшщзхъфывапролджэячсмитьбю.Ё!"№;%:?*()_+/ХЪЖЭБЮ,';

    function convert(text, toRussian) {
        const from = toRussian ? EN : RU;
        const to = toRussian ? RU : EN;
        let out = '';
        for (const char of text) {
            const index = from.indexOf(char);
            out += index >= 0 && index < to.length ? to[index] : char;
        }
        return out;
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:14px;gap:10px';

    const area = document.createElement('textarea');
    area.placeholder = 'Ghbdtn? vbh!';
    area.style.cssText = 'flex:1;resize:none;border:1px solid var(--tabvale-border);border-radius:10px;' +
        'background:var(--tabvale-surface);color:var(--tabvale-text);padding:12px;font:inherit;outline:none';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px';

    const toRu = document.createElement('button');
    toRu.textContent = 'EN → RU';
    const toEn = document.createElement('button');
    toEn.textContent = 'RU → EN';
    for (const button of [toRu, toEn]) {
        button.style.cssText = 'flex:1;padding:8px;border:1px solid var(--tabvale-border);border-radius:8px;' +
            'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer;font:inherit';
    }

    toRu.addEventListener('click', () => { area.value = convert(area.value, true); });
    toEn.addEventListener('click', () => { area.value = convert(area.value, false); });

    row.append(toRu, toEn);
    wrap.append(area, row);
    document.body.append(wrap);
    area.focus();
    api.ui.ready();
}
