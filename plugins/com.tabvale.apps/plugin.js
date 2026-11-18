function mount(api) {
    const ru = api.locale?.startsWith('ru');
    const compact = api.surface === 'strip';

    const wrap = document.createElement('div');
    wrap.style.cssText = compact
        ? 'display:flex;align-items:stretch;gap:8px;height:100%;padding:8px'
        : 'display:flex;flex-direction:column;justify-content:center;height:100%;gap:10px;padding:16px';

    function button(label, hint, url) {
        const element = document.createElement('button');
        element.style.cssText = compact
            ? 'flex:1;display:flex;align-items:center;justify-content:center;padding:6px;' +
              'border:1px solid var(--tabvale-border);border-radius:8px;background:var(--tabvale-surface);' +
              'color:var(--tabvale-text);cursor:pointer;font:600 13px system-ui,sans-serif'
            : 'display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:12px 14px;' +
              'border:1px solid var(--tabvale-border);border-radius:10px;background:var(--tabvale-surface);' +
              'color:var(--tabvale-text);cursor:pointer;font:inherit;text-align:left';

        const name = document.createElement('span');
        name.textContent = label;
        if (!compact) name.style.fontWeight = '600';
        element.append(name);

        if (!compact) {
            const sub = document.createElement('span');
            sub.textContent = hint;
            sub.style.cssText = 'font-size:12px;color:var(--tabvale-muted)';
            element.append(sub);
        }

        element.addEventListener('click', () => api.ui.openExternal(url));
        return element;
    }

    wrap.append(
        button('Obsidian', ru ? 'Открыть хранилище' : 'Open vault', 'obsidian://open'),
        button('VS Code', ru ? 'Открыть редактор' : 'Open editor', 'vscode://'),
    );
    document.body.append(wrap);
    api.ui.ready();
}
