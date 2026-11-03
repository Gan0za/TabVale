# Заметки для ревью Chrome Web Store

Готовые тексты для полей анкеты при публикации расширения.
Заполнять по одному разу при каждой отправке на ревью.

---

## Permission justification: `clipboardRead`

> Форма CWS → Permissions → clipboardRead → "Permission justification"
> (лимит 1000 символов, писать по-английски)

**Короткая версия (если просят кратко):**

```
This extension provides a new tab page with user-managed bookmarks, screens
and backgrounds. clipboardRead is used only by the custom context menu on the
search field and the empty bookmarks area. When the user opens that menu, the
extension reads the clipboard once to decide which paste actions to show;
choosing one inserts the text into the search field or creates a bookmark.
Reading happens only in direct response to the user opening the menu on the
extension's own page. There is no background or automatic clipboard access.
```

**Полная версия (если ревью вернёт с запросом деталей):**

```
Purpose: Custom New Tab is a new tab page where users organize their own
bookmarks across several screens, choose search engines and set backgrounds.

Usage of clipboardRead: The extension has a custom context menu on the search
field and on the empty bookmarks area. When the menu is opened, the extension
reads the clipboard once to decide which paste actions to show: "Paste and
search", "Paste" (into the search field) and "Paste and create" (create a
bookmark from a web address). The clipboard text is used only for that
insertion.

Trigger: clipboard access happens only while opening the custom context menu
on the extension's own new tab page, after an explicit right-click or
long-press by the user. The extension never reads the clipboard in the
background, on page load, or without a preceding user action.

Data handling: the clipboard text is inserted into the search field or used
to create a bookmark, and stored only if the user confirms. It is not sent to
any server — the extension has no network transmission of user data.
```

---

## Permission justification: `unlimitedStorage`

> Форма CWS → Permissions → unlimitedStorage

```
The extension lets users choose a background image from their device. Image
data is stored locally in chrome.storage.local. Without unlimitedStorage a
large image could exceed the default local quota, and the user's chosen
background would not be saved. The data never leaves the device.
```

---

## Permission justification: optional host permissions

> Форма CWS → Permissions → optional host permissions

```
Host permissions are optional and requested at runtime only when the user
adds a bookmark: the extension tries to read the page <title> to suggest a
bookmark name. The browser shows a permission prompt for that site; the user
can deny it. If denied, the extension falls back to the hostname and does not
access the site. No host access is requested at install time.
```

---

## Single purpose description

> Форма CWS → "Describe the single purpose of your extension"

```
Custom New Tab replaces the browser's new tab page with a user-customizable
dashboard: web search, bookmark tiles on multiple screens, and background
images. All user data (bookmarks, screens, backgrounds, search engines,
theme) is stored locally via chrome.storage and is never transmitted
anywhere.
```

---

## Remote code declaration

> Форма CWS → "Does your extension contain remote code?" — **No**

Обоснование на случай вопросов: расширение загружает только изображения
(иконки сайтов, фоны) через `<img src>` — это не удалённый код в
терминологии политики CWS. Весь исполняемый код входит в пакет:
`background.js`, `newtab/app.js`, `newtab/core/*.js`, `newtab/features/*.js`.
