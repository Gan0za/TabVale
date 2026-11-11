function mount(api) {
    const FOCUS = 25 * 60;
    const BREAK = 5 * 60;
    let remaining = FOCUS;
    let deadline = 0;
    let running = false;
    let interval = null;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;padding:16px';

    const time = document.createElement('div');
    time.style.cssText = 'font-size:52px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--tabvale-accent)';

    const label = document.createElement('div');
    label.style.cssText = 'font-size:12px;color:var(--tabvale-muted);text-transform:uppercase;letter-spacing:.08em';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px';

    function button(text) {
        const element = document.createElement('button');
        element.textContent = text;
        element.style.cssText = 'padding:8px 14px;border:1px solid var(--tabvale-border);border-radius:8px;' +
            'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer;font:inherit';
        return element;
    }

    const toggle = button('Start');
    const reset = button('Reset');
    row.append(toggle, reset);
    wrap.append(time, label, row);
    document.body.append(wrap);

    function render() {
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        time.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        label.textContent = api.locale?.startsWith('ru') ? 'Фокус' : 'Focus';
    }

    function tick() {
        if (!running) return;
        remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        render();
        if (remaining === 0) {
            running = false;
            clearInterval(interval);
            toggle.textContent = 'Start';
            api.ui.notify(api.locale?.startsWith('ru') ? 'Помодоро завершён' : 'Pomodoro finished');
        }
    }

    toggle.addEventListener('click', () => {
        running = !running;
        toggle.textContent = running ? 'Pause' : 'Start';
        if (running) {
            deadline = Date.now() + remaining * 1000;
            interval = setInterval(tick, 250);
        } else {
            clearInterval(interval);
        }
    });

    reset.addEventListener('click', () => {
        running = false;
        clearInterval(interval);
        remaining = FOCUS;
        toggle.textContent = 'Start';
        render();
    });

    render();
    api.ui.ready();
}
