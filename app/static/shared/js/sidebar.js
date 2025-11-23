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
    const hamburger = document.querySelector('.hamburger');
    const dashboardContainer = document.querySelector('.dashboard-container');
    
    if (hamburger && dashboardContainer) {
        hamburger.addEventListener('click', function() {
            dashboardContainer.classList.toggle('sidebar-collapsed');
        });
    }
}
