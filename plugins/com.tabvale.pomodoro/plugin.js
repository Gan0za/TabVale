function mount(api) {
    const compact = api.surface === 'strip';
    const ru = api.locale?.startsWith('ru');
    const DEFAULT_MINUTES = 5;
    let minutes = DEFAULT_MINUTES;
    let remaining = minutes * 60;
    let deadline = 0;
    let running = false;
    let interval = null;

    const wrap = document.createElement('div');
    wrap.style.cssText = compact
        ? 'display:flex;align-items:center;justify-content:center;gap:10px;height:100%;padding:8px 12px'
        : 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;padding:16px';

    const time = document.createElement('div');
    time.style.cssText = compact
        ? 'font-size:26px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--tabvale-accent)'
        : 'font-size:52px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--tabvale-accent)';

    const label = document.createElement('div');
    label.style.cssText = 'font-size:12px;color:var(--tabvale-muted);text-transform:uppercase;letter-spacing:.08em';

    function button(text, padding) {
        const element = document.createElement('button');
        element.type = 'button';
        element.textContent = text;
        element.style.cssText = `padding:${padding};border:1px solid var(--tabvale-border);border-radius:8px;` +
            'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer;font:inherit';
        return element;
    }

    const toggle = button(compact ? '▶' : (ru ? 'Старт' : 'Start'), compact ? '4px 10px' : '8px 14px');
    const reset = button(ru ? 'Сброс' : 'Reset', '8px 14px');
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:center';
    row.append(toggle);
    if (!compact) row.append(reset);

    // Минуты задаёт пользователь; значение переживает перезапуск.
    const minutesInput = document.createElement('input');
    minutesInput.type = 'number';
    minutesInput.min = '1';
    minutesInput.max = '180';
    minutesInput.style.cssText = 'width:74px;padding:6px 8px;border:1px solid var(--tabvale-border);border-radius:8px;' +
        'background:var(--tabvale-surface);color:var(--tabvale-text);font:inherit;text-align:center';

    function render() {
        const mm = Math.floor(remaining / 60);
        const ss = remaining % 60;
        time.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
        if (!compact) {
            label.textContent = remaining === 0
                ? (ru ? 'Время вышло' : "Time's up")
                : (running ? (ru ? 'Идёт' : 'Running') : (ru ? 'Таймер' : 'Timer'));
        }
    }

    function stop() {
        running = false;
        clearInterval(interval);
        interval = null;
        toggle.textContent = compact ? '▶' : (ru ? 'Старт' : 'Start');
    }

    function tick() {
        if (!running) return;
        remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        render();
        if (remaining === 0) stop();
    }

    toggle.addEventListener('click', () => {
        if (remaining === 0) remaining = minutes * 60;
        running = !running;
        toggle.textContent = compact
            ? (running ? '❚❚' : '▶')
            : (running ? (ru ? 'Пауза' : 'Pause') : (ru ? 'Старт' : 'Start'));
        if (running) {
            deadline = Date.now() + remaining * 1000;
            interval = setInterval(tick, 250);
        } else {
            clearInterval(interval);
            interval = null;
        }
        render();
    });

    reset.addEventListener('click', () => {
        stop();
        remaining = minutes * 60;
        render();
    });

    minutesInput.addEventListener('change', () => {
        const next = Math.min(180, Math.max(1, Math.round(Number(minutesInput.value) || DEFAULT_MINUTES)));
        minutes = next;
        minutesInput.value = String(next);
        api.storage.set('minutes', next);
        if (!running) {
            remaining = minutes * 60;
            render();
        }
    });

    if (compact) {
        wrap.append(time, row);
    } else {
        const minutesRow = document.createElement('div');
        minutesRow.style.cssText = 'display:flex;gap:8px;align-items:center;font-size:13px;color:var(--tabvale-muted)';
        const minutesLabel = document.createElement('span');
        minutesLabel.textContent = ru ? 'Минут' : 'Minutes';
        minutesRow.append(minutesInput, minutesLabel);
        wrap.append(time, label, minutesRow, row);
    }
    document.body.append(wrap);

    api.storage.get('minutes').then((saved) => {
        if (Number.isFinite(Number(saved)) && Number(saved) > 0) {
            minutes = Math.min(180, Math.max(1, Math.round(Number(saved))));
        }
        minutesInput.value = String(minutes);
        remaining = minutes * 60;
        render();
    }).catch(() => {
        minutesInput.value = String(minutes);
        render();
    });

    render();
    api.ui.ready();
}
