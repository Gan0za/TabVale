# TabVale

[![Build](https://github.com/Gan0za/TabVale/actions/workflows/build.yml/badge.svg)](https://github.com/Gan0za/TabVale/actions/workflows/build.yml)

A Chrome and Microsoft Edge extension that replaces the browser's new tab page
with a customizable dashboard: search, multiple bookmark screens, and
backgrounds.

**Website:** [gan0za.github.io/TabVale](https://gan0za.github.io/TabVale/)

**Read in:** [English](README.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [Polski](README.pl.md) · [Türkçe](README.tr.md) · [Українська](README.uk.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

> English is the source of truth. Short translations are provided for
> convenience; corrections are welcome via GitHub issues.

## Features

- **Search** with a selectable search engine. The engine list is editable and
  each engine can have its own icon.
- **Screens** — several independent bookmark sets. Switch with dots,
  horizontal swipe on empty space, or `Alt+←/→`; manage screens in settings
  and move bookmarks between them from the context menu.
- **Bookmarks** with site icons, drag-and-drop sorting, editing, deletion and
  an automatic page-title suggestion.
- **Backgrounds**: image URL, local file, solid color or gradient; image
  placement (cover, contain, tile, center).
- **Themes**: auto, light, dark.
- **Languages**: English, Russian, German, French, Spanish, Portuguese (Brazil), Italian, Polish, Turkish, Ukrainian, Chinese, Japanese and Korean; the auto mode follows the browser.
- **Context menus** for bookmark tiles, the page background, the search field,
  the empty bookmarks area and settings rows.
- **JSON import and export** of settings.
- **Plugins** — clock, notes, layout converter, timer, password generator,
  weather, GitHub stats, app launcher, RSS and bookmark importer. Nothing is
  installed by default: download a `.tvp` package from the site's Plugins
  section and install it in Settings → Plugins. Each plugin can live in the
  dock panel, as a bookmark tile, in the strip above or below bookmarks, or in
  a floating window; its context menu opens the settings row, or disables and
  removes it.
- **Responsive layout** for narrow windows and mobile orientation.

## Screenshots

All screenshots are 1280×800 and use fictional demo data.

| Main, dark | Main, light |
|---|---|
| ![](docs/screenshots/01-main-dark.png) | ![](docs/screenshots/02-main-light.png) |

| Screens, dark | Screens, light |
|---|---|
| ![](docs/screenshots/03-screens-dark.png) | ![](docs/screenshots/04-screens-light.png) |

| Backgrounds, dark | Backgrounds, light |
|---|---|
| ![](docs/screenshots/05-backgrounds-dark.png) | ![](docs/screenshots/09-backgrounds-light.png) |

| Search engines, dark | Search engines, light |
|---|---|
| ![](docs/screenshots/06-search-engines-dark.png) | ![](docs/screenshots/10-search-engines-light.png) |

| Context menu, dark | Context menu, light |
|---|---|
| ![](docs/screenshots/07-context-menu-dark.png) | ![](docs/screenshots/11-context-menu-light.png) |

| Delete screen, dark | Delete screen, light |
|---|---|
| ![](docs/screenshots/08-delete-screen-dark.png) | ![](docs/screenshots/12-delete-screen-light.png) |

## Project structure

```
tabvale/
├── manifest.json              # Extension manifest (Manifest V3)
├── background.js              # Service worker: icon menu and bookmark permission
├── newtab/
│   ├── index.html             # New tab page
│   ├── styles.css             # Styles
│   ├── app.js                 # Bootstrap: wires feature init functions
│   ├── core/                  # Core
│   │   ├── config.js          # Defaults
│   │   ├── storage.js         # chrome.storage, migrations, screens/backgrounds
│   │   ├── icon-store.js      # Site icon cache in IndexedDB
│   │   ├── i18n.js            # t()/applyLocale localization
│   │   ├── render.js          # Rendering and context menu definitions
│   │   ├── state.js           # DOM references and current state
│   │   ├── plugins.js         # Manifest validation and placement clamping
│   │   ├── plugin-broker.js   # RPC allowlist, storage and fetch rules
│   │   ├── plugin-registry.js # Built-in catalog index
│   │   ├── plugin-placements.js # Surfaces and stored placement
│   │   └── plugin-db.js       # Installed packages in IndexedDB
│   └── features/              # Feature modules
│       ├── screens.js         # Screens, dots, swipe, moving bookmarks
│       ├── bookmarks.js       # Bookmark form and actions
│       ├── drag.js            # Tile drag-and-drop
│       ├── context-menu.js    # Context menus and actions
│       ├── search.js          # Search
│       ├── settings.js        # Settings modal, import/export
│       ├── backgrounds.js     # Background forms and list
│       ├── search-engines.js  # Search engine forms and list
│       ├── theme.js           # Theme
│       ├── language.js        # Language switching
│       ├── popovers.js        # Popover closing
│       ├── plugins.js         # Plugin host: dock, panel, strip, tiles, manager
│       └── ui-actions.js      # Shared actions and refreshUI
├── sandbox/                   # Isolated plugin runtime (no chrome.*)
├── plugins/                   # Plugin sources: manifest.json, plugin.js, icon.svg
├── _locales/                  # 13 languages
├── assets/icons/              # Extension icons 16/48/128
├── docs/                      # GitHub Pages site and store materials
│   ├── index.html             # Landing page, plugin catalog
│   ├── privacy.html
│   ├── PLUGIN_SPEC.md         # Package and manifest reference
│   ├── PLUGIN_API.md          # Sandbox API reference
│   ├── PLUGIN_GUIDE.md        # Authoring walkthrough
│   ├── plugins/               # Built .tvp packages and catalog.json
│   ├── screenshots/
│   └── CWS_LISTING.md
├── tests/                     # Node tests (vm sandbox)
├── tools/
│   ├── build-plugins.mjs      # Builds docs/plugins from plugins/index.json
│   ├── pack-plugin.mjs        # Packs any plugin folder into a .tvp
│   ├── zip.mjs                # Minimal zip writer for packages
│   └── screenshot-sandbox/    # Screenshot generator
├── package.sh                 # Builds dist/tabvale_v{version}.zip (bash)
├── package.ps1                # Windows build (PowerShell)
├── PRIVACY.md                 # Privacy policy
├── CWS_REVIEW_NOTES.md        # Chrome Web Store review texts
├── LICENSE                    # MIT
├── README.*.md                # Short translations with a plugin overview
└── README.md
```

## Installation

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked" and select the project root.
4. Open a new tab.

## Build

```bash
bash package.sh
```

The script creates `dist/tabvale_v{version}.zip` with the runtime files:
`manifest.json`, `background.js`, `newtab/`, `_locales/` and the PNG icons.
The version is read from `manifest.json`.

Plugin packages for the site are built separately:

```bash
node tools/build-plugins.mjs
```

It writes `docs/plugins/<id>.tvp` and `catalog.json` from `plugins/index.json`.

### Windows

PowerShell 5.1 or newer:

```powershell
powershell -ExecutionPolicy Bypass -File .\package.ps1
```

The script uses Windows `tar.exe` when available and falls back to
`Compress-Archive`. It creates the same `dist/tabvale_v{version}.zip` and
checks that development files are not included.

If you use Git Bash, the Unix script works too (it uses Windows
`tar.exe`/bsdtar; GNU tar is rejected):

```bash
bash package.sh
```

## Tests

Node.js 18+ is required.

```bash
for f in tests/*.test.mjs; do node "$f" || exit 1; done
```

A single test:

```bash
node tests/screens.test.mjs
```

## Plugin development

Plugins are `.tvp` packages: a zip with `manifest.json`, the entry file and
an optional icon. They run in a sandbox and reach the browser only through
the host API.

- [Package format and manifest](docs/PLUGIN_SPEC.md)
- [Plugin API](docs/PLUGIN_API.md)
- [Writing your first plugin](docs/PLUGIN_GUIDE.md)

Pack a plugin folder into an installable file:

```bash
node tools/pack-plugin.mjs path/to/plugin
```

Then install it in Settings → Plugins → *Install from file…*.

## Permissions

- `storage` — bookmarks, screens, backgrounds, search engines, theme.
- `unlimitedStorage` — background files in `chrome.storage.local`.
- `contextMenus` — the extension icon menu.
- `clipboardRead` — paste actions in the custom context menu.
- `favicon` — site icons from the browser's local favicon cache; they stay
  visible offline and no network requests are made for this.
- `optional_host_permissions` — requested per site, only to read a page
  `<title>` when adding a bookmark.

See [PRIVACY.md](PRIVACY.md) for details.

## Translations

Short localized versions are provided for convenience. English is the
authoritative version; translations may lag behind. The translations were
made by a non-native speaker and can be corrected via GitHub issues.

- [Русский](README.ru.md)
- [Deutsch](README.de.md)
- [Français](README.fr.md)
- [Español](README.es.md)
- [Português (Brasil)](README.pt-BR.md)
- [Italiano](README.it.md)
- [Polski](README.pl.md)
- [Türkçe](README.tr.md)
- [Українська](README.uk.md)
- [中文](README.zh.md)
- [日本語](README.ja.md)
- [한국어](README.ko.md)

## License

MIT. See [LICENSE](LICENSE).
