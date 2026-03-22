const ACCESS_TOKEN_KEY = 'sd_access_token';
const REFRESH_TOKEN_KEY = 'sd_refresh_token';

function setReadOnlyMode(nextReadOnly) {
    isReadOnlyMode = !!nextReadOnly;
    if (typeof window.updateReadOnlyUI === 'function') {
        window.updateReadOnlyUI();
    }
}

function createEmptyPromptData() {
    return {
        chars: [],
        actions: [],
        env: [],
        outfit: []
    };
}

function getAuthTokens() {
    return {
        accessToken: localStorage.getItem(ACCESS_TOKEN_KEY) || '',
        refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) || ''
    };
}

function hasAuthSession() {
    const tokens = getAuthTokens();
    return !!tokens.accessToken;
}

function setAuthTokens(accessToken, refreshToken) {
    if (accessToken) {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    }
    if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
}

function clearAuthTokens() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function tryRefreshAccessToken() {
    const tokens = getAuthTokens();
    if (!tokens.refreshToken) {
        return false;
    }

    const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: tokens.refreshToken })
    });

    if (!response.ok) {
        clearAuthTokens();
        return false;
    }

    const result = await response.json();
    if (!result || !result.accessToken || !result.refreshToken) {
        clearAuthTokens();
        return false;
    }

    setAuthTokens(result.accessToken, result.refreshToken);
    return true;
}

function consumeAuthTokensFromUrlHash() {
    const hash = String(window.location.hash || '');
    if (!hash || hash.length < 2) {
        return false;
    }

    const hashText = hash.startsWith('#') ? hash.slice(1) : hash;
    const params = new URLSearchParams(hashText);
    const accessToken = params.get('access_token') || '';
    const refreshToken = params.get('refresh_token') || '';
    if (!accessToken || !refreshToken) {
        return false;
    }

    setAuthTokens(accessToken, refreshToken);
    if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return true;
}

function authLoginWithGitHub(redirectPath) {
    const target = String(redirectPath || '/').trim() || '/';
    const safe = target.startsWith('/') ? target : '/';
    window.location.href = '/api/auth/github/start?redirect=' + encodeURIComponent(safe);
}

async function apiFetch(url, options, allowRefresh) {
    const requestOptions = options ? deepClone(options) : {};
    requestOptions.headers = requestOptions.headers || {};
    const tokens = getAuthTokens();
    if (tokens.accessToken) {
        requestOptions.headers.Authorization = 'Bearer ' + tokens.accessToken;
    }

    const response = await fetch(url, requestOptions);
    if (response.status === 401 && allowRefresh !== false) {
        const refreshed = await tryRefreshAccessToken();
        if (refreshed) {
            return apiFetch(url, options, false);
        }
    }

    return response;
}

function authLogout() {
    clearAuthTokens();
    isAdminUser = false;
    currentUserId = '';
    currentUsername = '';
    currentNickname = '';
}

function normalizeCartItemsForClient(items) {
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

async function loadPromptData() {
    try {
        const response = await apiFetch('/api/prompts', {
            method: 'GET'
        });
        if (!response.ok) {
            if (response.status === 401) {
                clearAuthTokens();
                isAdminUser = false;
                currentUserId = '';
                currentUsername = '';
                currentNickname = '';
                setReadOnlyMode(true);
                throw new Error('未登录或登录已过期');
            }
            throw new Error('数据读取失败: ' + response.status);
        }
        const readOnlyHeader = response.headers.get('X-Read-Only');
        const readOnlyByServer = readOnlyHeader === '1';
        const isAdminHeader = response.headers.get('X-Is-Admin');
        isAdminUser = isAdminHeader === '1';
        const userIdHeader = response.headers.get('X-User-Id');
        const userNameHeader = response.headers.get('X-User-Name');
        const userNicknameHeader = response.headers.get('X-User-Nickname');
        if (userIdHeader !== null) {
            currentUserId = userIdHeader;
        }
        if (userNameHeader !== null) {
            currentUsername = userNameHeader;
        }
        if (userNicknameHeader !== null) {
            currentNickname = userNicknameHeader || currentUsername;
        }
        setReadOnlyMode(readOnlyByServer || !hasAuthSession());
        const data = await response.json();
        if (!data || typeof data !== 'object') {
            throw new Error('数据格式无效');
        }
        return normalizePromptData(data);
    } catch (e) {
        console.warn('读取服务端数据失败，使用空数据', e);
        isAdminUser = false;
        currentUserId = '';
        currentUsername = '';
        currentNickname = '';
        showToast('数据读取失败，请先登录或检查服务状态');
    }
    return normalizePromptData(createEmptyPromptData());
}

async function loadMyProfile() {
    if (!hasAuthSession()) {
        currentUserId = '';
        currentUsername = '';
        currentNickname = '';
        cartItems = [];
        return { ok: true, authenticated: false, cartItems: [] };
    }

    try {
        const response = await apiFetch('/api/auth/me', { method: 'GET' });
        let result = null;
        try {
            result = await response.json();
        } catch (_) {
            result = null;
        }

        if (!response.ok || !result || !result.authenticated) {
            if (response.status === 401) {
                clearAuthTokens();
                isAdminUser = false;
                currentUserId = '';
                currentUsername = '';
                currentNickname = '';
                cartItems = [];
                setReadOnlyMode(true);
            }
            return { ok: false, authenticated: false, cartItems: [] };
        }

        currentUserId = result.userId || currentUserId;
        currentUsername = result.username || currentUsername;
        currentNickname = result.nickname || currentUsername;
        isAdminUser = !!result.isAdmin;
        cartItems = normalizeCartItemsForClient(result.cartItems);
        return { ok: true, authenticated: true, cartItems: cartItems };
    } catch (_) {
        return { ok: false, authenticated: false, cartItems: [] };
    }
}

async function updateMyCart(items) {
    if (isReadOnlyMode || !hasAuthSession()) {
        return { ok: false, message: '未登录', cartItems: normalizeCartItemsForClient(items) };
    }

    try {
        const response = await apiFetch('/api/auth/cart', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ items: normalizeCartItemsForClient(items) })
        });

        let result = null;
        try {
            result = await response.json();
        } catch (_) {
            result = null;
        }

        if (!response.ok) {
            if (response.status === 401) {
                clearAuthTokens();
                isAdminUser = false;
                currentUserId = '';
                currentUsername = '';
                currentNickname = '';
                setReadOnlyMode(true);
            }
            return {
                ok: false,
                message: result && result.message ? result.message : '购物车保存失败',
                cartItems: normalizeCartItemsForClient(items)
            };
        }

        const nextItems = normalizeCartItemsForClient(result && result.cartItems);
        cartItems = nextItems;
        return {
            ok: true,
            message: result && result.message ? result.message : '购物车已保存',
            cartItems: nextItems
        };
    } catch (_) {
        return {
            ok: false,
            message: '请求失败',
            cartItems: normalizeCartItemsForClient(items)
        };
    }
}

async function mutatePromptData(action, payload) {
    if (isReadOnlyMode || !hasAuthSession()) {
        showToast('当前为只读模式，请先使用 GitHub 登录后再修改');
        return Promise.resolve({ ok: false, message: '当前为只读模式' });
    }

    try {
        const response = await apiFetch('/api/prompts/mutate', {
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
            if (response.status === 401) {
                clearAuthTokens();
                isAdminUser = false;
                currentUserId = '';
                currentUsername = '';
                currentNickname = '';
                setReadOnlyMode(true);
            }
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

async function downloadPromptDataExport() {
    try {
        const response = await apiFetch('/api/prompts/export', {
            method: 'GET'
        });

        if (!response.ok) {
            if (response.status === 401) {
                clearAuthTokens();
                isAdminUser = false;
                currentUserId = '';
                currentUsername = '';
                currentNickname = '';
                setReadOnlyMode(true);
            }
            showToast('导出失败，请稍后重试');
            return false;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'prompt-data.json';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
        showToast('已开始下载 prompt-data.json');
        return true;
    } catch (error) {
        console.error('下载导出失败', error);
        showToast('下载失败，请检查服务状态');
        return false;
    }
}

async function importPromptDataFromJsonFile(file) {
    if (isReadOnlyMode || !hasAuthSession()) {
        showToast('当前为只读模式，请先使用 GitHub 登录后再导入');
        return { ok: false, message: '当前为只读模式' };
    }

    if (!isAdminUser) {
        showToast('仅管理员可执行批量导入');
        return { ok: false, message: '仅管理员可执行批量导入' };
    }

    if (!file) {
        showToast('请选择要导入的 JSON 文件');
        return { ok: false, message: '未选择文件' };
    }

    let parsed = null;
    try {
        const raw = await file.text();
        parsed = JSON.parse(raw);
    } catch (_) {
        showToast('JSON 文件格式无效，请检查后重试');
        return { ok: false, message: 'JSON 文件格式无效' };
    }

    if (!parsed || typeof parsed !== 'object') {
        showToast('JSON 文件内容无效');
        return { ok: false, message: 'JSON 内容无效' };
    }

    try {
        const response = await apiFetch('/api/prompts', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(parsed)
        });

        let result = null;
        try {
            result = await response.json();
        } catch (_) {
            result = null;
        }

        if (!response.ok) {
            if (response.status === 401) {
                clearAuthTokens();
                isAdminUser = false;
                setReadOnlyMode(true);
            }
            const message = result && result.message ? result.message : '导入失败';
            showToast(message);
            return { ok: false, message: message };
        }

        if (result && result.data) {
            promptData = normalizePromptData(result.data);
        }

        const message = result && result.message ? result.message : '导入成功';
        showToast(message);
        return { ok: true, message: message };
    } catch (error) {
        console.error('导入 JSON 失败', error);
        showToast('导入失败，请检查服务状态');
        return { ok: false, message: '请求失败' };
    }
}

async function importPromptDataFromProjectRoot() {
    if (isReadOnlyMode || !hasAuthSession()) {
        showToast('当前为只读模式，请先使用 GitHub 登录后再导入');
        return { ok: false, message: '当前为只读模式' };
    }

    if (!isAdminUser) {
        showToast('仅管理员可执行批量导入');
        return { ok: false, message: '仅管理员可执行批量导入' };
    }

    try {
        const response = await apiFetch('/api/prompts/import-root', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        let result = null;
        try {
            result = await response.json();
        } catch (_) {
            result = null;
        }

        if (!response.ok) {
            if (response.status === 401) {
                clearAuthTokens();
                isAdminUser = false;
                setReadOnlyMode(true);
            }
            const message = result && result.message ? result.message : '根目录导入失败';
            showToast(message);
            return { ok: false, message: message };
        }

        if (result && result.data) {
            promptData = normalizePromptData(result.data);
        }

        const message = result && result.message ? result.message : '根目录导入成功';
        showToast(message);
        return { ok: true, message: message };
    } catch (error) {
        console.error('根目录导入失败', error);
        showToast('导入失败，请检查服务状态');
        return { ok: false, message: '请求失败' };
    }
}

async function activateAdminWithCode(codeRaw) {
    const code = String(codeRaw || '').trim();
    if (!code) {
        showToast('请输入管理员激活码');
        return { ok: false, message: '请输入管理员激活码' };
    }

    if (!hasAuthSession()) {
        showToast('请先登录后再激活管理员权限');
        return { ok: false, message: '未登录' };
    }

    try {
        const response = await apiFetch('/api/auth/activate-admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code: code })
        });

        let result = null;
        try {
            result = await response.json();
        } catch (_) {
            result = null;
        }

        if (!response.ok) {
            const message = result && result.message ? result.message : '管理员激活失败';
            if (response.status === 401) {
                clearAuthTokens();
                setReadOnlyMode(true);
                isAdminUser = false;
                currentUserId = '';
                currentUsername = '';
                currentNickname = '';
            }
            showToast(message);
            return { ok: false, message: message };
        }

        isAdminUser = !!(result && result.isAdmin);
        const message = result && result.message ? result.message : '管理员权限已激活';
        showToast(message);
        return { ok: true, message: message };
    } catch (error) {
        console.error('管理员激活失败', error);
        showToast('请求失败，请检查服务状态');
        return { ok: false, message: '请求失败' };
    }
}

async function updateMyProfile(profileInput) {
    if (isReadOnlyMode || !hasAuthSession()) {
        showToast('请先登录后再修改个人资料');
        return { ok: false, message: '未登录' };
    }

    const nickname = String(profileInput && profileInput.nickname || '').trim();
    if (!nickname) {
        showToast('昵称不能为空');
        return { ok: false, message: '昵称不能为空' };
    }

    try {
        const response = await apiFetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nickname: nickname })
        });

        let result = null;
        try {
            result = await response.json();
        } catch (_) {
            result = null;
        }

        if (!response.ok) {
            if (response.status === 401) {
                clearAuthTokens();
                isAdminUser = false;
                currentUserId = '';
                currentUsername = '';
                currentNickname = '';
                setReadOnlyMode(true);
            }
            const message = result && result.message ? result.message : '资料更新失败';
            showToast(message);
            return { ok: false, message: message };
        }

        const profile = result && result.profile ? result.profile : {};
        currentUserId = profile.userId || currentUserId;
        currentUsername = profile.username || currentUsername;
        currentNickname = profile.nickname || currentUsername;

        const message = result && result.message ? result.message : '资料已更新';
        showToast(message);
        return {
            ok: true,
            message: message,
            profile: {
                userId: currentUserId,
                username: currentUsername,
                nickname: currentNickname
            }
        };
    } catch (error) {
        console.error('更新资料失败', error);
        showToast('请求失败，请检查服务状态');
        return { ok: false, message: '请求失败' };
    }
}

function normalizePromptData(data) {
    const normalized = deepClone(data || {});
    const legacyCharOutfits = [];
    TAB_KEYS.forEach(function (tabKey) {
        if (!Array.isArray(normalized[tabKey])) {
            normalized[tabKey] = [];
        }
    });

    ['chars'].forEach(function (tabKey) {
        normalized[tabKey] = normalized[tabKey].map(function (group) {
            const nextGroup = group && typeof group === 'object' ? deepClone(group) : { id: newId(), title: '未命名分组', items: [] };
            if (!Array.isArray(nextGroup.items)) {
                nextGroup.items = [];
            }
            return nextGroup;
        });
    });

    function toFlatTaggedEntries(sectionList) {
        const entries = [];
        (Array.isArray(sectionList) ? sectionList : []).forEach(function (group) {
            if (!group || typeof group !== 'object') {
                return;
            }

            const isLegacyGroup = Array.isArray(group.items);
            if (!isLegacyGroup) {
                const title = String(group.title || group.name || '').trim();
                const prompt = String(group.prompt || '').trim();
                if (!title || !prompt) {
                    return;
                }
                const tags = Array.isArray(group.tags)
                    ? group.tags.filter(Boolean)
                    : parseTags(group.categoryKey || group.category_key || '');
                entries.push({
                    id: group.id || newId(),
                    title: title,
                    tags: tags,
                    prompt: prompt,
                    groupId: String(group.groupId || group.group_id || '').trim(),
                    ownerUserId: String(group.ownerUserId || '').trim(),
                    uploader: group.uploader || '',
                    uploaderAvatarUrl: group.uploaderAvatarUrl || ''
                });
                return;
            }

            (group.items || []).forEach(function (item) {
                const title = String(item && item.name || '').trim();
                const prompt = String(item && item.prompt || '').trim();
                if (!title || !prompt) {
                    return;
                }

                const tags = parseTags(item && (item.categoryKey || item.category_key) || '');

                entries.push({
                    id: item && item.id || newId(),
                    title: title,
                    tags: tags,
                    prompt: prompt,
                    groupId: String(group.id || '').trim(),
                    ownerUserId: String(item && (item.ownerUserId || '') || group.ownerUserId || '').trim(),
                    uploader: item && item.uploader ? item.uploader : (group.uploader || ''),
                    uploaderAvatarUrl: item && item.uploaderAvatarUrl ? item.uploaderAvatarUrl : (group.uploaderAvatarUrl || '')
                });
            });
        });
        return entries;
    }

    normalized.actions = toFlatTaggedEntries(normalized.actions);
    normalized.env = toFlatTaggedEntries(normalized.env);

    normalized.chars = normalized.chars.map(function (group) {
        const nextGroup = group && typeof group === 'object' ? deepClone(group) : { id: newId(), title: '未命名角色', items: [] };
        const legacyItems = Array.isArray(nextGroup.items) ? nextGroup.items : [];
        nextGroup.items = [];
        if (!Array.isArray(nextGroup.tags)) {
            nextGroup.tags = [];
        }
        const rawDescription = String(nextGroup.description || '').trim();
        if (rawDescription) {
            nextGroup.description = rawDescription;
        } else {
            const firstItem = legacyItems[0] || null;
            nextGroup.description = firstItem && firstItem.prompt ? String(firstItem.prompt).trim() : '';
        }

        legacyItems.forEach(function (item) {
            const promptText = String(item && item.prompt ? item.prompt : '').trim();
            if (!promptText) {
                return;
            }
            legacyCharOutfits.push({
                id: item.id || newId(),
                title: String(item && item.name ? item.name : '未命名服装').trim() || '未命名服装',
                part: '未知',
                style: '',
                sourceCharacter: String(nextGroup.title || '').trim() || '无',
                safety: 'SFW',
                other: '',
                prompt: promptText
            });
        });

        return nextGroup;
    });

    function normalizeOutfitEntry(entry, fallbackStyle) {
        const nextEntry = entry && typeof entry === 'object' ? deepClone(entry) : {};
        const part = String(nextEntry.part || '').trim() || '未知';
        const sourceCharacter = String(nextEntry.sourceCharacter || nextEntry.source_character || '').trim() || '无';
        const safetyText = String(nextEntry.safety || '').trim().toUpperCase();
        return {
            id: nextEntry.id || newId(),
            title: String(nextEntry.title || nextEntry.name || '未命名服装').trim() || '未命名服装',
            part: part,
            style: String(nextEntry.style || fallbackStyle || '').trim(),
            sourceCharacter: sourceCharacter,
            safety: safetyText === 'NSFW' ? 'NSFW' : 'SFW',
            other: String(nextEntry.other || nextEntry.otherTags || nextEntry.other_tags || '').trim(),
            prompt: String(nextEntry.prompt || '').trim()
        };
    }

    const legacyCategoryLabels = {
        tops: '上衣',
        bottoms: '下装',
        shoes: '鞋子',
        headwear: '头饰',
        accessories: '配件',
        weapons: '武器',
        others: '其他'
    };
    const legacyCategoryKeys = Object.keys(legacyCategoryLabels);

    normalized.outfit = normalized.outfit.concat(legacyCharOutfits).reduce(function (result, group) {
        const nextGroup = group && typeof group === 'object' ? deepClone(group) : {};
        const hasLegacyCategories = legacyCategoryKeys.some(function (key) {
            return Array.isArray(nextGroup[key]);
        });

        if (!hasLegacyCategories) {
            result.push(normalizeOutfitEntry(nextGroup, ''));
            return result;
        }

        const styleName = String(nextGroup.title || '').trim();
        legacyCategoryKeys.forEach(function (key) {
            const items = Array.isArray(nextGroup[key]) ? nextGroup[key] : [];
            items.forEach(function (item) {
                result.push(normalizeOutfitEntry({
                    id: item.id || newId(),
                    title: item.name || '未命名服装',
                    part: legacyCategoryLabels[key] || '未知',
                    style: styleName,
                    sourceCharacter: '无',
                    safety: 'SFW',
                    other: '',
                    prompt: item.prompt || ''
                }, styleName));
            });
        });

        return result;
    }, []);

    return normalized;
}
