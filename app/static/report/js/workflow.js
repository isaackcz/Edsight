// Workflow Performance Page JavaScript
let currentPage = 1;
let pageSize = 100;
let totalCount = 0;
let searchTimeout = null;
let currentSearch = '';

document.addEventListener('DOMContentLoaded', function() {
    // Wait for ReportFilters to be initialized
    if (typeof ReportFilters === 'undefined') {
        console.error('ReportFilters not loaded');
        return;
    }
    
    initializeFilters();
    initializeSearch();
    initializePagination();
    loadWorkflowData();
    
    // Export button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            handleExport();
        });
    }
});

function initializeFilters() {
    initializeDateRangeSelector();
    initializeStatusSelector();
}

function initializeStatusSelector() {
    const selector = document.getElementById('status-selector');
    const dropdown = document.getElementById('status-dropdown');
    const textSpan = document.getElementById('status-text');
    const checkboxes = dropdown ? dropdown.querySelectorAll('input[type="checkbox"]') : [];
    
    if (!selector || !dropdown || !textSpan) return;
    
    // Update status text based on selected checkboxes
    function updateStatusText() {
        const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
        if (selected.length === 0) {
            textSpan.textContent = 'All Statuses';
        } else if (selected.length === 1) {
            const labels = {
                'draft': 'Draft',
                'pending': 'Pending',
                'approved': 'Approved',
                'returned': 'Returned',
                'completed': 'Completed'
            };
            textSpan.textContent = labels[selected[0]] || selected[0];
        } else {
            textSpan.textContent = `${selected.length} Selected`;
        }
        
        // Update filters and reload data
        const statusValue = selected.length > 0 ? selected : null;
        ReportFilters.set('status', statusValue);
        currentPage = 1; // Reset to first page when filter changes
        loadWorkflowData();
    }
    
    // Toggle dropdown
    selector.addEventListener('click', function(e) {
        e.stopPropagation();
        // Close date range dropdown if open
        const dateRangeDropdown = document.getElementById('date-range-dropdown');
        if (dateRangeDropdown) dateRangeDropdown.classList.remove('show');
        dropdown.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!selector.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
    
    // Handle checkbox changes
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function(e) {
            e.stopPropagation();
            updateStatusText();
        });
        
        // Prevent dropdown from closing when clicking checkbox
        checkbox.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    });
    
    // Prevent dropdown from closing when clicking labels
    dropdown.querySelectorAll('label').forEach(label => {
        label.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    });
}

function initializeDateRangeSelector() {
    const selector = document.getElementById('date-range-selector');
    const dropdown = document.getElementById('date-range-dropdown');
    const textSpan = document.getElementById('date-range-text');
    const customModal = document.getElementById('custom-date-modal');
    const closeModal = document.getElementById('close-custom-date-modal');
    const cancelBtn = document.getElementById('cancel-custom-date');
    const applyBtn = document.getElementById('apply-custom-date');
    const dateFromInput = document.getElementById('custom-date-from');
    const dateToInput = document.getElementById('custom-date-to');
    
    if (!selector || !dropdown || !textSpan) return;
    
    // Set default date range
    ReportFilters.setDateRange('30days');
    updateDateRangeText('30days');
    
    // Toggle dropdown
    selector.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!selector.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
    
    // Handle date range option selection
    dropdown.querySelectorAll('.date-range-option').forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            const range = this.getAttribute('data-range');
            
            if (range === 'custom') {
                customModal.style.display = 'flex';
                dropdown.classList.remove('show');
            } else {
                ReportFilters.setDateRange(range);
                updateDateRangeText(range);
                dropdown.classList.remove('show');
                currentPage = 1; // Reset to first page when filter changes
                loadWorkflowData();
            }
        });
    });
    
    // Custom date modal handlers
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            customModal.style.display = 'none';
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            customModal.style.display = 'none';
        });
    }
    
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const from = dateFromInput.value;
            const to = dateToInput.value;
            
            if (from && to) {
                if (from > to) {
                    alert('From date must be before To date');
                    return;
                }
                ReportFilters.setCustomDateRange(from, to);
                textSpan.textContent = `${from} to ${to}`;
                customModal.style.display = 'none';
                currentPage = 1; // Reset to first page when filter changes
                loadWorkflowData();
            } else {
                alert('Please select both dates');
            }
        });
    }
}

function updateDateRangeText(range) {
    const textSpan = document.getElementById('date-range-text');
    if (!textSpan) return;
    
    const rangeTexts = {
        '7days': 'Last 7 Days',
        '30days': 'Last 30 Days',
        '90days': 'Last 90 Days',
        '6months': 'Last 6 Months',
        'year': 'Last Year',
        'all': 'All Time'
    };
    
    textSpan.textContent = rangeTexts[range] || 'Last 30 Days';
}

async function loadWorkflowData() {
    try {
        const tbody = document.getElementById('workflow-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading workflow data...</td></tr>';
        }
        
        const filters = ReportFilters.collect();
        
        // Add pagination and search parameters
        const offset = (currentPage - 1) * pageSize;
        filters.limit = pageSize;
        filters.offset = offset;
        filters.search = currentSearch;
        
        const response = await fetch('/api/reports/workflow-performance/', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(filters)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data) {
            totalCount = data.data.total_count || 0;
            renderWorkflowTable(data.data);
            updatePagination();
        } else if (data.error) {
            console.error('API error:', data.error);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error: ${data.error}</td></tr>`;
            }
        } else {
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center">No workflow data available</td></tr>';
            }
        }
    } catch (error) {
        console.error('Error loading workflow data:', error);
        const tbody = document.getElementById('workflow-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
        }
    }
}

function initializeSearch() {
    const searchInput = document.getElementById('workflow-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
        const searchValue = this.value.trim();
        
        // Clear existing timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        // Set new timeout for 1.5 seconds
        searchTimeout = setTimeout(() => {
            currentSearch = searchValue;
            currentPage = 1; // Reset to first page on new search
            loadWorkflowData();
        }, 1500);
    });
}

function initializePagination() {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadWorkflowData();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalCount / pageSize);
            if (currentPage < totalPages) {
                currentPage++;
                loadWorkflowData();
            }
        });
    }
}

function updatePagination() {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const paginationInfo = document.getElementById('pagination-info');
    const pageNumbers = document.getElementById('page-numbers');
    
    const totalPages = Math.ceil(totalCount / pageSize);
    const start = totalCount > 0 ? ((currentPage - 1) * pageSize) + 1 : 0;
    const end = Math.min(currentPage * pageSize, totalCount);
    
    // Update info text
    if (paginationInfo) {
        paginationInfo.textContent = `Showing ${start}-${end} of ${totalCount}`;
    }
    
    // Update prev/next buttons
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages || totalPages === 0;
    }
    
    // Update page numbers
    if (pageNumbers) {
        pageNumbers.innerHTML = '';
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `btn ${i === currentPage ? 'primary' : 'secondary'}`;
            pageBtn.textContent = i;
            pageBtn.style.cssText = 'padding: 6px 12px; font-size: 0.875rem; min-width: 36px;';
            pageBtn.addEventListener('click', () => {
                currentPage = i;
                loadWorkflowData();
            });
            pageNumbers.appendChild(pageBtn);
        }
    }
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function renderWorkflowTable(data) {
    const tbody = document.getElementById('workflow-tbody');
    if (!tbody) return;
    
    // Handle different data structures
    let stages = [];
    if (data.stages && Array.isArray(data.stages)) {
        stages = data.stages;
    } else if (Array.isArray(data)) {
        stages = data;
    }
    
    // Note: Status filtering and search are now handled on the backend
    // Frontend filtering removed to work with pagination
    
    if (stages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No workflow data available for the selected filters</td></tr>';
        return;
    }
    
    tbody.innerHTML = stages.map(stage => {
        const stageDisplay = stage.stage_display || (stage.stage || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const count = stage.count || stage.forms_count || 0;
        const avgTime = stage.avg_time_hours || stage.avg_time || 0;
        const approvalCount = stage.approval_count || stage.approved || 0;
        const returnCount = stage.return_count || stage.returned || 0;
        const approvalRate = stage.approval_rate || 0;
        
        return `
            <tr>
                <td>${escapeHtml(stageDisplay)}</td>
                <td>${count.toLocaleString()}</td>
                <td>${avgTime.toFixed(2)}</td>
                <td>${approvalCount.toLocaleString()}</td>
                <td>${returnCount.toLocaleString()}</td>
                <td>${approvalRate.toFixed(2)}%</td>
            </tr>
        `;
    }).join('');
    
    // Re-initialize sorting after rendering
    addTableSorting('workflow-table');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function addTableSorting(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const headers = table.querySelectorAll('thead th[data-sort]');
    headers.forEach(header => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', function() {
            const sortKey = this.getAttribute('data-sort');
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            
            const isAscending = !this.classList.contains('sort-asc');
            this.classList.toggle('sort-asc', isAscending);
            this.classList.toggle('sort-desc', !isAscending);
            
            headers.forEach(h => {
                if (h !== this) h.classList.remove('sort-asc', 'sort-desc');
            });
            
            rows.sort((a, b) => {
                const aText = a.cells[Array.from(headers).indexOf(this)]?.textContent.trim() || '';
                const bText = b.cells[Array.from(headers).indexOf(this)]?.textContent.trim() || '';
                const aNum = parseFloat(aText.replace(/[^0-9.-]/g, ''));
                const bNum = parseFloat(bText.replace(/[^0-9.-]/g, ''));
                
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return isAscending ? aNum - bNum : bNum - aNum;
                }
                return isAscending ? aText.localeCompare(bText) : bText.localeCompare(aText);
            });
            
            rows.forEach(row => tbody.appendChild(row));
        });
    });
}

function handleExport() {
    if (typeof ReportExport === 'undefined') {
        alert('Export functionality not available');
        return;
    }
    
    // Check if filters are on default
    const dateRangeText = document.getElementById('date-range-text')?.textContent || '';
    const statusDropdown = document.getElementById('status-dropdown');
    const selectedStatuses = statusDropdown ? Array.from(statusDropdown.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value) : [];
    
    const isDefaultDateRange = dateRangeText === 'Last 30 Days';
    const isDefaultStatus = selectedStatuses.length === 0;
    
    // If filters are default, export directly
    if (isDefaultDateRange && isDefaultStatus) {
        exportWorkflowTable();
        return;
    }
    
    // Show export modal
    showExportModal();
}

function showExportModal() {
    const modal = document.getElementById('export-modal');
    const filtersInfo = document.getElementById('export-filters-info');
    
    if (!modal || !filtersInfo) {
        // Fallback to direct export if modal not found
        exportWorkflowTable();
        return;
    }
    
    // Build filter info HTML
    let filterInfoHTML = '';
    
    // Date range info
    const filters = ReportFilters.collect();
    const dateRangeText = document.getElementById('date-range-text')?.textContent || '';
    if (filters.date_from && filters.date_to) {
        filterInfoHTML += `<div><strong>Date Range:</strong> ${filters.date_from} to ${filters.date_to}</div>`;
    } else if (dateRangeText) {
        filterInfoHTML += `<div><strong>Date Range:</strong> ${dateRangeText}</div>`;
    }
    
    // Status info
    const statusDropdown = document.getElementById('status-dropdown');
    const selectedStatuses = statusDropdown ? Array.from(statusDropdown.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value) : [];
    if (selectedStatuses.length > 0) {
        const statusLabels = {
            'draft': 'Draft',
            'pending': 'Pending',
            'approved': 'Approved',
            'returned': 'Returned',
            'completed': 'Completed'
        };
        const statusNames = selectedStatuses.map(s => statusLabels[s] || s).join(', ');
        filterInfoHTML += `<div><strong>Status:</strong> ${statusNames}</div>`;
    } else {
        filterInfoHTML += `<div><strong>Status:</strong> All Statuses</div>`;
    }
    
    filtersInfo.innerHTML = filterInfoHTML;
    
    // Show modal
    modal.style.display = 'flex';
    
    // Setup event listeners using event delegation to avoid duplicates
    const hideModal = () => {
        modal.style.display = 'none';
    };
    
    // Use event delegation on modal for all buttons
    modal.onclick = (e) => {
        const target = e.target;
        
        // Close button
        if (target.id === 'close-export-modal' || target.closest('#close-export-modal')) {
            hideModal();
            return;
        }
        
        // Cancel button
        if (target.id === 'cancel-export' || target.closest('#cancel-export')) {
            hideModal();
            return;
        }
        
        // Confirm button
        if (target.id === 'confirm-export' || target.closest('#confirm-export')) {
            exportWorkflowTable();
            hideModal();
            return;
        }
        
        // Backdrop click
        if (target === modal) {
            hideModal();
        }
    };
}

function exportWorkflowTable() {
    const table = document.getElementById('workflow-table');
    if (!table) return;
    
    // Get selected columns
    const exportStage = document.getElementById('export-stage')?.checked !== false;
    const exportCount = document.getElementById('export-count')?.checked !== false;
    const exportAvgTime = document.getElementById('export-avg-time')?.checked !== false;
    const exportApproved = document.getElementById('export-approved')?.checked !== false;
    const exportReturned = document.getElementById('export-returned')?.checked !== false;
    const exportApprovalRate = document.getElementById('export-approval-rate')?.checked !== false;
    
    // Get all headers and their indices
    const headers = Array.from(table.querySelectorAll('thead th'));
    const headerIndices = {
        'stage': headers.findIndex(h => h.getAttribute('data-sort') === 'stage'),
        'count': headers.findIndex(h => h.getAttribute('data-sort') === 'count'),
        'avg_time': headers.findIndex(h => h.getAttribute('data-sort') === 'avg_time'),
        'approval_count': headers.findIndex(h => h.getAttribute('data-sort') === 'approval_count'),
        'return_count': headers.findIndex(h => h.getAttribute('data-sort') === 'return_count'),
        'approval_rate': headers.findIndex(h => h.getAttribute('data-sort') === 'approval_rate')
    };
    
    // Build CSV headers
    const csvHeaders = [];
    const columnIndices = [];
    
    if (exportStage && headerIndices.stage >= 0) {
        csvHeaders.push('Stage');
        columnIndices.push(headerIndices.stage);
    }
    if (exportCount && headerIndices.count >= 0) {
        csvHeaders.push('Forms Count');
        columnIndices.push(headerIndices.count);
    }
    if (exportAvgTime && headerIndices.avg_time >= 0) {
        csvHeaders.push('Avg. Time (hours)');
        columnIndices.push(headerIndices.avg_time);
    }
    if (exportApproved && headerIndices.approval_count >= 0) {
        csvHeaders.push('Approved');
        columnIndices.push(headerIndices.approval_count);
    }
    if (exportReturned && headerIndices.return_count >= 0) {
        csvHeaders.push('Returned');
        columnIndices.push(headerIndices.return_count);
    }
    if (exportApprovalRate && headerIndices.approval_rate >= 0) {
        csvHeaders.push('Approval Rate (%)');
        columnIndices.push(headerIndices.approval_rate);
    }
    
    if (csvHeaders.length === 0) {
        alert('Please select at least one column to export');
        return;
    }
    
    // Get rows
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    
    // Build CSV content
    let csvContent = csvHeaders.join(',') + '\n';
    rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        const rowData = columnIndices.map(idx => {
            const cellText = cells[idx]?.textContent.trim() || '';
            return `"${cellText.replace(/"/g, '""')}"`;
        });
        csvContent += rowData.join(',') + '\n';
    });
    
    // Download CSV
    ReportExport.downloadCSV(csvContent, 'workflow_performance_' + new Date().toISOString().split('T')[0] + '.csv');
}

