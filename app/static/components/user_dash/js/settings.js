/**
 * User Dashboard - Settings Page JavaScript
 * Handles profile, security, sessions, and audit logs
 */

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeSettings();
});

/**
 * Main initialization function
 */
function initializeSettings() {
    initializeProfileForm();
    initializeSecurityForm();
    initializeSessionManagement();
    initializeAuditLogs();
    initializePreferences();
}

/**
 * Initialize profile information form
 */
function initializeProfileForm() {
    const profileForm = document.getElementById('profileForm');
    if (!profileForm) return;
    
    profileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleProfileUpdate();
    });
}

/**
 * Handle profile update
 */
function handleProfileUpdate() {
    const formData = new FormData(document.getElementById('profileForm'));
    const data = Object.fromEntries(formData);
    
    console.log('Updating profile:', data);
    showNotification('Profile updated successfully', 'success');
    
    // Placeholder for API call
    // TODO: Implement actual profile update API call
}

/**
 * Initialize security/password form
 */
function initializeSecurityForm() {
    const securityForm = document.getElementById('securityForm');
    if (!securityForm) return;
    
    securityForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handlePasswordUpdate();
    });
}

/**
 * Handle password update
 */
function handlePasswordUpdate() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification('Please fill in all password fields', 'warning');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('New passwords do not match', 'danger');
        return;
    }
    
    if (newPassword.length < 8) {
        showNotification('Password must be at least 8 characters long', 'warning');
        return;
    }
    
    console.log('Updating password...');
    showNotification('Password updated successfully', 'success');
    
    // Clear form
    document.getElementById('securityForm').reset();
    
    // Placeholder for API call
    // TODO: Implement actual password update API call
}

/**
 * Initialize session management
 */
function initializeSessionManagement() {
    loadActiveSessions();
    
    // Handle end session buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('end-session-btn')) {
            const sessionId = e.target.dataset.sessionId;
            handleEndSession(sessionId);
        }
    });
}

/**
 * Load active sessions
 */
function loadActiveSessions() {
    // Placeholder data
    const sessions = [
        {
            id: 'session-1',
            device: 'Windows Desktop',
            deviceIcon: 'ph-desktop',
            location: 'Manila, Philippines',
            lastActive: 'Active now',
            isCurrent: true
        },
        {
            id: 'session-2',
            device: 'Android Phone',
            deviceIcon: 'ph-device-mobile',
            location: 'Quezon City, Philippines',
            lastActive: '2 hours ago',
            isCurrent: false
        }
    ];
    
    renderActiveSessions(sessions);
}

/**
 * Render active sessions table
 */
function renderActiveSessions(sessions) {
    const tbody = document.querySelector('.sessions-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = sessions.map(session => `
        <tr>
            <td>
                <div class="session-device">
                    <i class="ph-bold ${session.deviceIcon}"></i>
                    <span>${session.device}</span>
                    ${session.isCurrent ? '<span class="current-session-badge">Current</span>' : ''}
                </div>
            </td>
            <td>${session.location}</td>
            <td>${session.lastActive}</td>
            <td>
                ${!session.isCurrent ? `<button class="btn btn-danger end-session-btn" data-session-id="${session.id}">
                    <i class="ph-bold ph-x"></i> End
                </button>` : '-'}
            </td>
        </tr>
    `).join('');
}

/**
 * Handle end session
 */
function handleEndSession(sessionId) {
    if (confirm('Are you sure you want to end this session?')) {
        console.log('Ending session:', sessionId);
        showNotification('Session ended successfully', 'success');
        loadActiveSessions();
        
        // Placeholder for API call
        // TODO: Implement actual end session API call
    }
}

/**
 * Initialize audit logs
 */
function initializeAuditLogs() {
    loadAuditLogs();
    
    // Handle filter
    const filterSelect = document.getElementById('auditLogFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', function() {
            const filter = this.value;
            loadAuditLogs(filter);
        });
    }
    
    // Handle export logs button
    const exportLogsBtn = document.getElementById('exportLogsBtn');
    if (exportLogsBtn) {
        exportLogsBtn.addEventListener('click', handleExportLogs);
    }
}

/**
 * Load audit logs
 */
function loadAuditLogs(filter = 'all') {
    // Placeholder data
    const logs = [
        {
            type: 'success',
            icon: 'ph-sign-in',
            title: 'Successful login',
            description: 'Logged in from Windows Desktop',
            timestamp: '2024-10-23 09:45 AM'
        },
        {
            type: 'info',
            icon: 'ph-pencil',
            title: 'Profile updated',
            description: 'Email address changed',
            timestamp: '2024-10-22 03:20 PM'
        },
        {
            type: 'warning',
            icon: 'ph-lock',
            title: 'Password changed',
            description: 'Password was updated successfully',
            timestamp: '2024-10-21 11:30 AM'
        },
        {
            type: 'info',
            icon: 'ph-floppy-disk',
            title: 'Data saved',
            description: 'Form progress saved',
            timestamp: '2024-10-20 02:15 PM'
        }
    ];
    
    renderAuditLogs(logs);
}

/**
 * Render audit logs
 */
function renderAuditLogs(logs) {
    const container = document.querySelector('.logs-container .logs-list');
    if (!container) {
        // Try alternative container
        const logsContainer = document.querySelector('.logs-container');
        if (!logsContainer) return;
        
        const logsList = document.createElement('div');
        logsList.className = 'logs-list';
        logsContainer.appendChild(logsList);
        renderAuditLogs(logs);
        return;
    }
    
    container.innerHTML = logs.map(log => `
        <div class="log-item">
            <div class="log-icon ${log.type}">
                <i class="ph-bold ${log.icon}"></i>
            </div>
            <div class="log-content">
                <h4 class="log-title">${log.title}</h4>
                <p class="log-description">${log.description}</p>
                <span class="log-timestamp">${log.timestamp}</span>
            </div>
        </div>
    `).join('');
}

/**
 * Handle export logs
 */
function handleExportLogs() {
    console.log('Exporting audit logs...');
    showNotification('Audit logs exported successfully', 'success');
    
    // Placeholder for export functionality
    // TODO: Implement actual export logs API call
}

/**
 * Initialize preferences/toggles
 */
function initializePreferences() {
    // Handle all toggle switches
    document.querySelectorAll('.toggle-switch input').forEach(toggle => {
        toggle.addEventListener('change', function() {
            const preference = this.id;
            const enabled = this.checked;
            handlePreferenceChange(preference, enabled);
        });
    });
}

/**
 * Handle preference change
 */
function handlePreferenceChange(preference, enabled) {
    console.log(`Preference ${preference} set to:`, enabled);
    showNotification('Preference updated', 'success');
    
    // Placeholder for API call
    // TODO: Implement actual preference update API call
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    
    const icon = getIconForType(type);
    alert.innerHTML = `
        <i class="ph-bold ${icon}"></i>
        <span>${message}</span>
    `;
    
    // Find or create notification container
    let container = document.querySelector('.notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
        document.body.appendChild(container);
    }
    
    container.appendChild(alert);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        alert.remove();
    }, 3000);
}

/**
 * Get icon for notification type
 */
function getIconForType(type) {
    const icons = {
        success: 'ph-check-circle',
        info: 'ph-info',
        warning: 'ph-warning',
        danger: 'ph-x-circle'
    };
    return icons[type] || icons.info;
}

/**
 * Form validation helper
 */
function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('error');
            isValid = false;
        } else {
            input.classList.remove('error');
        }
    });
    
    return isValid;
}

