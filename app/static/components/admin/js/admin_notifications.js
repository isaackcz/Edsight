// Admin Notifications Handler
// Handles loading and displaying notifications in the header

(function() {
    'use strict';
    
    const NOTIFICATIONS_ENDPOINT = '/api/admin/form-management/notifications/';
    const REFRESH_INTERVAL = 30 * 1000; // 30 seconds
    
    let refreshTimer = null;
    
    /**
     * Load notifications from API
     */
    function loadNotifications() {
        fetch(NOTIFICATIONS_ENDPOINT, {
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
            if (data.success) {
                updateNotificationBadge(data.unread_count || 0);
                renderNotifications(data.notifications || []);
            } else {
                console.error('Failed to load notifications:', data.message || 'Unknown error');
                updateNotificationBadge(0);
                renderNotifications([]);
            }
        })
        .catch(error => {
            console.error('Error loading notifications:', error);
            updateNotificationBadge(0);
            renderNotifications([]);
        });
    }
    
    /**
     * Update notification badge count
     */
    function updateNotificationBadge(count) {
        const badge = document.querySelector('.notification .notif-badge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'inline-block';
            } else {
                badge.textContent = '0';
                badge.style.display = 'none';
            }
        }
    }
    
    /**
     * Render notifications list
     */
    function renderNotifications(notifications) {
        const notificationsList = document.querySelector('[data-notifications-list]');
        const emptyState = document.querySelector('[data-notifications-empty]');
        
        if (!notificationsList) return;
        
        if (notifications.length === 0) {
            notificationsList.innerHTML = '';
            if (emptyState) {
                emptyState.style.display = 'block';
            }
            return;
        }
        
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        notificationsList.innerHTML = notifications.map(notif => {
            const priorityClass = getPriorityClass(notif.priority);
            const typeIcon = getNotificationIcon(notif.type);
            const isUnread = !notif.is_read;
            const timeAgo = formatRelativeTime(notif.created_at);
            
            return `
                <div class="notif-item ${isUnread ? 'unread' : ''}" data-notification-id="${notif.id}" ${notif.action_url ? `data-action-url="${escapeHtml(notif.action_url)}"` : ''}>
                    <div class="notif-avatar">
                        ${notif.avatar ? 
                            `<img src="${escapeHtml(notif.avatar)}" alt="${escapeHtml(notif.sender)}" />` : 
                            `<i class="ph-bold ph-user"></i>`
                        }
                    </div>
                    <div class="notif-content">
                        <div class="notif-title">${escapeHtml(notif.title)}</div>
                        <div class="notif-message">${escapeHtml(notif.message)}</div>
                        <div class="notif-meta">
                            <span class="notif-type"><i class="ph-bold ${typeIcon}"></i> ${escapeHtml(notif.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()))}</span>
                            <span class="notif-time"><i class="ph-bold ph-clock"></i> ${escapeHtml(timeAgo)}</span>
                        </div>
                    </div>
                    ${isUnread ? '<div class="notif-unread-indicator"></div>' : ''}
                </div>
            `;
        }).join('');
        
        // Attach click handlers
        notificationsList.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', function() {
                const notificationId = this.dataset.notificationId;
                const actionUrl = this.dataset.actionUrl;
                
                // Mark as read (visual feedback)
                this.classList.remove('unread');
                const indicator = this.querySelector('.notif-unread-indicator');
                if (indicator) {
                    indicator.remove();
                }
                
                // Navigate if action URL exists
                if (actionUrl) {
                    window.location.href = actionUrl;
                }
            });
        });
    }
    
    /**
     * Get priority CSS class
     */
    function getPriorityClass(priority) {
        const classMap = {
            'urgent': 'priority-urgent',
            'high': 'priority-high',
            'medium': 'priority-medium',
            'low': 'priority-low'
        };
        return classMap[priority] || 'priority-medium';
    }
    
    /**
     * Get icon for notification type
     */
    function getNotificationIcon(type) {
        const iconMap = {
            'form_submitted': 'ph-file-plus',
            'form_approved': 'ph-check-circle',
            'form_returned': 'ph-arrow-counter-clockwise',
            'form_rejected': 'ph-x-circle',
            'deadline_reminder': 'ph-clock-countdown',
            'overdue_notification': 'ph-warning'
        };
        return iconMap[type] || 'ph-bell';
    }
    
    /**
     * Format relative time
     */
    function formatRelativeTime(isoString) {
        if (!isoString) return 'Recently';
        
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString();
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
     * Start auto-refresh timer
     */
    function startAutoRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
        }
        
        refreshTimer = setInterval(() => {
            loadNotifications();
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
    
    /**
     * Handle notification panel visibility
     */
    function handlePanelVisibility() {
        const notifPanel = document.querySelector('.notifications-panel');
        if (!notifPanel) return;
        
        // Reload notifications when panel is opened
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'aria-hidden') {
                    const isVisible = notifPanel.getAttribute('aria-hidden') === 'false';
                    if (isVisible) {
                        loadNotifications();
                    }
                }
            });
        });
        
        observer.observe(notifPanel, {
            attributes: true,
            attributeFilter: ['aria-hidden']
        });
    }
    
    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', function() {
        loadNotifications();
        handlePanelVisibility();
        startAutoRefresh();
        
        // Stop refresh when page becomes hidden
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                stopAutoRefresh();
            } else {
                loadNotifications();
                startAutoRefresh();
            }
        });
    });
    
    // Export functions for manual refresh
    window.AdminNotifications = {
        load: loadNotifications,
        refresh: loadNotifications,
        stopAutoRefresh: stopAutoRefresh,
        startAutoRefresh: startAutoRefresh
    };
})();

