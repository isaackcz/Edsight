// admin-dashboard.js
document.addEventListener('DOMContentLoaded', function() {
    // Toggle sidebar on mobile
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    // Add event listeners to menu items for visual feedback
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Only prevent default for items without proper URLs (href="#")
            if (this.getAttribute('href') === '#') {
                e.preventDefault();
            }
            // Let the browser handle navigation for proper URLs
        });
    });
    
    // Table row selection
    const tableRows = document.querySelectorAll('.data-table tbody tr');
    tableRows.forEach(row => {
        row.addEventListener('click', function(e) {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
                this.classList.toggle('selected');
            }
        });
    });
    
    // Demo data for charts (if we were to implement them)
    console.log('Admin dashboard initialized');
    
    // Simulate loading data
    setTimeout(() => {
        document.querySelector('.admin-container').classList.add('loaded');
    }, 500);
});