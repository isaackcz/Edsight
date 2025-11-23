// User Management View Page
// Handles loading and displaying user details in view page

(function() {
    'use strict';
    
    const VIEW_ENDPOINTS = {
        userInfo: '/api/user-management/view/',
        permissions: '/api/user-management/view/permissions/',
        auditLog: '/api/user-management/view/audit-log/'
    };
    
    let currentUserId = null;
    let currentAuditLogPage = 1;
    let currentAuditLogType = 'all';
    
    /**
     * Load user information for view page
     */
    function loadUser(userId) {
        currentUserId = userId;
        
        // Load user info
        loadUserInfo(userId);
        
        // Load permissions
        loadPermissions(userId);
        
        // Load audit log
        loadAuditLog(userId);
    }
    
    /**
     * Load user information
     */
    function loadUserInfo(userId) {
        const loadingEl = document.getElementById('userInfoLoading');
        const contentEl = document.getElementById('userInfoContent');
        
        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';
        
        fetch(`${VIEW_ENDPOINTS.userInfo}?user_id=${userId}`, {
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
     * Render user information (reuse from admin_profile.js)
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
    function loadPermissions(userId) {
        const loadingEl = document.getElementById('permissionsLoading');
        const contentEl = document.getElementById('permissionsContent');
        
        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';
        
        fetch(`${VIEW_ENDPOINTS.permissions}?user_id=${userId}`, {
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
     * Render permissions (reuse from admin_profile.js)
     */
    function renderPermissions(permissions) {
        // Admin Level
        setElementText('permission-admin-level', permissions.admin_level_display || '--');
        
        // Boolean Permissions
        const booleanList = document.getElementById('boolean-permissions-list');
        if (booleanList) {
            const booleanPerms = permissions.boolean_permissions || {};
            const permLabels = {
                'can_create_users': { label: 'Can Create Users', icon: 'ph-bold ph-user-plus' },
                'can_manage_users': { label: 'Can Manage Users', icon: 'ph-bold ph-users-three' },
                'can_set_deadlines': { label: 'Can Set Deadlines', icon: 'ph-bold ph-calendar-check' },
                'can_approve_submissions': { label: 'Can Approve Submissions', icon: 'ph-bold ph-check-circle' },
                'can_view_system_logs': { label: 'Can View System Logs', icon: 'ph-bold ph-list-bullets' }
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
        
        // Detailed Permissions
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
     * Load audit logs
     */
    function loadAuditLog(userId, page = 1) {
        currentAuditLogPage = page;
        
        const loadingEl = document.getElementById('auditLogLoading');
        const contentEl = document.getElementById('auditLogContent');
        
        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';
        
        const params = new URLSearchParams({
            user_id: userId,
            page: page.toString(),
            page_size: '100',
            type: currentAuditLogType
        });
        
        fetch(`${VIEW_ENDPOINTS.auditLog}?${params.toString()}`, {
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
                renderAuditLog(data.logs, data.pagination);
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
     * Render audit logs (reuse from admin_profile.js)
     */
    function renderAuditLog(logs, pagination) {
        const logList = document.getElementById('auditLogList');
        if (!logList) return;
        
        if (logs.length === 0) {
            logList.innerHTML = `
                <div class="text-center py-5">
                    <i class="ph-bold ph-file-x" style="font-size: 48px; color: var(--admin-text-muted);"></i>
                    <p class="text-muted mt-3">No audit logs found.</p>
                </div>
            `;
            return;
        }
        
        logList.innerHTML = logs.map(log => {
            const logTypeBadge = log.type === 'activity' ? 'info' : 'warning';
            return `
                <div class="audit-log-entry">
                    <div class="audit-log-header">
                        <span class="badge badge-${logTypeBadge}">${log.type_display}</span>
                        <span class="audit-log-time">${log.timestamp_display}</span>
                    </div>
                    <div class="audit-log-action">${escapeHtml(log.action_display)}</div>
                    ${log.details ? `<div class="audit-log-details">${escapeHtml(log.details)}</div>` : ''}
                    ${log.ip_address ? `<div class="audit-log-meta">IP: ${escapeHtml(log.ip_address)}</div>` : ''}
                </div>
            `;
        }).join('');
        
        // Update pagination
        updateAuditLogPagination(pagination);
    }
    
    /**
     * Update audit log pagination
     */
    function updateAuditLogPagination(pagination) {
        const prevBtn = document.getElementById('auditLogPrevBtn');
        const nextBtn = document.getElementById('auditLogNextBtn');
        const pageInfo = document.getElementById('auditLogPageInfo');
        
        if (prevBtn) prevBtn.disabled = !pagination.has_previous;
        if (nextBtn) nextBtn.disabled = !pagination.has_next;
        if (pageInfo) {
            pageInfo.textContent = `Page ${pagination.page} of ${pagination.total_pages}`;
        }
    }
    
    /**
     * Show error states
     */
    function showUserInfoError(message) {
        const contentEl = document.getElementById('userInfoContent');
        if (contentEl) {
            contentEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(message)}</div>`;
        }
    }
    
    function showPermissionsError(message) {
        const contentEl = document.getElementById('permissionsContent');
        if (contentEl) {
            contentEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(message)}</div>`;
        }
    }
    
    function showAuditLogError(message) {
        const contentEl = document.getElementById('auditLogContent');
        if (contentEl) {
            contentEl.innerHTML = `<div class="alert alert-danger">${escapeHtml(message)}</div>`;
        }
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
        if (el) el.innerHTML = html;
    }
    
    function showElement(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Handle audit log pagination
     */
    function handleAuditLogPagination() {
        const prevBtn = document.getElementById('auditLogPrevBtn');
        const nextBtn = document.getElementById('auditLogNextBtn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', function() {
                if (!this.disabled && currentUserId && currentAuditLogPage > 1) {
                    loadAuditLog(currentUserId, currentAuditLogPage - 1);
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                if (!this.disabled && currentUserId) {
                    loadAuditLog(currentUserId, currentAuditLogPage + 1);
                }
            });
        }
    }
    
    /**
     * Handle back button
     */
    function handleBackButton() {
        const backBtn = document.getElementById('backToUserManagement');
        if (backBtn) {
            backBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Use UserManagementTable function to ensure state is saved
                if (window.UserManagementTable && window.UserManagementTable.hideUserView) {
                    window.UserManagementTable.hideUserView();
                } else {
                    // Fallback: Hide view page and show main page directly
                    const mainPage = document.getElementById('userManagementMainPage');
                    const viewPage = document.getElementById('userManagementViewPage');
                    
                    if (mainPage && viewPage) {
                        viewPage.style.display = 'none';
                        mainPage.style.display = 'block';
                        
                        // Save state to localStorage
                        try {
                            localStorage.setItem('userManagementView', 'main');
                            localStorage.removeItem('userManagementViewUserId');
                        } catch (e) {
                            console.warn('Could not save view state to localStorage:', e);
                        }
                    }
                }
            });
        }
    }
    
    /**
     * Handle password reset button
     */
    function handlePasswordReset() {
        const resetBtn = document.getElementById('resetPasswordBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                if (!currentUserId) {
                    alert('No user selected');
                    return;
                }
                
                showPasswordResetModal();
            });
        }
        
        // Handle modal close buttons
        const closeBtn = document.getElementById('closePasswordResetModal');
        const cancelBtn = document.getElementById('cancelPasswordReset');
        const confirmBtn = document.getElementById('confirmPasswordReset');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', hidePasswordResetModal);
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', hidePasswordResetModal);
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                if (currentUserId) {
                    hidePasswordResetModal();
                    resetPassword(currentUserId);
                }
            });
        }
        
        // Close modal when clicking overlay
        const modal = document.getElementById('passwordResetModal');
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    hidePasswordResetModal();
                }
            });
        }
    }
    
    /**
     * Show password reset confirmation modal
     */
    function showPasswordResetModal() {
        const modal = document.getElementById('passwordResetModal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
    }
    
    /**
     * Hide password reset confirmation modal
     */
    function hidePasswordResetModal() {
        const modal = document.getElementById('passwordResetModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = ''; // Restore scrolling
        }
    }
    
    /**
     * Reset user password
     */
    function resetPassword(userId) {
        const resetBtn = document.getElementById('resetPasswordBtn');
        const originalText = resetBtn ? resetBtn.innerHTML : '';
        
        if (resetBtn) {
            resetBtn.disabled = true;
            resetBtn.innerHTML = '<i class="ph-bold ph-circle-notch ph-spin"></i> Resetting...';
        }
        
        fetch('/api/user-management/reset-password/', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                user_id: userId
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showPasswordResetSuccess(data.new_password);
            } else {
                alert('Failed to reset password: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error resetting password:', error);
            alert('Error resetting password. Please try again.');
        })
        .finally(() => {
            if (resetBtn) {
                resetBtn.disabled = false;
                resetBtn.innerHTML = originalText;
            }
        });
    }
    
    /**
     * Store original modal content for restoration
     */
    let originalModalContent = null;
    
    /**
     * Store original modal content
     */
    function storeOriginalModalContent() {
        const modal = document.getElementById('passwordResetModal');
        if (modal && !originalModalContent) {
            const modalHeader = modal.querySelector('.modal-header h3');
            const modalBody = modal.querySelector('.modal-body');
            const modalFooter = modal.querySelector('.modal-footer');
            if (modalHeader && modalBody && modalFooter) {
                originalModalContent = {
                    header: modalHeader.innerHTML,
                    body: modalBody.innerHTML,
                    footer: modalFooter.innerHTML
                };
            }
        }
    }
    
    /**
     * Restore original modal content
     */
    function restoreOriginalModalContent() {
        const modal = document.getElementById('passwordResetModal');
        if (modal && originalModalContent) {
            const modalHeader = modal.querySelector('.modal-header h3');
            const modalBody = modal.querySelector('.modal-body');
            const modalFooter = modal.querySelector('.modal-footer');
            if (modalHeader && modalBody && modalFooter) {
                modalHeader.innerHTML = originalModalContent.header;
                modalBody.innerHTML = originalModalContent.body;
                modalFooter.innerHTML = originalModalContent.footer;
                
                // Re-attach event listeners
                const cancelBtn = document.getElementById('cancelPasswordReset');
                const confirmBtn = document.getElementById('confirmPasswordReset');
                
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', hidePasswordResetModal);
                }
                
                if (confirmBtn) {
                    confirmBtn.addEventListener('click', function() {
                        if (currentUserId) {
                            hidePasswordResetModal();
                            resetPassword(currentUserId);
                        }
                    });
                }
            }
        }
    }
    
    /**
     * Show password reset success message
     */
    function showPasswordResetSuccess(newPassword) {
        const modal = document.getElementById('passwordResetModal');
        if (modal) {
            // Update modal header
            const modalHeader = modal.querySelector('.modal-header h3');
            if (modalHeader) {
                modalHeader.innerHTML = '<i class="ph-bold ph-check-circle" style="color: #4CAF50;"></i> Password Reset Successful';
            }
            
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = `
                    <div class="modal-icon-warning" style="color: #4CAF50;">
                        <i class="ph-bold ph-check-circle" style="font-size: 64px; color: #4CAF50;"></i>
                    </div>
                    <p class="modal-message" style="color: #4CAF50;">
                        Password reset successfully!
                    </p>
                    <div class="modal-warning-box" style="background: rgba(76, 175, 80, 0.1); border-color: rgba(76, 175, 80, 0.3);">
                        <i class="ph-bold ph-key" style="color: #4CAF50;"></i>
                        <div>
                            <strong>New Password:</strong> <code style="background: rgba(76, 175, 80, 0.2); color: #2e7d32;">${escapeHtml(newPassword)}</code>
                            <br>
                            <small>Please inform the user of this new password.</small>
                        </div>
                    </div>
                `;
                
                const modalFooter = modal.querySelector('.modal-footer');
                if (modalFooter) {
                    modalFooter.innerHTML = `
                        <button class="btn-modal-confirm" id="closeSuccessModal" style="background: #4CAF50; border-color: #4CAF50;">
                            <i class="ph-bold ph-check"></i>
                            Close
                        </button>
                    `;
                    
                    const closeBtn = document.getElementById('closeSuccessModal');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', function() {
                            hidePasswordResetModal();
                            restoreOriginalModalContent();
                        });
                    }
                }
            }
            
            // Show the modal
            showPasswordResetModal();
        }
    }
    
    /**
     * Get CSRF token
     */
    function getCSRFToken() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return value;
            }
        }
        // Fallback: try to get from meta tag
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        return metaTag ? metaTag.getAttribute('content') : '';
    }
    
    /**
     * Initialize view page
     */
    function init() {
        handleBackButton();
        handleAuditLogPagination();
        storeOriginalModalContent();
        handlePasswordReset();
    }
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Export for external access
    window.UserManagementView = {
        loadUser: loadUser
    };
})();

