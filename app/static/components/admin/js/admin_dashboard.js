// Main Dashboard Coordinator
// Initializes all dashboard modules

(function() {
    'use strict';
    
    /**
     * Initialize all dashboard modules
     */
    function initDashboard() {
        // Check if required elements exist
        const statsSection = document.getElementById('stat-total-users');
        const usersTable = document.getElementById('usersTableBody');
        const activityList = document.getElementById('activityList');
        
        // Initialize modules if their sections exist
        if (statsSection && typeof window.DashboardStats !== 'undefined') {
            window.DashboardStats.load();
        }
        
        if (usersTable && typeof window.DashboardUsers !== 'undefined') {
            window.DashboardUsers.load(1);
        }
        
        if (activityList && typeof window.DashboardActivity !== 'undefined') {
            window.DashboardActivity.load(1);
        }
    }
    
    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', function() {
        initDashboard();
    });
    
    // Export init function for manual initialization
    window.AdminDashboard = {
        init: initDashboard
    };
})();

