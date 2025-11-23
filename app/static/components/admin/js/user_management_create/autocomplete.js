/**
 * Autocomplete functionality for geographic fields
 * Handles region, division, district, and school autocomplete with debounce
 */

(function() {
    'use strict';
    
    const DEBOUNCE_DELAY = 300;
    const MAX_RESULTS = 5;
    
    const ENDPOINTS = {
        region: '/api/user-management/search/regions/',
        division: '/api/user-management/search/divisions/',
        district: '/api/user-management/search/districts/',
        school: '/api/user-management/search/schools/'
    };
    
    let debounceTimers = {};
    
    /**
     * Initialize autocomplete for a field
     */
    function initAutocomplete(inputId, hiddenId, dropdownId, type) {
        const input = document.getElementById(inputId);
        const hidden = document.getElementById(hiddenId);
        const dropdown = document.getElementById(dropdownId);
        
        if (!input || !hidden || !dropdown) return;
        
        let debounceTimer;
        
        // Handle input with debounce (only if not disabled)
        input.addEventListener('input', function() {
            if (this.disabled) return;
            
            clearTimeout(debounceTimer);
            const query = this.value.trim();
            
            if (query.length < 2) {
                hideDropdown(dropdown);
                clearSelection(input, hidden);
                return;
            }
            
            debounceTimer = setTimeout(() => {
                searchAutocomplete(type, query, dropdown, input, hidden, inputId);
            }, DEBOUNCE_DELAY);
        });
        
        // Handle focus (only if not disabled)
        input.addEventListener('focus', function() {
            if (this.disabled) return;
            
            const query = this.value.trim();
            if (query.length >= 2) {
                searchAutocomplete(type, query, dropdown, input, hidden, inputId);
            }
        });
        
        // Handle blur (hide dropdown after click)
        input.addEventListener('blur', function() {
            setTimeout(() => {
                hideDropdown(dropdown);
            }, 200);
        });
        
        // Handle escape key
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                hideDropdown(dropdown);
            }
        });
    }
    
    /**
     * Check which schools already have accounts
     */
    async function checkSchoolsWithAccounts(schoolIds) {
        if (!schoolIds || schoolIds.length === 0) return {};
        
        const schoolIdsWithAccounts = {};
        
        // Check each school ID
        const checkPromises = schoolIds.map(schoolId => {
            return new Promise((resolve) => {
                if (window.UserManagementCreateValidation) {
                    window.UserManagementCreateValidation.checkUserExists(null, null, schoolId, function(result) {
                        if (result.school_has_account) {
                            schoolIdsWithAccounts[schoolId] = true;
                        }
                        resolve();
                    });
                } else {
                    resolve();
                }
            });
        });
        
        await Promise.all(checkPromises);
        return schoolIdsWithAccounts;
    }
    
    /**
     * Search autocomplete results
     */
    async function searchAutocomplete(type, query, dropdown, input, hidden, inputId) {
        const endpoint = ENDPOINTS[type];
        if (!endpoint) return;
        
        const url = `${endpoint}?q=${encodeURIComponent(query)}`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                // For school type, check which schools already have accounts
                if (type === 'school') {
                    const adminLevel = document.getElementById('createAdminLevel')?.value;
                    if (adminLevel === 'school') {
                        const schoolIds = data.results.map(r => r.school_id);
                        const schoolsWithAccounts = await checkSchoolsWithAccounts(schoolIds);
                        
                        // Mark schools with accounts in results
                        data.results = data.results.map(result => ({
                            ...result,
                            has_account: schoolsWithAccounts[result.school_id] || false
                        }));
                    }
                }
                
                renderDropdown(dropdown, data.results, type, input, hidden, inputId);
                showDropdown(dropdown);
                
                // Clear error if results found
                if (window.UserManagementCreateValidation) {
                    window.UserManagementCreateValidation.clearFieldError(inputId);
                }
            } else {
                hideDropdown(dropdown);
                
                // Show error if no results found and user has typed something
                if (input.value.trim().length >= 2) {
                    const fieldNames = {
                        region: 'Region',
                        division: 'Division',
                        district: 'District',
                        school: 'School'
                    };
                    
                    if (window.UserManagementCreateValidation) {
                        const fieldName = fieldNames[type] || type;
                        window.UserManagementCreateValidation.showFieldError(
                            inputId,
                            `${fieldName} not found. Please select from the dropdown.`
                        );
                    }
                }
            }
        } catch (error) {
            console.error(`Error searching ${type}:`, error);
            hideDropdown(dropdown);
            
            // Show error on fetch failure
            if (window.UserManagementCreateValidation && input.value.trim().length >= 2) {
                const fieldNames = {
                    region: 'Region',
                    division: 'Division',
                    district: 'District',
                    school: 'School'
                };
                
                const fieldName = fieldNames[type] || type;
                window.UserManagementCreateValidation.showFieldError(
                    inputId,
                    `Error searching ${fieldName.toLowerCase()}. Please try again.`
                );
            }
        }
    }
    
    /**
     * Store results for later access (for school auto-fill)
     */
    let currentResults = {};
    
    /**
     * Render dropdown with results
     */
    function renderDropdown(dropdown, results, type, input, hidden, inputId) {
        // Store results for school type
        if (type === 'school') {
            currentResults[inputId] = results;
        }
        let html = '';
        
        results.forEach(result => {
            let displayText = result.name;
            if (type === 'school') {
                displayText = `${result.school_id} - ${result.school_name}`;
            }
            
            // Store school_id in data attribute for school type
            const schoolIdAttr = type === 'school' ? ` data-school-id="${result.school_id}"` : '';
            
            // Check if school already has account (for school type)
            const hasAccount = type === 'school' && result.has_account;
            const disabledClass = hasAccount ? ' autocomplete-item-disabled' : '';
            const disabledAttr = hasAccount ? ' data-disabled="true"' : '';
            const accountBadge = hasAccount ? ' <span class="text-muted" style="font-size: 0.85em;">(Account exists)</span>' : '';
            
            html += `
                <div class="autocomplete-item${disabledClass}" data-id="${result.id}" data-type="${type}"${schoolIdAttr}${disabledAttr}>
                    ${escapeHtml(displayText)}${accountBadge}
                </div>
            `;
        });
        
        dropdown.innerHTML = html;
        
        // Add click handlers
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', function() {
                // Prevent selection if disabled (school already has account)
                if (this.getAttribute('data-disabled') === 'true') {
                    return;
                }
                
                const id = this.getAttribute('data-id');
                const displayText = this.textContent.trim().replace(/\s*\(Account exists\)\s*$/, '');
                const itemType = this.getAttribute('data-type');
                const schoolId = this.getAttribute('data-school-id'); // Get school_id for school type
                
                input.value = displayText;
                hidden.value = id;
                
                // For school type, also store school_id in data attribute for validation
                if (itemType === 'school' && schoolId) {
                    hidden.setAttribute('data-school-id', schoolId);
                    input.setAttribute('data-school-id', schoolId);
                } else {
                    hidden.removeAttribute('data-school-id');
                    input.removeAttribute('data-school-id');
                }
                
                hideDropdown(dropdown);
                
                // Auto-fill email and parent fields for school users
                if (itemType === 'school') {
                    const schoolId = this.getAttribute('data-school-id');
                    const adminLevel = document.getElementById('createAdminLevel')?.value;
                    const emailInput = document.getElementById('createEmail');
                    
                    // Get school data from stored results
                    const storedResults = currentResults[inputId] || [];
                    const schoolData = storedResults.find(r => r.school_id === schoolId);
                    
                    // Check if school already has an account (only for school-level users)
                    if (adminLevel === 'school' && schoolId && window.UserManagementCreateValidation) {
                        window.UserManagementCreateValidation.checkUserExists(null, null, schoolId, function(result) {
                            if (result.school_has_account) {
                                window.UserManagementCreateValidation.showFieldError('createSchool', 'This school already has an account. Only one account per school is allowed.');
                                input.classList.remove('is-valid');
                                input.classList.add('is-invalid');
                                // Clear the selection
                                input.value = '';
                                hidden.value = '';
                            } else {
                                window.UserManagementCreateValidation.clearFieldError('createSchool');
                                input.classList.add('is-valid');
                                input.classList.remove('is-invalid');
                                
                                // Auto-fill parent geographic fields (region, division, district)
                                if (schoolData) {
                                    // Auto-fill region
                                    if (schoolData.region_id && schoolData.region_name) {
                                        const regionInput = document.getElementById('createRegion');
                                        const regionHidden = document.getElementById('createRegionId');
                                        if (regionInput && regionHidden) {
                                            regionInput.value = schoolData.region_name;
                                            regionHidden.value = schoolData.region_id;
                                            regionInput.classList.add('is-valid');
                                            regionInput.classList.remove('is-invalid');
                                            window.UserManagementCreateValidation.clearFieldError('createRegion');
                                        }
                                    }
                                    
                                    // Auto-fill division
                                    if (schoolData.division_id && schoolData.division_name) {
                                        const divisionInput = document.getElementById('createDivision');
                                        const divisionHidden = document.getElementById('createDivisionId');
                                        if (divisionInput && divisionHidden) {
                                            divisionInput.value = schoolData.division_name;
                                            divisionHidden.value = schoolData.division_id;
                                            divisionInput.classList.add('is-valid');
                                            divisionInput.classList.remove('is-invalid');
                                            window.UserManagementCreateValidation.clearFieldError('createDivision');
                                        }
                                    }
                                    
                                    // Auto-fill district
                                    if (schoolData.district_id && schoolData.district_name) {
                                        const districtInput = document.getElementById('createDistrict');
                                        const districtHidden = document.getElementById('createDistrictId');
                                        if (districtInput && districtHidden) {
                                            districtInput.value = schoolData.district_name;
                                            districtHidden.value = schoolData.district_id;
                                            districtInput.classList.add('is-valid');
                                            districtInput.classList.remove('is-invalid');
                                            window.UserManagementCreateValidation.clearFieldError('createDistrict');
                                        }
                                    }
                                }
                                
                                // Auto-fill email with school ID for school users (only if school doesn't have account)
                                if (emailInput && schoolId && !result.school_has_account) {
                                    emailInput.value = schoolId;
                                    // Small delay to ensure data attribute is set before validation runs
                                    setTimeout(() => {
                                        // Re-validate email after setting school ID
                                        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                                    }, 10);
                                } else {
                                    // Trigger change event on hidden field for other validation listeners
                                    hidden.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                            }
                        });
                    } else {
                        // Not a school-level user, just clear errors and proceed
                        if (window.UserManagementCreateValidation) {
                            window.UserManagementCreateValidation.clearFieldError(inputId);
                            input.classList.add('is-valid');
                            input.classList.remove('is-invalid');
                        }
                        
                        // Auto-fill parent geographic fields (region, division, district)
                        if (schoolData) {
                            // Auto-fill region
                            if (schoolData.region_id && schoolData.region_name) {
                                const regionInput = document.getElementById('createRegion');
                                const regionHidden = document.getElementById('createRegionId');
                                if (regionInput && regionHidden) {
                                    regionInput.value = schoolData.region_name;
                                    regionHidden.value = schoolData.region_id;
                                    regionInput.classList.add('is-valid');
                                    regionInput.classList.remove('is-invalid');
                                    if (window.UserManagementCreateValidation) {
                                        window.UserManagementCreateValidation.clearFieldError('createRegion');
                                    }
                                }
                            }
                            
                            // Auto-fill division
                            if (schoolData.division_id && schoolData.division_name) {
                                const divisionInput = document.getElementById('createDivision');
                                const divisionHidden = document.getElementById('createDivisionId');
                                if (divisionInput && divisionHidden) {
                                    divisionInput.value = schoolData.division_name;
                                    divisionHidden.value = schoolData.division_id;
                                    divisionInput.classList.add('is-valid');
                                    divisionInput.classList.remove('is-invalid');
                                    if (window.UserManagementCreateValidation) {
                                        window.UserManagementCreateValidation.clearFieldError('createDivision');
                                    }
                                }
                            }
                            
                            // Auto-fill district
                            if (schoolData.district_id && schoolData.district_name) {
                                const districtInput = document.getElementById('createDistrict');
                                const districtHidden = document.getElementById('createDistrictId');
                                if (districtInput && districtHidden) {
                                    districtInput.value = schoolData.district_name;
                                    districtHidden.value = schoolData.district_id;
                                    districtInput.classList.add('is-valid');
                                    districtInput.classList.remove('is-invalid');
                                    if (window.UserManagementCreateValidation) {
                                        window.UserManagementCreateValidation.clearFieldError('createDistrict');
                                    }
                                }
                            }
                        }
                        
                        // Trigger change event on hidden field (with small delay to ensure data attribute is set)
                        setTimeout(() => {
                            hidden.dispatchEvent(new Event('change', { bubbles: true }));
                        }, 10);
                    }
                } else {
                    // Not a school field, just clear errors
                    if (window.UserManagementCreateValidation) {
                        window.UserManagementCreateValidation.clearFieldError(inputId);
                        input.classList.add('is-valid');
                        input.classList.remove('is-invalid');
                    }
                    
                    // Trigger change event on hidden field
                    hidden.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                // Trigger change event for other modules
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });
        });
    }
    
    /**
     * Show dropdown
     */
    function showDropdown(dropdown) {
        dropdown.style.display = 'block';
        dropdown.classList.add('show');
    }
    
    /**
     * Hide dropdown
     */
    function hideDropdown(dropdown) {
        dropdown.style.display = 'none';
        dropdown.classList.remove('show');
    }
    
    /**
     * Clear selection
     */
    function clearSelection(input, hidden) {
        hidden.value = '';
        // Also clear school_id data attribute if it's a school field
        if (hidden.id === 'createSchoolId') {
            hidden.removeAttribute('data-school-id');
            input.removeAttribute('data-school-id');
        }
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Initialize all autocomplete fields
     */
    function init() {
        // Region autocomplete
        initAutocomplete('createRegion', 'createRegionId', 'createRegionDropdown', 'region');
        
        // Division autocomplete
        initAutocomplete('createDivision', 'createDivisionId', 'createDivisionDropdown', 'division');
        
        // District autocomplete
        initAutocomplete('createDistrict', 'createDistrictId', 'createDistrictDropdown', 'district');
        
        // School autocomplete
        initAutocomplete('createSchool', 'createSchoolId', 'createSchoolDropdown', 'school');
    }
    
    // Export for external access
    window.UserManagementCreateAutocomplete = {
        init: init
    };
    
    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

