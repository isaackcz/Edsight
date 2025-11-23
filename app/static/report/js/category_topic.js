// Category & Topic Analysis Page JavaScript
let currentPage = 1;
let pageSize = 100;
let totalCount = 0;
let searchTimeout = null;
let currentSearch = '';
let currentTableColumns = ['Category', 'Topic', 'Total Questions', 'Started (Continuing / Finished)', 'Not Started'];

document.addEventListener('DOMContentLoaded', function() {
    // Wait for ReportFilters to be initialized
    if (typeof ReportFilters === 'undefined') {
        console.error('ReportFilters not loaded');
        return;
    }
    
    initializeFilters();
    initializeSearch();
    initializePagination();
    loadCategoryTopicData();
    
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
    initializeCategoryTopicAutocomplete();
}

function initializeCategoryTopicAutocomplete() {
    const DEBOUNCE_DELAY = 300;
    
    // Category autocomplete - shows all categories
    const categoryInput = document.getElementById('category-filter');
    const categoryHidden = document.getElementById('category-filter-id');
    const categoryDropdown = document.getElementById('category-autocomplete-dropdown');
    
    if (categoryInput && categoryHidden && categoryDropdown) {
        let categoryDebounce;
        categoryInput.addEventListener('input', function() {
            clearTimeout(categoryDebounce);
            const query = this.value.trim();
            
            if (query.length < 1) {
                hideAutocomplete(categoryDropdown);
                clearCategoryTopicSelection('category');
                return;
            }
            
            categoryDebounce = setTimeout(() => {
                searchCategory(query, categoryDropdown, categoryInput, categoryHidden);
            }, DEBOUNCE_DELAY);
        });
        
        categoryInput.addEventListener('focus', function() {
            const query = this.value.trim();
            if (query.length >= 1) {
                searchCategory(query, categoryDropdown, categoryInput, categoryHidden);
            }
        });
        
        categoryInput.addEventListener('blur', function() {
            setTimeout(() => hideAutocomplete(categoryDropdown), 200);
        });
    }
    
    // Topic autocomplete - shows topics based on selected category
    const topicInput = document.getElementById('topic-filter');
    const topicHidden = document.getElementById('topic-filter-id');
    const topicDropdown = document.getElementById('topic-autocomplete-dropdown');
    
    if (topicInput && topicHidden && topicDropdown) {
        let topicDebounce;
        topicInput.addEventListener('input', function() {
            if (this.disabled) return;
            clearTimeout(topicDebounce);
            const query = this.value.trim();
            const categoryId = categoryHidden?.value;
            
            if (!categoryId) {
                hideAutocomplete(topicDropdown);
                return;
            }
            
            if (query.length < 1) {
                hideAutocomplete(topicDropdown);
                clearCategoryTopicSelection('topic');
                return;
            }
            
            topicDebounce = setTimeout(() => {
                searchTopic(query, categoryId, topicDropdown, topicInput, topicHidden);
            }, DEBOUNCE_DELAY);
        });
        
        topicInput.addEventListener('focus', function() {
            if (this.disabled) return;
            const query = this.value.trim();
            const categoryId = categoryHidden?.value;
            if (query.length >= 1 && categoryId) {
                searchTopic(query, categoryId, topicDropdown, topicInput, topicHidden);
            }
        });
        
        topicInput.addEventListener('blur', function() {
            setTimeout(() => hideAutocomplete(topicDropdown), 200);
        });
    }
}

async function searchCategory(query, dropdown, input, hidden) {
    try {
        const response = await fetch(`/api/user-management/search/categories/?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            renderAutocomplete(dropdown, data.results, input, hidden, 'category');
            showAutocomplete(dropdown);
        } else {
            hideAutocomplete(dropdown);
        }
    } catch (error) {
        console.error('Error searching categories:', error);
        hideAutocomplete(dropdown);
    }
}

async function searchTopic(query, categoryId, dropdown, input, hidden) {
    try {
        const response = await fetch(`/api/user-management/search/topics/?q=${encodeURIComponent(query)}&category_id=${categoryId}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            renderAutocomplete(dropdown, data.results, input, hidden, 'topic');
            showAutocomplete(dropdown);
        } else {
            hideAutocomplete(dropdown);
        }
    } catch (error) {
        console.error('Error searching topics:', error);
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
            if (type === 'category') {
                // Clear topic when category changes
                clearCategoryTopicSelection('topic');
                // Enable topic input
                const topicInput = document.getElementById('topic-filter');
                if (topicInput) {
                    topicInput.disabled = false;
                    topicInput.placeholder = 'Type to search topics...';
                }
            }
            
            // Update filters and reload data
            updateCategoryTopicFilters();
            currentPage = 1;
            loadCategoryTopicData();
        });
    });
}

function clearCategoryTopicSelection(type) {
    if (type === 'category') {
        const categoryInput = document.getElementById('category-filter');
        const categoryHidden = document.getElementById('category-filter-id');
        if (categoryInput) categoryInput.value = '';
        if (categoryHidden) categoryHidden.value = '';
        // Disable topic
        const topicInput = document.getElementById('topic-filter');
        if (topicInput) {
            topicInput.disabled = true;
            topicInput.value = '';
            topicInput.placeholder = 'Select category first';
        }
        const topicHidden = document.getElementById('topic-filter-id');
        if (topicHidden) topicHidden.value = '';
    } else if (type === 'topic') {
        const topicInput = document.getElementById('topic-filter');
        const topicHidden = document.getElementById('topic-filter-id');
        if (topicInput) topicInput.value = '';
        if (topicHidden) topicHidden.value = '';
    }
}

function updateCategoryTopicFilters() {
    const categoryId = document.getElementById('category-filter-id')?.value;
    const topicId = document.getElementById('topic-filter-id')?.value;
    
    ReportFilters.set('category', categoryId ? [parseInt(categoryId)] : null);
    ReportFilters.set('topic', topicId ? [parseInt(topicId)] : null);
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
    
    // Set default to 'all' to show all data, but API will limit to 100 rows per page
    ReportFilters.setDateRange('all');
    updateDateRangeText('all');
    
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
                loadCategoryTopicData();
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
                loadCategoryTopicData();
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
    textSpan.textContent = rangeTexts[range] || 'All Time';
}

function initializeSearch() {
    const searchInput = document.getElementById('category-topic-search');
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
            loadCategoryTopicData();
        }, 1500);
        
        // Show loading indicator while waiting
        const tbody = document.getElementById('category-topic-tbody');
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
                loadCategoryTopicData();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalCount / pageSize);
            if (currentPage < totalPages) {
                currentPage++;
                loadCategoryTopicData();
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
                loadCategoryTopicData();
            });
            pageNumbers.appendChild(pageBtn);
        }
    }
}

async function loadCategoryTopicData() {
    try {
        const tbody = document.getElementById('category-topic-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading category/topic data...</td></tr>';
        }
        
        const filters = ReportFilters.collect();
        
        // Get category and topic IDs from hidden inputs
        const categoryId = document.getElementById('category-filter-id')?.value;
        const topicId = document.getElementById('topic-filter-id')?.value;
        
        // Convert to arrays (backend expects category_ids, topic_ids)
        // Only add to filters if they have values (not empty strings)
        if (categoryId) {
            filters.category_ids = [parseInt(categoryId)];
        } else {
            // Remove category_ids if no category selected
            delete filters.category_ids;
        }
        if (topicId) {
            filters.topic_ids = [parseInt(topicId)];
        } else {
            // Remove topic_ids if no topic selected
            delete filters.topic_ids;
        }
        
        // Also handle legacy format if present
        if (filters.category) {
            filters.category_ids = Array.isArray(filters.category) ? filters.category : [filters.category];
            delete filters.category;
        }
        if (filters.topic) {
            filters.topic_ids = Array.isArray(filters.topic) ? filters.topic : [filters.topic];
            delete filters.topic;
        }
        
        // Always add pagination parameters - limit to 100 rows per page even when showing all data
        const offset = (currentPage - 1) * pageSize;
        filters.limit = pageSize; // Always 100 rows per page
        filters.offset = offset;
        
        // Only add search if it has a value
        if (currentSearch) {
            filters.search = currentSearch;
        } else {
            delete filters.search;
        }
        
        const response = await fetch('/api/reports/category-topic/', {
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
        
        console.log('Category topic API response:', data);
        
        if (data.success && data.data) {
            totalCount = data.data.total_count || 0;
            console.log('Total count:', totalCount, 'Topic completion:', data.data.topic_completion?.length);
            renderCategoryTopicTable(data.data);
            updatePagination();
        } else if (data.error) {
            console.error('API error:', data.error);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${data.error}</td></tr>`;
            }
        } else {
            console.warn('No data in response:', data);
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No category/topic data available</td></tr>';
            }
        }
    } catch (error) {
        console.error('Error loading category/topic data:', error);
        const tbody = document.getElementById('category-topic-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
        }
    }
}

function renderCategoryTopicTable(data) {
    const tbody = document.getElementById('category-topic-tbody');
    if (!tbody || !data.topic_completion) return;
    
    if (data.topic_completion.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No category/topic data available for the selected filters</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.topic_completion.map(topic => {
        const started = topic.started || 0;
        const continuing = topic.continuing || 0;
        const finished = topic.finished || 0;
        const notStarted = topic.not_started || 0;
        const totalSchools = started + notStarted;
        
        // Format: "Started (Continuing / Finished)"
        const statusText = totalSchools > 0 
            ? `${started} (${continuing} / ${finished})`
            : '0 (0 / 0)';
        
        return `
            <tr>
                <td>${topic.category_name || 'Unknown'}</td>
                <td>${topic.topic_name || 'Unknown'}</td>
                <td>${topic.total_questions || 0}</td>
                <td>${statusText}</td>
                <td>${notStarted}</td>
            </tr>
        `;
    }).join('');
    
    addTableSorting('category-topic-table');
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

function handleExport() {
    const filters = ReportFilters.collect();
    const dateRange = filters.date_range || 'all';
    const dateFrom = filters.date_from || '';
    const dateTo = filters.date_to || '';
    const categoryId = document.getElementById('category-filter-id')?.value || '';
    const topicId = document.getElementById('topic-filter-id')?.value || '';
    const categoryName = document.getElementById('category-filter')?.value || '';
    const topicName = document.getElementById('topic-filter')?.value || '';
    
    // Check if filters are default
    const isDefaultFilters = dateRange === 'all' && !dateFrom && !dateTo && !categoryId && !topicId && !currentSearch;
    
    if (isDefaultFilters) {
        // Export all data directly
        exportCategoryTopicTableData();
    } else {
        // Show export modal with filter info
        showExportModal(filters, categoryName, topicName);
    }
}

function showExportModal(filters, categoryName, topicName) {
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
    if (categoryName) {
        filterText += `• Category: ${categoryName}\n`;
    }
    if (topicName) {
        filterText += `• Topic: ${topicName}\n`;
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
            exportCategoryTopicTableData();
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

function exportCategoryTopicTableData() {
    const table = document.getElementById('category-topic-table');
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
    let filename = 'category_topic_analysis';
    if (dateFrom && dateTo) {
        filename += `_${dateFrom}_to_${dateTo}`;
    } else if (dateRange !== 'all') {
        filename += `_${dateRange}`;
    }
    const categoryId = document.getElementById('category-filter-id')?.value || '';
    const topicId = document.getElementById('topic-filter-id')?.value || '';
    if (categoryId) filename += `_category_${categoryId}`;
    if (topicId) filename += `_topic_${topicId}`;
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
