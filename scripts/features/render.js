function renderAllTabs() {
    renderCharTagFilters();
    renderTaggedTabFilters('actions');
    renderTaggedTabFilters('env');
    renderTab('chars');
    renderTab('actions');
    renderTab('env');
    renderTab('outfit');
    renderPromptCart();
    renderAlchemyWorkbench();
}

function getTabDisplayLabel(tabId) {
    if (tabId === 'actions') {
        return '动作';
    }
    if (tabId === 'env') {
        return '环境';
    }
    if (tabId === 'outfit') {
        return '服装';
    }
    return '角色';
}

function renderPromptCart() {
    if (!promptCartList || !promptCartCount) {
        return;
    }

    const total = Array.isArray(cartItems) ? cartItems.length : 0;
    promptCartCount.textContent = String(total);

    if (!total) {
        promptCartList.innerHTML = '<div class="hint-text">购物车是空的，点击“加入购物车”收集提示词。</div>';
        return;
    }

    promptCartList.innerHTML = cartItems.map(function (item) {
        return '<div class="cart-item" draggable="true" data-cart-id="' + escapeAttr(item.id) + '">'
            + '<div class="cart-item-head">'
            + '<span class="cart-item-title">[' + escapeHtml(getTabDisplayLabel(item.sourceTab)) + '] ' + escapeHtml(item.label || '未命名条目') + '</span>'
            + '<div class="cart-item-actions">'
            + '<button class="copy-btn secondary-btn cart-drag-handle" data-action="cart-drag-handle" type="button">拖动</button>'
            + '<button class="copy-btn danger-btn" data-action="cart-remove" data-cart-id="' + escapeAttr(item.id) + '" type="button">移除</button>'
            + '</div></div>'
            + '<div class="cart-item-prompt">' + escapeHtml(item.prompt || '') + '</div>'
            + '</div>';
    }).join('');
}

function renderAlchemyWorkbench() {
    if (!alchemyCartList) {
        return;
    }

    const total = Array.isArray(cartItems) ? cartItems.length : 0;
    if (!total) {
        alchemyCartList.innerHTML = '<div class="hint-text">购物车为空，请先在提示词页面加入条目。</div>';
        return;
    }

    alchemyCartList.innerHTML = cartItems.map(function (item) {
        return '<div class="alchemy-cart-item" data-cart-id="' + escapeAttr(item.id) + '">'
            + '<div class="alchemy-cart-item-head">'
            + '<span class="alchemy-cart-item-title">[' + escapeHtml(getTabDisplayLabel(item.sourceTab)) + '] ' + escapeHtml(item.label || '未命名条目') + '</span>'
            + '<button class="copy-btn secondary-btn" data-action="alchemy-insert" data-cart-id="' + escapeAttr(item.id) + '" type="button">插入</button>'
            + '</div>'
            + '<div class="alchemy-cart-item-prompt">' + escapeHtml(item.prompt || '') + '</div>'
            + '</div>';
    }).join('');
}

function getManageDeniedReason(ownerUserId) {
    if (isReadOnlyMode || !currentUserId) {
        return '当前为只读模式，请先使用 GitHub 登录';
    }
    if (isAdminUser) {
        return '';
    }
    return String(ownerUserId || '') === String(currentUserId || '')
        ? ''
        : '仅管理员可编辑或删除其他用户上传的数据';
}

function getReadOnlyButtonAttr(ownerUserId) {
    const deniedReason = getManageDeniedReason(ownerUserId);
    if (!deniedReason) {
        return '';
    }
    return ' disabled data-readonly="1" title="' + escapeAttr(deniedReason) + '"';
}

function getReadOnlyInputAttr(ownerUserId) {
    const deniedReason = getManageDeniedReason(ownerUserId);
    return deniedReason ? ' disabled data-readonly="1"' : '';
}

function formatOutfitDisplayName(entry) {
    const title = String(entry && entry.title ? entry.title : '未命名服装').trim() || '未命名服装';
    const sourceCharacter = String(entry && entry.sourceCharacter ? entry.sourceCharacter : '').trim();
    if (!sourceCharacter || sourceCharacter === '无') {
        return title;
    }
    return title + '（' + sourceCharacter + '）';
}

function renderOutfitPromptItem(entry, showMeta) {
    const ownerUserId = entry.ownerUserId || '';
    const readOnlyButtonAttr = getReadOnlyButtonAttr(ownerUserId);
    const readOnlyInputAttr = getReadOnlyInputAttr(ownerUserId);
    const isEditing = !!editState && editState.tabId === 'outfit' && editState.itemId === entry.id;
    const partText = String(entry.part || '').trim() || '未知';
    const styleText = String(entry.style || '').trim() || '无';
    const sourceText = String(entry.sourceCharacter || '').trim() || '无';
    const safetyText = String(entry.safety || 'SFW').trim().toUpperCase() === 'NSFW' ? 'NSFW' : 'SFW';
    const otherText = String(entry.other || '').trim() || '无';
    const previewHtml = isEditing
        ? '<div class="preview-box active"><div class="inline-item-form outfit-edit-form" data-inline-form="edit">'
            + '<input class="inline-item-name" type="text" value="' + escapeAttr(entry.title || '') + '" placeholder="条目名称"' + readOnlyInputAttr + ' />'
            + '<select class="inline-outfit-part"' + readOnlyInputAttr + '>' + OUTFIT_PART_OPTIONS.map(function (option) { return '<option value="' + escapeAttr(option) + '"' + (option === partText ? ' selected' : '') + '>' + escapeHtml(option) + '</option>'; }).join('') + '</select>'
            + '<input class="inline-outfit-style" type="text" value="' + escapeAttr(entry.style || '') + '" placeholder="风格"' + readOnlyInputAttr + ' />'
            + '<input class="inline-outfit-source" type="text" value="' + escapeAttr(sourceText) + '" placeholder="来源角色（没有请填无）"' + readOnlyInputAttr + ' />'
            + '<select class="inline-outfit-safety"' + readOnlyInputAttr + '><option value="SFW"' + (safetyText === 'SFW' ? ' selected' : '') + '>SFW</option><option value="NSFW"' + (safetyText === 'NSFW' ? ' selected' : '') + '>NSFW</option></select>'
            + '<input class="inline-outfit-other" type="text" value="' + escapeAttr(entry.other || '') + '" placeholder="其他标签"' + readOnlyInputAttr + ' />'
            + '<textarea class="inline-item-prompt" placeholder="提示词内容"' + readOnlyInputAttr + '>' + escapeHtml(entry.prompt || '') + '</textarea>'
            + '<div class="form-actions"><button class="copy-btn" data-action="edit-inline-save"' + readOnlyButtonAttr + '>保存</button><button class="copy-btn secondary-btn" data-action="edit-inline-cancel">取消</button></div>'
            + '</div></div>'
        : '<div class="preview-box">' + escapeHtml(entry.prompt || '') + '</div>';
    const metaHtml = showMeta
        ? '<div class="outfit-meta-grid">'
            + '<div class="outfit-meta-item"><span class="outfit-meta-label">部位</span><span class="outfit-meta-value">' + escapeHtml(partText) + '</span></div>'
            + '<div class="outfit-meta-item"><span class="outfit-meta-label">风格</span><span class="outfit-meta-value">' + escapeHtml(styleText) + '</span></div>'
            + '<div class="outfit-meta-item"><span class="outfit-meta-label">来源角色</span><span class="outfit-meta-value">' + escapeHtml(sourceText) + '</span></div>'
            + '<div class="outfit-meta-item"><span class="outfit-meta-label">安全性</span><span class="outfit-meta-value">' + escapeHtml(safetyText) + '</span></div>'
            + '<div class="outfit-meta-item outfit-meta-item-wide"><span class="outfit-meta-label">其他</span><span class="outfit-meta-value">' + escapeHtml(otherText) + '</span></div>'
            + '</div>'
        : '';

    return '<div class="prompt-item" data-item-id="' + entry.id + '" data-group-id="' + entry.id + '" data-tab-id="outfit">'
        + '<div class="prompt-main">'
        + '<span class="prompt-name">' + escapeHtml(formatOutfitDisplayName(entry)) + '</span>'
        + '<div class="prompt-actions">'
        + '<button class="copy-btn" data-action="copy" data-prompt="' + escapeAttr(entry.prompt || '') + '">复制</button>'
        + '<button class="copy-btn secondary-btn" data-action="add-to-cart" data-cart-label="' + escapeAttr(formatOutfitDisplayName(entry)) + '" data-prompt="' + escapeAttr(entry.prompt || '') + '">加入购物车</button>'
        + '<button class="copy-btn secondary-btn" data-action="edit"' + readOnlyButtonAttr + '>编辑</button>'
        + '<button class="copy-btn secondary-btn" data-action="preview">预览</button>'
        + '<button class="copy-btn danger-btn" data-action="delete" data-item-name="' + escapeAttr(formatOutfitDisplayName(entry)) + '"' + readOnlyButtonAttr + '>删除</button>'
        + '</div></div>'
        + metaHtml
        + previewHtml
        + '</div>';
}

function renderTab(tabId) {
    const listNode = document.getElementById('list-' + tabId);
    const groups = promptData[tabId] || [];

    if (tabId === 'chars') {
        const visibleGroups = getVisibleCharGroups(groups);
        renderCharsTab(listNode, groups, visibleGroups);
        return;
    }

    if (tabId === 'outfit') {
        renderOutfitTab(listNode, groups);
        return;
    }

    if (tabId === 'actions' || tabId === 'env') {
        renderTaggedTab(tabId, listNode, groups);
        return;
    }

    const visibleGroups = groups;

    listNode.innerHTML = visibleGroups.map(group => {
        const groupOwnerUserId = group.ownerUserId || '';
        const itemsHtml = group.items.map(item => {
            const isEditing = !!editState && editState.tabId === tabId && editState.groupId === group.id && editState.itemId === item.id;
            const itemOwnerUserId = item.ownerUserId || groupOwnerUserId;
            const readOnlyButtonAttr = getReadOnlyButtonAttr(itemOwnerUserId);
            const readOnlyInputAttr = getReadOnlyInputAttr(itemOwnerUserId);
            const previewHtml = isEditing
                ? '<div class="preview-box active"><div class="inline-item-form" data-inline-form="edit"><input class="inline-item-name" type="text" value="' + escapeAttr(item.name) + '" placeholder="条目名称"' + readOnlyInputAttr + ' /><textarea class="inline-item-prompt" placeholder="提示词内容"' + readOnlyInputAttr + '>' + escapeHtml(item.prompt) + '</textarea><div class="form-actions"><button class="copy-btn" data-action="edit-inline-save"' + readOnlyButtonAttr + '>保存</button><button class="copy-btn secondary-btn" data-action="edit-inline-cancel">取消</button></div></div></div>'
                : '<div class="preview-box">' + escapeHtml(item.prompt) + '</div>';

            return '\n                        <div class="prompt-item" data-item-id="' + item.id + '" data-group-id="' + group.id + '" data-tab-id="' + tabId + '">\n                            <div class="prompt-main">\n                                <span class="prompt-name">' + escapeHtml(item.name) + '</span>\n                                <div class="prompt-actions">\n                                    <button class="copy-btn" data-action="copy" data-prompt="' + escapeAttr(item.prompt) + '">复制</button>\n                                    <button class="copy-btn secondary-btn" data-action="add-to-cart" data-cart-label="' + escapeAttr(item.name) + '" data-prompt="' + escapeAttr(item.prompt) + '">加入购物车</button>\n                                    <button class="copy-btn secondary-btn" data-action="edit"' + readOnlyButtonAttr + '>编辑</button>\n                                    <button class="copy-btn secondary-btn" data-action="preview">预览</button>\n                                    <button class="copy-btn danger-btn" data-action="delete" data-item-name="' + escapeAttr(item.name) + '"' + readOnlyButtonAttr + '>删除</button>\n                                </div>\n                            </div>\n                            ' + previewHtml + '\n                        </div>\n                    ';
        }).join('');

        const content = itemsHtml || '<div class="hint-text">当前菜单暂无分组，请先新增分组。</div>';
        const groupReadOnlyButtonAttr = getReadOnlyButtonAttr(groupOwnerUserId);
        const groupReadOnlyInputAttr = getReadOnlyInputAttr(groupOwnerUserId);
        const commonAddBtn = '<button class="copy-btn" data-action="add-item-start" data-tab-id="' + tabId + '" data-group-id="' + group.id + '"' + groupReadOnlyButtonAttr + '>新增提示词</button>';
        const groupManageBtns = '';
        const groupActionHtml = '<div class="group-actions">' + commonAddBtn + groupManageBtns + '</div>';
        const addFormHtml = (addState && addState.tabId === tabId && addState.groupId === group.id)
            ? '<div class="inline-item-form" data-inline-form="add" data-tab-id="' + tabId + '" data-group-id="' + group.id + '"><input class="inline-item-name" type="text" placeholder="输入条目名称"' + groupReadOnlyInputAttr + ' /><textarea class="inline-item-prompt" placeholder="输入完整提示词"' + groupReadOnlyInputAttr + '></textarea><div class="form-actions"><button class="copy-btn" data-action="add-item-save"' + groupReadOnlyButtonAttr + '>保存新增</button><button class="copy-btn secondary-btn" data-action="add-item-cancel">取消</button></div></div>'
            : '';
        const tagsHtml = '';
        const uploaderHtml = '';
        const titleHtml = '<div><div class="card-title">' + escapeHtml(group.title) + '</div>' + uploaderHtml + '</div>';

        return '\n                    <div class="card">\n                        <div class="card-header">\n                            ' + titleHtml + '\n                            ' + groupActionHtml + '\n                        </div>\n                        ' + tagsHtml + '\n                        ' + content + '\n                        ' + addFormHtml + '\n                    </div>\n                ';
    }).join('');

    if (!groups.length) {
        listNode.innerHTML = '<div class="card"><div class="hint-text">当前菜单暂无分组，请先新增分组。</div></div>';
        return;
    }

}

function renderTaggedPromptItem(tabId, entry) {
    const ownerUserId = entry.ownerUserId || '';
    const readOnlyButtonAttr = getReadOnlyButtonAttr(ownerUserId);
    const readOnlyInputAttr = getReadOnlyInputAttr(ownerUserId);
    const isEditing = !!editState && editState.tabId === tabId && editState.itemId === entry.id;
    const tags = Array.isArray(entry.tags) ? entry.tags : [];
    const envKind = tabId === 'env' ? resolveEnvKind(tags) : '';
    const tagsText = tags.length ? tags.join(', ') : '';
    const previewHtml = isEditing
        ? '<div class="preview-box active"><div class="inline-item-form" data-inline-form="edit">'
            + '<input class="inline-item-name" type="text" value="' + escapeAttr(entry.title || '') + '" placeholder="条目名称"' + readOnlyInputAttr + ' />'
            + (tabId === 'env'
                ? '<select class="inline-item-tags-select" data-role="env-kind"' + readOnlyInputAttr + '><option value="环境"' + (envKind === '环境' ? ' selected' : '') + '>环境</option><option value="画质"' + (envKind === '画质' ? ' selected' : '') + '>画质</option></select>'
                : '<input class="inline-item-tags" type="text" value="' + escapeAttr(tagsText) + '" placeholder="标签（逗号分隔）"' + readOnlyInputAttr + ' />')
            + '<textarea class="inline-item-prompt" placeholder="提示词内容"' + readOnlyInputAttr + '>' + escapeHtml(entry.prompt || '') + '</textarea>'
            + '<div class="form-actions"><button class="copy-btn" data-action="edit-inline-save"' + readOnlyButtonAttr + '>保存</button><button class="copy-btn secondary-btn" data-action="edit-inline-cancel">取消</button></div>'
            + '</div></div>'
        : '<div class="preview-box">' + escapeHtml(entry.prompt || '') + '</div>';
    const metaHtml = '<div class="outfit-meta-grid">'
        + '<div class="outfit-meta-item outfit-meta-item-wide"><span class="outfit-meta-label">标签</span><div class="outfit-meta-value">' + renderTaggedItemTags(tabId, entry.id, tags, ownerUserId) + '</div></div>'
        + '</div>';

    return '<div class="prompt-item" data-item-id="' + entry.id + '" data-group-id="' + escapeAttr(entry.groupId || '') + '" data-tab-id="' + tabId + '">'
        + '<div class="prompt-main">'
        + '<span class="prompt-name">' + escapeHtml(entry.title || '未命名条目') + '</span>'
        + '<div class="prompt-actions">'
        + '<button class="copy-btn" data-action="copy" data-prompt="' + escapeAttr(entry.prompt || '') + '">复制</button>'
        + '<button class="copy-btn secondary-btn" data-action="add-to-cart" data-cart-label="' + escapeAttr(entry.title || '未命名条目') + '" data-prompt="' + escapeAttr(entry.prompt || '') + '">加入购物车</button>'
        + '<button class="copy-btn secondary-btn" data-action="edit"' + readOnlyButtonAttr + '>编辑</button>'
        + '<button class="copy-btn secondary-btn" data-action="preview">预览</button>'
        + '<button class="copy-btn danger-btn" data-action="delete" data-item-name="' + escapeAttr(entry.title || '未命名条目') + '"' + readOnlyButtonAttr + '>删除</button>'
        + '</div></div>'
        + metaHtml
        + previewHtml
        + '</div>';
}

function renderTaggedTab(tabId, listNode, entries) {
    const visibleEntries = getVisibleTaggedEntries(tabId, entries);

    listNode.innerHTML = visibleEntries.map(function (entry) {
        return '\n            <div class="card outfit-card">\n                ' + renderTaggedPromptItem(tabId, entry) + '\n            </div>\n        ';
    }).join('');

    if (!entries.length) {
        const emptyText = tabId === 'actions'
            ? '当前暂无动作条目，请先新增条目。'
            : '当前暂无环境/质量条目，请先新增条目。';
        listNode.innerHTML = '<div class="card"><div class="hint-text">' + emptyText + '</div></div>';
        return;
    }

    if (!visibleEntries.length) {
        listNode.innerHTML = '<div class="card"><div class="hint-text">当前筛选条件下没有条目，试试清空关键词或切换标签。</div></div>';
    }
}

function renderTaggedItemTags(tabId, itemId, tags, ownerUserId) {
    const readOnlyButtonAttr = getReadOnlyButtonAttr(ownerUserId);
    const readOnlyInputAttr = getReadOnlyInputAttr(ownerUserId);
    const list = Array.isArray(tags) ? tags : [];
    if (tabId === 'env') {
        const currentKind = resolveEnvKind(list);
        const isEditingKind = !!activeTaggedTagEditor
            && activeTaggedTagEditor.tabId === 'env'
            && activeTaggedTagEditor.itemId === itemId
            && activeTaggedTagEditor.mode === 'env-kind';
        if (isEditingKind) {
            return '<div class="card-tags"><div class="char-tag-edit-wrap"><select class="card-tag card-tag-edit-input" data-action="env-kind-edit-select" data-tab-id="env" data-item-id="' + escapeAttr(itemId) + '"' + readOnlyInputAttr + '><option value="环境"' + (String(activeTaggedTagEditor.value || currentKind) === '环境' ? ' selected' : '') + '>环境</option><option value="画质"' + (String(activeTaggedTagEditor.value || currentKind) === '画质' ? ' selected' : '') + '>画质</option></select></div></div>';
        }
        return '<div class="card-tags"><button class="card-tag card-tag-btn" data-action="start-env-kind-edit" data-tab-id="env" data-item-id="' + escapeAttr(itemId) + '" data-tag="' + escapeAttr(currentKind) + '"' + readOnlyButtonAttr + '>分类：' + escapeHtml(currentKind) + '</button></div>';
    }
    const chips = list.map(function (tag) {
        const meta = parseTagMeta(tag);
        const label = meta.label;
        const isEditing = !!activeTaggedTagEditor
            && activeTaggedTagEditor.tabId === tabId
            && activeTaggedTagEditor.itemId === itemId
            && activeTaggedTagEditor.oldTag === tag;

        if (isEditing) {
            return '<div class="char-tag-edit-wrap"><input class="card-tag card-tag-edit-input" data-action="tagged-tag-edit-input" data-tab-id="' + escapeAttr(tabId) + '" data-item-id="' + escapeAttr(itemId) + '" data-old-tag="' + escapeAttr(tag) + '" value="' + escapeAttr(activeTaggedTagEditor.value || '') + '"' + readOnlyInputAttr + ' /><button class="char-tag-delete-x" data-action="delete-tagged-tag-inline" data-tab-id="' + escapeAttr(tabId) + '" data-item-id="' + escapeAttr(itemId) + '" data-tag="' + escapeAttr(tag) + '" aria-label="删除标签"' + readOnlyButtonAttr + '>×</button></div>';
        }

        return '<button class="card-tag card-tag-btn" data-action="start-tagged-tag-edit" data-tab-id="' + escapeAttr(tabId) + '" data-item-id="' + escapeAttr(itemId) + '" data-tag="' + escapeAttr(tag) + '"' + readOnlyButtonAttr + '>' + escapeHtml(label) + '</button>';
    }).join('');

    const isAdding = !!activeTaggedTagEditor
        && activeTaggedTagEditor.tabId === tabId
        && activeTaggedTagEditor.itemId === itemId
        && activeTaggedTagEditor.isNew;
    const addEditor = isAdding
        ? '<div class="char-tag-edit-wrap"><input class="card-tag card-tag-edit-input" data-action="tagged-tag-edit-input" data-tab-id="' + escapeAttr(tabId) + '" data-item-id="' + escapeAttr(itemId) + '" data-old-tag="" value="' + escapeAttr(activeTaggedTagEditor.value || '') + '" placeholder="输入新标签"' + readOnlyInputAttr + ' /></div>'
        : '';
    const addBtn = '<button class="card-tag card-tag-btn add-tag-btn" data-action="start-tagged-tag-add" data-tab-id="' + escapeAttr(tabId) + '" data-item-id="' + escapeAttr(itemId) + '" aria-label="新增标签"' + readOnlyButtonAttr + '>+</button>';
    return '<div class="card-tags">' + chips + addEditor + addBtn + '</div>';
}

function getTaggedFilterState(tabId) {
    if (tabId === 'actions') {
        return { tags: activeActionsTags, mode: activeActionsTagMode };
    }
    return { tags: [], mode: 'or' };
}

function resolveEnvKind(tags) {
    const list = Array.isArray(tags) ? tags : [];
    return list.indexOf('画质') > -1 ? '画质' : '环境';
}

function collectTaggedTabTags(tabId) {
    const entries = promptData[tabId] || [];
    const tagSet = new Set();
    entries.forEach(function (entry) {
        (entry.tags || []).forEach(function (tag) {
            if (tag) {
                tagSet.add(tag);
            }
        });
    });
    return Array.from(tagSet);
}

function getVisibleTaggedEntries(tabId, entries) {
    if (tabId === 'env') {
        if (!activeEnvKindFilter) {
            return entries;
        }
        return entries.filter(function (entry) {
            return resolveEnvKind(entry.tags || []) === activeEnvKindFilter;
        });
    }

    const state = getTaggedFilterState(tabId);
    const selectedTags = (state.tags || []).filter(function (tag) {
        return !!tag;
    });
    if (!selectedTags.length) {
        return entries;
    }

    return entries.filter(function (entry) {
        const itemTags = entry.tags || [];
        return state.mode === 'and'
            ? selectedTags.every(function (tag) { return itemTags.indexOf(tag) > -1; })
            : selectedTags.some(function (tag) { return itemTags.indexOf(tag) > -1; });
    });
}

function renderTaggedTabFilters(tabId) {
    const targetNode = tabId === 'actions' ? actionsTagFilters : envTagFilters;
    if (!targetNode) {
        return;
    }

    if (tabId === 'env') {
        const current = activeEnvKindFilter || '';
        targetNode.innerHTML = '<div class="search-filter-wrap"><div class="search-row"><select class="search-input" data-action="filter-env-kind-select" data-tab-id="env"><option value="">全部分类</option><option value="环境"' + (current === '环境' ? ' selected' : '') + '>环境</option><option value="画质"' + (current === '画质' ? ' selected' : '') + '>画质</option></select></div></div>';
        return;
    }

    const tags = collectTaggedTabTags(tabId);
    const state = getTaggedFilterState(tabId);
    const modeHtml = '<div class="tag-filter-toolbar"><button class="tag-mode-switch' + (state.mode === 'or' ? ' is-or' : ' is-and') + '" data-action="filter-tagged-toggle" data-tab-id="' + escapeAttr(tabId) + '" type="button" aria-label="切换标签筛选模式"><span class="tag-mode-text">与</span><span class="tag-mode-text">或</span><span class="tag-mode-knob"></span></button><button class="tag-clear-btn" data-action="filter-tagged-clear" data-tab-id="' + escapeAttr(tabId) + '" type="button">清空筛选</button></div>';
    if (!tags.length) {
        targetNode.innerHTML = '<div class="tag-filter-panel">' + modeHtml + '<span class="tag-empty">暂无标签</span></div>';
        return;
    }

    const groupedTags = groupCharTags(tags);
    const groupedHtml = CHAR_TAG_CATEGORY_ORDER.filter(function (categoryName) {
        return groupedTags[categoryName] && groupedTags[categoryName].length;
    }).map(function (categoryName) {
        const chips = groupedTags[categoryName].map(function (tagMeta) {
            const isActive = (state.tags || []).indexOf(tagMeta.raw) > -1;
            return '<button class="tag-chip' + (isActive ? ' active' : '') + '" data-action="filter-tagged" data-tab-id="' + escapeAttr(tabId) + '" data-tag="' + escapeAttr(tagMeta.raw) + '">' + escapeHtml(tagMeta.label) + '</button>';
        }).join('');
        return '<div class="tag-category-group"><div class="tag-category-title">' + escapeHtml(categoryName) + '</div><div class="tag-filter-wrap">' + chips + '</div></div>';
    }).join('');

    targetNode.innerHTML = '<div class="tag-filter-panel">' + modeHtml + '<div class="tag-group-list">' + groupedHtml + '</div></div>';
}

function renderCharsTab(listNode, groups, visibleGroups) {
    if (!groups.length) {
        listNode.innerHTML = '<div class="card"><div class="hint-text">当前菜单暂无分组，请先新增分组。</div></div>';
        return;
    }

    if (!visibleGroups.length) {
        listNode.innerHTML = '<div class="card"><div class="hint-text">当前筛选条件下没有角色，试试清空关键词或切换标签。</div></div>';
        return;
    }

    const outfitOptions = [{ id: '', title: '不拼接服装（仅角色特征）' }].concat((promptData.outfit || []).map(function (entry) {
        return {
            id: entry.id,
            title: formatOutfitDisplayName(entry)
        };
    }));

    listNode.innerHTML = visibleGroups.map(function (group) {
        const ownerUserId = group.ownerUserId || '';
        const readOnlyButtonAttr = getReadOnlyButtonAttr(ownerUserId);
        const readOnlyInputAttr = getReadOnlyInputAttr(ownerUserId);
        const tagsHtml = renderCardTags(group.id, group.tags || [], ownerUserId);
        const uploaderHtml = '<div class="uploader-meta"><span class="hint-text">上传者：</span>'
            + '<span class="uploader-avatar-fallback">' + escapeHtml(String(group.uploader || '匿').slice(0, 1).toUpperCase()) + '</span>'
            + '<span class="uploader-name">' + escapeHtml(group.uploader || '匿名用户') + '</span></div>';
        const outfitOptionsHtml = outfitOptions.map(function (option) {
            return '<option value="' + escapeAttr(option.id) + '">' + escapeHtml(option.title) + '</option>';
        }).join('');
        const relatedOutfits = (promptData.outfit || []).filter(function (entry) {
            return String(entry.sourceCharacter || '').trim() === String(group.title || '').trim();
        });
        const relatedOutfitsHtml = relatedOutfits.length
            ? relatedOutfits.map(function (entry) {
                return '<div class="outfit-related-item">' + renderOutfitPromptItem(entry, false) + '</div>';
            }).join('')
            : '<div class="hint-text">当前角色暂无关联服装条目。</div>';
        const relatedOutfitSection = '<div class="editor-title" style="margin: 8px 0;">关联服装</div>'
            + '<div class="char-related-outfit-list">' + relatedOutfitsHtml + '</div>';
        const groupActionHtml = '<div class="group-actions">'
            + '<button class="copy-btn" data-action="save-char-description" data-group-id="' + group.id + '"' + readOnlyButtonAttr + '>保存角色特征</button>'
            + '<div class="group-settings-wrap"><button class="settings-icon-btn" data-action="open-char-settings-modal" data-group-id="' + group.id + '" data-group-title="' + escapeAttr(group.title) + '" aria-label="打开角色设置"' + readOnlyButtonAttr + '>⚙</button></div>'
            + '</div>';

        return '\n            <div class="card">\n                <div class="card-header">\n                    <div><div class="card-title">' + escapeHtml(group.title) + '</div>' + uploaderHtml + '</div>\n                    ' + groupActionHtml + '\n                </div>\n                ' + tagsHtml + '\n                <div class="inline-item-form" data-inline-form="char-description" data-group-id="' + group.id + '">\n                    <textarea class="inline-item-prompt" data-role="char-description-input" placeholder="输入角色自身描述（不含服装）"' + readOnlyInputAttr + '>' + escapeHtml(group.description || '') + '</textarea>\n                    <div class="form-actions">\n                        <button class="copy-btn" data-action="copy-char-base" data-group-id="' + group.id + '">复制角色特征</button>\n                        <button class="copy-btn secondary-btn" data-action="add-char-base-to-cart" data-group-id="' + group.id + '" data-group-title="' + escapeAttr(group.title || '角色') + '">加入购物车</button>\n                    </div>\n                </div>\n                ' + relatedOutfitSection + '\n                <div class="inline-item-form" data-inline-form="char-copy-with-outfit" data-group-id="' + group.id + '">\n                    <select class="inline-outfit-select" data-role="char-outfit-select">' + outfitOptionsHtml + '</select>\n                    <div class="form-actions">\n                        <button class="copy-btn secondary-btn" data-action="copy-char-with-outfit" data-group-id="' + group.id + '">复制角色+服装</button>\n                        <button class="copy-btn secondary-btn" data-action="add-char-with-outfit-to-cart" data-group-id="' + group.id + '" data-group-title="' + escapeAttr(group.title || '角色') + '">加入购物车</button>\n                    </div>\n                </div>\n            </div>\n        ';
    }).join('');
}

function renderOutfitTab(listNode, groups) {
    listNode.innerHTML = groups.map(function (entry) {
        return '\n            <div class="card outfit-card">\n                ' + renderOutfitPromptItem(entry, true) + '\n            </div>\n        ';
    }).join('');

    if (!groups.length) {
        listNode.innerHTML = '<div class="card"><div class="hint-text">当前暂无服装条目，请先新增条目。</div></div>';
    }
}

function renderCharTagFilters() {
    if (!charTagFilters) {
        return;
    }

    const tags = collectCharTags();
    const modeHtml = '<div class="tag-filter-toolbar"><button class="tag-mode-switch' + (activeCharTagMode === 'or' ? ' is-or' : ' is-and') + '" data-action="filter-tag-toggle" type="button" aria-label="切换标签筛选模式"><span class="tag-mode-text">与</span><span class="tag-mode-text">或</span><span class="tag-mode-knob"></span></button><button class="tag-clear-btn" data-action="filter-tag-clear" type="button">清空筛选</button></div>';
    if (!tags.length) {
        charTagFilters.innerHTML = '<div class="tag-filter-panel">' + modeHtml + '<span class="tag-empty">暂无标签</span></div>';
        return;
    }

    const groupedTags = groupCharTags(tags);
    const groupedHtml = CHAR_TAG_CATEGORY_ORDER.filter(function (categoryName) {
        return groupedTags[categoryName] && groupedTags[categoryName].length;
    }).map(function (categoryName) {
        const chips = groupedTags[categoryName].map(function (tagMeta) {
            const isActive = activeCharTags.indexOf(tagMeta.raw) > -1;
            return '<button class="tag-chip' + (isActive ? ' active' : '') + '" data-action="filter-tag" data-tag="' + escapeAttr(tagMeta.raw) + '">' + escapeHtml(tagMeta.label) + '</button>';
        }).join('');

        return '<div class="tag-category-group"><div class="tag-category-title">' + escapeHtml(categoryName) + '</div><div class="tag-filter-wrap">' + chips + '</div></div>';
    }).join('');

    charTagFilters.innerHTML = '<div class="tag-filter-panel">' + modeHtml + '<div class="tag-group-list">' + groupedHtml + '</div></div>';
}

const CHAR_TAG_CATEGORY_ORDER = ['按作品分类', '按性别分类', '按SFW NSFW分类', '其他标签'];

function groupCharTags(tags) {
    const grouped = {
        '按作品分类': [],
        '按性别分类': [],
        '按SFW NSFW分类': [],
        '其他标签': []
    };

    tags.forEach(function (tag) {
        const meta = parseTagMeta(tag);
        grouped[meta.category].push(meta);
    });

    return grouped;
}

function parseTagMeta(tag) {
    const raw = String(tag || '').trim();
    if (!raw) {
        return {
            raw: '',
            category: '其他标签',
            label: ''
        };
    }

    const explicit = parseExplicitTag(raw);
    if (explicit) {
        return explicit;
    }

    const normalized = raw.toLowerCase();

    if (isGenderTag(normalized)) {
        return {
            raw: raw,
            category: '按性别分类',
            label: raw
        };
    }

    if (isRatingTag(normalized)) {
        return {
            raw: raw,
            category: '按SFW NSFW分类',
            label: raw
        };
    }

    return {
        raw: raw,
        category: '其他标签',
        label: raw
    };
}

function parseExplicitTag(rawTag) {
    const separators = [':', '：'];
    for (let index = 0; index < separators.length; index += 1) {
        const separator = separators[index];
        const splitAt = rawTag.indexOf(separator);
        if (splitAt <= 0 || splitAt >= rawTag.length - 1) {
            continue;
        }

        const prefix = rawTag.slice(0, splitAt).trim().toLowerCase();
        const label = rawTag.slice(splitAt + 1).trim();
        if (!label) {
            continue;
        }

        if (['作品', '按作品分类', 'work', 'ip', 'title', '系列'].indexOf(prefix) > -1) {
            return { raw: rawTag, category: '按作品分类', label: label };
        }
        if (['性别', '按性别分类', 'gender'].indexOf(prefix) > -1) {
            return { raw: rawTag, category: '按性别分类', label: label };
        }
        if (['sfw', 'nsfw', '分级', 'rating', '按sfw nsfw分类'].indexOf(prefix) > -1) {
            return { raw: rawTag, category: '按SFW NSFW分类', label: label };
        }
        if (['其他', '其他标签', 'other', 'others'].indexOf(prefix) > -1) {
            return { raw: rawTag, category: '其他标签', label: label };
        }
    }

    return null;
}

function isGenderTag(normalizedTag) {
    const keywords = ['男', '女', '男性', '女性', 'male', 'female', 'boy', 'girl', 'man', 'woman'];
    return keywords.some(function (keyword) {
        return normalizedTag.indexOf(keyword) > -1;
    });
}

function isRatingTag(normalizedTag) {
    const keywords = ['sfw', 'nsfw', 'r18', '18+', 'safe', 'explicit'];
    return keywords.some(function (keyword) {
        return normalizedTag.indexOf(keyword) > -1;
    });
}

function collectCharTags() {
    const groups = promptData.chars || [];
    const tagSet = new Set();
    groups.forEach(function (group) {
        (group.tags || []).forEach(function (tag) {
            if (tag) {
                tagSet.add(tag);
            }
        });
    });
    return Array.from(tagSet);
}

function getVisibleCharGroups(groups) {
    const selectedTags = activeCharTags.filter(function (tag) {
        return !!tag;
    });

    return groups.filter(function (group) {
        const groupTags = group.tags || [];
        const passTag = !selectedTags.length || (activeCharTagMode === 'and'
            ? selectedTags.every(function (tag) { return groupTags.indexOf(tag) > -1; })
            : selectedTags.some(function (tag) { return groupTags.indexOf(tag) > -1; }));
        const passKeyword = !activeCharKeyword || String(group.title || '').toLowerCase().indexOf(activeCharKeyword) > -1;
        return passTag && passKeyword;
    });
}

function renderCardTags(groupId, tags, ownerUserId) {
    const readOnlyButtonAttr = getReadOnlyButtonAttr(ownerUserId);
    const readOnlyInputAttr = getReadOnlyInputAttr(ownerUserId);
    const chips = tags.map(function (tag) {
        const meta = parseTagMeta(tag);
        const label = meta.label;
        const isEditing = !!activeCharTagEditor
            && activeCharTagEditor.groupId === groupId
            && activeCharTagEditor.oldTag === tag;

        if (isEditing) {
            return '<div class="char-tag-edit-wrap"><input class="card-tag card-tag-edit-input" data-action="char-tag-edit-input" data-group-id="' + escapeAttr(groupId) + '" data-old-tag="' + escapeAttr(tag) + '" value="' + escapeAttr(activeCharTagEditor.value || '') + '"' + readOnlyInputAttr + ' /><button class="char-tag-delete-x" data-action="delete-char-tag-inline" data-group-id="' + escapeAttr(groupId) + '" data-tag="' + escapeAttr(tag) + '" aria-label="删除标签"' + readOnlyButtonAttr + '>×</button></div>';
        }

        return '<button class="card-tag card-tag-btn" data-action="start-char-tag-edit" data-group-id="' + escapeAttr(groupId) + '" data-tag="' + escapeAttr(tag) + '"' + readOnlyButtonAttr + '>' + escapeHtml(label) + '</button>';
    }).join('');

    const isAdding = !!activeCharTagEditor && activeCharTagEditor.groupId === groupId && activeCharTagEditor.isNew;
    const addEditor = isAdding
        ? '<div class="char-tag-edit-wrap"><input class="card-tag card-tag-edit-input" data-action="char-tag-edit-input" data-group-id="' + escapeAttr(groupId) + '" data-old-tag="" value="' + escapeAttr(activeCharTagEditor.value || '') + '" placeholder="输入新标签"' + readOnlyInputAttr + ' /></div>'
        : '';
    const addBtn = '<button class="card-tag card-tag-btn add-tag-btn" data-action="start-char-tag-add" data-group-id="' + escapeAttr(groupId) + '" aria-label="新增标签"' + readOnlyButtonAttr + '>+</button>';
    return '<div class="card-tags">' + chips + addEditor + addBtn + '</div>';
}

function switchToTab(tabId, element) {
    document.querySelectorAll('.container').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    document.getElementById('tab-' + tabId).classList.add('active');

    if (element) {
        element.classList.add('active');
    } else {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(function (item) {
            const tabText = item.textContent || '';
            if ((tabId === 'chars' && tabText.indexOf('人物') > -1) ||
                (tabId === 'actions' && tabText.indexOf('动作') > -1) ||
                (tabId === 'env' && tabText.indexOf('环境质量') > -1) ||
                (tabId === 'outfit' && tabText.indexOf('服装') > -1)) {
                item.classList.add('active');
            }
        });
    }

    window.scrollTo(0, 0);
}
