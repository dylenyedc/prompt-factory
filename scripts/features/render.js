function renderAllTabs() {
    renderCharTagFilters();
    renderOutfitCategoryFilters();
    renderTab('chars');
    renderTab('actions');
    renderTab('env');
    renderTab('outfit');
}

function renderTab(tabId) {
    const listNode = document.getElementById('list-' + tabId);
    const groups = promptData[tabId] || [];

    if (tabId === 'outfit') {
        renderOutfitTab(listNode, groups);
        return;
    }

    const visibleGroups = tabId === 'chars' ? getVisibleCharGroups(groups) : groups;

    listNode.innerHTML = visibleGroups.map(group => {
        const itemsHtml = group.items.map(item => {
            const isEditing = !!editState && editState.tabId === tabId && editState.groupId === group.id && editState.itemId === item.id;
            const previewHtml = isEditing
                ? '<div class="preview-box active"><div class="inline-item-form" data-inline-form="edit"><input class="inline-item-name" type="text" value="' + escapeAttr(item.name) + '" placeholder="条目名称" /><textarea class="inline-item-prompt" placeholder="提示词内容">' + escapeHtml(item.prompt) + '</textarea><div class="form-actions"><button class="copy-btn" data-action="edit-inline-save">保存</button><button class="copy-btn secondary-btn" data-action="edit-inline-cancel">取消</button></div></div></div>'
                : '<div class="preview-box">' + escapeHtml(item.prompt) + '</div>';

            return '\n                        <div class="prompt-item" data-item-id="' + item.id + '" data-group-id="' + group.id + '" data-tab-id="' + tabId + '">\n                            <div class="prompt-main">\n                                <span class="prompt-name">' + escapeHtml(item.name) + '</span>\n                                <div class="prompt-actions">\n                                    <button class="copy-btn" data-action="copy" data-prompt="' + escapeAttr(item.prompt) + '">复制</button>\n                                    <button class="copy-btn secondary-btn" data-action="edit">编辑</button>\n                                    <button class="copy-btn secondary-btn" data-action="preview">预览</button>\n                                    <button class="copy-btn danger-btn" data-action="delete" data-item-name="' + escapeAttr(item.name) + '">删除</button>\n                                </div>\n                            </div>\n                            ' + previewHtml + '\n                        </div>\n                    ';
        }).join('');

        const content = itemsHtml || '<div class="hint-text">当前分组还没有提示词，使用上方表单新增。</div>';
        const commonAddBtn = '<button class="copy-btn" data-action="add-item-start" data-tab-id="' + tabId + '" data-group-id="' + group.id + '">新增提示词</button>';
        const groupManageBtns = tabId === 'chars'
            ? '<div class="group-settings-wrap"><button class="settings-icon-btn" data-action="open-char-settings-modal" data-group-id="' + group.id + '" data-group-title="' + escapeAttr(group.title) + '" aria-label="打开角色设置">⚙</button></div>'
            : '';
        const groupActionHtml = '<div class="group-actions">' + commonAddBtn + groupManageBtns + '</div>';
        const addFormHtml = (addState && addState.tabId === tabId && addState.groupId === group.id)
            ? '<div class="inline-item-form" data-inline-form="add" data-tab-id="' + tabId + '" data-group-id="' + group.id + '"><input class="inline-item-name" type="text" placeholder="输入条目名称" /><textarea class="inline-item-prompt" placeholder="输入完整提示词"></textarea><div class="form-actions"><button class="copy-btn" data-action="add-item-save">保存新增</button><button class="copy-btn secondary-btn" data-action="add-item-cancel">取消</button></div></div>'
            : '';
        const tagsHtml = tabId === 'chars' ? renderCardTags(group.id, group.tags || []) : '';

        return '\n                    <div class="card">\n                        <div class="card-header">\n                            <div class="card-title">' + escapeHtml(group.title) + '</div>\n                            ' + groupActionHtml + '\n                        </div>\n                        ' + tagsHtml + '\n                        ' + content + '\n                        ' + addFormHtml + '\n                    </div>\n                ';
    }).join('');

    if (!groups.length) {
        listNode.innerHTML = '<div class="card"><div class="hint-text">当前菜单暂无分组，请先新增分组。</div></div>';
        return;
    }

    if (tabId === 'chars' && !visibleGroups.length) {
        listNode.innerHTML = '<div class="card"><div class="hint-text">当前筛选条件下没有角色，试试清空关键词或切换标签。</div></div>';
    }
}

function renderOutfitTab(listNode, groups) {
    const visibleCategoryKeys = getVisibleOutfitCategoryKeys();

    listNode.innerHTML = groups.map(function (group) {
        const categoryBlocks = visibleCategoryKeys.map(function (categoryKey) {
            const items = Array.isArray(group[categoryKey]) ? group[categoryKey] : [];
            const itemsHtml = items.map(function (item) {
                const isEditing = !!editState
                    && editState.tabId === 'outfit'
                    && editState.groupId === group.id
                    && editState.itemId === item.id
                    && editState.categoryKey === categoryKey;
                const previewHtml = isEditing
                    ? '<div class="preview-box active"><div class="inline-item-form" data-inline-form="edit"><input class="inline-item-name" type="text" value="' + escapeAttr(item.name) + '" placeholder="条目名称" /><textarea class="inline-item-prompt" placeholder="提示词内容">' + escapeHtml(item.prompt) + '</textarea><div class="form-actions"><button class="copy-btn" data-action="edit-inline-save">保存</button><button class="copy-btn secondary-btn" data-action="edit-inline-cancel">取消</button></div></div></div>'
                    : '<div class="preview-box">' + escapeHtml(item.prompt) + '</div>';

                return '\n                    <div class="prompt-item" data-item-id="' + item.id + '" data-group-id="' + group.id + '" data-tab-id="outfit" data-category-key="' + categoryKey + '">\n                        <div class="prompt-main">\n                            <span class="prompt-name">' + escapeHtml(item.name) + '</span>\n                            <div class="prompt-actions">\n                                <button class="copy-btn" data-action="copy" data-prompt="' + escapeAttr(item.prompt) + '">复制</button>\n                                <button class="copy-btn secondary-btn" data-action="edit">编辑</button>\n                                <button class="copy-btn secondary-btn" data-action="preview">预览</button>\n                                <button class="copy-btn danger-btn" data-action="delete" data-item-name="' + escapeAttr(item.name) + '">删除</button>\n                            </div>\n                        </div>\n                        ' + previewHtml + '\n                    </div>\n                ';
            }).join('');

            const addFormHtml = (addState
                && addState.tabId === 'outfit'
                && addState.groupId === group.id
                && addState.categoryKey === categoryKey)
                ? '<div class="inline-item-form" data-inline-form="add" data-tab-id="outfit" data-group-id="' + group.id + '" data-category-key="' + categoryKey + '"><input class="inline-item-name" type="text" placeholder="输入条目名称" /><textarea class="inline-item-prompt" placeholder="输入完整提示词"></textarea><div class="form-actions"><button class="copy-btn" data-action="add-item-save">保存新增</button><button class="copy-btn secondary-btn" data-action="add-item-cancel">取消</button></div></div>'
                : '';

            return '\n                <div class="outfit-section">\n                    <div class="outfit-section-title">' + OUTFIT_CATEGORY_LABELS[categoryKey] + '</div>\n                    ' + (itemsHtml || '<div class="hint-text">当前分类暂无提示词。</div>') + '\n                    <div class="group-actions"><button class="copy-btn" data-action="add-outfit-item-start" data-tab-id="outfit" data-group-id="' + group.id + '" data-category-key="' + categoryKey + '">新增' + OUTFIT_CATEGORY_LABELS[categoryKey] + '</button></div>\n                    ' + addFormHtml + '\n                </div>\n            ';
        }).join('');

        return '\n            <div class="card">\n                <div class="card-header">\n                    <div class="card-title">' + escapeHtml(group.title) + '</div>\n                    <div class="group-actions">\n                        <button class="copy-btn secondary-btn" data-action="rename-outfit-group" data-group-id="' + group.id + '" data-group-title="' + escapeAttr(group.title) + '">编辑风格名</button>\n                        <button class="copy-btn danger-btn" data-action="delete-outfit-group" data-group-id="' + group.id + '" data-group-title="' + escapeAttr(group.title) + '">删除风格</button>\n                    </div>\n                </div>\n                ' + categoryBlocks + '\n            </div>\n        ';
    }).join('');

    if (!groups.length) {
        listNode.innerHTML = '<div class="card"><div class="hint-text">当前暂无服装风格，请先新增风格。</div></div>';
    }
}

function renderOutfitCategoryFilters() {
    if (!outfitCategoryFilters) {
        return;
    }

    const allBtn = '<button class="tag-chip' + (activeOutfitCategory === '__all__' ? ' active' : '') + '" data-action="filter-outfit-category" data-category="__all__">全部分类</button>';
    const categoryBtns = OUTFIT_CATEGORY_KEYS.map(function (categoryKey) {
        const isActive = categoryKey === activeOutfitCategory;
        return '<button class="tag-chip' + (isActive ? ' active' : '') + '" data-action="filter-outfit-category" data-category="' + categoryKey + '">' + OUTFIT_CATEGORY_LABELS[categoryKey] + '</button>';
    }).join('');

    outfitCategoryFilters.innerHTML = allBtn + categoryBtns;
}

function getVisibleOutfitCategoryKeys() {
    if (activeOutfitCategory === '__all__') {
        return OUTFIT_CATEGORY_KEYS;
    }
    return OUTFIT_CATEGORY_KEYS.indexOf(activeOutfitCategory) > -1 ? [activeOutfitCategory] : OUTFIT_CATEGORY_KEYS;
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

function renderCardTags(groupId, tags) {
    const chips = tags.map(function (tag) {
        const meta = parseTagMeta(tag);
        const label = meta.label;
        const isEditing = !!activeCharTagEditor
            && activeCharTagEditor.groupId === groupId
            && activeCharTagEditor.oldTag === tag;

        if (isEditing) {
            return '<div class="char-tag-edit-wrap"><input class="card-tag card-tag-edit-input" data-action="char-tag-edit-input" data-group-id="' + escapeAttr(groupId) + '" data-old-tag="' + escapeAttr(tag) + '" value="' + escapeAttr(activeCharTagEditor.value || '') + '" /><button class="char-tag-delete-x" data-action="delete-char-tag-inline" data-group-id="' + escapeAttr(groupId) + '" data-tag="' + escapeAttr(tag) + '" aria-label="删除标签">×</button></div>';
        }

        return '<button class="card-tag card-tag-btn" data-action="start-char-tag-edit" data-group-id="' + escapeAttr(groupId) + '" data-tag="' + escapeAttr(tag) + '">' + escapeHtml(label) + '</button>';
    }).join('');

    const isAdding = !!activeCharTagEditor && activeCharTagEditor.groupId === groupId && activeCharTagEditor.isNew;
    const addEditor = isAdding
        ? '<div class="char-tag-edit-wrap"><input class="card-tag card-tag-edit-input" data-action="char-tag-edit-input" data-group-id="' + escapeAttr(groupId) + '" data-old-tag="" value="' + escapeAttr(activeCharTagEditor.value || '') + '" placeholder="输入新标签" /></div>'
        : '';
    const addBtn = '<button class="card-tag card-tag-btn add-tag-btn" data-action="start-char-tag-add" data-group-id="' + escapeAttr(groupId) + '" aria-label="新增标签">+</button>';
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
