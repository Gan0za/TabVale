// =============================================================================
// Фича: экраны — несколько независимых наборов закладок.
//
// currentState.bookmarks — ссылка на массив активного экрана. Переключение
// меняет ссылку, поэтому плитки, drag и контекстное меню продолжают работать
// с локальными индексами. Активный экран хранится в storage.local.
// =============================================================================

function screenById(id) {
    return (currentState.screens || []).find((s) => s.id === id) || null;
}

function activeScreen() {
    return screenById(currentState.currentScreenId) || currentState.screens[0] || null;
}

/**
 * Делает экран активным. persist=false — при загрузке, когда значение только
 * что прочитано из storage.local.
 */
function setActiveScreen(id, { persist = true } = {}) {
    const screen = screenById(id);
    if (!screen) return false;
    currentState.currentScreenId = screen.id;
    currentState.bookmarks = screen.bookmarks;
    if (persist) storageLocalSet({ currentScreenId: screen.id });
    return true;
}

/**
 * Переключение без полного refreshUI: фон и списки настроек не перечитываются.
 */
function switchScreen(id) {
    if (!setActiveScreen(id)) return;
    renderScreens();
    if (bookmarksContainer) renderBookmarks(bookmarksContainer, currentState.bookmarks);
}

function renderScreens() {
    if (!screenDots) return;
    screenDots.textContent = '';
    screenDots.classList.remove('hidden');

    currentState.screens.forEach((screen) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'screen-dot' + (screen.id === currentState.currentScreenId ? ' active' : '');
        dot.dataset.screenId = screen.id;
        dot.title = screenDisplayTitle(screen);
        dot.setAttribute('aria-label', screenDisplayTitle(screen));
        dot.setAttribute('aria-current', screen.id === currentState.currentScreenId ? 'true' : 'false');
        let longPressFired = false;
        let longPressTimer = null;
        const openDotMenu = (x, y) => {
            if (currentState.screens.length < 2) return;
            contextMenuData = { screenId: screen.id };
            openContextMenu(x, y, getContextMenuItems('screenTab', {}));
        };

        dot.addEventListener('click', () => {
            if (longPressFired) { longPressFired = false; return; }
            switchScreen(screen.id);
        });
        dot.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            openDotMenu(e.clientX, e.clientY);
        });
        dot.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            longPressTimer = setTimeout(() => {
                longPressTimer = null;
                longPressFired = true;
                openDotMenu(t.clientX, t.clientY);
            }, 500);
        }, { passive: true });
        const cancelLongPress = () => {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        };
        dot.addEventListener('touchend', cancelLongPress, { passive: true });
        dot.addEventListener('touchmove', cancelLongPress, { passive: true });

        screenDots.appendChild(dot);
    });

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'screen-add';
    addButton.textContent = '+';
    addButton.title = t('addScreen');
    addButton.setAttribute('aria-label', t('addScreen'));
    addButton.addEventListener('click', () => {
        openSettingsModal('screens');
        editingScreenIndex = null;
        screenTitleInput.value = '';
        showScreenForm();
    });
    screenDots.appendChild(addButton);
}

/**
 * Читает активный экран из storage.local до первого refreshUI.
 * Если id нет или экран удалён — первый экран.
 */
function loadActiveScreen(callback) {
    storageLocalGet('currentScreenId', (result) => {
        const id = result.currentScreenId;
        if (!id || !screenById(id)) {
            setActiveScreen(currentState.screens[0]?.id, { persist: false });
        } else {
            setActiveScreen(id, { persist: false });
        }
        callback?.();
    });
}

function screenGestureBlocked(target) {
    return !!target?.closest?.('.bookmark, button, input, select, textarea, .modal, .context-menu');
}

let screenSwipe = null;

function initScreens() {
    if (screenDots) renderScreens();

    document.addEventListener('keydown', (e) => {
        if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        if (!settingsModal?.classList.contains('hidden')) return;

        const index = currentState.screens.findIndex((s) => s.id === currentState.currentScreenId);
        const next = currentState.screens[index + (e.key === 'ArrowRight' ? 1 : -1)];
        if (!next) return;
        e.preventDefault();
        switchScreen(next.id);
    });

    document.body.addEventListener('touchstart', (e) => {
        screenSwipe = null;
        if (e.touches.length !== 1 || screenGestureBlocked(e.target) || touchDrag?.active) return;
        screenSwipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: true };
    }, { passive: true });

    document.body.addEventListener('touchmove', (e) => {
        if (!screenSwipe?.active || touchDrag?.active) return;
        const dx = e.touches[0].clientX - screenSwipe.x;
        const dy = e.touches[0].clientY - screenSwipe.y;
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
            screenSwipe.active = false;
            return;
        }
        if (Math.abs(dx) < 50) return;

        screenSwipe.active = false;
        const index = currentState.screens.findIndex((s) => s.id === currentState.currentScreenId);
        const next = currentState.screens[index + (dx < 0 ? 1 : -1)];
        if (next) switchScreen(next.id);
    }, { passive: true });

    document.body.addEventListener('touchend', () => { screenSwipe = null; }, { passive: true });

    bookmarksContainer?.addEventListener('click', (e) => {
        if (e.target.closest('.empty-add-bookmark')) {
            managedScreenId = currentState.currentScreenId;
            openSettingsModal('bookmarks');
        }
    });

    initScreensSettings();
}

function managedScreen() {
    let screen = screenById(managedScreenId);
    if (!screen) {
        managedScreenId = currentState.currentScreenId;
        screen = activeScreen();
    }
    return screen;
}

function saveScreens() {
    saveState({ screens: currentState.screens });
    refreshUI();
}

/**
 * Меняет местами экран и соседний. Возвращает false, если сдвиг невозможен.
 * Чистая функция списка — её проверяет screens.test.mjs.
 */
function moveScreenInList(screens, screenId, delta) {
    const index = screens.findIndex((s) => s.id === screenId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= screens.length) return false;
    [screens[index], screens[target]] = [screens[target], screens[index]];
    return true;
}

function moveScreenBy(screenId, delta) {
    if (moveScreenInList(currentState.screens, screenId, delta)) saveScreens();
}

function renderBookmarkScreenSelect() {
    if (!bookmarkScreenSelect) return;
    bookmarkScreenSelect.textContent = '';
    const selectedId = managedScreen()?.id;
    currentState.screens.forEach((screen) => {
        const option = document.createElement('option');
        option.value = screen.id;
        option.textContent = screenDisplayTitle(screen);
        option.selected = screen.id === selectedId;
        bookmarkScreenSelect.appendChild(option);
    });
}

function renderScreensManager() {
    if (!screensManagerList) return;
    renderManagerList(screensManagerList, currentState.screens,
        (screen, index) => renderScreenManagerItem(screen, index, currentState.currentScreenId));
}

function hideScreenForm() {
    showScreenFormButton?.classList.remove('hidden');
    screenForm?.classList.remove('open');
    editingScreenIndex = null;
    if (screenTitleInput) screenTitleInput.value = '';
}

function showScreenForm() {
    showScreenFormButton?.classList.add('hidden');
    screenForm?.classList.add('open');
    screenTitleInput?.focus();
}

function startEditingScreen(index) {
    const screen = currentState.screens[index];
    if (!screen) return;
    editingScreenIndex = index;
    screenTitleInput.value = screenDisplayTitle(screen);
    showScreenForm();
    screenTitleInput.focus();
    screenTitleInput.select();
}

function saveScreenForm() {
    const title = screenTitleInput.value.trim();
    if (!title) { alert(t('errTitle')); return; }

    if (editingScreenIndex !== null) {
        const screen = currentState.screens[editingScreenIndex];
        screen.title = title;
        delete screen.titleKey;
        delete screen.titleVars;
    } else {
        const screen = { id: makeScreenId(), title, bookmarks: [] };
        currentState.screens.push(screen);
        managedScreenId = screen.id;
    }
    hideScreenForm();
    saveScreens();
}

function canDeleteScreen(screens, screenId) {
    return screens.length > 1 && screenId !== DEFAULT_SCREEN_ID;
}

function openScreenDeleteDialog(screenId) {
    if (!canDeleteScreen(currentState.screens, screenId)) {
        if (screenId === DEFAULT_SCREEN_ID && currentState.screens.length > 1) {
            alert(t('mainScreenCannotDelete'));
        }
        return;
    }
    const screen = screenById(screenId);
    if (!screen) return;
    screenToDeleteId = screen.id;
    screenDeleteText.textContent = `${screenDisplayTitle(screen)}: ${t('bookmarksCount', { n: screen.bookmarks.length })}`;
    screenDeleteModal.classList.remove('hidden');
    overlay.classList.remove('hidden');
}

function closeScreenDeleteDialog() {
    screenDeleteModal.classList.add('hidden');
    if (settingsModal.classList.contains('hidden')) overlay.classList.add('hidden');
}

function deleteScreen(mode) {
    const index = currentState.screens.findIndex((s) => s.id === screenToDeleteId);
    if (index < 0 || !canDeleteScreen(currentState.screens, screenToDeleteId)) {
        closeScreenDeleteDialog();
        return;
    }
    const screen = currentState.screens[index];

    if (mode === 'move') {
        const target = currentState.screens.find((s) => s.id === DEFAULT_SCREEN_ID && s.id !== screen.id)
            || currentState.screens.find((s) => s.id !== screen.id);
        target.bookmarks.push(...screen.bookmarks);
    }

    currentState.screens.splice(index, 1);
    if (currentState.currentScreenId === screen.id) {
        setActiveScreen(currentState.screens[0].id);
    }
    if (managedScreenId === screen.id) managedScreenId = currentState.screens[0].id;

    closeScreenDeleteDialog();
    saveScreens();
}

function renderScreenPicker() {
    if (!screenPickerList) return;
    screenPickerList.textContent = '';
    const source = activeScreen();
    currentState.screens.forEach((screen) => {
        if (!source || screen.id === source.id) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn';
        button.textContent = `${screenDisplayTitle(screen)} (${screen.bookmarks.length})`;
        button.addEventListener('click', () => moveBookmarkToScreen(screen.id));
        screenPickerList.appendChild(button);
    });
}

function openScreenPicker(index) {
    bookmarkToMoveIndex = index;
    renderScreenPicker();
    screenPickerModal.classList.remove('hidden');
    overlay.classList.remove('hidden');
}

function closeScreenPicker() {
    screenPickerModal.classList.add('hidden');
    if (settingsModal.classList.contains('hidden')) overlay.classList.add('hidden');
}

function moveBookmarkToScreen(screenId) {
    const source = activeScreen();
    const target = screenById(screenId);
    if (!source || !target || source.id === target.id) { closeScreenPicker(); return; }
    const bookmark = source.bookmarks.splice(bookmarkToMoveIndex, 1)[0];
    if (bookmark) target.bookmarks.push(bookmark);
    closeScreenPicker();
    saveScreens();
}

function initScreensSettings() {
    showScreenFormButton?.addEventListener('click', () => {
        editingScreenIndex = null;
        screenTitleInput.value = '';
        showScreenForm();
    });
    cancelScreenButton?.addEventListener('click', hideScreenForm);
    saveScreenButton?.addEventListener('click', saveScreenForm);

    screensManagerList?.addEventListener('click', (e) => {
        const index = Number(e.target.closest('[data-index]')?.dataset.index);
        if (e.target.closest('.screen-manage-edit')) { startEditingScreen(index); return; }
        if (e.target.closest('.screen-manage-delete')) {
            openScreenDeleteDialog(currentState.screens[index]?.id);
            return;
        }
        if (e.target.closest('.screen-manage-up') && index > 0) {
            [currentState.screens[index - 1], currentState.screens[index]] =
                [currentState.screens[index], currentState.screens[index - 1]];
            saveScreens();
            return;
        }
        if (e.target.closest('.screen-manage-down') && index < currentState.screens.length - 1) {
            [currentState.screens[index + 1], currentState.screens[index]] =
                [currentState.screens[index], currentState.screens[index + 1]];
            saveScreens();
        }
    });

    bookmarkScreenSelect?.addEventListener('change', () => {
        managedScreenId = bookmarkScreenSelect.value;
        refreshUI();
    });

    screenDeleteMoveButton?.addEventListener('click', () => deleteScreen('move'));
    screenDeleteAllButton?.addEventListener('click', () => deleteScreen('all'));
    screenDeleteCancelButton?.addEventListener('click', closeScreenDeleteDialog);
    screenPickerCancelButton?.addEventListener('click', closeScreenPicker);

    overlay?.addEventListener('click', () => {
        if (!screenDeleteModal?.classList.contains('hidden')) closeScreenDeleteDialog();
        if (!screenPickerModal?.classList.contains('hidden')) closeScreenPicker();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!screenDeleteModal?.classList.contains('hidden')) closeScreenDeleteDialog();
        if (!screenPickerModal?.classList.contains('hidden')) closeScreenPicker();
    });
}
