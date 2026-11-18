# Plugin API

The host runs plugin code in an isolated frame and calls its `mount(api)`
function. There is no module system: the entry file defines `mount` at the
top level and may use any browser API available inside a sandboxed iframe.

```js
function mount(api) {
    const box = document.createElement('div');
    box.textContent = 'Hello';
    document.body.append(box);
    api.ui.ready();
}
```

`mount` is called once per instance. A plugin placed in the strip and in a
panel gets two frames and two `mount` calls; storage is shared between them.

## Context

| Property | Type | Meaning |
|---|---|---|
| `api.version` | number | API version, currently `1` |
| `api.surface` | string | `strip`, `panel` or `floating`; a tile opens the panel, so its frame reports `panel` |
| `api.locale` | string | Interface language, e.g. `ru`, `pt-BR` |
| `api.theme` | object | `{ mode, text, muted, accent, background, surface, border, radius }` with CSS values |

The host injects the theme as CSS variables on `document.documentElement`:
`--tabvale-bg`, `--tabvale-text`, `--tabvale-muted`, `--tabvale-accent`,
`--tabvale-surface`, `--tabvale-border`, `--tabvale-radius`. Use them instead
of hard-coded colours so light and dark themes work.

## Storage

```js
await api.storage.set('place', { name: 'Kazan', latitude: 55.79, longitude: 49.1 });
const place = await api.storage.get('place'); // null when missing
await api.storage.remove('place');
```

- Key: 1–64 characters, `A-Za-z0-9._-` only.
- Value: must be JSON-serializable; the serialized size is limited by
  `permissions.storageKB`.
- Data is stored in the extension's `chrome.storage.local` under
  `plugin:<id>:<key>` and survives new-tab reloads.

## Network

```js
const response = await api.fetch('https://api.open-meteo.com/v1/forecast?...');
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const data = JSON.parse(response.text);
```

- Only URLs matching `permissions.network` are allowed; everything else
  rejects.
- `GET` and `HEAD` only.
- Headers: `Accept`, `Accept-Language`, `Content-Type`; other headers are
  dropped.
- Requests carry no credentials (`credentials: 'omit'`), redirects are not
  followed.
- The response is `{ status, ok, text }`; the body is truncated to 256 KB.

There is no other network path: `fetch`, `XMLHttpRequest` and WebSocket are
blocked by the sandbox CSP (`connect-src 'none'`).

## Bookmarks

Requires `capabilities: ["bookmarks.read"]` and the user's browser
permission, granted in the manager (or by clicking the extension icon).

```js
const tree = await api.bookmarks.tree();       // chrome.bookmarks node array
const result = await api.bookmarks.import(screenId, items);
// result: { added, skipped }; screenId = null means the active screen
```

`import` accepts `[{ title, url }]`, keeps safe web URLs only, deduplicates
by URL and adds at most 300 bookmarks.

## UI

| Method | Effect |
|---|---|
| `api.ui.ready()` | Tells the host the plugin rendered |
| `api.ui.close()` | Hides the strip widget; closes the panel |
| `api.ui.resize({ width, height })` | Requests a size inside the manifest ranges (panel, strip height) |
| `api.ui.notify(text, level)` | Writes a message to the host console |
| `api.ui.openExternal(url)` | Opens `https`, `http`, `obsidian:` or `vscode:` links |
| `api.ui.openManager()` | Opens the plugin manager on this plugin's row |

Use `openExternal` for launchers: the sandbox cannot navigate the top page.

## Events

```js
api.on('theme', (theme) => { /* theme changed */ });
api.on('locale', (locale) => { /* interface language changed */ });
```

The host re-applies CSS variables before emitting `theme`, so an event
handler may re-render only what depends on the mode or palette. Keep the
current theme from `api.theme` if you need it at mount time.

## Lifecycle and limits

- Each surface instance is an iframe; closing a panel destroys it. Keep
  timers inside the frame and clear them when the element is removed.
- There is no background execution: when the new tab is closed, plugin code
  stops. Do not rely on long-running work.
- Frames are recreated on placement change, on reinstall, after granting
  bookmark access, and on language/theme changes that require a reload.
- `mount` must not assume a specific size; read `document.documentElement`
  dimensions instead.

## Errors

A thrown error in `mount` is reported to the host console and leaves the
surface empty. Prefer showing the error inside your own UI, as the weather
plugin does when the API is unreachable.
