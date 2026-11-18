function mount(api) {
    const compact = api.surface === 'strip';
    const ru = api.locale?.startsWith('ru');
    let place = { name: ru ? 'Москва' : 'Moscow', latitude: 55.7558, longitude: 37.6173 };

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

    const status = document.createElement('div');
    status.style.cssText = 'font-size:12px;color:var(--tabvale-muted);text-align:center;min-height:15px';

    let cityInput = null;

    wrap.append(value, description);
    if (!compact) {
        const cityRow = document.createElement('div');
        cityRow.style.cssText = 'display:flex;gap:6px;align-items:center;width:100%;max-width:260px';

        cityInput = document.createElement('input');
        cityInput.type = 'text';
        cityInput.placeholder = ru ? 'Город' : 'City';
        cityInput.style.cssText = 'flex:1;min-width:0;padding:7px 9px;border:1px solid var(--tabvale-border);' +
            'border-radius:8px;background:var(--tabvale-surface);color:var(--tabvale-text);font:inherit';

        const find = document.createElement('button');
        find.type = 'button';
        find.textContent = ru ? 'Найти' : 'Find';
        find.style.cssText = 'padding:7px 10px;border:1px solid var(--tabvale-border);border-radius:8px;' +
            'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer;font:inherit';

        cityRow.append(cityInput, find);
        wrap.append(cityRow, status);

        const search = async () => {
            const name = cityInput.value.trim();
            if (!name) return;
            status.textContent = ru ? 'Ищем…' : 'Searching…';
            const found = await findPlace(name);
            if (!found) {
                status.textContent = ru ? 'Город не найден' : 'City not found';
                return;
            }
            place = found;
            status.textContent = '';
            api.storage.set('place', place);
            load();
        };
        find.addEventListener('click', search);
        cityInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') search();
        });
    }
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

    async function findPlace(name) {
        try {
            const response = await api.fetch(
                'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(name) +
                '&count=1&language=' + (ru ? 'ru' : 'en') + '&format=json'
            );
            if (!response.ok) return null;
            const data = JSON.parse(response.text);
            const hit = Array.isArray(data.results) ? data.results[0] : null;
            if (!hit || !Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) return null;
            return { name: hit.name, latitude: hit.latitude, longitude: hit.longitude };
        } catch {
            return null;
        }
    }

    async function load() {
        try {
            const response = await api.fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
                '&current=temperature_2m,weather_code&timezone=auto'
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = JSON.parse(response.text);
            const temperature = Math.round(data.current.temperature_2m);
            value.textContent = `${temperature}°`;
            description.textContent = compact
                ? weatherText(data.current.weather_code)
                : `${weatherText(data.current.weather_code)} · ${place.name}`;
        } catch {
            value.textContent = '—';
            description.textContent = ru ? 'Нет связи с Open-Meteo' : 'Cannot reach Open-Meteo';
        }
    }

    api.storage.get('place').then((saved) => {
        if (saved && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude)) {
            place = { name: String(saved.name || ''), latitude: saved.latitude, longitude: saved.longitude };
        }
        if (cityInput) cityInput.value = place.name;
        load();
    }).catch(() => load());

    api.ui.ready();
}
