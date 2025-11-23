// School Performance Page JavaScript
let currentPage = 1;
let pageSize = 100;
let totalCount = 0;
let searchTimeout = null;
let currentSearch = '';
let currentTableColumns = ['School Name', 'School Code', 'Region', 'Division', 'District', 'Total Forms', 'Completed', 'Completion Rate (%)', 'Last Activity'];
let filterOptions = {};

document.addEventListener('DOMContentLoaded', function() {
    // Wait for ReportFilters to be initialized
    if (typeof ReportFilters === 'undefined') {
        console.error('ReportFilters not loaded');
        return;
    }
    
    initializeFilters();
    initializeSearch();
    initializePagination();
    loadSchoolsData();
    
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
    initializeGeographicAutocomplete();
}

function initializeGeographicAutocomplete() {
    const DEBOUNCE_DELAY = 300;
    let debounceTimers = {};
    
    // Region autocomplete - shows all regions
    const regionInput = document.getElementById('region-filter');
    const regionHidden = document.getElementById('region-filter-id');
    const regionDropdown = document.getElementById('region-autocomplete-dropdown');
    
    if (regionInput && regionHidden && regionDropdown) {
        let regionDebounce;
        regionInput.addEventListener('input', function() {
            clearTimeout(regionDebounce);
            const query = this.value.trim();
            
            if (query.length < 1) {
                hideAutocomplete(regionDropdown);
                clearGeographicSelection('region');
                return;
            }
            
            regionDebounce = setTimeout(() => {
                searchRegion(query, regionDropdown, regionInput, regionHidden);
            }, DEBOUNCE_DELAY);
        });
        
        regionInput.addEventListener('focus', function() {
            const query = this.value.trim();
            if (query.length >= 1) {
                searchRegion(query, regionDropdown, regionInput, regionHidden);
            }
        });
        
        regionInput.addEventListener('blur', function() {
            setTimeout(() => hideAutocomplete(regionDropdown), 200);
        });
    }
    
    // Division autocomplete - shows divisions based on selected region
    const divisionInput = document.getElementById('division-filter');
    const divisionHidden = document.getElementById('division-filter-id');
    const divisionDropdown = document.getElementById('division-autocomplete-dropdown');
    
    if (divisionInput && divisionHidden && divisionDropdown) {
        let divisionDebounce;
        divisionInput.addEventListener('input', function() {
            if (this.disabled) return;
            clearTimeout(divisionDebounce);
            const query = this.value.trim();
            const regionId = regionHidden?.value;
            
            if (!regionId) {
                hideAutocomplete(divisionDropdown);
                return;
            }
            
            if (query.length < 1) {
                hideAutocomplete(divisionDropdown);
                clearGeographicSelection('division');
                return;
            }
            
            divisionDebounce = setTimeout(() => {
                searchDivision(query, regionId, divisionDropdown, divisionInput, divisionHidden);
            }, DEBOUNCE_DELAY);
        });
        
        divisionInput.addEventListener('focus', function() {
            if (this.disabled) return;
            const query = this.value.trim();
            const regionId = regionHidden?.value;
            if (query.length >= 1 && regionId) {
                searchDivision(query, regionId, divisionDropdown, divisionInput, divisionHidden);
            }
        });
        
        divisionInput.addEventListener('blur', function() {
            setTimeout(() => hideAutocomplete(divisionDropdown), 200);
        });
    }
    
    // District autocomplete - shows districts based on selected division
    const districtInput = document.getElementById('district-filter');
    const districtHidden = document.getElementById('district-filter-id');
    const districtDropdown = document.getElementById('district-autocomplete-dropdown');
    
    if (districtInput && districtHidden && districtDropdown) {
        let districtDebounce;
        districtInput.addEventListener('input', function() {
            if (this.disabled) return;
            clearTimeout(districtDebounce);
            const query = this.value.trim();
            const divisionId = divisionHidden?.value;
            
            if (!divisionId) {
                hideAutocomplete(districtDropdown);
                return;
            }
            
            if (query.length < 1) {
                hideAutocomplete(districtDropdown);
                clearGeographicSelection('district');
                return;
            }
            
            districtDebounce = setTimeout(() => {
                searchDistrict(query, divisionId, districtDropdown, districtInput, districtHidden);
            }, DEBOUNCE_DELAY);
        });
        
        districtInput.addEventListener('focus', function() {
            if (this.disabled) return;
            const query = this.value.trim();
            const divisionId = divisionHidden?.value;
            if (query.length >= 1 && divisionId) {
                searchDistrict(query, divisionId, districtDropdown, districtInput, districtHidden);
            }
        });
        
        districtInput.addEventListener('blur', function() {
            setTimeout(() => hideAutocomplete(districtDropdown), 200);
        });
    }
}

async function searchRegion(query, dropdown, input, hidden) {
    try {
        const response = await fetch(`/api/user-management/search/regions/?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            renderAutocomplete(dropdown, data.results, input, hidden, 'region');
            showAutocomplete(dropdown);
        } else {
            hideAutocomplete(dropdown);
        }
    } catch (error) {
        console.error('Error searching regions:', error);
        hideAutocomplete(dropdown);
    }
}

async function searchDivision(query, regionId, dropdown, input, hidden) {
    try {
        const response = await fetch(`/api/user-management/search/divisions/?q=${encodeURIComponent(query)}&region_id=${regionId}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            renderAutocomplete(dropdown, data.results, input, hidden, 'division');
            showAutocomplete(dropdown);
        } else {
            hideAutocomplete(dropdown);
        }
    } catch (error) {
        console.error('Error searching divisions:', error);
        hideAutocomplete(dropdown);
    }
}

async function searchDistrict(query, divisionId, dropdown, input, hidden) {
    try {
        const response = await fetch(`/api/user-management/search/districts/?q=${encodeURIComponent(query)}&division_id=${divisionId}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            renderAutocomplete(dropdown, data.results, input, hidden, 'district');
            showAutocomplete(dropdown);
        } else {
            hideAutocomplete(dropdown);
        }
    } catch (error) {
        console.error('Error searching districts:', error);
        hideAutocomplete(dropdown);
    }
}

function renderAutocomplete(dropdown, results, input, hidden, type) {
    let html = '';
    results.forEach(result => {
        html += `
            <div class="autocomplete-item" data-id="${result.id}" data-name="${result.name}">
                ${escapeHtml(result.name)}
            </div>
        `;
    });
    
    dropdown.innerHTML = html;
    
    // Add click handlers
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            const name = this.getAttribute('data-name');
            
            input.value = name;
            hidden.value = id;
            
            hideAutocomplete(dropdown);
            
            // Handle cascading behavior
            if (type === 'region') {
                // Clear division and district when region changes
                clearGeographicSelection('division');
                clearGeographicSelection('district');
                // Enable division input
                const divisionInput = document.getElementById('division-filter');
                if (divisionInput) {
                    divisionInput.disabled = false;
                    divisionInput.placeholder = 'Type to search divisions...';
                }
            } else if (type === 'division') {
                // Clear district when division changes
                clearGeographicSelection('district');
                // Enable district input
                const districtInput = document.getElementById('district-filter');
                if (districtInput) {
                    districtInput.disabled = false;
                    districtInput.placeholder = 'Type to search districts...';
                }
            }
            
            // Update filters and reload data
            updateGeographicFilters();
            currentPage = 1;
            loadSchoolsData();
        });
    });
}

function clearGeographicSelection(type) {
    if (type === 'region') {
        const regionInput = document.getElementById('region-filter');
        const regionHidden = document.getElementById('region-filter-id');
        if (regionInput) regionInput.value = '';
        if (regionHidden) regionHidden.value = '';
        // Disable division and district
        const divisionInput = document.getElementById('division-filter');
        const districtInput = document.getElementById('district-filter');
        if (divisionInput) {
            divisionInput.disabled = true;
            divisionInput.value = '';
            divisionInput.placeholder = 'Select region first';
        }
        if (districtInput) {
            districtInput.disabled = true;
            districtInput.value = '';
            districtInput.placeholder = 'Select division first';
        }
        const divisionHidden = document.getElementById('division-filter-id');
        const districtHidden = document.getElementById('district-filter-id');
        if (divisionHidden) divisionHidden.value = '';
        if (districtHidden) districtHidden.value = '';
    } else if (type === 'division') {
        const divisionInput = document.getElementById('division-filter');
        const divisionHidden = document.getElementById('division-filter-id');
        if (divisionInput) divisionInput.value = '';
        if (divisionHidden) divisionHidden.value = '';
        // Disable district
        const districtInput = document.getElementById('district-filter');
        if (districtInput) {
            districtInput.disabled = true;
            districtInput.value = '';
            districtInput.placeholder = 'Select division first';
        }
        const districtHidden = document.getElementById('district-filter-id');
        if (districtHidden) districtHidden.value = '';
    } else if (type === 'district') {
        const districtInput = document.getElementById('district-filter');
        const districtHidden = document.getElementById('district-filter-id');
        if (districtInput) districtInput.value = '';
        if (districtHidden) districtHidden.value = '';
    }
}

function updateGeographicFilters() {
    const regionId = document.getElementById('region-filter-id')?.value;
    const divisionId = document.getElementById('division-filter-id')?.value;
    const districtId = document.getElementById('district-filter-id')?.value;
    
    ReportFilters.set('region', regionId ? [parseInt(regionId)] : null);
    ReportFilters.set('division', divisionId ? [parseInt(divisionId)] : null);
    ReportFilters.set('district', districtId ? [parseInt(districtId)] : null);
}

function showAutocomplete(dropdown) {
    if (dropdown) {
        dropdown.classList.add('show');
    }
}

function hideAutocomplete(dropdown) {
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
                loadSchoolsData();
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
                loadSchoolsData();
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

async function loadSchoolsData() {
    try {
        const tbody = document.getElementById('schools-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">Loading school data...</td></tr>';
        }
        
        const filters = ReportFilters.collect();
        
        // Convert geographic filters to arrays (backend expects region_ids, division_ids, district_ids)
        // Get values from hidden inputs (autocomplete)
        const regionId = document.getElementById('region-filter-id')?.value;
        const divisionId = document.getElementById('division-filter-id')?.value;
        const districtId = document.getElementById('district-filter-id')?.value;
        
        if (regionId) {
            filters.region_ids = [parseInt(regionId)];
        }
        if (divisionId) {
            filters.division_ids = [parseInt(divisionId)];
        }
        if (districtId) {
            filters.district_ids = [parseInt(districtId)];
        }
        
        // Also handle legacy format if present
        if (filters.region) {
            filters.region_ids = Array.isArray(filters.region) ? filters.region : [filters.region];
            delete filters.region;
        }
        if (filters.division) {
            filters.division_ids = Array.isArray(filters.division) ? filters.division : [filters.division];
            delete filters.division;
        }
        if (filters.district) {
            filters.district_ids = Array.isArray(filters.district) ? filters.district : [filters.district];
            delete filters.district;
        }
        
        // Add pagination and search parameters
        const offset = (currentPage - 1) * pageSize;
        filters.limit = pageSize;
        filters.offset = offset;
        filters.search = currentSearch;
        
        const response = await fetch('/api/reports/school-performance/', {
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
            renderSchoolsTable(data.data);
            updatePagination();
        } else if (data.error) {
            console.error('API error:', data.error);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Error: ${data.error}</td></tr>`;
            }
        } else {
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="9" class="text-center">No school data available</td></tr>';
            }
        }
    } catch (error) {
        console.error('Error loading schools data:', error);
        const tbody = document.getElementById('schools-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
        }
    }
}

function initializeSearch() {
    const searchInput = document.getElementById('schools-search');
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
            loadSchoolsData();
        }, 1500);
        
        // Show loading indicator while waiting
        const tbody = document.getElementById('schools-tbody');
        if (tbody && searchValue !== currentSearch) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">Searching...</td></tr>';
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
                loadSchoolsData();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalCount / pageSize);
            if (currentPage < totalPages) {
                currentPage++;
                loadSchoolsData();
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
                loadSchoolsData();
            });
            pageNumbers.appendChild(pageBtn);
        }
    }
}

function renderSchoolsTable(data) {
    const tbody = document.getElementById('schools-tbody');
    if (!tbody || !data.schools) return;
    
    if (data.schools.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No school data available for the selected filters</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.schools.map(school => {
        const lastActivity = school.last_activity ? new Date(school.last_activity).toLocaleDateString() : 'Never';
        const daysSince = school.days_since_activity !== null ? `${school.days_since_activity} days ago` : 'N/A';
        const activityClass = !school.has_activity ? 'text-muted' : (school.days_since_activity > 30 ? 'text-warning' : '');
        
        return `
            <tr>
                <td>${school.school_name || 'Unknown'}</td>
                <td>${school.school_code || ''}</td>
                <td>${school.region_name || 'Unknown'}</td>
                <td>${school.division_name || 'Unknown'}</td>
                <td>${school.district_name || 'Unknown'}</td>
                <td>${(school.total_forms || 0).toLocaleString()}</td>
                <td>${(school.completed_forms || 0).toLocaleString()}</td>
                <td>${(school.completion_rate || 0).toFixed(2)}%</td>
                <td class="${activityClass}">${lastActivity} ${school.has_activity ? `(${daysSince})` : ''}</td>
            </tr>
        `;
    }).join('');
    
    addTableSorting('schools-table');
}

function handleExport() {
    const filters = ReportFilters.collect();
    const dateRange = filters.date_range || 'all';
    const dateFrom = filters.date_from || '';
    const dateTo = filters.date_to || '';
    const regionId = document.getElementById('region-filter-id')?.value || '';
    const divisionId = document.getElementById('division-filter-id')?.value || '';
    const districtId = document.getElementById('district-filter-id')?.value || '';
    const regionName = document.getElementById('region-filter')?.value || '';
    const divisionName = document.getElementById('division-filter')?.value || '';
    const districtName = document.getElementById('district-filter')?.value || '';
    
    // Check if filters are default
    const isDefaultFilters = dateRange === 'all' && !dateFrom && !dateTo && !regionId && !divisionId && !districtId && !currentSearch;
    
    if (isDefaultFilters) {
        // Export all data directly
        exportSchoolsTableData();
    } else {
        // Show export modal with filter info
        showExportModal(filters, regionName, divisionName, districtName);
    }
}

function showExportModal(filters, regionName, divisionName, districtName) {
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
    if (regionName) {
        filterText += `• Region: ${regionName}\n`;
    }
    if (divisionName) {
        filterText += `• Division: ${divisionName}\n`;
    }
    if (districtName) {
        filterText += `• District: ${districtName}\n`;
    }
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
            exportSchoolsTableData();
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

function exportSchoolsTableData() {
    const table = document.getElementById('schools-table');
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
    let filename = 'school_performance';
    if (dateFrom && dateTo) {
        filename += `_${dateFrom}_to_${dateTo}`;
    } else if (dateRange !== 'all') {
        filename += `_${dateRange}`;
    }
    const regionId = document.getElementById('region-filter-id')?.value || '';
    const divisionId = document.getElementById('division-filter-id')?.value || '';
    const districtId = document.getElementById('district-filter-id')?.value || '';
    if (regionId) filename += `_region_${regionId}`;
    if (divisionId) filename += `_division_${divisionId}`;
    if (districtId) filename += `_district_${districtId}`;
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

