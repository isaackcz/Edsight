/**
 * User Dashboard - Overview Page JavaScript
 * Handles stats, charts, and quick actions
 */

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeOverview();
});

/**
 * Main initialization function
 */
function initializeOverview() {
    loadStats();
    initializeCharts();
    initializeQuickActions();
    loadRecentActivity();
}

/**
 * Load and display statistics
 */
function loadStats() {
    // Placeholder for API call to fetch stats
    const stats = {
        questionsAnswered: 142,
        savedLocally: 28,
        inDatabase: 114,
        completionRate: 78
    };
    
    updateStatCards(stats);
}

/**
 * Update stat cards with data
 */
function updateStatCards(stats) {
    const questionsAnsweredEl = document.querySelector('[data-stat="questions-answered"]');
    const savedLocallyEl = document.querySelector('[data-stat="saved-locally"]');
    const inDatabaseEl = document.querySelector('[data-stat="in-database"]');
    const completionRateEl = document.querySelector('[data-stat="completion-rate"]');
    
    if (questionsAnsweredEl) {
        animateValue(questionsAnsweredEl, 0, stats.questionsAnswered, 1000);
    }
    
    if (savedLocallyEl) {
        animateValue(savedLocallyEl, 0, stats.savedLocally, 1000);
    }
    
    if (inDatabaseEl) {
        animateValue(inDatabaseEl, 0, stats.inDatabase, 1000);
    }
    
    if (completionRateEl) {
        animateValue(completionRateEl, 0, stats.completionRate, 1000, '%');
    }
}

/**
 * Animate number counting
 */
function animateValue(element, start, end, duration, suffix = '') {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        element.textContent = value + suffix;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

/**
 * Initialize charts
 */
function initializeCharts() {
    initializeCompletionChart();
}

/**
 * Initialize completion donut chart
 */
function initializeCompletionChart() {
    const chartCanvas = document.getElementById('completionChart');
    if (!chartCanvas) return;
    
    const ctx = chartCanvas.getContext('2d');
    
    // Placeholder data
    const data = {
        completed: 78,
        remaining: 22
    };
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Remaining'],
            datasets: [{
                data: [data.completed, data.remaining],
                backgroundColor: [
                    '#3a6ea5',
                    '#ebebebff'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            family: 'Poppins',
                            size: 13
                        },
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed + '%';
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

/**
 * Initialize quick action buttons
 */
function initializeQuickActions() {
    const saveAllBtn = document.querySelector('[data-action="save-all"]');
    const exportBtn = document.querySelector('[data-action="export"]');
    const importBtn = document.querySelector('[data-action="import"]');
    const clearBtn = document.querySelector('[data-action="clear"]');
    
    if (saveAllBtn) {
        saveAllBtn.addEventListener('click', handleSaveAll);
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExport);
    }
    
    if (importBtn) {
        importBtn.addEventListener('click', handleImport);
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', handleClear);
    }
}

/**
 * Handle save all progress
 */
function handleSaveAll() {
    console.log('Saving all progress...');
    showNotification('Progress saved successfully', 'success');
    // Placeholder for API call
}

/**
 * Handle export data
 */
function handleExport() {
    console.log('Exporting data...');
    showNotification('Data exported successfully', 'success');
    // Placeholder for export functionality
}

/**
 * Handle import data
 */
function handleImport() {
    console.log('Importing data...');
    // Placeholder for import functionality
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        console.log('File selected:', file.name);
        showNotification('Data imported successfully', 'success');
    };
    input.click();
}

/**
 * Handle clear data
 */
function handleClear() {
    if (confirm('Are you sure you want to clear all local data? This action cannot be undone.')) {
        console.log('Clearing data...');
        showNotification('Data cleared successfully', 'info');
        // Placeholder for clear functionality
    }
}

/**
 * Load recent activity timeline
 */
function loadRecentActivity() {
    // Placeholder for API call
    const activities = [
        {
            type: 'success',
            icon: 'ph-check-circle',
            title: 'Form submitted successfully',
            description: 'Application form submitted to district office',
            time: '2 hours ago'
        },
        {
            type: 'info',
            icon: 'ph-floppy-disk',
            title: 'Progress saved',
            description: 'All answers saved to local storage',
            time: '5 hours ago'
        },
        {
            type: 'warning',
            icon: 'ph-warning',
            title: 'Deadline reminder',
            description: 'Submission deadline in 3 days',
            time: '1 day ago'
        }
    ];
    
    renderActivityTimeline(activities);
}

/**
 * Render activity timeline
 */
function renderActivityTimeline(activities) {
    const timelineContainer = document.querySelector('.activity-timeline');
    if (!timelineContainer) return;
    
    timelineContainer.innerHTML = activities.map(activity => `
        <div class="timeline-item">
            <div class="timeline-icon ${activity.type}">
                <i class="ph-bold ${activity.icon}"></i>
            </div>
            <div class="timeline-content">
                <h4 class="timeline-title">${activity.title}</h4>
                <p class="timeline-description">${activity.description}</p>
                <span class="timeline-time">${activity.time}</span>
            </div>
        </div>
    `).join('');
}

/**
 * Show notification (placeholder - to be integrated with global notification system)
 */
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // TODO: Integrate with global notification system
}

/**
 * Update progress bar
 */
function updateProgressBar(percentage) {
    const progressBar = document.querySelector('.progress-bar-fill');
    const progressText = document.querySelector('.progress-text');
    
    if (progressBar) {
        progressBar.style.width = percentage + '%';
    }
    
    if (progressText) {
        progressText.textContent = percentage + '% Complete';
    }
}

