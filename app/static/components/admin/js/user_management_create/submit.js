/**
 * Form submission handler for create user form
 */

(function() {
    'use strict';
    
    const CREATE_ENDPOINT = '/api/admin/users/create/';
    const DEFAULT_PASSWORD = 'Edsight.123';
    
    /**
     * Get form data
     */
    function getFormData() {
        const emailInput = document.getElementById('createEmail');
        let email = '';
        
        // Get full email (with @deped.gov.ph suffix)
        if (emailInput && window.UserManagementCreateValidation) {
            email = window.UserManagementCreateValidation.getFullEmail(emailInput);
        } else {
            // Fallback
            const emailValue = emailInput?.value.trim() || '';
            email = emailValue.includes('@') ? emailValue : emailValue + '@deped.gov.ph';
        }
        
        const data = {
            username: document.getElementById('createUsername')?.value.trim() || '',
            email: email,
            full_name: document.getElementById('createFullName')?.value.trim() || '',
            admin_level: document.getElementById('createAdminLevel')?.value || '',
            assigned_area: document.getElementById('createAssignedArea')?.value.trim() || '',
            status: 'active',
            password: DEFAULT_PASSWORD
        };
        
        // Get geographic IDs
        const regionId = document.getElementById('createRegionId')?.value;
        const divisionId = document.getElementById('createDivisionId')?.value;
        const districtId = document.getElementById('createDistrictId')?.value;
        const schoolId = document.getElementById('createSchoolId')?.value;
        
        if (regionId) data.region_id = parseInt(regionId);
        if (divisionId) data.division_id = parseInt(divisionId);
        if (districtId) data.district_id = parseInt(districtId);
        if (schoolId) data.school_id = parseInt(schoolId);
        
        // Get permissions
        if (window.UserManagementCreatePermissions) {
            const permissions = window.UserManagementCreatePermissions.getPermissionValues();
            Object.assign(data, permissions);
        }
        
        return data;
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
     * Show loading state
     */
    function showLoading() {
        const submitBtn = document.getElementById('submitCreateUser');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="ph-bold ph-spinner ph-spin"></i> Creating...';
        }
    }
    
    /**
     * Hide loading state
     */
    function hideLoading() {
        const submitBtn = document.getElementById('submitCreateUser');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="ph-bold ph-check"></i> Create User';
        }
    }
    
    /**
     * Show confirmation modal
     */
    function showConfirmModal() {
        const modal = document.getElementById('createUserConfirmModal');
        const nameEl = document.getElementById('createUserConfirmName');
        const detailsEl = document.getElementById('createUserConfirmDetails');
        
        if (!modal) return false;
        
        // Get user details for confirmation
        const username = document.getElementById('createUsername')?.value.trim() || '';
        const fullName = document.getElementById('createFullName')?.value.trim() || '';
        const email = document.getElementById('createEmail')?.value.trim() || '';
        const adminLevel = document.getElementById('createAdminLevel');
        const adminLevelText = adminLevel?.options[adminLevel.selectedIndex]?.text || '';
        
        // Update modal content
        if (nameEl) {
            nameEl.textContent = fullName || username || 'New User';
        }
        
        if (detailsEl) {
            let details = `Username: ${username || 'N/A'}`;
            if (email) {
                const emailInput = document.getElementById('createEmail');
                const fullEmail = window.UserManagementCreateValidation 
                    ? window.UserManagementCreateValidation.getFullEmail(emailInput)
                    : email + '@deped.gov.ph';
                details += `<br>Email: ${fullEmail}`;
            }
            if (adminLevelText) {
                details += `<br>Admin Level: ${adminLevelText}`;
            }
            detailsEl.innerHTML = details;
        }
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        return true;
    }
    
    /**
     * Hide confirmation modal
     */
    function hideConfirmModal() {
        const modal = document.getElementById('createUserConfirmModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }
    
    /**
     * Show success modal
     */
    function showSuccessModal(message) {
        const modal = document.getElementById('createUserSuccessModal');
        const messageEl = document.getElementById('createUserSuccessMessage');
        
        if (!modal) {
            // Fallback to alert if modal doesn't exist
            alert(message || 'User created successfully');
            return;
        }
        
        if (messageEl) {
            messageEl.textContent = message || 'User has been created successfully!';
        }
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    /**
     * Hide success modal
     */
    function hideSuccessModal() {
        const modal = document.getElementById('createUserSuccessModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }
    
    /**
     * Show success message
     */
    function showSuccess(message) {
        showSuccessModal(message);
    }
    
    /**
     * Show error message
     */
    function showError(message) {
        if (window.showNotification) {
            window.showNotification(message, 'error');
        } else {
            alert('Error: ' + message);
        }
    }
    
    /**
     * Reset form
     */
    function resetForm() {
        const form = document.querySelector('#userManagementCreatePage');
        if (form) {
            const inputs = form.querySelectorAll('input, select');
            inputs.forEach(input => {
                if (input.type === 'checkbox') {
                    input.checked = false;
                } else {
                    input.value = '';
                }
                input.classList.remove('is-valid', 'is-invalid');
            });
        }
        
        // Clear errors
        if (window.UserManagementCreateValidation) {
            window.UserManagementCreateValidation.clearAllErrors();
        }
        
        // Reset permissions
        if (window.UserManagementCreatePermissions) {
            window.UserManagementCreatePermissions.updatePermissions('');
        }
    }
    
    /**
     * Actually submit the form (called after confirmation)
     */
    function doSubmit() {
        const formData = getFormData();
        
        // Hide confirmation modal
        hideConfirmModal();
        
        // Show loading
        showLoading();
        
        // Submit to API
        fetch(CREATE_ENDPOINT, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(formData)
        })
        .then(async response => {
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            
            return data;
        })
        .then(data => {
            if (data.success) {
                resetForm();
                
                // Hide create page and show main page
                if (window.UserManagementTable && window.UserManagementTable.hideUserCreate) {
                    window.UserManagementTable.hideUserCreate();
                }
                
                // Show success modal
                showSuccess(data.message || 'User created successfully');
                
                // Refresh table
                if (window.UserManagementTable && window.UserManagementTable.refresh) {
                    setTimeout(() => {
                        window.UserManagementTable.refresh();
                    }, 1000);
                }
            } else {
                showError(data.error || 'Failed to create user');
            }
        })
        .catch(error => {
            console.error('Error creating user:', error);
            showError(error.message || 'Failed to create user. Please try again.');
        })
        .finally(() => {
            hideLoading();
        });
    }
    
    /**
     * Submit form (shows confirmation modal first)
     */
    async function submitForm() {
        // Validate form (async)
        if (window.UserManagementCreateValidation) {
            const isValid = await window.UserManagementCreateValidation.validateForm();
            if (!isValid) {
                // Scroll to first error (validation already handles scrolling)
                return;
            }
        }
        
        // Show confirmation modal
        showConfirmModal();
    }
    
    /**
     * Initialize submit handler
     */
    function init() {
        const submitBtn = document.getElementById('submitCreateUser');
        const cancelBtn = document.getElementById('cancelCreateUser');
        
        if (submitBtn) {
            submitBtn.addEventListener('click', function(e) {
                e.preventDefault();
                submitForm();
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function(e) {
                e.preventDefault();
                resetForm();
                
                // Hide create page
                if (window.UserManagementTable && window.UserManagementTable.hideUserCreate) {
                    window.UserManagementTable.hideUserCreate();
                }
            });
        }
        
        // Confirmation modal handlers
        const closeConfirmBtn = document.getElementById('closeCreateUserConfirmModal');
        const cancelConfirmBtn = document.getElementById('cancelCreateUserConfirm');
        const confirmCreateBtn = document.getElementById('confirmCreateUser');
        const confirmModal = document.getElementById('createUserConfirmModal');
        
        if (closeConfirmBtn) {
            closeConfirmBtn.addEventListener('click', hideConfirmModal);
        }
        
        if (cancelConfirmBtn) {
            cancelConfirmBtn.addEventListener('click', hideConfirmModal);
        }
        
        if (confirmCreateBtn) {
            confirmCreateBtn.addEventListener('click', function() {
                doSubmit();
            });
        }
        
        // Close confirmation modal when clicking overlay
        if (confirmModal) {
            confirmModal.addEventListener('click', function(e) {
                if (e.target === confirmModal) {
                    hideConfirmModal();
                }
            });
        }
        
        // Success modal handlers
        const closeSuccessBtn = document.getElementById('closeCreateUserSuccessModal');
        const confirmSuccessBtn = document.getElementById('confirmCreateUserSuccess');
        const successModal = document.getElementById('createUserSuccessModal');
        
        if (closeSuccessBtn) {
            closeSuccessBtn.addEventListener('click', hideSuccessModal);
        }
        
        if (confirmSuccessBtn) {
            confirmSuccessBtn.addEventListener('click', function() {
                hideSuccessModal();
            });
        }
        
        // Close success modal when clicking overlay
        if (successModal) {
            successModal.addEventListener('click', function(e) {
                if (e.target === successModal) {
                    hideSuccessModal();
                }
            });
        }
    }
    
    // Export for external access
    window.UserManagementCreateSubmit = {
        submitForm: submitForm,
        resetForm: resetForm
    };
    
    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

