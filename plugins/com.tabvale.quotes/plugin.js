function mount(api) {
    const ru = api.locale?.startsWith('ru');
    const compact = api.surface === 'strip';

    // Пословицы и короткие мысли без авторских текстов.
    const QUOTES = ru
        ? [
            'Тише едешь — дальше будешь.',
            'Дело мастера боится.',
            'Семь раз отмерь — один отрежь.',
            'Не откладывай на завтра то, что можно сделать сегодня.',
            'Дорогу осилит идущий.',
            'Терпение и труд всё перетрут.',
            'Лучше сделать и пожалеть, чем не сделать и пожалеть.',
            'Порядок в делах — порядок в голове.',
            'Маленькие шаги ведут далеко.',
            'Не всё то золото, что блестит.',
        ]
        : [
            'Slow and steady wins the race.',
            'Practice makes perfect.',
            'Measure twice, cut once.',
            'Never put off until tomorrow what you can do today.',
            'The journey is the reward.',
            'Patience and persistence move mountains.',
            'Better to try and regret than never to try.',
            'A clear desk, a clear mind.',
            'Small steps cover long distances.',
            'All that glitters is not gold.',
        ];

    function pick(except) {
        if (QUOTES.length < 2) return QUOTES[0];
        let next = except;
        while (next === except) next = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        return next;
    }

    if (compact) {
        const button = document.createElement('button');
        button.type = 'button';
        let current = pick('');
        button.textContent = current;
        button.title = current;
        button.style.cssText = 'display:flex;align-items:center;width:100%;height:100%;padding:8px 14px;' +
            'border:0;background:transparent;color:var(--tabvale-text);cursor:pointer;font:inherit;' +
            'font-style:italic;text-align:left;overflow:hidden;white-space:nowrap;text-overflow:ellipsis';
        button.addEventListener('click', () => {
            current = pick(current);
            button.textContent = current;
            button.title = current;
        });
        document.body.append(button);
        api.ui.ready();
        return;
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;justify-content:center;align-items:center;' +
        'height:100%;gap:14px;padding:18px;text-align:center';

    let current = pick('');
    const quote = document.createElement('div');
    quote.textContent = current;
    quote.style.cssText = 'font-size:18px;line-height:1.45;font-style:italic;color:var(--tabvale-text)';

    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = ru ? 'Другая' : 'Another';
    next.style.cssText = 'padding:8px 14px;border:1px solid var(--tabvale-border);border-radius:8px;' +
        'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer;font:inherit';

    next.addEventListener('click', () => {
        current = pick(current);
        quote.textContent = current;
    });

    wrap.append(quote, next);
    document.body.append(wrap);
    api.ui.ready();
}
