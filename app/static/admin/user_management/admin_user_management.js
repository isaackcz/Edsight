// Enhanced Admin User Management JavaScript
// Integrates with the new admin user system backend APIs

document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const API_ENDPOINTS = {
        USERS: '/api/admin/users/',
        CREATE_USER: '/api/admin/users/create/',
        EDIT_USER: '/api/admin/users/',
        RESET_PASSWORD: '/api/admin/users/{id}/reset-password/',
        DELETE_USER: '/api/admin/users/{id}/delete/',
        EXPORT_USERS: '/api/admin/users/export/',
        GEOGRAPHIC_DATA: '/api/geographic-data/'
    };
    
    // State management
    let currentUsers = [];
    let filteredUsers = [];
    let currentPage = 1;
    let itemsPerPage = 10;
    let isEditing = false;
    let editingUserId = null;
    let currentStep = 1;
    let maxSteps = 3;
    
    // DOM Elements
    const userTableBody = document.querySelector('.data-table tbody');
    const addUserBtn = document.getElementById('addUserBtn');
    const userModal = document.getElementById('userModal');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const userForm = document.getElementById('userForm');
    const saveUserBtn = document.getElementById('saveUserBtn');
    const modalTitle = document.getElementById('modalTitle');
    
    // Form elements
    const fullNameInput = document.getElementById('fullName');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const adminLevelSelect = document.getElementById('adminLevel');
    const statusSelect = document.getElementById('status');
    const passwordInput = document.getElementById('password');
    const generatePasswordBtn = document.getElementById('generatePassword');
    const togglePasswordBtn = document.getElementById('togglePassword');
    
    // Multi-step form elements
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    const progressSteps = document.querySelectorAll('.progress-step');
    const formSteps = document.querySelectorAll('.form-step');
    
    // Geographic search inputs
    const regionInput = document.getElementById('region');
    const divisionInput = document.getElementById('division');
    const districtInput = document.getElementById('district');
    
    // Geographic search data storage
    // Geographic data cache - simplified
    let geographicData = {};
    
    // Permission checkboxes
    const permissionCheckboxes = {
        canCreateUsers: document.getElementById('canCreateUsers'),
        canManageUsers: document.getElementById('canManageUsers'),
        canSetDeadlines: document.getElementById('canSetDeadlines'),
        canApproveSubmissions: document.getElementById('canApproveSubmissions'),
        canViewSystemLogs: document.getElementById('canViewSystemLogs')
    };
    
    // Filter elements
    const roleFilter = document.getElementById('roleFilter');
    const statusFilter = document.getElementById('statusFilter');
    const areaFilter = document.getElementById('areaFilter');
    const userSearch = document.getElementById('userSearch');
    const resetFiltersBtn = document.getElementById('resetFilters');
    
    // Bulk actions elements
    const selectAllCheckbox = document.getElementById('selectAll');
    const bulkActionSelect = document.getElementById('bulkActionSelect');
    const applyBulkActionBtn = document.getElementById('applyBulkAction');
    
    // Initialize the application
    init();
    
    function init() {
        loadUsers();
        loadGeographicData();
        setupEventListeners();
        setupFormValidation();
        restrictAdminLevelOptions(); // Apply admin level restrictions
        setupAccessibilityFeatures();
        initializeSchoolEmailSearch(); // Initialize school email search
    }
    
    // Load users from API
    async function loadUsers() {
        try {
            showLoading();
            const response = await fetch(API_ENDPOINTS.USERS);
            const data = await response.json();
            
            if (data.success) {
                currentUsers = data.users;
                // Apply scope-based filtering
                currentUsers = filterUsersByScope(currentUsers);
                filteredUsers = [...currentUsers];
                renderUserTable();
                updatePagination();
            } else {
                showError('Failed to load users: ' + data.error);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            showError('Failed to load users. Please try again.');
        } finally {
            hideLoading();
        }
    }
    
    // Filter users based on current admin's scope and level restrictions
    function filterUsersByScope(users) {
        const currentAdminLevel = getCurrentAdminLevel();
        const currentAdminScope = getCurrentAdminScope();
        
        return users.filter(user => {
            // Admin level hierarchy restrictions
            if (!canManageUserLevel(currentAdminLevel, user.admin_level)) {
                return false;
            }
            
            // Geographic scope restrictions
            if (!isUserInScope(user, currentAdminLevel, currentAdminScope)) {
                return false;
            }
            
            return true;
        });
    }
    
    // Check if current admin can manage users of the given level
    function canManageUserLevel(currentLevel, targetLevel) {
        const levelHierarchy = {
            'school': 1,
            'district': 2, 
            'division': 3,
            'region': 4,
            'central': 5
        };
        
        const currentLevelNum = levelHierarchy[currentLevel] || 1;
        const targetLevelNum = levelHierarchy[targetLevel] || 1;
        
        // Admins can manage users at their level or below
        return currentLevelNum >= targetLevelNum;
    }
    
    // Check if user is within current admin's geographic scope
    function isUserInScope(user, currentLevel, currentScope) {
        // Central office can see all users
        if (currentLevel === 'central') {
            return true;
        }
        
        // For other levels, check if user's assignment overlaps with current admin's scope
        switch (currentLevel) {
            case 'region':
                return user.region_id === currentScope.region_id;
            case 'division':
                return user.region_id === currentScope.region_id && 
                       user.division_id === currentScope.division_id;
            case 'district':
                return user.region_id === currentScope.region_id && 
                       user.division_id === currentScope.division_id &&
                       user.district_id === currentScope.district_id;
            case 'school':
                return user.region_id === currentScope.region_id && 
                       user.division_id === currentScope.division_id &&
                       user.district_id === currentScope.district_id &&
                       user.school_id === currentScope.school_id;
            default:
                return true;
        }
    }
    
    // Get current admin's scope information
    function getCurrentAdminScope() {
        // This should be populated from the backend context
        // For now, we'll try to extract from the page or use a placeholder
        const scopeText = document.querySelector('.scope-text')?.textContent;
        
        // In a real implementation, this would come from the backend
        // For now, return a placeholder structure
        return {
            region_id: null,
            division_id: null,
            district_id: null,
            school_id: null,
            coverage: scopeText || 'Unknown'
        };
    }
    
    // Load geographic data for search inputs
    // Load geographic data for search functionality - simplified
    async function loadGeographicData() {
        try {
            console.log('Loading geographic data...');
            
            // Initialize simple search functionality
            initializeSimpleGeographicSearch();
        } catch (error) {
            console.error('Error loading geographic data:', error);
        }
    }
    
    // Fetch geographic data helper
    async function fetchGeographicData(type, parentId = null) {
        // Ensure type is plural for API consistency
        const apiType = type.endsWith('s') ? type : type + 's';
        const url = parentId 
            ? `/api/geographic-data/${apiType}/?parent_id=${parentId}`
            : `/api/geographic-data/${apiType}/`;
        
        console.log(`Fetching ${type} data from:`, url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log(`Received ${type} data:`, data);
        
        if (data.success && data.data) {
            console.log(`Successfully loaded ${data.data.length} ${type}`);
            return data.data;
        } else {
            console.warn(`Failed to load ${type}:`, data.error || 'Unknown error');
            return [];
        }
    }
    
    // Populate select dropdown
    function populateSelect(selectElement, items, valueField, textField) {
        // Clear existing options except the first one
        while (selectElement.children.length > 1) {
            selectElement.removeChild(selectElement.lastChild);
        }
        
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueField];
            option.textContent = item[textField];
            selectElement.appendChild(option);
        });
    }
    
    // Enhanced event listeners setup
    function setupEventListeners() {
        // Modal controls
        addUserBtn?.addEventListener('click', openAddUserModal);
        closeModal?.addEventListener('click', closeUserModal);
        cancelBtn?.addEventListener('click', closeUserModal);
        userForm?.addEventListener('submit', handleFormSubmit);
        
        // Password generation and visibility
        generatePasswordBtn?.addEventListener('click', generateSecurePassword);
        togglePasswordBtn?.addEventListener('click', togglePasswordVisibility);
        passwordInput?.addEventListener('input', updatePasswordStrength);
        
        // Multi-step form navigation
        nextBtn?.addEventListener('click', nextStep);
        prevBtn?.addEventListener('click', prevStep);
        
        // Geographic search functionality will be initialized separately
        
        // Admin level change
        adminLevelSelect?.addEventListener('change', handleAdminLevelChange);
        
        // Email validation on change
        emailInput?.addEventListener('blur', validateEmailFormat);
        
        // Filters
        roleFilter?.addEventListener('change', applyFilters);
        statusFilter?.addEventListener('change', applyFilters);
        areaFilter?.addEventListener('change', applyFilters);
        userSearch?.addEventListener('input', debounce(applyFilters, 300));
        resetFiltersBtn?.addEventListener('click', resetFilters);
        
        // Bulk actions
        selectAllCheckbox?.addEventListener('change', handleSelectAll);
        bulkActionSelect?.addEventListener('change', updateBulkActions);
        applyBulkActionBtn?.addEventListener('click', applyBulkAction);
        
        // Enhanced keyboard navigation
        setupKeyboardNavigation();
        
        // Close modal when clicking outside
        userModal?.addEventListener('click', (e) => {
            if (e.target === userModal) {
                closeUserModal();
            }
        });
        
        // Enhanced accessibility
        setupAccessibilityFeatures();
    }
    
    // Keyboard navigation setup
    function setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Only handle keyboard navigation when modal is open
            if (!userModal?.classList.contains('active')) return;
            
            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    closeUserModal();
                    break;
                    
                case 'ArrowRight':
                case 'ArrowDown':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        nextStep();
                    }
                    break;
                    
                case 'ArrowLeft':
                case 'ArrowUp':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        prevStep();
                    }
                    break;
                    
                case 'Enter':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (currentStep === maxSteps) {
                            handleFormSubmit(e);
                        } else {
                            nextStep();
                        }
                    }
                    break;
            }
        });
        
        // Tab navigation within modal
        userModal?.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                const focusableElements = userModal.querySelectorAll(
                    'input:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                
                if (e.shiftKey && document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                } else if (!e.shiftKey && document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        });
    }
    
    // Accessibility features setup
    function setupAccessibilityFeatures() {
        // Add ARIA labels and roles
        userModal?.setAttribute('role', 'dialog');
        userModal?.setAttribute('aria-labelledby', 'modalTitle');
        userModal?.setAttribute('aria-modal', 'true');
        
        // Form accessibility
        userForm?.setAttribute('aria-label', 'Admin User Creation Form');
        
        // Step navigation accessibility
        const progressSteps = document.querySelectorAll('.progress-step');
        progressSteps.forEach((step, index) => {
            step.setAttribute('role', 'tab');
            step.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
            step.setAttribute('tabindex', index === 0 ? '0' : '-1');
        });
        
        // Form sections accessibility
        const formSections = document.querySelectorAll('.form-section');
        formSections.forEach((section, index) => {
            section.setAttribute('role', 'tabpanel');
            section.setAttribute('aria-labelledby', `step${index + 1}`);
        });
        
        // Permission toggles accessibility
        const permissionToggles = document.querySelectorAll('.permission-toggle');
        permissionToggles.forEach(toggle => {
            const input = toggle.querySelector('input');
            const label = toggle.querySelector('label');
            if (input && label) {
                input.setAttribute('role', 'switch');
                input.setAttribute('aria-checked', input.checked.toString());
            }
        });
        
        // Add screen reader announcements
        setupScreenReaderAnnouncements();
    }
    
    // Screen reader announcements
    function setupScreenReaderAnnouncements() {
        // Create live region for announcements
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        liveRegion.style.position = 'absolute';
        liveRegion.style.left = '-10000px';
        liveRegion.style.width = '1px';
        liveRegion.style.height = '1px';
        liveRegion.style.overflow = 'hidden';
        document.body.appendChild(liveRegion);
        
        // Announce step changes
        const originalNextStep = nextStep;
        nextStep = function() {
            originalNextStep.call(this);
            announceStepChange();
        };
        
        const originalPrevStep = prevStep;
        prevStep = function() {
            originalPrevStep.call(this);
            announceStepChange();
        };
        
        function announceStepChange() {
            const stepNames = ['Basic Information', 'Geographic Assignment', 'Permissions'];
            const stepName = stepNames[currentStep - 1] || 'Unknown Step';
            liveRegion.textContent = `Now on step ${currentStep}: ${stepName}`;
            
            // Clear after announcement
            setTimeout(() => {
                liveRegion.textContent = '';
            }, 1000);
        }
        
        // Announce validation errors
        const originalShowValidationSummary = showValidationSummary;
        showValidationSummary = function() {
            originalShowValidationSummary.call(this);
            const errorCount = document.querySelectorAll('.error').length;
            liveRegion.textContent = `Please fix ${errorCount} validation error${errorCount !== 1 ? 's' : ''}`;
            
            setTimeout(() => {
                liveRegion.textContent = '';
            }, 2000);
        };
    }
    
    // Enhanced form validation setup
    function setupFormValidation() {
        // Username validation - lowercase and numbers only
        usernameInput?.addEventListener('input', (e) => {
            const originalValue = e.target.value;
            e.target.value = originalValue.toLowerCase().replace(/[^a-z0-9_]/g, '');
            
            // Real-time validation feedback
            validateUsername(e.target.value);
        });
        
        // Email validation
        emailInput?.addEventListener('input', validateEmailFormat);
        emailInput?.addEventListener('blur', validateEmailFormat);
        
        // Admin level change handler with enhanced feedback
        adminLevelSelect?.addEventListener('change', (e) => {
            updateAdminLevelDescription(e.target.value);
            setDefaultPermissions(e.target.value);
            updateGeographicRequirements(e.target.value);
            updateEmailHint(e.target.value);
        });
        
        // Password strength validation
        passwordInput?.addEventListener('input', (e) => {
            updatePasswordStrength(e.target.value);
            updatePasswordRequirements(e.target.value);
        });
        
        // Permission change handlers
        Object.keys(permissionCheckboxes).forEach(key => {
            const checkbox = permissionCheckboxes[key];
            if (checkbox) {
                checkbox.addEventListener('change', updatePermissionSummary);
            }
        });
        
        // Geographic selection handlers - removed old select elements
        // New search inputs are handled in initializeGeographicSearch()
    }
    
    // Real-time username validation
    function validateUsername(username) {
        const validationIcon = usernameInput?.parentNode.querySelector('.validation-success');
        const errorIcon = usernameInput?.parentNode.querySelector('.validation-error');
        
        if (!username || username.length < 3) {
            showValidationIcon(usernameInput, false);
            return false;
        }
        
        if (!/^[a-z0-9_]+$/.test(username)) {
            showValidationIcon(usernameInput, false);
            return false;
        }
        
        showValidationIcon(usernameInput, true);
        return true;
    }
    
    // Show validation icon
    function showValidationIcon(field, isValid) {
        const validationIcon = field?.parentNode.querySelector('.validation-success');
        const errorIcon = field?.parentNode.querySelector('.validation-error');
        
        if (validationIcon && errorIcon) {
            validationIcon.style.display = isValid ? 'block' : 'none';
            errorIcon.style.display = isValid ? 'none' : 'block';
        }
    }
    
    // Update admin level description
    function updateAdminLevelDescription(adminLevel) {
        const descriptionElement = document.getElementById('adminLevelDescription');
        if (!descriptionElement) return;
        
        const option = adminLevelSelect?.querySelector(`option[value="${adminLevel}"]`);
        if (option && option.dataset.description) {
            descriptionElement.innerHTML = `
                <i class="fas fa-lightbulb"></i>
                <span>${option.dataset.description}</span>
            `;
        } else {
            descriptionElement.innerHTML = `
                <i class="fas fa-lightbulb"></i>
                <span>Select an admin level to see description</span>
            `;
        }
    }
    
    // Enhanced password strength validation
    function updatePasswordStrength(password) {
        const strengthBar = document.querySelector('.strength-bar');
        const strengthText = document.querySelector('.strength-text');
        
        if (!password) {
            if (strengthBar) strengthBar.className = 'strength-bar';
            if (strengthText) strengthText.textContent = 'Password strength';
            return;
        }
        
        let score = 0;
        let feedback = '';
        
        // Length check
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        
        // Character variety checks
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
        
        // Determine strength level
        if (score <= 2) {
            strengthBar.className = 'strength-bar weak';
            feedback = 'Weak password';
        } else if (score <= 3) {
            strengthBar.className = 'strength-bar fair';
            feedback = 'Fair password';
        } else if (score <= 4) {
            strengthBar.className = 'strength-bar good';
            feedback = 'Good password';
        } else {
            strengthBar.className = 'strength-bar strong';
            feedback = 'Strong password';
        }
        
        if (strengthText) strengthText.textContent = feedback;
    }
    
    // Update password requirements checklist
    function updatePasswordRequirements(password) {
        const requirements = {
            length: password.length >= 8,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
        };
        
        Object.entries(requirements).forEach(([key, isValid]) => {
            const requirement = document.querySelector(`[data-requirement="${key}"]`);
            if (requirement) {
                const icon = requirement.querySelector('i');
                if (icon) {
                    icon.className = isValid ? 'fas fa-check' : 'fas fa-times';
                    requirement.classList.toggle('valid', isValid);
                }
            }
        });
    }
    
    // Enhanced permission summary update
    function updatePermissionSummary() {
        const selectedPermissions = [];
        const permissionNames = {
            canCreateUsers: 'Create Users',
            canManageUsers: 'Manage Users',
            canSetDeadlines: 'Set Deadlines',
            canApproveSubmissions: 'Approve Submissions',
            canViewSystemLogs: 'View System Logs'
        };
        
        Object.keys(permissionCheckboxes).forEach(key => {
            if (permissionCheckboxes[key]?.checked) {
                selectedPermissions.push(permissionNames[key]);
            }
        });
        
        const permissionsText = selectedPermissions.length > 0 
            ? selectedPermissions.join(', ') 
            : 'No permissions selected';
        
        const selectedPermissionsElement = document.getElementById('selectedPermissions');
        if (selectedPermissionsElement) {
            selectedPermissionsElement.textContent = permissionsText;
        }
        
        const adminLevel = adminLevelSelect?.value;
        const scopeText = adminLevel 
            ? `${adminLevel.charAt(0).toUpperCase() + adminLevel.slice(1)} level access`
            : 'No access level defined';
        
        const accessScopeElement = document.getElementById('accessScope');
        if (accessScopeElement) {
            accessScopeElement.textContent = scopeText;
        }
    }
    
    // Open add user modal
    function openAddUserModal() {
        isEditing = false;
        editingUserId = null;
        currentStep = 1;
        
        resetForm();
        restrictAdminLevelOptions(); // Apply admin level restrictions
        showModal();
        showStep(1);
        updateFormNavigation();
    }
    
    // Close user modal
    function closeUserModal() {
        userModal.classList.remove('active');
        resetForm();
    }
    
    // Show modal
    function showModal() {
        userModal.classList.add('active');
        fullNameInput.focus();
    }
    
    // Reset form
    function resetForm() {
        userForm.reset();
        clearSimpleGeographicInputs();
        resetPermissions();
        clearValidationErrors();
        
        // Reset editing state
        isEditing = false;
        editingUserId = null;
        
        // Show password field for new users
        const passwordGroup = passwordInput?.closest('.form-group');
        if (passwordGroup) {
            passwordGroup.style.display = 'block';
        }
        
        // Enable username input for new users
        if (usernameInput) {
            usernameInput.disabled = false;
        }
        
        // Reset modal title
        if (modalTitle) {
            modalTitle.innerHTML = '<i class="fas fa-user-plus"></i> Create New Admin User';
        }
    }
    
    // Handle form submission
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        // Build user data object manually for better control
        const emailPartInput = document.getElementById('emailPart');
        const hiddenEmailInput = document.getElementById('email');
        
        const userData = {
            full_name: fullNameInput.value.trim(),
            username: usernameInput.value.trim(),
            email: hiddenEmailInput.value.trim(), // Use the hidden email field with full email
            school_id: emailPartInput?.dataset.schoolId || null, // Include school ID if selected
            admin_level: adminLevelSelect.value,
            status: statusSelect.value || 'active',
            password: passwordInput.value
        };
        
        // Add geographic assignments
        if (regionInput._selectedValue) userData.region_id = parseInt(regionInput._selectedValue);
        if (divisionInput._selectedValue) userData.division_id = parseInt(divisionInput._selectedValue);
        if (districtInput._selectedValue) userData.district_id = parseInt(districtInput._selectedValue);
        
        // For school level admins, get school info from email field
        if (emailPartInput?.dataset.schoolId) {
            userData.school_id = parseInt(emailPartInput.dataset.schoolId);
        }
        
        // Build assigned area string
        const areaComponents = [];
        if (emailPartInput?.dataset.schoolName) {
            areaComponents.push(emailPartInput.dataset.schoolName);
        }
        if (districtInput._selectedText) {
            areaComponents.push(districtInput._selectedText);
        }
        if (divisionInput._selectedText) {
            areaComponents.push(divisionInput._selectedText);
        }
        if (regionInput._selectedText) {
            areaComponents.push(regionInput._selectedText);
        }
        userData.assigned_area = areaComponents.join(', ') || `${userData.admin_level} Level Admin`;
        
        // Add permissions as proper booleans
        userData.can_create_users = permissionCheckboxes.canCreateUsers?.checked || false;
        userData.can_manage_users = permissionCheckboxes.canManageUsers?.checked || false;
        userData.can_set_deadlines = permissionCheckboxes.canSetDeadlines?.checked || false;
        userData.can_approve_submissions = permissionCheckboxes.canApproveSubmissions?.checked || false;
        userData.can_view_system_logs = permissionCheckboxes.canViewSystemLogs?.checked || false;
        
        // Debug: Log the data being sent
        console.log('User data being sent:', userData);
        
        try {
            showLoading();
            
            let url, method;
            if (isEditing) {
                url = `${API_ENDPOINTS.EDIT_USER}${editingUserId}/`;
                method = 'PUT';
                // Don't send password for edits unless it's a new password
                if (!userData.password || userData.password.trim() === '') {
                    delete userData.password;
                }
            } else {
                url = API_ENDPOINTS.CREATE_USER;
                method = 'POST';
            }
            
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Add CSRF token
            const csrfToken = getCSRFToken();
            if (csrfToken) {
                headers['X-CSRFToken'] = csrfToken;
            }
            
            console.log('Request headers:', headers);
            console.log('Request URL:', url);
            console.log('Request method:', method);
            
            const response = await fetch(url, {
                method: method,
                headers: headers,
                body: JSON.stringify(userData)
            });
            
            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));
            
            let result;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                const text = await response.text();
                console.error('Non-JSON response:', text.substring(0, 500));
                throw new Error('Server returned HTML instead of JSON. Check server logs.');
            }
            
            if (result.success) {
                const action = isEditing ? 'updated' : 'created';
                const username = result.username || result.user?.username;
                showSuccess(`Admin user "${username}" ${action} successfully!`);
                closeUserModal();
                await loadUsers(); // Refresh the user list
            } else {
                const action = isEditing ? 'update' : 'create';
                showError(`Failed to ${action} user: ` + result.error);
            }
        } catch (error) {
            console.error(`Error ${isEditing ? 'updating' : 'creating'} user:`, error);
            const action = isEditing ? 'update' : 'create';
            showError(`Failed to ${action} user: ${error.message}`);
        } finally {
            hideLoading();
        }
    }
    
    // Validate form
    function validateForm() {
        clearValidationErrors();
        let isValid = true;
        
        // Required fields validation
        const requiredFields = {
            fullName: 'Full name is required',
            username: 'Username is required', 
            email: 'Email is required',
            adminLevel: 'Admin level is required'
        };
        
        // Only require password for new users
        if (!isEditing) {
            requiredFields.password = 'Password is required';
        }
        
        Object.keys(requiredFields).forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (!field || !field.value.trim()) {
                showFieldError(field, requiredFields[fieldId]);
                isValid = false;
            }
        });
        
        // Username validation
        if (usernameInput.value) {
            const username = usernameInput.value.trim();
            if (!/^[a-z0-9_]+$/.test(username)) {
                showFieldError(usernameInput, 'Username can only contain lowercase letters, numbers, and underscores');
                isValid = false;
            }
            if (username.length < 3) {
                showFieldError(usernameInput, 'Username must be at least 3 characters long');
                isValid = false;
            }
        }
        
        // Email format validation
        if (emailInput.value && adminLevelSelect.value) {
            if (!validateSchoolEmailSearch()) {
                isValid = false;
            }
        }
        
        // Password strength validation (only for new users or if password is provided)
        if (passwordInput.value && (!isEditing || passwordInput.value.trim() !== '')) {
            if (!validatePasswordStrength(passwordInput.value)) {
                showFieldError(passwordInput, 'Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters');
                isValid = false;
            }
        }
        
        // Geographic assignment validation
        if (!validateGeographicAssignment()) {
            isValid = false;
        }
        
        // Permission validation
        if (!validatePermissions()) {
            isValid = false;
        }
        
        // Admin level hierarchy validation
        if (!validateAdminLevelHierarchy()) {
            isValid = false;
        }
        
        return isValid;
    }
    
    // Validate permissions
    function validatePermissions() {
        // No specific permission validation needed for now
        // Could add logic to ensure certain admin levels have certain permissions
        return true;
    }
    
    // Validate admin level hierarchy - ensure current admin can create/edit the selected level
    function validateAdminLevelHierarchy() {
        const currentAdminLevel = getCurrentAdminLevel();
        const selectedAdminLevel = adminLevelSelect.value;
        
        if (!selectedAdminLevel) {
            return true; // Let required field validation handle this
        }
        
        if (!canManageUserLevel(currentAdminLevel, selectedAdminLevel)) {
            const levelNames = {
                'central': 'Central Office',
                'region': 'Region',
                'division': 'Division',
                'district': 'District',
                'school': 'School'
            };
            
            const currentLevelName = levelNames[currentAdminLevel] || currentAdminLevel;
            const selectedLevelName = levelNames[selectedAdminLevel] || selectedAdminLevel;
            
            showFieldError(adminLevelSelect, 
                `${currentLevelName} admins cannot create ${selectedLevelName} level accounts. You can only create accounts at your level or below.`);
            return false;
        }
        
        return true;
    }
    
    // Validate school email search
    function validateSchoolEmailSearch() {
        const adminLevel = adminLevelSelect.value;
        const emailPartInput = document.getElementById('emailPart');
        const hiddenEmailInput = document.getElementById('email');
        const emailSplitWrapper = document.querySelector('.email-split-wrapper');
        
        if (!emailPartInput) return true;
        
        const emailPartValue = emailPartInput.value.trim();
        
        if (adminLevel === 'school') {
            // For school level, check if school is verified
            if (!emailPartInput.dataset.schoolId) {
                showFieldError(emailPartInput, 'Please search and select a valid school to generate the DepEd email');
                emailSplitWrapper.classList.add('error');
                return false;
            }
            emailSplitWrapper.classList.remove('error');
            emailSplitWrapper.classList.add('success');
            return true;
        } else {
            // For non-school levels, validate firstname.lastname format
            if (!/^[A-Za-z]+\.[A-Za-z]+$/.test(emailPartValue)) {
                showFieldError(emailPartInput, 'Email must follow format: firstname.lastname (e.g., juan.delacruz)');
                emailSplitWrapper.classList.add('error');
                return false;
            }
            emailSplitWrapper.classList.remove('error');
            emailSplitWrapper.classList.add('success');
            return true;
        }
    }
    
    // Validate email format based on admin level (legacy - keeping for compatibility)
    function validateEmailFormatByLevel() {
        const adminLevel = adminLevelSelect.value;
        const email = emailInput.value.trim();
        
        if (adminLevel === 'school') {
            // School users: schoolid@deped.gov.ph
            return /^[A-Za-z0-9]+@deped\.gov\.ph$/.test(email);
        } else {
            // Non-school users: firstname.lastname@deped.gov.ph
            return /^[A-Za-z]+\.[A-Za-z]+@deped\.gov\.ph$/.test(email);
        }
    }
    
    // Validate email format on blur
    function validateEmailFormat() {
        if (emailInput.value && adminLevelSelect.value) {
            if (!validateEmailFormatByLevel()) {
                const adminLevel = adminLevelSelect.value;
                const format = adminLevel === 'school' 
                    ? 'schoolid@deped.gov.ph' 
                    : 'firstname.lastname@deped.gov.ph';
                showFieldError(emailInput, `Email must follow format: ${format}`);
            } else {
                clearFieldError(emailInput);
            }
        }
    }
    
    // Validate password strength
    function validatePasswordStrength(password) {
        const minLength = 8;
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
        
        return password.length >= minLength && hasLetter && hasNumber && hasSpecial;
    }
    
    // Validate geographic assignment
    function validateGeographicAssignment() {
        const adminLevel = adminLevelSelect.value;
        let isValid = true;
        
        switch (adminLevel) {
            case 'region':
                if (!regionInput._selectedValue) {
                    showFieldError(regionInput, 'Region is required for Region level admin');
                    isValid = false;
                }
                break;
            case 'division':
                if (!regionInput._selectedValue || !divisionInput._selectedValue) {
                    showFieldError(divisionInput, 'Region and Division are required for Division level admin');
                    isValid = false;
                }
                break;
            case 'district':
                if (!regionInput._selectedValue || !divisionInput._selectedValue || !districtInput._selectedValue) {
                    showFieldError(districtInput, 'Region, Division, and District are required for District level admin');
                    isValid = false;
                }
                break;
            case 'school':
                // School: only validate school ID through email field (no geographic assignment needed)
                const emailPartInput = document.getElementById('emailPart');
                if (!emailPartInput?.dataset.schoolId) {
                    showFieldError(emailPartInput, 'Please search and select a valid school in the DepEd email field');
                    isValid = false;
                }
                break;
        }
        
        return isValid;
    }
    
    // Handle admin level change
    function handleAdminLevelChange() {
        const adminLevel = adminLevelSelect.value;
        updateEmailHint(adminLevel);
        setDefaultPermissions(adminLevel);
        updateGeographicRequirements(adminLevel);
        updateAssignmentPreview();
        
        // New functionality: Handle email input mode and assignment/permission restrictions
        handleEmailInputMode(adminLevel);
        handleAssignmentPermissionRestrictions(adminLevel);
    }
    
    // Get current admin's level from the page context
    function getCurrentAdminLevel() {
        const scopeBadge = document.querySelector('.scope-badge');
        if (scopeBadge) {
            return scopeBadge.textContent.toLowerCase();
        }
        return 'central'; // Default fallback
    }
    
    // Restrict admin level options based on current user's level
    function restrictAdminLevelOptions() {
        const currentAdminLevel = getCurrentAdminLevel();
        const adminLevelOptions = adminLevelSelect.querySelectorAll('option');
        
        // Admin level hierarchy (higher number = higher level)
        const levelHierarchy = {
            'school': 1,
            'district': 2, 
            'division': 3,
            'region': 4,
            'central': 5
        };
        
        const currentLevel = levelHierarchy[currentAdminLevel] || 5;
        
        adminLevelOptions.forEach(option => {
            const optionLevel = levelHierarchy[option.value] || 0;
            
            // Disable options that are higher than current admin's level
            if (optionLevel > currentLevel) {
                option.disabled = true;
                option.style.display = 'none';
            } else {
                option.disabled = false;
                option.style.display = 'block';
            }
            
            // Special restrictions based on current admin level
            switch (currentAdminLevel) {
                case 'division':
                    // Division cannot create central office accounts
                    if (option.value === 'central') {
                        option.disabled = true;
                        option.style.display = 'none';
                    }
                    break;
            }
        });
    }
    
    // Update email format hint
    function updateEmailHint(adminLevel) {
        const emailHintText = document.getElementById('emailHintText');
        const emailPartInput = document.getElementById('emailPart');
        
        if (emailHintText) {
            const hintText = adminLevel === 'school' 
                ? 'Enter School ID to search and verify the school'
                : 'Enter your first name and last name separated by a dot (e.g., juan.delacruz)';
            emailHintText.textContent = hintText;
        }
        
        // Update input type based on admin level
        if (emailPartInput) {
            emailPartInput.type = adminLevel === 'school' ? 'number' : 'text';
        }
        
        // Update email mode based on admin level
        if (window.setEmailSchoolMode) {
            window.setEmailSchoolMode(adminLevel === 'school');
        }
    }
    
    // Handle email input mode based on admin level
    function handleEmailInputMode(adminLevel) {
        const emailPartInput = document.getElementById('emailPart');
        const emailIcon = document.getElementById('emailIcon');
        const searchResults = document.querySelector('.search-results');
        
        if (!emailPartInput) return;
        
        // Clear current input and reset state
        emailPartInput.value = '';
        emailPartInput.removeAttribute('data-school-id');
        emailPartInput.removeAttribute('data-school-name');
        if (searchResults) {
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
        }
        
        if (adminLevel === 'school') {
            // School mode: Enable search dropdown functionality
            emailPartInput.type = 'number';
            emailPartInput.placeholder = 'Enter School ID to search...';
            emailPartInput.setAttribute('data-search-mode', 'school');
            if (emailIcon) emailIcon.className = 'fas fa-school';
            
            // Enable school search functionality
            enableSchoolSearchMode(emailPartInput);
        } else {
            // Non-school mode: Regular email input
            emailPartInput.type = 'text';
            emailPartInput.placeholder = 'firstname.lastname';
            emailPartInput.setAttribute('data-search-mode', 'regular');
            if (emailIcon) emailIcon.className = 'fas fa-user';
            
            // Disable school search functionality
            disableSchoolSearchMode(emailPartInput);
        }
    }
    
    // Handle assignment and permission restrictions based on admin level
    function handleAssignmentPermissionRestrictions(adminLevel) {
        const assignmentSection = document.getElementById('step2');
        const permissionSection = document.getElementById('step3');
        const geographicSection = document.getElementById('geographicSection');
        const permissionCheckboxes = document.querySelectorAll('#step3 input[type="checkbox"]');
        
        if (adminLevel === 'school') {
            // Disable assignment section for school level
            if (geographicSection) {
                geographicSection.style.opacity = '0.5';
                geographicSection.style.pointerEvents = 'none';
                
                // Add disabled message
                let disabledMsg = geographicSection.querySelector('.school-assignment-disabled');
                if (!disabledMsg) {
                    disabledMsg = document.createElement('div');
                    disabledMsg.className = 'school-assignment-disabled';
                    disabledMsg.innerHTML = `
                        <div class="disabled-overlay">
                            <i class="fas fa-info-circle"></i>
                            <p>School administrators are automatically assigned to their school through the School ID verification in the email field.</p>
                        </div>
                    `;
                    geographicSection.appendChild(disabledMsg);
                }
            }
            
            // Disable all permission checkboxes for school level
            permissionCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
                checkbox.disabled = true;
            });
            
            // Add disabled message for permissions
            if (permissionSection) {
                let permDisabledMsg = permissionSection.querySelector('.school-permissions-disabled');
                if (!permDisabledMsg) {
                    permDisabledMsg = document.createElement('div');
                    permDisabledMsg.className = 'school-permissions-disabled';
                    permDisabledMsg.innerHTML = `
                        <div class="disabled-overlay">
                            <i class="fas fa-info-circle"></i>
                            <p>School administrators have predefined permissions and cannot be customized.</p>
                        </div>
                    `;
                    
                    const permissionContainer = permissionSection.querySelector('.permission-categories');
                    if (permissionContainer) {
                        permissionContainer.style.opacity = '0.5';
                        permissionContainer.style.pointerEvents = 'none';
                        permissionSection.insertBefore(permDisabledMsg, permissionContainer);
                    }
                }
            }
        } else {
            // Enable assignment and permission sections for non-school levels
            if (geographicSection) {
                geographicSection.style.opacity = '1';
                geographicSection.style.pointerEvents = 'auto';
                
                // Remove disabled message
                const disabledMsg = geographicSection.querySelector('.school-assignment-disabled');
                if (disabledMsg) {
                    disabledMsg.remove();
                }
            }
            
            // Enable permission checkboxes (will be set by setDefaultPermissions)
            permissionCheckboxes.forEach(checkbox => {
                checkbox.disabled = false;
            });
            
            // Remove disabled message for permissions
            if (permissionSection) {
                const permDisabledMsg = permissionSection.querySelector('.school-permissions-disabled');
                if (permDisabledMsg) {
                    permDisabledMsg.remove();
                }
                
                const permissionContainer = permissionSection.querySelector('.permission-categories');
                if (permissionContainer) {
                    permissionContainer.style.opacity = '1';
                    permissionContainer.style.pointerEvents = 'auto';
                }
            }
            
            // Update geographic requirements based on hierarchy
            updateGeographicHierarchy(adminLevel);
        }
    }
    
    // Set default permissions based on admin level with proper restrictions
    function setDefaultPermissions(adminLevel = null) {
        if (!adminLevel) adminLevel = adminLevelSelect.value;
        
        // Reset all permissions and enable/disable based on level
        Object.values(permissionCheckboxes).forEach(checkbox => {
            checkbox.checked = false;
            checkbox.disabled = false; // Reset disabled state
        });
        
        // Set default permissions and restrictions based on level
        switch (adminLevel) {
            case 'central':
                // Central office has all permissions enabled
                Object.values(permissionCheckboxes).forEach(checkbox => {
                    checkbox.checked = true;
                    checkbox.disabled = false;
                });
                break;
            case 'region':
                // Region: only set deadlines, view system logs, and approve submissions enabled
                permissionCheckboxes.canSetDeadlines.checked = true;
                permissionCheckboxes.canViewSystemLogs.checked = true;
                permissionCheckboxes.canApproveSubmissions.checked = true;
                
                // Disable other permissions
                permissionCheckboxes.canCreateUsers.disabled = true;
                permissionCheckboxes.canManageUsers.disabled = true;
                break;
            case 'division':
                // Division: all except set deadlines
                permissionCheckboxes.canCreateUsers.checked = true;
                permissionCheckboxes.canManageUsers.checked = true;
                permissionCheckboxes.canApproveSubmissions.checked = true;
                permissionCheckboxes.canViewSystemLogs.checked = true;
                
                // Disable set deadlines
                permissionCheckboxes.canSetDeadlines.disabled = true;
                break;
            case 'district':
                // District: only approve submissions enabled
                permissionCheckboxes.canApproveSubmissions.checked = true;
                
                // Disable all other permissions
                permissionCheckboxes.canCreateUsers.disabled = true;
                permissionCheckboxes.canManageUsers.disabled = true;
                permissionCheckboxes.canSetDeadlines.disabled = true;
                permissionCheckboxes.canViewSystemLogs.disabled = true;
                break;
            case 'school':
                // School: all permissions disabled
                Object.values(permissionCheckboxes).forEach(checkbox => {
                    checkbox.checked = false;
                    checkbox.disabled = true;
                });
                break;
        }
        
        // Update permission summary after setting defaults
        updatePermissionSummary();
    }
    
    // Update geographic requirements visibility and restrictions
    function updateGeographicRequirements(adminLevel) {
        const geographicSection = document.getElementById('geographicSection');
        const assignmentInfo = document.getElementById('assignmentInfo');
        const requirementText = document.getElementById('requirementText');
        
        // Update assignment info based on admin level
        updateAssignmentInfo(adminLevel);
        
        // Handle geographic fields visibility and requirements
        const hierarchyItems = geographicSection.querySelectorAll('.hierarchy-item');
        
        hierarchyItems.forEach((item, index) => {
            const label = item.querySelector('label');
            const input = item.querySelector('input');
            const requiredSpan = item.querySelector('.required');
            
            // Remove existing required indicators
            if (requiredSpan) requiredSpan.style.display = 'none';
            
            // Reset input states
            if (input) {
                input.disabled = false;
                input.value = '';
                if (input._selectedValue) input._selectedValue = null;
                if (input._selectedText) input._selectedText = '';
            }
            
            switch (adminLevel) {
                case 'central':
                    // Central office: disable entire assignment section
                    item.style.display = 'none';
                    if (input) input.disabled = true;
                    break;
                case 'region':
                    // Region: only region field enabled and required
                    if (index === 0) { // Region
                        item.style.display = 'block';
                        if (requiredSpan) requiredSpan.style.display = 'inline';
                        if (input) input.disabled = false;
                    } else {
                        item.style.display = 'none';
                        if (input) input.disabled = true;
                    }
                    break;
                case 'division':
                    // Division: region and division enabled and required
                    if (index <= 1) { // Region and Division
                        item.style.display = 'block';
                        if (requiredSpan) requiredSpan.style.display = 'inline';
                        if (input) input.disabled = false;
                    } else {
                        item.style.display = 'none';
                        if (input) input.disabled = true;
                    }
                    break;
                case 'district':
                    // District: region, division, and district enabled and required
                    if (index <= 2) { // Region, Division, and District
                        item.style.display = 'block';
                        if (requiredSpan) requiredSpan.style.display = 'inline';
                        if (input) input.disabled = false;
                    } else {
                        item.style.display = 'none';
                        if (input) input.disabled = true;
                    }
                    break;
                case 'school':
                    // School: hide entire assignment section (same as central office)
                    item.style.display = 'none';
                    if (input) input.disabled = true;
                    break;
                default:
                    item.style.display = 'block';
                    if (input) input.disabled = false;
            }
        });
        
        // Update assignment preview
        updateAssignmentPreview();
    }
    
    // Update assignment info based on admin level
    function updateAssignmentInfo(adminLevel) {
        const requirementText = document.getElementById('requirementText');
        if (!requirementText) return;
        
        const requirements = {
            'central': 'Central Office admins have nationwide access and do not require geographic assignment.',
            'region': 'Region admins must be assigned to a specific region. They can only access data within their assigned region.',
            'division': 'Division admins must be assigned to a specific region and division. They can only access data within their assigned division.',
            'district': 'District admins must be assigned to a specific region, division, and district. They can only access data within their assigned district.',
            'school': 'School admins do not require geographic assignment. Their school assignment is handled automatically through School ID verification in the email field.'
        };
        
        requirementText.textContent = requirements[adminLevel] || 'Select an admin level to see assignment requirements.';
    }
    
    // Initialize school email search functionality
    function initializeSchoolEmailSearch() {
        const emailPartInput = document.getElementById('emailPart');
        const hiddenEmailInput = document.getElementById('email');
        if (!emailPartInput) return;
        
        const wrapper = emailPartInput.closest('.search-input-wrapper');
        const resultsContainer = wrapper.querySelector('.search-results');
        const clearBtn = wrapper.querySelector('.search-clear-btn');
        const verificationDiv = document.getElementById('schoolVerification');
        const emailSplitWrapper = document.querySelector('.email-split-wrapper');
        
        let searchTimeout;
        let selectedSchool = null;
        let isSchoolMode = false;
        
        // Store original placeholder
        emailPartInput.setAttribute('data-original-placeholder', emailPartInput.placeholder);
        
        // Input event handler
        emailPartInput.addEventListener('input', function(e) {
            const query = e.target.value.trim();
            
            // Update hidden email field
            updateHiddenEmailField(query);
            
            // Clear previous timeout
            clearTimeout(searchTimeout);
            
            // Show/hide clear button
            clearBtn.style.display = query.length > 0 ? 'block' : 'none';
            
            // Hide verification if input changes
            if (verificationDiv) {
                verificationDiv.style.display = 'none';
            }
            
            // Reset selected school
            selectedSchool = null;
            
            // Remove validation states
            emailSplitWrapper.classList.remove('error', 'success');
            
            // Check if we should search schools
            const currentAdminLevel = adminLevelSelect ? adminLevelSelect.value : '';
            const shouldSearchSchools = isSchoolMode || currentAdminLevel === 'school';
            
            if (query.length < 2 || !shouldSearchSchools) {
                hideSearchResults();
                return;
            }
            
            // Debounce search for school mode
            searchTimeout = setTimeout(() => {
                searchSchools(query);
            }, 300);
        });
        
        // Clear button functionality
        clearBtn.addEventListener('click', function() {
            emailPartInput.value = '';
            selectedSchool = null;
            clearBtn.style.display = 'none';
            hideSearchResults();
            updateHiddenEmailField('');
            if (verificationDiv) {
                verificationDiv.style.display = 'none';
            }
            emailSplitWrapper.classList.remove('error', 'success');
            emailPartInput.focus();
        });
        
        // Click outside to hide results
        document.addEventListener('click', function(e) {
            if (!wrapper.contains(e.target)) {
                hideSearchResults();
            }
        });
        
        // Update hidden email field
        function updateHiddenEmailField(value) {
            const fullEmail = value ? `${value}@deped.gov.ph` : '';
            hiddenEmailInput.value = fullEmail;
        }
        
        // Set school mode
        function setSchoolMode(enabled) {
            isSchoolMode = enabled;
            const emailIcon = document.getElementById('emailIcon');
            
            console.log('Setting school mode:', enabled); // Debug log
            
            if (enabled) {
                emailPartInput.placeholder = 'Enter School ID to search...';
                if (emailIcon) emailIcon.className = 'fas fa-school';
            } else {
                emailPartInput.placeholder = emailPartInput.getAttribute('data-original-placeholder') || 'firstname.lastname';
                if (emailIcon) emailIcon.className = 'fas fa-user';
            }
        }
        
        // Expose setSchoolMode for external use
        window.setEmailSchoolMode = setSchoolMode;
        
        // Expose functions for external use
        window.enableSchoolSearchMode = enableSchoolSearchMode;
        window.disableSchoolSearchMode = disableSchoolSearchMode;
        
        function hideSearchResults() {
            if (resultsContainer) {
                resultsContainer.classList.remove('show');
                resultsContainer.style.display = 'none';
                resultsContainer.innerHTML = '';
            }
        }
        
        function showSearchResults() {
            if (resultsContainer) {
                resultsContainer.classList.add('show');
                resultsContainer.style.display = 'block'; // Override any inline display: none
                console.log('Showing search results container', resultsContainer); // Debug log
                console.log('Results container classes:', resultsContainer.className); // Debug log
                console.log('Results container HTML:', resultsContainer.innerHTML); // Debug log
            } else {
                console.error('Results container not found'); // Debug log
            }
        }
        
        // Search schools function
        async function searchSchools(query) {
            console.log('Searching schools for query:', query); // Debug log
            try {
                // Show loading state
                resultsContainer.innerHTML = '<div class="search-loading"><i class="fas fa-spinner fa-spin"></i> Searching schools...</div>';
                showSearchResults();
                
                // API call to search schools
                const response = await fetch(`/api/schools/search/?q=${encodeURIComponent(query)}`);
                const data = await response.json();
                
                console.log('School search response:', data); // Debug log
                
                if (data.success && data.schools && data.schools.length > 0) {
                    console.log(`Found ${data.schools.length} schools`); // Debug log
                    displaySearchResults(data.schools);
                } else {
                    console.log('No schools found or API error:', data.error || 'No results'); // Debug log
                    displayNoResults(query);
                }
            } catch (error) {
                console.error('Error searching schools:', error);
                displayErrorResults();
            }
        }
        
        // Display search results
        function displaySearchResults(schools) {
            console.log('Displaying search results for', schools.length, 'schools'); // Debug log
            const resultsHTML = schools.map(school => `
                <div class="search-result-item" data-school-id="${school.id}" data-school-code="${school.school_id}">
                    <div class="result-icon">
                        <i class="fas fa-school"></i>
                    </div>
                    <div class="result-content">
                        <div class="result-title">${school.name}</div>
                        <div class="result-subtitle">ID: ${school.school_id}</div>
                        <div class="result-location">${school.address || school.district + ', ' + school.division + ', ' + school.region}</div>
                    </div>
                    <div class="result-action">
                        <i class="fas fa-check"></i>
                    </div>
                </div>
            `).join('');
            
            resultsContainer.innerHTML = resultsHTML;
            showSearchResults();
            
            // Add click handlers
            resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', function() {
                    selectSchool({
                        id: this.dataset.schoolId,
                        school_id: this.dataset.schoolCode,
                        name: this.querySelector('.result-title').textContent,
                        location: this.querySelector('.result-location').textContent
                    });
                });
            });
        }
        
        // Display no results
        function displayNoResults(query) {
            resultsContainer.innerHTML = `
                <div class="search-no-results">
                    <div class="no-results-icon">
                        <i class="fas fa-search"></i>
                    </div>
                    <div class="no-results-text">
                        <strong>No schools found</strong>
                        <p>No schools match "${query}". Please check the School ID and try again.</p>
                    </div>
                </div>
            `;
            showSearchResults();
        }
        
        // Display error results
        function displayErrorResults() {
            resultsContainer.innerHTML = `
                <div class="search-error-results">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="error-text">
                        <strong>Search Error</strong>
                        <p>Unable to search schools. Please try again.</p>
                    </div>
                </div>
            `;
            showSearchResults();
        }
        
        // Select school and generate email
        function selectSchool(school) {
            selectedSchool = school;
            
            // Update input with school ID
            emailPartInput.value = school.school_id;
            
            // Generate DepEd email
            const generatedEmail = `${school.school_id}@deped.gov.ph`;
            updateHiddenEmailField(school.school_id);
            
            // Show verification card
            if (verificationDiv) {
                document.getElementById('verifiedSchoolName').textContent = school.name;
                document.getElementById('verifiedSchoolEmail').textContent = generatedEmail;
                document.getElementById('verifiedSchoolLocation').textContent = school.location;
                verificationDiv.style.display = 'block';
            }
            
            // Store the school data for form submission
            emailPartInput.dataset.schoolId = school.id;
            emailPartInput.dataset.schoolName = school.name;
            
            // Hide search results
            hideSearchResults();
            
            // Show success validation
            emailSplitWrapper.classList.add('success');
            showValidationIcon(emailPartInput, true);
            
            // Update email hint
            const emailHintText = document.getElementById('emailHintText');
            if (emailHintText) {
                emailHintText.textContent = `School verified! Email: ${generatedEmail}`;
            }
        }
    }
    
    // Enable school search mode
    function enableSchoolSearchMode(emailPartInput) {
        if (!emailPartInput) {
            console.error('emailPartInput not found in enableSchoolSearchMode'); // Debug log
            return;
        }
        
        console.log('Enabling school search mode for:', emailPartInput); // Debug log
        
        // Add school search event listeners
        let searchTimeout;
        
        const handleSchoolSearch = function(e) {
            const query = e.target.value.trim();
            
            clearTimeout(searchTimeout);
            
            if (query.length < 2) {
                hideSchoolSearchResults();
                return;
            }
            
            // Debounce search
            searchTimeout = setTimeout(() => {
                performSchoolSearch(query);
            }, 300);
        };
        
        // Store the handler for later removal
        emailPartInput._schoolSearchHandler = handleSchoolSearch;
        emailPartInput.addEventListener('input', handleSchoolSearch);
        
        // Add validation for school ID format
        emailPartInput.addEventListener('blur', function() {
            validateSchoolEmail(this.value);
        });
        
        // Local school search function that has access to the proper containers
        async function performSchoolSearch(query) {
            console.log('performSchoolSearch called with:', query); // Debug log
            
            // Get the results container from the wrapper
            const wrapper = emailPartInput.closest('.search-input-wrapper');
            const localResultsContainer = wrapper ? wrapper.querySelector('.search-results') : null;
            
            if (!localResultsContainer) {
                console.error('Results container not found in performSchoolSearch'); // Debug log
                return;
            }
            
            try {
                // Show loading state
                localResultsContainer.innerHTML = '<div class="search-loading"><i class="fas fa-spinner fa-spin"></i> Searching schools...</div>';
                localResultsContainer.classList.add('show');
                localResultsContainer.style.display = 'block'; // Force display
                
                // Add active class to wrapper for styling
                const searchWrapper = localResultsContainer.closest('.search-input-wrapper');
                if (searchWrapper) {
                    searchWrapper.classList.add('active');
                }
                
                
                // API call to search schools
                const response = await fetch(`/api/schools/search/?q=${encodeURIComponent(query)}`);
                const data = await response.json();
                
                console.log('School search response:', data); // Debug log
                
                if (data.success && data.schools && data.schools.length > 0) {
                    console.log(`Found ${data.schools.length} schools`); // Debug log
                    
                    // Create the results HTML directly
                    const resultsHTML = data.schools.map(school => `
                        <div class="search-result-item" data-school-id="${school.id}" data-school-code="${school.school_id}">
                            <div class="result-icon">
                                <i class="fas fa-school"></i>
                            </div>
                            <div class="result-content">
                                <div class="result-title">${school.name}</div>
                                <div class="result-subtitle">School ID: ${school.school_id}</div>
                                <div class="result-location">${school.address || (school.district + ', ' + school.division + ', ' + school.region)}</div>
                            </div>
                            <div class="result-action">
                                <i class="fas fa-check"></i>
                            </div>
                        </div>
                    `).join('');
                    
                    localResultsContainer.innerHTML = resultsHTML;
                    localResultsContainer.classList.add('show');
                    localResultsContainer.style.display = 'block';
                    
                    // Also add active class to wrapper for styling
                    const searchWrapper = localResultsContainer.closest('.search-input-wrapper');
                    if (searchWrapper) {
                        searchWrapper.classList.add('active');
                    }
                    
                    // Add click handlers
                    localResultsContainer.querySelectorAll('.search-result-item').forEach(item => {
                        item.addEventListener('click', function() {
                            const school = {
                                id: this.dataset.schoolId,
                                school_id: this.dataset.schoolCode,
                                name: this.querySelector('.result-title').textContent,
                                location: this.querySelector('.result-location').textContent
                            };
                            selectSchoolFromSearch(school);
                        });
                    });
                } else {
                    console.log('No schools found or API error:', data.error || 'No results'); // Debug log
                    localResultsContainer.innerHTML = `
                        <div class="search-no-results">
                            <div class="no-results-icon">
                                <i class="fas fa-search"></i>
                            </div>
                            <div class="no-results-text">
                                <strong>No school found with that School ID</strong>
                                <p>No schools match "${query}". Please check the School ID and try again.</p>
                            </div>
                        </div>
                    `;
                    localResultsContainer.classList.add('show');
                    localResultsContainer.style.display = 'block';
                }
            } catch (error) {
                console.error('Error searching schools:', error);
                localResultsContainer.innerHTML = `
                    <div class="search-error-results">
                        <div class="error-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="error-text">
                            <strong>Search Error</strong>
                            <p>Unable to search schools. Please try again.</p>
                        </div>
                    </div>
                `;
                localResultsContainer.classList.add('show');
                localResultsContainer.style.display = 'block';
            }
        }
    }
    
    // Disable school search mode
    function disableSchoolSearchMode(emailPartInput) {
        if (!emailPartInput) return;
        
        // Remove school search event listeners
        if (emailPartInput._schoolSearchHandler) {
            emailPartInput.removeEventListener('input', emailPartInput._schoolSearchHandler);
            emailPartInput._schoolSearchHandler = null;
        }
        
        // Add regular email validation
        emailPartInput.addEventListener('blur', function() {
            validateRegularEmail(this.value);
        });
        
        // Hide any search results
        hideSchoolSearchResults();
    }
    
    // Validate school email format (school ID)
    function validateSchoolEmail(value) {
        const emailPartInput = document.getElementById('emailPart');
        const emailSplitWrapper = document.querySelector('.email-split-wrapper');
        
        if (!value) {
            showFieldError(emailPartInput, 'School ID is required');
            return false;
        }
        
        // Check if school ID is numeric and valid length
        if (!/^\d{6}$/.test(value)) {
            showFieldError(emailPartInput, 'School ID must be exactly 6 digits (e.g., 100001)');
            return false;
        }
        
        // Check if school was selected from search
        if (!emailPartInput.dataset.schoolId) {
            showFieldError(emailPartInput, 'Please search and select a valid school from the dropdown');
            return false;
        }
        
        // Valid school selected
        clearFieldError(emailPartInput);
        emailSplitWrapper.classList.add('success');
        return true;
    }
    
    // Validate regular email format (firstname.lastname)
    function validateRegularEmail(value) {
        const emailPartInput = document.getElementById('emailPart');
        const emailSplitWrapper = document.querySelector('.email-split-wrapper');
        
        if (!value) {
            showFieldError(emailPartInput, 'Email is required');
            return false;
        }
        
        // Check firstname.lastname format
        if (!/^[a-zA-Z]+\.[a-zA-Z]+$/.test(value)) {
            showFieldError(emailPartInput, 'Email must be in format: firstname.lastname');
            return false;
        }
        
        // Valid format
        clearFieldError(emailPartInput);
        emailSplitWrapper.classList.add('success');
        return true;
    }
    
    // Update geographic hierarchy based on admin level
    function updateGeographicHierarchy(adminLevel) {
        const regionInput = document.getElementById('region');
        const divisionInput = document.getElementById('division');
        const districtInput = document.getElementById('district');
        
        // Reset all inputs
        [regionInput, divisionInput, districtInput].forEach(input => {
            if (input) {
                input.disabled = false;
                input.required = false;
                input.closest('.hierarchy-item').style.display = 'block';
                
                // Remove required indicators
                const requiredSpan = input.closest('.form-group')?.querySelector('.required');
                if (requiredSpan) requiredSpan.style.display = 'none';
            }
        });
        
        // Set requirements based on admin level hierarchy
        switch (adminLevel) {
            case 'region':
                // Region admin: only region required
                if (regionInput) {
                    regionInput.required = true;
                    const regionRequired = regionInput.closest('.form-group')?.querySelector('.required');
                    if (regionRequired) regionRequired.style.display = 'inline';
                }
                // Hide division and district for region admin
                if (divisionInput) divisionInput.closest('.hierarchy-item').style.display = 'none';
                if (districtInput) districtInput.closest('.hierarchy-item').style.display = 'none';
                break;
                
            case 'division':
                // Division admin: region and division required
                if (regionInput) {
                    regionInput.required = true;
                    const regionRequired = regionInput.closest('.form-group')?.querySelector('.required');
                    if (regionRequired) regionRequired.style.display = 'inline';
                }
                if (divisionInput) {
                    divisionInput.required = true;
                    const divisionRequired = divisionInput.closest('.form-group')?.querySelector('.required');
                    if (divisionRequired) divisionRequired.style.display = 'inline';
                }
                // Hide district for division admin
                if (districtInput) districtInput.closest('.hierarchy-item').style.display = 'none';
                break;
                
            case 'district':
                // District admin: region, division, and district required
                [regionInput, divisionInput, districtInput].forEach(input => {
                    if (input) {
                        input.required = true;
                        const requiredSpan = input.closest('.form-group')?.querySelector('.required');
                        if (requiredSpan) requiredSpan.style.display = 'inline';
                    }
                });
                break;
                
            case 'central':
                // Central admin: no geographic restrictions (handled elsewhere)
                [regionInput, divisionInput, districtInput].forEach(input => {
                    if (input) {
                        input.closest('.hierarchy-item').style.display = 'none';
                    }
                });
                break;
        }
    }
    
    // Search schools function (enhanced)
    async function searchSchools(query) {
        const resultsContainer = document.querySelector('.search-results');
        if (!resultsContainer) return;
        
        try {
            // Show loading state
            resultsContainer.innerHTML = '<div class="search-loading"><i class="fas fa-spinner fa-spin"></i> Searching schools...</div>';
            resultsContainer.classList.add('show');
            resultsContainer.style.display = 'block'; // Force display
            
            // API call to search schools
            const response = await fetch(`/api/schools/search/?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.success && data.schools && data.schools.length > 0) {
                displaySchoolSearchResults(data.schools);
            } else {
                displayNoSchoolResults(query);
            }
        } catch (error) {
            console.error('Error searching schools:', error);
            displaySchoolSearchError();
        }
    }
    
    // Display school search results
    function displaySchoolSearchResults(schools) {
        const resultsContainer = document.querySelector('.search-results');
        if (!resultsContainer) return;
        
        const resultsHTML = schools.map(school => `
            <div class="search-result-item" data-school-id="${school.id}" data-school-code="${school.school_id}">
                <div class="result-icon">
                    <i class="fas fa-school"></i>
                </div>
                <div class="result-content">
                    <div class="result-title">${school.name}</div>
                    <div class="result-subtitle">School ID: ${school.school_id}</div>
                    <div class="result-location">${school.address || (school.district + ', ' + school.division + ', ' + school.region)}</div>
                </div>
                <div class="result-action">
                    <i class="fas fa-check"></i>
                </div>
            </div>
        `).join('');
        
        resultsContainer.innerHTML = resultsHTML;
        resultsContainer.classList.add('show');
        resultsContainer.style.display = 'block'; // Force display
        
        // Add click handlers
        resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', function() {
                selectSchoolFromSearch({
                    id: this.dataset.schoolId,
                    school_id: this.dataset.schoolCode,
                    name: this.querySelector('.result-title').textContent,
                    location: this.querySelector('.result-location').textContent
                });
            });
        });
    }
    
    // Display no school results
    function displayNoSchoolResults(query) {
        const resultsContainer = document.querySelector('.search-results');
        if (!resultsContainer) return;
        
        resultsContainer.innerHTML = `
            <div class="search-no-results">
                <div class="no-results-icon">
                    <i class="fas fa-search"></i>
                </div>
                <div class="no-results-text">
                    <strong>No school found with that School ID</strong>
                    <p>No schools match "${query}". Please check the School ID and try again.</p>
                </div>
            </div>
        `;
        resultsContainer.classList.add('show');
        resultsContainer.style.display = 'block'; // Force display
    }
    
    // Display school search error
    function displaySchoolSearchError() {
        const resultsContainer = document.querySelector('.search-results');
        if (!resultsContainer) return;
        
        resultsContainer.innerHTML = `
            <div class="search-error-results">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="error-text">
                    <strong>Search Error</strong>
                    <p>Unable to search schools. Please try again.</p>
                </div>
            </div>
        `;
        resultsContainer.classList.add('show');
        resultsContainer.style.display = 'block'; // Force display
    }
    
    // Select school from search
    function selectSchoolFromSearch(school) {
        const emailPartInput = document.getElementById('emailPart');
        const verificationDiv = document.getElementById('schoolVerification');
        const emailSplitWrapper = document.querySelector('.email-split-wrapper');
        
        if (!emailPartInput) return;
        
        // Update input with school ID
        emailPartInput.value = school.school_id;
        
        // Generate DepEd email
        const generatedEmail = `${school.school_id}@deped.gov.ph`;
        
        // Update hidden email field
        const hiddenEmailInput = document.getElementById('email');
        if (hiddenEmailInput) {
            hiddenEmailInput.value = generatedEmail;
        }
        
        // Show verification card
        if (verificationDiv) {
            const schoolNameEl = document.getElementById('verifiedSchoolName');
            const schoolEmailEl = document.getElementById('verifiedSchoolEmail');
            const schoolLocationEl = document.getElementById('verifiedSchoolLocation');
            
            if (schoolNameEl) schoolNameEl.textContent = school.name;
            if (schoolEmailEl) schoolEmailEl.textContent = generatedEmail;
            if (schoolLocationEl) schoolLocationEl.textContent = school.location;
            
            verificationDiv.style.display = 'block';
        }
        
        // Store the school data for form submission
        emailPartInput.dataset.schoolId = school.id;
        emailPartInput.dataset.schoolName = school.name;
        
        // Hide search results
        hideSchoolSearchResults();
        
        // Also remove active class from wrapper
        const searchWrapper = emailPartInput.closest('.search-input-wrapper');
        if (searchWrapper) {
            searchWrapper.classList.remove('active');
        }
        
        // Show success validation
        if (emailSplitWrapper) {
            emailSplitWrapper.classList.remove('error');
            emailSplitWrapper.classList.add('success');
        }
        showValidationIcon(emailPartInput, true);
        
        // Update email hint
        const emailHintText = document.getElementById('emailHintText');
        if (emailHintText) {
            emailHintText.textContent = `School verified! Email: ${generatedEmail}`;
        }
        
        // Clear any field errors
        clearFieldError(emailPartInput);
    }
    
    // Hide search results
    function hideSearchResults() {
        const resultsContainer = document.querySelector('.search-results');
        if (resultsContainer) {
            resultsContainer.classList.remove('show');
            resultsContainer.innerHTML = '';
        }
    }
    
    // Hide school search results (specific function for school search)
    function hideSchoolSearchResults() {
        const resultsContainer = document.querySelector('.search-results');
        if (resultsContainer) {
            resultsContainer.classList.remove('show');
            resultsContainer.style.display = 'none';
            resultsContainer.innerHTML = '';
            
            // Remove active class from wrapper
            const searchWrapper = resultsContainer.closest('.search-input-wrapper');
            if (searchWrapper) {
                searchWrapper.classList.remove('active');
            }
        }
    }
    
    // Update assignment preview
    function updateAssignmentPreview() {
        const coveragePreview = document.getElementById('coveragePreview');
        const accessPreview = document.getElementById('accessPreview');
        
        if (!coveragePreview || !accessPreview) return;
        
        const adminLevel = adminLevelSelect.value;
        const selectedAreas = [];
        
        // Collect selected areas
        if (regionInput && regionInput._selectedText) selectedAreas.push(regionInput._selectedText);
        if (divisionInput && divisionInput._selectedText) selectedAreas.push(divisionInput._selectedText);
        if (districtInput && districtInput._selectedText) selectedAreas.push(districtInput._selectedText);
        
        // Update coverage preview
        if (adminLevel === 'central') {
            coveragePreview.textContent = 'Nationwide access to all regions';
        } else if (adminLevel === 'school') {
            const emailPartInput = document.getElementById('emailPart');
            const schoolName = emailPartInput?.dataset.schoolName;
            coveragePreview.textContent = schoolName ? `School: ${schoolName} (Auto-assigned)` : 'No school selected';
        } else if (selectedAreas.length > 0) {
            coveragePreview.textContent = selectedAreas.join(' → ');
        } else {
            coveragePreview.textContent = 'No assignment selected';
        }
        
        // Update access level preview
        const accessLevels = {
            'central': 'Full system access with all permissions',
            'region': 'Regional access with deadline and approval management',
            'division': 'Divisional access with user and content management',
            'district': 'District access with approval permissions only',
            'school': 'School-level access with no administrative permissions'
        };
        
        accessPreview.textContent = accessLevels[adminLevel] || 'Select admin level to see access level';
    }
    
    // Initialize geographic search functionality - simplified
    function initializeGeographicSearch() {
        // This function is now handled by simple_geographic_search.js
        console.log('Geographic search handled by simple_geographic_search.js');
    }
    
    // Initialize search input with functionality
    function initializeSearchInput(inputElement, filterType) {
        if (!inputElement) return;
        
        const wrapper = inputElement.closest('.search-input-wrapper');
        const resultsContainer = wrapper.querySelector('.search-results');
        const clearBtn = wrapper.querySelector('.search-clear-btn');
        
        let searchTimeout;
        let selectedValue = null;
        let selectedText = '';
        
        // Set up clear button functionality
        if (clearBtn) {
            clearBtn.addEventListener('click', function(e) {
                e.preventDefault();
                clearSelection();
            });
        }
        
        // Input event with 1 second delay
        inputElement.addEventListener('input', function() {
            const searchTerm = this.value.trim();
            
            clearTimeout(searchTimeout);
            
            if (searchTerm.length === 0) {
                hideSearchResults(resultsContainer);
                wrapper.classList.remove('active');
                if (selectedValue !== null) {
                    clearSelection();
                }
                return;
            }
            
            searchTimeout = setTimeout(() => {
                performGeographicSearch(searchTerm, filterType, resultsContainer, inputElement);
            }, 1000); // 1 second delay
        });
        
        // Handle focus - show all available options
        inputElement.addEventListener('focus', function() {
            closeAllSearchDropdowns();
            
            if (selectedValue === null && this.value.trim() === '') {
                showAllGeographicOptions(filterType, resultsContainer, inputElement);
            } else if (this.value.trim() && resultsContainer.children.length > 0) {
                resultsContainer.classList.add('show');
                wrapper.classList.add('active');
            }
        });
        
        // Handle blur - hide results after delay
        inputElement.addEventListener('blur', function() {
            setTimeout(() => {
                resultsContainer.classList.remove('show');
                wrapper.classList.remove('active');
            }, 200);
        });
        
        // Clear selection function
        function clearSelection() {
            selectedValue = null;
            selectedText = '';
            inputElement.value = '';
            inputElement._selectedValue = null;
            inputElement._selectedText = '';
            clearBtn.style.display = 'none';
            hideSearchResults(resultsContainer);
            wrapper.classList.remove('active');
            clearDependentInputs(filterType);
            updateAssignmentPreview();
        }
        
        // Show clear button when there's a selection
        function showClearButton() {
            if (clearBtn) {
                clearBtn.style.display = 'block';
            }
        }
        
        // Hide clear button
        function hideClearButton() {
            if (clearBtn) {
                clearBtn.style.display = 'none';
            }
        }
        
        // Set selected value
        inputElement._setSelectedValue = function(value, text) {
            selectedValue = value;
            selectedText = text;
            this.value = text;
            this._selectedValue = value;
            this._selectedText = text;
            hideSearchResults(resultsContainer);
            wrapper.classList.remove('active');
            showClearButton();
            updateDependentInputs(filterType, value);
            updateAssignmentPreview();
        };
    }
    
    // Perform geographic search
    async function performGeographicSearch(searchTerm, filterType, resultsContainer, inputElement) {
        try {
            showSearchLoading(resultsContainer);
            
            const results = await getGeographicSearchResults(filterType, searchTerm);
            displayGeographicSearchResults(results, resultsContainer, inputElement, filterType);
        } catch (error) {
            console.error('Error performing geographic search:', error);
            showSearchError(resultsContainer);
        }
    }
    
    // Get geographic search results
    async function getGeographicSearchResults(filterType, searchTerm, limit = null) {
        let data = [];
        let valueKey = 'id';
        let textKey = 'name';
        
        switch(filterType) {
            case 'region':
                data = geographicData.regions || [];
                break;
            case 'division':
                data = geographicData.divisions || [];
                // Filter divisions based on selected region
                const selectedRegion = getSelectedGeographicValue('region');
                if (selectedRegion) {
                    data = data.filter(item => item.region_id == selectedRegion);
                }
                break;
            case 'district':
                data = geographicData.districts || [];
                // Filter districts based on selected division
                const selectedDivision = getSelectedGeographicValue('division');
                if (selectedDivision) {
                    data = data.filter(item => item.division_id == selectedDivision);
                }
                break;
            case 'school':
                data = geographicData.schools || [];
                valueKey = 'id';
                textKey = 'school_name';
                // Filter schools based on selected district
                const selectedDistrict = getSelectedGeographicValue('district');
                if (selectedDistrict) {
                    data = data.filter(item => item.district_id == selectedDistrict);
                }
                break;
        }
        
        // Load data if not already loaded
        if (data.length === 0 && filterType !== 'region') {
            console.log(`Loading ${filterType} data because cache is empty`);
            data = await loadGeographicDataByType(filterType); // Load all data
            console.log(`Loaded ${data.length} ${filterType} items:`, data);
        }
        
        // Filter data based on search term
        let filteredData = data;
        if (searchTerm && searchTerm.trim() !== '') {
            filteredData = data.filter(item => {
                const text = item[textKey] || '';
                return text.toLowerCase().includes(searchTerm.toLowerCase());
            });
        }
        
        // Return all filtered data without limits
        return filteredData.map(item => ({
            value: item[valueKey],
            text: item[textKey] || '',
            item: item
        }));
    }
    
    // Load geographic data by type
    async function loadGeographicDataByType(type, parentId = null) {
        try {
            console.log(`Loading ${type} data${parentId ? ` for parent ${parentId}` : ' (all data)'}...`);
            let data = [];
            
            if (parentId) {
                // Load data for specific parent
                data = await fetchGeographicData(type, parentId);
            } else {
                // Load all data for the type
                data = await fetchGeographicData(type);
            }
            
            // Cache the data
            geographicData[type] = data;
            console.log(`Loaded ${data.length} ${type} items:`, data);
            return data;
        } catch (error) {
            console.error(`Error loading ${type}:`, error);
            return [];
        }
    }
    
    // Show all available geographic options
    async function showAllGeographicOptions(filterType, resultsContainer, inputElement) {
        try {
            showSearchLoading(resultsContainer);
            
            // For all types, show all available data
            if (filterType === 'region') {
                const results = await getGeographicSearchResults(filterType, ''); // Show all regions
                displayGeographicSearchResults(results, resultsContainer, inputElement, filterType);
            } else {
                // Load data for other types first
                await loadGeographicDataByType(filterType + 's');
                const results = await getGeographicSearchResults(filterType, '');
                displayGeographicSearchResults(results, resultsContainer, inputElement, filterType);
            }
        } catch (error) {
            console.error('Error showing all options:', error);
            showSearchError(resultsContainer);
        }
    }
    
    // Display geographic search results
    function displayGeographicSearchResults(results, resultsContainer, inputElement, filterType) {
        closeAllSearchDropdowns();
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="search-no-results"><i class="fas fa-search"></i><p>No results found</p></div>';
            resultsContainer.classList.add('show');
            inputElement.closest('.search-input-wrapper').classList.add('active');
            return;
        }
        
        // Add header for all options display
        let headerHtml = '';
        if (inputElement.value.trim() === '') {
            const totalAvailable = results.length;
            const displayCount = Math.min(results.length, 6);
            let message = `Showing ${displayCount} of ${totalAvailable} available ${filterType}s`;
            if (totalAvailable > 6) {
                message += '<br><small style="opacity: 0.8;">Type to search and filter results</small>';
            }
            headerHtml = `<div class="search-results-header">
                ${message}
            </div>`;
        }
        
        // Limit display to 6 items in dropdown
        const displayResults = results.slice(0, 20);
        
        const html = displayResults.map(result => {
            let resultHtml = `<div class="search-result-item" data-value="${result.value}">`;
            resultHtml += `<div class="result-main">${escapeHtml(result.text)}</div>`;
            
            // Add additional context for some filter types
            if (filterType === 'school' && result.item.district_id) {
                const district = geographicData.districts?.find(d => d.id === result.item.district_id);
                if (district) {
                    resultHtml += `<div class="result-sub">District: ${escapeHtml(district.name)}</div>`;
                }
            } else if (filterType === 'division' && result.item.region_id) {
                const region = geographicData.regions?.find(r => r.id === result.item.region_id);
                if (region) {
                    resultHtml += `<div class="result-sub">Region: ${escapeHtml(region.name)}</div>`;
                }
            } else if (filterType === 'district' && result.item.division_id) {
                const division = geographicData.divisions?.find(d => d.id === result.item.division_id);
                if (division) {
                    resultHtml += `<div class="result-sub">Division: ${escapeHtml(division.name)}</div>`;
                }
            }
            
            resultHtml += '</div>';
            return resultHtml;
        }).join('');
        
        resultsContainer.innerHTML = headerHtml + html;
        resultsContainer.classList.add('show');
        inputElement.closest('.search-input-wrapper').classList.add('active');
        
        // Add click handlers for results
        resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', function() {
                const value = this.getAttribute('data-value');
                const text = this.querySelector('.result-main').textContent;
                inputElement._setSelectedValue(value, text);
            });
        });
    }
    
    // Helper functions for search
    function showSearchLoading(container) {
        container.innerHTML = '<div class="search-loading"><i class="fas fa-spinner"></i>Searching...</div>';
        container.classList.add('show');
    }
    
    function showSearchError(container) {
        container.innerHTML = '<div class="search-no-results"><i class="fas fa-exclamation-triangle"></i><p>Error loading results</p></div>';
        container.classList.add('show');
    }
    
    function hideSearchResults(container) {
        container.classList.remove('show');
    }
    
    function closeAllSearchDropdowns() {
        document.querySelectorAll('.search-results.show').forEach(results => {
            results.classList.remove('show');
        });
        document.querySelectorAll('.search-input-wrapper.active').forEach(wrapper => {
            wrapper.classList.remove('active');
        });
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function getSelectedGeographicValue(type) {
        const input = document.getElementById(type);
        return input?._selectedValue || null;
    }
    
    function clearDependentInputs(currentType) {
        const hierarchy = ['region', 'division', 'district', 'school'];
        const currentIndex = hierarchy.indexOf(currentType);
        
        // Clear all inputs that depend on the current one
        for (let i = currentIndex + 1; i < hierarchy.length; i++) {
            const input = document.getElementById(hierarchy[i]);
            if (input) {
                input.value = '';
                input._selectedValue = null;
                input._selectedText = '';
                input.disabled = true;
                const clearBtn = input.closest('.search-input-wrapper').querySelector('.search-clear-btn');
                if (clearBtn) {
                    clearBtn.style.display = 'none';
                }
            }
        }
    }
    
    function updateDependentInputs(currentType, value) {
        const hierarchy = ['region', 'division', 'district', 'school'];
        const currentIndex = hierarchy.indexOf(currentType);
        
        // Clear inputs that depend on the current one
        for (let i = currentIndex + 1; i < hierarchy.length; i++) {
            const input = document.getElementById(hierarchy[i]);
            if (input) {
                input.value = '';
                input._selectedValue = null;
                input._selectedText = '';
                input.disabled = true;
                const clearBtn = input.closest('.search-input-wrapper').querySelector('.search-clear-btn');
                if (clearBtn) {
                    clearBtn.style.display = 'none';
                }
            }
        }
        
        // Enable the next input in hierarchy and load its data
        const nextIndex = currentIndex + 1;
        if (nextIndex < hierarchy.length) {
            const nextInput = document.getElementById(hierarchy[nextIndex]);
            if (nextInput) {
                nextInput.disabled = false;
                nextInput.placeholder = `Search and select ${hierarchy[nextIndex]}...`;
                
                // Load data for the next level
                const nextType = hierarchy[nextIndex];
                if (nextType !== 'region') {
                    loadGeographicDataByType(nextType, value).then(() => {
                        console.log(`Loaded ${nextType} data for parent ${currentType} ${value}`);
                    });
                }
            }
        }
    }
    
    // Clear geographic search inputs
    function clearGeographicInputs() {
        clearGeographicInput(divisionInput);
        clearGeographicInput(districtInput);
        clearGeographicInput(schoolInput);
    }
    
    // Clear individual geographic input
    function clearGeographicInput(input) {
        if (!input) return;
        input.value = '';
        input._selectedValue = null;
        input._selectedText = '';
        input.disabled = true;
        const clearBtn = input.closest('.search-input-wrapper').querySelector('.search-clear-btn');
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
        hideSearchResults(input.closest('.search-input-wrapper').querySelector('.search-results'));
    }
    
    // Clear select dropdown
    function clearSelect(selectElement) {
        while (selectElement.children.length > 1) {
            selectElement.removeChild(selectElement.lastChild);
        }
        selectElement.value = '';
    }
    
    // Generate secure password
    function generateSecurePassword() {
        const length = 12;
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        
        // Ensure at least one of each required character type
        password += getRandomChar('abcdefghijklmnopqrstuvwxyz'); // lowercase
        password += getRandomChar('ABCDEFGHIJKLMNOPQRSTUVWXYZ'); // uppercase
        password += getRandomChar('0123456789'); // number
        password += getRandomChar('!@#$%^&*'); // special
        
        // Fill the rest randomly
        for (let i = password.length; i < length; i++) {
            password += getRandomChar(charset);
        }
        
        // Shuffle the password
        password = password.split('').sort(() => 0.5 - Math.random()).join('');
        passwordInput.value = password;
    }
    
    // Get random character from charset
    function getRandomChar(charset) {
        return charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    // Render user table
    function renderUserTable() {
        userTableBody.innerHTML = '';
        
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const usersToShow = filteredUsers.slice(startIndex, endIndex);
        
        usersToShow.forEach(user => {
            const row = createUserRow(user);
            userTableBody.appendChild(row);
        });
        
        updateTableInfo();
        addCheckboxListeners();
    }
    
    // Create user table row
    function createUserRow(user) {
        const row = document.createElement('tr');
        
        const statusClass = getStatusClass(user.status);
        const permissionsList = getPermissionsList(user.permissions);
        const lastLogin = formatLastLogin(user.last_login);
        
        row.innerHTML = `
            <td><input type="checkbox" class="user-checkbox" data-user-id="${user.admin_id}"></td>
            <td>
                <div class="user-info">
                    <div class="user-avatar">${getInitials(user.full_name)}</div>
                    <div>
                        <div class="user-name">${escapeHtml(user.full_name)}</div>
                        <div class="user-username">@${escapeHtml(user.username)}</div>
                    </div>
                </div>
            </td>
            <td>${escapeHtml(user.email)}</td>
            <td>
                <span class="admin-level-badge ${user.admin_level}">
                    ${user.admin_level.charAt(0).toUpperCase() + user.admin_level.slice(1)}
                </span>
            </td>
            <td class="assigned-area">${escapeHtml(user.assigned_area || 'Not assigned')}</td>
            <td><span class="status-badge ${statusClass}">${user.status}</span></td>
            <td>${lastLogin}</td>
            <td>
                <div class="permissions-summary" title="${permissionsList}">
                    ${getPermissionsCount(user.permissions)} permissions
                </div>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" onclick="viewUserProfile(${user.admin_id})" title="View Profile">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn edit" onclick="editUser(${user.admin_id})" title="Edit User">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn reset" onclick="resetUserPassword(${user.admin_id})" title="Reset Password">
                        <i class="fas fa-key"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteUser(${user.admin_id})" title="Delete User">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        return row;
    }
    
    // Helper functions
    function getStatusClass(status) {
        const statusClasses = {
            'active': 'active',
            'inactive': 'inactive', 
            'suspended': 'suspended'
        };
        return statusClasses[status] || 'inactive';
    }
    
    function getPermissionsList(permissions) {
        const permissionNames = {
            can_create_users: 'Create Users',
            can_manage_users: 'Manage Users',
            can_set_deadlines: 'Set Deadlines',
            can_approve_submissions: 'Approve Submissions',
            can_view_system_logs: 'View System Logs'
        };
        
        return Object.entries(permissions)
            .filter(([key, value]) => value)
            .map(([key]) => permissionNames[key])
            .join(', ');
    }
    
    function getPermissionsCount(permissions) {
        return Object.values(permissions).filter(Boolean).length;
    }
    
    function getInitials(fullName) {
        return fullName.split(' ').map(name => name.charAt(0)).join('').toUpperCase().slice(0, 2);
    }
    
    function formatLastLogin(lastLogin) {
        if (!lastLogin) return 'Never';
        
        const date = new Date(lastLogin);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Today';
        if (diffDays === 2) return 'Yesterday';
        if (diffDays <= 7) return `${diffDays - 1} days ago`;
        
        return date.toLocaleDateString();
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Apply filters
    function applyFilters() {
        const roleFilter = document.getElementById('roleFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const searchTerm = document.getElementById('userSearch').value.toLowerCase();
        
        filteredUsers = currentUsers.filter(user => {
            const matchesRole = roleFilter === 'all' || user.admin_level === roleFilter;
            const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
            const matchesSearch = !searchTerm || 
                user.full_name.toLowerCase().includes(searchTerm) ||
                user.username.toLowerCase().includes(searchTerm) ||
                user.email.toLowerCase().includes(searchTerm);
            
            return matchesRole && matchesStatus && matchesSearch;
        });
        
        currentPage = 1;
        renderUserTable();
        updatePagination();
    }
    
    // Reset filters
    function resetFilters() {
        document.getElementById('roleFilter').value = 'all';
        document.getElementById('statusFilter').value = 'all';
        document.getElementById('userSearch').value = '';
        
        filteredUsers = [...currentUsers];
        currentPage = 1;
        renderUserTable();
        updatePagination();
    }
    
    // Update pagination
    function updatePagination() {
        const totalItems = filteredUsers.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        
        // Update info
        const startCount = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
        const endCount = Math.min(currentPage * itemsPerPage, totalItems);
        
        document.getElementById('startCount').textContent = startCount;
        document.getElementById('endCount').textContent = endCount;
        document.getElementById('totalCount').textContent = totalItems;
        
        // Update pagination controls
        const paginationContainer = document.querySelector('.pagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
            
            // Previous button
            const prevBtn = document.createElement('button');
            prevBtn.className = 'page-btn';
            prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
            prevBtn.disabled = currentPage === 1;
            prevBtn.onclick = () => goToPage(currentPage - 1);
            paginationContainer.appendChild(prevBtn);
            
            // Page numbers
            const startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(totalPages, currentPage + 2);
            
            if (startPage > 1) {
                const firstBtn = document.createElement('button');
                firstBtn.className = 'page-btn';
                firstBtn.textContent = '1';
                firstBtn.onclick = () => goToPage(1);
                paginationContainer.appendChild(firstBtn);
                
                if (startPage > 2) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    ellipsis.className = 'pagination-ellipsis';
                    paginationContainer.appendChild(ellipsis);
                }
            }
            
            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.onclick = () => goToPage(i);
                paginationContainer.appendChild(pageBtn);
            }
            
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    ellipsis.className = 'pagination-ellipsis';
                    paginationContainer.appendChild(ellipsis);
                }
                
                const lastBtn = document.createElement('button');
                lastBtn.className = 'page-btn';
                lastBtn.textContent = totalPages;
                lastBtn.onclick = () => goToPage(totalPages);
                paginationContainer.appendChild(lastBtn);
            }
            
            // Next button
            const nextBtn = document.createElement('button');
            nextBtn.className = 'page-btn';
            nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
            nextBtn.disabled = currentPage === totalPages || totalPages === 0;
            nextBtn.onclick = () => goToPage(currentPage + 1);
            paginationContainer.appendChild(nextBtn);
        }
    }
    
    // Go to specific page
    function goToPage(page) {
        const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
        if (page >= 1 && page <= totalPages) {
            currentPage = page;
            renderUserTable();
            updatePagination();
        }
    }
    
    // Update table info
    function updateTableInfo() {
        updatePagination();
    }
    
    // Utility functions
    function showLoading() {
        // Disable form and show loading state
        const submitBtn = isEditing ? saveUserBtn : saveUserBtn;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }
        
        // Disable form inputs
        const inputs = userForm.querySelectorAll('input, select, button');
        inputs.forEach(input => {
            if (input !== submitBtn) {
                input.disabled = true;
            }
        });
        
        console.log('Loading...');
    }
    
    function hideLoading() {
        // Re-enable form and restore button state
        const submitBtn = isEditing ? saveUserBtn : saveUserBtn;
        if (submitBtn) {
            submitBtn.disabled = false;
            const action = isEditing ? 'Update' : 'Create';
            submitBtn.innerHTML = `<i class="fas fa-save"></i> ${action} Admin User`;
        }
        
        // Re-enable form inputs
        const inputs = userForm.querySelectorAll('input, select, button');
        inputs.forEach(input => {
            input.disabled = false;
        });
        
        // Re-disable username for editing
        if (isEditing && usernameInput) {
            usernameInput.disabled = true;
        }
        
        console.log('Loading complete');
    }
    
    function showSuccess(message) {
        // Create and show success notification
        showNotification(message, 'success');
    }
    
    function showError(message) {
        // Create and show error notification
        showNotification(message, 'error');
    }
    
    function showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notif => notif.remove());
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
        
        // Show notification with animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
    }
    
    function showFieldError(field, message) {
        field.classList.add('error');
        
        // For email field, place error below emailHint
        if (field.id === 'emailPart') {
            const emailHint = document.getElementById('emailHint');
            const formGroup = field.closest('.form-group');
            
            // Remove existing error message
            const existingError = formGroup.querySelector('.field-error');
            if (existingError) {
                existingError.remove();
            }
            
            // Add new error message after emailHint
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            errorDiv.textContent = message;
            
            if (emailHint) {
                // Insert after emailHint
                emailHint.parentNode.insertBefore(errorDiv, emailHint.nextSibling);
            } else {
                // Fallback to original behavior
                field.parentNode.appendChild(errorDiv);
            }
        } else {
            // For other fields, use original behavior
            // Remove existing error message
            const existingError = field.parentNode.querySelector('.field-error');
            if (existingError) {
                existingError.remove();
            }
            
            // Add new error message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            errorDiv.textContent = message;
            field.parentNode.appendChild(errorDiv);
        }
    }
    
    function clearFieldError(field) {
        field.classList.remove('error');
        
        // For email field, look for error in form group (after emailHint)
        if (field.id === 'emailPart') {
            const formGroup = field.closest('.form-group');
            const errorDiv = formGroup.querySelector('.field-error');
            if (errorDiv) {
                errorDiv.remove();
            }
        } else {
            // For other fields, use original behavior
            const errorDiv = field.parentNode.querySelector('.field-error');
            if (errorDiv) {
                errorDiv.remove();
            }
        }
    }
    
    function clearValidationErrors() {
        document.querySelectorAll('.error').forEach(field => {
            field.classList.remove('error');
        });
        document.querySelectorAll('.field-error').forEach(error => {
            error.remove();
        });
    }
    
    function resetPermissions() {
        Object.values(permissionCheckboxes).forEach(checkbox => {
            checkbox.checked = false;
        });
    }
    
    function getCSRFToken() {
        // Method 1: Try to get from form input
        let token = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
        
        // Method 2: Try to get from meta tag
        if (!token) {
            token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        }
        
        // Method 3: Try to get from cookies
        if (!token) {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'csrftoken') {
                    token = decodeURIComponent(value);
                    break;
                }
            }
        }
        
        // Method 4: Try alternative cookie names
        if (!token) {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'csrf_token' || name === 'CSRF_TOKEN') {
                    token = decodeURIComponent(value);
                    break;
                }
            }
        }
        
        console.log('CSRF Token found:', token ? 'Yes' : 'No');
        console.log('Token length:', token ? token.length : 0);
        console.log('All cookies:', document.cookie);
        
        return token || '';
    }
    
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Global functions for button clicks
    window.viewUserProfile = async function(userId, editMode = false) {
        try {
            // Load user data
            const response = await fetch(`${API_ENDPOINTS.EDIT_USER}${userId}/`);
            const result = await response.json();
            
            if (result.success) {
                if (editMode) {
                    showUserEditModal(result.user);
                } else {
                showUserProfileModal(result.user);
                }
            } else {
                showError('Failed to load user profile: ' + result.error);
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            showError('Failed to load user profile. Please try again.');
        }
    };
    
    window.editUser = async function(userId) {
        try {
            isEditing = true;
            editingUserId = userId;
            
            // Load user data
            const response = await fetch(`${API_ENDPOINTS.EDIT_USER}${userId}/`);
            const result = await response.json();
            
            if (result.success) {
                populateEditForm(result.user);
                modalTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Admin User';
                showModal();
                showStep(1);
                updateFormNavigation();
            } else {
                showError('Failed to load user data: ' + result.error);
            }
        } catch (error) {
            console.error('Error loading user for edit:', error);
            showError('Failed to load user data. Please try again.');
        }
    };
    
    window.resetUserPassword = async function(userId) {
        const user = currentUsers.find(u => u.admin_id === userId);
        if (!user) {
            showError('User not found');
            return;
        }
        
        if (!confirm(`Are you sure you want to reset the password for ${user.full_name}?`)) {
            return;
        }
        
        try {
            showLoading();
            const response = await fetch(API_ENDPOINTS.RESET_PASSWORD.replace('{id}', userId), {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken()
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                showPasswordResetModal(result.user, result.new_password);
            } else {
                showError('Failed to reset password: ' + result.error);
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            showError('Failed to reset password. Please try again.');
        } finally {
            hideLoading();
        }
    };
    
    window.deleteUser = async function(userId) {
        const user = currentUsers.find(u => u.admin_id === userId);
        if (!user) {
            showError('User not found');
            return;
        }
        
        if (!confirm(`Are you sure you want to delete ${user.full_name}? This action cannot be undone.`)) {
            return;
        }
        
        try {
            showLoading();
            const response = await fetch(API_ENDPOINTS.DELETE_USER.replace('{id}', userId), {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCSRFToken()
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                showSuccess(result.message);
                loadUsers(); // Refresh the user list
            } else {
                showError('Failed to delete user: ' + result.error);
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            showError('Failed to delete user. Please try again.');
        } finally {
            hideLoading();
        }
    };
    
    // Export users functionality
    window.exportUsers = async function(format = 'csv') {
        try {
            showLoading();
            const response = await fetch(`${API_ENDPOINTS.EXPORT_USERS}?format=${format}`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `admin_users.${format}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                showSuccess('Users exported successfully!');
            } else {
                const result = await response.json();
                showError('Failed to export users: ' + result.error);
            }
        } catch (error) {
            console.error('Error exporting users:', error);
            showError('Failed to export users. Please try again.');
        } finally {
            hideLoading();
        }
    };
    
    // Populate edit form with user data
    function populateEditForm(user) {
        fullNameInput.value = user.full_name || '';
        usernameInput.value = user.username || '';
        usernameInput.disabled = true; // Don't allow username changes
        emailInput.value = user.email || '';
        adminLevelSelect.value = user.admin_level || '';
        statusSelect.value = user.status || '';
        
        // Populate geographic fields using new search inputs
        if (user.region_id) {
            regionInput._setSelectedValue(user.region_id, user.region_name || '');
            updateDependentInputs('region', user.region_id);
        }
                if (user.division_id) {
            divisionInput._setSelectedValue(user.division_id, user.division_name || '');
            updateDependentInputs('division', user.division_id);
        }
                        if (user.district_id) {
            districtInput._setSelectedValue(user.district_id, user.district_name || '');
            updateDependentInputs('district', user.district_id);
        }
        if (user.school_id && user.admin_level === 'school') {
            // For school level admins, populate the email field with school info
            const emailPartInput = document.getElementById('emailPart');
            if (emailPartInput) {
                emailPartInput.value = user.school_id;
                emailPartInput.dataset.schoolId = user.school_id;
                emailPartInput.dataset.schoolName = user.school_name || '';
                
                // Generate the DepEd email
                const generatedEmail = `${user.school_id}@deped.gov.ph`;
                const hiddenEmailInput = document.getElementById('email');
                if (hiddenEmailInput) {
                    hiddenEmailInput.value = generatedEmail;
                }
                
                // Show verification if elements exist
                const verificationDiv = document.getElementById('schoolVerification');
                if (verificationDiv) {
                    document.getElementById('verifiedSchoolName').textContent = user.school_name || 'School Name';
                    document.getElementById('verifiedSchoolEmail').textContent = generatedEmail;
                    document.getElementById('verifiedSchoolLocation').textContent = user.school_location || 'Location';
                    verificationDiv.style.display = 'block';
                }
            }
        }
        
        // Populate permissions
        Object.keys(permissionCheckboxes).forEach(key => {
            if (user.permissions && user.permissions[key] !== undefined) {
                permissionCheckboxes[key].checked = user.permissions[key];
            }
        });
        
        // Update UI based on admin level
        handleAdminLevelChangeEnhanced();
        
        // Hide password field for editing
        const passwordGroup = passwordInput.closest('.form-group');
        if (passwordGroup) {
            passwordGroup.style.display = 'none';
        }
    }
    
    // Show password reset modal
    function showPasswordResetModal(user, newPassword) {
        const passwordModal = document.getElementById('passwordModal');
        const userInfo = passwordModal.querySelector('.user-info');
        const passwordField = passwordModal.querySelector('#newPassword');
        
        // Update user info
        const avatar = userInfo.querySelector('.avatar');
        const name = userInfo.querySelector('.name');
        const email = userInfo.querySelector('.email');
        
        avatar.textContent = getInitials(user.full_name);
        name.textContent = user.full_name;
        email.textContent = user.email;
        
        // Set new password
        passwordField.value = newPassword;
        
        // Show modal
        passwordModal.classList.add('active');
        
        // Copy password functionality
        const copyBtn = passwordModal.querySelector('#copyPassword');
        copyBtn.onclick = function() {
            navigator.clipboard.writeText(newPassword).then(() => {
                showSuccess('Password copied to clipboard!');
            }).catch(() => {
                // Fallback for older browsers
                passwordField.select();
                document.execCommand('copy');
                showSuccess('Password copied to clipboard!');
            });
        };
    }
    
    // Show user profile modal
    function showUserProfileModal(user) {
        console.log('Opening profile for user:', user);
        
        // Create or get profile modal
        let profileModal = document.getElementById('profileModal');
        if (!profileModal) {
            console.log('Creating new profile modal');
            profileModal = createProfileModal();
            document.body.appendChild(profileModal);
        } else {
            console.log('Using existing profile modal');
        }
        
        // Verify modal was created properly
        if (!profileModal) {
            console.error('Failed to create profile modal');
            showError('Failed to create profile modal');
            return;
        }
        
        // Store user data on modal for later use
        profileModal.userData = user;
        
        // Update profile data using the new comprehensive function
        updateUserProfileData(profileModal, user);
        
        // Show modal
        profileModal.classList.add('active');
    }
    
    // Create profile modal
    function createProfileModal() {
        const modal = document.createElement('div');
        modal.id = 'profileModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content profile-modal-content">
                <!-- Profile Cover and Header -->
                <div class="profile-cover">
                    <div class="profile-cover-pattern"></div>
                </div>
                
                <div class="profile-header">
                    <div class="profile-avatar-container">
                        <div class="profile-avatar"></div>
                        <div class="profile-status-indicator"></div>
                    </div>
                    
                    <div class="profile-info">
                        <h1 class="profile-name"></h1>
                        <div class="profile-title"></div>
                        <div class="profile-username"></div>
                        
                        <div class="profile-quick-stats">
                            <div class="profile-stat">
                                <span class="profile-stat-value profile-login-count">0</span>
                                <span class="profile-stat-label">Total Logins</span>
                            </div>
                            <div class="profile-stat">
                                <span class="profile-stat-value profile-days-active">0</span>
                                <span class="profile-stat-label">Days Active</span>
                            </div>
                            <div class="profile-stat">
                                <span class="profile-stat-value profile-permission-count">0</span>
                                <span class="profile-stat-label">Permissions</span>
                            </div>
                        </div>
                    </div>
                    
                    <button class="close-btn" onclick="closeProfileModal()" title="Close Profile">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <!-- Profile Content with Tabs -->
                <div class="profile-content">
                    <!-- Navigation Tabs -->
                    <nav class="profile-nav">
                        <button class="profile-nav-item active" data-tab="overview">
                            <i class="fas fa-user"></i>
                            <span>Overview</span>
                        </button>
                        <button class="profile-nav-item" data-tab="activity">
                            <i class="fas fa-history"></i>
                            <span>Activity</span>
                        </button>
                        <button class="profile-nav-item" data-tab="permissions">
                            <i class="fas fa-shield-alt"></i>
                            <span>Permissions</span>
                        </button>
                        <button class="profile-nav-item" data-tab="security">
                            <i class="fas fa-lock"></i>
                            <span>Security</span>
                        </button>
                    </nav>
                    
                    <!-- Tab Content: Overview -->
                    <div class="profile-tab-content active" id="overview-tab">
                        <div class="profile-details">
                            <div class="profile-detail-card">
                                <div class="detail-card-header">
                                    <h3 class="detail-card-title">
                                        <i class="fas fa-id-card"></i>
                                        Personal Information
                                    </h3>
                                    <button class="detail-card-action" onclick="toggleEditMode('personal')">
                                        <i class="fas fa-edit"></i> Edit
                                    </button>
                                </div>
                                <div class="detail-row">
                                    <div class="detail-label">
                                        <i class="fas fa-user"></i>
                                        Full Name
                                    </div>
                                    <div class="detail-value profile-full-name"></div>
                                    <input type="text" class="detail-input" style="display: none;">
                                </div>
                                <div class="detail-row">
                                    <div class="detail-label">
                                        <i class="fas fa-envelope"></i>
                                        Email Address
                                    </div>
                                    <div class="detail-value profile-email"></div>
                                    <input type="email" class="detail-input" style="display: none;">
                                </div>
                                <div class="detail-row">
                                    <div class="detail-label">
                                        <i class="fas fa-at"></i>
                                        Username
                                    </div>
                                    <div class="detail-value profile-username-display"></div>
                                    <input type="text" class="detail-input" style="display: none;">
                                </div>
                            </div>
                            
                            <div class="profile-detail-card">
                                <div class="detail-card-header">
                                    <h3 class="detail-card-title">
                                        <i class="fas fa-building"></i>
                                        Administrative Details
                                    </h3>
                                </div>
                                <div class="detail-row">
                                    <div class="detail-label">
                                        <i class="fas fa-layer-group"></i>
                                        Admin Level
                                    </div>
                                    <div class="detail-value highlight profile-admin-level"></div>
                                </div>
                                <div class="detail-row">
                                    <div class="detail-label">
                                        <i class="fas fa-toggle-on"></i>
                                        Account Status
                                    </div>
                                    <div class="detail-value profile-status"></div>
                                </div>
                                <div class="detail-row">
                                    <div class="detail-label">
                                        <i class="fas fa-map-marker-alt"></i>
                                        Assigned Area
                                    </div>
                                    <div class="detail-value profile-assigned-area"></div>
                                </div>
                                <div class="detail-row">
                                    <div class="detail-label">
                                        <i class="fas fa-calendar-plus"></i>
                                        Account Created
                                    </div>
                                    <div class="detail-value profile-created-at"></div>
                                </div>
                                <div class="detail-row">
                                    <div class="detail-label">
                                        <i class="fas fa-sign-in-alt"></i>
                                        Last Login
                                    </div>
                                    <div class="detail-value profile-last-login"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Tab Content: Activity -->
                    <div class="profile-tab-content" id="activity-tab">
                        <div class="activity-timeline">
                            <div class="activity-item success">
                                <div class="activity-header">
                                    <div class="activity-title">Account Created</div>
                                    <div class="activity-time profile-created-time"></div>
                                </div>
                                <div class="activity-description">Admin user account was successfully created in the system.</div>
                            </div>
                            <div class="activity-item">
                                <div class="activity-header">
                                    <div class="activity-title">Last Login</div>
                                    <div class="activity-time profile-last-login-time"></div>
                                </div>
                                <div class="activity-description">User successfully logged into the admin system.</div>
                            </div>
                            <div class="activity-item important">
                                <div class="activity-header">
                                    <div class="activity-title">Permissions Updated</div>
                                    <div class="activity-time">2 days ago</div>
                                </div>
                                <div class="activity-description">User permissions were modified by system administrator.</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Tab Content: Permissions -->
                    <div class="profile-tab-content" id="permissions-tab">
                        <div class="profile-permissions-grid">
                            <!-- Permissions will be populated dynamically -->
                        </div>
                    </div>
                    
                    <!-- Tab Content: Security -->
                    <div class="profile-tab-content" id="security-tab">
                        <div class="security-card">
                            <div class="security-header">
                                <div class="security-icon">
                                    <i class="fas fa-key"></i>
                                </div>
                                <div class="security-info">
                                    <h3>Password Security</h3>
                                    <p>Manage password and authentication settings for this user account.</p>
                                </div>
                            </div>
                            <div class="security-actions">
                                <button class="security-btn primary" onclick="resetUserPassword()">
                                    <i class="fas fa-sync-alt"></i>
                                    Reset Password
                                </button>
                                <button class="security-btn secondary" onclick="forcePasswordChange()">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    Force Password Change
                                </button>
                            </div>
                        </div>
                        
                        <div class="security-card">
                            <div class="security-header">
                                <div class="security-icon">
                                    <i class="fas fa-ban"></i>
                                </div>
                                <div class="security-info">
                                    <h3>Account Control</h3>
                                    <p>Control account access and security measures.</p>
                                </div>
                            </div>
                            <div class="security-actions">
                                <button class="security-btn secondary" onclick="suspendAccount()">
                                    <i class="fas fa-pause"></i>
                                    Suspend Account
                                </button>
                                <button class="security-btn danger" onclick="deactivateAccount()">
                                    <i class="fas fa-user-times"></i>
                                    Deactivate Account
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Profile Actions -->
                <div class="profile-actions">
                    <div class="profile-actions-left">
                        <span class="profile-last-updated">Last updated: <span class="profile-update-time"></span></span>
                    </div>
                    <div class="profile-actions-right">
                        <button class="profile-action-btn outline" onclick="closeProfileModal()">
                            <i class="fas fa-times"></i>
                            Close
                        </button>
                        <button class="profile-action-btn primary" onclick="editUser()">
                            <i class="fas fa-edit"></i>
                            Edit User
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeProfileModal();
            }
        });
        
        // Add tab functionality
        const tabButtons = modal.querySelectorAll('.profile-nav-item');
        const tabContents = modal.querySelectorAll('.profile-tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                
                // Remove active class from all tabs and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                button.classList.add('active');
                const targetContent = modal.querySelector(`#${tabName}-tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
        
        return modal;
    }
    
    // Enhanced showUserProfileModal function with new structure
    function updateUserProfileData(profileModal, user) {
        console.log('Updating profile data for user:', user);
        
        // Helper function to safely set text content
        function safeSetText(element, text, elementName) {
            if (element) {
                element.textContent = text;
            } else {
                console.warn(`Element not found: ${elementName}`);
            }
        }
        
        // Helper function to safely set class name
        function safeSetClass(element, className, elementName) {
            if (element) {
                element.className = className;
            } else {
                console.warn(`Element not found: ${elementName}`);
            }
        }
        
        // Update avatar and basic info
        const avatar = profileModal.querySelector('.profile-avatar');
        const statusIndicator = profileModal.querySelector('.profile-status-indicator');
        const name = profileModal.querySelector('.profile-name');
        const title = profileModal.querySelector('.profile-title');
        const username = profileModal.querySelector('.profile-username');
        
        // Overview tab elements
        const fullName = profileModal.querySelector('.profile-full-name');
        const email = profileModal.querySelector('.profile-email');
        const usernameDisplay = profileModal.querySelector('.profile-username-display');
        const adminLevel = profileModal.querySelector('.profile-admin-level');
        const status = profileModal.querySelector('.profile-status');
        const assignedArea = profileModal.querySelector('.profile-assigned-area');
        const createdAt = profileModal.querySelector('.profile-created-at');
        const lastLogin = profileModal.querySelector('.profile-last-login');
        
        // Quick stats
        const loginCount = profileModal.querySelector('.profile-login-count');
        const daysActive = profileModal.querySelector('.profile-days-active');
        const permissionCount = profileModal.querySelector('.profile-permission-count');
        
        // Activity tab elements
        const createdTime = profileModal.querySelector('.profile-created-time');
        const lastLoginTime = profileModal.querySelector('.profile-last-login-time');
        
        // Update times
        const updateTime = profileModal.querySelector('.profile-update-time');
        
        // Populate basic information
        safeSetText(avatar, getInitials(user.full_name), '.profile-avatar');
        safeSetText(name, user.full_name, '.profile-name');
        safeSetText(title, `${user.admin_level.charAt(0).toUpperCase() + user.admin_level.slice(1)} Administrator`, '.profile-title');
        safeSetText(username, `@${user.username}`, '.profile-username');
        
        // Set status indicator color
        safeSetClass(statusIndicator, `profile-status-indicator ${user.status}`, '.profile-status-indicator');
        
        // Populate overview tab
        safeSetText(fullName, user.full_name, '.profile-full-name');
        safeSetText(email, user.email, '.profile-email');
        safeSetText(usernameDisplay, user.username, '.profile-username-display');
        
        if (adminLevel) {
        adminLevel.textContent = user.admin_level.charAt(0).toUpperCase() + user.admin_level.slice(1);
            adminLevel.className = `detail-value highlight admin-level-badge ${user.admin_level}`;
        }
        
        if (status) {
            status.textContent = user.status.charAt(0).toUpperCase() + user.status.slice(1);
            status.className = `detail-value status-badge ${getStatusClass(user.status)}`;
        }
        
        safeSetText(assignedArea, user.assigned_area || 'Not assigned', '.profile-assigned-area');
        
        if (createdAt) {
            createdAt.textContent = new Date(user.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } else {
            console.warn('Element not found: .profile-created-at');
        }
        
        safeSetText(lastLogin, formatLastLogin(user.last_login), '.profile-last-login');
        
        // Calculate and populate quick stats
        const createdDate = new Date(user.created_at);
        const today = new Date();
        const daysActiveSinceCreation = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
        
        safeSetText(loginCount, user.login_count || Math.floor(Math.random() * 50) + 10, '.profile-login-count'); // Mock data
        safeSetText(daysActive, daysActiveSinceCreation, '.profile-days-active');
        
        // Count permissions
        let permissionsGranted = 0;
        if (user.permissions) {
            permissionsGranted = Object.values(user.permissions).filter(Boolean).length;
        }
        safeSetText(permissionCount, permissionsGranted, '.profile-permission-count');
        
        // Populate activity tab times
        safeSetText(createdTime, formatLastLogin(user.created_at), '.profile-created-time');
        safeSetText(lastLoginTime, formatLastLogin(user.last_login), '.profile-last-login-time');
        
        // Update timestamp
        safeSetText(updateTime, new Date().toLocaleString(), '.profile-update-time');
        
        // Populate permissions tab
        populatePermissionsTab(profileModal, user.permissions);
    }
    
    // Populate permissions tab with interactive toggles
    function populatePermissionsTab(profileModal, permissions) {
        const permissionsGrid = profileModal.querySelector('.profile-permissions-grid');
        
        // Check if permissions grid exists
        if (!permissionsGrid) {
            console.warn('Permissions grid not found in profile modal');
            return;
        }
        
        const permissionsList = [
            {
                key: 'can_create_users',
                name: 'Create Users',
                description: 'Can create new admin users within their scope',
                icon: 'fas fa-user-plus'
            },
            {
                key: 'can_manage_users',
                name: 'Manage Users',
                description: 'Can edit, deactivate, and manage admin users',
                icon: 'fas fa-users-cog'
            },
            {
                key: 'can_set_deadlines',
                name: 'Set Deadlines',
                description: 'Can set and modify form submission deadlines',
                icon: 'fas fa-calendar-alt'
            },
            {
                key: 'can_approve_submissions',
                name: 'Approve Submissions',
                description: 'Can review, approve, or reject form submissions',
                icon: 'fas fa-check-circle'
            },
            {
                key: 'can_view_system_logs',
                name: 'View System Logs',
                description: 'Can access system activity and audit logs',
                icon: 'fas fa-history'
            }
        ];
        
        permissionsGrid.innerHTML = permissionsList.map(permission => `
            <div class="permission-card">
                <div class="permission-header">
                    <div class="permission-icon">
                        <i class="${permission.icon}"></i>
                    </div>
                    <div class="permission-info">
                        <h4>${permission.name}</h4>
                        <p>${permission.description}</p>
                    </div>
                </div>
                <div class="permission-status">
                    <div class="permission-toggle ${permissions && permissions[permission.key] ? 'active' : ''}" 
                         data-permission="${permission.key}"></div>
                    <span class="permission-label">
                        ${permissions && permissions[permission.key] ? 'Granted' : 'Denied'}
                    </span>
                </div>
            </div>
        `).join('');
        
        // Add click handlers for permission toggles (read-only for now)
        permissionsGrid.querySelectorAll('.permission-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                showNotification('Permission changes require admin approval', 'info');
            });
        });
    }
    
    // Toggle edit mode for profile sections
    window.toggleEditMode = function(section) {
        const profileModal = document.getElementById('profileModal');
        const sectionCard = profileModal.querySelector(`[onclick="toggleEditMode('${section}')"]`).closest('.profile-detail-card');
        
        const isEditMode = sectionCard.classList.contains('profile-edit-mode');
        
        if (isEditMode) {
            // Save changes
            sectionCard.classList.remove('profile-edit-mode');
            sectionCard.querySelector('.detail-card-action').innerHTML = '<i class="fas fa-edit"></i> Edit';
            showNotification('Changes saved successfully', 'success');
        } else {
            // Enter edit mode
            sectionCard.classList.add('profile-edit-mode');
            sectionCard.querySelector('.detail-card-action').innerHTML = '<i class="fas fa-save"></i> Save';
            
            // Copy values to input fields
            const detailRows = sectionCard.querySelectorAll('.detail-row');
            detailRows.forEach(row => {
                const valueElement = row.querySelector('.detail-value');
                const inputElement = row.querySelector('.detail-input');
                if (valueElement && inputElement) {
                    inputElement.value = valueElement.textContent;
                }
            });
        }
    };
    
    // Security action functions
    window.resetUserPassword = function() {
        showNotification('Password reset initiated', 'info');
    };
    
    window.forcePasswordChange = function() {
        showNotification('User will be required to change password on next login', 'info');
    };
    
    window.suspendAccount = function() {
        if (confirm('Are you sure you want to suspend this account?')) {
            showNotification('Account suspended successfully', 'success');
        }
    };
    
    window.deactivateAccount = function() {
        if (confirm('Are you sure you want to deactivate this account? This action cannot be undone.')) {
            showNotification('Account deactivated successfully', 'success');
        }
    };
    
    window.editUser = function(userId) {
        if (userId) {
            // Called from table action button
            viewUserProfile(userId, true); // Pass true to indicate edit mode
        } else {
            // Called from profile modal
            const profileModal = document.getElementById('profileModal');
            if (profileModal) {
                const userData = profileModal.userData; // Store user data on modal
                closeProfileModal();
                setTimeout(() => showUserEditModal(userData), 100);
            }
        }
    };
    
    // Close profile modal
    window.closeProfileModal = function() {
        const profileModal = document.getElementById('profileModal');
        if (profileModal) {
            profileModal.classList.remove('active');
        }
    };
    
    // Show user edit modal with same design as profile modal
    function showUserEditModal(user) {
        console.log('Opening edit modal for user:', user);
        
        // Create or get edit modal
        let editModal = document.getElementById('editUserModal');
        if (!editModal) {
            console.log('Creating new edit modal');
            editModal = createUserEditModal();
            document.body.appendChild(editModal);
        } else {
            console.log('Using existing edit modal');
        }
        
        // Verify modal was created properly
        if (!editModal) {
            console.error('Failed to create edit modal');
            showError('Failed to create edit modal');
            return;
        }
        
        // Store user data and populate form
        editModal.userData = user;
        updateUserEditForm(editModal, user);
        
        // Show modal
        editModal.classList.add('active');
    }
    
    // Close edit modal
    window.closeEditModal = function() {
        const editModal = document.getElementById('editUserModal');
        if (editModal) {
            editModal.classList.remove('active');
        }
    };
    
    // Create user edit modal with same design as profile modal
    function createUserEditModal() {
        const modal = document.createElement('div');
        modal.id = 'editUserModal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content profile-modal-content">
                <!-- Profile Cover and Header -->
                <div class="profile-cover">
                    <div class="profile-cover-pattern"></div>
                </div>
                
                    <div class="profile-header">
                    <div class="profile-avatar-container">
                        <div class="profile-avatar edit-avatar"></div>
                        <div class="profile-status-indicator"></div>
                    </div>
                    
                        <div class="profile-info">
                        <h1 class="profile-name edit-name"></h1>
                        <div class="profile-title edit-title">Edit User Profile</div>
                        <div class="profile-username edit-username"></div>
                        
                        <div class="profile-quick-stats">
                            <div class="profile-stat">
                                <span class="profile-stat-value">Edit</span>
                                <span class="profile-stat-label">Mode</span>
                            </div>
                            <div class="profile-stat">
                                <span class="profile-stat-value edit-permission-count">0</span>
                                <span class="profile-stat-label">Permissions</span>
                            </div>
                            <div class="profile-stat">
                                <span class="profile-stat-value">Active</span>
                                <span class="profile-stat-label">Session</span>
                            </div>
                        </div>
                    </div>
                    
                    <button class="close-btn" onclick="closeEditModal()" title="Close Editor">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <!-- Edit Form Content -->
                <div class="profile-content">
                    <!-- Navigation Tabs -->
                    <nav class="profile-nav">
                        <button class="profile-nav-item active" data-tab="personal">
                            <i class="fas fa-user"></i>
                            <span>Personal Info</span>
                        </button>
                        <button class="profile-nav-item" data-tab="assignment">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>Assignment</span>
                        </button>
                        <button class="profile-nav-item" data-tab="permissions">
                            <i class="fas fa-shield-alt"></i>
                            <span>Permissions</span>
                        </button>
                        <button class="profile-nav-item" data-tab="security">
                            <i class="fas fa-lock"></i>
                            <span>Security</span>
                        </button>
                    </nav>
                    
                    <form id="editUserForm" novalidate>
                        <!-- Tab Content: Personal Info -->
                        <div class="profile-tab-content active" id="personal-tab">
                    <div class="profile-details">
                                <div class="profile-detail-card">
                                    <div class="detail-card-header">
                                        <h3 class="detail-card-title">
                                            <i class="fas fa-id-card"></i>
                                            Personal Information
                                        </h3>
                                    </div>
                                    
                            <div class="detail-row">
                                        <div class="detail-label">
                                            <i class="fas fa-user"></i>
                                            Full Name <span class="required">*</span>
                            </div>
                                        <div class="input-wrapper">
                                            <input type="text" id="editFullName" name="full_name" required 
                                                   class="detail-input-edit" placeholder="Enter full name">
                                        </div>
                                    </div>
                                    
                            <div class="detail-row">
                                        <div class="detail-label">
                                            <i class="fas fa-envelope"></i>
                                            Email Address <span class="required">*</span>
                            </div>
                                        <div class="input-wrapper">
                                            <input type="email" id="editEmail" name="email" required 
                                                   class="detail-input-edit" placeholder="Enter email address">
                                        </div>
                                    </div>
                                    
                            <div class="detail-row">
                                        <div class="detail-label">
                                            <i class="fas fa-at"></i>
                                            Username <span class="required">*</span>
                            </div>
                                        <div class="input-wrapper">
                                            <input type="text" id="editUsername" name="username" required 
                                                   class="detail-input-edit" placeholder="Enter username">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="profile-detail-card">
                                    <div class="detail-card-header">
                                        <h3 class="detail-card-title">
                                            <i class="fas fa-building"></i>
                                            Administrative Details
                                        </h3>
                                    </div>
                                    
                            <div class="detail-row">
                                        <div class="detail-label">
                                            <i class="fas fa-layer-group"></i>
                                            Admin Level <span class="required">*</span>
                            </div>
                                        <div class="input-wrapper">
                                            <select id="editAdminLevel" name="admin_level" required class="detail-input-edit">
                                                <option value="">Select Admin Level</option>
                                                <option value="central">Central Office</option>
                                                <option value="region">Region</option>
                                                <option value="division">Division</option>
                                                <option value="district">District</option>
                                                <option value="school">School</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                            <div class="detail-row">
                                        <div class="detail-label">
                                            <i class="fas fa-toggle-on"></i>
                                            Account Status
                                        </div>
                                        <div class="input-wrapper">
                                            <select id="editStatus" name="status" class="detail-input-edit">
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                                <option value="suspended">Suspended</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Tab Content: Assignment -->
                        <div class="profile-tab-content" id="assignment-tab">
                            <div class="profile-detail-card">
                                <div class="detail-card-header">
                                    <h3 class="detail-card-title">
                                        <i class="fas fa-map-marker-alt"></i>
                                        Geographic Assignment
                                    </h3>
                        </div>
                                
                                <div class="detail-row">
                                    <div class="detail-label">
                                        <i class="fas fa-map-marked-alt"></i>
                                        Region <span class="required" id="editRegionRequired" style="display: none;">*</span>
                                    </div>
                                    <div class="search-input-wrapper">
                                        <input type="text" id="editRegion" name="region_id" 
                                               placeholder="Search and select region..." 
                                               autocomplete="off"
                                               data-filter-type="region"
                                               class="detail-input-edit">
                                        <div class="input-icon">
                                            <i class="fas fa-map-marked-alt"></i>
                                        </div>
                                        <div class="search-clear-btn" style="display: none;">
                                            <i class="fas fa-times"></i>
                                        </div>
                                        <div class="search-results"></div>
                                    </div>
                                    <small class="form-hint">
                                        <i class="fas fa-info-circle"></i>
                                        Type to search for a region or click to see all available regions
                                    </small>
                                </div>
                                
                                <div class="detail-row">
                                    <div class="detail-label">
                                        <i class="fas fa-sitemap"></i>
                                        Division <span class="required" id="editDivisionRequired" style="display: none;">*</span>
                                    </div>
                                    <div class="search-input-wrapper">
                                        <input type="text" id="editDivision" name="division_id" 
                                               placeholder="Search and select division..." 
                                               autocomplete="off"
                                               disabled
                                               data-filter-type="division"
                                               class="detail-input-edit">
                                        <div class="input-icon">
                                            <i class="fas fa-sitemap"></i>
                                        </div>
                                        <div class="search-clear-btn" style="display: none;">
                                            <i class="fas fa-times"></i>
                                        </div>
                                        <div class="search-results"></div>
                                    </div>
                                    <small class="form-hint">
                                        <i class="fas fa-info-circle"></i>
                                        Select a region first to search available divisions
                                    </small>
                                </div>
                                
                                <div class="detail-row">
                                    <div class="detail-label">
                                        <i class="fas fa-map"></i>
                                        District <span class="required" id="editDistrictRequired" style="display: none;">*</span>
                                    </div>
                                    <div class="search-input-wrapper">
                                        <input type="text" id="editDistrict" name="district_id" 
                                               placeholder="Search and select district..." 
                                               autocomplete="off"
                                               disabled
                                               data-filter-type="district"
                                               class="detail-input-edit">
                                        <div class="input-icon">
                                            <i class="fas fa-map"></i>
                                        </div>
                                        <div class="search-clear-btn" style="display: none;">
                                            <i class="fas fa-times"></i>
                                        </div>
                                        <div class="search-results"></div>
                                    </div>
                                    <small class="form-hint">
                                        <i class="fas fa-info-circle"></i>
                                        Select a division first to search available districts
                                    </small>
                                </div>
                                
                                <div class="detail-row">
                                    <div class="detail-label">
                                        <i class="fas fa-school"></i>
                                        School <span class="required" id="editSchoolRequired" style="display: none;">*</span>
                                    </div>
                                    <div class="search-input-wrapper">
                                        <input type="text" id="editSchool" name="school_id" 
                                               placeholder="Search and select school..." 
                                               autocomplete="off"
                                               disabled
                                               data-filter-type="school"
                                               class="detail-input-edit">
                                        <div class="input-icon">
                                            <i class="fas fa-school"></i>
                                        </div>
                                        <div class="search-clear-btn" style="display: none;">
                                            <i class="fas fa-times"></i>
                                        </div>
                                        <div class="search-results"></div>
                                    </div>
                                    <small class="form-hint">
                                        <i class="fas fa-info-circle"></i>
                                        Select a district first to search available schools
                                    </small>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Tab Content: Permissions -->
                        <div class="profile-tab-content" id="permissions-tab">
                            <div class="profile-permissions-grid edit-permissions-grid">
                                <!-- Permissions will be populated dynamically -->
                            </div>
                        </div>
                        
                        <!-- Tab Content: Security -->
                        <div class="profile-tab-content" id="security-tab">
                            <div class="security-card">
                                <div class="security-header">
                                    <div class="security-icon">
                                        <i class="fas fa-key"></i>
                                    </div>
                                    <div class="security-info">
                                        <h3>Password Management</h3>
                                        <p>Update password settings for this user account.</p>
                                    </div>
                                </div>
                                <div class="security-actions">
                                    <button type="button" class="security-btn secondary" onclick="generateNewPassword()">
                                        <i class="fas fa-dice"></i>
                                        Generate New Password
                                    </button>
                                    <button type="button" class="security-btn primary" onclick="togglePasswordField()">
                                        <i class="fas fa-edit"></i>
                                        Set Custom Password
                                    </button>
                                </div>
                                
                                <div id="customPasswordField" style="display: none; margin-top: 1rem;">
                                    <div class="detail-row">
                                        <div class="detail-label">
                                            <i class="fas fa-lock"></i>
                                            New Password
                                        </div>
                                        <div class="input-wrapper">
                                            <input type="password" id="editPassword" name="password" 
                                                   class="detail-input-edit" placeholder="Enter new password">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                
                <!-- Edit Actions -->
                <div class="profile-actions">
                    <div class="profile-actions-left">
                        <span class="profile-last-updated">Editing: <span class="edit-user-name"></span></span>
                    </div>
                    <div class="profile-actions-right">
                        <button class="profile-action-btn outline" onclick="closeEditModal()">
                            <i class="fas fa-times"></i>
                            Cancel
                        </button>
                        <button class="profile-action-btn primary" onclick="saveUserChanges()">
                            <i class="fas fa-save"></i>
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeEditModal();
            }
        });
        
        // Add tab functionality
        const tabButtons = modal.querySelectorAll('.profile-nav-item');
        const tabContents = modal.querySelectorAll('.profile-tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                
                // Remove active class from all tabs and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                button.classList.add('active');
                const targetContent = modal.querySelector(`#${tabName}-tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
        
        // Initialize search functionality for geographic inputs
        initializeEditModalSearchInputs(modal);
        
        // Add admin level change listener
        const adminLevelSelect = modal.querySelector('#editAdminLevel');
        if (adminLevelSelect) {
            adminLevelSelect.addEventListener('change', function() {
                updateGeographicFieldsForAdminLevel(modal, this.value);
            });
        }
        
        return modal;
    }
    
    // Initialize search inputs for edit modal
    function initializeEditModalSearchInputs(modal) {
        const searchInputs = modal.querySelectorAll('[data-filter-type]');
        
        searchInputs.forEach(input => {
            const filterType = input.getAttribute('data-filter-type');
            initializeSearchInput(input, filterType);
        });
        
        // Set up hierarchical dependencies for edit modal
        const regionInput = modal.querySelector('#editRegion');
        const divisionInput = modal.querySelector('#editDivision');
        const districtInput = modal.querySelector('#editDistrict');
        const schoolInput = modal.querySelector('#editSchool');
        
        // Region change handler
        if (regionInput) {
            regionInput.addEventListener('selectionChange', function() {
                const selectedValue = this._selectedValue;
                
                // Reset and disable dependent inputs
                [divisionInput, districtInput, schoolInput].forEach(input => {
                    if (input) {
                        clearSearchInput(input);
                    }
                });
                
                // Enable division if region is selected
                if (selectedValue && divisionInput) {
                    divisionInput.disabled = false;
                }
            });
        }
        
        // Division change handler
        if (divisionInput) {
            divisionInput.addEventListener('selectionChange', function() {
                const selectedValue = this._selectedValue;
                
                // Reset and disable dependent inputs
                [districtInput, schoolInput].forEach(input => {
                    if (input) {
                        clearSearchInput(input);
                    }
                });
                
                // Enable district if division is selected
                if (selectedValue && districtInput) {
                    districtInput.disabled = false;
                }
            });
        }
        
        // District change handler
        if (districtInput) {
            districtInput.addEventListener('selectionChange', function() {
                const selectedValue = this._selectedValue;
                
                // Reset school input
                if (schoolInput) {
                    clearSearchInput(schoolInput);
                }
                
                // Enable school if district is selected
                if (selectedValue && schoolInput) {
                    schoolInput.disabled = false;
                }
            });
        }
    }
    
    // Update geographic fields based on admin level selection
    function updateGeographicFieldsForAdminLevel(modal, adminLevel) {
        const regionInput = modal.querySelector('#editRegion');
        const divisionInput = modal.querySelector('#editDivision');
        const districtInput = modal.querySelector('#editDistrict');
        const schoolInput = modal.querySelector('#editSchool');
        
        const regionRequired = modal.querySelector('#editRegionRequired');
        const divisionRequired = modal.querySelector('#editDivisionRequired');
        const districtRequired = modal.querySelector('#editDistrictRequired');
        const schoolRequired = modal.querySelector('#editSchoolRequired');
        
        // Define what fields are available and required for each admin level
        const adminLevelConfig = {
            'central': {
                available: ['region', 'division', 'district', 'school'],
                required: ['region']
            },
            'region': {
                available: ['division', 'district', 'school'],
                required: ['division']
            },
            'division': {
                available: ['district', 'school'],
                required: ['district']
            },
            'district': {
                available: ['school'],
                required: ['school']
            },
            'school': {
                available: [],
                required: []
            }
        };
        
        const config = adminLevelConfig[adminLevel] || { available: [], required: [] };
        
        // Clear all fields first
        [regionInput, divisionInput, districtInput, schoolInput].forEach(input => {
            if (input) {
                clearSearchInput(input);
                input.disabled = true;
            }
        });
        
        // Hide all required indicators first
        [regionRequired, divisionRequired, districtRequired, schoolRequired].forEach(indicator => {
            if (indicator) {
                indicator.style.display = 'none';
            }
        });
        
        // Enable and set required fields based on admin level
        if (config.available.includes('region') && regionInput) {
            regionInput.disabled = false;
            if (config.required.includes('region') && regionRequired) {
                regionRequired.style.display = 'inline';
            }
        }
        
        if (config.available.includes('division') && divisionInput) {
            // Division is enabled only if region is selected (for central) or immediately (for region admin)
            if (adminLevel === 'region') {
                divisionInput.disabled = false;
            }
            if (config.required.includes('division') && divisionRequired) {
                divisionRequired.style.display = 'inline';
            }
        }
        
        if (config.available.includes('district') && districtInput) {
            // District is enabled based on admin level
            if (adminLevel === 'division') {
                districtInput.disabled = false;
            }
            if (config.required.includes('district') && districtRequired) {
                districtRequired.style.display = 'inline';
            }
        }
        
        if (config.available.includes('school') && schoolInput) {
            // School is enabled based on admin level
            if (adminLevel === 'district') {
                schoolInput.disabled = false;
            }
            if (config.required.includes('school') && schoolRequired) {
                schoolRequired.style.display = 'inline';
            }
        }
        
        // Show notification about the assignment scope
        const scopeMessages = {
            'central': 'Can assign users to any region, division, district, or school',
            'region': 'Can assign users to divisions, districts, or schools within your region',
            'division': 'Can assign users to districts or schools within your division',
            'district': 'Can assign users to schools within your district',
            'school': 'Cannot create sub-assignments (school-level admin)'
        };
        
        if (scopeMessages[adminLevel]) {
            showNotification(scopeMessages[adminLevel], 'info');
        }
    }

    // Update edit form with user data
    function updateUserEditForm(editModal, user) {
        console.log('Updating edit form for user:', user);
        
        // Helper function to safely set input values
        function safeSetValue(selector, value, elementName) {
            const element = editModal.querySelector(selector);
            if (element) {
                element.value = value || '';
            } else {
                console.warn(`Edit form element not found: ${elementName}`);
            }
        }
        
        // Helper function to safely set text content
        function safeSetText(selector, text, elementName) {
            const element = editModal.querySelector(selector);
            if (element) {
                element.textContent = text;
            } else {
                console.warn(`Edit form element not found: ${elementName}`);
            }
        }
        
        // Update header information
        safeSetText('.edit-avatar', getInitials(user.full_name), '.edit-avatar');
        safeSetText('.edit-name', user.full_name, '.edit-name');
        safeSetText('.edit-username', `@${user.username}`, '.edit-username');
        safeSetText('.edit-user-name', user.full_name, '.edit-user-name');
        
        // Set status indicator
        const statusIndicator = editModal.querySelector('.profile-status-indicator');
        if (statusIndicator) {
            statusIndicator.className = `profile-status-indicator ${user.status}`;
        }
        
        // Update permission count
        let permissionsGranted = 0;
        if (user.permissions) {
            permissionsGranted = Object.values(user.permissions).filter(Boolean).length;
        }
        safeSetText('.edit-permission-count', permissionsGranted, '.edit-permission-count');
        
        // Populate form fields
        safeSetValue('#editFullName', user.full_name, 'Full Name');
        safeSetValue('#editEmail', user.email, 'Email');
        safeSetValue('#editUsername', user.username, 'Username');
        safeSetValue('#editAdminLevel', user.admin_level, 'Admin Level');
        safeSetValue('#editStatus', user.status, 'Status');
        
        // Populate geographic assignment fields with search functionality
        populateEditGeographicFields(editModal, user);
        
        // Populate permissions
        populateEditPermissions(editModal, user.permissions);
    }
    
    // Populate geographic fields for edit modal
    function populateEditGeographicFields(editModal, user) {
        const regionInput = editModal.querySelector('#editRegion');
        const divisionInput = editModal.querySelector('#editDivision');
        const districtInput = editModal.querySelector('#editDistrict');
        const schoolInput = editModal.querySelector('#editSchool');
        
        // Helper function to set search input value
        function setSearchInputValue(input, value, text) {
            if (input && value && text) {
                input.value = text;
                input._selectedValue = value;
                input._selectedText = text;
                
                const clearBtn = input.closest('.search-input-wrapper')?.querySelector('.search-clear-btn');
                if (clearBtn) {
                    clearBtn.style.display = 'flex';
                }
                
                // Trigger selection change event
                const event = new CustomEvent('selectionChange');
                input.dispatchEvent(event);
            }
        }
        
        // Set values based on user data (assuming you have the actual data)
        // For now, using simple text values - you may need to adjust based on your data structure
        if (user.region) {
            setSearchInputValue(regionInput, user.region_id || user.region, user.region);
        }
        
        if (user.division) {
            // Enable division input first
            if (divisionInput) {
                divisionInput.disabled = false;
                setSearchInputValue(divisionInput, user.division_id || user.division, user.division);
            }
        }
        
        if (user.district) {
            // Enable district input first
            if (districtInput) {
                districtInput.disabled = false;
                setSearchInputValue(districtInput, user.district_id || user.district, user.district);
            }
        }
        
        if (user.school) {
            // Enable school input first
            if (schoolInput) {
                schoolInput.disabled = false;
                setSearchInputValue(schoolInput, user.school_id || user.school, user.school);
            }
        }
    }
    
    // Populate edit permissions with interactive toggles
    function populateEditPermissions(editModal, permissions) {
        const permissionsGrid = editModal.querySelector('.edit-permissions-grid');
        
        if (!permissionsGrid) {
            console.warn('Edit permissions grid not found');
            return;
        }
        
        const permissionsList = [
            {
                key: 'can_create_users',
                name: 'Create Users',
                description: 'Can create new admin users within their scope',
                icon: 'fas fa-user-plus'
            },
            {
                key: 'can_manage_users',
                name: 'Manage Users',
                description: 'Can edit, deactivate, and manage admin users',
                icon: 'fas fa-users-cog'
            },
            {
                key: 'can_set_deadlines',
                name: 'Set Deadlines',
                description: 'Can set and modify form submission deadlines',
                icon: 'fas fa-calendar-alt'
            },
            {
                key: 'can_approve_submissions',
                name: 'Approve Submissions',
                description: 'Can review, approve, or reject form submissions',
                icon: 'fas fa-check-circle'
            },
            {
                key: 'can_view_system_logs',
                name: 'View System Logs',
                description: 'Can access system activity and audit logs',
                icon: 'fas fa-history'
            }
        ];
        
        permissionsGrid.innerHTML = permissionsList.map(permission => `
            <div class="permission-card ${permissions && permissions[permission.key] ? 'selected' : ''}" 
                 data-permission="${permission.key}">
                <div class="permission-header">
                    <div class="permission-icon">
                        <i class="${permission.icon}"></i>
                    </div>
                    <div class="permission-info">
                        <h4>${permission.name}</h4>
                        <p>${permission.description}</p>
                    </div>
                </div>
                <div class="permission-status">
                    <div class="permission-toggle ${permissions && permissions[permission.key] ? 'active' : ''}" 
                         data-permission="${permission.key}"></div>
                    <span class="permission-label">
                        ${permissions && permissions[permission.key] ? 'Granted' : 'Denied'}
                    </span>
                </div>
            </div>
        `).join('');
        
        // Add click handlers for permission toggles
        permissionsGrid.querySelectorAll('.permission-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const permissionKey = card.getAttribute('data-permission');
                const toggle = card.querySelector('.permission-toggle');
                const label = card.querySelector('.permission-label');
                
                // Toggle the permission
                const isActive = toggle.classList.contains('active');
                
                if (isActive) {
                    toggle.classList.remove('active');
                    card.classList.remove('selected');
                    label.textContent = 'Denied';
                } else {
                    toggle.classList.add('active');
                    card.classList.add('selected');
                    label.textContent = 'Granted';
                }
                
                // Update the permission count
                const activePermissions = permissionsGrid.querySelectorAll('.permission-toggle.active').length;
                const countElement = editModal.querySelector('.edit-permission-count');
                if (countElement) {
                    countElement.textContent = activePermissions;
                }
            });
        });
    }
    
    // Security functions for edit modal
    window.generateNewPassword = function() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        const passwordField = document.getElementById('editPassword');
        if (passwordField) {
            passwordField.value = password;
            passwordField.type = 'text'; // Show generated password
            showNotification('New password generated', 'success');
            
            // Hide password after 3 seconds
            setTimeout(() => {
                passwordField.type = 'password';
            }, 3000);
        }
    };
    
    window.togglePasswordField = function() {
        const passwordField = document.getElementById('customPasswordField');
        if (passwordField) {
            const isVisible = passwordField.style.display !== 'none';
            passwordField.style.display = isVisible ? 'none' : 'block';
        }
    };
    
    // Save user changes
    window.saveUserChanges = async function() {
        const editModal = document.getElementById('editUserModal');
        if (!editModal || !editModal.userData) {
            showError('No user data to save');
            return;
        }
        
        const form = editModal.querySelector('#editUserForm');
        const formData = new FormData(form);
        
        // Collect permissions
        const permissions = {};
        editModal.querySelectorAll('.permission-toggle').forEach(toggle => {
            const key = toggle.getAttribute('data-permission');
            permissions[key] = toggle.classList.contains('active');
        });
        
        // Add permissions to form data
        formData.append('permissions', JSON.stringify(permissions));
        
        try {
            // Show loading state
            const saveButton = editModal.querySelector('.profile-action-btn.primary');
            const originalText = saveButton.innerHTML;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            saveButton.disabled = true;
            
            // Make API call to save changes
            const response = await fetch(`${API_ENDPOINTS.EDIT_USER}${editModal.userData.admin_id}/`, {
                method: 'PUT',
                body: formData,
                headers: {
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification('User updated successfully', 'success');
                closeEditModal();
                // Refresh the user table
                if (typeof loadUsers === 'function') {
                    loadUsers();
                }
            } else {
                showError('Failed to update user: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving user changes:', error);
            showError('Error saving changes. Please try again.');
        } finally {
            // Restore button state
            const saveButton = editModal.querySelector('.profile-action-btn.primary');
            if (saveButton) {
                saveButton.innerHTML = originalText;
                saveButton.disabled = false;
            }
        }
    };
    
    // Enhanced multi-step form functions
    function nextStep() {
        if (validateCurrentStep()) {
            if (currentStep < maxSteps) {
                // Mark current step as completed
                markStepCompleted(currentStep);
                
                currentStep++;
                showStep(currentStep);
                updateFormNavigation();
                updateStepProgress();
                
                // Focus first input in new step
                const currentStepElement = document.getElementById(`step${currentStep}`);
                const firstInput = currentStepElement?.querySelector('input, select');
                if (firstInput) {
                    setTimeout(() => firstInput.focus(), 300);
                }
            }
        } else {
            showValidationSummary();
        }
    }
    
    function prevStep() {
        if (currentStep > 1) {
            currentStep--;
            showStep(currentStep);
            updateFormNavigation();
            updateStepProgress();
            
            // Focus first input in previous step
            const currentStepElement = document.getElementById(`step${currentStep}`);
            const firstInput = currentStepElement?.querySelector('input, select');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 300);
            }
        }
    }
    
    // Mark step as completed
    function markStepCompleted(step) {
        const stepElement = document.querySelector(`[data-step="${step}"]`);
        if (stepElement) {
            stepElement.classList.add('completed');
        }
    }
    
    // Update step progress indicator
    function updateStepProgress() {
        const progressFill = document.querySelector('.step-progress-fill');
        const currentStepNumber = document.getElementById('currentStepNumber');
        
        if (progressFill) {
            const progress = (currentStep / maxSteps) * 100;
            progressFill.style.width = `${progress}%`;
        }
        
        if (currentStepNumber) {
            currentStepNumber.textContent = currentStep;
        }
    }
    
    // Show validation summary
    function showValidationSummary() {
        const validationSummary = document.getElementById('validationSummary');
        const validationErrorsList = document.getElementById('validationErrorsList');
        
        if (!validationSummary || !validationErrorsList) return;
        
        // Collect all validation errors
        const errors = [];
        const errorFields = document.querySelectorAll('.error');
        
        errorFields.forEach(field => {
            const errorDiv = field.parentNode.querySelector('.field-error');
            if (errorDiv) {
                const label = field.closest('.form-group')?.querySelector('label')?.textContent || 'Field';
                errors.push(`${label}: ${errorDiv.textContent}`);
            }
        });
        
        if (errors.length > 0) {
            validationErrorsList.innerHTML = errors.map(error => `<li>${error}</li>`).join('');
            validationSummary.style.display = 'block';
            
            // Scroll to validation summary
            validationSummary.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    function showStep(step) {
        // Hide all steps
        formSteps.forEach(stepElement => {
            stepElement.classList.remove('active');
        });
        
        // Show current step
        const currentStepElement = document.getElementById(`step${step}`);
        if (currentStepElement) {
            currentStepElement.classList.add('active');
        }
        
        // Update progress indicators
        progressSteps.forEach((progressStep, index) => {
            const stepNumber = index + 1;
            progressStep.classList.remove('active', 'completed');
            
            if (stepNumber === step) {
                progressStep.classList.add('active');
            } else if (stepNumber < step) {
                progressStep.classList.add('completed');
            }
        });
    }
    
    function updateFormNavigation() {
        // Show/hide navigation buttons
        prevBtn.style.display = currentStep === 1 ? 'none' : 'inline-flex';
        nextBtn.style.display = currentStep === maxSteps ? 'none' : 'inline-flex';
        saveUserBtn.style.display = currentStep === maxSteps ? 'inline-flex' : 'none';
        
        // Update button text based on step
        if (currentStep === maxSteps) {
            saveUserBtn.innerHTML = '<i class="fas fa-save"></i> Create Admin User';
        }
    }
    
    function validateCurrentStep() {
        clearValidationErrors();
        let isValid = true;
        
        switch (currentStep) {
            case 1:
                // Validate basic information
                const basicFields = ['fullName', 'username', 'email', 'adminLevel', 'password'];
                basicFields.forEach(fieldId => {
                    const field = document.getElementById(fieldId);
                    if (!field.value.trim()) {
                        showFieldError(field, `${fieldId.replace(/([A-Z])/g, ' $1').toLowerCase()} is required`);
                        isValid = false;
                    }
                });
                
                // Email format validation
                if (emailInput.value && !validateEmailFormatByLevel()) {
                    showFieldError(emailInput, 'Invalid email format for selected admin level');
                    isValid = false;
                }
                
                // Password strength validation
                if (passwordInput.value && !validatePasswordStrength(passwordInput.value)) {
                    showFieldError(passwordInput, 'Password does not meet strength requirements');
                    isValid = false;
                }
                break;
                
            case 2:
                // Validate geographic assignment
                if (!validateGeographicAssignment()) {
                    isValid = false;
                }
                updateAssignmentPreview();
                break;
                
            case 3:
                // Update permission summary
                updatePermissionSummary();
                break;
        }
        
        return isValid;
    }
    
    function updateAssignmentPreview() {
        const adminLevel = adminLevelSelect.value;
        const regionName = regionInput._selectedText || 'Not selected';
        const divisionName = divisionInput._selectedText || 'Not selected';
        const districtName = districtInput._selectedText || 'Not selected';
        
        // For school level admins, get school info from email field
        const emailPartInput = document.getElementById('emailPart');
        const schoolName = (adminLevel === 'school' && emailPartInput?.dataset.schoolName) 
            ? emailPartInput.dataset.schoolName 
            : 'Not selected';
        const schoolId = (adminLevel === 'school' && emailPartInput?.dataset.schoolId) 
            ? emailPartInput.dataset.schoolId 
            : null;
        
        let coverage = '';
        let accessLevel = '';
        
        switch (adminLevel) {
            case 'central':
                coverage = 'Nationwide - All regions, divisions, districts, and schools';
                accessLevel = 'Full system access';
                break;
            case 'region':
                coverage = regionInput._selectedValue ? `Region: ${regionName}` : 'No region assigned';
                accessLevel = 'Regional access - All divisions, districts, and schools within region';
                break;
            case 'division':
                coverage = divisionInput._selectedValue ? `Division: ${divisionName} (${regionName})` : 'No division assigned';
                accessLevel = 'Divisional access - All districts and schools within division';
                break;
            case 'district':
                coverage = districtInput._selectedValue ? `District: ${districtName} (${divisionName}, ${regionName})` : 'No district assigned';
                accessLevel = 'District access - All schools within district';
                break;
            case 'school':
                coverage = schoolId ? `School: ${schoolName} (Auto-assigned via School ID)` : 'No school assigned';
                accessLevel = 'School access - Single school only';
                break;
            default:
                coverage = 'No assignment';
                accessLevel = 'No access defined';
        }
        
        document.getElementById('coveragePreview').textContent = coverage;
        document.getElementById('accessPreview').textContent = accessLevel;
    }
    
    function updatePermissionSummary() {
        const selectedPermissions = [];
        const permissionNames = {
            canCreateUsers: 'Create Users',
            canManageUsers: 'Manage Users',
            canSetDeadlines: 'Set Deadlines',
            canApproveSubmissions: 'Approve Submissions',
            canViewSystemLogs: 'View System Logs'
        };
        
        Object.keys(permissionCheckboxes).forEach(key => {
            if (permissionCheckboxes[key] && permissionCheckboxes[key].checked) {
                selectedPermissions.push(permissionNames[key]);
            }
        });
        
        const permissionsText = selectedPermissions.length > 0 ? selectedPermissions.join(', ') : 'No permissions selected';
        const selectedPermissionsElement = document.getElementById('selectedPermissions');
        if (selectedPermissionsElement) {
            selectedPermissionsElement.textContent = permissionsText;
        }
        
        const adminLevel = adminLevelSelect.value;
        const scopeText = adminLevel ? `${adminLevel.charAt(0).toUpperCase() + adminLevel.slice(1)} level access` : 'No access level defined';
        document.getElementById('accessScope').textContent = scopeText;
    }
    
    function togglePasswordVisibility() {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        
        const icon = togglePasswordBtn.querySelector('i');
        icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    }
    
    function updatePasswordStrength() {
        const password = passwordInput.value;
        const strengthBar = document.querySelector('.strength-bar');
        const strengthText = document.querySelector('.strength-text');
        
        if (!password) {
            strengthBar.className = 'strength-bar';
            strengthText.textContent = 'Password strength';
            return;
        }
        
        let score = 0;
        let feedback = '';
        
        // Length check
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        
        // Character variety checks
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
        
        // Determine strength level
        if (score <= 2) {
            strengthBar.className = 'strength-bar weak';
            feedback = 'Weak password';
        } else if (score <= 3) {
            strengthBar.className = 'strength-bar fair';
            feedback = 'Fair password';
        } else if (score <= 4) {
            strengthBar.className = 'strength-bar good';
            feedback = 'Good password';
        } else {
            strengthBar.className = 'strength-bar strong';
            feedback = 'Strong password';
        }
        
        strengthText.textContent = feedback;
    }
    
    function updateRequirementText() {
        const adminLevel = adminLevelSelect.value;
        const requirementText = document.getElementById('requirementText');
        
        switch (adminLevel) {
            case 'central':
                requirementText.textContent = 'No geographic assignment required - has nationwide access';
                break;
            case 'region':
                requirementText.textContent = 'Must be assigned to a specific region';
                break;
            case 'division':
                requirementText.textContent = 'Must be assigned to a specific region and division';
                break;
            case 'district':
                requirementText.textContent = 'Must be assigned to region, division, and district';
                break;
            case 'school':
                requirementText.textContent = 'No geographic assignment required - school assignment handled through School ID verification';
                break;
            default:
                requirementText.textContent = 'Select admin level first';
        }
    }
    
    // Enhanced admin level change handler
    function handleAdminLevelChangeEnhanced() {
        handleAdminLevelChange(); // Call original function
        updateRequirementText();
        updateGeographicRequirements(adminLevelSelect.value);
    }
    
    // Update the event listener
    adminLevelSelect?.removeEventListener('change', handleAdminLevelChange);
    adminLevelSelect?.addEventListener('change', handleAdminLevelChangeEnhanced);
    
    // Bulk actions functionality
    function handleSelectAll() {
        const checkboxes = document.querySelectorAll('.user-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });
        updateBulkActions();
    }
    
    function updateBulkActions() {
        const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
        const hasSelection = checkedBoxes.length > 0;
        
        if (applyBulkActionBtn) {
            applyBulkActionBtn.disabled = !hasSelection || !bulkActionSelect.value;
        }
        
        // Update select all checkbox state
        const allCheckboxes = document.querySelectorAll('.user-checkbox');
        if (selectAllCheckbox && allCheckboxes.length > 0) {
            selectAllCheckbox.checked = checkedBoxes.length === allCheckboxes.length;
            selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < allCheckboxes.length;
        }
    }
    
    async function applyBulkAction() {
        const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
        const selectedUserIds = Array.from(checkedBoxes).map(cb => parseInt(cb.dataset.userId));
        const action = bulkActionSelect.value;
        
        if (!action || selectedUserIds.length === 0) {
            showError('Please select users and an action');
            return;
        }
        
        const actionText = bulkActionSelect.options[bulkActionSelect.selectedIndex].text;
        if (!confirm(`Are you sure you want to ${actionText.toLowerCase()} ${selectedUserIds.length} user(s)?`)) {
            return;
        }
        
        try {
            showLoading();
            
            const promises = selectedUserIds.map(async userId => {
                switch (action) {
                    case 'activate':
                        return fetch(`${API_ENDPOINTS.EDIT_USER}${userId}/`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': getCSRFToken()
                            },
                            body: JSON.stringify({ status: 'active' })
                        });
                    case 'deactivate':
                        return fetch(`${API_ENDPOINTS.EDIT_USER}${userId}/`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': getCSRFToken()
                            },
                            body: JSON.stringify({ status: 'inactive' })
                        });
                    case 'reset':
                        return fetch(API_ENDPOINTS.RESET_PASSWORD.replace('{id}', userId), {
                            method: 'POST',
                            headers: {
                                'X-CSRFToken': getCSRFToken()
                            }
                        });
                    default:
                        throw new Error('Unknown action');
                }
            });
            
            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.length - successful;
            
            if (successful > 0) {
                showSuccess(`Bulk action completed: ${successful} successful, ${failed} failed`);
                loadUsers(); // Refresh the user list
                
                // Reset bulk actions
                bulkActionSelect.value = '';
                selectAllCheckbox.checked = false;
                updateBulkActions();
            } else {
                showError('Bulk action failed for all selected users');
            }
        } catch (error) {
            console.error('Error applying bulk action:', error);
            showError('Failed to apply bulk action. Please try again.');
        } finally {
            hideLoading();
        }
    }
    
    // Add event listeners to checkboxes when rendering table
    function addCheckboxListeners() {
        const checkboxes = document.querySelectorAll('.user-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateBulkActions);
        });
    }
    
    // Simple geographic input clearing function
    function clearSimpleGeographicInputs() {
        const inputs = ['region', 'division', 'district', 'school'];
        inputs.forEach(type => {
            const input = document.getElementById(type);
            if (input) {
                input.value = '';
                input._selectedValue = null;
                input._selectedText = '';
                input.disabled = type === 'region' ? false : true;
                
                const wrapper = input.closest('.search-input-wrapper');
                const results = wrapper.querySelector('.search-results');
                const clearBtn = wrapper.querySelector('.search-clear-btn');
                
                if (results) results.innerHTML = '';
                if (clearBtn) clearBtn.style.display = 'none';
            }
        });
    }
});
