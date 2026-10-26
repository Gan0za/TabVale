// =============================================================================
// Фича: Поиск: переход по Enter, дропдаун поисковиков (открытие, выбор движка,
// закрытие по клику мимо)
//
// Wiring — в initSearch(), вызывается из бутстрапа app.js на месте
// старой секции. Декларации — на топ-уровне (глобальная лексическая
// среда классических <script>).
// =============================================================================

/**
 * Регистрирует слушатели секции. Вызывается из бутстрапа app.js.
 */
function initSearch() {
        searchButton.addEventListener('click', runSearch);
        searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });

        // Открытие/закрытие выпадающего списка
        searchEngineDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // чтобы клик не закрыл список тут же обработчиком document
            closeAllPopovers(searchEngineList);
            searchEngineList.classList.toggle('open');
        });

        // Выбор поисковой системы из выпадающего списка
        searchEngineList.addEventListener('click', (e) => {
            const item = e.target.closest('.dropdown-item');
            if (!item) return;

            // Ищем выбранный движок по адресу (ключу из dataset)
            const url = item.dataset.url;
            const index = currentState.searchEngines.findIndex(engine => engine.url === url);
            if (index !== -1) {
                currentState.currentSearchEngineIndex = index;
                saveState({ currentSearchEngineIndex: index });
                renderSearchEngineDropdown(currentState.searchEngines, index);
            }
            searchEngineList.classList.remove('open');
        });

        // Закрытие списка при клике в любом другом месте страницы
        document.addEventListener('click', () => {
            searchEngineList.classList.remove('open');
        });
}
