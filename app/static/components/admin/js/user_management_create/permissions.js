/**
 * Permission management for create user form
 * Handles enabling/disabling permissions based on admin level
 */

(function() {
    'use strict';
    
    // Permission restrictions by admin level
    // Based on ADMIN_ROLE_PRIVILEGE_SUMMARY.md
    const PERMISSION_RULES = {
        central: {
            can_create_users: true,
            can_manage_users: true,
            can_set_deadlines: true,
            can_approve_submissions: true,
            can_view_system_logs: true
        },
        region: {
            can_create_users: false,
            can_manage_users: false,
            can_set_deadlines: true,
            can_approve_submissions: true,
            can_view_system_logs: true
        },
        division: {
            can_create_users: true,
            can_manage_users: true,
            can_set_deadlines: false,
            can_approve_submissions: true,
            can_view_system_logs: false
        },
        district: {
            can_create_users: false,
            can_manage_users: false,
            can_set_deadlines: false,
            can_approve_submissions: true,
            can_view_system_logs: false
        },
        school: {
            can_create_users: false,
            can_manage_users: false,
            can_set_deadlines: false,
            can_approve_submissions: false,
            can_view_system_logs: false
        }
    };
    
    const PERMISSION_IDS = {
        can_create_users: 'createCanCreateUsers',
        can_manage_users: 'createCanManageUsers',
        can_set_deadlines: 'createCanSetDeadlines',
        can_approve_submissions: 'createCanApproveSubmissions',
        can_view_system_logs: 'createCanViewSystemLogs'
    };
    
    /**
     * Update permissions based on admin level
     */
    function updatePermissions(adminLevel) {
        if (!adminLevel) {
            // Disable all if no admin level selected
            Object.values(PERMISSION_IDS).forEach(permId => {
                const checkbox = document.getElementById(permId);
                if (checkbox) {
                    checkbox.disabled = true;
                    checkbox.checked = false;
                }
            });
            return;
        }
        
        const rules = PERMISSION_RULES[adminLevel] || {};
        
        // Update each permission checkbox
        Object.keys(PERMISSION_IDS).forEach(permKey => {
            const permId = PERMISSION_IDS[permKey];
            const checkbox = document.getElementById(permId);
            
            if (checkbox) {
                const isAllowed = rules[permKey] || false;
                
                checkbox.disabled = !isAllowed;
                
                // Uncheck if not allowed
                if (!isAllowed) {
                    checkbox.checked = false;
                }
            }
        });
    }
    
    /**
     * Get permission values from form
     */
    function getPermissionValues() {
        const permissions = {};
        
        Object.keys(PERMISSION_IDS).forEach(permKey => {
            const permId = PERMISSION_IDS[permKey];
            const checkbox = document.getElementById(permId);
            
            if (checkbox) {
                permissions[permKey] = checkbox.checked && !checkbox.disabled;
            } else {
                permissions[permKey] = false;
            }
        });
        
        return permissions;
    }
    
    /**
     * Geographic field rules by admin level
     */
    const GEOGRAPHIC_RULES = {
        central: {
            region: false,
            division: false,
            district: false,
            school: false
        },
        region: {
            region: true,
            division: false,
            district: false,
            school: false
        },
        division: {
            region: true,
            division: true,
            district: false,
            school: false
        },
        district: {
            region: true,
            division: true,
            district: true,
            school: false
        },
        school: {
            region: true,
            division: true,
            district: true,
            school: true
        }
    };
    
    /**
     * Geographic field IDs
     */
    const GEOGRAPHIC_FIELDS = {
        region: {
            input: 'createRegion',
            hidden: 'createRegionId',
            dropdown: 'createRegionDropdown'
        },
        division: {
            input: 'createDivision',
            hidden: 'createDivisionId',
            dropdown: 'createDivisionDropdown'
        },
        district: {
            input: 'createDistrict',
            hidden: 'createDistrictId',
            dropdown: 'createDistrictDropdown'
        },
        school: {
            input: 'createSchool',
            hidden: 'createSchoolId',
            dropdown: 'createSchoolDropdown'
        }
    };
    
    /**
     * Update geographic fields based on admin level
     */
    function updateGeographicFields(adminLevel) {
        const rules = GEOGRAPHIC_RULES[adminLevel] || GEOGRAPHIC_RULES.central;
        
        // Define field hierarchy (child fields depend on parent)
        const fieldOrder = ['region', 'division', 'district', 'school'];
        
        // Update each geographic field in order
        fieldOrder.forEach(fieldKey => {
            const field = GEOGRAPHIC_FIELDS[fieldKey];
            const input = document.getElementById(field.input);
            const hidden = document.getElementById(field.hidden);
            const dropdown = document.getElementById(field.dropdown);
            const isEnabled = rules[fieldKey] || false;
            
            // Enable/disable input field
            if (input) {
                input.disabled = !isEnabled;
                if (!isEnabled) {
                    // Clear value and validation state when disabled
                    input.value = '';
                    input.classList.remove('is-valid', 'is-invalid');
                    // Hide dropdown if visible
                    if (dropdown) {
                        dropdown.style.display = 'none';
                    }
                }
            }
            
            // Clear hidden field when disabled
            if (hidden) {
                if (!isEnabled) {
                    hidden.value = '';
                }
            }
            
            // Clear error messages when disabled
            const errorEl = document.getElementById(field.input + 'Error');
            if (errorEl && !isEnabled) {
                errorEl.textContent = '';
                errorEl.style.display = 'none';
            }
            
            // If a parent field is disabled, also clear and disable child fields
            if (!isEnabled) {
                const currentIndex = fieldOrder.indexOf(fieldKey);
                // Clear all child fields
                for (let i = currentIndex + 1; i < fieldOrder.length; i++) {
                    const childKey = fieldOrder[i];
                    const childField = GEOGRAPHIC_FIELDS[childKey];
                    const childInput = document.getElementById(childField.input);
                    const childHidden = document.getElementById(childField.hidden);
                    const childDropdown = document.getElementById(childField.dropdown);
                    
                    if (childInput) {
                        childInput.disabled = true;
                        childInput.value = '';
                        childInput.classList.remove('is-valid', 'is-invalid');
                        if (childDropdown) {
                            childDropdown.style.display = 'none';
                        }
                    }
                    
                    if (childHidden) {
                        childHidden.value = '';
                    }
                    
                    const childErrorEl = document.getElementById(childField.input + 'Error');
                    if (childErrorEl) {
                        childErrorEl.textContent = '';
                        childErrorEl.style.display = 'none';
                    }
                }
            }
        });
    }
    
    /**
     * Initialize permission management
     */
    function init() {
        const adminLevelSelect = document.getElementById('createAdminLevel');
        
        if (!adminLevelSelect) return;
        
        // Update permissions and geographic fields when admin level changes
        adminLevelSelect.addEventListener('change', function() {
            updatePermissions(this.value);
            updateGeographicFields(this.value);
        });
        
        // Initial update
        updatePermissions(adminLevelSelect.value);
        updateGeographicFields(adminLevelSelect.value);
    }
    
    // Export for external access
    window.UserManagementCreatePermissions = {
        updatePermissions: updatePermissions,
        getPermissionValues: getPermissionValues,
        updateGeographicFields: updateGeographicFields
    };
    
    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

