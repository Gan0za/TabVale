function mount(api) {
    const compact = api.surface === 'strip';
    const wrap = document.createElement('div');
    wrap.style.cssText = compact
        ? 'display:flex;align-items:center;justify-content:center;height:100%;padding:8px;font-size:24px;color:var(--tabvale-accent)'
        : 'display:flex;flex-direction:column;justify-content:center;height:100%;gap:10px;padding:16px';

    wrap.textContent = '…';
    document.body.append(wrap);

    async function load() {
        try {
            const response = await api.fetch('https://api.github.com/repos/Gan0za/TabVale', {
                headers: { Accept: 'application/vnd.github+json' },
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const repo = JSON.parse(response.text);
            if (compact) {
                wrap.textContent = `★ ${repo.stargazers_count}`;
                return;
            }
            wrap.textContent = '';
            const rows = [
                ['★ ' + (api.locale?.startsWith('ru') ? 'Звёзды' : 'Stars'), repo.stargazers_count],
                [api.locale?.startsWith('ru') ? 'Форки' : 'Forks', repo.forks_count],
                [api.locale?.startsWith('ru') ? 'Открытые issues' : 'Open issues', repo.open_issues_count],
            ];
            for (const [label, count] of rows) {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;justify-content:space-between;font-size:15px;border-bottom:1px solid var(--tabvale-border);padding:6px 0';
                row.innerHTML = '';
                const left = document.createElement('span');
                left.textContent = label;
                left.style.color = 'var(--tabvale-muted)';
                const right = document.createElement('span');
                right.textContent = String(count);
                right.style.fontWeight = '600';
                row.append(left, right);
                wrap.append(row);
            }
        } catch {
            wrap.textContent = '—';
        }
    }

    load();
    api.ui.ready();
}
