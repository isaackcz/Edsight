// Dashboard Export Functionality
// Handles Excel export operations

(function() {
    'use strict';
    
    const EXPORT_ENDPOINT = '/api/admin/dashboard/export/';
    
    /**
     * Export users to Excel
     */
    function exportUsers(filters = {}) {
        const params = new URLSearchParams({
            type: 'users'
        });
        
        if (filters.search) {
            params.append('search', filters.search);
        }
        if (filters.role) {
            params.append('role', filters.role);
        }
        if (filters.status) {
            params.append('status', filters.status);
        }
        
        window.location.href = `${EXPORT_ENDPOINT}?${params.toString()}`;
    }
    
    /**
     * Export activity to Excel
     */
    function exportActivity() {
        const params = new URLSearchParams({
            type: 'activity'
        });
        
        window.location.href = `${EXPORT_ENDPOINT}?${params.toString()}`;
    }
    
    /**
     * Export all dashboard data
     */
    function exportAll() {
        // Export both users and activity
        exportUsers();
        // Note: For "all" export, we might want to create a combined export
        // For now, export users first
    }
    
    // Export functions
    window.DashboardExport = {
        users: exportUsers,
        activity: exportActivity,
        all: exportAll
    };
})();

