async function loadPromptData() {
    try {
        const response = await fetch('/api/prompts');
        if (!response.ok) {
            throw new Error('数据读取失败: ' + response.status);
        }
        const data = await response.json();
        if (!data || typeof data !== 'object') {
            throw new Error('数据格式无效');
        }
        return normalizePromptData(data);
    } catch (e) {
        console.warn('读取服务端数据失败，使用默认数据', e);
        showToast('服务端读取失败，已使用默认数据');
    }
    return normalizePromptData(JSON.parse(JSON.stringify(defaultPromptData)));
}

async function loadCharList() {
    try {
        const response = await fetch('/api/chars');
        if (!response.ok) {
            throw new Error('角色列表读取失败: ' + response.status);
        }
        const result = await response.json();
        return Array.isArray(result && result.chars) ? result.chars : [];
    } catch (e) {
        console.warn('读取角色列表失败', e);
        return [];
    }
}

async function savePromptData() {
    try {
        const response = await fetch('/api/prompts', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(promptData)
        });

        if (!response.ok) {
            throw new Error('数据保存失败: ' + response.status);
        }

        return true;
    } catch (e) {
        console.error('保存失败', e);
        showToast('保存失败，请检查服务器状态');
        return false;
    }
}

async function mutatePromptData(action, payload) {
    try {
        const response = await fetch('/api/prompts/mutate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: action, payload: payload || {} })
        });

        let result = null;
        try {
            result = await response.json();
        } catch (_) {
            result = null;
        }

        if (!response.ok) {
            const message = result && result.message ? result.message : '操作失败';
            showToast(message);
            return { ok: false, message: message };
        }

        if (result && result.data) {
            promptData = normalizePromptData(result.data);
        }

        return {
            ok: true,
            message: result && result.message ? result.message : '操作成功'
        };
    } catch (e) {
        console.error('请求后端变更失败', e);
        showToast('请求失败，请检查服务器状态');
        return { ok: false, message: '请求失败' };
    }
}

function normalizePromptData(data) {
    const normalized = deepClone(data || {});
    TAB_KEYS.forEach(function (tabKey) {
        if (!Array.isArray(normalized[tabKey])) {
            normalized[tabKey] = [];
        }
    });

    ['chars', 'actions', 'env'].forEach(function (tabKey) {
        normalized[tabKey] = normalized[tabKey].map(function (group) {
            const nextGroup = group && typeof group === 'object' ? deepClone(group) : { id: newId(), title: '未命名分组', items: [] };
            if (!Array.isArray(nextGroup.items)) {
                nextGroup.items = [];
            }
            return nextGroup;
        });
    });

    normalized.chars = normalized.chars.map(function (group) {
        const nextGroup = group && typeof group === 'object' ? deepClone(group) : { id: newId(), title: '未命名角色', items: [] };
        if (!Array.isArray(nextGroup.items)) {
            nextGroup.items = [];
        }
        if (!Array.isArray(nextGroup.tags)) {
            nextGroup.tags = [];
        }
        return nextGroup;
    });

    normalized.outfit = normalized.outfit.map(function (group) {
        const nextGroup = group && typeof group === 'object'
            ? deepClone(group)
            : { id: newId(), title: '未命名风格', tops: [], bottoms: [], shoes: [] };

        OUTFIT_CATEGORY_KEYS.forEach(function (categoryKey) {
            if (!Array.isArray(nextGroup[categoryKey])) {
                nextGroup[categoryKey] = [];
            }
        });

        return nextGroup;
    });

    return normalized;
}
