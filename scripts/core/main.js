async function init() {
    await initAuth();
    promptData = await loadPromptData();
    renderAllTabs();
    bindListEvents();
    bindGroupEvents();
    bindCharSearchEvents();
    bindTagFilterEvents();
    initSidebarNavigation();
}

async function initAuth() {
    const user = await auth.getMe();
    updateAuthUI(user);
}

function updateAuthUI(user) {
    const userInfoEl = document.getElementById('auth-user-info');
    const logoutBtn = document.getElementById('auth-logout-btn');
    if (user) {
        if (userInfoEl) userInfoEl.textContent = user.email;
        if (logoutBtn) logoutBtn.style.display = '';
    } else {
        if (userInfoEl) userInfoEl.textContent = '';
        if (logoutBtn) logoutBtn.style.display = 'none';
        showAuthModal();
    }
}

function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'flex';
}

function hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
}

function bindAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const panelLogin = document.getElementById('auth-panel-login');
    const panelRegister = document.getElementById('auth-panel-register');

    function switchAuthTab(tab) {
        const isLogin = tab === 'login';
        tabLogin.classList.toggle('active', isLogin);
        tabRegister.classList.toggle('active', !isLogin);
        panelLogin.style.display = isLogin ? '' : 'none';
        panelRegister.style.display = isLogin ? 'none' : '';
    }

    tabLogin.addEventListener('click', function () { switchAuthTab('login'); });
    tabRegister.addEventListener('click', function () { switchAuthTab('register'); });

    // Login form
    document.getElementById('auth-login-btn').addEventListener('click', async function () {
        const email = document.getElementById('auth-login-email').value.trim();
        const password = document.getElementById('auth-login-password').value;
        const errEl = document.getElementById('auth-login-error');
        errEl.textContent = '';
        if (!email || !password) { errEl.textContent = '请填写邮箱和密码'; return; }
        const { ok, body } = await auth.login(email, password);
        if (ok) {
            hideAuthModal();
            updateAuthUI(auth.currentUser());
            promptData = await loadPromptData();
            renderAllTabs();
        } else {
            errEl.textContent = body.message || '登录失败';
        }
    });

    // Register form
    document.getElementById('auth-register-btn').addEventListener('click', async function () {
        const email = document.getElementById('auth-register-email').value.trim();
        const password = document.getElementById('auth-register-password').value;
        const errEl = document.getElementById('auth-register-error');
        errEl.textContent = '';
        if (!email || !password) { errEl.textContent = '请填写邮箱和密码'; return; }
        const { ok, body } = await auth.register(email, password);
        if (ok) {
            hideAuthModal();
            updateAuthUI(auth.currentUser());
            promptData = await loadPromptData();
            renderAllTabs();
        } else {
            errEl.textContent = body.message || '注册失败';
        }
    });

    // Logout button (in sidebar)
    const logoutBtn = document.getElementById('auth-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function () {
            await auth.logout();
            promptData = normalizePromptData({});
            renderAllTabs();
            updateAuthUI(null);
        });
    }
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

    bindAuthModal();
}

window.switchTab = switchTab;

init();
