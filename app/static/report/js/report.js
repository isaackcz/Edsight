// New Report Tables JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize mobile sidebar functionality
    initializeMobileSidebar();
    
    // Initialize the new report system
    initializeReportTables();
    
    // Legacy menu toggle support
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }
    
    // Load initial data
    loadReportData().then(initializeFilters).catch(console.error);
    
    // Close search results when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-filter-container')) {
            closeAllDropdowns();
        }
    });
});

// Sneat Mobile Sidebar Functions
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        
        // Prevent body scroll when sidebar is open
        if (sidebar.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
}

function initializeMobileSidebar() {
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        const sidebar = document.querySelector('.sidebar');
        const mobileToggle = document.querySelector('.mobile-menu-toggle');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (window.innerWidth <= 768 && 
            sidebar && 
            sidebar.classList.contains('active') && 
            !sidebar.contains(e.target) && 
            !mobileToggle.contains(e.target)) {
            
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (window.innerWidth > 768 && sidebar) {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}




// Theme switching logic removed - project does not support dark mode

let charts = {};

function initCharts() {
    // Common Chart Options
    Chart.defaults.font.family = "'Segoe UI', 'Public Sans', sans-serif";
    Chart.defaults.scale.grid.color = 'rgba(225,225,225,0.6)';
    Chart.defaults.scale.grid.borderColor = 'transparent';
    
    // Charts removed - no longer needed
    // Completion Rates by School, Forms Completed Per Day, and Response Distribution charts have been removed
}

async function fetchAnalyticsBundle() {
    const payload = collectFilters();
    const res = await fetch('/api/analytics/bundle/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        console.error('Failed to load analytics:', res.status, res.statusText);
        if (res.status === 401 || res.status === 403) {
            alert('Please log in to access the analytics dashboard.');
            window.location.href = '/auth/login/';
            return;
        }
        throw new Error('Failed to load analytics');
    }
    const text = await res.text();
    try {
        return JSON.parse(text);
        } catch (parseError) {
            console.error('Failed to parse analytics JSON:', text.substring(0, 200));
            if (text.includes('<!DOCTYPE html>')) {
                alert('Please log in to access the analytics dashboard.');
                window.location.href = '/auth/login/';
                return;
            }
            throw new Error('Invalid response format');
        }
}

// Global variables for data storage
let reportData = {
    schoolCompletion: [],
    categoryContent: [],
    filterOptions: {},
    currentFilters: {
        completion: {},
        category: {}
    }
};

let sortState = {
    completion: { key: null, direction: 'asc' },
    category: { key: null, direction: 'asc' }
};

let paginationState = {
    completion: { currentPage: 1, pageSize: 50, totalItems: 0 },
    category: { currentPage: 1, pageSize: 50, totalItems: 0 }
};

// Initialize report tables
function initializeReportTables() {
    // Initialize event listeners for School Completion table
    initializeCompletionTableEvents();
    
    // Initialize event listeners for Category Content table
    initializeCategoryTableEvents();
    
    // Initialize export functionality
    initializeExportEvents();
}

function initializeCompletionTableEvents() {
    // Search functionality
    const completionSearch = document.getElementById('completion-search');
    if (completionSearch) {
        completionSearch.addEventListener('input', debounce(function() {
            filterCompletionTable();
        }, 300));
    }
    
    // Search filter inputs
    const searchFilterElements = ['filter-region', 'filter-division', 'filter-district', 'filter-school'];
    searchFilterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            initializeSearchFilter(element);
        }
    });
    
    // Table sorting - initialize after DOM is ready
    setTimeout(() => {
        initializeCompletionTableSorting();
        initializeCompletionPagination();
    }, 100);
}

function initializeCompletionTableSorting() {
    const completionTable = document.querySelector('#school-completion-table-body')?.closest('table');
    if (completionTable) {
        const headers = completionTable.querySelectorAll('thead th[data-sort]');
        headers.forEach(header => {
            header.addEventListener('click', function() {
                sortCompletionTable(this.getAttribute('data-sort'));
            });
            // Add cursor pointer style
            header.style.cursor = 'pointer';
        });
    }
}

function initializeCategoryTableEvents() {
    // Search functionality
    const categorySearch = document.getElementById('category-search');
    if (categorySearch) {
        categorySearch.addEventListener('input', debounce(function() {
            filterCategoryTable();
        }, 300));
    }
    
    // Geographic search filters
    const geoElements = ['geo-region', 'geo-division', 'geo-district', 'geo-school'];
    geoElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            initializeSearchFilter(element);
        }
    });
    
    // Content search filters
    const contentElements = ['filter-category', 'filter-subsection', 'filter-topic', 'filter-question', 'filter-subquestion'];
    contentElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            initializeSearchFilter(element);
        }
    });
    
    
    // Table sorting - initialize after DOM is ready
    setTimeout(() => {
        initializeCategoryTableSorting();
        initializeCategoryPagination();
    }, 100);
}

function initializeCategoryTableSorting() {
    const categoryTable = document.querySelector('#category-content-table-body')?.closest('table');
    if (categoryTable) {
        const headers = categoryTable.querySelectorAll('thead th[data-sort]');
        headers.forEach(header => {
            header.addEventListener('click', function() {
                sortCategoryTable(this.getAttribute('data-sort'));
            });
            // Add cursor pointer style
            header.style.cursor = 'pointer';
        });
    }
}

function initializeCompletionPagination() {
    // Page size selector
    const pageSizeSelect = document.getElementById('completion-page-size');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', function() {
            paginationState.completion.pageSize = parseInt(this.value);
            paginationState.completion.currentPage = 1;
            renderCompletionTable();
        });
    }
    
    // Navigation buttons
    document.getElementById('completion-first-page')?.addEventListener('click', () => {
        paginationState.completion.currentPage = 1;
        renderCompletionTable();
    });
    
    document.getElementById('completion-prev-page')?.addEventListener('click', () => {
        if (paginationState.completion.currentPage > 1) {
            paginationState.completion.currentPage--;
            renderCompletionTable();
        }
    });
    
    document.getElementById('completion-next-page')?.addEventListener('click', () => {
        const totalPages = Math.ceil(paginationState.completion.totalItems / paginationState.completion.pageSize);
        if (paginationState.completion.currentPage < totalPages) {
            paginationState.completion.currentPage++;
            renderCompletionTable();
        }
    });
    
    document.getElementById('completion-last-page')?.addEventListener('click', () => {
        const totalPages = Math.ceil(paginationState.completion.totalItems / paginationState.completion.pageSize);
        paginationState.completion.currentPage = totalPages;
        renderCompletionTable();
    });
}

function initializeCategoryPagination() {
    // Page size selector
    const pageSizeSelect = document.getElementById('category-page-size');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', function() {
            paginationState.category.pageSize = parseInt(this.value);
            paginationState.category.currentPage = 1;
            renderCategoryTable();
        });
    }
    
    // Navigation buttons
    document.getElementById('category-first-page')?.addEventListener('click', () => {
        paginationState.category.currentPage = 1;
        renderCategoryTable();
    });
    
    document.getElementById('category-prev-page')?.addEventListener('click', () => {
        if (paginationState.category.currentPage > 1) {
            paginationState.category.currentPage--;
            renderCategoryTable();
        }
    });
    
    document.getElementById('category-next-page')?.addEventListener('click', () => {
        const totalPages = Math.ceil(paginationState.category.totalItems / paginationState.category.pageSize);
        if (paginationState.category.currentPage < totalPages) {
            paginationState.category.currentPage++;
            renderCategoryTable();
        }
    });
    
    document.getElementById('category-last-page')?.addEventListener('click', () => {
        const totalPages = Math.ceil(paginationState.category.totalItems / paginationState.category.pageSize);
        paginationState.category.currentPage = totalPages;
        renderCategoryTable();
    });
}

function initializeExportEvents() {
    // School Completion exports
    document.getElementById('export-completion-csv')?.addEventListener('click', () => exportCompletionData('csv'));
    document.getElementById('export-completion-xlsx')?.addEventListener('click', () => exportCompletionData('xlsx'));
    document.getElementById('export-completion-pdf')?.addEventListener('click', () => exportCompletionData('pdf'));
    
    // Category Content exports
    document.getElementById('export-category-csv')?.addEventListener('click', () => exportCategoryData('csv'));
    document.getElementById('export-category-xlsx')?.addEventListener('click', () => exportCategoryData('xlsx'));
    document.getElementById('export-category-pdf')?.addEventListener('click', () => exportCategoryData('pdf'));
}

function collectFilters() {
    // Return current filters for compatibility
    return reportData.currentFilters.completion;
}







function renderAnalytics(data) {
    // Initialize charts if needed (though no charts are currently used)
    initCharts();

    // Cards
    try {
        const cardValues = document.querySelectorAll('.analytics-overview .stat-card h3');
        if (cardValues && cardValues.length >= 4) {
            const completionPct = Math.round((data.cards.completion_rate || 0) * 1000) / 10;
            cardValues[0].textContent = completionPct + '%';
            cardValues[1].textContent = (data.cards.avg_completion_hours || 0) + 'h';
            cardValues[2].textContent = (data.cards.completed_forms || 0).toLocaleString();
            cardValues[3].textContent = (data.cards.pending_forms || 0).toLocaleString();
        }
    } catch (e) { console.warn(e); }

    // Charts removed - no longer updating removed charts
    // updateChart(charts.completion, data.charts.completion_by_school);
    // updateChart(charts.formsPerDay, data.charts.forms_per_day);
    // updateChart(charts.response, data.charts.response_distribution);

    // Table
    renderSchoolTable(data.school_completion || [], data.cards, (data.meta && data.meta.filters_used && data.meta.filters_used.thresholds) || {});
    renderGroupTable(data.group_aggregates || []);
}

function updateChart(chart, payload) {
    if (!chart || !payload) return;
    chart.data.labels = payload.labels || [];
    const dataset = (payload.datasets && payload.datasets[0]) ? payload.datasets[0] : { data: [] };
    if (!chart.data.datasets || chart.data.datasets.length === 0) {
        chart.data.datasets = [dataset];
    } else {
        chart.data.datasets[0].data = dataset.data || [];
        if (dataset.label) chart.data.datasets[0].label = dataset.label;
    }
    chart.update();
}

// Load report data from API
async function loadReportData() {
    try {
        // Load analytics bundle for basic stats
        const analyticsResponse = await fetch('/api/analytics/bundle/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        if (!analyticsResponse.ok) {
            throw new Error(`Analytics API error: ${analyticsResponse.status}`);
        }
        
        const analyticsData = await analyticsResponse.json();
        
        // Get real school completion data from new API endpoint
        const schoolCompletionResponse = await fetch('/api/reports/school-completion/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        if (schoolCompletionResponse.ok) {
            const schoolCompletionData = await schoolCompletionResponse.json();
            reportData.schoolCompletion = schoolCompletionData.data || [];
        } else {
            console.warn('School completion API not available, using fallback data');
            reportData.schoolCompletion = analyticsData.school_completion || [];
        }
        
        // Get real category content data from new API endpoint
        const categoryContentResponse = await fetch('/api/reports/category-content/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        if (categoryContentResponse.ok) {
            const categoryContentData = await categoryContentResponse.json();
            reportData.categoryContent = categoryContentData.data || [];
        } else {
            console.warn('Category content API not available');
            reportData.categoryContent = [];
        }
        
        // Load filter options
        const filterResponse = await fetch('/api/analytics/filter-options/', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        let filterOptions = {};
        if (filterResponse.ok) {
            filterOptions = await filterResponse.json();
        }
        reportData.filterOptions = filterOptions;
        
        // Update analytics cards
        updateAnalyticsCards(analyticsData);
        
        return reportData;
        
    } catch (error) {
        console.error('Error loading report data:', error);
        return reportData;
    }
}

function updateAnalyticsCards(data) {
    try {
        const cardValues = document.querySelectorAll('.analytics-overview .stat-card h3');
        if (cardValues && cardValues.length >= 4) {
            const completionPct = Math.round((data.cards.completion_rate || 0) * 1000) / 10;
            cardValues[0].textContent = completionPct + '%';
            cardValues[1].textContent = (data.cards.avg_completion_hours || 0) + 'h';
            cardValues[2].textContent = (data.cards.completed_forms || 0).toLocaleString();
            cardValues[3].textContent = (data.cards.pending_forms || 0).toLocaleString();
        }
    } catch (e) {
        console.warn('Error updating analytics cards:', e);
    }
}

function initializeFilters(data) {
    populateFilterDropdowns(data.filterOptions);
    renderCompletionTable();
    renderCategoryTable();
}

function populateFilterDropdowns(filterOptions) {
    // Store options for later use in search filters
    reportData.filterOptions = filterOptions || {};
    
    console.log('Filter options loaded:', {
        regions: reportData.filterOptions.regions?.length || 0,
        divisions: reportData.filterOptions.divisions?.length || 0,
        districts: reportData.filterOptions.districts?.length || 0,
        schools: reportData.filterOptions.schools?.length || 0,
        categories: reportData.filterOptions.categories?.length || 0,
        sub_sections: reportData.filterOptions.sub_sections?.length || 0,
        topics: reportData.filterOptions.topics?.length || 0,
        questions: reportData.filterOptions.questions?.length || 0
    });
}

// Initialize search filter functionality
function initializeSearchFilter(inputElement) {
    const filterType = inputElement.getAttribute('data-filter-type');
    const resultsContainer = document.getElementById(inputElement.id + '-results');
    
    if (!resultsContainer) {
        console.warn('Results container not found for', inputElement.id);
        return;
    }
    
    // Aggressively disable autocomplete
    inputElement.setAttribute('autocomplete', 'new-password'); // Trick browsers
    inputElement.setAttribute('role', 'combobox');
    inputElement.setAttribute('aria-autocomplete', 'list');
    inputElement.setAttribute('aria-expanded', 'false');
    
    // Prevent any autocomplete events
    inputElement.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            // Handle our own dropdown navigation if needed
        }
    });
    
    let searchTimeout;
    let selectedValue = null;
    
    // Add clear button
    const clearButton = document.createElement('button');
    clearButton.className = 'clear-filter';
    clearButton.innerHTML = '×';
    clearButton.style.display = 'none';
    clearButton.title = 'Clear selection';
    inputElement.parentNode.appendChild(clearButton);
    
    // Clear button functionality
    clearButton.addEventListener('click', function(e) {
        e.stopPropagation();
        clearSelection();
    });
    
    function clearSelection() {
        selectedValue = null;
        inputElement.value = '';
        inputElement.classList.remove('has-selection');
        clearButton.style.display = 'none';
        resultsContainer.classList.remove('show');
        inputElement.parentNode.classList.remove('active');
        handleFilterChange();
    }
    
    // Input event with 1 second delay
    inputElement.addEventListener('input', function() {
        const searchTerm = this.value.trim();
        
        clearTimeout(searchTimeout);
        
        if (searchTerm.length === 0) {
            resultsContainer.classList.remove('show');
            inputElement.parentNode.classList.remove('active');
            if (selectedValue !== null) {
                clearSelection();
            }
            return;
        }
        
        // Show loading state
        resultsContainer.innerHTML = '<div class="no-results">Searching...</div>';
        resultsContainer.classList.add('show');
        inputElement.parentNode.classList.add('active');
        
        searchTimeout = setTimeout(() => {
            performSearch(searchTerm, filterType, resultsContainer, inputElement);
        }, 1000); // 1 second delay
    });
    
    // Handle focus and blur
    inputElement.addEventListener('focus', function() {
        // Close all other dropdowns first
        closeAllDropdowns();
        
        // Show all available options when focused, even without typing
        if (selectedValue === null && this.value.trim() === '') {
            showAllOptions(filterType, resultsContainer, inputElement);
        } else if (this.value.trim() && resultsContainer.children.length > 0) {
            resultsContainer.classList.add('show');
            inputElement.parentNode.classList.add('active');
        }
    });
    
    inputElement.addEventListener('blur', function() {
        // Delay hiding to allow for clicks on results
        setTimeout(() => {
            resultsContainer.classList.remove('show');
            inputElement.parentNode.classList.remove('active');
        }, 200);
    });
    
    function performSearch(searchTerm, filterType, resultsContainer, inputElement) {
        const results = getFilterOptions(filterType, searchTerm);
        displaySearchResults(results, resultsContainer, inputElement, filterType);
    }
    
    function showAllOptions(filterType, resultsContainer, inputElement) {
        // Close all other dropdowns first
        closeAllDropdowns();
        
        // Show limited options (8 max for clean display without scroll)
        const results = getFilterOptions(filterType, '', 8);
        if (results.length > 0) {
            displaySearchResults(results, resultsContainer, inputElement, filterType);
        } else {
            resultsContainer.innerHTML = '<div class="no-results">No options available</div>';
            resultsContainer.classList.add('show');
            inputElement.parentNode.classList.add('active');
        }
    }
    
    function handleFilterChange() {
        // Update the current filters
        const filterId = inputElement.id;
        
        if (filterId.startsWith('geo-')) {
            const filterType = filterId.replace('geo-', '');
            reportData.currentFilters.category[filterType] = selectedValue;
            
            // Handle cascading filters for geographic selection
            handleCascadingFilters(filterId, selectedValue, 'geo-');
            
            renderCategoryTable();
        } else if (filterId.startsWith('filter-')) {
            if (['filter-region', 'filter-division', 'filter-district', 'filter-school'].includes(filterId)) {
                const filterType = filterId.replace('filter-', '');
                reportData.currentFilters.completion[filterType] = selectedValue;
                
                // Handle cascading filters for completion filters
                handleCascadingFilters(filterId, selectedValue, 'filter-');
                
                handleCompletionFilterChange(filterId, selectedValue);
            } else {
                // Content filters - handle cascading for category hierarchy
                handleCascadingFilters(filterId, selectedValue, 'filter-');
                filterCategoryTable();
            }
        }
    }
    
    // Store references for later use
    inputElement._clearSelection = clearSelection;
    inputElement._selectedValue = () => selectedValue;
    inputElement._setSelectedValue = (value, text) => {
        selectedValue = value;
        inputElement.value = text;
        inputElement.classList.add('has-selection');
        clearButton.style.display = 'block';
        resultsContainer.classList.remove('show');
        inputElement.parentNode.classList.remove('active');
        handleFilterChange();
    };
}

// Get filter options for search with hierarchical filtering support
function getFilterOptions(filterType, searchTerm, limit = 8) {
    const options = reportData.filterOptions;
    let data = [];
    let valueKey = 'id';
    let textKey = 'name';
    
    switch(filterType) {
        case 'region':
            data = options.regions || [];
            break;
        case 'division':
            data = options.divisions || [];
            // Filter divisions based on selected region
            const selectedRegion = getSelectedFilterValue('filter-region') || getSelectedFilterValue('geo-region');
            if (selectedRegion) {
                data = data.filter(item => item.region_id == selectedRegion);
            }
            break;
        case 'district':
            data = options.districts || [];
            // Filter districts based on selected division
            const selectedDivision = getSelectedFilterValue('filter-division') || getSelectedFilterValue('geo-division');
            if (selectedDivision) {
                data = data.filter(item => item.division_id == selectedDivision);
            }
            break;
        case 'school':
            data = options.schools || [];
            valueKey = 'id';
            textKey = 'school_name';
            // Filter schools based on selected district
            const selectedDistrict = getSelectedFilterValue('filter-district') || getSelectedFilterValue('geo-district');
            if (selectedDistrict) {
                data = data.filter(item => item.district_id == selectedDistrict);
            }
            break;
        case 'category':
            data = options.categories || [];
            valueKey = 'category_id';
            textKey = 'name';
            break;
        case 'subsection':
            data = options.sub_sections || [];
            valueKey = 'sub_section_id';
            textKey = 'name';
            // Filter subsections based on selected category
            const selectedCategory = getSelectedFilterValue('filter-category');
            if (selectedCategory) {
                data = data.filter(item => item.category_id == selectedCategory);
            }
            break;
        case 'topic':
            data = options.topics || [];
            valueKey = 'topic_id';
            textKey = 'name';
            // Filter topics based on selected subsection
            const selectedSubsection = getSelectedFilterValue('filter-subsection');
            if (selectedSubsection) {
                data = data.filter(item => item.sub_section_id == selectedSubsection);
            }
            break;
        case 'question':
            data = options.questions || [];
            valueKey = 'question_id';
            textKey = 'question_text';
            // Filter questions based on selected topic
            const selectedTopic = getSelectedFilterValue('filter-topic');
            if (selectedTopic) {
                data = data.filter(item => item.topic_id == selectedTopic);
            }
            break;
        case 'subquestion':
            data = options.sub_questions || [];
            valueKey = 'sub_question_id';
            textKey = 'sub_question_text';
            // Filter sub-questions based on selected question
            const selectedQuestion = getSelectedFilterValue('filter-question');
            if (selectedQuestion) {
                data = data.filter(item => item.question_id == selectedQuestion);
            }
            break;
    }
    
    let filteredData = data;
    
    // Filter data based on search term only if search term is provided
    if (searchTerm && searchTerm.trim() !== '') {
        filteredData = data.filter(item => {
            const text = item[textKey] || '';
            return text.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }
    
    // Limit results for performance
    return filteredData.slice(0, limit).map(item => ({
        value: item[valueKey],
        text: item[textKey] || '',
        item: item
    }));
}

function displaySearchResults(results, resultsContainer, inputElement, filterType) {
    // Close all other active dropdowns first
    closeAllDropdowns();
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
        resultsContainer.classList.add('show');
        inputElement.parentNode.classList.add('active');
        return;
    }
    
    // Add header for all options display
    let headerHtml = '';
    if (inputElement.value.trim() === '') {
        headerHtml = `<div class="search-results-header" style="padding: 0.5rem 0.75rem; background: var(--gray-100); font-size: 0.75rem; color: var(--text-muted); border-bottom: 1px solid var(--border-color);">
            Available ${filterType}s (${results.length}${results.length >= 8 ? '+' : ''})
        </div>`;
    }
    
    const html = results.map(result => {
        let resultHtml = `<div class="search-result-item" data-value="${result.value}">`;
        resultHtml += `<div class="result-main">${escapeHtml(result.text)}</div>`;
        
        // Add additional context for some filter types
        if (filterType === 'school' && result.item.district_id) {
            const district = reportData.filterOptions.districts?.find(d => d.id === result.item.district_id);
            if (district) {
                resultHtml += `<div class="result-sub">District: ${escapeHtml(district.name)}</div>`;
            }
        } else if (filterType === 'division' && result.item.region_id) {
            const region = reportData.filterOptions.regions?.find(r => r.id === result.item.region_id);
            if (region) {
                resultHtml += `<div class="result-sub">Region: ${escapeHtml(region.name)}</div>`;
            }
        } else if (filterType === 'district' && result.item.division_id) {
            const division = reportData.filterOptions.divisions?.find(d => d.id === result.item.division_id);
            if (division) {
                resultHtml += `<div class="result-sub">Division: ${escapeHtml(division.name)}</div>`;
            }
        }
        
        resultHtml += '</div>';
        return resultHtml;
    }).join('');
    
    resultsContainer.innerHTML = headerHtml + html;
    resultsContainer.classList.add('show');
    inputElement.parentNode.classList.add('active');
    
    // Add click handlers for results
    resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', function() {
            const value = this.getAttribute('data-value');
            const text = this.querySelector('.result-main').textContent;
            inputElement._setSelectedValue(value, text);
        });
    });
}

function handleCompletionFilterChange(filterId, value) {
    const filterType = filterId.replace('filter-', '');
    reportData.currentFilters.completion[filterType] = value;
    
    // Update filter status display
    updateFilterStatus();
    
    // Show/hide combined totals
    const hasGeographicFilter = reportData.currentFilters.completion.region || 
                               reportData.currentFilters.completion.division || 
                               reportData.currentFilters.completion.district;
    
    const combinedTotals = document.getElementById('combined-totals');
    if (hasGeographicFilter && !reportData.currentFilters.completion.school) {
        combinedTotals.style.display = 'block';
        updateCombinedTotals();
    } else {
        combinedTotals.style.display = 'none';
    }
    
    renderCompletionTable();
}

function updateFilterStatus() {
    const completionFilters = reportData.currentFilters.completion;
    const categoryFilters = reportData.currentFilters.category;
    
    // Count active completion filters
    const activeCompletionFilters = Object.values(completionFilters).filter(v => v !== null && v !== undefined && v !== '').length;
    
    // Update completion filter status
    const completionStatus = document.getElementById('completion-filter-status');
    if (completionStatus) {
        if (activeCompletionFilters === 0) {
            completionStatus.textContent = 'No filters applied';
            completionStatus.style.color = 'var(--text-muted)';
        } else {
            completionStatus.textContent = `${activeCompletionFilters} filter${activeCompletionFilters > 1 ? 's' : ''} active`;
            completionStatus.style.color = 'var(--primary)';
        }
    }
}

function updatePaginationControls(tableType) {
    const pagination = paginationState[tableType];
    const totalPages = Math.ceil(pagination.totalItems / pagination.pageSize);
    
    // Update pagination info
    const startItem = pagination.totalItems === 0 ? 0 : (pagination.currentPage - 1) * pagination.pageSize + 1;
    const endItem = Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems);
    
    const infoElement = document.getElementById(`${tableType}-pagination-info`);
    if (infoElement) {
        infoElement.textContent = `Showing ${startItem}-${endItem} of ${pagination.totalItems} results`;
    }
    
    // Update navigation buttons
    const firstBtn = document.getElementById(`${tableType}-first-page`);
    const prevBtn = document.getElementById(`${tableType}-prev-page`);
    const nextBtn = document.getElementById(`${tableType}-next-page`);
    const lastBtn = document.getElementById(`${tableType}-last-page`);
    
    if (firstBtn) firstBtn.disabled = pagination.currentPage === 1;
    if (prevBtn) prevBtn.disabled = pagination.currentPage === 1;
    if (nextBtn) nextBtn.disabled = pagination.currentPage === totalPages || totalPages === 0;
    if (lastBtn) lastBtn.disabled = pagination.currentPage === totalPages || totalPages === 0;
    
    // Update page numbers
    updatePaginationNumbers(tableType, totalPages);
}

function updatePaginationNumbers(tableType, totalPages) {
    const numbersContainer = document.getElementById(`${tableType}-pagination-numbers`);
    if (!numbersContainer) return;
    
    const currentPage = paginationState[tableType].currentPage;
    let html = '';
    
    if (totalPages <= 7) {
        // Show all pages if 7 or fewer
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="pagination-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
    } else {
        // Show smart pagination with ellipsis
        if (currentPage <= 4) {
            // Show: 1 2 3 4 5 ... last
            for (let i = 1; i <= 5; i++) {
                html += `<button class="pagination-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
            html += '<span class="pagination-ellipsis">...</span>';
            html += `<button class="pagination-number" data-page="${totalPages}">${totalPages}</button>`;
        } else if (currentPage >= totalPages - 3) {
            // Show: 1 ... (last-4) (last-3) (last-2) (last-1) last
            html += `<button class="pagination-number" data-page="1">1</button>`;
            html += '<span class="pagination-ellipsis">...</span>';
            for (let i = totalPages - 4; i <= totalPages; i++) {
                html += `<button class="pagination-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
        } else {
            // Show: 1 ... (current-1) current (current+1) ... last
            html += `<button class="pagination-number" data-page="1">1</button>`;
            html += '<span class="pagination-ellipsis">...</span>';
            for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                html += `<button class="pagination-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
            html += '<span class="pagination-ellipsis">...</span>';
            html += `<button class="pagination-number" data-page="${totalPages}">${totalPages}</button>`;
        }
    }
    
    numbersContainer.innerHTML = html;
    
    // Add click handlers for page numbers
    numbersContainer.querySelectorAll('.pagination-number').forEach(btn => {
        btn.addEventListener('click', function() {
            const page = parseInt(this.getAttribute('data-page'));
            paginationState[tableType].currentPage = page;
            if (tableType === 'completion') {
                renderCompletionTable();
            } else {
                renderCategoryTable();
            }
        });
    });
}

function updateCombinedTotals() {
    const filteredData = getFilteredCompletionData();
    
    if (filteredData.length === 0) {
        document.getElementById('total-completion').textContent = '0%';
        document.getElementById('total-answers').textContent = '0%';
        document.getElementById('total-status').textContent = 'No Data';
        return;
    }
    
    const totalAnswered = filteredData.reduce((sum, row) => sum + (row.answered || 0), 0);
    const totalRequired = filteredData.reduce((sum, row) => sum + (row.required || 0), 0);
    const avgCompletion = filteredData.reduce((sum, row) => sum + (row.completion_pct || 0), 0) / filteredData.length;
    
    const answerRate = totalRequired > 0 ? (totalAnswered / totalRequired * 100) : 0;
    
    let combinedStatus = 'Not Started';
    if (avgCompletion >= 0.9) combinedStatus = 'Completed';
    else if (avgCompletion >= 0.5) combinedStatus = 'In Progress';
    
    document.getElementById('total-completion').textContent = Math.round(avgCompletion * 1000) / 10 + '%';
    document.getElementById('total-answers').textContent = Math.round(answerRate * 10) / 10 + '%';
    document.getElementById('total-status').textContent = combinedStatus;
}

function getFilteredCompletionData() {
    let filtered = [...reportData.schoolCompletion];
    const filters = reportData.currentFilters.completion;
    
    const searchTerm = document.getElementById('completion-search')?.value?.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(row => 
            (row.school_name || '').toLowerCase().includes(searchTerm) ||
            (row.region_name || '').toLowerCase().includes(searchTerm) ||
            (row.division_name || '').toLowerCase().includes(searchTerm) ||
            (row.district_name || '').toLowerCase().includes(searchTerm)
        );
    }
    
    if (filters.region) filtered = filtered.filter(row => row.region_id == filters.region);
    if (filters.division) filtered = filtered.filter(row => row.division_id == filters.division);
    if (filters.district) filtered = filtered.filter(row => row.district_id == filters.district);
    if (filters.school) filtered = filtered.filter(row => row.school_id == filters.school);
    
    return filtered;
}

function getFilteredCategoryData() {
    let filtered = [...reportData.categoryContent];
    const filters = reportData.currentFilters.category;
    
    // Apply search filter
    const searchTerm = document.getElementById('category-search')?.value?.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(row => 
            (row.category || '').toLowerCase().includes(searchTerm) ||
            (row.subsection || '').toLowerCase().includes(searchTerm) ||
            (row.topic || '').toLowerCase().includes(searchTerm) ||
            (row.question || '').toLowerCase().includes(searchTerm) ||
            (row.sub_question || '').toLowerCase().includes(searchTerm) ||
            (row.school_name || '').toLowerCase().includes(searchTerm)
        );
    }
    
    // Apply geographic filters
    if (filters.region) {
        filtered = filtered.filter(row => row.region_id == filters.region);
    }
    if (filters.division) {
        filtered = filtered.filter(row => row.division_id == filters.division);
    }
    if (filters.district) {
        filtered = filtered.filter(row => row.district_id == filters.district);
    }
    if (filters.school) {
        filtered = filtered.filter(row => row.school_id == filters.school);
    }
    
    // Apply content filters using search filter values
    const categoryInput = document.getElementById('filter-category');
    const subsectionInput = document.getElementById('filter-subsection');
    const topicInput = document.getElementById('filter-topic');
    const questionInput = document.getElementById('filter-question');
    const subquestionInput = document.getElementById('filter-subquestion');
    
    if (categoryInput && categoryInput._selectedValue && categoryInput._selectedValue()) {
        filtered = filtered.filter(row => row.category_id == categoryInput._selectedValue());
    }
    if (subsectionInput && subsectionInput._selectedValue && subsectionInput._selectedValue()) {
        filtered = filtered.filter(row => row.subsection_id == subsectionInput._selectedValue());
    }
    if (topicInput && topicInput._selectedValue && topicInput._selectedValue()) {
        filtered = filtered.filter(row => row.topic_id == topicInput._selectedValue());
    }
    if (questionInput && questionInput._selectedValue && questionInput._selectedValue()) {
        filtered = filtered.filter(row => row.question_id == questionInput._selectedValue());
    }
    if (subquestionInput && subquestionInput._selectedValue && subquestionInput._selectedValue()) {
        filtered = filtered.filter(row => row.subquestion_id == subquestionInput._selectedValue());
    }
    
    return filtered;
}

function sortCompletionTable(sortKey) {
    const currentSort = sortState.completion;
    
    if (currentSort.key === sortKey) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.key = sortKey;
        currentSort.direction = 'asc';
    }
    
    renderCompletionTable();
}

function renderCompletionTable() {
    const tbody = document.getElementById('school-completion-table-body');
    if (!tbody) return;
    
    let data = getFilteredCompletionData();
    
    // Apply sorting if a sort key is set
    if (sortState.completion.key) {
        data.sort((a, b) => {
            const sortKey = sortState.completion.key;
            let aVal = a[sortKey];
            let bVal = b[sortKey];
            
            // Handle special cases
            if (sortKey === 'completion_pct') {
                aVal = a.completion_pct || 0;
                bVal = b.completion_pct || 0;
            } else if (sortKey === 'answered') {
                aVal = a.answered || 0;
                bVal = b.answered || 0;
            }
            
            let comparison = 0;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                comparison = aVal - bVal;
            } else {
                comparison = String(aVal || '').localeCompare(String(bVal || ''));
            }
            
            return sortState.completion.direction === 'asc' ? comparison : -comparison;
        });
    }
    
    // Update pagination state
    paginationState.completion.totalItems = data.length;
    
    // Apply pagination
    const startIndex = (paginationState.completion.currentPage - 1) * paginationState.completion.pageSize;
    const endIndex = startIndex + paginationState.completion.pageSize;
    const paginatedData = data.slice(startIndex, endIndex);
    
    // Update sort indicators
    updateSortIndicators('school-completion-table-body', sortState.completion);
    
    const html = paginatedData.map(row => {
        const completionPct = Math.round((row.completion_pct || 0) * 1000) / 10;
        let statusClass = '';
        if (completionPct >= 90) statusClass = 'color-success';
        else if (completionPct >= 50) statusClass = 'color-warning';
        else statusClass = 'color-danger';
        
        return `
            <tr>
                <td style="padding:8px;">${escapeHtml(row.region_name || '')}</td>
                <td style="padding:8px;">${escapeHtml(row.division_name || '')}</td>
                <td style="padding:8px;">${escapeHtml(row.district_name || '')}</td>
                <td style="padding:8px;">${escapeHtml(row.school_name || '')}</td>
                <td style="padding:8px; text-align:right;" class="${statusClass}">${completionPct}%</td>
                <td style="padding:8px; text-align:right;">${row.answered || 0}</td>
                <td style="padding:8px;" class="${statusClass}">${escapeHtml(row.status || 'Unknown')}</td>
            </tr>`;
    }).join('');
    
    tbody.innerHTML = html;
    
    // Update pagination controls
    updatePaginationControls('completion');
}

function sortCategoryTable(sortKey) {
    const currentSort = sortState.category;
    
    if (currentSort.key === sortKey) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.key = sortKey;
        currentSort.direction = 'asc';
    }
    
    renderCategoryTable();
}

function renderCategoryTable() {
    const tbody = document.getElementById('category-content-table-body');
    if (!tbody) return;
    
    let data = getFilteredCategoryData();
    
    // If no filters are applied and no data, show message to load data
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem;">Loading data or no data available. Please check your database connection.</td></tr>';
        // Update pagination for empty data
        paginationState.category.totalItems = 0;
        updatePaginationControls('category');
        return;
    }
    
    // Apply sorting if a sort key is set
    if (sortState.category.key) {
        data.sort((a, b) => {
            const sortKey = sortState.category.key;
            let aVal = a[sortKey];
            let bVal = b[sortKey];
            
            let comparison = 0;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                comparison = aVal - bVal;
            } else {
                comparison = String(aVal || '').localeCompare(String(bVal || ''));
            }
            
            return sortState.category.direction === 'asc' ? comparison : -comparison;
        });
    }
    
    // Update pagination state
    paginationState.category.totalItems = data.length;
    
    // Apply pagination
    const startIndex = (paginationState.category.currentPage - 1) * paginationState.category.pageSize;
    const endIndex = startIndex + paginationState.category.pageSize;
    const paginatedData = data.slice(startIndex, endIndex);
    
    // Update sort indicators
    updateSortIndicators('category-content-table-body', sortState.category);
    
    // Render table rows
    const html = paginatedData.map(row => `
        <tr>
            <td style="padding:8px;">${escapeHtml(row.school_name || '')}</td>
            <td style="padding:8px;">${escapeHtml(row.category || '')}</td>
            <td style="padding:8px;">${escapeHtml(row.subsection || '')}</td>
            <td style="padding:8px;">${escapeHtml(row.topic || '')}</td>
            <td style="padding:8px;">${escapeHtml(row.question || '')}</td>
            <td style="padding:8px;">${escapeHtml(row.sub_question || '')}</td>
            <td style="padding:8px;">${escapeHtml(row.answer || '')}</td>
        </tr>`).join('');
    
    tbody.innerHTML = html;
    
    // Update pagination controls
    updatePaginationControls('category');
}



// Helper Functions
function closeAllDropdowns() {
    // Close all search results
    document.querySelectorAll('.search-results.show').forEach(results => {
        results.classList.remove('show');
    });
    
    // Remove active class from all containers
    document.querySelectorAll('.search-filter-container.active').forEach(container => {
        container.classList.remove('active');
    });
}

function updateSortIndicators(tableBodyId, sortState) {
    const table = document.getElementById(tableBodyId)?.closest('table');
    if (!table) return;
    
    // Reset all sort indicators
    const headers = table.querySelectorAll('th[data-sort]');
    headers.forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc');
    });
    
    // Set current sort indicator
    if (sortState.key) {
        const currentHeader = table.querySelector(`th[data-sort="${sortState.key}"]`);
        if (currentHeader) {
            currentHeader.classList.add(sortState.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
        }
    }
}

// Helper functions to get names by ID
function getSchoolName(schoolId) {
    const school = reportData.filterOptions.schools?.find(s => s.id == schoolId);
    return school ? school.school_name : 'Unknown School';
}

function getDistrictName(districtId) {
    const district = reportData.filterOptions.districts?.find(d => d.id == districtId);
    return district ? district.name : 'Unknown District';
}

function getDivisionName(divisionId) {
    const division = reportData.filterOptions.divisions?.find(d => d.id == divisionId);
    return division ? division.name : 'Unknown Division';
}

function getRegionName(regionId) {
    const region = reportData.filterOptions.regions?.find(r => r.id == regionId);
    return region ? region.name : 'Unknown Region';
}

function handleGeographicFilterChange(filterId, value) {
    const filterType = filterId.replace('geo-', '');
    reportData.currentFilters.category[filterType] = value;
    renderCategoryTable();
}

function filterCompletionTable() {
    renderCompletionTable();
    const combinedTotals = document.getElementById('combined-totals');
    if (combinedTotals.style.display !== 'none') {
        updateCombinedTotals();
    }
}

function filterCategoryTable() {
    renderCategoryTable();
}

function exportCompletionData(format) {
    const data = getFilteredCompletionData();
    const filters = reportData.currentFilters.completion;
    
    if (data.length === 0) {
        alert('No data to export. Please adjust your filters.');
        return;
    }
    
    // For now, create a simple CSV export since backend endpoints need authentication
    if (format === 'csv') {
        exportToCSV(data, 'school-completion-report.csv', [
            'Region', 'Division', 'District', 'School', 'Completion %', 'Answered', 'Status'
        ]);
    } else {
        alert(`${format.toUpperCase()} export will be available when logged in to the system.`);
    }
}

function exportCategoryData(format) {
    const data = getFilteredCategoryData();
    
    if (data.length === 0) {
        alert('No data to export. Please select some content filters first.');
        return;
    }
    
    if (format === 'csv') {
        exportToCSV(data, 'category-content-report.csv', [
            'School', 'Category', 'Subsection', 'Topic', 'Question', 'Sub-question', 'Answer'
        ]);
    } else {
        alert(`${format.toUpperCase()} export will be available when logged in to the system.`);
    }
}

function exportToCSV(data, filename, headers) {
    if (data.length === 0) return;
    
    let csvContent = headers.join(',') + '\n';
    
    data.forEach(row => {
        const values = headers.map(header => {
            let value = '';
            switch(header) {
                case 'Region': value = row.region_name || ''; break;
                case 'Division': value = row.division_name || ''; break;
                case 'District': value = row.district_name || ''; break;
                case 'School': value = row.school_name || ''; break;
                case 'Completion %': value = Math.round((row.completion_pct || 0) * 1000) / 10 + '%'; break;
                case 'Answered': value = row.answered || 0; break;
                case 'Status': value = row.status || ''; break;
                case 'Category': value = row.category || ''; break;
                case 'Subsection': value = row.subsection || ''; break;
                case 'Topic': value = row.topic || ''; break;
                case 'Question': value = row.question || ''; break;
                case 'Sub-question': value = row.sub_question || ''; break;
                case 'Answer': value = row.answer || ''; break;
            }
            // Escape commas and quotes in CSV
            if (value.toString().includes(',') || value.toString().includes('"')) {
                value = '"' + value.toString().replace(/"/g, '""') + '"';
            }
            return value;
        });
        csvContent += values.join(',') + '\n';
    });
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

function renderGroupTable(groups) {
    const tbody = document.getElementById('group-table-body');
    if (!tbody) return;
    const html = (groups || []).map(g => {
        const pct = Math.round((g.completion_pct || 0) * 1000) / 10;
        return `
            <tr>
                <td style=\"padding:8px;\">${escapeHtml(g.group || '')}</td>
                <td style=\"padding:8px; text-align:right;\">${pct}%</td>
                <td style=\"padding:8px; text-align:right;\">${g.answered ?? ''}</td>
                <td style=\"padding:8px; text-align:right;\">${g.required ?? ''}</td>
                <td style=\"padding:8px; text-align:right;\">${g.schools ?? ''}</td>
            </tr>`;
    }).join('');
    tbody.innerHTML = html;
}

async function runDrilldown() {
    try {
        const level = document.getElementById('drilldown-level')?.value || 'category';
        const filters = collectFilters();
        const res = await fetch('/api/analytics/drilldown/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level, filters })
        });
        if (!res.ok) {
            console.error('Drilldown failed:', res.status, res.statusText);
            throw new Error('Drilldown failed');
        }
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            console.error('Failed to parse drilldown JSON:', text.substring(0, 200));
            if (text.includes('<!DOCTYPE html>')) {
                alert('Please log in to access the analytics dashboard.');
                window.location.href = '/auth/login/';
                return;
            }
            throw new Error('Invalid response format');
        }
        const tbody = document.getElementById('drilldown-table-body');
        if (tbody) {
            const html = (data.data || []).map(d => `
                <tr>
                    <td style=\"padding:8px;\">${escapeHtml(d.name || '')}</td>
                    <td style=\"padding:8px; text-align:right;\">${d.count ?? 0}</td>
                    <td style=\"padding:8px; text-align:right;\">${d.percentage_distribution || ''}</td>
                    <td style=\"padding:8px; text-align:right;\">${d.average || ''}</td>
                    <td style=\"padding:8px; text-align:right;\">${d.median || ''}</td>
                    <td style=\"padding:8px; text-align:right;\">${d.min || ''}</td>
                    <td style=\"padding:8px; text-align:right;\">${d.max || ''}</td>
                    <td style=\"padding:8px; text-align:right;\">${d.frequency_distribution || ''}</td>
                    <td style=\"padding:8px; text-align:right;\">${d.comparison_by_geo || ''}</td>
                </tr>`).join('');
            tbody.innerHTML = html;
        }
        renderDrilldownChart(data);
    } catch (e) { console.error(e); }
}

let drilldownChart;
function renderDrilldownChart(data) {
    try {
        const ctx = document.getElementById('drilldownChart')?.getContext('2d');
        if (!ctx) return;
        const labels = (data.data || []).map(d => d.name);
        const counts = (data.data || []).map(d => d.count || 0);
        // Auto chart type
        const type = labels.length <= 6 ? 'doughnut' : 'bar';
        if (drilldownChart) drilldownChart.destroy();
        drilldownChart = new Chart(ctx, {
            type,
            data: { labels, datasets: [{ label: 'Count', data: counts, backgroundColor: '#696cff' }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (e) { console.warn(e); }
}

async function exportDrilldownCSV() {
    const payload = collectFilters();
    const level = document.getElementById('drilldown-level')?.value || 'category';
    payload.level = level;
    
    try {
        const res = await fetch('/api/exports/drilldown/csv/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `drilldown_${level}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
}

async function exportDrilldownXLSX() {
    const payload = collectFilters();
    const level = document.getElementById('drilldown-level')?.value || 'category';
    payload.level = level;
    
    const params = new URLSearchParams();
    Object.entries(payload).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') {
            if (Array.isArray(v)) {
                params.append(k, v.join(','));
            } else {
                params.append(k, v);
            }
        }
    });
    
    window.open(`/api/exports/drilldown/xlsx/?${params.toString()}`, '_blank');
}


function exportCurrent(format) {
    const payload = collectFilters();
    if (format === 'csv') {
        fetch('/api/exports/csv/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(async res => {
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'analytics.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        }).catch(console.error);
    } else if (format === 'xlsx') {
        const params = new URLSearchParams();
        Object.entries(payload).forEach(([k, v]) => {
            if (v !== null && v !== undefined && v !== '') {
                if (Array.isArray(v)) {
                    params.append(k, v.join(','));
                } else {
                    params.append(k, v);
                }
            }
        });
        window.open(`/api/exports/xlsx/?${params.toString()}`, '_blank');
    } else {
        console.log('Export format not implemented:', format);
    }
}

function escapeHtml(s) { return String(s).replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// Helper function to get selected filter value
function getSelectedFilterValue(filterId) {
    const inputElement = document.getElementById(filterId);
    if (inputElement && inputElement._selectedValue) {
        return inputElement._selectedValue();
    }
    return null;
}

// Handle cascading filters
function handleCascadingFilters(changedFilterId, selectedValue, prefix) {
    // Define the hierarchy for different filter types
    const hierarchies = {
        'geo-': ['geo-region', 'geo-division', 'geo-district', 'geo-school'],
        'filter-': {
            geographic: ['filter-region', 'filter-division', 'filter-district', 'filter-school'],
            content: ['filter-category', 'filter-subsection', 'filter-topic', 'filter-question', 'filter-subquestion']
        }
    };
    
    let hierarchy = [];
    if (prefix === 'geo-') {
        hierarchy = hierarchies['geo-'];
    } else if (prefix === 'filter-') {
        // Determine if this is geographic or content filter
        if (['filter-region', 'filter-division', 'filter-district', 'filter-school'].includes(changedFilterId)) {
            hierarchy = hierarchies['filter-'].geographic;
        } else {
            hierarchy = hierarchies['filter-'].content;
        }
    }
    
    const changedIndex = hierarchy.indexOf(changedFilterId);
    if (changedIndex === -1) return;
    
    // Clear all filters that come after the changed filter in the hierarchy
    for (let i = changedIndex + 1; i < hierarchy.length; i++) {
        const filterElement = document.getElementById(hierarchy[i]);
        if (filterElement && filterElement._clearSelection) {
            filterElement._clearSelection();
        }
    }
    
    // If a value was selected (not cleared), refresh the next level's options
    if (selectedValue && changedIndex < hierarchy.length - 1) {
        const nextFilterId = hierarchy[changedIndex + 1];
        const nextFilterElement = document.getElementById(nextFilterId);
        if (nextFilterElement) {
            // Update the filter options for the next level
            updateFilterOptionsForElement(nextFilterElement);
        }
    }
}

// Update filter options for a specific element based on current selections
function updateFilterOptionsForElement(inputElement) {
    const filterType = inputElement.getAttribute('data-filter-type');
    
    // Clear current value and show updated options when focused
    if (inputElement.value.trim() === '') {
        setTimeout(() => {
            if (document.activeElement === inputElement) {
                showAllOptions(filterType, 
                    document.getElementById(inputElement.id + '-results'), 
                    inputElement);
            }
        }, 100);
    }
}
