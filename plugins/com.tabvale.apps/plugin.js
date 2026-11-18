function mount(api) {
    const ru = api.locale?.startsWith('ru');
    const compact = api.surface === 'strip';
    const NS = 'http://www.w3.org/2000/svg';

    const wrap = document.createElement('div');
    wrap.style.cssText = compact
        ? 'display:flex;align-items:stretch;gap:8px;height:100%;padding:8px'
        : 'display:flex;flex-direction:column;justify-content:center;height:100%;gap:10px;padding:16px';

    // Значок приложения справа: узнаваемый контур, без чужих логотипов.
    function appIcon(paths, size) {
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.8');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.style.cssText = `width:${size}px;height:${size}px;flex:0 0 auto;color:var(--tabvale-muted)`;
        for (const d of paths) {
            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', d);
            svg.append(path);
        }
        return svg;
    }

    function button(label, hint, url, paths) {
        const element = document.createElement('button');
        element.type = 'button';
        element.style.cssText = compact
            ? 'flex:1;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;' +
              'border:1px solid var(--tabvale-border);border-radius:8px;background:var(--tabvale-surface);' +
              'color:var(--tabvale-text);cursor:pointer;font:600 13px system-ui,sans-serif'
            : 'display:flex;align-items:center;gap:12px;padding:12px 14px;' +
              'border:1px solid var(--tabvale-border);border-radius:10px;background:var(--tabvale-surface);' +
              'color:var(--tabvale-text);cursor:pointer;font:inherit;text-align:left';

        const text = document.createElement('span');
        text.style.cssText = compact ? 'display:flex;align-items:center' : 'display:flex;flex-direction:column;gap:2px;flex:1;min-width:0';

        const name = document.createElement('span');
        name.textContent = label;
        if (!compact) name.style.fontWeight = '600';
        text.append(name);

        if (!compact) {
            const sub = document.createElement('span');
            sub.textContent = hint;
            sub.style.cssText = 'font-size:12px;color:var(--tabvale-muted)';
            text.append(sub);
        }

        element.append(text, appIcon(paths, compact ? 16 : 20));
        element.addEventListener('click', () => api.ui.openExternal(url));
        return element;
    }

    wrap.append(
        button(
            'Obsidian',
            ru ? 'Открыть хранилище' : 'Open vault',
            'obsidian://open',
            ['M12 3l6 5-2.5 13h-7L6 8l6-5Z', 'M6 8h12']
        ),
        button(
            'VS Code',
            ru ? 'Открыть редактор' : 'Open editor',
            'vscode://',
            ['M9 8l-4 4 4 4', 'M15 8l4 4-4 4']
        ),
    );
    document.body.append(wrap);
    api.ui.ready();
}
