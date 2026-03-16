function bindGroupEvents() {
    charGroupAddBtn.addEventListener('click', async function () {
        const title = charGroupTitleInput.value.trim();
        const ok = await addCharGroupByTitle(title);
        if (ok) {
            charGroupTitleInput.value = '';
        }
    });

    if (outfitGroupAddBtn) {
        outfitGroupAddBtn.addEventListener('click', async function () {
            await addOutfitGroup();
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

            if (action === 'rename-group') {
                activeCharGroupMenuId = null;
                await renameCharGroup(btn.dataset.groupId, btn.dataset.groupTitle || '');
                return;
            }

            if (action === 'edit-tags') {
                activeCharGroupMenuId = null;
                await editCharGroupTags(btn.dataset.groupId);
                return;
            }

            if (action === 'delete-group') {
                activeCharGroupMenuId = null;
                await deleteCharGroup(btn.dataset.groupId, btn.dataset.groupTitle || '');
                return;
            }

            if (action === 'rename-outfit-group') {
                await renameOutfitGroup(btn.dataset.groupId, btn.dataset.groupTitle || '');
                return;
            }

            if (action === 'delete-outfit-group') {
                await deleteOutfitGroup(btn.dataset.groupId, btn.dataset.groupTitle || '');
                return;
            }

            if (action === 'add-item-start') {
                addState = { tabId: btn.dataset.tabId, groupId: btn.dataset.groupId };
                editState = null;
                renderTab(btn.dataset.tabId);
                return;
            }

            if (action === 'add-outfit-item-start') {
                addState = { tabId: 'outfit', groupId: btn.dataset.groupId, categoryKey: btn.dataset.categoryKey || '' };
                editState = null;
                renderTab('outfit');
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
                copyPrompt(btn.dataset.prompt || '');
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
                renderTab(itemNode.dataset.tabId);
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
                const categoryKey = itemNode.dataset.categoryKey || '';
                const itemName = btn.dataset.itemName || '该条目';
                if (tabId === 'outfit') {
                    await deleteOutfitItem(groupId, categoryKey, itemId, itemName);
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

    activeCharGroupMenuId = groupId;
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
    activeCharGroupMenuId = null;
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
    if (!charTagFilters) {
        if (!outfitCategoryFilters) {
            return;
        }
    }

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

    if (outfitCategoryFilters) {
        outfitCategoryFilters.addEventListener('click', function (event) {
            const btn = event.target.closest('button[data-action="filter-outfit-category"]');
            if (!btn) {
                return;
            }

            activeOutfitCategory = btn.dataset.category || '__all__';
            renderOutfitCategoryFilters();
            renderTab('outfit');
        });
    }
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
