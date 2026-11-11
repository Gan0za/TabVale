function mount(api) {
    const compact = api.surface === 'strip';
    const ru = api.locale?.startsWith('ru');

    const wrap = document.createElement('div');
    wrap.style.cssText = compact
        ? 'display:flex;align-items:center;justify-content:center;gap:8px;height:100%;padding:8px 12px'
        : 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;padding:16px';

    const value = document.createElement('div');
    value.style.cssText = compact
        ? 'font-size:26px;font-weight:600;color:var(--tabvale-accent)'
        : 'font-size:52px;font-weight:600;color:var(--tabvale-accent)';
    value.textContent = '…';

    const description = document.createElement('div');
    description.style.cssText = 'font-size:13px;color:var(--tabvale-muted);text-align:center';
    description.textContent = ru ? 'Москва' : 'Moscow';

    wrap.append(value, description);
    document.body.append(wrap);

    function weatherText(code) {
        if (code === 0) return ru ? 'Ясно' : 'Clear';
        if (code <= 3) return ru ? 'Переменная облачность' : 'Partly cloudy';
        if (code <= 48) return ru ? 'Туман' : 'Fog';
        if (code <= 67) return ru ? 'Дождь' : 'Rain';
        if (code <= 77) return ru ? 'Снег' : 'Snow';
        if (code <= 82) return ru ? 'Ливень' : 'Showers';
        if (code <= 86) return ru ? 'Снегопад' : 'Snow showers';
        return ru ? 'Гроза' : 'Thunderstorm';
    }

    async function load() {
        try {
            const response = await api.fetch('https://api.open-meteo.com/v1/forecast?latitude=55.7558&longitude=37.6173&current=temperature_2m,weather_code&timezone=auto');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = JSON.parse(response.text);
            const temperature = Math.round(data.current.temperature_2m);
            value.textContent = `${temperature}°`;
            description.textContent = compact ? weatherText(data.current.weather_code) : `${weatherText(data.current.weather_code)} · ${ru ? 'Москва' : 'Moscow'}`;
        } catch {
            value.textContent = '—';
            description.textContent = ru ? 'Нет данных' : 'No data';
        }
    }

    load();
    api.ui.ready();
}
