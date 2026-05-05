// Фоновый скрипт для управления событиями расширения, включая создание контекстного меню и обработку действий пользователя.

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "changeBackground",
        title: "Изменить фон",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "addBookmark",
        title: "Добавить закладку",
        contexts: ["action"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "changeBackground") {
        // Логика для изменения фона
        chrome.storage.sync.get("backgroundImage", (data) => {
            // Здесь можно добавить логику для выбора нового изображения фона
        });
    } else if (info.menuItemId === "addBookmark") {
        // Логика для добавления новой закладки
        chrome.storage.sync.get("bookmarks", (data) => {
            // Здесь можно добавить логику для добавления новой закладки
        });
    }
});