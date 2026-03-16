async function init() {
    promptData = await loadPromptData();
    renderAllTabs();
    bindListEvents();
    bindGroupEvents();
    bindCharSearchEvents();
    bindTagFilterEvents();
    bindCharSettingsModalEvents();
    initSidebarNavigation();
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
