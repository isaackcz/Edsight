/**
 * User Dashboard - Overview Page JavaScript
 * Handles donut charts, progress timeline, notifications, and workflow status
 */

let questionsDonutChart = null;
let topicsDonutChart = null;
let categoriesDonutChart = null;
let progressLineChart = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeOverview();
});

/**
 * Main initialization function
 */
async function initializeOverview() {
    // Initialize workflow status first with server-side data if available
    initializeWorkflowStatusFromServer();
    
    // Initialize donut charts
    await initializeDonutCharts();
    
    // Initialize progress timeline
    await initializeProgressTimeline('daily');
    
    // Load notifications
    await loadNotifications();
    
    // Load workflow status from API (will update if different from server data)
    await loadWorkflowStatus();
    
    // Setup event listeners
    setupEventListeners();
}

/**
 * Initialize workflow status from server-side data attributes
 */
function initializeWorkflowStatusFromServer() {
    const dashboardData = document.getElementById('dashboardData');
    if (!dashboardData) return;
    
    const workflowStatus = dashboardData.getAttribute('data-workflow-status') || 'draft';
    const currentLevel = dashboardData.getAttribute('data-current-level') || 'school';
    const formStatus = dashboardData.getAttribute('data-form-status') || 'draft';
    const lastUpdated = dashboardData.getAttribute('data-last-updated') || null;
    
    if (workflowStatus && currentLevel) {
        const workflowData = {
            workflow_status: workflowStatus,
            current_level: currentLevel,
            form_status: formStatus,
            last_updated: lastUpdated,
            current_status: null, // Will be set by renderWorkflowStatus
        };
        
        renderWorkflowStatus(workflowData);
    }
}

/**
 * Initialize all three donut charts
 */
async function initializeDonutCharts() {
    try {
        const response = await fetch('/user/dashboard/api/progress/');
        if (!response.ok) throw new Error('Failed to fetch progress data');
        
        const data = await response.json();
        const progress = data.progress || {};
        
        // Questions donut chart - use overall completion
        const questionsData = progress.overall || {};
        const questionsPercentage = questionsData.completion_percentage || 0;
        renderDonutChart('questionsDonutChart', questionsPercentage, 'Questions');
        updateChartCenterText('questionsPercentage', questionsPercentage);
        
        // Topics donut chart - use topics data from API
        const topicsData = progress.topics || {};
        const topicsPercentage = topicsData.completion_percentage || 0;
        renderDonutChart('topicsDonutChart', topicsPercentage, 'Topics');
        updateChartCenterText('topicsPercentage', topicsPercentage);
        
        // Categories donut chart - use categories data from API
        const categoriesData = progress.categories || {};
        const categoriesPercentage = categoriesData.completion_percentage || 0;
        renderDonutChart('categoriesDonutChart', categoriesPercentage, 'Categories');
        updateChartCenterText('categoriesPercentage', categoriesPercentage);
        
    } catch (error) {
        console.error('Error initializing donut charts:', error);
        // Render empty charts
        renderDonutChart('questionsDonutChart', 0, 'Questions');
        renderDonutChart('topicsDonutChart', 0, 'Topics');
        renderDonutChart('categoriesDonutChart', 0, 'Categories');
    }
}

/**
 * Calculate topics progress from category data
 * Uses category completion as proxy - a category is complete when all its topics are complete
 */
function calculateTopicsProgress(categoryData) {
    let totalTopics = 0;
    let completedTopics = 0;
    
    // For each category, count topics
    // Since category completion means all topics in that category are complete,
    // we can use category completion as an indicator
    categoryData.forEach(category => {
        // Each category represents topics - use category completion
        if (category.completion_percentage === 100) {
            completedTopics += 1;
        }
        // Count each category as having topics
        totalTopics += 1;
    });
    
    const percentage = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    return { completed: completedTopics, total: totalTopics, percentage };
}

/**
 * Calculate categories progress
 */
function calculateCategoriesProgress(categoryData) {
    const totalCategories = categoryData.length;
    const completedCategories = categoryData.filter(cat => cat.completion_percentage === 100).length;
    const percentage = totalCategories > 0 ? Math.round((completedCategories / totalCategories) * 100) : 0;
    return { completed: completedCategories, total: totalCategories, percentage };
}

/**
 * Render a donut chart
 */
function renderDonutChart(canvasId, percentage, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart if it exists
    const chartMap = {
        'questionsDonutChart': questionsDonutChart,
        'topicsDonutChart': topicsDonutChart,
        'categoriesDonutChart': categoriesDonutChart
    };
    
    if (chartMap[canvasId]) {
        chartMap[canvasId].destroy();
    }
    
    const percentageValue = Math.max(0, Math.min(100, percentage));
    const remaining = 100 - percentageValue;
    
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Remaining'],
            datasets: [{
                data: [percentageValue, remaining],
                backgroundColor: [
                    '#3a6ea5',
                    '#e0e0e0'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed}%`;
                        }
                    }
                }
            }
        }
    });
    
    // Store chart reference
    if (canvasId === 'questionsDonutChart') questionsDonutChart = chart;
    else if (canvasId === 'topicsDonutChart') topicsDonutChart = chart;
    else if (canvasId === 'categoriesDonutChart') categoriesDonutChart = chart;
}

/**
 * Update chart center text
 */
function updateChartCenterText(elementId, percentage) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = `${Math.round(percentage)}%`;
    }
}

/**
 * Initialize progress timeline chart
 */
async function initializeProgressTimeline(viewType = 'daily') {
    try {
        const response = await fetch(`/user/dashboard/api/progress-timeline/?view_type=${viewType}`);
        if (!response.ok) throw new Error('Failed to fetch timeline data');
        
        const data = await response.json();
        const timeline = data.timeline || [];
        
        renderProgressLineChart(timeline, viewType);
        
    } catch (error) {
        console.error('Error loading progress timeline:', error);
        renderProgressLineChart([], viewType);
    }
}

/**
 * Render progress line chart
 */
function renderProgressLineChart(timelineData, viewType) {
    const canvas = document.getElementById('progressLineChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (progressLineChart) {
        progressLineChart.destroy();
    }
    
    // Prepare data
    const labels = timelineData.map(item => {
        const date = new Date(item.date);
        if (viewType === 'monthly') {
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    });
    
    const cumulativeData = timelineData.map(item => item.cumulative);
    const answeredData = timelineData.map(item => item.answered);
    
    progressLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Cumulative Answers',
                    data: cumulativeData,
                    borderColor: '#3a6ea5',
                    backgroundColor: 'rgba(58, 110, 165, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#3a6ea5',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                },
                {
                    label: 'Answers per Period',
                    data: answeredData,
                    borderColor: '#ff6700',
                    backgroundColor: 'rgba(255, 103, 0, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#ff6700',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12,
                            family: 'Poppins'
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        family: 'Poppins'
                    },
                    bodyFont: {
                        size: 12,
                        family: 'Poppins'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            family: 'Poppins',
                            size: 11
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: 'Poppins',
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

/**
 * Load notifications
 */
async function loadNotifications() {
    try {
        const response = await fetch('/user/dashboard/api/notifications/?limit=10');
        if (!response.ok) throw new Error('Failed to fetch notifications');
        
        const data = await response.json();
        const notifications = data.notifications || [];
        
        renderNotifications(notifications);
        
    } catch (error) {
        console.error('Error loading notifications:', error);
        renderNotifications([]);
    }
}

/**
 * Render notifications list
 */
function renderNotifications(notifications) {
    const container = document.getElementById('notificationsList');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="ph-bold ph-bell-slash" style="font-size: 2rem;"></i>
                <p class="mt-2 mb-0">No notifications</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = notifications.map(notif => {
        const priorityClass = getPriorityClass(notif.priority);
        const readClass = notif.is_read ? '' : 'notification-unread';
        const icon = getNotificationIcon(notif.type);
        const timeAgo = formatRelativeTime(notif.created_at);
        
        // Special handling for deadline notifications
        let deadlineBadge = '';
        if (notif.deadline) {
            const deadline = notif.deadline;
            let badgeClass = 'bg-secondary';
            let badgeText = '';
            
            if (deadline.is_overdue) {
                badgeClass = 'bg-danger';
                badgeText = `Overdue: ${Math.abs(deadline.days_remaining)} day${Math.abs(deadline.days_remaining) !== 1 ? 's' : ''}`;
            } else if (deadline.days_remaining === 0) {
                badgeClass = 'bg-danger';
                badgeText = 'Due Today';
            } else if (deadline.days_remaining <= 3) {
                badgeClass = 'bg-warning text-dark';
                badgeText = `${deadline.days_remaining} day${deadline.days_remaining !== 1 ? 's' : ''} remaining`;
            } else {
                badgeClass = 'bg-info';
                badgeText = `${deadline.days_remaining} day${deadline.days_remaining !== 1 ? 's' : ''} remaining`;
            }
            
            const deadlineDate = new Date(deadline.deadline_date);
            const formattedDate = deadlineDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            
            deadlineBadge = `
                <div class="mt-2">
                    <span class="badge ${badgeClass} me-2">${badgeText}</span>
                    <span class="text-muted small">Due: ${formattedDate}</span>
                </div>
            `;
        }
        
        return `
            <div class="notification-item ${readClass} mb-2 p-2 rounded">
                <div class="d-flex align-items-start">
                    <div class="notification-icon ${priorityClass} me-2">
                        <i class="ph-bold ${icon}"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="fw-bold small">${escapeHtml(notif.title)}</div>
                        <div class="text-muted small">${escapeHtml(notif.message)}</div>
                        ${deadlineBadge}
                        <div class="text-muted" style="font-size: 0.75rem;">${timeAgo}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Get priority CSS class
 */
function getPriorityClass(priority) {
    const map = {
        'urgent': 'text-danger',
        'high': 'text-warning',
        'medium': 'text-info',
        'low': 'text-muted'
    };
    return map[priority] || 'text-info';
}

/**
 * Get notification icon
 */
function getNotificationIcon(type) {
    const map = {
        'form_submitted': 'ph-paper-plane-right',
        'form_approved': 'ph-check-circle',
        'form_returned': 'ph-arrow-counter-clockwise',
        'form_rejected': 'ph-x-circle',
        'deadline_reminder': 'ph-clock',
        'overdue_notification': 'ph-warning'
    };
    return map[type] || 'ph-bell';
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Load workflow status
 */
async function loadWorkflowStatus() {
    try {
        const response = await fetch('/user/dashboard/api/progress/');
        if (!response.ok) throw new Error('Failed to fetch workflow status');
        
        const data = await response.json();
        const progress = data.progress || {};
        
        // Extract workflow status data
        const workflowData = {
            current_status: progress.current_status || progress.workflow_status || 'draft',
            current_level: progress.current_level || 'school',
            form_status: progress.form_status || 'draft',
            workflow_status: progress.workflow_status || 'draft',
            last_updated: progress.last_updated || null,
            submitted_at: progress.submitted_at || null
        };
        
        renderWorkflowStatus(workflowData);
        
    } catch (error) {
        console.error('Error loading workflow status:', error);
        renderWorkflowStatus({
            current_status: 'Draft',
            current_level: 'school',
            form_status: 'draft',
            workflow_status: 'draft',
            last_updated: null,
            submitted_at: null
        });
    }
}

/**
 * Render workflow status
 */
function renderWorkflowStatus(workflowData) {
    const currentStatusEl = document.getElementById('workflowCurrentStatus');
    const currentLevelEl = document.getElementById('workflowCurrentLevel');
    const formStatusEl = document.getElementById('workflowFormStatus');
    const lastUpdatedEl = document.getElementById('workflowLastUpdated');
    const stepsEl = document.getElementById('workflowSteps');
    
    // Map workflow status to display text
    const statusDisplayMap = {
        'draft': 'Draft',
        'district_pending': 'Pending District Review',
        'district_approved': 'Approved by District',
        'district_returned': 'Returned by District',
        'division_pending': 'Pending Division Review',
        'division_approved': 'Approved by Division',
        'division_returned': 'Returned by Division',
        'region_pending': 'Pending Region Review',
        'region_approved': 'Approved by Region',
        'region_returned': 'Returned by Region',
        'central_pending': 'Pending Central Review',
        'central_approved': 'Approved by Central',
        'central_returned': 'Returned by Central',
        'completed': 'Completed'
    };
    
    const levelDisplayMap = {
        'school': 'School',
        'district': 'District',
        'division': 'Division',
        'region': 'Region',
        'central': 'Central Office'
    };
    
    const formStatusDisplayMap = {
        'draft': 'Draft',
        'in-progress': 'In Progress',
        'submitted': 'Submitted',
        'completed': 'Completed'
    };
    
    // Update status badges
    if (currentStatusEl) {
        const workflowStatus = workflowData.workflow_status || 'draft';
        const displayStatus = statusDisplayMap[workflowStatus] || workflowData.current_status || 'Draft';
        const badgeClass = getWorkflowStatusBadgeClass(workflowStatus);
        currentStatusEl.innerHTML = `<span class="badge ${badgeClass}">${displayStatus}</span>`;
    }
    
    if (currentLevelEl) {
        const level = workflowData.current_level || 'school';
        const displayLevel = levelDisplayMap[level] || level.charAt(0).toUpperCase() + level.slice(1);
        currentLevelEl.innerHTML = `<span class="badge bg-info">${displayLevel}</span>`;
    }
    
    if (formStatusEl) {
        const formStatus = workflowData.form_status || 'draft';
        const displayFormStatus = formStatusDisplayMap[formStatus] || formStatus.charAt(0).toUpperCase() + formStatus.slice(1);
        const badgeClass = getFormStatusBadgeClass(formStatus);
        formStatusEl.innerHTML = `<span class="badge ${badgeClass}">${displayFormStatus}</span>`;
    }
    
    if (lastUpdatedEl) {
        const updated = workflowData.last_updated ? formatRelativeTime(workflowData.last_updated) : 'Never';
        lastUpdatedEl.innerHTML = `<span class="text-muted small">${updated}</span>`;
    }
    
    // Render workflow steps
    if (stepsEl) {
        const steps = getWorkflowSteps(workflowData.workflow_status || 'draft', workflowData.current_level || 'school');
        stepsEl.innerHTML = steps.map(step => {
            let iconHtml = '';
            if (step.completed) {
                iconHtml = '<i class="ph-bold ph-check"></i>';
            } else if (step.active) {
                iconHtml = '<i class="ph-bold ph-clock-clockwise"></i>';
            } else {
                iconHtml = '<i class="ph-bold ph-circle"></i>';
            }
            
            return `
            <div class="workflow-step ${step.active ? 'active' : ''} ${step.completed ? 'completed' : ''} ${!step.active && !step.completed ? 'pending' : ''}">
                <div class="step-icon">
                    ${iconHtml}
                </div>
                <div class="step-label">${step.label}</div>
            </div>
        `;
        }).join('');
    }
}

/**
 * Get workflow status badge class
 */
function getWorkflowStatusBadgeClass(status) {
    if (status.includes('approved')) return 'bg-success';
    if (status.includes('returned')) return 'bg-warning';
    if (status.includes('pending')) return 'bg-info';
    if (status === 'completed') return 'bg-success';
    return 'bg-secondary';
}

/**
 * Get form status badge class
 */
function getFormStatusBadgeClass(status) {
    const map = {
        'draft': 'bg-secondary',
        'in-progress': 'bg-primary',
        'submitted': 'bg-info',
        'completed': 'bg-success'
    };
    return map[status] || 'bg-secondary';
}

/**
 * Get workflow steps based on workflow status and current level
 */
function getWorkflowSteps(workflowStatus, currentLevel) {
    const steps = [
        { label: 'School', level: 'school', completed: false, active: false },
        { label: 'District', level: 'district', completed: false, active: false },
        { label: 'Division', level: 'division', completed: false, active: false },
        { label: 'Region', level: 'region', completed: false, active: false },
        { label: 'Central', level: 'central', completed: false, active: false }
    ];
    
    const levelOrder = ['school', 'district', 'division', 'region', 'central'];
    const currentIndex = levelOrder.indexOf(currentLevel);
    
    // If form is completed, all steps are completed
    if (workflowStatus === 'completed' || workflowStatus === 'central_approved') {
        steps.forEach(step => {
            step.completed = true;
            step.active = false;
        });
        return steps;
    }
    
    // Determine completed and active steps based on workflow status
    if (workflowStatus === 'draft') {
        // Draft: only school is active
        steps[0].active = true;
    } else if (workflowStatus.includes('district')) {
        if (workflowStatus === 'district_pending') {
            steps[0].completed = true;
            steps[1].active = true;
        } else if (workflowStatus === 'district_approved') {
            steps[0].completed = true;
            steps[1].completed = true;
            steps[2].active = true;
        } else if (workflowStatus === 'district_returned') {
            steps[0].active = true; // Returned to school
        }
    } else if (workflowStatus.includes('division')) {
        steps[0].completed = true;
        steps[1].completed = true;
        if (workflowStatus === 'division_pending') {
            steps[2].active = true;
        } else if (workflowStatus === 'division_approved') {
            steps[2].completed = true;
            steps[3].active = true;
        } else if (workflowStatus === 'division_returned') {
            steps[1].active = true; // Returned to district
        }
    } else if (workflowStatus.includes('region')) {
        steps[0].completed = true;
        steps[1].completed = true;
        steps[2].completed = true;
        if (workflowStatus === 'region_pending') {
            steps[3].active = true;
        } else if (workflowStatus === 'region_approved') {
            steps[3].completed = true;
            steps[4].active = true;
        } else if (workflowStatus === 'region_returned') {
            steps[2].active = true; // Returned to division
        }
    } else if (workflowStatus.includes('central')) {
        steps[0].completed = true;
        steps[1].completed = true;
        steps[2].completed = true;
        steps[3].completed = true;
        if (workflowStatus === 'central_pending') {
            steps[4].active = true;
        } else if (workflowStatus === 'central_approved') {
            steps[4].completed = true;
        } else if (workflowStatus === 'central_returned') {
            steps[3].active = true; // Returned to region
        }
    } else {
        // Fallback: use current level
        steps.forEach((step, index) => {
            if (index < currentIndex) {
                step.completed = true;
            } else if (index === currentIndex) {
                step.active = true;
            }
        });
    }
    
    return steps;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Timeline view toggle
    const timelineViews = document.querySelectorAll('input[name="timelineView"]');
    timelineViews.forEach(radio => {
        radio.addEventListener('change', function() {
            initializeProgressTimeline(this.value);
        });
    });
    
    // Refresh notifications button
    const refreshBtn = document.getElementById('refreshNotifications');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadNotifications();
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
