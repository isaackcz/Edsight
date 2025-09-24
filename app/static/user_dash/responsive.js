document.addEventListener('DOMContentLoaded', () => {
    // Sidebar toggle functionality for both desktop and mobile
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            if (window.innerWidth > 768) {
                // Desktop behavior
                sidebar.classList.toggle('collapsed');
                const mainContent = document.querySelector('.main-content');
                if (mainContent) {
                    mainContent.classList.toggle('expanded');
                }
            } else {
                // Mobile behavior
                sidebar.classList.toggle('active');
            }
        });
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('active')) {
            if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        }
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && sidebar) {
            sidebar.classList.remove('active');
        }
    });

    // Mobile navbar navigation
    const mobileNavItems = document.querySelectorAll('.mobile-navbar .nav-item');
    const pages = document.querySelectorAll('.page');
    const sidebarNavItems = document.querySelectorAll('.sidebar .menu-item');

    // Handle mobile navbar clicks
    mobileNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Handle logout
            if (item.id === 'mobile-logout-btn') {
                handleLogout();
                return;
            }

            const targetPage = item.getAttribute('data-page');
            if (targetPage) {
                // Update mobile navbar active state
                mobileNavItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Update sidebar active state (for desktop)
                sidebarNavItems.forEach(nav => nav.classList.remove('active'));
                const correspondingSidebarItem = document.querySelector(`.sidebar .menu-item[data-page="${targetPage}"]`);
                if (correspondingSidebarItem) {
                    correspondingSidebarItem.classList.add('active');
                }
                
                // Show corresponding page
                pages.forEach(page => page.classList.remove('active'));
                const targetPageElement = document.getElementById(`${targetPage}-page`);
                if (targetPageElement) {
                    targetPageElement.classList.add('active');
                }
            }
        });
    });

    // Handle mobile header actions
    const mobileNotification = document.querySelector('.mobile-header-actions .notification');
    const mobileUserAvatar = document.querySelector('.mobile-header-actions .user-avatar');
    
    // Notification click
    if (mobileNotification) {
        mobileNotification.addEventListener('click', function() {
            // Trigger the same notification functionality as desktop
            const desktopNotification = document.querySelector('.header-actions .notification');
            if (desktopNotification) {
                desktopNotification.click();
            }
        });
    }
    
    // Theme toggle removed - project does not support dark mode
    
    // User avatar click
    if (mobileUserAvatar) {
        mobileUserAvatar.addEventListener('click', function() {
            // Trigger the same user menu functionality as desktop
            const desktopUserMenu = document.querySelector('.header-actions .user-menu');
            if (desktopUserMenu) {
                desktopUserMenu.click();
            }
        });
    }

    // Sync sidebar navigation with mobile navbar
    sidebarNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetPage = item.getAttribute('data-page');
            if (targetPage) {
                // Update mobile navbar active state
                mobileNavItems.forEach(nav => nav.classList.remove('active'));
                const correspondingMobileItem = document.querySelector(`.mobile-navbar .nav-item[data-page="${targetPage}"]`);
                if (correspondingMobileItem) {
                    correspondingMobileItem.classList.add('active');
                }
            }
        });
    });

    // Logout function
    function handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            // Add your logout logic here
            window.location.href = '/logout/';
        }
    }

    // Set flag to prevent duplicate mobile logout handlers
    window.mobileLogoutHandled = true;
});