// =============================================================================
// Фича: Поисковые системы: сохранение формы, список в настройках, выбор по
// умолчанию
//
// Wiring — в initSearchEngines(), вызывается из бутстрапа app.js на месте
// старой секции. Декларации — на топ-уровне (глобальная лексическая
// среда классических <script>).
// =============================================================================

/**
 * Регистрирует слушатели секции. Вызывается из бутстрапа app.js.
 */
function initSearchEngines() {
    // Кнопки "＋ Добавить" и "Отмена" — показ/скрытие формы
    addForms.searchEngine.showButton.addEventListener('click', () => showAddForm('searchEngine'));
    document.getElementById('cancel-search-engine').addEventListener('click', () => hideAddForm('searchEngine'));

    // Кнопка "Добавить" (шаг 1): проверяет URL с %s, предлагает название
    // и логотип, раскрывает остальные поля
    addSearchEngineButton.addEventListener('click', () => {
        const rawUrl = newSearchEngineUrl.value.trim();
        // %s в URL обязателен — иначе некуда подставлять запрос
        if (!rawUrl || !rawUrl.includes('%s')) { alert(t('errEngineUrl')); return; }
        const normalizedUrl = normalizeUrl(rawUrl);
        if (!normalizedUrl || !normalizedUrl.includes('%s')) { alert(t('errEngineUrl')); return; }

        newSearchEngineName.value = suggestNameFromUrl(normalizedUrl);
        newSearchEngineLogo.value = `https://${new URL(normalizedUrl.replace('%s', '')).hostname}/favicon.ico`;
        expandDetails(searchEngineDetails);
        toggleSearchEngineStep({ editing: true });
        newSearchEngineName.focus();
        newSearchEngineName.select();
    });

    // Enter в поле URL — тот же переход на шаг 2
    newSearchEngineUrl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addSearchEngineButton.click(); }
    });

    // Кнопка ⟳ у поля "URL логотипа": пересчитать логотип из текущего
    // адреса с %s (шаблон поисковика)
    refreshSearchEngineIconButton.addEventListener('click', () => {
        const normalizedUrl = normalizeUrl(newSearchEngineUrl.value.trim());
        if (!normalizedUrl || !normalizedUrl.includes('%s')) { alert(t('errEngineUrl')); return; }
        newSearchEngineLogo.value = `https://${new URL(normalizedUrl.replace('%s', '')).hostname}/favicon.ico`;
    });

    saveSearchEngineButton.addEventListener('click', () => {
        const name = newSearchEngineName.value.trim();
        const url = newSearchEngineUrl.value.trim();
        const logo = newSearchEngineLogo.value.trim();

        // %s в URL обязателен — иначе некуда подставлять запрос
        if (!name || !url || !url.includes('%s')) { alert(t('errNameAndUrl')); return; }

        const engineData = { name: clampSearchName(name), url, logo };
        if (editingSearchEngineIndex !== null) {
            currentState.searchEngines[editingSearchEngineIndex] = engineData;
        } else {
            currentState.searchEngines.push(engineData);
        }

        saveState({ searchEngines: currentState.searchEngines });
        refreshUI();
        hideAddForm('searchEngine');
    });

    searchEnginesList.addEventListener('click', (e) => {
        const selectBtn = e.target.closest('.search-engine-select');
        if (selectBtn) {
            currentState.currentSearchEngineIndex = Number(selectBtn.dataset.index);
            saveState({ currentSearchEngineIndex: currentState.currentSearchEngineIndex });
            refreshUI();
            return;
        }

        const editBtn = e.target.closest('.search-engine-edit');
        if (editBtn) {
            startEditing(Number(editBtn.dataset.index), 'searchEngine');
            return;
        }

        const deleteBtn = e.target.closest('.search-engine-delete');
        if (deleteBtn) {
            deleteItem('searchEngines', 'currentSearchEngineIndex', Number(deleteBtn.dataset.index));
        }
    });
}
