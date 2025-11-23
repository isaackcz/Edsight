// Recent Activity Handler
// Handles activity log pagination and display

(function() {
    'use strict';
    
    const ACTIVITY_ENDPOINT = '/api/admin/dashboard/activity/';
    
    let currentPage = 1;
    
    /**
     * Load activity logs from API
     */
    function loadActivity(page = 1) {
        currentPage = page;
        
        const params = new URLSearchParams({
            page: page.toString(),
            page_size: '100'
        });
        
        // Show loading state
        showLoadingState(true);
        
        fetch(`${ACTIVITY_ENDPOINT}?${params.toString()}`, {
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
            if (data.success && data.activities) {
                renderActivityList(data.activities);
                renderPagination(data.pagination);
            } else {
                showError('Failed to load activity: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error loading activity:', error);
            showError('Error loading activity. Please try again.');
        })
        .finally(() => {
            showLoadingState(false);
        });
    }
    
    /**
     * Render activity list
     */
    function renderActivityList(activities) {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;
        
        if (activities.length === 0) {
            activityList.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="ph-bold ph-info" style="font-size: 2rem;"></i>
                    <p class="mt-2">No recent activity</p>
                </div>
            `;
            return;
        }
        
        activityList.innerHTML = activities.map(activity => {
            const actionIcon = getActionIcon(activity.action);
            
            return `
                <div class="activity-item mb-3 pb-3 border-bottom">
                    <div class="d-flex gap-3">
                        <div class="activity-icon" style="width: 40px; height: 40px; border-radius: 4px; background: rgba(205, 225, 241, 0.3); display: flex; align-items: center; justify-content: center;">
                            <i class="ph-bold ${actionIcon}"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="fw-bold mb-1">${escapeHtml(activity.action || 'Activity')}</div>
                            <div class="text-muted small mb-1">${escapeHtml(activity.username_with_role || 'System')}</div>
                            <div class="text-muted small">
                                <i class="ph-bold ph-clock"></i> ${escapeHtml(activity.timestamp_relative || activity.date || 'Recently')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    /**
     * Get icon for action type
     */
    function getActionIcon(action) {
        const iconMap = {
            'create': 'ph-plus-circle',
            'update': 'ph-pencil',
            'delete': 'ph-trash',
            'login': 'ph-sign-in',
            'logout': 'ph-sign-out',
            'assign_role': 'ph-shield',
            'reset_password': 'ph-key',
        };
        
        return iconMap[action?.toLowerCase()] || 'ph-circle';
    }
    
    /**
     * Render pagination controls
     */
    function renderPagination(pagination) {
        const paginationEl = document.getElementById('activityPagination');
        if (!paginationEl || !pagination) return;
        
        if (pagination.total_pages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }
        
        let html = '';
        
        // Previous button
        html += `
            <li class="page-item ${!pagination.has_previous ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${pagination.previous_page || 1}" ${!pagination.has_previous ? 'tabindex="-1" aria-disabled="true"' : ''}>
                    Previous
                </a>
            </li>
        `;
        
        // Page numbers (simplified for activity sidebar)
        const startPage = Math.max(1, pagination.page - 1);
        const endPage = Math.min(pagination.total_pages, pagination.page + 1);
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${i === pagination.page ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }
        
        // Next button
        html += `
            <li class="page-item ${!pagination.has_next ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${pagination.next_page || pagination.total_pages}" ${!pagination.has_next ? 'tabindex="-1" aria-disabled="true"' : ''}>
                    Next
                </a>
            </li>
        `;
        
        paginationEl.innerHTML = html;
        
        // Attach click handlers
        paginationEl.querySelectorAll('a.page-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const page = parseInt(this.dataset.page);
                if (page && page !== currentPage) {
                    loadActivity(page);
                }
            });
        });
    }
    
    /**
     * Show/hide loading state
     */
    function showLoadingState(show) {
        const loadingEl = document.getElementById('activityLoadingState');
        const activityList = document.getElementById('activityList');
        
        if (loadingEl) loadingEl.style.display = show ? 'block' : 'none';
        if (activityList) activityList.style.display = show ? 'none' : 'block';
    }
    
    /**
     * Show error message
     */
    function showError(message) {
        const activityList = document.getElementById('activityList');
        if (activityList) {
            activityList.innerHTML = `
                <div class="text-center py-4 text-danger">
                    <i class="ph-bold ph-warning" style="font-size: 2rem;"></i>
                    <p class="mt-2">${escapeHtml(message)}</p>
                </div>
            `;
        }
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Handle view all button
     */
    function handleViewAll() {
        const viewAllBtn = document.getElementById('viewAllActivityBtn');
        if (!viewAllBtn) return;
        
        viewAllBtn.addEventListener('click', function() {
            // Redirect to logs page or open full activity modal
            window.location.href = '/admin/logs/';
        });
    }
    
    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', function() {
        handleViewAll();
        loadActivity(1);
    });
    
    // Export functions
    window.DashboardActivity = {
        load: loadActivity,
        refresh: () => loadActivity(currentPage),
    };
})();

