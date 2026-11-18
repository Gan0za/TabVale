function mount(api) {
    const ru = api.locale?.startsWith('ru');
    const EN = '`qwertyuiop[]asdfghjkl;\'zxcvbnm,./~!@#$%^&*()_+{}|:"<>?QWERTYUIOPASDFGHJKLZXCVBNM';
    const RU = 'ёйцукенгшщзхъфывапролджэячсмитьбю.Ё!"№;%:?*()_+/ХЪЖЭБЮ,ЙЦУКЕНГШЩЗФЫВАПРОЛДЯЧСМИТЬ';

    // Английская раскладка -> русская: кириллица остаётся как есть.
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

    // Смешанная раскладка: каждая буква меняет сторону. Символы, которые
    // есть в обеих таблицах, считаются русскими — так же, как на allcalc.
    function convertMixed(text) {
        let out = '';
        for (const char of text) {
            const ruIndex = RU.indexOf(char);
            if (ruIndex >= 0 && ruIndex < EN.length) { out += EN[ruIndex]; continue; }
            const enIndex = EN.indexOf(char);
            if (enIndex >= 0 && enIndex < RU.length) { out += RU[enIndex]; continue; }
            out += char;
        }
        return out;
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:12px;gap:6px';

    const labelStyle = 'font-size:12px;color:var(--tabvale-muted)';
    const areaStyle = 'flex:1;min-height:0;resize:none;border:1px solid var(--tabvale-border);border-radius:10px;' +
        'background:var(--tabvale-surface);color:var(--tabvale-text);padding:10px;font:inherit;outline:none';

    const sourceLabel = document.createElement('div');
    sourceLabel.textContent = ru ? 'Исходный текст' : 'Source text';
    sourceLabel.style.cssText = labelStyle;

    const source = document.createElement('textarea');
    source.placeholder = 'Ghbdtn? vbh!';
    source.style.cssText = areaStyle;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;flex:0 0 auto';

    const actions = [
        [ru ? 'На русский' : 'To Russian', () => convert(source.value, true)],
        [ru ? 'На латиницу' : 'To Latin', () => convert(source.value, false)],
        [ru ? 'Смешанный' : 'Mixed', () => convertMixed(source.value)],
    ];
    for (const [title, run] of actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = title;
        button.style.cssText = 'flex:1;padding:7px 4px;border:1px solid var(--tabvale-border);border-radius:8px;' +
            'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer;font:inherit;font-size:12.5px';
        button.addEventListener('click', () => { result.value = run(); });
        row.append(button);
    }

    const resultLabel = document.createElement('div');
    resultLabel.textContent = ru ? 'Результат' : 'Result';
    resultLabel.style.cssText = labelStyle;

    const result = document.createElement('textarea');
    result.style.cssText = areaStyle;

    wrap.append(sourceLabel, source, row, resultLabel, result);
    document.body.append(wrap);
    source.focus();
    api.ui.ready();
}
