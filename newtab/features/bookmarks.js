// =============================================================================
// Фича: Закладки: сохранение формы (двухшаговой), правка/удаление по кнопкам
// плиток и списков, обновление иконки по URL
//
// Wiring — в initBookmarks(), вызывается из бутстрапа app.js на месте
// старой секции. Декларации — на топ-уровне (глобальная лексическая
// среда классических <script>).
// =============================================================================

/**
 * Регистрирует слушатели секции. Вызывается из бутстрапа app.js.
 */
function initBookmarks() {
        // Кнопки "＋ Добавить" и "Отмена" — показ/скрытие формы
        addForms.bookmark.showButton.addEventListener('click', () => showAddForm('bookmark'));
        document.getElementById('cancel-bookmark').addEventListener('click', () => hideAddForm('bookmark'));

        // Кнопка "Добавить" (шаг 1): проверяет URL, предлагает название и
        // иконку, раскрывает остальные поля формы
        addBookmarkButton.addEventListener('click', () => {
            const rawUrl = bookmarkUrlInput.value.trim();
            if (!rawUrl) { alert(t('errBookmarkUrl')); return; }
            const normalizedUrl = normalizeUrl(rawUrl);
            if (!normalizedUrl) { alert(t('errInvalidUrl')); return; }

            fillBookmarkDetails(normalizedUrl);
            expandDetails(bookmarkDetails);
            toggleBookmarkStep({ editing: true });
            bookmarkTitleInput.focus();
            bookmarkTitleInput.select(); // предложенное название легко заменить
        });

        // Enter в поле URL — тот же переход на шаг 2
        bookmarkUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addBookmarkButton.click(); }
        });

        // Кнопка ⟳ у поля "URL логотипа": пересчитать иконку из текущего
        // адреса. Нужна после полной замены URL при редактировании
        refreshBookmarkIconButton.addEventListener('click', () => {
            const normalizedUrl = normalizeUrl(bookmarkUrlInput.value.trim());
            if (!normalizedUrl) { alert(t('errInvalidUrl')); return; }
            bookmarkIconInput.value = `https://${new URL(normalizedUrl).hostname}/favicon.ico`;
        });

        // Кнопка "Сохранить" в форме закладок
        saveBookmarkButton.addEventListener('click', () => {
            const title = bookmarkTitleInput.value.trim();
            const rawUrl = bookmarkUrlInput.value.trim();
            const icon = bookmarkIconInput.value.trim();

            if (!title || !rawUrl) { alert(t('errTitleAndUrl')); return; }

            // Если пользователь ввёл адрес без "https://", добавим его сами
            const normalizedUrl = normalizeUrl(rawUrl);
            if (!normalizedUrl) { alert(t('errInvalidUrl')); return; }
            let urlObj;
            try { urlObj = new URL(normalizedUrl); } catch { alert(t('errInvalidUrl')); return; }

            const bookmarkData = { title, url: normalizedUrl, icon: icon || `https://${urlObj.hostname}/favicon.ico` };

            if (editingBookmarkIndex !== null) {
                currentState.bookmarks[editingBookmarkIndex] = bookmarkData;
            } else {
                currentState.bookmarks.push(bookmarkData);
            }

            saveState({ bookmarks: currentState.bookmarks });
            refreshUI();
            hideAddForm('bookmark'); // прячем форму после сохранения
        });

        // --- Кнопки "Ред."/"Удалить" в списке настроек закладок ---
        bookmarkManagerList.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.bookmark-manage-edit');
            if (editBtn) {
                startEditing(Number(editBtn.dataset.index), 'bookmark');
                return;
            }

            const deleteBtn = e.target.closest('.bookmark-manage-delete');
            if (deleteBtn) {
                currentState.bookmarks.splice(Number(deleteBtn.dataset.index), 1);
                saveState({ bookmarks: currentState.bookmarks });
                refreshUI();
            }
        });

        // --- Кнопки на плитках закладок на главной странице ---
        // Обработчик один на весь контейнер (делегирование): он ловит клики
        // всех плиток, включая созданные позже — не нужно вешать обработчик
        // на каждую кнопку отдельно
        bookmarksContainer.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-bookmark');
            if (editBtn) {
                e.stopPropagation(); // не даём плитке открыть ссылку
                startEditing(Number(editBtn.dataset.index), 'bookmark');
                return;
            }

            const deleteBtn = e.target.closest('.delete-bookmark');
            if (deleteBtn) {
                e.stopPropagation();
                currentState.bookmarks.splice(Number(deleteBtn.dataset.index), 1);
                saveState({ bookmarks: currentState.bookmarks });
                refreshUI();
            }
        });

        initSearch();
}
