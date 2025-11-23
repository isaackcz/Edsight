// Geographic Performance Page JavaScript
let currentPage = 1;
let pageSize = 100;
let totalCount = 0;
let searchTimeout = null;
let currentSearch = '';
let currentLevel = 'region';
let currentTableColumns = [];

document.addEventListener('DOMContentLoaded', function() {
    // Wait for ReportFilters to be initialized
    if (typeof ReportFilters === 'undefined') {
        console.error('ReportFilters not loaded');
        return;
    }
    
    initializeFilters();
    initializeSearch();
    initializePagination();
    loadGeographicData();
    
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
    
    const levelSelector = document.getElementById('level-selector');
    if (levelSelector) {
        currentLevel = levelSelector.value;
        levelSelector.addEventListener('change', function() {
            currentLevel = this.value;
            currentPage = 1; // Reset to first page when level changes
            loadGeographicData();
        });
    }
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
    
    ReportFilters.setDateRange('30days');
    updateDateRangeText('30days');
    
    selector.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });
    
    document.addEventListener('click', function(e) {
        if (!selector.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
    
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
                loadGeographicData();
            }
        });
    });
    
    if (closeModal) closeModal.addEventListener('click', () => customModal.style.display = 'none');
    if (cancelBtn) cancelBtn.addEventListener('click', () => customModal.style.display = 'none');
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
                loadGeographicData();
            }
        });
    }
}

function updateDateRangeText(range) {
    const textSpan = document.getElementById('date-range-text');
    if (!textSpan) return;
    const rangeTexts = {
        '7days': 'Last 7 Days', '30days': 'Last 30 Days', '90days': 'Last 90 Days',
        '6months': 'Last 6 Months', 'year': 'Last Year', 'all': 'All Time'
    };
    textSpan.textContent = rangeTexts[range] || 'Last 30 Days';
}

async function loadGeographicData() {
    try {
        const tbody = document.getElementById('geographic-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading geographic data...</td></tr>';
        }
        
        const filters = ReportFilters.collect();
        
        // Add pagination and search parameters
        const offset = (currentPage - 1) * pageSize;
        filters.limit = pageSize;
        filters.offset = offset;
        filters.search = currentSearch;
        filters.level = currentLevel;
        
        const response = await fetch('/api/reports/geographic-performance/', {
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
            renderGeographicTable(data.data, currentLevel);
            updatePagination();
        } else if (data.error) {
            console.error('API error:', data.error);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${data.error}</td></tr>`;
            }
        } else {
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No geographic data available</td></tr>';
            }
        }
    } catch (error) {
        console.error('Error loading geographic data:', error);
        const tbody = document.getElementById('geographic-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
        }
    }
}

function initializeSearch() {
    const searchInput = document.getElementById('geographic-search');
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
            loadGeographicData();
        }, 1500);
        
        // Show loading indicator while waiting
        const tbody = document.getElementById('geographic-tbody');
        if (tbody && searchValue !== currentSearch) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Searching...</td></tr>';
        }
    });
}

function initializePagination() {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadGeographicData();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalCount / pageSize);
            if (currentPage < totalPages) {
                currentPage++;
                loadGeographicData();
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
                loadGeographicData();
            });
            pageNumbers.appendChild(pageBtn);
        }
    }
}

function renderGeographicTable(data, level) {
    const tbody = document.getElementById('geographic-tbody');
    const headers = document.getElementById('geographic-headers');
    if (!tbody) return;
    
    let reportData = data.data || [];
    let headerColumns = [];
    
    if (level === 'region') {
        headerColumns = ['Region', 'Total Forms', 'Completed', 'Completion Rate (%)', 'Active Schools'];
    } else if (level === 'division') {
        headerColumns = ['Division', 'Region', 'Total Forms', 'Completed', 'Completion Rate (%)', 'Active Schools'];
    } else if (level === 'district') {
        headerColumns = ['District', 'Division', 'Region', 'Total Forms', 'Completed', 'Completion Rate (%)', 'Active Schools'];
    }
    
    // Store column names for export
    currentTableColumns = headerColumns;
    
    if (reportData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${headerColumns.length}" class="text-center">No geographic data available for the selected filters</td></tr>`;
        return;
    }
    
    if (headers) {
        headers.innerHTML = headerColumns.map((col, idx) => {
            const sortKey = col.toLowerCase().replace(/\s+/g, '_').replace('(%)', '').trim();
            return `<th data-sort="${sortKey}">${col}</th>`;
        }).join('');
    }
    
    tbody.innerHTML = reportData.map(item => {
        if (level === 'region') {
            return `
                <tr>
                    <td>${item.name || 'Unknown'}</td>
                    <td>${(item.total_forms || 0).toLocaleString()}</td>
                    <td>${(item.completed_forms || 0).toLocaleString()}</td>
                    <td>${(item.completion_rate || 0).toFixed(2)}%</td>
                    <td>${(item.active_schools || 0).toLocaleString()}</td>
                </tr>
            `;
        } else if (level === 'division') {
            return `
                <tr>
                    <td>${item.name || 'Unknown'}</td>
                    <td>${item.region_name || 'Unknown'}</td>
                    <td>${(item.total_forms || 0).toLocaleString()}</td>
                    <td>${(item.completed_forms || 0).toLocaleString()}</td>
                    <td>${(item.completion_rate || 0).toFixed(2)}%</td>
                    <td>${(item.active_schools || 0).toLocaleString()}</td>
                </tr>
            `;
        } else if (level === 'district') {
            return `
                <tr>
                    <td>${item.name || 'Unknown'}</td>
                    <td>${item.division_name || 'Unknown'}</td>
                    <td>${item.region_name || 'Unknown'}</td>
                    <td>${(item.total_forms || 0).toLocaleString()}</td>
                    <td>${(item.completed_forms || 0).toLocaleString()}</td>
                    <td>${(item.completion_rate || 0).toFixed(2)}%</td>
                    <td>${(item.active_schools || 0).toLocaleString()}</td>
                </tr>
            `;
        }
    }).join('');
    
    addTableSorting('geographic-table');
}

function handleExport() {
    const filters = ReportFilters.collect();
    const dateRange = filters.date_range || 'all';
    const dateFrom = filters.date_from || '';
    const dateTo = filters.date_to || '';
    const level = currentLevel;
    
    // Check if filters are default
    const isDefaultFilters = dateRange === 'all' && !dateFrom && !dateTo;
    
    if (isDefaultFilters) {
        // Export all data directly
        exportGeographicTableData();
    } else {
        // Show export modal with filter info
        showExportModal(filters, level);
    }
}

function showExportModal(filters, level) {
    const modal = document.getElementById('export-modal');
    const filterInfo = document.getElementById('export-filter-info');
    const columnsCheckboxes = document.getElementById('export-columns-checkboxes');
    const closeBtn = document.getElementById('close-export-modal');
    const cancelBtn = document.getElementById('cancel-export');
    const confirmBtn = document.getElementById('confirm-export');
    
    if (!modal) return;
    
    // Build filter info text
    let filterText = 'Exporting data with filters:\n';
    if (filters.date_range && filters.date_range !== 'all') {
        const rangeTexts = {
            '7days': 'Last 7 Days',
            '30days': 'Last 30 Days',
            '90days': 'Last 90 Days',
            '6months': 'Last 6 Months',
            'year': 'Last Year'
        };
        filterText += `• Date Range: ${rangeTexts[filters.date_range] || filters.date_range}\n`;
    }
    if (filters.date_from && filters.date_to) {
        filterText += `• Custom Range: ${filters.date_from} to ${filters.date_to}\n`;
    }
    filterText += `• Level: ${level.charAt(0).toUpperCase() + level.slice(1)}\n`;
    if (currentSearch) {
        filterText += `• Search: "${currentSearch}"\n`;
    }
    
    if (filterInfo) {
        filterInfo.textContent = filterText;
    }
    
    // Create checkboxes for columns
    if (columnsCheckboxes) {
        columnsCheckboxes.innerHTML = currentTableColumns.map((col, idx) => `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${idx}" id="export-col-${idx}" checked>
                <label class="form-check-label" for="export-col-${idx}">
                    ${col}
                </label>
            </div>
        `).join('');
    }
    
    // Clone and replace buttons to prevent duplicate listeners
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    if (confirmBtn) {
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        newConfirmBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            exportGeographicTableData();
        });
    }
    
    // Close on backdrop click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    modal.style.display = 'flex';
}

function exportGeographicTableData() {
    const table = document.getElementById('geographic-table');
    if (!table) return;
    
    const headers = table.querySelectorAll('thead th');
    const rows = table.querySelectorAll('tbody tr');
    const selectedColumns = Array.from(document.querySelectorAll('#export-columns-checkboxes input[type="checkbox"]:checked'))
        .map(cb => parseInt(cb.value));
    
    if (selectedColumns.length === 0) {
        alert('Please select at least one column to export');
        return;
    }
    
    // Build CSV content
    let csv = [];
    
    // Headers
    const headerRow = Array.from(headers)
        .filter((_, idx) => selectedColumns.includes(idx))
        .map(th => `"${th.textContent.trim()}"`)
        .join(',');
    csv.push(headerRow);
    
    // Data rows
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const dataRow = Array.from(cells)
            .filter((_, idx) => selectedColumns.includes(idx))
            .map(td => {
                const text = td.textContent.trim();
                return `"${text.replace(/"/g, '""')}"`;
            })
            .join(',');
        csv.push(dataRow);
    });
    
    // Download CSV
    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const filters = ReportFilters.collect();
    const dateRange = filters.date_range || 'all';
    const dateFrom = filters.date_from || '';
    const dateTo = filters.date_to || '';
    let filename = 'geographic_performance';
    if (dateFrom && dateTo) {
        filename += `_${dateFrom}_to_${dateTo}`;
    } else if (dateRange !== 'all') {
        filename += `_${dateRange}`;
    }
    filename += `_${currentLevel}`;
    if (currentSearch) {
        filename += `_search_${currentSearch.substring(0, 20)}`;
    }
    filename += '.csv';
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

function addTableSorting(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const headers = table.querySelectorAll('thead th[data-sort]');
    headers.forEach(header => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', function() {
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            
            const isAscending = !this.classList.contains('sort-asc');
            this.classList.toggle('sort-asc', isAscending);
            this.classList.toggle('sort-desc', !isAscending);
            
            headers.forEach(h => {
                if (h !== this) h.classList.remove('sort-asc', 'sort-desc');
            });
            
            const colIndex = Array.from(headers).indexOf(this);
            rows.sort((a, b) => {
                const aText = a.cells[colIndex]?.textContent.trim() || '';
                const bText = b.cells[colIndex]?.textContent.trim() || '';
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

