# Writing your first plugin

This walkthrough builds a small panel plugin, packs it into `.tvp` and
installs it into TabVale. Reference: [PLUGIN_SPEC.md](PLUGIN_SPEC.md) and
[PLUGIN_API.md](PLUGIN_API.md).

## 1. Create the folder

```
my-plugin/
├── manifest.json
├── plugin.js
└── icon.svg        (optional)
```

`manifest.json`:

```json
{
  "schema": 1,
  "id": "com.example.hello",
  "name": "Hello",
  "version": "1.0.0",
  "apiVersion": 1,
  "entry": "plugin.js",
  "icon": "icon.svg",
  "description": "A minimal example plugin.",
  "permissions": { "network": [], "capabilities": [], "storageKB": 16 },
  "surfaces": {
    "panel": { "sides": ["right"], "width": [280, 420], "height": [200, 400], "mode": ["overlay"] }
  },
  "locales": {
    "ru": { "name": "Пример" }
  }
}
```

- `id` is a reverse-domain identifier and must be unique.
- At least one surface is required; `panel` gives a dock button and a side
  panel, `tiles` adds a tile, `strip` adds a widget above or below bookmarks.

## 2. Write the code

`plugin.js` defines `mount(api)`; it runs inside the sandbox frame:

```js
function mount(api) {
    const ru = api.locale.startsWith('ru');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:14px';

    const input = document.createElement('input');
    input.placeholder = ru ? 'Ваше имя' : 'Your name';
    input.style.cssText = 'padding:8px;border:1px solid var(--tabvale-border);border-radius:8px;' +
        'background:var(--tabvale-surface);color:var(--tabvale-text);font:inherit';

    const output = document.createElement('div');
    output.style.cssText = 'font-size:15px;color:var(--tabvale-text)';

    const saved = document.createElement('button');
    saved.textContent = ru ? 'Запомнить' : 'Remember';
    saved.addEventListener('click', async () => {
        await api.storage.set('name', input.value);
        output.textContent = ru ? `Привет, ${input.value}!` : `Hello, ${input.value}!`;
    });

    wrap.append(input, saved, output);
    document.body.append(wrap);

    api.storage.get('name').then((name) => {
        if (name) input.value = name;
    });

    api.ui.ready();
}
```

Rules of thumb:

- Use the CSS variables (`--tabvale-surface`, `--tabvale-text`,
  `--tabvale-border`, `--tabvale-accent`) so the plugin follows the theme.
- Build DOM with `createElement`/`textContent`; avoid injecting HTML from
  data you did not create.
- The plugin frame has no `chrome.*`; use `api.storage`, `api.fetch`,
  `api.bookmarks` and `api.ui`.

## 3. Pack it

The repository ships a packer; Node.js 18+ is required:

```bash
node tools/pack-plugin.mjs my-plugin
# → com.example.hello.tvp
```

The tool checks that `manifest.json` parses, `entry` exists and the declared
icon is present, then writes a zip with the same structure. A second
argument sets the output path:

```bash
node tools/pack-plugin.mjs my-plugin build/hello.tvp
```

## 4. Install and try it

1. Open the new tab → Settings → Plugins.
2. *Install from file…* → choose `com.example.hello.tvp`.
3. Confirm the permission list (network rules, storage, capabilities).
4. The plugin appears in the manager; pick a placement (panel, strip, tile,
   off) or click *Open*.

Installation keeps the code in IndexedDB under the plugin id, so it survives
new-tab reloads until removed.

## 5. Debug

- Right-click the plugin surface → *Configure plugin* opens the manager row.
- Open DevTools (`Ctrl+Shift+I`), find the `sandbox/plugin-host.html` frame
  in the console context selector and read `console.log` from your code.
- Host-side warnings (rejected fetch, unknown method) appear in the main
  console as `[plugin <id>] …` or `console.warn`.
- `api.ui.notify(text)` writes to the host console; useful for quick probes.

## 6. Update

Bump `version` in the manifest, pack again and install the new file; the
manager replaces the copy. The version is also what the catalog uses, so
keep it in sync with the changes you publish.

## 7. Publish in the catalog (optional)

Bundled plugins live in `plugins/<id>/` and are listed in
`plugins/index.json`. The catalog for the site is generated:

```bash
node tools/build-plugins.mjs
# → docs/plugins/<id>.tvp, docs/plugins/catalog.json
```

The site's Plugins section reads `catalog.json` and shows a download button
for each package. Third-party plugins can be shared the same way: publish
the `.tvp` file and link to it.

## Where to look for examples

The ten bundled plugins under `plugins/` are complete, working examples:
clock (strip), weather (network + city setting), layout converter (two
fields), timer (storage + interval), app launcher (external links),
bookmark importer (capability + permission flow).
