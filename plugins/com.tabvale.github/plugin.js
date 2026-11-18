function mount(api) {
    const compact = api.surface === 'strip';
    const ru = api.locale?.startsWith('ru');
    const DEFAULT_REPOS = ['Gan0za/TabVale'];
    let repos = [...DEFAULT_REPOS];

    const wrap = document.createElement('div');
    wrap.style.cssText = compact
        ? 'display:flex;align-items:center;justify-content:center;gap:8px;height:100%;padding:8px 12px'
        : 'display:flex;flex-direction:column;height:100%;padding:12px;gap:8px';

    const summary = document.createElement('div');
    summary.style.cssText = compact
        ? 'font-size:24px;font-weight:600;color:var(--tabvale-accent)'
        : 'font-size:13px;color:var(--tabvale-muted)';

    const list = document.createElement('div');
    list.style.cssText = 'flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:6px';

    const addRow = document.createElement('div');
    addRow.style.cssText = 'display:flex;gap:6px;flex:0 0 auto';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = ru ? 'owner/repo или ссылка' : 'owner/repo or URL';
    input.style.cssText = 'flex:1;min-width:0;padding:7px 9px;border:1px solid var(--tabvale-border);' +
        'border-radius:8px;background:var(--tabvale-surface);color:var(--tabvale-text);font:inherit';

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.textContent = ru ? 'Добавить' : 'Add';
    addButton.style.cssText = 'padding:7px 10px;border:1px solid var(--tabvale-border);border-radius:8px;' +
        'background:var(--tabvale-surface);color:var(--tabvale-text);cursor:pointer;font:inherit';

    const status = document.createElement('div');
    status.style.cssText = 'font-size:12px;color:var(--tabvale-muted);min-height:15px';

    if (compact) {
        wrap.append(summary);
    } else {
        addRow.append(input, addButton);
        wrap.append(summary, list, addRow, status);
    }
    document.body.append(wrap);

    function normalizeRepo(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
            const url = new URL(raw);
            if (!/(^|\.)github\.com$/i.test(url.hostname)) return '';
            const parts = url.pathname.split('/').filter(Boolean);
            return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : '';
        } catch {
            return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(raw) ? raw : '';
        }
    }

    async function loadRepo(slug) {
        const response = await api.fetch(`https://api.github.com/repos/${slug}`, {
            headers: { Accept: 'application/vnd.github+json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return JSON.parse(response.text);
    }

    function statLine(repo) {
        const stars = repo.stargazers_count ?? 0;
        const forks = repo.forks_count ?? 0;
        const issues = repo.open_issues_count ?? 0;
        return `★ ${stars} · ${ru ? 'форки' : 'forks'} ${forks} · ${ru ? 'issues' : 'issues'} ${issues}`;
    }

    function buildRow(slug) {
        const item = document.createElement('div');
        item.style.cssText = 'border:1px solid var(--tabvale-border);border-radius:10px;padding:8px 10px;' +
            'display:flex;flex-direction:column;gap:4px';

        const head = document.createElement('div');
        head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px';

        const name = document.createElement('span');
        name.textContent = slug;
        name.style.cssText = 'font-weight:600;font-size:14px;color:var(--tabvale-text);' +
            'overflow:hidden;text-overflow:ellipsis';

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.title = ru ? 'Убрать' : 'Remove';
        remove.style.cssText = 'border:0;background:transparent;color:var(--tabvale-muted);font-size:16px;cursor:pointer';
        remove.addEventListener('click', async () => {
            repos = repos.filter((repo) => repo !== slug);
            await api.storage.set('repos', repos);
            render();
        });

        const stats = document.createElement('div');
        stats.style.cssText = 'font-size:13px;color:var(--tabvale-muted)';
        stats.textContent = '…';

        head.append(name, remove);
        item.append(head, stats);

        loadRepo(slug).then((repo) => {
            stats.textContent = statLine(repo);
        }).catch((error) => {
            stats.textContent = /HTTP 403/.test(error.message)
                ? (ru ? 'Лимит запросов GitHub, попробуйте позже' : 'GitHub rate limit, try later')
                : (ru ? 'Не удалось получить статистику' : 'Could not load stats');
        });

        return item;
    }

    function render() {
        if (compact) {
            if (!repos.length) {
                summary.textContent = '—';
                return;
            }
            loadRepo(repos[0]).then((repo) => {
                summary.textContent = `★ ${repo.stargazers_count ?? 0}`;
            }).catch(() => {
                summary.textContent = '—';
            });
            return;
        }

        list.textContent = '';
        for (const slug of repos) list.append(buildRow(slug));
        summary.textContent = repos.length
            ? (ru ? `Репозитории: ${repos.length}` : `Repositories: ${repos.length}`)
            : (ru ? 'Список пуст' : 'The list is empty');
    }

    async function addRepo() {
        const slug = normalizeRepo(input.value);
        if (!slug) {
            status.textContent = ru ? 'Нужен owner/repo или ссылка на GitHub' : 'Enter owner/repo or a GitHub URL';
            return;
        }
        if (repos.includes(slug)) {
            status.textContent = ru ? 'Такой репозиторий уже есть' : 'This repository is already in the list';
            return;
        }
        repos = [...repos, slug];
        input.value = '';
        status.textContent = '';
        await api.storage.set('repos', repos);
        render();
    }

    addButton.addEventListener('click', addRepo);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') addRepo();
    });

    api.storage.get('repos').then((saved) => {
        if (Array.isArray(saved)) repos = saved.filter((item) => typeof item === 'string' && item.includes('/'));
        render();
    }).catch(() => render());

    render();
    api.ui.ready();
}
