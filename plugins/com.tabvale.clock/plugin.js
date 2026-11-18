// Часы: встроенный плагин-пример. Исполняется в sandbox-странице,
// поэтому document — это DOM панели, а не страницы новой вкладки.
function mount(api) {
    const root = document.createElement('div');
    root.style.cssText = 'display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;gap:6px;padding:6px;text-align:center';

    const time = document.createElement('div');
    time.style.cssText = 'font-size:40px;font-weight:600;letter-spacing:-1px;font-variant-numeric:tabular-nums';

    const date = document.createElement('div');
    date.style.cssText = 'font-size:14px;color:var(--tabvale-muted)';

    root.append(time, date);
    document.body.append(root);

    const locale = api.locale || navigator.language;
    const timeFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
    let dayFormat = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });

    function render() {
        const now = new Date();
        time.textContent = timeFormat.format(now);
        date.textContent = dayFormat.format(now);
    }

    render();
    const timer = setInterval(render, 1000);

    api.on('theme', (theme) => {
        // Цвета приходят CSS-переменными, но тема может смениться на лету
        document.documentElement.dataset.theme = theme?.mode === 'light' ? 'light' : 'dark';
    });
    api.on('locale', (localeCode) => {
        dayFormat = new Intl.DateTimeFormat(localeCode || locale, { weekday: 'long', day: 'numeric', month: 'long' });
        render();
    });

    api.ui.ready();

    return () => clearInterval(timer);
}
