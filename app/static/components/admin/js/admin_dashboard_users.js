// User Management Table Handler
// Handles search, filter, pagination, and user table operations

(function() {
    'use strict';
    
    const USERS_ENDPOINT = '/api/admin/dashboard/users/';
    
    let currentPage = 1;
    let currentPageSize = 10; // Default page size
    let currentFilters = {
        search: '',
        role: '',
        status: ''
    };
    let currentSort = {
        sort_by: 'created_at',
        sort_order: 'desc'
    };
    let searchTimeout = null;
    
    /**
     * Load users from API
     */
    function loadUsers(page = 1) {
        currentPage = page;
        
        const params = new URLSearchParams({
            page: page.toString(),
            page_size: Math.min(currentPageSize, 100).toString(), // API max is 100
            sort_by: currentSort.sort_by,
            sort_order: currentSort.sort_order
        });
        
        if (currentFilters.search) {
            params.append('search', currentFilters.search);
        }
        if (currentFilters.role) {
            params.append('role', currentFilters.role);
        }
        if (currentFilters.status) {
            params.append('status', currentFilters.status);
        }
        
        // Show loading state
        showLoadingState(true);
        
        fetch(`${USERS_ENDPOINT}?${params.toString()}`, {
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
                renderUsersTable(data.users);
                renderPagination(data.pagination);
                if (data.sort) {
                    updateSortIndicators(data.sort.sort_by, data.sort.sort_order);
                }
            } else {
                showError('Failed to load users: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error loading users:', error);
            showError('Error loading users. Please try again.');
        })
        .finally(() => {
            showLoadingState(false);
        });
    }
    
    /**
     * Render users table
     */
    function renderUsersTable(users) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        
        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-muted">No users found</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = users.map(user => {
            const statusClass = user.status === 'active' ? 'success' : 
                               user.status === 'suspended' ? 'danger' : 'warning';
            
            return `
                <tr>
                    <td><input type="checkbox" class="form-check-input user-checkbox" data-user-id="${user.admin_id}" /></td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="avatar me-2">
                                <i class="ph-bold ph-user"></i>
                            </div>
                            <div>
                                <div class="fw-bold">${escapeHtml(user.username)}</div>
                                <small class="text-muted">${escapeHtml(user.email)}</small>
                            </div>
                        </div>
                    </td>
                    <td><span class="badge ${statusClass}">${escapeHtml(user.admin_level_display || user.admin_level || 'N/A')}</span></td>
                    <td><span class="badge ${statusClass}">${escapeHtml(user.status_display || user.status || 'N/A')}</span></td>
                    <td>${escapeHtml(user.last_login_relative || 'Never')}</td>
                </tr>
            `;
        }).join('');
    }
    
    /**
     * Render pagination controls
     */
    function renderPagination(pagination) {
        const paginationEl = document.getElementById('usersPagination');
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
                if (page && page !== currentPage) {
                    loadUsers(page);
                }
            });
        });
    }
    
    /**
     * Show/hide loading state
     */
    function showLoadingState(show) {
        const loadingEl = document.getElementById('usersLoadingState');
        const tableWrapper = document.getElementById('usersTableWrapper');
        
        if (loadingEl) loadingEl.style.display = show ? 'block' : 'none';
        if (tableWrapper) tableWrapper.style.display = show ? 'none' : 'block';
    }
    
    /**
     * Show error message
     */
    function showError(message) {
        const tbody = document.getElementById('usersTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-danger">${escapeHtml(message)}</td>
                </tr>
            `;
        }
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Handle search input with debounce
     */
    function handleSearch() {
        const searchInput = document.getElementById('userSearchInput');
        if (!searchInput) return;
        
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentFilters.search = this.value.trim();
                loadUsers(1); // Reset to page 1
            }, 300);
        });
    }
    
    /**
     * Handle filter changes
     */
    function handleFilters() {
        const roleFilter = document.getElementById('userRoleFilter');
        const statusFilter = document.getElementById('userStatusFilter');
        
        if (roleFilter) {
            roleFilter.addEventListener('change', function() {
                currentFilters.role = this.value;
                loadUsers(1);
            });
        }
        
        if (statusFilter) {
            statusFilter.addEventListener('change', function() {
                currentFilters.status = this.value;
                loadUsers(1);
            });
        }
    }
    
    /**
     * Handle select all checkbox
     */
    function handleSelectAll() {
        const selectAll = document.getElementById('selectAllUsers');
        if (!selectAll) return;
        
        selectAll.addEventListener('change', function() {
            const checkboxes = document.querySelectorAll('.user-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = this.checked;
            });
        });
    }
    
    /**
     * Handle page size selector
     */
    function handlePageSize() {
        const pageSizeSelect = document.getElementById('pageSizeSelect');
        if (!pageSizeSelect) return;
        
        pageSizeSelect.addEventListener('change', function() {
            currentPageSize = parseInt(this.value);
            loadUsers(1); // Reset to page 1 when changing page size
        });
    }
    
    /**
     * Handle sortable headers
     */
    function handleSortableHeaders() {
        const sortableHeaders = document.querySelectorAll('.data-table thead th.sortable');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', function() {
                const sortField = this.dataset.sort;
                if (!sortField) return;
                
                // Toggle sort order if clicking the same field
                if (currentSort.sort_by === sortField) {
                    currentSort.sort_order = currentSort.sort_order === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.sort_by = sortField;
                    currentSort.sort_order = 'asc'; // Default to ascending for new field
                }
                
                // Reset to page 1 when sorting changes
                loadUsers(1);
            });
        });
    }
    
    /**
     * Update sort indicators in table headers
     */
    function updateSortIndicators(sortBy, sortOrder) {
        // Remove all sort classes and reset icons
        document.querySelectorAll('.data-table thead th.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            const icon = th.querySelector('.sort-icon');
            if (icon) {
                icon.className = 'ph-bold ph-arrows-up-down sort-icon';
            }
        });
        
        // Add sort class to active header and update icon
        const activeHeader = document.querySelector(`.data-table thead th.sortable[data-sort="${sortBy}"]`);
        if (activeHeader) {
            activeHeader.classList.add(`sort-${sortOrder}`);
            const icon = activeHeader.querySelector('.sort-icon');
            if (icon) {
                if (sortOrder === 'asc') {
                    icon.className = 'ph-bold ph-arrow-up sort-icon';
                } else {
                    icon.className = 'ph-bold ph-arrow-down sort-icon';
                }
            }
        }
    }
    
    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', function() {
        handleSearch();
        handleFilters();
        handleSelectAll();
        handleSortableHeaders();
        handlePageSize();
        loadUsers(1);
    });
    
    // Export functions
    window.DashboardUsers = {
        load: loadUsers,
        refresh: () => loadUsers(currentPage),
        setFilters: (filters) => {
            currentFilters = { ...currentFilters, ...filters };
            loadUsers(1);
        }
    };
})();

