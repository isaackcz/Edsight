// User Management Table
// Handles table loading, search, filter, sort, and pagination

(function() {
    'use strict';
    
    const TABLE_ENDPOINT = '/api/user-management/table/';
    
    let tableState = {
        currentPage: 1,
        pageSize: 25,
        search: '',
        adminLevelFilter: '',
        statusFilter: '',
        regionId: null,
        divisionId: null,
        districtId: null,
        sortBy: 'created_at',
        sortOrder: 'desc',
        allUsers: [] // Store current page users for delete modal access
    };
    
    /**
     * Load table data from API
     */
    function loadTable() {
        const loadingEl = document.getElementById('tableLoading');
        const tableEl = document.getElementById('userManagementTable');
        const emptyEl = document.getElementById('tableEmpty');
        const paginationEl = document.getElementById('tablePagination');
        
        if (loadingEl) loadingEl.style.display = 'flex';
        if (tableEl) tableEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';
        if (paginationEl) paginationEl.style.display = 'none';
        
        // Build query parameters
        const params = new URLSearchParams({
            page: tableState.currentPage,
            page_size: tableState.pageSize,
            sort_by: tableState.sortBy,
            sort_order: tableState.sortOrder
        });
        
        if (tableState.search) {
            params.append('search', tableState.search);
        }
        if (tableState.adminLevelFilter) {
            params.append('admin_level', tableState.adminLevelFilter);
        }
        if (tableState.statusFilter) {
            params.append('status', tableState.statusFilter);
        }
        if (tableState.regionId) {
            params.append('region_id', tableState.regionId);
        }
        if (tableState.divisionId) {
            params.append('division_id', tableState.divisionId);
        }
        if (tableState.districtId) {
            params.append('district_id', tableState.districtId);
        }
        
        fetch(`${TABLE_ENDPOINT}?${params.toString()}`, {
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
            if (data.success && data.users) {
                renderTable(data.users, data.pagination);
                if (loadingEl) loadingEl.style.display = 'none';
                if (tableEl) tableEl.style.display = 'table';
                if (paginationEl) paginationEl.style.display = 'flex';
            } else {
                showTableEmpty();
            }
        })
        .catch(error => {
            console.error('Error loading table:', error);
            showTableEmpty();
        });
    }
    
    /**
     * Render table with user data
     */
    function renderTable(users, pagination) {
        const tbodyEl = document.getElementById('userTableBody');
        if (!tbodyEl) return;
        
        // Store users in tableState for delete modal access
        tableState.allUsers = users;
        
        if (users.length === 0) {
            showTableEmpty();
            return;
        }
        
        tbodyEl.innerHTML = users.map(user => createTableRow(user)).join('');
        
        // Update pagination
        updatePagination(pagination);
        
        // Update sort indicators
        updateSortIndicators();
    }
    
    /**
     * Create table row HTML
     */
    function createTableRow(user) {
        const assignedArea = user.assigned_area || '-';
        const adminLevel = user.admin_level || (user.admin_level_display ? user.admin_level_display.toLowerCase().replace(' ', '_') : '');
        const isSuspended = (user.status === 'suspended');
        const suspendButton = isSuspended 
            ? `<button class="btn-action btn-unsuspend" data-action="unsuspend" data-user-id="${user.id || user.admin_id}" title="Unsuspend User">
                    <i class="ph-bold ph-play"></i>
                </button>`
            : `<button class="btn-action btn-suspend" data-action="suspend" data-user-id="${user.id || user.admin_id}" title="Suspend User">
                    <i class="ph-bold ph-pause"></i>
                </button>`;
        
        return `
            <tr>
                <td>${escapeHtml(user.full_name || '-')}</td>
                <td>${escapeHtml(user.email)}</td>
                <td><span class="admin-level-badge ${adminLevel}">${escapeHtml(user.admin_level_display || user.admin_level || '-')}</span></td>
                <td><span class="status-badge ${user.status}">${escapeHtml(user.status_display || user.status || '-')}</span></td>
                <td>${escapeHtml(assignedArea)}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn-action btn-view" data-action="view" data-user-id="${user.id || user.admin_id}" >
                            <i class="ph-bold ph-eye"></i>
                        </button>
                        ${suspendButton}
                        <button class="btn-action btn-delete" data-action="delete" data-user-id="${user.id || user.admin_id}" >
                            <i class="ph-bold ph-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
    
    /**
     * Update pagination controls
     */
    function updatePagination(pagination) {
        const currentPageEl = document.getElementById('currentPage');
        const totalPagesEl = document.getElementById('totalPages');
        const paginationInfoEl = document.getElementById('paginationInfo');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (currentPageEl) currentPageEl.textContent = pagination.page;
        if (totalPagesEl) totalPagesEl.textContent = pagination.total_pages;
        
        const start = ((pagination.page - 1) * pagination.page_size) + 1;
        const end = Math.min(pagination.page * pagination.page_size, pagination.total_count);
        
        if (paginationInfoEl) {
            paginationInfoEl.textContent = `Showing ${start}-${end} of ${pagination.total_count}`;
        }
        
        if (prevBtn) {
            prevBtn.disabled = !pagination.has_previous;
        }
        if (nextBtn) {
            nextBtn.disabled = !pagination.has_next;
        }
        
        tableState.currentPage = pagination.page;
    }
    
    /**
     * Show empty table state
     */
    function showTableEmpty() {
        const loadingEl = document.getElementById('tableLoading');
        const tableEl = document.getElementById('userManagementTable');
        const emptyEl = document.getElementById('tableEmpty');
        const paginationEl = document.getElementById('tablePagination');
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (tableEl) tableEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'flex';
        if (paginationEl) paginationEl.style.display = 'none';
    }
    
    /**
     * Handle search input
     */
    function handleSearch() {
        const searchInput = document.getElementById('userTableSearch');
        if (!searchInput) return;
        
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                tableState.search = this.value.trim();
                tableState.currentPage = 1;
                loadTable();
            }, 300);
        });
    }
    
    /**
     * Handle filter changes
     */
    function handleFilters() {
        const adminLevelFilter = document.getElementById('userTableAdminLevelFilter');
        const statusFilter = document.getElementById('userTableStatusFilter');
        
        if (adminLevelFilter) {
            adminLevelFilter.addEventListener('change', function() {
                tableState.adminLevelFilter = this.value;
                tableState.currentPage = 1;
                loadTable();
            });
        }
        
        if (statusFilter) {
            statusFilter.addEventListener('change', function() {
                tableState.statusFilter = this.value;
                tableState.currentPage = 1;
                loadTable();
            });
        }
    }
    
    /**
     * Handle sortable table headers
     */
    function handleSort() {
        document.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', function(e) {
                // Don't sort if clicking on a button inside the header
                if (e.target.closest('button')) {
                    return;
                }
                
                const sortField = this.getAttribute('data-sort');
                if (!sortField) return;
                
                // Use requestAnimationFrame to batch DOM updates and prevent flicker
                requestAnimationFrame(() => {
                    // Remove active class and reset icons from all sortable headers
                    document.querySelectorAll('th.sortable').forEach(header => {
                        header.classList.remove('sort-asc', 'sort-desc');
                        const icon = header.querySelector('.sort-icon');
                        if (icon) {
                            icon.className = 'ph-bold ph-arrows-up-down sort-icon';
                        }
                    });
                    
                    // Toggle sort order if same field
                    if (tableState.sortBy === sortField) {
                        tableState.sortOrder = tableState.sortOrder === 'asc' ? 'desc' : 'asc';
                    } else {
                        tableState.sortBy = sortField;
                        tableState.sortOrder = 'asc';
                    }
                    
                    // Add active class and update icon
                    const icon = this.querySelector('.sort-icon');
                    if (icon) {
                        if (tableState.sortOrder === 'asc') {
                            this.classList.add('sort-asc');
                            icon.className = 'ph-bold ph-arrow-up sort-icon';
                        } else {
                            this.classList.add('sort-desc');
                            icon.className = 'ph-bold ph-arrow-down sort-icon';
                        }
                    }
                    
                    loadTable();
                });
            });
        });
        
        // Update initial sort state on load
        updateSortIndicators();
    }
    
    /**
     * Update sort indicators based on current sort state
     */
    function updateSortIndicators() {
        document.querySelectorAll('th.sortable').forEach(header => {
            const sortField = header.getAttribute('data-sort');
            if (sortField === tableState.sortBy) {
                const icon = header.querySelector('.sort-icon');
                if (icon) {
                    if (tableState.sortOrder === 'asc') {
                        header.classList.add('sort-asc');
                        icon.className = 'ph-bold ph-arrow-up sort-icon';
                    } else {
                        header.classList.add('sort-desc');
                        icon.className = 'ph-bold ph-arrow-down sort-icon';
                    }
                }
            }
        });
    }
    
    /**
     * Handle pagination buttons
     */
    function handlePagination() {
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', function() {
                if (!this.disabled && tableState.currentPage > 1) {
                    tableState.currentPage--;
                    loadTable();
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                if (!this.disabled) {
                    tableState.currentPage++;
                    loadTable();
                }
            });
        }
    }
    
    /**
     * Handle action buttons (view, delete)
     */
    function handleActions() {
        document.addEventListener('click', function(e) {
            const actionBtn = e.target.closest('[data-action]');
            if (!actionBtn) return;
            
            const action = actionBtn.getAttribute('data-action');
            const userId = actionBtn.getAttribute('data-user-id');
            
            if (action === 'view') {
                e.preventDefault();
                e.stopPropagation();
                showUserViewPage(userId);
            } else if (action === 'suspend') {
                e.preventDefault();
                e.stopPropagation();
                showSuspendUserModal(userId);
            } else if (action === 'unsuspend') {
                e.preventDefault();
                e.stopPropagation();
                showUnsuspendUserModal(userId);
            } else if (action === 'delete') {
                e.preventDefault();
                e.stopPropagation();
                showDeleteUserModal(userId);
            }
        });
    }
    
    /**
     * Show user view page
     */
    function showUserViewPage(userId) {
        const mainPage = document.getElementById('userManagementMainPage');
        const viewPage = document.getElementById('userManagementViewPage');
        
        if (!mainPage || !viewPage) return;
        
        // Hide main page
        mainPage.style.display = 'none';
        
        // Show view page
        viewPage.style.display = 'block';
        
        // Save state to localStorage
        try {
            localStorage.setItem('userManagementView', 'view');
            localStorage.setItem('userManagementViewUserId', userId);
        } catch (e) {
            console.warn('Could not save view state to localStorage:', e);
        }
        
        // Load user data
        if (window.UserManagementView) {
            window.UserManagementView.loadUser(userId);
        }
    }
    
    /**
     * Hide user view page and show main page
     */
    function hideUserViewPage() {
        const mainPage = document.getElementById('userManagementMainPage');
        const viewPage = document.getElementById('userManagementViewPage');
        
        if (!mainPage || !viewPage) return;
        
        // Hide view page
        viewPage.style.display = 'none';
        
        // Show main page
        mainPage.style.display = 'block';
        
        // Save state to localStorage
        try {
            localStorage.setItem('userManagementView', 'main');
            localStorage.removeItem('userManagementViewUserId');
        } catch (e) {
            console.warn('Could not save view state to localStorage:', e);
        }
    }
    
    /**
     * Show suspend user confirmation modal
     */
    function showSuspendUserModal(userId) {
        // Find user data from current table data
        const user = tableState.allUsers.find(u => (u.id == userId || u.admin_id == userId));
        if (!user) {
            alert('User not found');
            return;
        }
        
        const modal = document.getElementById('suspendUserModal');
        const userNameEl = document.getElementById('suspendUserName');
        
        if (modal && userNameEl) {
            userNameEl.textContent = `${user.full_name || user.email} (${user.username || 'N/A'})`;
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // Store user ID for suspension
            modal.setAttribute('data-user-id', userId);
        }
    }
    
    /**
     * Hide suspend user modal
     */
    function hideSuspendUserModal() {
        const modal = document.getElementById('suspendUserModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            modal.removeAttribute('data-user-id');
        }
    }
    
    /**
     * Suspend user
     */
    function suspendUser(userId) {
        fetch(`/api/admin/users/${userId}/`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                status: 'suspended'
            })
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
                hideSuspendUserModal();
                // Show success message
                showSuccessModal('User suspended successfully');
                // Refresh the table
                loadTable();
            } else {
                showNotification('Failed to suspend user: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            console.error('Error suspending user:', error);
            showNotification('Error suspending user: ' + (error.message || 'Please try again.'), 'error');
        });
    }
    
    /**
     * Show notification (for errors only)
     */
    function showNotification(message, type = 'error') {
        // Only show notifications for errors, success uses modal
        if (type === 'success') {
            showSuccessModal(message);
            return;
        }
        
        // Remove existing toast notifications (not header notification icon)
        const existingNotifications = document.querySelectorAll('.toast-notification');
        existingNotifications.forEach(notif => notif.remove());
        
        // Create toast notification element
        const notification = document.createElement('div');
        notification.className = `toast-notification toast-notification-${type}`;
        const iconClass = type === 'error' ? 'ph-x-circle' : 'ph-info';
        notification.innerHTML = `
            <div class="toast-notification-content">
                <i class="ph-bold ${iconClass}"></i>
                <span class="toast-notification-message">${escapeHtml(message)}</span>
                <button class="toast-notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="ph-bold ph-x"></i>
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
    
    /**
     * Show success modal
     */
    function showSuccessModal(message) {
        const modal = document.getElementById('successModal');
        const messageEl = document.getElementById('successModalMessage');
        
        if (modal && messageEl) {
            messageEl.textContent = message;
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
    
    /**
     * Hide success modal
     */
    function hideSuccessModal() {
        const modal = document.getElementById('successModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }
    
    /**
     * Show suspend success message
     */
    function showSuspendSuccess() {
        showSuccessModal('User suspended successfully');
    }
    
    /**
     * Show unsuspend user confirmation modal
     */
    function showUnsuspendUserModal(userId) {
        // Find user data from current table data
        const user = tableState.allUsers.find(u => (u.id == userId || u.admin_id == userId));
        if (!user) {
            showNotification('User not found', 'error');
            return;
        }
        
        const modal = document.getElementById('unsuspendUserModal');
        const userNameEl = document.getElementById('unsuspendUserName');
        
        if (modal && userNameEl) {
            userNameEl.textContent = `${user.full_name || user.email} (${user.username || 'N/A'})`;
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // Store user ID for unsuspension
            modal.setAttribute('data-user-id', userId);
        }
    }
    
    /**
     * Hide unsuspend user modal
     */
    function hideUnsuspendUserModal() {
        const modal = document.getElementById('unsuspendUserModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            modal.removeAttribute('data-user-id');
        }
    }
    
    /**
     * Unsuspend user
     */
    function unsuspendUser(userId) {
        fetch(`/api/admin/users/${userId}/`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                status: 'active'
            })
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
                hideUnsuspendUserModal();
                // Show success message
                showSuccessModal('User unsuspended successfully');
                // Refresh the table
                loadTable();
            } else {
                showNotification('Failed to unsuspend user: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            console.error('Error unsuspending user:', error);
            showNotification('Error unsuspending user: ' + (error.message || 'Please try again.'), 'error');
        });
    }
    
    /**
     * Show delete user confirmation modal
     */
    function showDeleteUserModal(userId) {
        // Find user data from current table data
        const user = tableState.allUsers.find(u => u.id == userId);
        if (!user) {
            alert('User not found');
            return;
        }
        
        const modal = document.getElementById('deleteUserModal');
        const userNameEl = document.getElementById('deleteUserName');
        
        if (modal && userNameEl) {
            userNameEl.textContent = `${user.full_name || user.email} (${user.username || 'N/A'})`;
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // Store user ID for deletion
            modal.setAttribute('data-user-id', userId);
        }
    }
    
    /**
     * Hide delete user modal
     */
    function hideDeleteUserModal() {
        const modal = document.getElementById('deleteUserModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            modal.removeAttribute('data-user-id');
        }
    }
    
    /**
     * Delete user
     */
    function deleteUser(userId) {
        fetch(`/api/admin/users/${userId}/delete/`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCSRFToken()
            }
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
                hideDeleteUserModal();
                // Show success message
                showSuccessModal('User deleted successfully');
                // Refresh the table
                loadTable();
            } else {
                showNotification('Failed to delete user: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting user:', error);
            showNotification('Error deleting user: ' + (error.message || 'Please try again.'), 'error');
        });
    }
    
    /**
     * Show delete success message
     */
    function showDeleteSuccess() {
        showSuccessModal('User deleted successfully');
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
     * Handle suspend modal buttons
     */
    function handleSuspendModal() {
        const closeBtn = document.getElementById('closeSuspendUserModal');
        const cancelBtn = document.getElementById('cancelSuspendUser');
        const confirmBtn = document.getElementById('confirmSuspendUser');
        const modal = document.getElementById('suspendUserModal');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', hideSuspendUserModal);
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', hideSuspendUserModal);
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                const userId = modal ? modal.getAttribute('data-user-id') : null;
                if (userId) {
                    suspendUser(userId);
                }
            });
        }
        
        // Close modal when clicking overlay
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    hideSuspendUserModal();
                }
            });
        }
    }
    
    /**
     * Handle success modal buttons
     */
    function handleSuccessModal() {
        const closeBtn = document.getElementById('closeSuccessModal');
        const confirmBtn = document.getElementById('confirmSuccessModal');
        const modal = document.getElementById('successModal');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', hideSuccessModal);
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', hideSuccessModal);
        }
        
        // Close modal when clicking overlay
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    hideSuccessModal();
                }
            });
        }
    }
    
    /**
     * Handle unsuspend modal buttons
     */
    function handleUnsuspendModal() {
        const closeBtn = document.getElementById('closeUnsuspendUserModal');
        const cancelBtn = document.getElementById('cancelUnsuspendUser');
        const confirmBtn = document.getElementById('confirmUnsuspendUser');
        const modal = document.getElementById('unsuspendUserModal');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', hideUnsuspendUserModal);
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', hideUnsuspendUserModal);
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                const userId = modal ? modal.getAttribute('data-user-id') : null;
                if (userId) {
                    unsuspendUser(userId);
                }
            });
        }
        
        // Close modal when clicking overlay
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    hideUnsuspendUserModal();
                }
            });
        }
    }
    
    /**
     * Handle delete modal buttons
     */
    function handleDeleteModal() {
        const closeBtn = document.getElementById('closeDeleteUserModal');
        const cancelBtn = document.getElementById('cancelDeleteUser');
        const confirmBtn = document.getElementById('confirmDeleteUser');
        const modal = document.getElementById('deleteUserModal');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', hideDeleteUserModal);
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', hideDeleteUserModal);
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                const userId = modal ? modal.getAttribute('data-user-id') : null;
                if (userId) {
                    deleteUser(userId);
                }
            });
        }
        
        // Close modal when clicking overlay
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    hideDeleteUserModal();
                }
            });
        }
    }
    
    /**
     * Show create user page
     */
    function showCreateUserPage() {
        // Save state to localStorage
        try {
            localStorage.setItem('userManagementView', 'create');
        } catch (e) {
            console.warn('Could not save view state to localStorage:', e);
        }
        
        if (window.UserManagementCreate && window.UserManagementCreate.show) {
            window.UserManagementCreate.show();
        } else {
            // Fallback if create module not loaded
            const mainPage = document.getElementById('userManagementMainPage');
            const createPage = document.getElementById('userManagementCreatePage');
            
            if (mainPage && createPage) {
                mainPage.style.display = 'none';
                createPage.style.display = 'block';
            }
        }
    }
    
    /**
     * Hide create user page
     */
    function hideCreateUserPage() {
        // Save state to localStorage
        try {
            localStorage.setItem('userManagementView', 'main');
        } catch (e) {
            console.warn('Could not save view state to localStorage:', e);
        }
        
        if (window.UserManagementCreate && window.UserManagementCreate.hide) {
            window.UserManagementCreate.hide();
        } else {
            // Fallback if create module not loaded
            const mainPage = document.getElementById('userManagementMainPage');
            const createPage = document.getElementById('userManagementCreatePage');
            
            if (mainPage && createPage) {
                createPage.style.display = 'none';
                mainPage.style.display = 'block';
            }
        }
    }
    
    /**
     * Restore view state from localStorage
     */
    function restoreViewState() {
        try {
            const savedView = localStorage.getItem('userManagementView');
            
            if (savedView === 'view') {
                const userId = localStorage.getItem('userManagementViewUserId');
                if (userId) {
                    // Small delay to ensure DOM is ready
                    setTimeout(() => {
                        showUserViewPage(userId);
                    }, 100);
                }
            } else if (savedView === 'create') {
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    showCreateUserPage();
                }, 100);
            }
            // If savedView is 'main' or null, show main page (default)
        } catch (e) {
            console.warn('Could not restore view state from localStorage:', e);
        }
    }
    
    // Export function for external access
    window.UserManagementTable = {
        load: loadTable,
        refresh: loadTable,
        loadWithRegion: loadWithRegion,
        loadWithDivision: loadWithDivision,
        loadWithDistrict: loadWithDistrict,
        showUserView: showUserViewPage,
        hideUserView: hideUserViewPage,
        showCreateUser: showCreateUserPage,
        hideUserCreate: hideCreateUserPage
    };
    
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Load table with region filter (called from tree component)
     */
    function loadWithRegion(regionId) {
        tableState.regionId = regionId;
        tableState.divisionId = null;
        tableState.districtId = null;
        tableState.currentPage = 1;
        loadTable();
    }
    
    /**
     * Load table with division filter (called from tree component)
     */
    function loadWithDivision(divisionId) {
        tableState.divisionId = divisionId;
        tableState.regionId = null;
        tableState.districtId = null;
        tableState.currentPage = 1;
        loadTable();
    }
    
    /**
     * Load table with district filter (called from tree component)
     */
    function loadWithDistrict(districtId) {
        tableState.districtId = districtId;
        tableState.regionId = null;
        tableState.divisionId = null;
        tableState.currentPage = 1;
        loadTable();
    }
    
    /**
     * Initialize table
     */
    function init() {
        const tableContainer = document.getElementById('userManagementTable');
        if (tableContainer) {
            handleSearch();
            handleFilters();
            handleSort();
            handlePagination();
            handleActions();
            loadTable();
            
            // Restore view state after a short delay to ensure all modules are loaded
            setTimeout(() => {
                restoreViewState();
            }, 200);
        }
    }
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            init();
            handleSuccessModal();
            handleSuspendModal();
            handleUnsuspendModal();
            handleDeleteModal();
        });
    } else {
        init();
        handleSuccessModal();
        handleSuspendModal();
        handleUnsuspendModal();
        handleDeleteModal();
    }
})();

