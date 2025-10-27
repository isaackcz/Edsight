/**
 * User Dashboard - Analytics Page JavaScript
 * Handles data visualization and analytics
 */

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeAnalytics();
});

/**
 * Main initialization function
 */
function initializeAnalytics() {
    initializeControls();
    loadCharts();
    loadCategoryStatus();
    loadDataTable();
}

/**
 * Initialize control buttons
 */
function initializeControls() {
    const refreshBtn = document.querySelector('.refresh-button');
    const exportBtn = document.querySelector('.export-button');
    const dateDropdown = document.querySelector('.dropdown-button');
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleRefresh);
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExport);
    }
    
    if (dateDropdown) {
        dateDropdown.addEventListener('click', handleDateFilter);
    }
}

/**
 * Handle refresh button
 */
function handleRefresh() {
    console.log('Refreshing analytics data...');
    showLoadingState();
    
    setTimeout(() => {
        loadCharts();
        loadCategoryStatus();
        loadDataTable();
        hideLoadingState();
        showNotification('Data refreshed successfully', 'success');
    }, 1000);
}

/**
 * Handle export button
 */
function handleExport() {
    console.log('Exporting analytics report...');
    showNotification('Report exported successfully', 'success');
    // Placeholder for export functionality
}

/**
 * Handle date filter dropdown
 */
function handleDateFilter() {
    console.log('Opening date filter...');
    // Placeholder for date filter functionality
}

/**
 * Load and render charts
 */
function loadCharts() {
    initializeProgressTimelineChart();
    initializeCategoryCompletionChart();
}

/**
 * Initialize progress timeline chart (line chart)
 */
function initializeProgressTimelineChart() {
    const chartCanvas = document.getElementById('progressTimelineChart');
    if (!chartCanvas) return;
    
    const ctx = chartCanvas.getContext('2d');
    
    // Placeholder data
    const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
    const completedData = [20, 45, 68, 85, 95];
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Completion Progress',
                data: completedData,
                borderColor: '#3a6ea5',
                backgroundColor: 'rgba(58, 110, 165, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Progress: ' + context.parsed.y + '%';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

/**
 * Initialize category completion chart (bar chart)
 */
function initializeCategoryCompletionChart() {
    const chartCanvas = document.getElementById('categoryCompletionChart');
    if (!chartCanvas) return;
    
    const ctx = chartCanvas.getContext('2d');
    
    // Placeholder data
    const categories = ['Basic Info', 'Student Data', 'Staff Info', 'Facilities', 'Programs'];
    const completionData = [100, 85, 92, 65, 78];
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [{
                label: 'Completion %',
                data: completionData,
                backgroundColor: [
                    '#4caf50',
                    '#3a6ea5',
                    '#3a6ea5',
                    '#ff9800',
                    '#3a6ea5'
                ],
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y + '% Complete';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

/**
 * Load category status cards
 */
function loadCategoryStatus() {
    // Placeholder data
    const categories = [
        {
            name: 'Basic Information',
            icon: 'ph-info',
            percentage: 100,
            total: 25,
            completed: 25,
            status: 'complete'
        },
        {
            name: 'Student Data',
            icon: 'ph-student',
            percentage: 85,
            total: 40,
            completed: 34,
            status: 'high'
        },
        {
            name: 'Staff Information',
            icon: 'ph-users',
            percentage: 92,
            total: 30,
            completed: 28,
            status: 'high'
        },
        {
            name: 'Facilities',
            icon: 'ph-buildings',
            percentage: 65,
            total: 35,
            completed: 23,
            status: 'medium'
        },
        {
            name: 'Programs & Activities',
            icon: 'ph-calendar',
            percentage: 78,
            total: 28,
            completed: 22,
            status: 'high'
        }
    ];
    
    renderCategoryCards(categories);
}

/**
 * Render category status cards
 */
function renderCategoryCards(categories) {
    const container = document.querySelector('.category-cards-grid');
    if (!container) return;
    
    container.innerHTML = categories.map(category => `
        <div class="category-status-card" data-category="${category.name}">
            <div class="category-card-header">
                <h3 class="category-name">${category.name}</h3>
                <i class="category-icon ph-bold ${category.icon}"></i>
            </div>
            <div class="category-progress">
                <div class="progress-bar-wrapper">
                    <div class="progress-bar-inner ${category.status}" style="width: ${category.percentage}%"></div>
                </div>
                <div class="progress-label">
                    <span>${category.completed} of ${category.total} completed</span>
                    <span>${category.percentage}%</span>
                </div>
            </div>
            <div class="category-stats">
                <div class="stat-item">
                    <span class="stat-number">${category.total}</span>
                    <span class="stat-label">Total</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${category.completed}</span>
                    <span class="stat-label">Done</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${category.total - category.completed}</span>
                    <span class="stat-label">Pending</span>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    document.querySelectorAll('.category-status-card').forEach(card => {
        card.addEventListener('click', function() {
            const category = this.dataset.category;
            handleCategoryClick(category);
        });
    });
}

/**
 * Handle category card click
 */
function handleCategoryClick(category) {
    console.log('Category clicked:', category);
    showNotification(`Viewing details for ${category}`, 'info');
    // Placeholder for filtering data table by category
}

/**
 * Load data table
 */
function loadDataTable() {
    // Placeholder data
    const tableData = [
        {
            section: 'Basic Information',
            questions: 25,
            completed: 25,
            percentage: 100,
            status: 'complete'
        },
        {
            section: 'Student Enrollment',
            questions: 40,
            completed: 34,
            percentage: 85,
            status: 'in-progress'
        },
        {
            section: 'Teaching Staff',
            questions: 30,
            completed: 28,
            percentage: 92,
            status: 'in-progress'
        },
        {
            section: 'School Facilities',
            questions: 35,
            completed: 23,
            percentage: 65,
            status: 'in-progress'
        },
        {
            section: 'Programs',
            questions: 28,
            completed: 22,
            percentage: 78,
            status: 'in-progress'
        }
    ];
    
    renderDataTable(tableData);
}

/**
 * Render data table
 */
function renderDataTable(data) {
    const tbody = document.querySelector('.analytics-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = data.map(row => `
        <tr>
            <td>${row.section}</td>
            <td>${row.questions}</td>
            <td>${row.completed}</td>
            <td>${row.percentage}%</td>
            <td><span class="status-badge ${row.status}">${row.status.replace('-', ' ')}</span></td>
        </tr>
    `).join('');
}

/**
 * Show loading state
 */
function showLoadingState() {
    console.log('Loading...');
    // Placeholder for loading indicator
}

/**
 * Hide loading state
 */
function hideLoadingState() {
    console.log('Loading complete');
    // Placeholder for hiding loading indicator
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // TODO: Integrate with global notification system
}

/**
 * Search/filter table
 */
function initializeTableSearch() {
    const searchInput = document.querySelector('.table-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('.analytics-table tbody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
}

// Initialize table search
document.addEventListener('DOMContentLoaded', initializeTableSearch);

