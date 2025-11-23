/**
 * Table module
 * Handles paginated table with search, filters, sorting, and incremental loading
 */

(function() {
    'use strict';
    
    const TABLE_ENDPOINT = '/api/admin/role-analytics/table/';
    const MAX_LIMIT = 100; // Maximum rows per API call
    const DEFAULT_PAGE_SIZE = 10; // Default page size (starts at 10)
    
    let tableState = {
        currentOffset: 0,
        totalCount: 0,
        currentPage: 1,
        pageSize: 10, // Start with 10 rows per page
        searchQuery: '',
        roleFilter: '',
        statusFilter: '',
        sortColumn: 'username',
        sortDirection: 'asc',
        isLoading: false,
        loadedData: [], // Cache for incremental loading
        loadedCount: 0 // Total rows loaded so far
    };
    
    /**
     * Load table data from API with incremental loading
     */
    function loadTable(forceRefresh = false) {
        if (tableState.isLoading) return;
        
        // Check if we need to fetch more data
        const endIndex = tableState.currentOffset + tableState.pageSize;
        const needsMoreData = endIndex > tableState.loadedCount || forceRefresh;
        
        if (needsMoreData) {
            fetchMoreData(forceRefresh);
        } else {
            // Use cached data
            displayCachedData();
        }
    }
    
    /**
     * Fetch more data from API (incremental loading)
     */
    function fetchMoreData(forceRefresh = false) {
        if (tableState.isLoading) return Promise.resolve();
        
        tableState.isLoading = true;
        const tbody = document.getElementById('roleAnalyticsTableBody');
        
        if (tbody && forceRefresh) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="loading-spinner"><i class="ph-bold ph-spinner ph-spin"></i> Loading data...</div></td></tr>';
        }
        
        // Calculate how many rows we need to fetch
        const fetchOffset = forceRefresh ? 0 : tableState.loadedCount;
        const fetchLimit = MAX_LIMIT; // Always fetch 100 at a time
        
        // Build query parameters
        const params = new URLSearchParams({
            offset: fetchOffset,
            limit: fetchLimit,
            sort_column: tableState.sortColumn,
            sort_direction: tableState.sortDirection
        });
        
        if (tableState.searchQuery) {
            params.append('search', tableState.searchQuery);
        }
        if (tableState.roleFilter) {
            params.append('role', tableState.roleFilter);
        }
        if (tableState.statusFilter) {
            params.append('status', tableState.statusFilter);
        }
        
        return fetch(`${TABLE_ENDPOINT}?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            tableState.isLoading = false;
            
            if (data.success && data.data) {
                if (forceRefresh) {
                    // Reset cache on refresh
                    tableState.loadedData = data.data.users || [];
                    tableState.loadedCount = data.data.users ? data.data.users.length : 0;
                } else {
                    // Append to cache
                    tableState.loadedData = tableState.loadedData.concat(data.data.users || []);
                    tableState.loadedCount = tableState.loadedData.length;
                }
                
                tableState.totalCount = data.data.total_count || 0;
                displayCachedData();
                updatePagination(data.data);
            } else {
                showTableError(data.error || 'Failed to load table data');
            }
        })
        .catch(error => {
            tableState.isLoading = false;
            console.error('Error loading table:', error);
            showTableError('Error loading table data. Please try again.');
        });
    }
    
    /**
     * Display data from cache
     */
    function displayCachedData() {
        const start = tableState.currentOffset;
        const end = start + tableState.pageSize;
        const pageData = tableState.loadedData.slice(start, end);
        renderTable(pageData);
    }
    
    /**
     * Render table rows
     */
    function renderTable(users) {
        const tbody = document.getElementById('roleAnalyticsTableBody');
        if (!tbody) return;
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No users found</td></tr>';
            return;
        }
        
        let html = '';
        
        users.forEach(user => {
            // Format permissions
            const permissionsHtml = user.permissions && user.permissions.length > 0
                ? user.permissions.map(p => `<span class="badge bg-info">${escapeHtml(p)}</span>`).join(' ')
                : '<span class="text-muted">None</span>';
            
            // Status badge
            const statusClass = user.status === 'active' ? 'success' : 
                               user.status === 'inactive' ? 'warning' : 'danger';
            const statusBadge = `<span class="badge bg-${statusClass}">${escapeHtml(user.status_display || user.status)}</span>`;
            
            // Role badge
            const roleBadge = `<span class="badge bg-primary">${escapeHtml(user.admin_level_display || user.admin_level)}</span>`;
            
            html += `
                <tr>
                    <td>
                        <div class="user-info-row">
                            <div class="user-details">
                                <div class="user-name-table">${escapeHtml(user.full_name || user.username)}</div>
                                <div class="user-email-table">${escapeHtml(user.email)}</div>
                            </div>
                        </div>
                    </td>
                    <td>${roleBadge}</td>
                    <td>${escapeHtml(user.assignment || 'N/A')}</td>
                    <td>${permissionsHtml}</td>
                    <td><span class="badge bg-secondary">${escapeHtml(user.access_scope || 'none')}</span></td>
                    <td>${statusBadge}</td>
                    <td>${escapeHtml(user.last_active || 'Never')}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }
    
    /**
     * Update pagination controls
     */
    function updatePagination(data) {
        const totalPages = Math.ceil(tableState.totalCount / tableState.pageSize);
        const currentPage = Math.floor(tableState.currentOffset / tableState.pageSize) + 1;
        
        // Update page info
        const currentPageEl = document.getElementById('currentPage');
        const totalPagesEl = document.getElementById('totalPages');
        const paginationInfoEl = document.getElementById('paginationInfo');
        
        if (currentPageEl) {
            currentPageEl.textContent = currentPage;
        }
        if (totalPagesEl) {
            totalPagesEl.textContent = totalPages || 1;
        }
        if (paginationInfoEl) {
            const start = tableState.currentOffset + 1;
            const end = Math.min(tableState.currentOffset + tableState.pageSize, tableState.totalCount);
            paginationInfoEl.textContent = `Showing ${start}-${end} of ${tableState.totalCount} users`;
        }
        
        // Update button states
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (prevBtn) {
            prevBtn.disabled = tableState.currentOffset === 0;
        }
        if (nextBtn) {
            const endIndex = tableState.currentOffset + tableState.pageSize;
            const hasMoreInCache = endIndex < tableState.loadedCount;
            const hasMoreInDB = data.has_more || (endIndex < tableState.totalCount);
            nextBtn.disabled = !hasMoreInCache && !hasMoreInDB;
        }
    }
    
    /**
     * Show table error
     */
    function showTableError(message) {
        const tbody = document.getElementById('roleAnalyticsTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">${escapeHtml(message)}</td></tr>`;
        }
    }
    
    /**
     * Go to next page
     */
    function nextPage() {
        if (tableState.isLoading) return;
        
        const nextOffset = tableState.currentOffset + tableState.pageSize;
        const endIndex = nextOffset + tableState.pageSize;
        
        // Check if we need to fetch more data
        if (endIndex > tableState.loadedCount && endIndex <= tableState.totalCount) {
            // Fetch more data first, then navigate
            fetchMoreData(false).then(() => {
                if (nextOffset < tableState.totalCount) {
                    tableState.currentOffset = nextOffset;
                    loadTable();
                }
            });
        } else if (nextOffset < tableState.totalCount) {
            tableState.currentOffset = nextOffset;
            loadTable();
        }
    }
    
    /**
     * Go to previous page
     */
    function previousPage() {
        if (tableState.isLoading) return;
        
        const prevOffset = Math.max(0, tableState.currentOffset - tableState.pageSize);
        tableState.currentOffset = prevOffset;
        loadTable();
    }
    
    /**
     * Handle search
     */
    function handleSearch() {
        const searchInput = document.getElementById('tableSearchInput');
        if (!searchInput) return;
        
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            const query = this.value.trim();
            
            searchTimeout = setTimeout(() => {
                tableState.searchQuery = query;
                tableState.currentOffset = 0;
                tableState.loadedData = [];
                tableState.loadedCount = 0;
                loadTable(true);
            }, 500);
        });
    }
    
    /**
     * Handle filters
     */
    function handleFilters() {
        const roleFilter = document.getElementById('tableRoleFilter');
        const statusFilter = document.getElementById('tableStatusFilter');
        const pageSizeSelect = document.getElementById('tablePageSize');
        
        if (roleFilter) {
            roleFilter.addEventListener('change', function() {
                tableState.roleFilter = this.value;
                tableState.currentOffset = 0;
                tableState.loadedData = [];
                tableState.loadedCount = 0;
                loadTable(true);
            });
        }
        
        if (statusFilter) {
            statusFilter.addEventListener('change', function() {
                tableState.statusFilter = this.value;
                tableState.currentOffset = 0;
                tableState.loadedData = [];
                tableState.loadedCount = 0;
                loadTable(true);
            });
        }
        
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', function() {
                tableState.pageSize = parseInt(this.value, 10);
                tableState.currentOffset = 0;
                loadTable();
            });
        }
    }
    
    /**
     * Handle sortable headers
     */
    function handleSorting() {
        const sortableHeaders = document.querySelectorAll('.sortable');
        
        sortableHeaders.forEach(header => {
            header.addEventListener('click', function() {
                const column = this.getAttribute('data-sort');
                if (!column) return;
                
                // Toggle sort direction if same column
                if (tableState.sortColumn === column) {
                    tableState.sortDirection = tableState.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    tableState.sortColumn = column;
                    tableState.sortDirection = 'asc';
                }
                
                // Update sort icons
                updateSortIcons();
                
                // Reset and reload
                tableState.currentOffset = 0;
                tableState.loadedData = [];
                tableState.loadedCount = 0;
                loadTable(true);
            });
        });
    }
    
    /**
     * Update sort icons on headers
     */
    function updateSortIcons() {
        const sortableHeaders = document.querySelectorAll('.sortable');
        
        sortableHeaders.forEach(header => {
            const column = header.getAttribute('data-sort');
            const icon = header.querySelector('.sort-icon');
            
            if (icon) {
                if (tableState.sortColumn === column) {
                    icon.className = tableState.sortDirection === 'asc' 
                        ? 'ph-bold ph-arrow-up sort-icon active' 
                        : 'ph-bold ph-arrow-down sort-icon active';
                } else {
                    icon.className = 'ph-bold ph-arrows-down-up sort-icon';
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
            prevBtn.addEventListener('click', function(e) {
                e.preventDefault();
                previousPage();
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', function(e) {
                e.preventDefault();
                nextPage();
            });
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
     * Initialize table module
     */
    function init() {
        handleSearch();
        handleFilters();
        handlePagination();
        handleSorting();
        updateSortIcons();
        loadTable(true);
    }
    
    /**
     * Reload table
     */
    function reload() {
        tableState.currentOffset = 0;
        tableState.loadedData = [];
        tableState.loadedCount = 0;
        loadTable(true);
    }
    
    // Export for external access
    window.RoleAnalyticsTable = {
        init: init,
        load: loadTable,
        reload: reload,
        nextPage: nextPage,
        previousPage: previousPage
    };
    
    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

