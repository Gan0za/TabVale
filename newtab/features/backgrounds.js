// =============================================================================
// Фича: фоны. Четыре типа: url (картинка по ссылке), file (загрузка с
// устройства, данные в storage.local), color (заливка), gradient.
//
// Декларации (currentBackgroundType, switchBackgroundType, конструктор
// градиента, превью file-фона) — на топ-уровне: их вызывают
// features/ui-actions.js (resetBackgroundForm, startEditing) и бутстрап.
// Wiring вкладок, файла, пресетов и списка — в initBackgrounds(),
// вызывается из бутстрапа app.js.
// =============================================================================

// Текущий тип в форме: 'url' | 'file' | 'color' | 'gradient'
let currentBackgroundType = 'url';

/**
 * Показывает поля выбранного типа и прячет остальные.
 */
function switchBackgroundType(type) {
    document.querySelectorAll('.bg-type-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.bgType === type);
    });
    backgroundUrlInput.classList.toggle('hidden', type !== 'url');
    backgroundFileInput.classList.toggle('hidden', type !== 'file');
    // Положение картинки выбирается только у url- и file-фонов
    backgroundPositionRow.classList.toggle('hidden', type !== 'url' && type !== 'file');
    document.getElementById('background-color-row').classList.toggle('hidden', type !== 'color');
    document.getElementById('background-gradient-box').classList.toggle('hidden', type !== 'gradient');
    // Превью выбранного файла принадлежит вкладке "Устройство":
    // на других вкладках его прячем, при возврате — восстанавливаем
    const previewBox = document.getElementById('background-file-preview');
    if (type !== 'file') {
        previewBox.classList.add('hidden');
    } else if (previewBox.dataset.pendingDataUrl) {
        previewBox.classList.remove('hidden');
    } else if (editingBackgroundIndex !== null) {
        showFilePreview(currentState.backgrounds[editingBackgroundIndex]);
    }
}

/**
 * Ставит конструктор градиента в заданный пресет [from, to, angle]
 * и обновляет превью.
 */
function applyGradientPreset([from, to, angle]) {
    gradientFromInput.value = from;
    gradientToInput.value = to;
    gradientAngleInput.value = angle;
    updateGradientPreview();
}

function updateGradientPreview() {
    gradientPreview.style.background =
        `linear-gradient(${gradientAngleInput.value}deg, ${gradientFromInput.value}, ${gradientToInput.value})`;
}

function updateColorValueLabel() {
    document.getElementById('background-color-value').textContent = backgroundColorInput.value;
}

/**
 * Превью file-фона при редактировании. Диалог выбора файла нельзя
 * заполнить программно, поэтому вместо него показываем миниатюру
 * уже прикреплённой картинки (data:URL из storage.local) и её fileId.
 * Пока превью показано, сохранение не требует повторного выбора.
 */
function showFilePreview(bg) {
    const box = document.getElementById('background-file-preview');
    if (!bg || bg.type !== 'file' || !bg.fileId) {
        box.classList.add('hidden');
        return;
    }
    chrome.storage.local.get(fileKey(bg.fileId), (result) => {
        const err = chrome.runtime?.lastError;
        const dataUrl = err ? '' : (result || {})[fileKey(bg.fileId)];
        if (!dataUrl) {
            box.classList.add('hidden');
            return;
        }
        setImageSource(document.getElementById('background-file-thumb'), dataUrl, '');
        document.getElementById('background-file-name').textContent = t('fileBackground');
        box.classList.remove('hidden');
    });
}

/**
 * Регистрирует слушатели секции. Вызывается из бутстрапа app.js.
 */
function initBackgrounds() {
        // Клик по вкладкам типа фона (Ссылка/Устройство/Цвет/Градиент)
        document.querySelectorAll('.bg-type-tab').forEach((tab) => {
            tab.addEventListener('click', () => switchBackgroundType(tab.dataset.bgType));
        });

        // Выбор файла в диалоге: сразу показываем его миниатюру в форме
        // (и при создании, и при замене при редактировании)
        backgroundFileInput.addEventListener('change', () => {
            const file = backgroundFileInput.files?.[0];
            const box = document.getElementById('background-file-preview');
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = typeof reader.result === 'string' ? reader.result : '';
                if (!dataUrl) return;
                // Кешируем: сохранение возьмёт готовый data:URL из превью
                box.dataset.pendingDataUrl = dataUrl;
                setImageSource(document.getElementById('background-file-thumb'), dataUrl, '');
                document.getElementById('background-file-name').textContent = file.name;
                box.classList.remove('hidden');
            };
            reader.onerror = () => box.classList.add('hidden');
            reader.readAsDataURL(file);
        });

        // Конструктор градиента: любое изменение сразу видно в превью
        [gradientFromInput, gradientToInput, gradientAngleInput].forEach((input) => {
            input.addEventListener('input', updateGradientPreview);
        });
        backgroundColorInput.addEventListener('input', updateColorValueLabel);

        // Пресеты: клик заполняет конструктор
        GRADIENT_PRESETS.forEach(([from, to, angle]) => {
            const preset = document.createElement('button');
            preset.type = 'button';
            preset.className = 'gradient-preset';
            preset.title = `${from} → ${to}`;
            preset.style.background = `linear-gradient(${angle}deg, ${from}, ${to})`;
            preset.addEventListener('click', () => {
                gradientFromInput.value = from;
                gradientToInput.value = to;
                gradientAngleInput.value = angle;
                updateGradientPreview();
            });
            gradientPresets.appendChild(preset);
        });

        // Кнопки "＋ Добавить" и "Отмена" — показ/скрытие формы
        addForms.background.showButton.addEventListener('click', () => showAddForm('background'));
        document.getElementById('cancel-background').addEventListener('click', () => hideAddForm('background'));

        saveBackgroundButton.addEventListener('click', () => {
            const title = backgroundTitleInput.value.trim();
            if (!title) { alert(t('errTitle')); return; }

            // Тип берём из активной вкладки переключателя
            const activeTab = document.querySelector('.bg-type-tab.active');
            const type = activeTab ? activeTab.dataset.bgType : 'url';

            if (type === 'color') {
                const backgroundData = { type, title, value: backgroundColorInput.value };
                commitBackground(backgroundData);
                return;
            }

            if (type === 'gradient') {
                const backgroundData = {
                    type,
                    title,
                    from: gradientFromInput.value,
                    to: gradientToInput.value,
                    angle: Number(gradientAngleInput.value),
                };
                commitBackground(backgroundData);
                return;
            }

            if (type === 'file') {
                const position = backgroundPositionInput.value;
                const file = backgroundFileInput.files?.[0];
                // Запись data:URL в storage.local с проверкой квоты: без неё
                // ошибка терялась в консоль (Unchecked runtime.lastError),
                // а фон молча не сохранялся
                const saveFileData = (dataUrl) => {
                    const fileId = makeFileId();
                    chrome.storage.local.set({ [fileKey(fileId)]: dataUrl }, () => {
                        const err = chrome.runtime?.lastError;
                        if (err) { alert(t('errFileTooBig')); return; }
                        commitBackground({ type, title, fileId, position });
                    });
                };
                // Файл не выбран: берём data:URL из превью (пользователь выбрал
                // файл, но input был сброшен) либо прежнюю картинку при
                // редактировании; при создании без файла — отказ
                if (!file) {
                    const pendingDataUrl = document.getElementById('background-file-preview')
                        .dataset.pendingDataUrl;
                    if (pendingDataUrl) {
                        saveFileData(pendingDataUrl);
                        return;
                    }
                    const editing = editingBackgroundIndex !== null
                        ? currentState.backgrounds[editingBackgroundIndex]
                        : null;
                    if (editingBackgroundIndex !== null && editing
                        && editing.type === 'file' && editing.fileId) {
                        commitBackground({ type, title, fileId: editing.fileId, position });
                    } else {
                        alert(t('errNoFile'));
                    }
                    return;
                }
                // Читаем файл асинхронно, затем сохраняем
                const reader = new FileReader();
                reader.onload = () => {
                    const dataUrl = typeof reader.result === 'string' ? reader.result : '';
                    if (!dataUrl) { alert(t('errNoFile')); return; }
                    saveFileData(dataUrl);
                };
                reader.onerror = () => alert(t('importError', { error: 'FileReader' }));
                reader.readAsDataURL(file);
                return;
            }

            // url — картинка по ссылке (пустой url допустим: "По умолчанию")
            commitBackground({ type: 'url', title, url: backgroundUrlInput.value.trim(), position: backgroundPositionInput.value });
        });

        /**
         * Записывает фон в список (учитывая режим редактирования) и закрывает
         * форму. Проверка normalizeBackground отсеет битые значения.
         */
        function commitBackground(backgroundData) {
            const normalized = normalizeBackground(backgroundData);
            if (!normalized) { alert(t('errTitle')); return; }
            let addedIndex = null;
            if (editingBackgroundIndex !== null) {
                // При редактировании сохраняем fileId старой записи, если новый
                // файл не выбирали (normalized fileId сгенерирован заново)
                currentState.backgrounds[editingBackgroundIndex] = normalized;
            } else {
                currentState.backgrounds.push(normalized);
                // Новый фон сразу становится текущим: пользователь только что
                // его настроил и ожидает увидеть на экране, а не прежний фон
                editingBackgroundIndex = currentState.backgrounds.length - 1;
                currentState.currentBackgroundIndex = editingBackgroundIndex;
            }
            saveState({
                backgrounds: currentState.backgrounds,
                currentBackgroundIndex: currentState.currentBackgroundIndex,
            });
            editingBackgroundIndex = null;
            refreshUI();
            hideAddForm('background');
        }

        backgroundManagerList.addEventListener('click', (e) => {
            const selectBtn = e.target.closest('.background-manage-select');
            if (selectBtn) {
                currentState.currentBackgroundIndex = Number(selectBtn.dataset.index);
                saveState({ currentBackgroundIndex: currentState.currentBackgroundIndex });
                refreshUI();
                return;
            }

            const editBtn = e.target.closest('.background-manage-edit');
            if (editBtn) {
                startEditing(Number(editBtn.dataset.index), 'background');
                return;
            }

            const deleteBtn = e.target.closest('.background-manage-delete');
            if (deleteBtn) {
                deleteItem('backgrounds', 'currentBackgroundIndex', Number(deleteBtn.dataset.index));
            }
        });
}
