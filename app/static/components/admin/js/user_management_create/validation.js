/**
 * Form validation for create user form
 * Handles email format validation based on admin level
 */

(function() {
    'use strict';
    
    const EMAIL_PATTERN = /^[a-zA-Z0-9._-]+$/;
    const SCHOOL_ID_PATTERN = /^[0-9]{6,}$/; // School ID is typically 6+ digits
    
    /**
     * Get full email value (with @deped.gov.ph suffix)
     */
    function getFullEmail(emailInput) {
        if (!emailInput) return '';
        const value = emailInput.value.trim();
        if (!value) return '';
        // If already contains @, return as is, otherwise append @deped.gov.ph
        if (value.includes('@')) {
            return value;
        }
        return value + '@deped.gov.ph';
    }
    
    /**
     * Get email prefix (without @deped.gov.ph)
     */
    function getEmailPrefix(emailInput) {
        if (!emailInput) return '';
        const value = emailInput.value.trim();
        if (!value) return '';
        // Remove @deped.gov.ph if present
        return value.replace('@deped.gov.ph', '').trim();
    }
    
    /**
     * Validate email format based on admin level
     */
    function validateEmail(emailPrefix, adminLevel) {
        if (!emailPrefix || emailPrefix.trim().length === 0) {
            return { valid: false, message: 'Email is required' };
        }
        
        // School users: email should be school_id format
        if (adminLevel === 'school') {
            // Check if it's a valid school ID format (numeric, 6+ digits)
            if (!SCHOOL_ID_PATTERN.test(emailPrefix)) {
                return { 
                    valid: false, 
                    message: 'Email must be a valid school ID (numeric, 6+ digits)' 
                };
            }
            
            return { valid: true };
        }
        
        // Other users: must match text.text format (before @deped.gov.ph)
        if (!EMAIL_PATTERN.test(emailPrefix)) {
            return { 
                valid: false, 
                message: 'Email must be in format: text.text (e.g., firstname.lastname)' 
            };
        }
        
        return { valid: true };
    }
    
    /**
     * Validate required fields
     */
    function validateRequired(fieldId, fieldName) {
        const field = document.getElementById(fieldId);
        if (!field) return { valid: false, message: `${fieldName} field not found` };
        
        const value = field.value.trim();
        if (!value) {
            return { valid: false, message: `${fieldName} is required` };
        }
        
        return { valid: true };
    }
    
    /**
     * Show field error
     */
    function showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const errorEl = document.getElementById(fieldId + 'Error');
        
        if (field) {
            field.classList.add('is-invalid');
            field.classList.remove('is-valid');
        }
        
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }
    
    /**
     * Clear field error
     */
    function clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        const errorEl = document.getElementById(fieldId + 'Error');
        
        if (field) {
            field.classList.remove('is-invalid');
        }
        
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
    }
    
    /**
     * Scroll to first error field
     */
    function scrollToFirstError() {
        const firstErrorField = document.querySelector('#userManagementCreatePage .is-invalid');
        if (firstErrorField) {
            // Get the form group or card containing the error
            const formGroup = firstErrorField.closest('.form-group') || 
                            firstErrorField.closest('.card') ||
                            firstErrorField;
            
            // Calculate offset to account for fixed headers
            const offset = 100;
            const elementPosition = formGroup.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
            
            // Focus the field if it's an input
            if (firstErrorField.tagName === 'INPUT' || firstErrorField.tagName === 'SELECT') {
                setTimeout(() => {
                    firstErrorField.focus();
                }, 500);
            }
        }
    }
    
    /**
     * Validate entire form (async to check school account)
     */
    async function validateForm() {
        let isValid = true;
        
        // Clear all errors first
        clearAllErrors();
        
        // Validate username
        const usernameValidation = validateRequired('createUsername', 'Username');
        if (!usernameValidation.valid) {
            showFieldError('createUsername', usernameValidation.message);
            isValid = false;
        } else {
            const username = document.getElementById('createUsername')?.value.trim();
            if (username && username.length < 3) {
                showFieldError('createUsername', 'Username must be at least 3 characters');
                isValid = false;
            }
            // Note: Username existence check is done in real-time, but we'll do a final check if needed
        }
        
        // Validate admin level
        const adminLevelValidation = validateRequired('createAdminLevel', 'Admin Level');
        if (!adminLevelValidation.valid) {
            showFieldError('createAdminLevel', adminLevelValidation.message);
            isValid = false;
        }
        
        // Validate full name
        const fullNameValidation = validateRequired('createFullName', 'Full Name');
        if (!fullNameValidation.valid) {
            showFieldError('createFullName', fullNameValidation.message);
            isValid = false;
        }
        
        // Validate email based on admin level
        const adminLevel = document.getElementById('createAdminLevel')?.value;
        const emailInput = document.getElementById('createEmail');
        const emailPrefix = emailInput ? getEmailPrefix(emailInput) : '';
        
        if (!emailPrefix) {
            showFieldError('createEmail', 'Email is required');
            isValid = false;
        } else if (adminLevel) {
            const emailValidation = validateEmail(emailPrefix, adminLevel);
            if (!emailValidation.valid) {
                showFieldError('createEmail', emailValidation.message);
                isValid = false;
            }
        }
        
        // Validate geographic fields (only if enabled)
        const geographicFields = [
            { inputId: 'createRegion', name: 'Region' },
            { inputId: 'createDivision', name: 'Division' },
            { inputId: 'createDistrict', name: 'District' },
            { inputId: 'createSchool', name: 'School' }
        ];
        
        for (const field of geographicFields) {
            const input = document.getElementById(field.inputId);
            // Only validate if field is enabled
            if (input && !input.disabled) {
                const validation = validateGeographicField(field.inputId, field.name);
                if (!validation.valid) {
                    showFieldError(field.inputId, validation.message);
                    isValid = false;
                }
                
                // Special validation for school: check if school already has account and email matches
                if (field.inputId === 'createSchool' && adminLevel === 'school') {
                    const schoolIdHidden = document.getElementById('createSchoolId');
                    const schoolInputField = document.getElementById('createSchool');
                    // Get school_id from data attribute (6-digit identifier), not the database id
                    // Try multiple sources: hidden field data attribute, input field data attribute, or fallback to value
                    const schoolId = schoolIdHidden?.getAttribute('data-school-id') || 
                                    schoolIdHidden?.dataset?.schoolId ||
                                    schoolInputField?.getAttribute('data-school-id') ||
                                    schoolInputField?.dataset?.schoolId ||
                                    schoolIdHidden?.value;
                    if (schoolId) {
                        // Check if email matches school ID
                        const emailPrefix = getEmailPrefix(emailInput);
                        if (emailPrefix && /^\d+$/.test(emailPrefix) && emailPrefix !== schoolId) {
                            showFieldError('createSchool', 'The selected school ID does not match the email. Please select the correct school or update the email.');
                            input.classList.remove('is-valid');
                            input.classList.add('is-invalid');
                            isValid = false;
                        } else if (!emailPrefix || !/^\d+$/.test(emailPrefix)) {
                            showFieldError('createSchool', 'Please enter a valid school ID in the email field that matches this school.');
                            input.classList.remove('is-valid');
                            input.classList.add('is-invalid');
                            isValid = false;
                        } else if (emailPrefix && /^\d+$/.test(emailPrefix) && emailPrefix === schoolId) {
                            // Email matches school ID - clear errors and mark as valid
                            clearFieldError('createSchool');
                            input.classList.add('is-valid');
                            input.classList.remove('is-invalid');
                            // Also clear any errors on email field
                            if (emailInput) {
                                clearFieldError('createEmail');
                                emailInput.classList.add('is-valid');
                                emailInput.classList.remove('is-invalid');
                            }
                        } else {
                            // Check if school already has account
                            try {
                                const result = await new Promise((resolve) => {
                                    checkUserExists(null, null, schoolId, resolve);
                                });
                                
                                if (result.school_has_account) {
                                    showFieldError('createSchool', 'This school already has an account. Only one account per school is allowed.');
                                    input.classList.remove('is-valid');
                                    input.classList.add('is-invalid');
                                    isValid = false;
                                }
                            } catch (error) {
                                console.error('Error checking school account:', error);
                                // If check fails, don't block submission but log error
                            }
                        }
                    }
                }
            }
        }
        
        // For school-level users: validate that email matches school_id
        if (adminLevel === 'school') {
            const schoolIdHidden = document.getElementById('createSchoolId');
            const schoolInput = document.getElementById('createSchool');
            // Get school_id from data attribute (6-digit identifier), not the database id
            // Try multiple sources: hidden field data attribute, input field data attribute, or fallback to value
            const schoolId = schoolIdHidden?.getAttribute('data-school-id') || 
                            schoolIdHidden?.dataset?.schoolId ||
                            schoolInput?.getAttribute('data-school-id') ||
                            schoolInput?.dataset?.schoolId ||
                            schoolIdHidden?.value;
            
            if (emailPrefix && /^\d+$/.test(emailPrefix)) {
                // Check if email school ID matches selected school ID
                if (schoolId && emailPrefix !== schoolId) {
                    showFieldError('createEmail', 'Email must match the selected school ID. The email should be the same as the school ID.');
                    if (emailInput) {
                        emailInput.classList.remove('is-valid');
                        emailInput.classList.add('is-invalid');
                    }
                    isValid = false;
                } else if (!schoolId) {
                    // School not selected yet, but email is entered
                    showFieldError('createEmail', 'Please select a school first. The email must match the school ID.');
                    if (emailInput) {
                        emailInput.classList.remove('is-valid');
                        emailInput.classList.add('is-invalid');
                    }
                    isValid = false;
                } else if (schoolId && emailPrefix === schoolId) {
                    // Email matches school ID - clear any errors and mark as valid
                    clearFieldError('createEmail');
                    if (emailInput) {
                        emailInput.classList.add('is-valid');
                        emailInput.classList.remove('is-invalid');
                    }
                    // Also clear any errors on school field
                    const schoolInput = document.getElementById('createSchool');
                    if (schoolInput) {
                        clearFieldError('createSchool');
                        schoolInput.classList.add('is-valid');
                        schoolInput.classList.remove('is-invalid');
                    }
                } else {
                    // Email matches school ID, check if school already has account
                    try {
                        const result = await new Promise((resolve) => {
                            checkUserExists(null, null, emailPrefix, resolve);
                        });
                        
                        if (result.school_has_account) {
                            showFieldError('createEmail', 'This school already has an account. Only one account per school is allowed.');
                            if (emailInput) {
                                emailInput.classList.remove('is-valid');
                                emailInput.classList.add('is-invalid');
                            }
                            isValid = false;
                            
                            // Also show error in school field
                            const schoolInput = document.getElementById('createSchool');
                            if (schoolInput) {
                                showFieldError('createSchool', 'This school already has an account. Only one account per school is allowed.');
                                schoolInput.classList.remove('is-valid');
                                schoolInput.classList.add('is-invalid');
                            }
                        }
                    } catch (error) {
                        console.error('Error checking school account from email:', error);
                    }
                }
            }
        }
        
        // Scroll to first error if validation failed
        if (!isValid) {
            setTimeout(() => {
                scrollToFirstError();
            }, 100);
        }
        
        return isValid;
    }
    
    /**
     * Clear all field errors
     */
    function clearAllErrors() {
        const errorFields = [
            'createUsername', 'createEmail', 'createFullName', 'createAdminLevel',
            'createRegion', 'createDivision', 'createDistrict', 'createSchool',
            'createAssignedArea'
        ];
        
        errorFields.forEach(fieldId => {
            clearFieldError(fieldId);
        });
    }
    
    /**
     * Check if username, email, or school already has an account
     */
    function checkUserExists(username, email, schoolId, callback) {
        const params = new URLSearchParams();
        if (username) params.append('username', username);
        if (email) params.append('email', email);
        if (schoolId) params.append('school_id', schoolId);
        
        if (params.toString() === '') {
            callback({ username_exists: false, email_exists: false, school_has_account: false });
            return;
        }
        
        fetch(`/api/admin/users/check/?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            callback(data);
        })
        .catch(error => {
            console.error('Error checking user existence:', error);
            callback({ username_exists: false, email_exists: false, school_has_account: false });
        });
    }
    
    /**
     * Setup real-time validation for all fields
     */
    function setupRealTimeValidation() {
        // Username validation - real-time
        const usernameInput = document.getElementById('createUsername');
        if (usernameInput) {
            let usernameTimeout;
            let isChecking = false;
            
            usernameInput.addEventListener('input', function() {
                clearTimeout(usernameTimeout);
                const value = this.value.trim();
                
                usernameTimeout = setTimeout(() => {
                    if (value.length === 0) {
                        showFieldError('createUsername', 'Username is required');
                    } else if (value.length < 3) {
                        showFieldError('createUsername', 'Username must be at least 3 characters');
                    } else {
                        // Check if username exists
                        if (!isChecking) {
                            isChecking = true;
                            checkUserExists(value, null, null, function(result) {
                                isChecking = false;
                                if (result.username_exists) {
                                    showFieldError('createUsername', 'Username already exists');
                                    usernameInput.classList.remove('is-valid');
                                } else {
                                    clearFieldError('createUsername');
                                    usernameInput.classList.add('is-valid');
                                    usernameInput.classList.remove('is-invalid');
                                }
                            });
                        }
                    }
                }, 500);
            });
            
            usernameInput.addEventListener('blur', function() {
                const value = this.value.trim();
                if (value.length === 0) {
                    showFieldError('createUsername', 'Username is required');
                } else if (value.length < 3) {
                    showFieldError('createUsername', 'Username must be at least 3 characters');
                } else if (!isChecking) {
                    // Final check on blur
                    isChecking = true;
                    checkUserExists(value, null, null, function(result) {
                        isChecking = false;
                        if (result.username_exists) {
                            showFieldError('createUsername', 'Username already exists');
                        } else {
                            clearFieldError('createUsername');
                            usernameInput.classList.add('is-valid');
                        }
                    });
                }
            });
        }
        
        // Full name validation - real-time
        const fullNameInput = document.getElementById('createFullName');
        if (fullNameInput) {
            let fullNameTimeout;
            fullNameInput.addEventListener('input', function() {
                clearTimeout(fullNameTimeout);
                const value = this.value.trim();
                
                fullNameTimeout = setTimeout(() => {
                    if (value.length === 0) {
                        showFieldError('createFullName', 'Full Name is required');
                    } else {
                        clearFieldError('createFullName');
                        this.classList.add('is-valid');
                        this.classList.remove('is-invalid');
                    }
                }, 300);
            });
            
            fullNameInput.addEventListener('blur', function() {
                const value = this.value.trim();
                if (value.length === 0) {
                    showFieldError('createFullName', 'Full Name is required');
                }
            });
        }
        
        // Email validation - real-time
        const emailInput = document.getElementById('createEmail');
        const adminLevelSelect = document.getElementById('createAdminLevel');
        
        if (emailInput && adminLevelSelect) {
            let emailTimeout;
            let isCheckingEmail = false;
            
            // Real-time validation on input
            emailInput.addEventListener('input', function() {
                clearTimeout(emailTimeout);
                const emailPrefix = getEmailPrefix(this);
                const adminLevel = adminLevelSelect.value;
                
                emailTimeout = setTimeout(() => {
                    if (emailPrefix.length === 0) {
                        showFieldError('createEmail', 'Email is required');
                    } else if (adminLevel) {
                        const validation = validateEmail(emailPrefix, adminLevel);
                        if (validation.valid) {
                            // Check if email exists and if school already has account (for school-level users)
                            if (!isCheckingEmail) {
                                isCheckingEmail = true;
                                const fullEmail = getFullEmail(this);
                                
                                // For school-level users, check if the school ID already has an account
                                const schoolId = (adminLevel === 'school' && /^\d+$/.test(emailPrefix)) ? emailPrefix : null;
                                
                                checkUserExists(null, fullEmail, schoolId, function(result) {
                                    isCheckingEmail = false;
                                    
                                    // For school-level users: check if email matches school_id
                                    if (adminLevel === 'school' && schoolId) {
                                        const schoolIdHidden = document.getElementById('createSchoolId');
                                        // Get school_id from data attribute (6-digit identifier), not the database id
                                        const schoolInputField = document.getElementById('createSchool');
                                        // Get school_id from data attribute (6-digit identifier), not the database id
                                        // Try multiple sources: hidden field data attribute, input field data attribute, or fallback to value
                                        const selectedSchoolId = schoolIdHidden?.getAttribute('data-school-id') || 
                                                                schoolIdHidden?.dataset?.schoolId ||
                                                                schoolInputField?.getAttribute('data-school-id') ||
                                                                schoolInputField?.dataset?.schoolId ||
                                                                schoolIdHidden?.value;
                                        
                                        // Check if email school ID matches selected school ID
                                        if (selectedSchoolId && schoolId !== selectedSchoolId) {
                                            showFieldError('createEmail', 'Email must match the selected school ID. The email should be the same as the school ID.');
                                            emailInput.classList.remove('is-valid');
                                            emailInput.classList.add('is-invalid');
                                        } else if (result.school_has_account) {
                                            showFieldError('createEmail', 'This school already has an account. Only one account per school is allowed.');
                                            emailInput.classList.remove('is-valid');
                                            emailInput.classList.add('is-invalid');
                                            
                                            // Also show error in school field if it's set and matches
                                            const schoolInput = document.getElementById('createSchool');
                                            if (schoolInput && schoolIdHidden && schoolIdHidden.value === schoolId) {
                                                showFieldError('createSchool', 'This school already has an account. Only one account per school is allowed.');
                                                schoolInput.classList.remove('is-valid');
                                                schoolInput.classList.add('is-invalid');
                                            }
                                        } else {
                                            // Email matches school ID and school doesn't have account
                                            clearFieldError('createEmail');
                                            emailInput.classList.add('is-valid');
                                            emailInput.classList.remove('is-invalid');
                                        }
                                    } else if (result.email_exists) {
                                        showFieldError('createEmail', 'Email already exists');
                                        emailInput.classList.remove('is-valid');
                                        emailInput.classList.add('is-invalid');
                                    } else {
                                        clearFieldError('createEmail');
                                        emailInput.classList.add('is-valid');
                                        emailInput.classList.remove('is-invalid');
                                    }
                                });
                            }
                        } else {
                            showFieldError('createEmail', validation.message);
                            this.classList.remove('is-valid');
                            this.classList.add('is-invalid');
                        }
                    }
                }, 500);
            });
            
            // Validate on blur
            emailInput.addEventListener('blur', function() {
                const adminLevel = adminLevelSelect.value;
                const emailPrefix = getEmailPrefix(this);
                
                if (emailPrefix.length === 0) {
                    showFieldError('createEmail', 'Email is required');
                } else if (adminLevel) {
                    const validation = validateEmail(emailPrefix, adminLevel);
                    if (validation.valid) {
                        // Final check on blur
                        if (!isCheckingEmail) {
                            isCheckingEmail = true;
                            const fullEmail = getFullEmail(this);
                            
                            // For school-level users, check if the school ID already has an account
                            const schoolId = (adminLevel === 'school' && /^\d+$/.test(emailPrefix)) ? emailPrefix : null;
                            
                            checkUserExists(null, fullEmail, schoolId, function(result) {
                                isCheckingEmail = false;
                                
                                // For school-level users: check if email matches school_id
                                if (adminLevel === 'school' && schoolId) {
                                    const schoolIdHidden = document.getElementById('createSchoolId');
                                    const schoolInputField = document.getElementById('createSchool');
                                    // Get school_id from data attribute (6-digit identifier), not the database id
                                    // Try multiple sources: hidden field data attribute, input field data attribute, or fallback to value
                                    const selectedSchoolId = schoolIdHidden?.getAttribute('data-school-id') || 
                                                            schoolIdHidden?.dataset?.schoolId ||
                                                            schoolInputField?.getAttribute('data-school-id') ||
                                                            schoolInputField?.dataset?.schoolId ||
                                                            schoolIdHidden?.value;
                                    
                                    // Check if email school ID matches selected school ID
                                    if (selectedSchoolId && schoolId !== selectedSchoolId) {
                                        showFieldError('createEmail', 'Email must match the selected school ID. The email should be the same as the school ID.');
                                        emailInput.classList.remove('is-valid');
                                        emailInput.classList.add('is-invalid');
                                    } else if (result.school_has_account) {
                                        showFieldError('createEmail', 'This school already has an account. Only one account per school is allowed.');
                                        emailInput.classList.remove('is-valid');
                                        emailInput.classList.add('is-invalid');
                                        
                                        // Also show error in school field if it's set and matches
                                        const schoolInput = document.getElementById('createSchool');
                                        if (schoolInput && schoolIdHidden && schoolIdHidden.value === schoolId) {
                                            showFieldError('createSchool', 'This school already has an account. Only one account per school is allowed.');
                                            schoolInput.classList.remove('is-valid');
                                            schoolInput.classList.add('is-invalid');
                                        }
                                    } else {
                                        // Email matches school ID and school doesn't have account
                                        clearFieldError('createEmail');
                                        emailInput.classList.add('is-valid');
                                        emailInput.classList.remove('is-invalid');
                                    }
                                } else if (result.email_exists) {
                                    showFieldError('createEmail', 'Email already exists');
                                    emailInput.classList.remove('is-valid');
                                    emailInput.classList.add('is-invalid');
                                } else {
                                    clearFieldError('createEmail');
                                    emailInput.classList.add('is-valid');
                                    emailInput.classList.remove('is-invalid');
                                }
                            });
                        }
                    } else {
                        showFieldError('createEmail', validation.message);
                        emailInput.classList.remove('is-valid');
                        emailInput.classList.add('is-invalid');
                    }
                }
            });
        }
        
        // Admin level validation - real-time
        if (adminLevelSelect) {
            adminLevelSelect.addEventListener('change', function() {
                const value = this.value;
                
                if (!value) {
                    showFieldError('createAdminLevel', 'Admin Level is required');
                } else {
                    clearFieldError('createAdminLevel');
                    this.classList.add('is-valid');
                    this.classList.remove('is-invalid');
                }
                
                // Update email placeholder and help text based on admin level
                const emailInput = document.getElementById('createEmail');
                const emailHelp = document.getElementById('createEmailHelp');
                
                if (emailInput && emailHelp) {
                    if (value === 'school') {
                        emailInput.placeholder = 'Enter school ID';
                        emailHelp.textContent = 'For school users, enter the school ID';
                    } else {
                        emailInput.placeholder = 'firstname.lastname';
                        emailHelp.textContent = 'Format: text.text (e.g., firstname.lastname)';
                    }
                    
                    // Re-validate email if it exists
                    if (emailInput.value.trim()) {
                        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
                
                // If changing to school level, check if selected school already has account
                if (value === 'school') {
                    const schoolIdHidden = document.getElementById('createSchoolId');
                    // Get school_id from data attribute (6-digit identifier), not the database id
                    const schoolId = schoolIdHidden?.getAttribute('data-school-id') || schoolIdHidden?.value;
                    const schoolInput = document.getElementById('createSchool');
                    
                    if (schoolId && schoolInput) {
                        checkUserExists(null, null, schoolId, function(result) {
                            if (result.school_has_account) {
                                showFieldError('createSchool', 'This school already has an account. Only one account per school is allowed.');
                                schoolInput.classList.remove('is-valid');
                                schoolInput.classList.add('is-invalid');
                                // Clear the selection
                                schoolInput.value = '';
                                const schoolIdHidden = document.getElementById('createSchoolId');
                                if (schoolIdHidden) {
                                    schoolIdHidden.value = '';
                                    schoolIdHidden.removeAttribute('data-school-id');
                                    schoolInput.removeAttribute('data-school-id');
                                }
                            }
                        });
                    }
                }
            });
        }
    }
    
    /**
     * Validate geographic field (region, division, district, school)
     */
    function validateGeographicField(fieldId, fieldName) {
        const input = document.getElementById(fieldId);
        const hidden = document.getElementById(fieldId + 'Id');
        
        if (!input || !hidden) return { valid: true };
        
        const inputValue = input.value.trim();
        const hiddenValue = hidden.value.trim();
        
        // If user typed something but didn't select from dropdown
        if (inputValue && !hiddenValue) {
            return {
                valid: false,
                message: `${fieldName} not found. Please select from the dropdown.`
            };
        }
        
        return { valid: true };
    }
    
    /**
     * Setup geographic field validation
     */
    function setupGeographicValidation() {
        const geographicFields = [
            { inputId: 'createRegion', name: 'Region' },
            { inputId: 'createDivision', name: 'Division' },
            { inputId: 'createDistrict', name: 'District' },
            { inputId: 'createSchool', name: 'School' }
        ];
        
        geographicFields.forEach(field => {
            const input = document.getElementById(field.inputId);
            if (!input) return;
            
            let validationTimeout;
            
            // Validate on blur (when user leaves the field)
            input.addEventListener('blur', function() {
                clearTimeout(validationTimeout);
                validationTimeout = setTimeout(() => {
                    const validation = validateGeographicField(field.inputId, field.name);
                    if (!validation.valid) {
                        showFieldError(field.inputId, validation.message);
                    } else if (this.value.trim() && document.getElementById(field.inputId + 'Id')?.value) {
                        clearFieldError(field.inputId);
                        this.classList.add('is-valid');
                        this.classList.remove('is-invalid');
                    }
                }, 100);
            });
            
            // Clear error when user starts typing again
            input.addEventListener('input', function() {
                const hidden = document.getElementById(field.inputId + 'Id');
                if (hidden && !hidden.value) {
                    // User is typing but hasn't selected - clear validation state
                    this.classList.remove('is-valid', 'is-invalid');
                }
            });
            
        });
    }
    
    /**
     * Initialize validation
     */
    function init() {
        setupRealTimeValidation();
        setupGeographicValidation();
    }
    
    // Export for external access
    window.UserManagementCreateValidation = {
        validateForm: validateForm,
        validateEmail: validateEmail,
        validateGeographicField: validateGeographicField,
        clearAllErrors: clearAllErrors,
        showFieldError: showFieldError,
        clearFieldError: clearFieldError,
        getFullEmail: getFullEmail,
        getEmailPrefix: getEmailPrefix,
        scrollToFirstError: scrollToFirstError,
        checkUserExists: checkUserExists
    };
    
    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

