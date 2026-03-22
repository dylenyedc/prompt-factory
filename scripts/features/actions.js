async function addCharGroupByTitle(titleRaw) {
    const title = String(titleRaw || '').trim();
    if (!title) {
        showToast('请输入角色分组名称');
        return false;
    }

    const result = await mutatePromptData('addCharGroup', { title: title });
    if (!result.ok) {
        return false;
    }

    renderTab('chars');
    showToast(result.message);
    return true;
}

async function editCharGroupTagsByValue(groupId, nextTagsRaw) {
    const nextTags = parseTags(nextTagsRaw);
    const result = await mutatePromptData('editCharGroupTags', { groupId: groupId, tags: nextTags });
    if (!result.ok) {
        return false;
    }

    const availableTags = collectCharTags();
    activeCharTags = activeCharTags.filter(function (tag) {
        return availableTags.indexOf(tag) > -1;
    });

    renderCharTagFilters();
    renderTab('chars');
    showToast(result.message);
    return true;
}

async function addCharTagByValue(groupId, nextTagRaw) {
    const nextTag = String(nextTagRaw || '').trim();
    if (!nextTag) {
        showToast('标签不能为空');
        return false;
    }

    const result = await mutatePromptData('addCharTag', { groupId: groupId, tag: nextTag });
    if (!result.ok) {
        return false;
    }

    renderCharTagFilters();
    renderTab('chars');
    showToast(result.message);
    return true;
}

function getTaggedTabEntries(tabId) {
    if (tabId !== 'actions' && tabId !== 'env') {
        return [];
    }
    return promptData[tabId] || [];
}

function findTaggedEntryById(tabId, itemId) {
    const entries = getTaggedTabEntries(tabId);
    return entries.find(function (entry) {
        return entry.id === itemId;
    }) || null;
}

function pruneTaggedFilterState(tabId) {
    const availableTags = collectTaggedTabTags(tabId);
    if (tabId === 'actions') {
        activeActionsTags = activeActionsTags.filter(function (tag) {
            return availableTags.indexOf(tag) > -1;
        });
        return;
    }

    if (tabId === 'env' && activeEnvKindFilter && availableTags.indexOf(activeEnvKindFilter) < 0) {
        activeEnvKindFilter = '';
    }
}

async function saveTaggedEntryTagsByValue(tabId, itemId, tags) {
    const entry = findTaggedEntryById(tabId, itemId);
    if (!entry) {
        showToast('条目不存在');
        return false;
    }

    const normalizedTags = tabId === 'env'
        ? [tags.indexOf('画质') > -1 ? '画质' : '环境']
        : tags;

    const result = await mutatePromptData('saveItem', {
        tabId: tabId,
        groupId: '',
        itemId: itemId,
        categoryKey: normalizedTags.join(','),
        name: entry.title || '',
        prompt: entry.prompt || ''
    });
    if (!result.ok) {
        return false;
    }

    pruneTaggedFilterState(tabId);
    renderTaggedTabFilters(tabId);
    renderTab(tabId);
    showToast(result.message);
    return true;
}

async function addTaggedTagByValue(tabId, itemId, nextTagRaw) {
    const nextTag = String(nextTagRaw || '').trim();
    if (!nextTag) {
        showToast('标签不能为空');
        return false;
    }

    const entry = findTaggedEntryById(tabId, itemId);
    if (!entry) {
        showToast('条目不存在');
        return false;
    }

    const tags = Array.isArray(entry.tags) ? entry.tags.slice() : [];
    if (tags.indexOf(nextTag) > -1) {
        showToast('该标签已存在');
        return false;
    }

    tags.push(nextTag);
    return saveTaggedEntryTagsByValue(tabId, itemId, tags);
}

async function editTaggedTagByValue(tabId, itemId, oldTag, nextTagRaw) {
    const nextTag = String(nextTagRaw || '').trim();
    if (!nextTag) {
        showToast('标签不能为空');
        return false;
    }

    const entry = findTaggedEntryById(tabId, itemId);
    if (!entry) {
        showToast('条目不存在');
        return false;
    }

    const tags = Array.isArray(entry.tags) ? entry.tags.slice() : [];
    const index = tags.indexOf(oldTag);
    if (index < 0) {
        showToast('标签不存在');
        return false;
    }
    if (oldTag !== nextTag && tags.indexOf(nextTag) > -1) {
        showToast('该标签已存在');
        return false;
    }

    tags[index] = nextTag;
    if (tabId === 'actions') {
        activeActionsTags = activeActionsTags.map(function (tag) {
            return tag === oldTag ? nextTag : tag;
        });
    }
    return saveTaggedEntryTagsByValue(tabId, itemId, tags);
}

async function deleteTaggedTagByValue(tabId, itemId, oldTag) {
    const entry = findTaggedEntryById(tabId, itemId);
    if (!entry) {
        showToast('条目不存在');
        return false;
    }

    const tags = Array.isArray(entry.tags) ? entry.tags.filter(function (tag) {
        return tag !== oldTag;
    }) : [];

    if (tabId === 'actions') {
        activeActionsTags = activeActionsTags.filter(function (tag) {
            return tag !== oldTag;
        });
    }

    return saveTaggedEntryTagsByValue(tabId, itemId, tags);
}

async function editCharTagByValue(groupId, oldTag, nextTagRaw) {
    const nextTag = String(nextTagRaw || '').trim();
    if (!nextTag) {
        showToast('标签不能为空');
        return false;
    }

    const result = await mutatePromptData('editCharTag', {
        groupId: groupId,
        oldTag: oldTag,
        nextTag: nextTag
    });
    if (!result.ok) {
        return false;
    }

    activeCharTags = activeCharTags.map(function (tag) {
        return tag === oldTag ? nextTag : tag;
    });

    renderCharTagFilters();
    renderTab('chars');
    showToast(result.message);
    return true;
}

async function deleteCharTagByValue(groupId, oldTag) {
    const result = await mutatePromptData('deleteCharTag', {
        groupId: groupId,
        tag: oldTag
    });
    if (!result.ok) {
        return false;
    }

    activeCharTags = activeCharTags.filter(function (tag) {
        return tag !== oldTag;
    });

    renderCharTagFilters();
    renderTab('chars');
    showToast(result.message);
    return true;
}

async function renameCharGroupByValue(groupId, nextTitleRaw) {
    const nextTitle = String(nextTitleRaw || '').trim();
    if (!nextTitle) {
        showToast('角色名称不能为空');
        return false;
    }

    const result = await mutatePromptData('renameCharGroup', {
        groupId: groupId,
        title: nextTitle
    });
    if (!result.ok) {
        return false;
    }

    renderTab('chars');
    showToast(result.message);
    return true;
}

async function saveCharDescriptionByValue(groupId, descriptionRaw) {
    const description = String(descriptionRaw || '').trim();
    if (!description) {
        showToast('角色描述不能为空');
        return false;
    }

    const result = await mutatePromptData('saveCharDescription', {
        groupId: groupId,
        description: description
    });
    if (!result.ok) {
        return false;
    }

    renderTab('chars');
    showToast(result.message);
    return true;
}

async function deleteCharGroup(groupId, groupTitle) {
    const groups = promptData.chars || [];
    const targetGroup = groups.find(group => group.id === groupId);
    if (!targetGroup) {
        showToast('角色分组不存在');
        return;
    }

    const hasItems = (targetGroup.items || []).length > 0;
    const confirmText = hasItems
        ? '确认删除角色“' + (groupTitle || targetGroup.title) + '”吗？该角色下的提示词也会一并删除。'
        : '确认删除角色“' + (groupTitle || targetGroup.title) + '”吗？';

    if (!window.confirm(confirmText)) {
        return;
    }

    const result = await mutatePromptData('deleteCharGroup', { groupId: groupId });
    if (!result.ok) {
        return;
    }

    if (editState && editState.tabId === 'chars' && editState.groupId === groupId) {
        editState = null;
    }
    if (addState && addState.tabId === 'chars' && addState.groupId === groupId) {
        addState = null;
    }

    renderTab('chars');
    showToast(result.message);
}

async function deleteItem(tabId, groupId, itemId, itemName) {
    if (tabId === 'outfit') {
        return;
    }

    if (!window.confirm('确认删除条目“' + itemName + '”吗？')) {
        return;
    }

    const result = await mutatePromptData('deleteItem', {
        tabId: tabId,
        groupId: (tabId === 'actions' || tabId === 'env') ? '' : groupId,
        itemId: itemId
    });
    if (!result.ok) {
        return;
    }

    if (editState && editState.itemId === itemId && editState.groupId === groupId && editState.tabId === tabId) {
        editState = null;
    }

    if (tabId === 'actions' || tabId === 'env') {
        pruneTaggedFilterState(tabId);
        renderTaggedTabFilters(tabId);
    }

    renderTab(tabId);
    showToast(result.message);
}

async function saveInlineEditedItem(itemNode, formNode) {
    const tabId = itemNode.dataset.tabId;
    const itemId = itemNode.dataset.itemId;
    let result = null;

    if (tabId === 'outfit') {
        const titleInput = formNode.querySelector('.inline-item-name');
        const partInput = formNode.querySelector('.inline-outfit-part');
        const styleInput = formNode.querySelector('.inline-outfit-style');
        const sourceInput = formNode.querySelector('.inline-outfit-source');
        const safetyInput = formNode.querySelector('.inline-outfit-safety');
        const otherInput = formNode.querySelector('.inline-outfit-other');
        const promptInput = formNode.querySelector('.inline-item-prompt');
        const payload = {
            outfitId: itemId,
            title: titleInput ? titleInput.value.trim() : '',
            part: partInput ? partInput.value.trim() : '未知',
            style: styleInput ? styleInput.value.trim() : '',
            sourceCharacter: sourceInput ? sourceInput.value.trim() : '无',
            safety: safetyInput ? safetyInput.value.trim() : 'SFW',
            other: otherInput ? otherInput.value.trim() : '',
            prompt: promptInput ? promptInput.value.trim() : ''
        };
        if (!payload.title || !payload.prompt) {
            showToast('请填写完整信息');
            return;
        }
        result = await mutatePromptData('saveOutfitEntry', payload);
    } else {
        const groupId = itemNode.dataset.groupId;
        const nameInput = formNode.querySelector('.inline-item-name');
        const tagsInput = formNode.querySelector('.inline-item-tags');
        const tagsSelect = formNode.querySelector('[data-role="env-kind"]') || formNode.querySelector('.inline-item-tags-select');
        const promptInput = formNode.querySelector('.inline-item-prompt');
        const name = nameInput ? nameInput.value.trim() : '';
        const tags = tabId === 'env'
            ? [String(tagsSelect ? tagsSelect.value : '环境').trim() === '画质' ? '画质' : '环境']
            : parseTags(tagsInput ? tagsInput.value : '');
        const prompt = promptInput ? promptInput.value.trim() : '';

        if (!name || !prompt) {
            showToast('请填写完整信息');
            return;
        }

        result = await mutatePromptData('saveItem', {
            tabId: tabId,
            groupId: (tabId === 'actions' || tabId === 'env') ? '' : groupId,
            itemId: itemId,
            categoryKey: tags.join(','),
            name: name,
            prompt: prompt
        });
    }

    if (!result.ok) {
        return;
    }

    if (tabId === 'actions' || tabId === 'env') {
        pruneTaggedFilterState(tabId);
        renderTaggedTabFilters(tabId);
    }

    editState = null;
    renderTab(activeTab === 'chars' && tabId === 'outfit' ? 'chars' : tabId);
    showToast(result.message);
}

async function saveInlineAddedItem(formNode) {
    const tabId = formNode.dataset.tabId;
    const groupId = formNode.dataset.groupId;
    const categoryKey = formNode.dataset.categoryKey || '';
    const nameInput = formNode.querySelector('.inline-item-name');
    const promptInput = formNode.querySelector('.inline-item-prompt');
    const name = nameInput ? nameInput.value.trim() : '';
    const prompt = promptInput ? promptInput.value.trim() : '';

    if (!tabId || !groupId || !name || !prompt) {
        showToast('请填写完整信息');
        return;
    }

    const result = await mutatePromptData('addItem', {
        tabId: tabId,
        groupId: groupId,
        categoryKey: categoryKey,
        name: name,
        prompt: prompt
    });
    if (!result.ok) {
        return;
    }

    addState = null;
    renderTab(tabId);
    showToast(result.message);
}

function startEdit(tabId, groupId, itemId, categoryKey) {
    const resolvedCategoryKey = categoryKey || '';
    const keepCharsView = activeTab === 'chars' && tabId === 'outfit';

    if (!keepCharsView) {
        activeTab = tabId;
    }

    const group = (promptData[tabId] || []).find(g => g.id === groupId);
    let item = null;
    if (tabId === 'outfit') {
        item = (promptData.outfit || []).find(function (entry) {
            return entry.id === itemId;
        }) || null;
    } else if (tabId === 'actions' || tabId === 'env') {
        item = (promptData[tabId] || []).find(function (entry) {
            return entry.id === itemId;
        }) || null;
    } else {
        item = group ? group.items.find(i => i.id === itemId) : null;
    }

    const isSingleLevelTab = tabId === 'outfit' || tabId === 'actions' || tabId === 'env';
    const missingTarget = isSingleLevelTab ? !item : (!group || !item);
    if (missingTarget) {
        showToast('找不到要编辑的条目');
        return;
    }

    editState = { tabId: tabId, groupId: groupId, itemId: itemId, categoryKey: resolvedCategoryKey };
    addState = null;
    renderTab(keepCharsView ? 'chars' : tabId);
}

function switchTab(tabId, element) {
    activeTab = tabId;
    switchToTab(tabId, element);
    editState = null;
    addState = null;
    activeCharTagEditor = null;
    activeTaggedTagEditor = null;
    if (tabId === 'chars') {
        renderCharTagFilters();
        return;
    }
    if (tabId === 'actions' || tabId === 'env') {
        renderTaggedTabFilters(tabId);
    }
}

async function addOutfitEntry() {
    const title = outfitGroupTitleInput ? outfitGroupTitleInput.value.trim() : '';
    const part = outfitPartInput ? outfitPartInput.value.trim() : '未知';
    const style = outfitStyleInput ? outfitStyleInput.value.trim() : '';
    const sourceCharacter = outfitSourceCharacterInput ? outfitSourceCharacterInput.value.trim() : '无';
    const safety = outfitSafetyInput ? outfitSafetyInput.value.trim() : 'SFW';
    const other = outfitOtherInput ? outfitOtherInput.value.trim() : '';
    const prompt = outfitPromptInput ? outfitPromptInput.value.trim() : '';
    if (!title) {
        showToast('请输入服装条目名称');
        return false;
    }

    if (!prompt) {
        showToast('请输入提示词内容');
        return false;
    }

    const result = await mutatePromptData('addOutfitEntry', {
        title: title,
        part: part || '未知',
        style: style,
        sourceCharacter: sourceCharacter || '无',
        safety: safety || 'SFW',
        other: other,
        prompt: prompt
    });

    if (!result.ok) {
        return false;
    }

    if (outfitGroupTitleInput) {
        outfitGroupTitleInput.value = '';
    }
    if (outfitStyleInput) {
        outfitStyleInput.value = '';
    }
    if (outfitSourceCharacterInput) {
        outfitSourceCharacterInput.value = '无';
    }
    if (outfitSafetyInput) {
        outfitSafetyInput.value = 'SFW';
    }
    if (outfitOtherInput) {
        outfitOtherInput.value = '';
    }
    if (outfitPromptInput) {
        outfitPromptInput.value = '';
    }
    renderTab('outfit');
    showToast(result.message);
    return true;
}

async function addTaggedEntry(tabId, titleRaw, tagsRaw, promptRaw) {
    const title = String(titleRaw || '').trim();
    const prompt = String(promptRaw || '').trim();
    const tags = parseTags(tagsRaw || '');

    if (!title) {
        showToast('请输入条目名称');
        return false;
    }
    if (!prompt) {
        showToast('请输入提示词内容');
        return false;
    }

    const result = await mutatePromptData('addItem', {
        tabId: tabId,
        groupId: '',
        categoryKey: tags.join(','),
        name: title,
        prompt: prompt
    });
    if (!result.ok) {
        return false;
    }

    renderTab(tabId);
    showToast(result.message);
    return true;
}

async function addActionEntry() {
    const ok = await addTaggedEntry(
        'actions',
        actionItemTitleInput ? actionItemTitleInput.value : '',
        actionItemTagsInput ? actionItemTagsInput.value : '',
        actionItemPromptInput ? actionItemPromptInput.value : ''
    );

    if (!ok) {
        return false;
    }

    if (actionItemTitleInput) {
        actionItemTitleInput.value = '';
    }
    if (actionItemTagsInput) {
        actionItemTagsInput.value = '';
    }
    if (actionItemPromptInput) {
        actionItemPromptInput.value = '';
    }
    return true;
}

async function addEnvEntry() {
    const kind = envItemKindInput ? String(envItemKindInput.value || '环境').trim() : '环境';
    const ok = await addTaggedEntry(
        'env',
        envItemTitleInput ? envItemTitleInput.value : '',
        kind === '画质' ? '画质' : '环境',
        envItemPromptInput ? envItemPromptInput.value : ''
    );

    if (!ok) {
        return false;
    }

    if (envItemTitleInput) {
        envItemTitleInput.value = '';
    }
    if (envItemKindInput) {
        envItemKindInput.value = '环境';
    }
    if (envItemPromptInput) {
        envItemPromptInput.value = '';
    }
    return true;
}

async function saveEnvKindByValue(itemId, nextKindRaw) {
    const nextKind = String(nextKindRaw || '').trim() === '画质' ? '画质' : '环境';
    return saveTaggedEntryTagsByValue('env', itemId, [nextKind]);
}

async function deleteOutfitEntry(outfitId, outfitTitle) {
    if (!window.confirm('确认删除服装条目“' + (outfitTitle || '该条目') + '”吗？')) {
        return;
    }

    const result = await mutatePromptData('deleteOutfitEntry', {
        outfitId: outfitId
    });
    if (!result.ok) {
        return;
    }

    if (editState && editState.tabId === 'outfit' && editState.itemId === outfitId) {
        editState = null;
    }

    renderTab('outfit');
    showToast(result.message);
}

function normalizePromptCartItems(items) {
    const list = Array.isArray(items) ? items : [];
    return list.map(function (item) {
        const sourceTab = String(item && item.sourceTab || '').trim();
        return {
            id: String(item && item.id || '').trim() || newId(),
            sourceTab: TAB_KEYS.indexOf(sourceTab) > -1 ? sourceTab : 'chars',
            sourceGroupId: String(item && item.sourceGroupId || '').trim(),
            sourceItemId: String(item && item.sourceItemId || '').trim(),
            label: String(item && item.label || '').trim() || '未命名条目',
            prompt: String(item && item.prompt || '').trim()
        };
    }).filter(function (item) {
        return !!item.prompt;
    });
}

function getPromptCartStorageKey() {
    const scope = String(currentUserId || '').trim() || 'guest';
    return 'sd_prompt_cart_' + scope;
}

function savePromptCartToLocal() {
    try {
        localStorage.setItem(getPromptCartStorageKey(), JSON.stringify(cartItems));
    } catch (_) {
    }
}

function loadPromptCartFromLocal() {
    try {
        const raw = localStorage.getItem(getPromptCartStorageKey());
        return normalizePromptCartItems(raw ? JSON.parse(raw) : []);
    } catch (_) {
        return [];
    }
}

function setPromptCartItems(nextItems, shouldPersistRemote) {
    cartItems = normalizePromptCartItems(nextItems);
    renderPromptCart();
    savePromptCartToLocal();
    if (shouldPersistRemote) {
        persistPromptCartRemote();
    }
}

async function persistPromptCartRemote() {
    if (isReadOnlyMode || !hasAuthSession()) {
        return;
    }
    const result = await updateMyCart(cartItems);
    if (result && result.ok) {
        cartItems = normalizePromptCartItems(result.cartItems);
        renderPromptCart();
        savePromptCartToLocal();
    }
}

function initPromptCartState() {
    if (hasAuthSession() && !isReadOnlyMode) {
        setPromptCartItems(cartItems, false);
        return;
    }

    setPromptCartItems(loadPromptCartFromLocal(), false);
}

function addToPromptCart(payload) {
    const entry = normalizePromptCartItems([payload])[0];
    if (!entry) {
        showToast('无法加入购物车：提示词为空');
        return;
    }

    const duplicated = cartItems.some(function (item) {
        return item.label === entry.label && item.prompt === entry.prompt;
    });
    if (duplicated) {
        showToast('该条目已在购物车中');
        togglePromptCartPanel(true);
        return;
    }

    const nextItems = cartItems.concat([entry]);
    setPromptCartItems(nextItems, true);
    showToast('已加入购物车');
    togglePromptCartPanel(true);
}

function removePromptCartItem(cartId) {
    const nextItems = cartItems.filter(function (item) {
        return item.id !== cartId;
    });
    if (nextItems.length === cartItems.length) {
        return;
    }
    setPromptCartItems(nextItems, true);
    showToast('已从购物车移除');
}

function movePromptCartItem(dragId, targetId, placeAfter) {
    const fromIndex = cartItems.findIndex(function (item) { return item.id === dragId; });
    if (fromIndex < 0) {
        return;
    }

    const movingItem = cartItems[fromIndex];
    const remaining = cartItems.filter(function (item) {
        return item.id !== dragId;
    });

    if (!targetId) {
        remaining.push(movingItem);
        setPromptCartItems(remaining, true);
        return;
    }

    const targetIndex = remaining.findIndex(function (item) { return item.id === targetId; });
    if (targetIndex < 0) {
        return;
    }

    const insertIndex = placeAfter ? targetIndex + 1 : targetIndex;
    remaining.splice(insertIndex, 0, movingItem);
    setPromptCartItems(remaining, true);
}

function togglePromptCartPanel(forceOpen) {
    if (!promptCartPanel) {
        return;
    }

    const willOpen = typeof forceOpen === 'boolean'
        ? forceOpen
        : !promptCartPanel.classList.contains('active');
    promptCartPanel.classList.toggle('active', willOpen);
}

function copyPrompt(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast();
        }).catch(() => {
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

function composeCharacterPrompt(basePrompt, outfitPrompt) {
    const base = String(basePrompt || '').trim();
    const outfit = String(outfitPrompt || '').trim();

    if (!base) {
        return '';
    }

    if (!outfit) {
        return base;
    }

    return base + ', ' + outfit;
}

function fallbackCopyTextToClipboard(text) {
    var textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast();
    } catch (err) {
        alert('复制失败，请手动复制');
    }
    document.body.removeChild(textArea);
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (message) {
        toast.textContent = message;
    } else {
        toast.textContent = '已复制到剪贴板';
    }
    toast.style.opacity = '1';
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
    }, 2000);
}
