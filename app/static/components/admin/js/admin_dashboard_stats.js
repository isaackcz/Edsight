// Dashboard Statistics Loader
// Handles loading and auto-refreshing dashboard statistics

(function() {
    'use strict';
    
    const STATS_ENDPOINT = '/api/admin/dashboard/statistics/';
    const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
    
    let refreshTimer = null;
    
    /**
     * Load dashboard statistics from API
     */
    function loadStatistics() {
        fetch(STATS_ENDPOINT, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.statistics) {
                updateStatisticsDisplay(data.statistics);
            } else {
                console.error('Failed to load statistics:', data.error || 'Unknown error');
                showStatisticsError();
            }
        })
        .catch(error => {
            console.error('Error loading statistics:', error);
            showStatisticsError();
        });
    }
    
    /**
     * Update statistics display with new data
     */
    function updateStatisticsDisplay(stats) {
        const totalUsersEl = document.getElementById('stat-total-users');
        const suspiciousEl = document.getElementById('stat-suspicious-activity');
        const activeSessionsEl = document.getElementById('stat-active-sessions');
        const suspendedEl = document.getElementById('stat-suspended-accounts');
        
        if (totalUsersEl) totalUsersEl.textContent = stats.total_users || 0;
        if (suspiciousEl) suspiciousEl.textContent = stats.suspicious_activity || 0;
        if (activeSessionsEl) activeSessionsEl.textContent = stats.active_sessions || 0;
        if (suspendedEl) suspendedEl.textContent = stats.suspended_accounts || 0;
    }
    
    /**
     * Show error state for statistics
     */
    function showStatisticsError() {
        const elements = [
            document.getElementById('stat-total-users'),
            document.getElementById('stat-suspicious-activity'),
            document.getElementById('stat-active-sessions'),
            document.getElementById('stat-suspended-accounts')
        ];
        
        elements.forEach(el => {
            if (el) el.textContent = '--';
        });
    }
    
    /**
     * Start auto-refresh timer
     */
    function startAutoRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
        }
        
        refreshTimer = setInterval(() => {
            loadStatistics();
        }, REFRESH_INTERVAL);
    }
    
    /**
     * Stop auto-refresh timer
     */
    function stopAutoRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
    }
    
    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', function() {
        // Load statistics immediately
        loadStatistics();
        
        // Start auto-refresh
        startAutoRefresh();
        
        // Stop refresh when page becomes hidden
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                stopAutoRefresh();
            } else {
                loadStatistics();
                startAutoRefresh();
            }
        });
    });
    
    // Export functions for manual refresh if needed
    window.DashboardStats = {
        load: loadStatistics,
        refresh: loadStatistics,
        stopAutoRefresh: stopAutoRefresh,
        startAutoRefresh: startAutoRefresh
    };
})();

