/**
 * Statistics cards module
 * Handles loading and displaying statistics summary cards
 */

(function() {
    'use strict';
    
    /**
     * Load and display statistics
     */
    function loadStatistics() {
        fetch('/api/admin/role-analytics/stats/', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data) {
                updateStatisticsCards(data.data);
            } else {
                console.error('Error loading statistics:', data.error);
            }
        })
        .catch(error => {
            console.error('Error fetching statistics:', error);
        });
    }
    
    /**
     * Update statistics cards with data
     */
    function updateStatisticsCards(stats) {
        // Role counts
        const roleCounts = stats.role_counts || {};
        setElementText('stat-role-central', formatNumber(roleCounts.central || 0));
        setElementText('stat-role-region', formatNumber(roleCounts.region || 0));
        setElementText('stat-role-division', formatNumber(roleCounts.division || 0));
        setElementText('stat-role-district', formatNumber(roleCounts.district || 0));
        setElementText('stat-role-school', formatNumber(roleCounts.school || 0));
        
        // Permission counts
        const permissionCounts = stats.permission_counts || {};
        setElementText('stat-permission-create-users', formatNumber(permissionCounts.can_create_users || 0));
        setElementText('stat-permission-manage-users', formatNumber(permissionCounts.can_manage_users || 0));
        setElementText('stat-permission-set-deadlines', formatNumber(permissionCounts.can_set_deadlines || 0));
        setElementText('stat-permission-approve-submissions', formatNumber(permissionCounts.can_approve_submissions || 0));
        setElementText('stat-permission-view-logs', formatNumber(permissionCounts.can_view_system_logs || 0));
    }
    
    /**
     * Set element text content
     */
    function setElementText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }
    
    /**
     * Format number with commas
     */
    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    /**
     * Initialize statistics module
     */
    function init() {
        loadStatistics();
    }
    
    // Export for external access
    window.RoleAnalyticsStats = {
        load: loadStatistics,
        init: init
    };
    
    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

