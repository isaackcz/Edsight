// Sidebar Dropdown Functionality
document.addEventListener('DOMContentLoaded', function() {
    initializeSidebarDropdowns();
    initializeHamburgerMenu();
});

function initializeSidebarDropdowns() {
    const dropdowns = document.querySelectorAll('.menu-item-dropdown');
    
    dropdowns.forEach(dropdown => {
        const header = dropdown.querySelector('.menu-item-header');
        if (header) {
            header.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Toggle active state
                dropdown.classList.toggle('active');
                
                // Close other dropdowns if needed (optional - can allow multiple open)
                // const otherDropdowns = document.querySelectorAll('.menu-item-dropdown.active');
                // otherDropdowns.forEach(other => {
                //     if (other !== dropdown) {
                //         other.classList.remove('active');
                //     }
                // });
            });
        }
    });
    
    // Keep Reports dropdown open if on a reports page
    const reportsDropdown = document.querySelector('.menu-item-dropdown[data-dropdown="reports"]');
    if (reportsDropdown && window.location.pathname.startsWith('/reports/')) {
        reportsDropdown.classList.add('active');
    }
}

function initializeHamburgerMenu() {
    // Support multiple selectors for hamburger button
    const hamburger = document.querySelector('.hamburger, #sidebar-toggle, .hamburger-btn');
    const dashboardContainer = document.querySelector('.dashboard-container');
    
    if (hamburger && dashboardContainer) {
        hamburger.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dashboardContainer.classList.toggle('sidebar-collapsed');
            
            // Update aria-expanded attribute
            const isCollapsed = dashboardContainer.classList.contains('sidebar-collapsed');
            hamburger.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
            hamburger.title = isCollapsed ? 'Open menu' : 'Close menu';
        });
        
        // Close mobile sidebar when clicking the backdrop
        document.addEventListener('click', function(e) {
            const isMobile = window.matchMedia('(max-width: 1000px)').matches;
            if (!isMobile) return;
            
            if (!dashboardContainer.classList.contains('sidebar-collapsed')) return;
            
            // If click happened inside the sidebar or on the hamburger, ignore
            const sidebarEl = document.querySelector('.sidebar');
            const hamburgerEl = document.querySelector('.hamburger, #sidebar-toggle, .hamburger-btn');
            
            if (sidebarEl && (sidebarEl.contains(e.target) || sidebarEl === e.target)) return;
            if (hamburgerEl && (hamburgerEl.contains(e.target) || hamburgerEl === e.target)) return;
            
            // Otherwise close the mobile sidebar
            dashboardContainer.classList.remove('sidebar-collapsed');
            hamburger.setAttribute('aria-expanded', 'false');
        });
        
        // Close mobile sidebar on Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const isMobile = window.matchMedia('(max-width: 1000px)').matches;
                if (!isMobile) return;
                
                if (dashboardContainer.classList.contains('sidebar-collapsed')) {
                    dashboardContainer.classList.remove('sidebar-collapsed');
                    hamburger.setAttribute('aria-expanded', 'false');
                }
            }
        });
    }
}
