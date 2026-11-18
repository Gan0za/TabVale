# Plugin package and manifest

A TabVale plugin is a `.tvp` file: a zip archive with `manifest.json`, the
entry file and an optional icon. The extension installs it only from the
user's file dialog and never loads plugin code from the network.

## Package contents

| File | Required | Notes |
|---|---|---|
| `manifest.json` | yes | At the archive root, or inside one top-level folder |
| entry file (`manifest.entry`) | yes | Safe relative path; `.js` in practice, `.html` is accepted but the content must still be JavaScript |
| icon (`manifest.icon`) | no | `.svg` or `.png`, shown in the dock, tiles and manager |

The JSON form `{ "manifest": {…}, "code": "…", "icon": "data:image/svg+xml;base64,…" }`
is accepted too; it is convenient for small tests.

Installation: Settings → Plugins → *Install from file…*, then confirm the
permission list. The same dialog accepts `.json` and `.tvp`.

## Limits

| Limit | Value |
|---|---|
| Archive | 1 MB |
| `manifest.json` | 64 KB |
| Entry code | 512 KB |
| Icon | 64 KB |
| Network rules | 10 |
| Plugin storage | 1–1024 KB |

Oversized or unsupported archives are rejected with a readable error; an
oversized icon is dropped without failing the install.

## Manifest fields

| Field | Type | Required | Rules |
|---|---|---|---|
| `schema` | number | yes | `1` |
| `id` | string | yes | Reverse domain: `com.example.clock`; lowercase letters, digits, `.`, `-`, `_`; at least one dot; 3–80 chars |
| `name` | string | yes | Up to 60 characters |
| `version` | string | yes | `x.y.z`, semver |
| `apiVersion` | number | yes | `1` |
| `minAppVersion` | string | no | Semver; defaults to `1.2.0` |
| `entry` | string | yes | Safe relative path to `.js`/`.html` |
| `icon` | string | no | Safe relative path to `.svg`/`.png` |
| `description` | string | no | Up to 400 characters |
| `author` | string | no | Up to 80 characters |
| `permissions` | object | no | See below |
| `surfaces` | object | yes | At least one surface |
| `locales` | object | no | `{ "ru": { "name": "…", "description": "…" } }` |

Paths are relative, without `..`, a leading slash or a drive letter.

## Permissions

```json
"permissions": {
  "network": ["https://api.open-meteo.com/*"],
  "capabilities": ["bookmarks.read"],
  "storageKB": 64
}
```

- `network` — `https` only, exact host or `*.` subdomains, optional port and
  path. Plain `http` is not allowed for plugin requests.
- `capabilities` — `bookmarks.read` (read and import browser bookmarks) and
  `clipboard.read` (reserved). Bookmarks also need the user's permission for
  the `bookmarks` API, asked separately in the manager.
- `storageKB` — quota for `api.storage`, default 64.

## Surfaces

The manifest lists where the plugin **may** live; the user picks the actual
placement in the manager. Ranges are clamped to the manifest.

```json
"surfaces": {
  "tiles":    { "span": [1, 2] },
  "strip":    { "positions": ["top", "bottom"], "height": [64, 120], "default": true },
  "panel":    { "sides": ["left", "right"], "width": [320, 560], "height": [240, 900], "mode": ["overlay"] },
  "floating": { "sides": ["left", "right"], "width": [240, 480], "height": [200, 600] },
  "rail":     { "positions": ["top", "bottom"] }
}
```

| Surface | Meaning |
|---|---|
| `tiles` | Icon tile in the bookmark grid; a click opens the panel |
| `strip` | Widget in the strip above or below bookmarks |
| `panel` | Dock button that opens a side panel |
| `floating` | Draggable window; derived from `panel` when not declared |
| `rail` | Reserved for a side rail |

`strip.default: true` asks for the strip on first install. A panel may also
list `top` and `bottom` among its sides. Placing a plugin in `floating` keeps
its position and size between sessions.

## Localization

`locales` supplies the name and description per language; languages without
an entry fall back to the base `name`/`description`:

```json
"locales": {
  "ru": { "name": "Часы", "description": "Виджет часов" },
  "de": { "name": "Uhr" }
}
```

The host passes the current interface language to the plugin as
`api.locale`; plugin-internal strings are the plugin's own concern.

## Versioning

The manager keeps the installed copy until the user installs a package with
a different `version`. Bump the version whenever you want an update to be
accepted.

## Security model

- Code runs only inside `sandbox/plugin-host.html`: no `chrome.*`, no host
  DOM, no direct network, no external scripts.
- Network requests go through the host broker and are limited to the
  manifest allowlist (`GET`/`HEAD` only, safe headers, no credentials).
- Storage keys are namespaced per plugin and capped by `storageKB`.
- Bookmarks are available only with the `bookmarks.read` capability and the
  user's separate permission.
- Anything the plugin renders lives inside its own frame; the host shows it
  in a fixed-size surface.
