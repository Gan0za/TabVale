# Chrome Web Store listing

## Basic information

| Field | Value |
|---|---|
| Name | TabVale |
| Version | 1.1.1 |
| Category | Productivity |
| Language | English |
| Homepage | `https://github.com/Gan0za/TabVale` |
| Support | `https://github.com/Gan0za/TabVale/issues` |
| Privacy policy | `https://gan0za.github.io/TabVale/privacy.html` (after enabling GitHub Pages) |

## Short description (max 132 characters)

```
A customizable new tab with search, multiple bookmark screens, and backgrounds. All data stays in your browser.
```

## Detailed description

```
TabVale replaces the browser's new tab page with a customizable dashboard.

Features:
- Search with a selectable search engine and an editable engine list.
- Multiple bookmark screens: switch with dots, horizontal swipe, or Alt+Left/Right.
- Bookmark tiles with drag-and-drop sorting, editing, deletion and automatic title suggestions.
- Backgrounds: image URL, local file, solid color or gradient, with placement options.
- Light, dark and automatic themes.
- English, Russian, German, French, Spanish, Portuguese (Brazil), Italian, Polish, Turkish, Ukrainian, Chinese, Japanese and Korean UI.
- Context menus for bookmarks, the page background, the search field and settings rows.
- JSON import and export.
- Responsive layout for narrow windows.

Privacy:
- Bookmarks, screens, backgrounds and settings stay in chrome.storage.
- No analytics, tracking, advertising or remote servers.
- Optional site access is requested only to read a page <title> when adding a bookmark.

Source code and documentation: https://github.com/Gan0za/TabVale
```

## Screenshots

CWS accepts up to 5 screenshots. Upload these files from
`docs/screenshots/cws/`:

1. `01-main-dark.png` — main page, dark theme.
2. `02-main-light.png` — main page, light theme.
3. `03-screens-dark.png` — screens settings.
4. `05-backgrounds-dark.png` — background settings.
5. `07-context-menu-dark.png` — bookmark context menu.

All screenshots are 1280×800 and use fictional demo data.

## Permission justifications

Copy the texts from [CWS_REVIEW_NOTES.md](../CWS_REVIEW_NOTES.md):

- `clipboardRead` — paste actions in the custom context menu.
- `unlimitedStorage` — local background image files.
- Optional host permissions — reading a page title when adding a bookmark.

## Data usage answers

| Question | Answer |
|---|---|
| Does the extension collect personally identifiable information? | No |
| Does it collect health, financial, authentication or personal communications data? | No |
| Does it collect location, web history or user activity? | No |
| Does it sell or transfer data to third parties? | No |
| Does it use data for advertising or creditworthiness? | No |
| Does it use analytics or telemetry? | No |
| Is data stored remotely? | No; only chrome.storage on the user's device |
| Is data transmitted off-device? | No |

## Single purpose

```
TabVale replaces the browser's new tab page with a user-customizable dashboard: web search, bookmark tiles on multiple screens, and background images.
```

## Remote code

Answer: **No**. All executable code is packaged in `background.js`,
`newtab/app.js`, `newtab/core/*.js` and `newtab/features/*.js`.

## Release checklist

- [x] Version 1.1.1 in `manifest.json`
- [x] `bash package.sh` / `.\package.ps1` builds `dist/tabvale_v1.1.1.zip`
- [x] 12 source screenshots, 5 selected for CWS
- [x] Permission justifications and single purpose text
- [x] Privacy policy text
- [ ] Public privacy policy URL (GitHub Pages)
- [ ] GitHub repository and homepage URL
- [ ] Upload the zip to CWS
- [ ] Publish and add the store link to README
