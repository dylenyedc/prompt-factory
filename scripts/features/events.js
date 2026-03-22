function bindGroupEvents() {
    if (charGroupAddBtn && charGroupTitleInput) {
        charGroupAddBtn.addEventListener('click', async function () {
            const title = charGroupTitleInput.value.trim();
            const ok = await addCharGroupByTitle(title);
            if (ok) {
                charGroupTitleInput.value = '';
            }
        });
    }

    if (outfitGroupAddBtn) {
        outfitGroupAddBtn.addEventListener('click', async function () {
            await addOutfitEntry();
        });
    }

    if (actionItemAddBtn) {
        actionItemAddBtn.addEventListener('click', async function () {
            await addActionEntry();
        });
    }

    if (envItemAddBtn) {
        envItemAddBtn.addEventListener('click', async function () {
            await addEnvEntry();
        });
    }
}

function bindListEvents() {
        function focusActiveCharTagInput() {
            if (!activeCharTagEditor) {
                return;
            }

            window.setTimeout(function () {
                if (!activeCharTagEditor) {
                    return;
                }

                const selector = activeCharTagEditor.isNew
                    ? 'input[data-action="char-tag-edit-input"][data-group-id="' + activeCharTagEditor.groupId + '"][data-old-tag=""]'
                    : 'input[data-action="char-tag-edit-input"][data-group-id="' + activeCharTagEditor.groupId + '"][data-old-tag="' + activeCharTagEditor.oldTag + '"]';
                const input = document.querySelector(selector);
                if (!input) {
                    return;
                }

                input.focus();
                if (!activeCharTagEditor.isNew && input.select) {
                    input.select();
                }
            }, 0);
        }

        async function saveActiveCharTagEditorWithConfirm() {
            if (!activeCharTagEditor) {
                return true;
            }

            const groupId = activeCharTagEditor.groupId || '';
            const oldTag = activeCharTagEditor.oldTag || '';
            const isNew = !!activeCharTagEditor.isNew;
            const nextTagRaw = String(activeCharTagEditor.value || '').trim();

            if (!nextTagRaw) {
                activeCharTagEditor = null;
                renderTab('chars');
                return true;
            }

            if (!window.confirm('确认保存标签修改吗？')) {
                activeCharTagEditor = null;
                renderTab('chars');
                return false;
            }

            let ok = false;
            if (isNew || !oldTag) {
                ok = await addCharTagByValue(groupId, nextTagRaw);
            } else {
                ok = await editCharTagByValue(groupId, oldTag, nextTagRaw);
            }

            if (ok) {
                activeCharTagEditor = null;
            }
            return ok;
        }

        async function trySaveByOutsideClick(event) {
            if (!activeCharTagEditor) {
                return false;
            }

            const insideEditor = !!event.target.closest('.char-tag-edit-wrap');
            if (insideEditor) {
                return false;
            }

            await saveActiveCharTagEditorWithConfirm();
            return true;
        }

        function focusActiveTaggedTagInput() {
            if (!activeTaggedTagEditor) {
                return;
            }

            window.setTimeout(function () {
                if (!activeTaggedTagEditor) {
                    return;
                }

                const selector = activeTaggedTagEditor.mode === 'env-kind'
                    ? 'select[data-action="env-kind-edit-select"][data-tab-id="env"][data-item-id="' + activeTaggedTagEditor.itemId + '"]'
                    : (activeTaggedTagEditor.isNew
                        ? 'input[data-action="tagged-tag-edit-input"][data-tab-id="' + activeTaggedTagEditor.tabId + '"][data-item-id="' + activeTaggedTagEditor.itemId + '"][data-old-tag=""]'
                        : 'input[data-action="tagged-tag-edit-input"][data-tab-id="' + activeTaggedTagEditor.tabId + '"][data-item-id="' + activeTaggedTagEditor.itemId + '"][data-old-tag="' + activeTaggedTagEditor.oldTag + '"]');
                const input = document.querySelector(selector);
                if (!input) {
                    return;
                }

                input.focus();
                if (activeTaggedTagEditor.mode !== 'env-kind' && !activeTaggedTagEditor.isNew && input.select) {
                    input.select();
                }
            }, 0);
        }

        async function saveActiveTaggedTagEditorWithConfirm() {
            if (!activeTaggedTagEditor) {
                return true;
            }

            const tabId = activeTaggedTagEditor.tabId || '';
            const itemId = activeTaggedTagEditor.itemId || '';
            const oldTag = activeTaggedTagEditor.oldTag || '';
            const isNew = !!activeTaggedTagEditor.isNew;
            const nextTagRaw = String(activeTaggedTagEditor.value || '').trim();

            if (!tabId || !itemId) {
                activeTaggedTagEditor = null;
                return true;
            }

            if (activeTaggedTagEditor.mode === 'env-kind') {
                if (!window.confirm('确认保存分类修改吗？')) {
                    activeTaggedTagEditor = null;
                    renderTab(tabId);
                    return false;
                }

                const okKind = await saveEnvKindByValue(itemId, nextTagRaw || '环境');
                if (okKind) {
                    activeTaggedTagEditor = null;
                }
                return okKind;
            }

            if (!nextTagRaw) {
                activeTaggedTagEditor = null;
                renderTab(tabId);
                return true;
            }

            if (!window.confirm('确认保存标签修改吗？')) {
                activeTaggedTagEditor = null;
                renderTab(tabId);
                return false;
            }

            let ok = false;
            if (isNew || !oldTag) {
                ok = await addTaggedTagByValue(tabId, itemId, nextTagRaw);
            } else {
                ok = await editTaggedTagByValue(tabId, itemId, oldTag, nextTagRaw);
            }

            if (ok) {
                activeTaggedTagEditor = null;
            }
            return ok;
        }

        async function trySaveTaggedByOutsideClick(event) {
            if (!activeTaggedTagEditor) {
                return false;
            }

            const insideEditor = !!event.target.closest('.char-tag-edit-wrap');
            if (insideEditor) {
                return false;
            }

            await saveActiveTaggedTagEditorWithConfirm();
            return true;
        }

        const listChars = document.getElementById('list-chars');
        if (listChars) {
            listChars.addEventListener('input', function (event) {
                const input = event.target.closest('input[data-action="char-tag-edit-input"]');
                if (!input || !activeCharTagEditor) {
                    return;
                }

                const groupId = input.dataset.groupId || '';
                const oldTag = input.dataset.oldTag || '';
                if (activeCharTagEditor.groupId !== groupId || (activeCharTagEditor.oldTag || '') !== oldTag) {
                    return;
                }

                activeCharTagEditor.value = input.value;
            });

            listChars.addEventListener('keydown', async function (event) {
                const input = event.target.closest('input[data-action="char-tag-edit-input"]');
                if (!input) {
                    return;
                }

                if (event.key === 'Enter') {
                    event.preventDefault();
                    activeCharTagEditor.value = input.value;
                    await saveActiveCharTagEditorWithConfirm();
                    return;
                }

                if (event.key === 'Escape') {
                    event.preventDefault();
                    activeCharTagEditor = null;
                    renderTab('chars');
                }
            });

            document.addEventListener('click', async function (event) {
                const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
                const insideByPath = Array.isArray(path) && path.indexOf(listChars) > -1;
                const insideByContains = !!(event.target && listChars.contains(event.target));
                const insideChars = insideByPath || insideByContains;
                if (insideChars) {
                    return;
                }
                await trySaveByOutsideClick(event);
            });
        }

        function bindTaggedTagInputEvents(listNode) {
            if (!listNode) {
                return;
            }

            listNode.addEventListener('input', function (event) {
                const input = event.target.closest('input[data-action="tagged-tag-edit-input"]');
                if (!input || !activeTaggedTagEditor) {
                    return;
                }

                const tabId = input.dataset.tabId || '';
                const itemId = input.dataset.itemId || '';
                const oldTag = input.dataset.oldTag || '';
                if (activeTaggedTagEditor.tabId !== tabId || activeTaggedTagEditor.itemId !== itemId || (activeTaggedTagEditor.oldTag || '') !== oldTag) {
                    return;
                }

                activeTaggedTagEditor.value = input.value;
            });

            listNode.addEventListener('change', async function (event) {
                const select = event.target.closest('select[data-action="env-kind-edit-select"]');
                if (!select || !activeTaggedTagEditor) {
                    return;
                }
                activeTaggedTagEditor.value = select.value;
                await saveActiveTaggedTagEditorWithConfirm();
            });

            listNode.addEventListener('keydown', async function (event) {
                const input = event.target.closest('input[data-action="tagged-tag-edit-input"]');
                if (!input) {
                    return;
                }

                if (event.key === 'Enter') {
                    event.preventDefault();
                    activeTaggedTagEditor.value = input.value;
                    await saveActiveTaggedTagEditorWithConfirm();
                    return;
                }

                if (event.key === 'Escape') {
                    event.preventDefault();
                    const tabId = input.dataset.tabId || '';
                    activeTaggedTagEditor = null;
                    if (tabId) {
                        renderTab(tabId);
                    }
                }
            });
        }

        const listActions = document.getElementById('list-actions');
        const listEnv = document.getElementById('list-env');
        bindTaggedTagInputEvents(listActions);
        bindTaggedTagInputEvents(listEnv);

        document.addEventListener('click', async function (event) {
            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            const insideActionsByPath = Array.isArray(path) && listActions ? path.indexOf(listActions) > -1 : false;
            const insideEnvByPath = Array.isArray(path) && listEnv ? path.indexOf(listEnv) > -1 : false;
            const insideActionsByContains = !!(listActions && event.target && listActions.contains(event.target));
            const insideEnvByContains = !!(listEnv && event.target && listEnv.contains(event.target));
            const insideTagged = insideActionsByPath || insideEnvByPath || insideActionsByContains || insideEnvByContains;
            if (insideTagged) {
                return;
            }
            await trySaveTaggedByOutsideClick(event);
        });

        ['list-chars', 'list-actions', 'list-env', 'list-outfit'].forEach(function (id) {
            const list = document.getElementById(id);
            if (!list) {
                return;
            }
            list.addEventListener('click', async function (event) {
                const consumedByOutsideSave = await trySaveByOutsideClick(event);
                if (consumedByOutsideSave) {
                    return;
                }

                const consumedByTaggedOutsideSave = await trySaveTaggedByOutsideClick(event);
                if (consumedByTaggedOutsideSave) {
                    return;
                }

                const btn = event.target.closest('button');
                if (!btn) {
                    return;
                }

                const action = btn.dataset.action;

                if (action === 'start-char-tag-edit') {
                    const groupId = btn.dataset.groupId || '';
                    const tag = btn.dataset.tag || '';
                    if (!groupId || !tag) {
                        return;
                    }

                    const isSame = !!activeCharTagEditor
                        && activeCharTagEditor.groupId === groupId
                        && activeCharTagEditor.oldTag === tag
                        && !activeCharTagEditor.isNew;

                    activeCharTagEditor = isSame
                        ? null
                        : { groupId: groupId, oldTag: tag, value: tag, isNew: false };
                    renderTab('chars');
                    focusActiveCharTagInput();
                    return;
                }

                if (action === 'start-char-tag-add') {
                    const groupId = btn.dataset.groupId || '';
                    if (!groupId) {
                        return;
                    }

                    activeCharTagEditor = { groupId: groupId, oldTag: '', value: '', isNew: true };
                    renderTab('chars');
                    focusActiveCharTagInput();
                    return;
                }

                if (action === 'delete-char-tag-inline') {
                    const groupId = btn.dataset.groupId || '';
                    const oldTag = btn.dataset.tag || '';
                    if (!groupId || !oldTag) {
                        return;
                    }

                    if (!window.confirm('确认删除标签“' + oldTag + '”吗？')) {
                        renderTab('chars');
                        return;
                    }

                    activeCharTagEditor = null;
                    await deleteCharTagByValue(groupId, oldTag);
                    return;
                }

                if (action === 'open-char-settings-modal') {
                    activeCharTagEditor = null;
                    const groupId = btn.dataset.groupId || '';
                    const groupTitle = btn.dataset.groupTitle || '';
                    if (!groupId) {
                        return;
                    }
                    openCharSettingsModal(groupId, groupTitle);
                    return;
                }

                if (action === 'start-tagged-tag-edit') {
                    const tabId = btn.dataset.tabId || '';
                    const itemId = btn.dataset.itemId || '';
                    const tag = btn.dataset.tag || '';
                    if (!tabId || !itemId || !tag) {
                        return;
                    }

                    const isSame = !!activeTaggedTagEditor
                        && activeTaggedTagEditor.tabId === tabId
                        && activeTaggedTagEditor.itemId === itemId
                        && activeTaggedTagEditor.oldTag === tag
                        && !activeTaggedTagEditor.isNew;

                    activeTaggedTagEditor = isSame
                        ? null
                        : { tabId: tabId, itemId: itemId, oldTag: tag, value: tag, isNew: false };
                    renderTab(tabId);
                    focusActiveTaggedTagInput();
                    return;
                }

                if (action === 'start-env-kind-edit') {
                    const tabId = btn.dataset.tabId || '';
                    const itemId = btn.dataset.itemId || '';
                    const tag = btn.dataset.tag || '环境';
                    if (tabId !== 'env' || !itemId) {
                        return;
                    }

                    const isSame = !!activeTaggedTagEditor
                        && activeTaggedTagEditor.tabId === tabId
                        && activeTaggedTagEditor.itemId === itemId
                        && activeTaggedTagEditor.mode === 'env-kind';

                    activeTaggedTagEditor = isSame
                        ? null
                        : { tabId: tabId, itemId: itemId, oldTag: tag, value: tag, isNew: false, mode: 'env-kind' };
                    renderTab(tabId);
                    focusActiveTaggedTagInput();
                    return;
                }

                if (action === 'start-tagged-tag-add') {
                    const tabId = btn.dataset.tabId || '';
                    const itemId = btn.dataset.itemId || '';
                    if (!tabId || !itemId) {
                        return;
                    }

                    activeTaggedTagEditor = { tabId: tabId, itemId: itemId, oldTag: '', value: '', isNew: true };
                    renderTab(tabId);
                    focusActiveTaggedTagInput();
                    return;
                }

                if (action === 'delete-tagged-tag-inline') {
                    const tabId = btn.dataset.tabId || '';
                    const itemId = btn.dataset.itemId || '';
                    const oldTag = btn.dataset.tag || '';
                    if (!tabId || !itemId || !oldTag) {
                        return;
                    }

                    if (!window.confirm('确认删除标签“' + oldTag + '”吗？')) {
                        renderTab(tabId);
                        return;
                    }

                    activeTaggedTagEditor = null;
                    await deleteTaggedTagByValue(tabId, itemId, oldTag);
                    return;
                }

                if (action === 'add-item-start') {
                    addState = { tabId: btn.dataset.tabId, groupId: btn.dataset.groupId };
                    editState = null;
                    renderTab(btn.dataset.tabId);
                    return;
                }

                if (action === 'save-char-description') {
                    const groupId = btn.dataset.groupId || '';
                    if (!groupId) {
                        return;
                    }
                    const selector = '[data-inline-form="char-description"][data-group-id="' + groupId + '"] [data-role="char-description-input"]';
                    const input = document.querySelector(selector);
                    const description = input ? input.value : '';
                    await saveCharDescriptionByValue(groupId, description);
                    return;
                }

                if (action === 'copy-char-base') {
                    const formNode = btn.closest('[data-inline-form="char-description"]');
                    const input = formNode ? formNode.querySelector('[data-role="char-description-input"]') : null;
                    const description = String(input ? input.value : '').trim();
                    if (!description) {
                        showToast('角色描述不能为空');
                        return;
                    }
                    copyPrompt(description);
                    return;
                }

                if (action === 'add-char-base-to-cart') {
                    const formNode = btn.closest('[data-inline-form="char-description"]');
                    const input = formNode ? formNode.querySelector('[data-role="char-description-input"]') : null;
                    const description = String(input ? input.value : '').trim();
                    if (!description) {
                        showToast('角色描述不能为空');
                        return;
                    }

                    const groupTitle = btn.dataset.groupTitle || '角色';
                    addToPromptCart({
                        sourceTab: 'chars',
                        sourceGroupId: btn.dataset.groupId || '',
                        sourceItemId: 'char-base',
                        label: groupTitle + '（角色特征）',
                        prompt: description
                    });
                    return;
                }

                if (action === 'copy-char-with-outfit') {
                    const cardNode = btn.closest('.card');
                    const descFormNode = cardNode ? cardNode.querySelector('[data-inline-form="char-description"]') : null;
                    const descInput = descFormNode ? descFormNode.querySelector('[data-role="char-description-input"]') : null;
                    const basePrompt = String(descInput ? descInput.value : '').trim();
                    if (!basePrompt) {
                        showToast('角色描述不能为空');
                        return;
                    }

                    const outfitFormNode = btn.closest('[data-inline-form="char-copy-with-outfit"]');
                    const outfitSelect = outfitFormNode ? outfitFormNode.querySelector('[data-role="char-outfit-select"]') : null;
                    const outfitId = outfitSelect ? String(outfitSelect.value || '').trim() : '';
                    let outfitPrompt = '';
                    if (outfitId) {
                        const outfitEntry = (promptData.outfit || []).find(function (entry) {
                            return entry.id === outfitId;
                        });
                        if (!outfitEntry || !String(outfitEntry.prompt || '').trim()) {
                            showToast('所选服装提示词为空');
                            return;
                        }
                        outfitPrompt = outfitEntry.prompt;
                    }

                    const mergedPrompt = composeCharacterPrompt(basePrompt, outfitPrompt);
                    if (!mergedPrompt) {
                        showToast('复制内容为空');
                        return;
                    }
                    copyPrompt(mergedPrompt);
                    return;
                }

                if (action === 'add-char-with-outfit-to-cart') {
                    const cardNode = btn.closest('.card');
                    const descFormNode = cardNode ? cardNode.querySelector('[data-inline-form="char-description"]') : null;
                    const descInput = descFormNode ? descFormNode.querySelector('[data-role="char-description-input"]') : null;
                    const basePrompt = String(descInput ? descInput.value : '').trim();
                    if (!basePrompt) {
                        showToast('角色描述不能为空');
                        return;
                    }

                    const outfitFormNode = btn.closest('[data-inline-form="char-copy-with-outfit"]');
                    const outfitSelect = outfitFormNode ? outfitFormNode.querySelector('[data-role="char-outfit-select"]') : null;
                    const outfitId = outfitSelect ? String(outfitSelect.value || '').trim() : '';
                    let outfitPrompt = '';
                    let outfitLabel = '无服装';
                    if (outfitId) {
                        const outfitEntry = (promptData.outfit || []).find(function (entry) {
                            return entry.id === outfitId;
                        });
                        if (!outfitEntry || !String(outfitEntry.prompt || '').trim()) {
                            showToast('所选服装提示词为空');
                            return;
                        }
                        outfitPrompt = outfitEntry.prompt;
                        outfitLabel = formatOutfitDisplayName(outfitEntry);
                    }

                    const mergedPrompt = composeCharacterPrompt(basePrompt, outfitPrompt);
                    if (!mergedPrompt) {
                        showToast('添加内容为空');
                        return;
                    }

                    const groupTitle = btn.dataset.groupTitle || '角色';
                    addToPromptCart({
                        sourceTab: 'chars',
                        sourceGroupId: btn.dataset.groupId || '',
                        sourceItemId: outfitId || 'char-base',
                        label: groupTitle + ' + ' + outfitLabel,
                        prompt: mergedPrompt
                    });
                    return;
                }

                const itemNode = btn.closest('.prompt-item');
                if (!itemNode) {
                    if (action === 'add-item-cancel') {
                        const formNode = btn.closest('[data-inline-form="add"]');
                        const tabId = formNode ? formNode.dataset.tabId : activeTab;
                        addState = null;
                        renderTab(tabId);
                        return;
                    }

                    if (action === 'add-item-save') {
                        const formNode = btn.closest('[data-inline-form="add"]');
                        if (!formNode) {
                            return;
                        }
                        await saveInlineAddedItem(formNode);
                        return;
                    }

                    return;
                }

                if (action === 'copy') {
                    const itemTabId = itemNode.dataset.tabId || '';
                    if (itemTabId === 'outfit') {
                        const cardNode = btn.closest('.card');
                        const descFormNode = cardNode ? cardNode.querySelector('[data-inline-form="char-description"]') : null;
                        const descInput = descFormNode ? descFormNode.querySelector('[data-role="char-description-input"]') : null;

                        if (descInput) {
                            const basePrompt = String(descInput.value || '').trim();
                            if (!basePrompt) {
                                showToast('角色描述不能为空');
                                return;
                            }

                            const outfitPrompt = String(btn.dataset.prompt || '').trim();
                            const mergedPrompt = composeCharacterPrompt(basePrompt, outfitPrompt);
                            if (!mergedPrompt) {
                                showToast('复制内容为空');
                                return;
                            }

                            copyPrompt(mergedPrompt);
                            return;
                        }
                    }

                    copyPrompt(btn.dataset.prompt || '');
                    return;
                }

                if (action === 'add-to-cart') {
                    const itemTabId = itemNode.dataset.tabId || '';
                    const itemGroupId = itemNode.dataset.groupId || '';
                    const itemId = itemNode.dataset.itemId || '';
                    const promptText = String(btn.dataset.prompt || '').trim();
                    if (!promptText) {
                        showToast('提示词为空，无法加入购物车');
                        return;
                    }
                    addToPromptCart({
                        sourceTab: itemTabId,
                        sourceGroupId: itemGroupId,
                        sourceItemId: itemId,
                        label: btn.dataset.cartLabel || '未命名条目',
                        prompt: promptText
                    });
                    return;
                }

                if (action === 'preview') {
                    if (editState && editState.tabId === itemNode.dataset.tabId && editState.groupId === itemNode.dataset.groupId && editState.itemId === itemNode.dataset.itemId) {
                        return;
                    }
                    const box = itemNode.querySelector('.preview-box');
                    box.classList.toggle('active');
                    return;
                }

                if (action === 'edit') {
                    const tabId = itemNode.dataset.tabId;
                    const groupId = itemNode.dataset.groupId;
                    const itemId = itemNode.dataset.itemId;
                    const categoryKey = itemNode.dataset.categoryKey || '';
                    startEdit(tabId, groupId, itemId, categoryKey);
                    return;
                }

                if (action === 'edit-inline-cancel') {
                    editState = null;
                    const tabId = itemNode.dataset.tabId;
                    renderTab(activeTab === 'chars' && tabId === 'outfit' ? 'chars' : tabId);
                    return;
                }

                if (action === 'edit-inline-save') {
                    const formNode = btn.closest('[data-inline-form="edit"]');
                    if (!formNode) {
                        return;
                    }
                    await saveInlineEditedItem(itemNode, formNode);
                    return;
                }

                if (action === 'delete') {
                    const tabId = itemNode.dataset.tabId;
                    const groupId = itemNode.dataset.groupId;
                    const itemId = itemNode.dataset.itemId;
                    const itemName = btn.dataset.itemName || '该条目';
                    if (tabId === 'outfit') {
                        await deleteOutfitEntry(itemId, itemName);
                    } else {
                        await deleteItem(tabId, groupId, itemId, itemName);
                    }
                }
            });
        });
    }

function bindCharSettingsModalEvents() {
    const modal = document.getElementById('char-settings-modal');
    const subtitle = document.getElementById('char-settings-modal-subtitle');
    const editTagsBtn = document.getElementById('char-settings-edit-tags-btn');
    const renameBtn = document.getElementById('char-settings-rename-btn');
    const deleteBtn = document.getElementById('char-settings-delete-btn');
    const editorPanel = document.getElementById('char-settings-editor');
    const editorLabel = document.getElementById('char-settings-editor-label');
    const editorInput = document.getElementById('char-settings-editor-input');
    const editorTextarea = document.getElementById('char-settings-editor-textarea');
    const editorSaveBtn = document.getElementById('char-settings-editor-save-btn');
    const editorCancelBtn = document.getElementById('char-settings-editor-cancel-btn');

    if (!modal || !editTagsBtn || !renameBtn || !deleteBtn || !subtitle || !editorPanel || !editorLabel || !editorInput || !editorTextarea || !editorSaveBtn || !editorCancelBtn) {
        return;
    }

    modal.addEventListener('click', function (event) {
        const closeBtn = event.target.closest('[data-action="close-char-settings-modal"]');
        if (!closeBtn) {
            return;
        }
        closeCharSettingsModal();
    });

    function showEditor(mode) {
        const groupId = editTagsBtn.dataset.groupId || '';
        if (!groupId) {
            return;
        }

        const group = (promptData.chars || []).find(function (item) {
            return item.id === groupId;
        });
        if (!group) {
            showToast('角色分组不存在');
            return;
        }

        editorPanel.classList.add('active');
        editorSaveBtn.dataset.mode = mode;
        editorSaveBtn.dataset.groupId = groupId;

        if (mode === 'tags') {
            editorLabel.textContent = '编辑标签';
            editorInput.style.display = 'none';
            editorTextarea.style.display = 'block';
            editorTextarea.value = (group.tags || []).join(', ');
            editorTextarea.focus();
            return;
        }

        editorLabel.textContent = '编辑角色名';
        editorTextarea.style.display = 'none';
        editorInput.style.display = 'block';
        editorInput.value = group.title || '';
        editorInput.focus();
    }

    function hideEditor() {
        editorPanel.classList.remove('active');
        editorSaveBtn.dataset.mode = '';
        editorSaveBtn.dataset.groupId = '';
    }

    editTagsBtn.addEventListener('click', function () {
        showEditor('tags');
    });

    renameBtn.addEventListener('click', function () {
        showEditor('title');
    });

    editorCancelBtn.addEventListener('click', function () {
        hideEditor();
    });

    editorInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            editorSaveBtn.click();
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            hideEditor();
        }
    });

    editorTextarea.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            hideEditor();
        }
    });

    editorSaveBtn.addEventListener('click', async function () {
        const mode = editorSaveBtn.dataset.mode || '';
        const groupId = editorSaveBtn.dataset.groupId || '';
        if (!groupId) {
            return;
        }

        if (mode === 'tags') {
            const ok = await editCharGroupTagsByValue(groupId, editorTextarea.value || '');
            if (ok) {
                hideEditor();
            }
            return;
        }

        if (mode === 'title') {
            const ok = await renameCharGroupByValue(groupId, editorInput.value || '');
            if (ok) {
                const nextGroup = (promptData.chars || []).find(function (item) {
                    return item.id === groupId;
                });
                const nextTitle = nextGroup ? nextGroup.title : '';
                subtitle.textContent = nextTitle ? ('当前角色：' + nextTitle) : '当前角色设置';
                [editTagsBtn, renameBtn, deleteBtn].forEach(function (btn) {
                    btn.dataset.groupTitle = nextTitle;
                });
                hideEditor();
            }
        }
    });

    deleteBtn.addEventListener('click', async function () {
        const groupId = deleteBtn.dataset.groupId || '';
        const groupTitle = deleteBtn.dataset.groupTitle || '';
        if (!groupId) {
            return;
        }
        closeCharSettingsModal();
        await deleteCharGroup(groupId, groupTitle);
    });
}

function openCharSettingsModal(groupId, groupTitle) {
    const modal = document.getElementById('char-settings-modal');
    const subtitle = document.getElementById('char-settings-modal-subtitle');
    const editTagsBtn = document.getElementById('char-settings-edit-tags-btn');
    const renameBtn = document.getElementById('char-settings-rename-btn');
    const deleteBtn = document.getElementById('char-settings-delete-btn');

    if (!modal || !subtitle || !editTagsBtn || !renameBtn || !deleteBtn) {
        return;
    }

    subtitle.textContent = groupTitle ? ('当前角色：' + groupTitle) : '当前角色设置';

    [editTagsBtn, renameBtn, deleteBtn].forEach(function (btn) {
        btn.dataset.groupId = groupId;
        btn.dataset.groupTitle = groupTitle || '';
    });

    const editorPanel = document.getElementById('char-settings-editor');
    const editorSaveBtn = document.getElementById('char-settings-editor-save-btn');
    if (editorPanel && editorSaveBtn) {
        editorPanel.classList.remove('active');
        editorSaveBtn.dataset.mode = '';
        editorSaveBtn.dataset.groupId = '';
    }

    modal.classList.add('active');
}

function closeCharSettingsModal() {
    const modal = document.getElementById('char-settings-modal');
    if (!modal) {
        return;
    }
    modal.classList.remove('active');

    const editorPanel = document.getElementById('char-settings-editor');
    const editorSaveBtn = document.getElementById('char-settings-editor-save-btn');
    if (editorPanel && editorSaveBtn) {
        editorPanel.classList.remove('active');
        editorSaveBtn.dataset.mode = '';
        editorSaveBtn.dataset.groupId = '';
    }
}

function bindTagFilterEvents() {
    if (charTagFilters) {
        charTagFilters.addEventListener('click', function (event) {
            const toggleBtn = event.target.closest('button[data-action="filter-tag-toggle"]');
            if (toggleBtn) {
                activeCharTagMode = activeCharTagMode === 'and' ? 'or' : 'and';
                renderCharTagFilters();
                renderTab('chars');
                return;
            }

            const clearBtn = event.target.closest('button[data-action="filter-tag-clear"]');
            if (clearBtn) {
                activeCharTags = [];
                renderCharTagFilters();
                renderTab('chars');
                return;
            }

            const tagBtn = event.target.closest('button[data-action="filter-tag"]');
            if (!tagBtn) {
                return;
            }

            const nextTag = tagBtn.dataset.tag || '';
            if (!nextTag) {
                return;
            }

            const existingIndex = activeCharTags.indexOf(nextTag);
            if (existingIndex > -1) {
                activeCharTags.splice(existingIndex, 1);
            } else {
                activeCharTags.push(nextTag);
            }
            renderCharTagFilters();
            renderTab('chars');
        });
    }

    [actionsTagFilters, envTagFilters].forEach(function (node) {
        if (!node) {
            return;
        }

        node.addEventListener('change', function (event) {
            if (node !== envTagFilters) {
                return;
            }

            const select = event.target.closest('select[data-action="filter-env-kind-select"]');
            if (!select) {
                return;
            }

            activeEnvKindFilter = String(select.value || '').trim();
            renderTaggedTabFilters('env');
            renderTab('env');
        });

        node.addEventListener('click', function (event) {
            const tabId = node === actionsTagFilters ? 'actions' : 'env';

            if (tabId === 'env') {
                return;
            }

            const toggleBtn = event.target.closest('button[data-action="filter-tagged-toggle"]');
            if (toggleBtn) {
                if (tabId === 'actions') {
                    activeActionsTagMode = activeActionsTagMode === 'and' ? 'or' : 'and';
                }
                renderTaggedTabFilters(tabId);
                renderTab(tabId);
                return;
            }

            const clearBtn = event.target.closest('button[data-action="filter-tagged-clear"]');
            if (clearBtn) {
                if (tabId === 'actions') {
                    activeActionsTags = [];
                }
                renderTaggedTabFilters(tabId);
                renderTab(tabId);
                return;
            }

            const tagBtn = event.target.closest('button[data-action="filter-tagged"]');
            if (!tagBtn) {
                return;
            }

            const nextTag = tagBtn.dataset.tag || '';
            if (!nextTag) {
                return;
            }

            const selected = activeActionsTags;
            const existingIndex = selected.indexOf(nextTag);
            if (existingIndex > -1) {
                selected.splice(existingIndex, 1);
            } else {
                selected.push(nextTag);
            }
            renderTaggedTabFilters(tabId);
            renderTab(tabId);
        });
    });

}

function bindCharSearchEvents() {
    if (!charNameSearch || !charNameSearchClear) {
        return;
    }

    charNameSearch.addEventListener('input', function () {
        activeCharKeyword = charNameSearch.value.trim().toLowerCase();
        renderTab('chars');
    });

    charNameSearchClear.addEventListener('click', function () {
        charNameSearch.value = '';
        activeCharKeyword = '';
        renderTab('chars');
    });
}

function bindCartEvents() {
    if (promptCartFab) {
        promptCartFab.addEventListener('click', function () {
            togglePromptCartPanel();
        });
    }

    if (promptCartClose) {
        promptCartClose.addEventListener('click', function () {
            togglePromptCartPanel(false);
        });
    }

    if (!promptCartList) {
        return;
    }

    promptCartList.addEventListener('click', function (event) {
        const btn = event.target.closest('button[data-action="cart-remove"]');
        if (!btn) {
            return;
        }
        removePromptCartItem(btn.dataset.cartId || '');
    });

    promptCartList.addEventListener('dragstart', function (event) {
        const itemNode = event.target.closest('.cart-item');
        if (!itemNode) {
            return;
        }
        cartDragItemId = itemNode.dataset.cartId || '';
        itemNode.classList.add('dragging');
    });

    promptCartList.addEventListener('dragend', function (event) {
        const itemNode = event.target.closest('.cart-item');
        if (itemNode) {
            itemNode.classList.remove('dragging');
        }
        cartDragItemId = '';
    });

    promptCartList.addEventListener('dragover', function (event) {
        event.preventDefault();
    });

    promptCartList.addEventListener('drop', function (event) {
        event.preventDefault();
        if (!cartDragItemId) {
            return;
        }

        const targetNode = event.target.closest('.cart-item');
        if (!targetNode) {
            movePromptCartItem(cartDragItemId, '', false);
            cartDragItemId = '';
            return;
        }

        const targetId = targetNode.dataset.cartId || '';
        if (!targetId || targetId === cartDragItemId) {
            cartDragItemId = '';
            return;
        }

        const rect = targetNode.getBoundingClientRect();
        const placeAfter = event.clientY > (rect.top + rect.height / 2);
        movePromptCartItem(cartDragItemId, targetId, placeAfter);
        cartDragItemId = '';
    });

    if (alchemyCartList) {
        alchemyCartList.addEventListener('click', function (event) {
            const btn = event.target.closest('button[data-action="alchemy-insert"]');
            if (!btn) {
                return;
            }

            const cartId = btn.dataset.cartId || '';
            const item = (cartItems || []).find(function (entry) {
                return entry.id === cartId;
            });
            if (!item || !alchemyEditor) {
                return;
            }

            const currentText = String(alchemyEditor.value || '').trim();
            const nextText = item.prompt || '';
            alchemyEditor.value = currentText ? (currentText + ', ' + nextText) : nextText;
            alchemyEditor.focus();
            showToast('已插入到提示词编辑器');
        });
    }
}
