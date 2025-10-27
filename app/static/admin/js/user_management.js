// user-management.js
document.addEventListener('DOMContentLoaded', function() {
    // Sample user data
    const users = [
        { id: 1, name: "John Doe", email: "john.doe@example.com", role: "admin", status: "active", lastLogin: "Today, 09:24 AM" },
        { id: 2, name: "Alice Smith", email: "alice.s@example.com", role: "editor", status: "active", lastLogin: "Yesterday, 03:45 PM" },
        { id: 3, name: "Robert Johnson", email: "rob.j@example.com", role: "viewer", status: "inactive", lastLogin: "5 days ago" },
        { id: 4, name: "Maria Brown", email: "maria.b@example.com", role: "support", status: "suspended", lastLogin: "2 weeks ago" },
        { id: 5, name: "Thomas Wilson", email: "tom.w@example.com", role: "admin", status: "active", lastLogin: "Today, 11:30 AM" },
        { id: 6, name: "Emily Davis", email: "emily.d@example.com", role: "editor", status: "pending", lastLogin: "Never" },
        { id: 7, name: "Michael Taylor", email: "mike.t@example.com", role: "viewer", status: "active", lastLogin: "Yesterday, 05:12 PM" },
        { id: 8, name: "Sarah Martinez", email: "sarah.m@example.com", role: "support", status: "inactive", lastLogin: "1 week ago" },
        { id: 9, name: "David Anderson", email: "david.a@example.com", role: "admin", status: "suspended", lastLogin: "3 days ago" },
        { id: 10, name: "Jennifer Thomas", email: "jennifer.t@example.com", role: "editor", status: "active", lastLogin: "Today, 08:15 AM" }
    ];

    // DOM Elements
    const userTableBody = document.querySelector('.data-table tbody');
    const addUserBtn = document.getElementById('addUserBtn');
    const userModal = document.getElementById('userModal');
    const passwordModal = document.getElementById('passwordModal');
    const closeModal = document.getElementById('closeModal');
    const closePasswordModal = document.getElementById('closePasswordModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const cancelPassword = document.getElementById('cancelPassword');
    const userForm = document.getElementById('userForm');
    const generatePasswordBtn = document.getElementById('generatePassword');
    const copyPasswordBtn = document.getElementById('copyPassword');
    const roleFilter = document.getElementById('roleFilter');
    const statusFilter = document.getElementById('statusFilter');
    const userSearch = document.getElementById('userSearch');
    const resetFiltersBtn = document.getElementById('resetFilters');
    const selectAllCheckbox = document.getElementById('selectAll');
    const bulkActionSelect = document.getElementById('bulkActionSelect');
    const applyBulkActionBtn = document.getElementById('applyBulkAction');

    // Populate user table
    function renderUserTable(usersToRender) {
        userTableBody.innerHTML = '';
        
        usersToRender.forEach(user => {
            const row = document.createElement('tr');
            
            // Map status to badge class
            let statusClass = '';
            switch(user.status) {
                case 'active': statusClass = 'active'; break;
                case 'inactive': statusClass = 'inactive'; break;
                case 'suspended': statusClass = 'suspended'; break;
                case 'pending': statusClass = 'pending'; break;
            }
            
            // Get initials for avatar
            const nameParts = user.name.split(' ');
            const initials = nameParts[0].charAt(0) + (nameParts[1] ? nameParts[1].charAt(0) : '');
            
            row.innerHTML = `
                <td><input type="checkbox" class="user-checkbox" data-id="${user.id}"></td>
                <td>
                    <div class="user-cell">
                        <div class="avatar">${initials}</div>
                        <div class="user-info">
                            <div class="name">${user.name}</div>
                        </div>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</td>
                <td><span class="status-badge ${statusClass}">${user.status.charAt(0).toUpperCase() + user.status.slice(1)}</span></td>
                <td>${user.lastLogin}</td>
                <td>
                    <div class="action-buttons">
                        <button class="icon-btn edit" data-id="${user.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="icon-btn reset" data-id="${user.id}">
                            <i class="fas fa-key"></i>
                        </button>
                        <button class="icon-btn delete" data-id="${user.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            userTableBody.appendChild(row);
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll('.edit').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.id));
        });
        
        document.querySelectorAll('.reset').forEach(btn => {
            btn.addEventListener('click', () => openPasswordModal(btn.dataset.id));
        });
        
        document.querySelectorAll('.delete').forEach(btn => {
            btn.addEventListener('click', () => deleteUser(btn.dataset.id));
        });
        
        // Add event listeners to checkboxes
        document.querySelectorAll('.user-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', updateBulkActions);
        });
        
        // Update table info
        document.getElementById('startCount').textContent = 1;
        document.getElementById('endCount').textContent = usersToRender.length;
        document.getElementById('totalCount').textContent = users.length;
    }
    
    // Open modal for adding new user
    function openAddModal() {
        document.getElementById('modalTitle').textContent = 'Add New User';
        userForm.reset();
        document.getElementById('password').value = '';
        document.getElementById('password').required = true;
        
        // Clear any existing errors and validation states
        ['fullName', 'username', 'adminLevel', 'email', 'password'].forEach(fieldId => {
            hideError(fieldId);
            const field = document.getElementById(fieldId === 'email' ? 'emailPart' : fieldId);
            if (field) {
                field.classList.remove('error');
            }
        });
        
        // Initialize geographic fields to default state (hidden)
        updateGeographicFields('');
        
        userModal.classList.add('active');
    }
    
    // Open modal for editing user
    function openEditModal(userId) {
        const user = users.find(u => u.id == userId);
        if (user) {
            document.getElementById('modalTitle').textContent = 'Edit User';
            document.getElementById('fullName').value = user.name;
            document.getElementById('email').value = user.email;
            document.getElementById('username').value = user.email.split('@')[0];
            document.getElementById('role').value = user.role;
            document.getElementById('status').value = user.status;
            document.getElementById('password').required = false;
            document.getElementById('password').value = '';
            
            // Clear any existing errors and validation states
            ['fullName', 'username', 'adminLevel', 'email', 'password'].forEach(fieldId => {
                hideError(fieldId);
                const field = document.getElementById(fieldId === 'email' ? 'emailPart' : fieldId);
                if (field) {
                    field.classList.remove('error');
                }
            });
            
            // Initialize geographic fields based on user's admin level (if available)
            // For now, initialize to default state since we don't have admin level mapping in sample data
            updateGeographicFields('');
            
            userModal.classList.add('active');
        }
    }
    
    // Open password reset modal
    function openPasswordModal(userId) {
        const user = users.find(u => u.id == userId);
        if (user) {
            const nameParts = user.name.split(' ');
            const initials = nameParts[0].charAt(0) + (nameParts[1] ? nameParts[1].charAt(0) : '');
            
            document.querySelector('#passwordModal .avatar').textContent = initials;
            document.querySelector('#passwordModal .name').textContent = user.name;
            document.querySelector('#passwordModal .email').textContent = user.email;
            
            passwordModal.classList.add('active');
        }
    }
    
    // Close modals
    function closeModals() {
        userModal.classList.remove('active');
        passwordModal.classList.remove('active');
    }
    
    // Generate a random password
    function generatePassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        document.getElementById('password').value = password;
    }
    
    // Copy password to clipboard
    function copyPassword() {
        const passwordField = document.getElementById('newPassword');
        passwordField.select();
        document.execCommand('copy');
        
        // Show feedback
        const originalText = copyPasswordBtn.innerHTML;
        copyPasswordBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
            copyPasswordBtn.innerHTML = originalText;
        }, 2000);
    }
    
    // Filter users based on criteria
    function filterUsers() {
        const roleValue = roleFilter.value;
        const statusValue = statusFilter.value;
        const searchValue = userSearch.value.toLowerCase();
        
        const filteredUsers = users.filter(user => {
            // Role filter
            if (roleValue !== 'all' && user.role !== roleValue) return false;
            
            // Status filter
            if (statusValue !== 'all' && user.status !== statusValue) return false;
            
            // Search filter
            if (searchValue && 
                !user.name.toLowerCase().includes(searchValue) && 
                !user.email.toLowerCase().includes(searchValue)) {
                return false;
            }
            
            return true;
        });
        
        renderUserTable(filteredUsers);
    }
    
    // Reset filters
    function resetFilters() {
        roleFilter.value = 'all';
        statusFilter.value = 'all';
        userSearch.value = '';
        renderUserTable(users);
    }
    
    // Delete a user
    function deleteUser(userId) {
        if (confirm('Are you sure you want to delete this user?')) {
            // In a real app, you would make an API call here
            const index = users.findIndex(u => u.id == userId);
            if (index !== -1) {
                users.splice(index, 1);
                renderUserTable(users);
                alert('User deleted successfully!');
            }
        }
    }
    
    // Update bulk actions based on selected users
    function updateBulkActions() {
        const selectedCount = document.querySelectorAll('.user-checkbox:checked').length;
        applyBulkActionBtn.disabled = selectedCount === 0 || bulkActionSelect.value === '';
    }
    
    // Form validation functions
    function showError(fieldId, message) {
        const errorElement = document.getElementById(fieldId + 'Error');
        const inputElement = document.getElementById(fieldId);
        
        if (errorElement && inputElement) {
            errorElement.querySelector('.error-text').textContent = message;
            errorElement.style.display = 'flex';
            errorElement.classList.add('show');
            errorElement.classList.remove('hide');
            inputElement.classList.add('error');
        }
    }
    
    function hideError(fieldId) {
        const errorElement = document.getElementById(fieldId + 'Error');
        const inputElement = document.getElementById(fieldId);
        
        if (errorElement && inputElement) {
            errorElement.classList.remove('show');
            errorElement.classList.add('hide');
            inputElement.classList.remove('error');
            
            setTimeout(() => {
                if (errorElement.classList.contains('hide')) {
                    errorElement.style.display = 'none';
                    errorElement.classList.remove('hide');
                }
            }, 300);
        }
    }
    
    function validateFullName(value) {
        if (!value || value.trim().length === 0) {
            return 'Full name is required';
        }
        if (value.trim().length < 2) {
            return 'Full name must be at least 2 characters long';
        }
        if (value.trim().length > 100) {
            return 'Full name must not exceed 100 characters';
        }
        if (!/^[a-zA-Z\s\u00C0-\u017F.-]+$/.test(value.trim())) {
            return 'Full name can only contain letters, spaces, periods, and hyphens';
        }
        return null;
    }
    
    function validateUsername(value) {
        if (!value || value.trim().length === 0) {
            return 'Username is required';
        }
        if (value.length < 3) {
            return 'Username must be at least 3 characters long';
        }
        if (value.length > 50) {
            return 'Username must not exceed 50 characters';
        }
        if (!/^[a-z0-9_]+$/.test(value)) {
            return 'Username can only contain lowercase letters, numbers, and underscores';
        }
        return null;
    }
    
    function validateAdminLevel(value) {
        if (!value) {
            return 'Admin level is required';
        }
        const validLevels = ['central', 'region', 'division', 'district', 'school'];
        if (!validLevels.includes(value)) {
            return 'Please select a valid admin level';
        }
        return null;
    }
    
    function validateEmail(emailPart) {
        if (!emailPart || emailPart.trim().length === 0) {
            return 'Email is required';
        }
        if (emailPart.length < 3) {
            return 'Email part must be at least 3 characters long';
        }
        if (emailPart.length > 50) {
            return 'Email part must not exceed 50 characters';
        }
        // Basic email part validation (before @deped.gov.ph)
        if (!/^[a-z0-9._-]+$/.test(emailPart)) {
            return 'Email can only contain lowercase letters, numbers, periods, hyphens, and underscores';
        }
        return null;
    }
    
    function validatePassword(value) {
        if (!value || value.length === 0) {
            return 'Password is required';
        }
        if (value.length < 8) {
            return 'Password must be at least 8 characters long';
        }
        if (value.length > 128) {
            return 'Password must not exceed 128 characters';
        }
        if (!/(?=.*[a-z])/.test(value)) {
            return 'Password must contain at least one lowercase letter';
        }
        if (!/(?=.*[A-Z])/.test(value)) {
            return 'Password must contain at least one uppercase letter';
        }
        if (!/(?=.*\d)/.test(value)) {
            return 'Password must contain at least one number';
        }
        if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?])/.test(value)) {
            return 'Password must contain at least one special character';
        }
        return null;
    }
    
    function validateField(fieldId, validator) {
        const field = document.getElementById(fieldId);
        if (!field) return true;
        
        const value = fieldId === 'emailPart' ? field.value : field.value;
        const error = validator(value);
        
        if (error) {
            showError(fieldId === 'emailPart' ? 'email' : fieldId, error);
            return false;
        } else {
            hideError(fieldId === 'emailPart' ? 'email' : fieldId);
            return true;
        }
    }
    
    function validateForm() {
        const validations = [
            validateField('fullName', validateFullName),
            validateField('username', validateUsername),
            validateField('adminLevel', validateAdminLevel),
            validateField('emailPart', validateEmail),
            validateField('password', validatePassword)
        ];
        
        return validations.every(isValid => isValid);
    }
    
    // Geographic assignment field management
    function updateGeographicFields(adminLevel) {
        const geographicSection = document.getElementById('geographicSection');
        const assignmentInfo = document.getElementById('assignmentInfo');
        const requirementText = document.getElementById('requirementText');
        
        if (!geographicSection || !requirementText) return;
        
        // Hide geographic fields for central and school admin levels
        if (adminLevel === 'central' || adminLevel === 'school') {
            geographicSection.classList.add('geographic-section-hidden');
            geographicSection.classList.remove('geographic-section-visible');
            
            // Update requirement text based on admin level
            if (adminLevel === 'central') {
                requirementText.textContent = 'Central Office admin has nationwide access to all regions, divisions, and schools. No geographic assignment required.';
            } else if (adminLevel === 'school') {
                requirementText.textContent = 'School admin will be assigned to a specific school. Geographic assignment will be automatic based on school location.';
            }
        } else if (adminLevel === 'region' || adminLevel === 'division' || adminLevel === 'district') {
            // Show geographic fields for other admin levels
            geographicSection.classList.remove('geographic-section-hidden');
            geographicSection.classList.add('geographic-section-visible');
            
            // Reset all fields to default state
            const regionField = document.getElementById('region');
            const divisionField = document.getElementById('division');
            const districtField = document.getElementById('district');
            const regionRequired = document.getElementById('regionRequired');
            const divisionRequired = document.getElementById('divisionRequired');
            const districtRequired = document.getElementById('districtRequired');
            
            // Reset field values and states
            if (regionField) {
                regionField.value = '';
                regionField.disabled = false;
                regionField.placeholder = 'Search and select region...';
            }
            if (divisionField) {
                divisionField.value = '';
                divisionField.disabled = true;
                divisionField.placeholder = 'Select a region first to search available divisions';
            }
            if (districtField) {
                districtField.value = '';
                districtField.disabled = true;
                districtField.placeholder = 'Select a division first to search available districts';
            }
            
            // Hide all required indicators initially
            if (regionRequired) regionRequired.style.display = 'none';
            if (divisionRequired) divisionRequired.style.display = 'none';
            if (districtRequired) districtRequired.style.display = 'none';
            
            // Configure fields based on admin level
            switch(adminLevel) {
                case 'region':
                    if (regionRequired) regionRequired.style.display = 'inline';
                    requirementText.textContent = 'Select the region this admin will manage. They will have access to all divisions and schools within this region.';
                    break;
                    
                case 'division':
                    if (regionRequired) regionRequired.style.display = 'inline';
                    if (divisionRequired) divisionRequired.style.display = 'inline';
                    requirementText.textContent = 'Select the region first, then choose the specific division this admin will manage.';
                    break;
                    
                case 'district':
                    if (regionRequired) regionRequired.style.display = 'inline';
                    if (divisionRequired) divisionRequired.style.display = 'inline';
                    if (districtRequired) districtRequired.style.display = 'inline';
                    requirementText.textContent = 'Select region, division, then the specific district this admin will manage.';
                    break;
            }
        } else {
            // No admin level selected or invalid level
            geographicSection.classList.add('geographic-section-hidden');
            geographicSection.classList.remove('geographic-section-visible');
            requirementText.textContent = 'Select admin level first to see assignment requirements';
        }
    }

    // Apply bulk action
    function applyBulkAction() {
        const selectedUserIds = Array.from(document.querySelectorAll('.user-checkbox:checked'))
            .map(checkbox => parseInt(checkbox.dataset.id));
        
        if (selectedUserIds.length === 0) {
            alert('Please select at least one user');
            return;
        }
        
        const action = bulkActionSelect.value;
        
        switch(action) {
            case 'activate':
                users.forEach(user => {
                    if (selectedUserIds.includes(user.id)) {
                        user.status = 'active';
                    }
                });
                alert(`${selectedUserIds.length} users activated`);
                break;
                
            case 'deactivate':
                users.forEach(user => {
                    if (selectedUserIds.includes(user.id)) {
                        user.status = 'inactive';
                    }
                });
                alert(`${selectedUserIds.length} users deactivated`);
                break;
                
            case 'delete':
                if (confirm(`Are you sure you want to delete ${selectedUserIds.length} users?`)) {
                    // Filter out selected users
                    for (let i = users.length - 1; i >= 0; i--) {
                        if (selectedUserIds.includes(users[i].id)) {
                            users.splice(i, 1);
                        }
                    }
                    alert(`${selectedUserIds.length} users deleted`);
                }
                break;
                
            case 'reset':
                alert(`Password reset emails sent to ${selectedUserIds.length} users`);
                break;
        }
        
        // Reset selection
        document.querySelectorAll('.user-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        selectAllCheckbox.checked = false;
        bulkActionSelect.value = '';
        applyBulkActionBtn.disabled = true;
        
        renderUserTable(users);
    }
    
    // Initialize the page
    function init() {
        renderUserTable(users);
        
        // Event listeners
        addUserBtn.addEventListener('click', openAddModal);
        closeModal.addEventListener('click', closeModals);
        closePasswordModal.addEventListener('click', closeModals);
        cancelBtn.addEventListener('click', closeModals);
        cancelPassword.addEventListener('click', closeModals);
        generatePasswordBtn.addEventListener('click', generatePassword);
        copyPasswordBtn.addEventListener('click', copyPassword);
        
        roleFilter.addEventListener('change', filterUsers);
        statusFilter.addEventListener('change', filterUsers);
        userSearch.addEventListener('input', filterUsers);
        resetFiltersBtn.addEventListener('click', resetFilters);
        
        selectAllCheckbox.addEventListener('change', function() {
            document.querySelectorAll('.user-checkbox').forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            updateBulkActions();
        });
        
        bulkActionSelect.addEventListener('change', updateBulkActions);
        applyBulkActionBtn.addEventListener('click', applyBulkAction);
        
        // Add real-time validation event listeners
        const fullNameField = document.getElementById('fullName');
        const usernameField = document.getElementById('username');
        const adminLevelField = document.getElementById('adminLevel');
        const emailPartField = document.getElementById('emailPart');
        const passwordField = document.getElementById('password');
        
        if (fullNameField) {
            fullNameField.addEventListener('blur', () => validateField('fullName', validateFullName));
            fullNameField.addEventListener('input', () => {
                if (fullNameField.classList.contains('error')) {
                    validateField('fullName', validateFullName);
                }
            });
        }
        
        if (usernameField) {
            usernameField.addEventListener('blur', () => validateField('username', validateUsername));
            usernameField.addEventListener('input', () => {
                if (usernameField.classList.contains('error')) {
                    validateField('username', validateUsername);
                }
            });
        }
        
        if (adminLevelField) {
            adminLevelField.addEventListener('change', () => {
                validateField('adminLevel', validateAdminLevel);
                updateGeographicFields(adminLevelField.value);
            });
        }
        
        if (emailPartField) {
            emailPartField.addEventListener('blur', () => validateField('emailPart', validateEmail));
            emailPartField.addEventListener('input', () => {
                if (emailPartField.classList.contains('error')) {
                    validateField('emailPart', validateEmail);
                }
            });
        }
        
        if (passwordField) {
            passwordField.addEventListener('blur', () => validateField('password', validatePassword));
            passwordField.addEventListener('input', () => {
                if (passwordField.classList.contains('error')) {
                    validateField('password', validatePassword);
                }
            });
        }

        userForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Validate the entire form before submission
            if (!validateForm()) {
                // Focus on the first field with an error
                const firstErrorField = document.querySelector('.form-error.show');
                if (firstErrorField) {
                    const fieldId = firstErrorField.id.replace('Error', '');
                    const field = document.getElementById(fieldId === 'email' ? 'emailPart' : fieldId);
                    if (field) {
                        field.focus();
                        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
                return;
            }
            
            // Clear any existing errors
            ['fullName', 'username', 'adminLevel', 'email', 'password'].forEach(fieldId => {
                hideError(fieldId);
            });
            
            // In a real app, you would submit the form data to a server
            const isEdit = document.getElementById('modalTitle').textContent === 'Edit User';
            const message = isEdit ? 'User updated successfully!' : 'User added successfully!';
            
            alert(message);
            closeModals();
        });
        
        document.getElementById('confirmReset').addEventListener('click', function() {
            alert('Password reset successfully!');
            closeModals();
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', function(e) {
            if (e.target === userModal || e.target === passwordModal) {
                closeModals();
            }
        });
    }
    
    // Initialize the user management page
    init();
});