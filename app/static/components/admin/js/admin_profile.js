// Admin Profile Handler
// Handles loading and displaying profile data, password change, and audit logs

(function() {
    'use strict';
    
    const PROFILE_ENDPOINTS = {
        userInfo: '/api/admin/profile/user-info/',
        permissions: '/api/admin/profile/permissions/',
        password: '/api/admin/profile/password/',
        auditLog: '/api/admin/profile/audit-log/'
    };
    
    let currentAuditLogPage = 1;
    let currentAuditLogType = 'all';
    
    /**
     * Load user information
     */
    function loadUserInfo() {
        const loadingEl = document.getElementById('userInfoLoading');
        const contentEl = document.getElementById('userInfoContent');
        
        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';
        
        fetch(PROFILE_ENDPOINTS.userInfo, {
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
            if (data.success && data.user_info) {
                renderUserInfo(data.user_info);
            } else {
                showUserInfoError(data.error || 'Failed to load user information');
            }
        })
        .catch(error => {
            console.error('Error loading user info:', error);
            showUserInfoError('Error loading user information. Please try again.');
        })
        .finally(() => {
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
        });
    }
    
    /**
     * Render user information
     */
    function renderUserInfo(userInfo) {
        // Basic Information
        setElementText('info-username', userInfo.username || '--');
        setElementText('info-email', userInfo.email || '--');
        setElementText('info-full-name', userInfo.full_name || 'Not set');
        
        // Account Status
        setElementText('info-admin-level', userInfo.admin_level_display || '--');
        setElementHTML('info-status', `<span class="badge ${userInfo.status === 'active' ? 'success' : userInfo.status === 'suspended' ? 'danger' : 'warning'}">${userInfo.status_display || '--'}</span>`);
        setElementText('info-assigned-area', userInfo.assigned_area || 'Not specified');
        
        // Geographic Assignment
        if (userInfo.region && userInfo.region.name) {
            showElement('info-region-row');
            setElementText('info-region', userInfo.region.name);
        }
        if (userInfo.division && userInfo.division.name) {
            showElement('info-division-row');
            setElementText('info-division', userInfo.division.name);
        }
        if (userInfo.district && userInfo.district.name) {
            showElement('info-district-row');
            setElementText('info-district', userInfo.district.name);
        }
        if (userInfo.school && userInfo.school.name) {
            showElement('info-school-row');
            setElementText('info-school', userInfo.school.name);
        }
        
        // Timestamps
        setElementText('info-created-at', userInfo.created_at_display || 'Unknown');
        setElementText('info-updated-at', userInfo.updated_at_display || 'Unknown');
        setElementText('info-last-login', userInfo.last_login_display || 'Never');
        
        // Audit Information
        const createdBy = userInfo.created_by;
        const createdByText = createdBy && createdBy.username ? 
            `${createdBy.username}${createdBy.full_name ? ` (${createdBy.full_name})` : ''}` : 
            'System';
        setElementText('info-created-by', createdByText);
        
        const updatedBy = userInfo.updated_by;
        const updatedByText = updatedBy && updatedBy.username ? 
            `${updatedBy.username}${updatedBy.full_name ? ` (${updatedBy.full_name})` : ''}` : 
            'System';
        setElementText('info-updated-by', updatedByText);
    }
    
    /**
     * Load permissions
     */
    function loadPermissions() {
        const loadingEl = document.getElementById('permissionsLoading');
        const contentEl = document.getElementById('permissionsContent');
        
        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';
        
        fetch(PROFILE_ENDPOINTS.permissions, {
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
            if (data.success && data.permissions) {
                renderPermissions(data.permissions);
            } else {
                showPermissionsError(data.error || 'Failed to load permissions');
            }
        })
        .catch(error => {
            console.error('Error loading permissions:', error);
            showPermissionsError('Error loading permissions. Please try again.');
        })
        .finally(() => {
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
        });
    }
    
    /**
     * Render permissions
     */
    function renderPermissions(permissions) {
        // Admin Level
        setElementText('permission-admin-level', permissions.admin_level_display || '--');
        
        // Boolean Permissions - Modern Grid Layout
        const booleanList = document.getElementById('boolean-permissions-list');
        if (booleanList) {
            const booleanPerms = permissions.boolean_permissions || {};
            const permLabels = {
                'can_create_users': { label: 'Can Create Users', icon: 'ph-bold ph-user-plus' },
                'can_manage_users': { label: 'Can Manage Users', icon: 'ph-bold ph-users-gear' },
                'can_set_deadlines': { label: 'Can Set Deadlines', icon: 'ph-bold ph-calendar-check' },
                'can_approve_submissions': { label: 'Can Approve Submissions', icon: 'ph-bold ph-clipboard-check' },
                'can_view_system_logs': { label: 'Can View System Logs', icon: 'ph-bold ph-file-shield' }
            };
            
            booleanList.innerHTML = Object.entries(booleanPerms).map(([key, value]) => {
                const permInfo = permLabels[key] || { label: key, icon: 'ph-bold ph-circle' };
                return `
                    <div class="col-xl-4 col-lg-6 col-md-6">
                        <div class="permission-flag-card ${value ? 'enabled' : ''}">
                            <div class="permission-flag-content">
                                <div class="permission-flag-icon">
                                    <i class="${permInfo.icon}"></i>
                                </div>
                                <div class="permission-flag-text">
                                    <div class="permission-flag-name">${escapeHtml(permInfo.label)}</div>
                                </div>
                            </div>
                            <span class="permission-flag-badge">${value ? 'Enabled' : 'Disabled'}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        // Detailed Permissions - Modern Grid Layout
        const detailedList = document.getElementById('detailed-permissions-list');
        if (detailedList) {
            const detailedPerms = permissions.detailed_permissions || {};
            
            if (Object.keys(detailedPerms).length === 0) {
                detailedList.innerHTML = `
                    <div class="col-xl-12">
                        <div class="text-center py-5">
                            <i class="ph-bold ph-lock" style="font-size: 48px; color: var(--admin-text-muted);"></i>
                            <p class="text-muted mt-3">No detailed permissions assigned.</p>
                        </div>
                    </div>
                `;
            } else {
                detailedList.innerHTML = Object.entries(detailedPerms).map(([resourceType, perms]) => {
                    return `
                        <div class="col-xl-12 mb-3">
                            <div class="detailed-permission-card">
                                <div class="permission-category-title">
                                    ${escapeHtml(perms[0]?.resource_type_display || resourceType)}
                                </div>
                                <div class="row g-3">
                                    ${perms.map(perm => {
                                        // Format permission code: remove underscores and capitalize words
                                        const formattedCode = perm.permission_name
                                            .split('_')
                                            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                                            .join(' ');
                                        
                                        return `
                                        <div class="col-xl-6 col-lg-6 col-md-12">
                                            <div class="permission-detail-row">
                                                <div class="permission-detail-left">
                                                    <div class="permission-detail-code">${escapeHtml(formattedCode)}</div>
                                                    <div class="permission-detail-info">
                                                        ${escapeHtml(perm.action_display)} • ${escapeHtml(perm.scope_display)}
                                                    </div>
                                                    <div class="permission-detail-meta">
                                                        Granted: ${escapeHtml(perm.granted_at_display)} by ${escapeHtml(perm.granted_by?.username || 'System')}
                                                    </div>
                                                </div>
                                                <div class="permission-detail-status">
                                                    <span class="status-badge-modern">Active</span>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    }
    
    /**
     * Handle password change form
     */
    function handlePasswordChange() {
        const form = document.getElementById('changePasswordForm');
        if (!form) return;
        
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const submitBtn = document.getElementById('changePasswordBtn');
            
            // Clear previous errors
            clearPasswordErrors();
            
            // Validate passwords match
            if (newPassword !== confirmPassword) {
                showPasswordError('confirmPassword', 'New password and confirmation do not match');
                return;
            }
            
            // Disable submit button
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="ph-bold ph-circle-notch ph-spin"></i> Changing Password...';
            }
            
            // Submit to API
            fetch(PROFILE_ENDPOINTS.password, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showPasswordSuccess('Password changed successfully!');
                    form.reset();
                } else {
                    if (data.details && Array.isArray(data.details)) {
                        showPasswordRequirements(data.details);
                    }
                    showPasswordError('newPassword', data.error || 'Failed to change password');
                }
            })
            .catch(error => {
                console.error('Error changing password:', error);
                showPasswordError('newPassword', 'Error changing password. Please try again.');
            })
            .finally(() => {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Change Password';
                }
            });
        });
    }
    
    /**
     * Load audit logs
     */
    function loadAuditLogs(page = 1) {
        currentAuditLogPage = page;
        
        const loadingEl = document.getElementById('auditLogLoading');
        const contentEl = document.getElementById('auditLogContent');
        
        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';
        
        const params = new URLSearchParams({
            page: page.toString(),
            page_size: '100',
            type: currentAuditLogType
        });
        
        fetch(`${PROFILE_ENDPOINTS.auditLog}?${params.toString()}`, {
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
            if (data.success && data.logs) {
                renderAuditLogs(data.logs);
                renderAuditLogPagination(data.pagination);
            } else {
                showAuditLogError(data.error || 'Failed to load audit logs');
            }
        })
        .catch(error => {
            console.error('Error loading audit logs:', error);
            showAuditLogError('Error loading audit logs. Please try again.');
        })
        .finally(() => {
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
        });
    }
    
    /**
     * Render audit logs
     */
    function renderAuditLogs(logs) {
        const tbody = document.getElementById('auditLogTableBody');
        if (!tbody) return;
        
        if (logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">No audit logs found</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = logs.map(log => {
            const typeBadge = log.type === 'activity' ? 'success' : 'warning';
            const typeLabel = log.type === 'activity' ? 'Activity' : 'Audit';
            
            return `
                <tr>
                    <td><span class="badge ${typeBadge}">${escapeHtml(typeLabel)}</span></td>
                    <td>${escapeHtml(log.action || '--')}</td>
                    <td>${escapeHtml(log.resource_type || '--')}</td>
                    <td>${escapeHtml(log.details || log.description || '--')}</td>
                    <td>${escapeHtml(log.ip_address || '--')}</td>
                    <td>
                        <div>${escapeHtml(log.timestamp_relative || 'Recently')}</div>
                        <small class="text-muted">${escapeHtml(log.timestamp_display || '')}</small>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    /**
     * Render audit log pagination
     */
    function renderAuditLogPagination(pagination) {
        const paginationEl = document.getElementById('auditLogPagination');
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
        
        // Page numbers
        const startPage = Math.max(1, pagination.page - 2);
        const endPage = Math.min(pagination.total_pages, pagination.page + 2);
        
        if (startPage > 1) {
            html += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
            if (startPage > 2) {
                html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${i === pagination.page ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }
        
        if (endPage < pagination.total_pages) {
            if (endPage < pagination.total_pages - 1) {
                html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            html += `<li class="page-item"><a class="page-link" href="#" data-page="${pagination.total_pages}">${pagination.total_pages}</a></li>`;
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
                if (page && page !== currentAuditLogPage) {
                    loadAuditLogs(page);
                }
            });
        });
    }
    
    /**
     * Handle audit log type filter
     */
    function handleAuditLogFilter() {
        const filterSelect = document.getElementById('auditLogTypeFilter');
        if (!filterSelect) return;
        
        filterSelect.addEventListener('change', function() {
            currentAuditLogType = this.value;
            loadAuditLogs(1);
        });
    }
    
    /**
     * Helper functions
     */
    function setElementText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text || '--';
    }
    
    function setElementHTML(id, html) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html || '--';
    }
    
    function showElement(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function getCSRFToken() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return value;
            }
        }
        return '';
    }
    
    function showUserInfoError(message) {
        const contentEl = document.getElementById('userInfoContent');
        if (contentEl) {
            contentEl.innerHTML = `
                <div class="alert alert-danger">
                    <i class="ph-bold ph-warning"></i> ${escapeHtml(message)}
                </div>
            `;
        }
    }
    
    function showPermissionsError(message) {
        const contentEl = document.getElementById('permissionsContent');
        if (contentEl) {
            contentEl.innerHTML = `
                <div class="alert alert-danger">
                    <i class="ph-bold ph-warning"></i> ${escapeHtml(message)}
                </div>
            `;
        }
    }
    
    function clearPasswordErrors() {
        ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => {
            const input = document.getElementById(id);
            const errorEl = document.getElementById(id + 'Error');
            if (input) {
                input.classList.remove('is-invalid');
            }
            if (errorEl) {
                errorEl.textContent = '';
            }
        });
    }
    
    function showPasswordError(fieldId, message) {
        const input = document.getElementById(fieldId);
        const errorEl = document.getElementById(fieldId + 'Error');
        if (input) {
            input.classList.add('is-invalid');
        }
        if (errorEl) {
            errorEl.textContent = message;
        }
    }
    
    function showPasswordRequirements(errors) {
        const requirementsEl = document.getElementById('passwordRequirements');
        const listEl = document.getElementById('passwordRequirementList');
        if (requirementsEl && listEl) {
            listEl.innerHTML = errors.map(err => `<li>${escapeHtml(err)}</li>`).join('');
            requirementsEl.style.display = 'block';
        }
    }
    
    function showPasswordSuccess(message) {
        const form = document.getElementById('changePasswordForm');
        if (form) {
            const alert = document.createElement('div');
            alert.className = 'alert alert-success alert-dismissible fade show';
            alert.innerHTML = `
                <i class="ph-bold ph-check-circle"></i> ${escapeHtml(message)}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            form.insertBefore(alert, form.firstChild);
            
            // Remove alert after 5 seconds
            setTimeout(() => {
                alert.remove();
            }, 5000);
        }
    }
    
    function showAuditLogError(message) {
        const tbody = document.getElementById('auditLogTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-danger">${escapeHtml(message)}</td>
                </tr>
            `;
        }
    }
    
    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', function() {
        loadUserInfo();
        loadPermissions();
        handlePasswordChange();
        handleAuditLogFilter();
        loadAuditLogs(1);
    });
    
    // Export functions
    window.AdminProfile = {
        loadUserInfo: loadUserInfo,
        loadPermissions: loadPermissions,
        loadAuditLogs: loadAuditLogs,
        refresh: function() {
            loadUserInfo();
            loadPermissions();
            loadAuditLogs(currentAuditLogPage);
        }
    };
})();

