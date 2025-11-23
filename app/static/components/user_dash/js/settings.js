/**
 * User Dashboard - Settings Page JavaScript
 * Handles profile, security, preferences, and audit logs
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
async function handleProfileUpdate() {
    const formData = new FormData(document.getElementById('profileForm'));
    const data = Object.fromEntries(formData);
    
    try {
        const result = await UserDashboardAPI.updateProfile(data);
        showSuccessDialog(result.message || 'Profile updated successfully', 'Success');
        
        // Reload audit logs to show the update
        const currentFilter = document.getElementById('logFilter')?.value || 'all';
        loadAuditLogs(currentFilter);
    } catch (error) {
        showErrorDialog(error.message || 'Failed to update profile', 'Error');
    }
}

/**
 * Initialize security/password form
 */
function initializeSecurityForm() {
    const securityForm = document.getElementById('securityForm');
    if (!securityForm) return;
    
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    
    // Real-time validation for current password
    currentPassword.addEventListener('input', function() {
        validateCurrentPassword(this.value);
    });
    
    currentPassword.addEventListener('blur', function() {
        validateCurrentPassword(this.value);
    });
    
    // Real-time validation for new password
    newPassword.addEventListener('input', function() {
        validateNewPassword(this.value);
        checkPasswordStrength(this.value);
        
        // Also validate confirm password if it has a value
        if (confirmPassword.value) {
            validateConfirmPassword(newPassword.value, confirmPassword.value);
        }
    });
    
    newPassword.addEventListener('blur', function() {
        validateNewPassword(this.value);
    });
    
    // Real-time validation for confirm password
    confirmPassword.addEventListener('input', function() {
        validateConfirmPassword(newPassword.value, this.value);
    });
    
    confirmPassword.addEventListener('blur', function() {
        validateConfirmPassword(newPassword.value, this.value);
    });
    
    securityForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handlePasswordUpdate();
    });
}

/**
 * Validate current password
 */
function validateCurrentPassword(value) {
    const input = document.getElementById('currentPassword');
    const errorMsg = document.getElementById('currentPasswordError');
    
    if (!value || value.trim() === '') {
        showFieldError(input, errorMsg, 'Current password is required');
        return false;
    }
    
    clearFieldError(input, errorMsg);
    return true;
}

/**
 * Validate new password
 */
function validateNewPassword(value) {
    const input = document.getElementById('newPassword');
    const errorMsg = document.getElementById('newPasswordError');
    
    if (!value || value.trim() === '') {
        showFieldError(input, errorMsg, 'New password is required');
        return false;
    }
    
    if (value.length < 8) {
        showFieldError(input, errorMsg, 'Password must be at least 8 characters');
        return false;
    }
    
    // Check for at least one letter and one number
    const hasLetter = /[a-zA-Z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    
    if (!hasLetter || !hasNumber) {
        showFieldError(input, errorMsg, 'Password must contain letters and numbers');
        return false;
    }
    
    clearFieldError(input, errorMsg);
    input.classList.add('success');
    return true;
}

/**
 * Validate confirm password
 */
function validateConfirmPassword(newPassword, confirmValue) {
    const input = document.getElementById('confirmPassword');
    const errorMsg = document.getElementById('confirmPasswordError');
    
    if (!confirmValue || confirmValue.trim() === '') {
        showFieldError(input, errorMsg, 'Please confirm your password');
        return false;
    }
    
    if (newPassword !== confirmValue) {
        showFieldError(input, errorMsg, 'Passwords do not match');
        return false;
    }
    
    clearFieldError(input, errorMsg);
    input.classList.add('success');
    return true;
}

/**
 * Check password strength
 */
function checkPasswordStrength(password) {
    const strengthContainer = document.getElementById('passwordStrength');
    const strengthBar = document.getElementById('strengthBarFill');
    const strengthText = document.getElementById('strengthText');
    
    if (!password || password.length === 0) {
        strengthContainer.style.display = 'none';
        return;
    }
    
    strengthContainer.style.display = 'block';
    
    let strength = 0;
    let strengthLabel = 'Weak';
    
    // Length check
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    
    // Character variety checks
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    // Determine strength level
    strengthBar.className = 'strength-bar-fill';
    strengthText.className = 'strength-text';
    
    if (strength <= 2) {
        strengthBar.classList.add('weak');
        strengthText.classList.add('weak');
        strengthLabel = 'Weak';
    } else if (strength <= 4) {
        strengthBar.classList.add('medium');
        strengthText.classList.add('medium');
        strengthLabel = 'Medium';
    } else {
        strengthBar.classList.add('strong');
        strengthText.classList.add('strong');
        strengthLabel = 'Strong';
    }
    
    strengthText.textContent = `Password strength: ${strengthLabel}`;
}

/**
 * Show field error
 */
function showFieldError(input, errorElement, message) {
    input.classList.remove('success');
    input.classList.add('error');
    errorElement.textContent = message;
}

/**
 * Clear field error
 */
function clearFieldError(input, errorElement) {
    input.classList.remove('error');
    errorElement.textContent = '';
}

/**
 * Handle password update
 */
async function handlePasswordUpdate() {
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    // Perform all validations
    const isCurrentValid = validateCurrentPassword(currentPassword);
    const isNewValid = validateNewPassword(newPassword);
    const isConfirmValid = validateConfirmPassword(newPassword, confirmPassword);
    
    // If any validation fails, stop submission
    if (!isCurrentValid || !isNewValid || !isConfirmValid) {
        showWarningDialog('Please fix the errors before submitting', 'Validation Error');
        return;
    }
    
    // Disable submit button during processing
    const submitBtn = document.getElementById('updatePasswordBtn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    
    try {
        const result = await UserDashboardAPI.updatePassword({
            current_password: currentPassword,
            new_password: newPassword
        });
        
        showSuccessDialog(result.message || 'Password updated successfully', 'Success');
        
        // Clear form and all validation states
        document.getElementById('securityForm').reset();
        clearAllPasswordErrors();
        
        // Hide password strength indicator
        document.getElementById('passwordStrength').style.display = 'none';
        
        // Reload audit logs to show the update
        const currentFilter = document.getElementById('logFilter')?.value || 'all';
        loadAuditLogs(currentFilter);
    } catch (error) {
        // Show error in the appropriate field
        if (error.message && error.message.includes('Current password')) {
            showFieldError(
                currentPasswordInput,
                document.getElementById('currentPasswordError'),
                error.message
            );
        } else {
            showErrorDialog(error.message || 'Failed to update password', 'Error');
        }
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

/**
 * Clear all password field errors
 */
function clearAllPasswordErrors() {
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    
    clearFieldError(currentPassword, document.getElementById('currentPasswordError'));
    clearFieldError(newPassword, document.getElementById('newPasswordError'));
    clearFieldError(confirmPassword, document.getElementById('confirmPasswordError'));
    
    currentPassword.classList.remove('success');
    newPassword.classList.remove('success');
    confirmPassword.classList.remove('success');
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
 * Load audit logs from API
 */
async function loadAuditLogs(filter = 'all') {
    const container = document.querySelector('.logs-container .logs-list');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class="ph-bold ph-spinner" style="font-size: 32px; animation: spin 1s linear infinite;"></i>
                <p style="margin-top: 12px;">Loading audit logs...</p>
            </div>
        `;
    }
    
    try {
        const logs = await UserDashboardAPI.getAuditLogs(filter);
        
        if (!logs || !logs.logs || logs.logs.length === 0) {
            renderAuditLogs([]);
            return;
        }
        
        // Map API response to UI format
        const mappedLogs = logs.logs.map(log => {
            return mapAuditLogToUI(log);
        });
        
        renderAuditLogs(mappedLogs);
    } catch (error) {
        console.error('Error loading audit logs:', error);
        const container = document.querySelector('.logs-container .logs-list');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--danger, #f44336);">
                    <i class="fas fa-exclamation-circle" style="font-size: 32px;"></i>
                    <p style="margin-top: 12px;">Failed to load audit logs. Please try again later.</p>
                </div>
            `;
        }
    }
}

/**
 * Map audit log from API to UI format
 */
function mapAuditLogToUI(log) {
    // Determine log type and icon based on action
    const actionType = log.action?.toLowerCase() || log.resource_type?.toLowerCase() || '';
    
    let type = 'info';
    let icon = 'ph-info';
    let title = log.action || 'Activity';
    
    // Map action types to UI types and icons
    if (actionType.includes('login')) {
        type = 'success';
        icon = 'fas fa-sign-in-alt';
        title = 'Successful Login';
    } else if (actionType.includes('logout')) {
        type = 'info';
        icon = 'fas fa-sign-out-alt';
        title = 'Logged Out';
    } else if (actionType.includes('password') || actionType.includes('password_change')) {
        type = 'warning';
        icon = 'fas fa-key';
        title = 'Password Changed';
    } else if (actionType.includes('update') || actionType.includes('profile')) {
        type = 'info';
        icon = 'fas fa-user-edit';
        title = 'Profile Updated';
    } else if (actionType.includes('create')) {
        type = 'success';
        icon = 'fas fa-plus-circle';
        title = 'Record Created';
    } else if (actionType.includes('delete')) {
        type = 'danger';
        icon = 'fas fa-trash';
        title = 'Record Deleted';
    } else if (actionType.includes('export')) {
        type = 'info';
        icon = 'fas fa-download';
        title = 'Data Exported';
    } else if (actionType.includes('save') || actionType.includes('floppy')) {
        type = 'success';
        icon = 'fas fa-save';
        title = 'Data Saved';
    } else if (actionType.includes('question')) {
        type = 'info';
        icon = 'fas fa-edit';
        title = log.action || 'Question Updated';
    }
    
    // Format description
    let description = log.resource_name || log.description || 'System activity';
    
    // Add additional context if available
    if (log.old_value && log.new_value) {
        description += ` (Updated)`;
    }
    
    // Format timestamp
    let timestamp = log.timestamp;
    if (timestamp) {
        try {
            const date = new Date(timestamp);
            timestamp = formatTimestamp(date);
        } catch (e) {
            // Keep original timestamp if parsing fails
        }
    } else {
        timestamp = 'Just now';
    }
    
    return {
        type: type,
        icon: icon,
        title: title,
        description: description,
        timestamp: timestamp
    };
}

/**
 * Format timestamp to readable format
 */
function formatTimestamp(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else {
        // Format as date
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        const hours = date.getHours();
        const mins = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMins = mins.toString().padStart(2, '0');
        
        return `${month} ${day}, ${year} ${displayHours}:${displayMins} ${ampm}`;
    }
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
    
    if (!logs || logs.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--silver, #666);">
                <i class="fas fa-clipboard-list" style="font-size: 32px; opacity: 0.5;"></i>
                <p style="margin-top: 12px;">No audit logs found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = logs.map(log => `
        <div class="log-item">
            <div class="log-icon ${log.type}">
                <i class="${log.icon}"></i>
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
    showSuccessDialog('Audit logs exported successfully', 'Success');
    
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
    
    // Export logs button
    const exportBtn = document.getElementById('exportLogsBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async function() {
            try {
                const currentFilter = document.getElementById('logFilter')?.value || 'all';
                await UserDashboardAPI.exportAuditLogs(currentFilter, '30d');
                showSuccessDialog('Audit logs exported successfully', 'Export Complete');
                
                // Reload audit logs to show the export action
                loadAuditLogs(currentFilter);
            } catch (error) {
                showErrorDialog(error.message || 'Failed to export audit logs', 'Error');
            }
        });
    }
}

/**
 * Handle preference change
 */
async function handlePreferenceChange(preference, enabled) {
    try {
        // Map preference ID to API field
        let data = {};
        if (preference === 'emailNotifications') {
            data.email_notifications = enabled;
        } else if (preference === 'dataVisibility') {
            data.data_visibility = enabled;
        } else {
            data[preference] = enabled;
        }
        
        const result = await UserDashboardAPI.updatePreferences(data);
        showSuccessDialog(result.message || 'Preference updated', 'Success');
        
        // Reload audit logs to show the update
        const currentFilter = document.getElementById('logFilter')?.value || 'all';
        loadAuditLogs(currentFilter);
    } catch (error) {
        showErrorDialog(error.message || 'Failed to update preference', 'Error');
    }
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

