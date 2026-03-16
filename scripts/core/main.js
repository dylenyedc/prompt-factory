async function init() {
    consumeAuthTokensFromUrlHash();
    initAuthUI();
    bindImportEvents();
    promptData = await loadPromptData();
    await loadMyProfile();
    renderAllTabs();
    bindListEvents();
    bindGroupEvents();
    bindCharSearchEvents();
    bindTagFilterEvents();
    bindCharSettingsModalEvents();
    initSidebarNavigation();
    updateReadOnlyUI();

    if (isReadOnlyMode) {
        showToast('当前为只读模式，登录后可修改数据');
    }
}

function bindImportEvents() {
    const importBtn = document.getElementById('import-prompts-btn');
    const importInput = document.getElementById('import-prompts-file');
    if (!importBtn || !importInput) {
        return;
    }

    importBtn.addEventListener('click', function () {
        if (isReadOnlyMode || !hasAuthSession()) {
            showToast('当前为只读模式，请先登录');
            return;
        }
        if (!isAdminUser) {
            showToast('仅管理员可执行批量导入');
            return;
        }
        importInput.value = '';
        importInput.click();
    });

    importInput.addEventListener('change', async function () {
        const file = importInput.files && importInput.files[0] ? importInput.files[0] : null;
        if (!file) {
            return;
        }

        const confirmed = window.confirm('导入将覆盖当前账号下的全部提示词数据，是否继续？');
        if (!confirmed) {
            importInput.value = '';
            return;
        }

        const result = await importPromptDataFromJsonFile(file);
        importInput.value = '';
        if (!result || !result.ok) {
            return;
        }

        renderAllTabs();
    });
}

function initAuthUI() {
    const status = document.getElementById('auth-status-text');
    const profilePreview = document.getElementById('profile-preview');
    const profileNicknameInput = document.getElementById('profile-nickname-input');
    const profileSaveBtn = document.getElementById('profile-save-btn');

    const loginBtn = document.getElementById('github-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const exportBtn = document.getElementById('export-prompts-btn');
    const activateBtn = document.getElementById('admin-activate-btn');
    const activationCodeInput = document.getElementById('admin-activation-code-input');

    function getCurrentDisplayName() {
        const nickname = String(currentNickname || '').trim();
        const username = String(currentUsername || '').trim();
        return nickname || username || '未登录用户';
    }

    function renderProfilePreview() {
        if (!profilePreview) {
            return;
        }

        const displayName = getCurrentDisplayName();
        const accountText = hasAuthSession() && !isReadOnlyMode
            ? ('账号：' + escapeHtml(currentUsername || currentUserId || '已登录'))
            : '当前未登录';
        const avatarHtml = '<div class="profile-avatar fallback">' + escapeHtml(displayName.slice(0, 1).toUpperCase()) + '</div>';
        profilePreview.innerHTML = '<div class="profile-preview-inner">' + avatarHtml + '<div><div class="profile-name">' + escapeHtml(displayName) + '</div><div class="hint-text">' + accountText + '</div></div></div>';
    }

    function syncProfileForm() {
        if (profileNicknameInput) {
            profileNicknameInput.value = currentNickname || currentUsername || '';
        }
    }

    const updateStatus = function () {
        if (!status) {
            return;
        }
        if (hasAuthSession() && !isReadOnlyMode) {
            status.textContent = isAdminUser
                ? '当前已登录（GitHub，管理员，可编辑）'
                : '当前已登录（GitHub，普通用户，可编辑）';
            renderProfilePreview();
            syncProfileForm();
            return;
        }
        status.textContent = '当前未登录（只读模式）';
        renderProfilePreview();
        syncProfileForm();
    };

    updateStatus();

    if (loginBtn) {
        loginBtn.addEventListener('click', function () {
            authLoginWithGitHub(window.location.pathname || '/');
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            authLogout();
            if (typeof setReadOnlyMode === 'function') {
                setReadOnlyMode(true);
            }
            updateStatus();
            showToast('已退出登录');
            window.location.reload();
        });
    }

    if (profileSaveBtn) {
        profileSaveBtn.addEventListener('click', async function () {
            if (isReadOnlyMode || !hasAuthSession()) {
                showToast('请先登录后再修改个人资料');
                return;
            }

            const result = await updateMyProfile({
                nickname: profileNicknameInput ? profileNicknameInput.value : ''
            });
            if (!result || !result.ok) {
                return;
            }

            renderProfilePreview();
            updateReadOnlyUI();
            promptData = await loadPromptData();
            renderAllTabs();
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', async function () {
            await downloadPromptDataExport();
        });
    }

    if (activateBtn && activationCodeInput) {
        activateBtn.addEventListener('click', async function () {
            const result = await activateAdminWithCode(activationCodeInput.value || '');
            if (!result.ok) {
                return;
            }
            activationCodeInput.value = '';
            updateReadOnlyUI();
        });

        activationCodeInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                activateBtn.click();
            }
        });
    }

    window.updateReadOnlyUI = function () {
        const tip = document.getElementById('readonly-mode-tip');
        if (tip) {
            tip.textContent = isReadOnlyMode
                ? '当前为只读模式：可浏览数据，登录后才能新增、编辑、删除。'
                : '当前为编辑模式：你可以新增、编辑、删除自己的数据。';
        }

        document.body.classList.toggle('is-readonly-mode', isReadOnlyMode);

        [
            'char-group-title-input',
            'char-group-add-btn',
            'outfit-group-title-input',
            'outfit-group-add-btn',
            'char-settings-edit-tags-btn',
            'char-settings-rename-btn',
            'char-settings-delete-btn',
            'char-settings-editor-input',
            'char-settings-editor-textarea',
            'char-settings-editor-save-btn',
            'profile-nickname-input',
            'profile-save-btn'
        ].forEach(function (id) {
            const node = document.getElementById(id);
            if (node) {
                node.disabled = !!isReadOnlyMode;
            }
        });

        const importBtn = document.getElementById('import-prompts-btn');
        if (importBtn) {
            importBtn.disabled = !!isReadOnlyMode || !isAdminUser;
            if (isReadOnlyMode) {
                importBtn.title = '当前为只读模式，请先登录';
            } else if (!isAdminUser) {
                importBtn.title = '仅管理员可执行批量导入';
            } else {
                importBtn.title = '';
            }
        }

        const activateBtnNode = document.getElementById('admin-activate-btn');
        const activateInputNode = document.getElementById('admin-activation-code-input');
        if (activateBtnNode) {
            activateBtnNode.disabled = !!isReadOnlyMode || isAdminUser;
        }
        if (activateInputNode) {
            activateInputNode.disabled = !!isReadOnlyMode || isAdminUser;
        }

        updateStatus();
        renderProfilePreview();
    };
}

function initSidebarNavigation() {
    const sidebar = document.getElementById('left-sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const mask = document.getElementById('sidebar-mask');
    const navItems = document.querySelectorAll('.sidebar-nav-item');
    const pages = {
        prompts: document.getElementById('app-page-prompts'),
        community: document.getElementById('app-page-community'),
        profile: document.getElementById('app-page-profile')
    };

    if (!sidebar || !toggleBtn || !mask || !navItems.length) {
        return;
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        mask.classList.remove('active');
    }

    function toggleSidebar() {
        const willOpen = !sidebar.classList.contains('open');
        sidebar.classList.toggle('open', willOpen);
        mask.classList.toggle('active', willOpen);
    }

    function setPage(pageKey) {
        Object.keys(pages).forEach(function (key) {
            const page = pages[key];
            if (!page) {
                return;
            }
            page.classList.toggle('active', key === pageKey);
        });

        navItems.forEach(function (item) {
            item.classList.toggle('active', item.dataset.page === pageKey);
        });

        closeSidebar();
        window.scrollTo(0, 0);
    }

    toggleBtn.addEventListener('click', toggleSidebar);
    mask.addEventListener('click', closeSidebar);

    navItems.forEach(function (item) {
        item.addEventListener('click', function () {
            const pageKey = item.dataset.page || 'prompts';
            setPage(pageKey);
        });
    });
}

window.switchTab = switchTab;

init();
