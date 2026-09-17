# Заметки для ревью Chrome Web Store

Готовые тексты для полей анкеты при публикации расширения.
Заполнять по одному разу при каждой отправке на ревью.

---

## Permission justification: `clipboardRead`

> Форма CWS → Permissions → clipboardRead → "Permission justification"
> (лимит 1000 символов, писать по-английски)

**Короткая версия (если просят кратко):**

```
This extension provides a new tab page with user-managed bookmarks and
backgrounds. The clipboardRead permission is used exclusively for the
"Paste" buttons inside the settings forms: when the user clicks "Paste",
the clipboard text (a URL) is inserted into the form field to create a
bookmark or background entry. Reading happens only in direct response to
a user click on the Paste button, on the extension's own page. There is
no background or automatic clipboard access of any kind.
```

**Полная версия (если ревью вернёт с запросом деталей):**

```
Purpose: Custom New Tab is a new tab page where users organize their own
bookmarks and background images.

Usage of clipboardRead: The settings modal contains forms for adding a
bookmark (title + URL) and a background (title + image URL). Next to the
URL fields there is a "Paste" button. When the user clicks this button,
the extension reads the current clipboard text once and inserts it into
the URL field. This saves the user from manually copying and typing URLs.

Trigger: clipboard access happens only inside the click handler of the
Paste button, only on the extension's own new tab page, and only after
an explicit user action. The extension never reads the clipboard in the
background, on page load, or without a preceding click.

Data handling: the clipboard content is placed into the form field and
stored (if the user confirms) in chrome.storage.sync. It is not sent to
any server — the extension has no network transmission of user data at all.
```

---

## Single purpose description

> Форма CWS → "Describe the single purpose of your extension"

```
Custom New Tab replaces the browser's new tab page with a
user-customizable dashboard: web search, bookmark tiles, and background
images. All user data (bookmarks, backgrounds, search engines, theme)
is stored locally via chrome.storage.sync and is never transmitted
anywhere.
```

---

## Remote code declaration

> Форма CWS → "Does your extension contain remote code?" — **No**

Обоснование на случай вопросов: расширение загружает только изображения
(иконки сайтов, фоны) через `<img src>` — это не удалённый код в
терминологии политики CWS. Весь исполняемый код (app.js, background.js)
входит в пакет.
