/**
 * User Dashboard - Analytics Page JavaScript
 * Handles data visualization and analytics with real database data
 */

// Store chart instances
let progressChart = null;
let categoryChart = null;

// Store current analytics data
let currentAnalyticsData = null;

// Current date range selection
let currentDateRange = '30days';

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeAnalytics();
});

/**
 * Main initialization function
 */
async function initializeAnalytics() {
    initializeControls();
    await loadAnalyticsData();
}

/**
 * Load analytics data from API
 */
async function loadAnalyticsData(dateRange = currentDateRange) {
    try {
        showLoadingState();
        
        // Build API URL with date range parameter
        const url = `/api/analytics/data/?range=${dateRange}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch analytics data');
        }
        
        currentAnalyticsData = await response.json();
        console.log('Analytics data loaded:', currentAnalyticsData);
        
        // Update current date range
        currentDateRange = dateRange;
        
        // Update dropdown button text
        updateDateRangeDisplay(dateRange);
        
        // Render all components with the data
        loadCharts(currentAnalyticsData);
        loadCategoryStatus(currentAnalyticsData);
        loadDataTable(currentAnalyticsData);
        
        hideLoadingState();
    } catch (error) {
        console.error('Error loading analytics data:', error);
        hideLoadingState();
        showNotification('Failed to load analytics data', 'error');
    }
}

/**
 * Initialize control buttons
 */
function initializeControls() {
    const exportBtn = document.querySelector('.export-button');
    const dateDropdown = document.querySelector('.dropdown-button');
    
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExport);
    }
    
    if (dateDropdown) {
        dateDropdown.addEventListener('click', handleDateFilter);
    }
}

/**
 * Handle export button - Show export options menu
 */
function handleExport() {
    console.log('Opening export menu...');
    
    if (!currentAnalyticsData) {
        showNotification('No data to export', 'error');
        return;
    }
    
    // Remove existing export menu if any
    const existingMenu = document.querySelector('.export-menu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }
    
    // Create export menu
    const menu = document.createElement('div');
    menu.className = 'export-menu';
    menu.innerHTML = `
        <div class="export-menu-header">
            <h4>Export Options</h4>
            <button class="close-menu">&times;</button>
        </div>
        <div class="export-menu-content">
            <div class="export-section">
                <h5>Export by Section</h5>
                <button class="export-option" data-section="timeline" data-format="csv">
                    <i class="ph-bold ph-chart-line"></i>
                    <span>Progress Timeline (CSV)</span>
                </button>
                <button class="export-option" data-section="timeline" data-format="excel">
                    <i class="ph-bold ph-chart-line"></i>
                    <span>Progress Timeline (Excel)</span>
                </button>
                <button class="export-option" data-section="categories" data-format="csv">
                    <i class="ph-bold ph-chart-bar"></i>
                    <span>Category Completion (CSV)</span>
                </button>
                <button class="export-option" data-section="categories" data-format="excel">
                    <i class="ph-bold ph-chart-bar"></i>
                    <span>Category Completion (Excel)</span>
                </button>
                <button class="export-option" data-section="status" data-format="csv">
                    <i class="ph-bold ph-squares-four"></i>
                    <span>Category Status Overview (CSV)</span>
                </button>
                <button class="export-option" data-section="status" data-format="excel">
                    <i class="ph-bold ph-squares-four"></i>
                    <span>Category Status Overview (Excel)</span>
                </button>
            </div>
            <div class="export-section">
                <h5>Export All Data</h5>
                <button class="export-option" data-section="all" data-format="csv">
                    <i class="ph-bold ph-file-csv"></i>
                    <span>Complete Report (CSV)</span>
                </button>
                <button class="export-option" data-section="all" data-format="excel">
                    <i class="ph-bold ph-file-xls"></i>
                    <span>Complete Report (Excel)</span>
                </button>
            </div>
        </div>
    `;
    
    // Position menu relative to export button
    const exportBtn = document.querySelector('.export-button');
    const rect = exportBtn.getBoundingClientRect();
    menu.style.cssText = `
        position: fixed;
        top: ${rect.bottom + 10}px;
        right: ${window.innerWidth - rect.right}px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        padding: 1rem;
        z-index: 1000;
        min-width: 300px;
        max-height: 500px;
        overflow-y: auto;
    `;
    
    document.body.appendChild(menu);
    
    // Add event listeners
    menu.querySelector('.close-menu').addEventListener('click', () => menu.remove());
    
    menu.querySelectorAll('.export-option').forEach(btn => {
        btn.addEventListener('click', function() {
            const section = this.dataset.section;
            const format = this.dataset.format;
            exportData(section, format);
            menu.remove();
        });
    });
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && !exportBtn.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

/**
 * Handle date filter dropdown - Show date range options with view types
 */
function handleDateFilter() {
    console.log('Opening date filter...');
    
    // Remove existing menu if any
    const existingMenu = document.querySelector('.date-filter-menu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }
    
    // Create date filter menu with sections
    const menu = document.createElement('div');
    menu.className = 'date-filter-menu';
    menu.innerHTML = `
        <div class="date-filter-header">
            <h5>View Type</h5>
        </div>
        <div class="date-filter-option ${currentDateRange === 'daily' ? 'active' : ''}" data-range="daily">
            <i class="ph-bold ph-calendar-blank"></i>
            <span>Daily View</span>
            <small>Show each day</small>
        </div>
        <div class="date-filter-option ${currentDateRange === 'weekly' ? 'active' : ''}" data-range="weekly">
            <i class="ph-bold ph-calendar-dots"></i>
            <span>Weekly View</span>
            <small>Group by week</small>
        </div>
        <div class="date-filter-option ${currentDateRange === 'monthly' ? 'active' : ''}" data-range="monthly">
            <i class="ph-bold ph-calendar"></i>
            <span>Monthly View</span>
            <small>Group by month</small>
        </div>
        <div class="date-filter-divider"></div>
        <div class="date-filter-header">
            <h5>Time Range</h5>
        </div>
        <div class="date-filter-option ${currentDateRange === 'today' ? 'active' : ''}" data-range="today">
            <i class="ph-bold ph-sun"></i>
            <span>Today</span>
            <small>Current day</small>
        </div>
        <div class="date-filter-option ${currentDateRange === '7days' ? 'active' : ''}" data-range="7days">
            <i class="ph-bold ph-calendar-check"></i>
            <span>Last 7 Days</span>
            <small>One week</small>
        </div>
        <div class="date-filter-option ${currentDateRange === '30days' ? 'active' : ''}" data-range="30days">
            <i class="ph-bold ph-calendar-check"></i>
            <span>Last 30 Days</span>
            <small>One month</small>
        </div>
        <div class="date-filter-option ${currentDateRange === '90days' ? 'active' : ''}" data-range="90days">
            <i class="ph-bold ph-calendar-check"></i>
            <span>Last 90 Days</span>
            <small>Three months</small>
        </div>
        <div class="date-filter-option ${currentDateRange === '6months' ? 'active' : ''}" data-range="6months">
            <i class="ph-bold ph-calendar-star"></i>
            <span>Last 6 Months</span>
            <small>Half year</small>
        </div>
        <div class="date-filter-option ${currentDateRange === 'year' ? 'active' : ''}" data-range="year">
            <i class="ph-bold ph-calendar-star"></i>
            <span>Last Year</span>
            <small>12 months</small>
        </div>
        <div class="date-filter-option ${currentDateRange === 'all' ? 'active' : ''}" data-range="all">
            <i class="ph-bold ph-infinity"></i>
            <span>All Time</span>
            <small>Complete history</small>
        </div>
    `;
    
    // Position menu relative to dropdown button
    const dropdownBtn = document.querySelector('.dropdown-button');
    const rect = dropdownBtn.getBoundingClientRect();
    menu.style.cssText = `
        position: fixed;
        top: ${rect.bottom + 10}px;
        left: ${rect.left}px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        padding: 0.75rem;
        z-index: 1000;
        min-width: 260px;
        max-height: 500px;
        overflow-y: auto;
    `;
    
    document.body.appendChild(menu);
    
    // Add click handlers
    menu.querySelectorAll('.date-filter-option').forEach(option => {
        option.addEventListener('click', async function() {
            const range = this.dataset.range;
            menu.remove();
            await loadAnalyticsData(range);
            showNotification('View updated successfully', 'success');
        });
    });
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && !dropdownBtn.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

/**
 * Load and render charts with real data
 */
function loadCharts(analyticsData) {
    if (!analyticsData) {
        console.error('No analytics data provided to loadCharts');
        return;
    }
    
    initializeProgressTimelineChart(analyticsData);
    initializeCategoryCompletionChart(analyticsData);
}

/**
 * Initialize progress timeline chart (line chart) with real data
 */
function initializeProgressTimelineChart(analyticsData) {
    const chartCanvas = document.getElementById('progressTimelineChart');
    if (!chartCanvas) return;
    
    const ctx = chartCanvas.getContext('2d');
    
    // Destroy existing chart if it exists
    if (progressChart) {
        progressChart.destroy();
    }
    
    // Process timeline data from API
    const timeline = analyticsData.timeline || [];
    const labels = [];
    const completedData = [];
    let cumulativeAnswers = 0;
    
    // Calculate cumulative answers for progress tracking
    timeline.forEach(item => {
        const date = new Date(item.date);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        cumulativeAnswers += item.answers;
        
        // Calculate progress percentage
        const progress = analyticsData.total_questions > 0 
            ? (cumulativeAnswers / analyticsData.total_questions * 100) 
            : 0;
        completedData.push(Math.min(progress, 100).toFixed(1));
    });
    
    // If no timeline data, show current completion rate
    if (timeline.length === 0) {
        labels.push('Today');
        completedData.push(analyticsData.completion_rate || 0);
    }
    
    progressChart = new Chart(ctx, {
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
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

/**
 * Initialize category completion chart (bar chart) with real data
 */
function initializeCategoryCompletionChart(analyticsData) {
    const chartCanvas = document.getElementById('categoryCompletionChart');
    if (!chartCanvas) return;
    
    const ctx = chartCanvas.getContext('2d');
    
    // Destroy existing chart if it exists
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    // Process category data from API
    const formStatus = analyticsData.form_status || [];
    const categories = [];
    const completionData = [];
    const backgroundColors = [];
    
    formStatus.forEach(category => {
        categories.push(category.name);
        completionData.push(category.completion || 0);
        
        // Color based on completion percentage
        const completion = category.completion || 0;
        if (completion >= 90) {
            backgroundColors.push('#4caf50'); // Green for high completion
        } else if (completion >= 60) {
            backgroundColors.push('#3a6ea5'); // Blue for medium completion
        } else if (completion >= 30) {
            backgroundColors.push('#ff9800'); // Orange for low completion
        } else {
            backgroundColors.push('#f44336'); // Red for very low completion
        }
    });
    
    // If no data, show message
    if (formStatus.length === 0) {
        categories.push('No Data');
        completionData.push(0);
        backgroundColors.push('#cccccc');
    }
    
    categoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [{
                label: 'Completion %',
                data: completionData,
                backgroundColor: backgroundColors,
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
                            return context.parsed.y.toFixed(1) + '% Complete';
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
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

/**
 * Load category status cards with real data
 */
function loadCategoryStatus(analyticsData) {
    if (!analyticsData || !analyticsData.form_status) {
        console.error('No category data provided');
        return;
    }
    
    // Map category names to icons
    const iconMap = {
        'Basic Information': 'ph-info',
        'Student Data': 'ph-student',
        'Students': 'ph-student',
        'Staff Information': 'ph-users',
        'Staff': 'ph-users',
        'Teachers': 'ph-chalkboard-teacher',
        'Facilities': 'ph-buildings',
        'Programs & Activities': 'ph-calendar',
        'Programs': 'ph-calendar',
        'Resources': 'ph-books',
        'Administration': 'ph-briefcase',
        'Finance': 'ph-currency-dollar'
    };
    
    // Process categories from API data
    const categories = analyticsData.form_status.map(category => {
        const percentage = category.completion || 0;
        let status;
        
        // Determine status based on completion percentage
        if (percentage >= 100) {
            status = 'complete';
        } else if (percentage >= 75) {
            status = 'high';
        } else if (percentage >= 50) {
            status = 'medium';
        } else {
            status = 'low';
        }
        
        // Get icon or use default
        const icon = iconMap[category.name] || 'ph-folder';
        
        return {
            name: category.name,
            icon: icon,
            percentage: Math.round(percentage),
            total: category.total || 0,
            completed: category.answered || 0,
            status: status
        };
    });
    
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
 * Load data table with real data
 */
function loadDataTable(analyticsData) {
    if (!analyticsData || !analyticsData.form_status) {
        console.error('No data provided for table');
        return;
    }
    
    const tableData = [];
    
    // Process categories and their topics
    analyticsData.form_status.forEach(category => {
        // Add category row
        const categoryPercentage = category.completion || 0;
        let categoryStatus;
        
        if (categoryPercentage >= 100) {
            categoryStatus = 'complete';
        } else if (categoryPercentage > 0) {
            categoryStatus = 'in-progress';
        } else {
            categoryStatus = 'pending';
        }
        
        tableData.push({
            section: category.name,
            questions: category.total || 0,
            completed: category.answered || 0,
            percentage: Math.round(categoryPercentage),
            status: categoryStatus,
            isCategory: true
        });
        
        // Add topic rows if they exist
        if (category.children && category.children.length > 0) {
            category.children.forEach(topic => {
                const topicPercentage = topic.completion || 0;
                let topicStatus;
                
                if (topicPercentage >= 100) {
                    topicStatus = 'complete';
                } else if (topicPercentage > 0) {
                    topicStatus = 'in-progress';
                } else {
                    topicStatus = 'pending';
                }
                
                tableData.push({
                    section: '  ' + topic.name, // Indent topic names
                    questions: topic.total || 0,
                    completed: topic.answered || 0,
                    percentage: Math.round(topicPercentage),
                    status: topicStatus,
                    isCategory: false
                });
            });
        }
    });
    
    renderDataTable(tableData);
}

/**
 * Render data table
 */
function renderDataTable(data) {
    const tbody = document.querySelector('.analytics-table tbody');
    if (!tbody) return;
    
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #666;">
                    No data available yet. Start answering questions to see your progress!
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = data.map(row => {
        const rowClass = row.isCategory ? 'category-row' : 'topic-row';
        const sectionStyle = row.isCategory ? 'font-weight: 600;' : 'padding-left: 2rem;';
        
        return `
            <tr class="${rowClass}">
                <td style="${sectionStyle}">${row.section}</td>
            <td>${row.questions}</td>
            <td>${row.completed}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="flex: 1; max-width: 100px; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${row.percentage}%; height: 100%; background: ${getProgressColor(row.percentage)}; transition: width 0.3s ease;"></div>
                        </div>
                        <span>${row.percentage}%</span>
                    </div>
                </td>
                <td><span class="status-badge ${row.status}">${formatStatus(row.status)}</span></td>
        </tr>
        `;
    }).join('');
}

/**
 * Get progress bar color based on percentage
 */
function getProgressColor(percentage) {
    if (percentage >= 90) return '#4caf50';
    if (percentage >= 60) return '#3a6ea5';
    if (percentage >= 30) return '#ff9800';
    return '#f44336';
}

/**
 * Format status text
 */
function formatStatus(status) {
    const statusMap = {
        'complete': 'Complete',
        'in-progress': 'In Progress',
        'pending': 'Pending'
    };
    return statusMap[status] || status;
}

/**
 * Show loading state
 */
function showLoadingState() {
    console.log('Loading...');
    
    // Add loading overlay to charts
    const chartCards = document.querySelectorAll('.chart-card, .data-table-card, .category-status-section');
    chartCards.forEach(card => {
        if (!card.querySelector('.loading-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = '<div class="spinner"></div>';
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
            `;
            card.style.position = 'relative';
            card.appendChild(overlay);
        }
    });
    
    // Add spinner styles if not already present
    if (!document.getElementById('spinner-styles')) {
        const style = document.createElement('style');
        style.id = 'spinner-styles';
        style.textContent = `
            .spinner {
                border: 3px solid #f3f3f3;
                border-top: 3px solid #3a6ea5;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Hide loading state
 */
function hideLoadingState() {
    console.log('Loading complete');
    
    // Remove loading overlays
    const overlays = document.querySelectorAll('.loading-overlay');
    overlays.forEach(overlay => {
        overlay.remove();
    });
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style notification
    const colors = {
        'success': '#4caf50',
        'error': '#f44336',
        'warning': '#ff9800',
        'info': '#3a6ea5'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${colors[type] || colors.info};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;
    
    // Add animation styles if not present
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
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

/**
 * Update date range display in dropdown button
 */
function updateDateRangeDisplay(range) {
    const dropdownBtn = document.querySelector('.dropdown-button span');
    if (!dropdownBtn) return;
    
    const rangeNames = {
        'daily': 'Daily View',
        'weekly': 'Weekly View',
        'monthly': 'Monthly View',
        'today': 'Today',
        '7days': 'Last 7 Days',
        '30days': 'Last 30 Days',
        '90days': 'Last 90 Days',
        '6months': 'Last 6 Months',
        'year': 'Last Year',
        'all': 'All Time'
    };
    
    dropdownBtn.textContent = rangeNames[range] || 'Last 30 Days';
}

/**
 * Export data in specified format and section
 */
function exportData(section, format) {
    if (!currentAnalyticsData) {
        showNotification('No data to export', 'error');
        return;
    }
    
    console.log(`Exporting ${section} as ${format}`);
    
    try {
        let data, filename;
        
        switch (section) {
            case 'timeline':
                data = prepareTimelineData();
                filename = `progress-timeline-${getCurrentDateString()}`;
                break;
            case 'categories':
                data = prepareCategoryCompletionData();
                filename = `category-completion-${getCurrentDateString()}`;
                break;
            case 'status':
                data = prepareCategoryStatusData();
                filename = `category-status-${getCurrentDateString()}`;
                break;
            case 'all':
                data = prepareCompleteReportData();
                filename = `complete-analytics-report-${getCurrentDateString()}`;
                break;
            default:
                showNotification('Invalid export section', 'error');
                return;
        }
        
        if (format === 'csv') {
            downloadCSV(data, filename);
        } else if (format === 'excel') {
            downloadExcel(data, filename, section);
        }
        
        showNotification(`${section} exported successfully as ${format.toUpperCase()}`, 'success');
    } catch (error) {
        console.error('Export error:', error);
        showNotification('Failed to export data', 'error');
    }
}

/**
 * Prepare timeline data for export
 */
function prepareTimelineData() {
    const timeline = currentAnalyticsData.timeline || [];
    const headers = ['Date', 'Answers Submitted', 'Cumulative Completion %'];
    const rows = [];
    
    let cumulativeAnswers = 0;
    timeline.forEach(item => {
        cumulativeAnswers += item.answers;
        const progress = currentAnalyticsData.total_questions > 0 
            ? (cumulativeAnswers / currentAnalyticsData.total_questions * 100).toFixed(2)
            : 0;
        
        rows.push([
            item.date,
            item.answers,
            progress + '%'
        ]);
    });
    
    return { headers, rows, sheetName: 'Progress Timeline' };
}

/**
 * Prepare category completion data for export
 */
function prepareCategoryCompletionData() {
    const formStatus = currentAnalyticsData.form_status || [];
    const headers = ['Category', 'Total Questions', 'Completed', 'Completion %'];
    const rows = [];
    
    formStatus.forEach(category => {
        rows.push([
            category.name,
            category.total || 0,
            category.answered || 0,
            (category.completion || 0).toFixed(2) + '%'
        ]);
    });
    
    return { headers, rows, sheetName: 'Category Completion' };
}

/**
 * Prepare category status overview data for export
 */
function prepareCategoryStatusData() {
    const formStatus = currentAnalyticsData.form_status || [];
    const headers = ['Category', 'Total Questions', 'Completed', 'Pending', 'Completion %', 'Status'];
    const rows = [];
    
    formStatus.forEach(category => {
        const total = category.total || 0;
        const completed = category.answered || 0;
        const pending = total - completed;
        const completion = category.completion || 0;
        
        let status = '';
        if (completion >= 100) status = 'Complete';
        else if (completion >= 75) status = 'High Progress';
        else if (completion >= 50) status = 'Medium Progress';
        else if (completion > 0) status = 'Low Progress';
        else status = 'Not Started';
        
        rows.push([
            category.name,
            total,
            completed,
            pending,
            completion.toFixed(2) + '%',
            status
        ]);
        
        // Add topics if they exist
        if (category.children && category.children.length > 0) {
            category.children.forEach(topic => {
                const topicTotal = topic.total || 0;
                const topicCompleted = topic.answered || 0;
                const topicPending = topicTotal - topicCompleted;
                const topicCompletion = topic.completion || 0;
                
                let topicStatus = '';
                if (topicCompletion >= 100) topicStatus = 'Complete';
                else if (topicCompletion >= 75) topicStatus = 'High Progress';
                else if (topicCompletion >= 50) topicStatus = 'Medium Progress';
                else if (topicCompletion > 0) topicStatus = 'Low Progress';
                else topicStatus = 'Not Started';
                
                rows.push([
                    '  ' + topic.name,
                    topicTotal,
                    topicCompleted,
                    topicPending,
                    topicCompletion.toFixed(2) + '%',
                    topicStatus
                ]);
            });
        }
    });
    
    return { headers, rows, sheetName: 'Category Status' };
}

/**
 * Prepare complete report data for export
 */
function prepareCompleteReportData() {
    const headers = ['Section', 'Metric', 'Value'];
    const rows = [];
    
    // Summary section
    rows.push(['Summary', 'Total Questions', currentAnalyticsData.total_questions || 0]);
    rows.push(['Summary', 'Answered Questions', currentAnalyticsData.answered_questions || 0]);
    rows.push(['Summary', 'Completion Rate', (currentAnalyticsData.completion_rate || 0).toFixed(2) + '%']);
    rows.push(['Summary', 'Date Range', currentDateRange]);
    rows.push(['Summary', 'Report Generated', new Date().toLocaleString()]);
    rows.push(['', '', '']); // Empty row
    
    // Categories section
    rows.push(['Categories', 'Category Name', 'Completion']);
    const formStatus = currentAnalyticsData.form_status || [];
    formStatus.forEach(category => {
        rows.push(['Categories', category.name, (category.completion || 0).toFixed(2) + '%']);
        
        // Add topics
        if (category.children && category.children.length > 0) {
            category.children.forEach(topic => {
                rows.push(['Categories', '  ' + topic.name, (topic.completion || 0).toFixed(2) + '%']);
            });
        }
    });
    
    return { headers, rows, sheetName: 'Complete Report' };
}

/**
 * Download data as CSV
 */
function downloadCSV(data, filename) {
    let csvContent = '';
    
    // Add headers
    csvContent += data.headers.map(h => `"${h}"`).join(',') + '\n';
    
    // Add rows
    data.rows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

/**
 * Download data as Excel (using HTML table method)
 */
function downloadExcel(data, filename, section) {
    // Create HTML table
    let tableHTML = '<table border="1">';
    
    // Add title
    tableHTML += `<tr><th colspan="${data.headers.length}" style="font-size: 16px; font-weight: bold; background-color: #3a6ea5; color: white;">${section.toUpperCase()} REPORT</th></tr>`;
    
    // Add metadata
    tableHTML += `<tr><th colspan="${data.headers.length}" style="background-color: #f0f0f0;">Generated: ${new Date().toLocaleString()}</th></tr>`;
    tableHTML += `<tr><th colspan="${data.headers.length}" style="background-color: #f0f0f0;">Date Range: ${currentDateRange}</th></tr>`;
    tableHTML += '<tr><td colspan="' + data.headers.length + '">&nbsp;</td></tr>';
    
    // Add headers
    tableHTML += '<tr>';
    data.headers.forEach(header => {
        tableHTML += `<th style="background-color: #3a6ea5; color: white; font-weight: bold;">${header}</th>`;
    });
    tableHTML += '</tr>';
    
    // Add rows
    data.rows.forEach((row, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
        tableHTML += `<tr style="background-color: ${bgColor};">`;
        row.forEach(cell => {
            tableHTML += `<td>${cell}</td>`;
        });
        tableHTML += '</tr>';
    });
    
    tableHTML += '</table>';
    
    // Create Excel file
    const excelContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
            <meta charset="UTF-8">
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>${data.sheetName || 'Sheet1'}</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayGridlines/>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
        </head>
        <body>
            ${tableHTML}
        </body>
        </html>
    `;
    
    // Create and download file
    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename + '.xls';
    link.click();
    URL.revokeObjectURL(link.href);
}

/**
 * Get current date string for filenames
 */
function getCurrentDateString() {
    return new Date().toISOString().split('T')[0];
}

