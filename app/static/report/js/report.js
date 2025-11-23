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
    
    // Initialize date range selector
    initializeDateRangeSelector();
    
    // Initialize charts
    initCharts();
    
    // Initialize geographic level selector
    const geographicLevelSelect = document.getElementById('geographic-level-select');
    if (geographicLevelSelect) {
        geographicLevelSelect.addEventListener('change', async function() {
            const level = this.value;
            const filters = collectFilters();
            
            const response = await fetch('/api/reports/geographic-performance/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filters)
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    renderGeographicReport(data.data, level);
                }
            }
        });
    }
    
    // Initialize export and comparison mode
    initializeExportAndComparison();
    
    // Load initial data
    loadReportData().then(initializeFilters).catch(console.error);
    
    // Close search results when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-filter-container')) {
            closeAllDropdowns();
        }
        if (!e.target.closest('.date-selector')) {
            closeDateRangeDropdown();
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
            if (overlay) {
            overlay.classList.remove('active');
            }
            document.body.style.overflow = '';
        }
    });
}




// Theme switching logic removed - project does not support dark mode

let charts = {};

let formsOverTimeChart = null;
let statusDistributionChart = null;
let workflowDistributionChart = null;
let geographicChart = null;

function initCharts() {
    // Common Chart Options
    Chart.defaults.font.family = "'Segoe UI', 'Public Sans', sans-serif";
    Chart.defaults.scale.grid.color = 'rgba(225,225,225,0.6)';
    Chart.defaults.scale.grid.borderColor = 'transparent';
    
    // Initialize chart containers
    initFormsOverTimeChart();
    initStatusDistributionChart();
    initWorkflowDistributionChart();
    initGeographicChart();
}

function initFormsOverTimeChart() {
    const ctx = document.getElementById('formsOverTimeChart');
    if (!ctx) return;
    
    if (formsOverTimeChart) {
        formsOverTimeChart.destroy();
    }
    
    formsOverTimeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Forms Started',
                    data: [],
                    borderColor: 'rgba(58, 110, 165, 0.9)',
                    backgroundColor: 'rgba(58, 110, 165, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Forms Completed',
                    data: [],
                    borderColor: 'rgba(255, 103, 0, 0.9)',
                    backgroundColor: 'rgba(255, 103, 0, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function initStatusDistributionChart() {
    const ctx = document.getElementById('statusDistributionChart');
    if (!ctx) return;
    
    if (statusDistributionChart) {
        statusDistributionChart.destroy();
    }
    
    statusDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgba(58, 110, 165, 0.8)',
                    'rgba(255, 103, 0, 0.8)',
                    'rgba(76, 175, 80, 0.8)',
                    'rgba(244, 67, 54, 0.8)',
                    'rgba(156, 39, 176, 0.8)',
                    'rgba(255, 152, 0, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                }
            }
        }
    });
}

function initWorkflowDistributionChart() {
    const ctx = document.getElementById('workflowDistributionChart');
    if (!ctx) return;
    
    if (workflowDistributionChart) {
        workflowDistributionChart.destroy();
    }
    
    workflowDistributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Forms',
                data: [],
                backgroundColor: 'rgba(58, 110, 165, 0.8)',
                borderColor: 'rgba(58, 110, 165, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function initGeographicChart() {
    const ctx = document.getElementById('geographicChart');
    if (!ctx) return;
    
    if (geographicChart) {
        geographicChart.destroy();
    }
    
    geographicChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Forms',
                data: [],
                backgroundColor: 'rgba(255, 103, 0, 0.8)',
                borderColor: 'rgba(255, 103, 0, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

async function loadChartData() {
    try {
        const filters = collectFilters();
        
        // Load time series data
        const timeSeriesResponse = await fetch('/api/analytics/time-series/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filters: filters, group_by: 'day' })
        });
        
        if (timeSeriesResponse.ok) {
            const timeSeriesData = await timeSeriesResponse.json();
            if (timeSeriesData.success && timeSeriesData.data) {
                updateFormsOverTimeChart(timeSeriesData.data.forms_over_time);
            }
        }
        
        // Load distribution data
        const distributionsResponse = await fetch('/api/analytics/distributions/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filters: filters, geographic_level: 'region' })
        });
        
        if (distributionsResponse.ok) {
            const distributionsData = await distributionsResponse.json();
            if (distributionsData.success && distributionsData.data) {
                updateStatusDistributionChart(distributionsData.data.status_distribution);
                updateWorkflowDistributionChart(distributionsData.data.workflow_distribution);
                updateGeographicChart(distributionsData.data.geographic_distribution);
            }
        }
    } catch (error) {
        console.error('Error loading chart data:', error);
    }
}

function updateFormsOverTimeChart(data) {
    if (!formsOverTimeChart || !data) return;
    
    const started = data.started || [];
    const completed = data.completed || [];
    
    // Get all unique labels
    const allLabels = new Set();
    started.forEach(item => allLabels.add(item.label));
    completed.forEach(item => allLabels.add(item.label));
    const labels = Array.from(allLabels).sort();
    
    // Create data arrays
    const startedData = new Array(labels.length).fill(0);
    const completedData = new Array(labels.length).fill(0);
    
    started.forEach(item => {
        const index = labels.indexOf(item.label);
        if (index !== -1) {
            startedData[index] = item.count;
        }
    });
    
    completed.forEach(item => {
        const index = labels.indexOf(item.label);
        if (index !== -1) {
            completedData[index] = item.count;
        }
    });
    
    formsOverTimeChart.data.labels = labels;
    formsOverTimeChart.data.datasets[0].data = startedData;
    formsOverTimeChart.data.datasets[1].data = completedData;
    formsOverTimeChart.update();
}

function updateStatusDistributionChart(data) {
    if (!statusDistributionChart || !data || data.length === 0) return;
    
    const labels = data.map(item => item.status || 'Unknown');
    const values = data.map(item => item.count || 0);
    
    statusDistributionChart.data.labels = labels;
    statusDistributionChart.data.datasets[0].data = values;
    statusDistributionChart.update();
}

function updateWorkflowDistributionChart(data) {
    if (!workflowDistributionChart || !data || data.length === 0) return;
    
    const labels = data.map(item => {
        // Format workflow status for display
        const status = item.workflow_status || 'Unknown';
        return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    });
    const values = data.map(item => item.count || 0);
    
    workflowDistributionChart.data.labels = labels;
    workflowDistributionChart.data.datasets[0].data = values;
    workflowDistributionChart.update();
}

function updateGeographicChart(data) {
    if (!geographicChart || !data || data.length === 0) return;
    
    // Limit to top 10 for readability
    const topData = data.slice(0, 10);
    const labels = topData.map(item => item.name || 'Unknown');
    const values = topData.map(item => item.count || 0);
    
    geographicChart.data.labels = labels;
    geographicChart.data.datasets[0].data = values;
    geographicChart.update();
}

// Detailed Reports Functions
async function loadDetailedReports() {
    try {
        const filters = collectFilters();
        
        // Load workflow performance report
        const workflowResponse = await fetch('/api/reports/workflow-performance/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
        });
        
        if (workflowResponse.ok) {
            const workflowData = await workflowResponse.json();
            if (workflowData.success && workflowData.data) {
                renderWorkflowReport(workflowData.data);
            }
        }
        
        // Load geographic performance report
        const geographicResponse = await fetch('/api/reports/geographic-performance/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
        });
        
        if (geographicResponse.ok) {
            const geographicData = await geographicResponse.json();
            if (geographicData.success && geographicData.data) {
                renderGeographicReport(geographicData.data, 'region');
            }
        }
    } catch (error) {
        console.error('Error loading detailed reports:', error);
    }
}

function renderWorkflowReport(data) {
    const tbody = document.getElementById('workflow-performance-tbody');
    if (!tbody || !data.stages) return;
    
    if (data.stages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No workflow data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.stages.map(stage => `
        <tr>
            <td>${stage.stage_display}</td>
            <td>${stage.count.toLocaleString()}</td>
            <td>${stage.avg_time_hours.toFixed(2)}</td>
            <td>${stage.approval_count}</td>
            <td>${stage.return_count}</td>
            <td>${stage.approval_rate.toFixed(2)}%</td>
        </tr>
    `).join('');
    
    // Add sorting functionality
    addTableSorting('workflow-performance-table');
}

// Additional Reports Functions
async function loadAdditionalReports() {
    try {
        const filters = collectFilters();
        
        // Load deadline compliance report
        const deadlineResponse = await fetch('/api/reports/deadline-compliance/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
        });
        
        if (deadlineResponse.ok) {
            const deadlineData = await deadlineResponse.json();
            if (deadlineData.success && deadlineData.data) {
                renderDeadlineComplianceReport(deadlineData.data);
            }
        }
        
        // Load school performance report
        const schoolResponse = await fetch('/api/reports/school-performance/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
        });
        
        if (schoolResponse.ok) {
            const schoolData = await schoolResponse.json();
            if (schoolData.success && schoolData.data) {
                renderSchoolPerformanceReport(schoolData.data);
            }
        }
        
        // Load admin activity report
        const adminResponse = await fetch('/api/reports/admin-activity/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
        });
        
        if (adminResponse.ok) {
            const adminData = await adminResponse.json();
            if (adminData.success && adminData.data) {
                renderAdminActivityReport(adminData.data);
            }
        }
    } catch (error) {
        console.error('Error loading additional reports:', error);
    }
}

function renderDeadlineComplianceReport(data) {
    const tbody = document.getElementById('deadline-compliance-tbody');
    if (!tbody || !data.deadlines) return;
    
    if (data.deadlines.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No deadline data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.deadlines.map(deadline => {
        const deadlineDate = new Date(deadline.deadline_date);
        const formattedDate = deadlineDate.toLocaleDateString();
        const daysUntil = deadline.days_until_deadline;
        const statusClass = daysUntil < 0 ? 'text-danger' : (daysUntil <= 7 ? 'text-warning' : '');
        
        return `
            <tr>
                <td>${deadline.area_name}</td>
                <td>${deadline.form_type}</td>
                <td class="${statusClass}">${formattedDate} ${daysUntil < 0 ? '(Overdue)' : daysUntil <= 7 ? `(${daysUntil} days)` : ''}</td>
                <td>${deadline.total_forms.toLocaleString()}</td>
                <td class="text-success">${deadline.on_time.toLocaleString()}</td>
                <td class="text-warning">${deadline.late.toLocaleString()}</td>
                <td class="text-danger">${deadline.overdue.toLocaleString()}</td>
                <td>${deadline.compliance_rate.toFixed(2)}%</td>
            </tr>
        `;
    }).join('');
    
    addTableSorting('deadline-compliance-table');
}

function renderSchoolPerformanceReport(data) {
    const tbody = document.getElementById('school-performance-tbody');
    if (!tbody || !data.schools) return;
    
    if (data.schools.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No school data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.schools.map(school => {
        const lastActivity = school.last_activity ? new Date(school.last_activity).toLocaleDateString() : 'Never';
        const daysSince = school.days_since_activity !== null ? `${school.days_since_activity} days ago` : 'N/A';
        const activityClass = !school.has_activity ? 'text-muted' : (school.days_since_activity > 30 ? 'text-warning' : '');
        
        return `
            <tr>
                <td>${school.school_name}</td>
                <td>${school.school_code}</td>
                <td>${school.region_name}</td>
                <td>${school.division_name}</td>
                <td>${school.district_name}</td>
                <td>${school.total_forms.toLocaleString()}</td>
                <td>${school.completed_forms.toLocaleString()}</td>
                <td>${school.completion_rate.toFixed(2)}%</td>
                <td class="${activityClass}">${lastActivity} ${school.has_activity ? `(${daysSince})` : ''}</td>
            </tr>
        `;
    }).join('');
    
    addTableSorting('school-performance-table');
}

function renderAdminActivityReport(data) {
    const tbody = document.getElementById('admin-activity-tbody');
    if (!tbody || !data.admins) return;
    
    if (data.admins.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No admin data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.admins.map(admin => {
        const lastActivity = admin.last_activity ? new Date(admin.last_activity).toLocaleDateString() : 'Never';
        const lastLogin = admin.last_login ? new Date(admin.last_login).toLocaleDateString() : 'Never';
        const activityClass = admin.activity_count === 0 ? 'text-muted' : '';
        
        return `
            <tr class="${activityClass}">
                <td>${admin.username}</td>
                <td>${admin.full_name}</td>
                <td>${admin.admin_level || 'N/A'}</td>
                <td>${admin.activity_count.toLocaleString()}</td>
                <td>${admin.login_count.toLocaleString()}</td>
                <td>${admin.active_sessions}</td>
                <td>${admin.avg_session_duration_hours.toFixed(2)}</td>
                <td>${lastActivity}</td>
            </tr>
        `;
    }).join('');
    
    addTableSorting('admin-activity-table');
}

// Security and Quality Reports Functions
async function loadSecurityQualityReports() {
    try {
        const filters = collectFilters();
        
        // Load security audit report
        const securityResponse = await fetch('/api/reports/security-audit/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
        });
        
        if (securityResponse.ok) {
            const securityData = await securityResponse.json();
            if (securityData.success && securityData.data) {
                renderSecurityAuditReport(securityData.data);
            }
        }
        
        // Load form quality report
        const qualityResponse = await fetch('/api/reports/form-quality/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
        });
        
        if (qualityResponse.ok) {
            const qualityData = await qualityResponse.json();
            if (qualityData.success && qualityData.data) {
                renderFormQualityReport(qualityData.data);
            }
        }
        
        // Load category/topic analysis report
        const categoryResponse = await fetch('/api/reports/category-topic/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
        });
        
        if (categoryResponse.ok) {
            const categoryData = await categoryResponse.json();
            if (categoryData.success && categoryData.data) {
                renderCategoryTopicReport(categoryData.data);
            }
        }
    } catch (error) {
        console.error('Error loading security and quality reports:', error);
    }
}

function renderSecurityAuditReport(data) {
    const tbody = document.getElementById('security-audit-tbody');
    if (!tbody || !data) return;
    
    const rows = [];
    
    // Login attempts summary
    if (data.login_attempts) {
        rows.push({
            metric: 'Login Success Rate',
            value: `${data.login_attempts.success_rate || 0}%`,
            details: `${data.login_attempts.successful || 0} successful / ${data.login_attempts.total || 0} total`
        });
        rows.push({
            metric: 'Failed Login Attempts',
            value: (data.login_attempts.failed || 0).toLocaleString(),
            details: `${data.login_attempts.suspicious || 0} suspicious, ${data.login_attempts.blocked || 0} blocked`
        });
    }
    
    // Security alerts
    if (data.security_alerts) {
        rows.push({
            metric: 'Security Alerts',
            value: (data.security_alerts.total || 0).toLocaleString(),
            details: `${data.security_alerts.unacknowledged || 0} unacknowledged`
        });
    }
    
    // Security incidents
    if (data.security_incidents) {
        rows.push({
            metric: 'Security Incidents',
            value: (data.security_incidents.total || 0).toLocaleString(),
            details: `${data.security_incidents.open || 0} open`
        });
    }
    
    // Audit logs
    if (data.audit_logs) {
        rows.push({
            metric: 'Audit Log Entries',
            value: (data.audit_logs.total || 0).toLocaleString(),
            details: `${data.audit_logs.failed_actions || 0} failed actions`
        });
    }
    
    // IP analysis
    if (data.ip_analysis) {
        rows.push({
            metric: 'Blocked IP Addresses',
            value: (data.ip_analysis.blocked_ips_count || 0).toLocaleString(),
            details: `${data.ip_analysis.top_ips?.length || 0} top IPs tracked`
        });
    }
    
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No security data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = rows.map(row => `
        <tr>
            <td><strong>${row.metric}</strong></td>
            <td>${row.value}</td>
            <td>${row.details}</td>
        </tr>
    `).join('');
    
    addTableSorting('security-audit-table');
}

function renderFormQualityReport(data) {
    const tbody = document.getElementById('form-quality-tbody');
    if (!tbody || !data.quality_scores) return;
    
    if (data.quality_scores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No quality data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.quality_scores.map(form => {
        const qualityClass = form.quality_score >= 80 ? 'text-success' : (form.quality_score >= 60 ? 'text-warning' : 'text-danger');
        const completenessRate = form.completeness_score ? ((form.completeness_score / 70) * 100).toFixed(2) : '0.00';
        return `
            <tr>
                <td>${form.form_id}</td>
                <td>${form.school_name}</td>
                <td class="${qualityClass}"><strong>${form.quality_score.toFixed(2)}</strong></td>
                <td>${form.completeness_score.toFixed(2)}</td>
                <td>${form.revision_score.toFixed(2)}</td>
                <td>${completenessRate}%</td>
            </tr>
        `;
    }).join('');
    
    addTableSorting('form-quality-table');
}

function renderCategoryTopicReport(data) {
    const tbody = document.getElementById('category-topic-tbody');
    if (!tbody || !data.topic_completion) return;
    
    if (data.topic_completion.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No category/topic data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.topic_completion.map(topic => {
        const completionClass = topic.completion_rate >= 80 ? 'text-success' : (topic.completion_rate >= 50 ? 'text-warning' : 'text-danger');
        return `
            <tr>
                <td>${topic.category_name}</td>
                <td>${topic.topic_name}</td>
                <td>${topic.total_questions}</td>
                <td>${topic.answered_questions}</td>
                <td class="${completionClass}">${topic.completion_rate.toFixed(2)}%</td>
            </tr>
        `;
    }).join('');
    
    addTableSorting('category-topic-table');
}

// Export and Comparison Mode Functions
let comparisonMode = false;

function initializeExportAndComparison() {
    const exportBtn = document.getElementById('export-report-btn');
    const comparisonBtn = document.getElementById('comparison-mode-btn');
    
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            exportAllReports();
        });
    }
    
    if (comparisonBtn) {
        comparisonBtn.addEventListener('click', function() {
            toggleComparisonMode();
        });
    }
}

function toggleComparisonMode() {
    comparisonMode = !comparisonMode;
    const btn = document.getElementById('comparison-mode-btn');
    
    if (comparisonMode) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="ph-bold ph-x"></i> Exit Comparison';
        // Load previous period data for comparison
        loadComparisonData();
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="ph-bold ph-arrows-left-right"></i> Comparison Mode';
        // Remove comparison data
        removeComparisonData();
    }
}

async function loadComparisonData() {
    try {
        const filters = collectFilters();
        
        // Calculate previous period dates
        const today = new Date();
        let dateFrom = filters.date_from ? new Date(filters.date_from) : new Date(today);
        dateFrom.setDate(today.getDate() - 30);
        let dateTo = filters.date_to ? new Date(filters.date_to) : today;
        
        const periodLength = Math.ceil((dateTo - dateFrom) / (1000 * 60 * 60 * 24));
        const prevDateTo = new Date(dateFrom);
        prevDateTo.setDate(prevDateTo.getDate() - 1);
        const prevDateFrom = new Date(prevDateTo);
        prevDateFrom.setDate(prevDateFrom.getDate() - periodLength);
        
        const prevFilters = {
            ...filters,
            date_from: prevDateFrom.toISOString().split('T')[0],
            date_to: prevDateTo.toISOString().split('T')[0]
        };
        
        // Load previous period data
        const prevResponse = await fetch('/api/analytics/bundle/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prevFilters)
        });
        
        if (prevResponse.ok) {
            const prevData = await prevResponse.json();
            if (prevData.cards) {
                displayComparison(prevData.cards);
            }
        }
    } catch (error) {
        console.error('Error loading comparison data:', error);
    }
}

function displayComparison(previousCards) {
    // Add comparison indicators to KPI cards
    const cardMapping = {
        'completion-rate': 'completion_rate',
        'avg-time': 'avg_time',
        'completed-forms': 'completed_forms',
        'pending-forms': 'pending_forms',
        'in-workflow': 'in_workflow',
        'active-schools': 'active_schools',
        'on-time-rate': 'on_time_rate',
        'forms-returned': 'forms_returned'
    };
    
    Object.keys(cardMapping).forEach(cardId => {
        const card = document.getElementById(cardId)?.closest('.card');
        const cardKey = cardMapping[cardId];
        
        if (card && previousCards[cardKey]) {
            const prevValue = previousCards[cardKey].value;
            const currentEl = document.getElementById(cardId);
            if (!currentEl) return;
            
            const currentText = currentEl.textContent || '0';
            const currentValue = parseFloat(currentText.replace(/[^0-9.-]/g, '') || 0);
            const change = currentValue - prevValue;
            const changePercent = prevValue > 0 ? ((change / prevValue) * 100) : 0;
            
            // Add comparison badge
            let badge = card.querySelector('.comparison-badge');
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'comparison-badge';
                badge.style.cssText = 'margin-top: 8px; font-size: 0.75rem; color: var(--admin-text-muted);';
                const trendEl = card.querySelector('.card-trend');
                if (trendEl) {
                    trendEl.parentNode.insertBefore(badge, trendEl.nextSibling);
                } else {
                    card.appendChild(badge);
                }
            }
            badge.innerHTML = `Previous Period: ${prevValue} (${change >= 0 ? '+' : ''}${changePercent.toFixed(1)}%)`;
        }
    });
}

function removeComparisonData() {
    document.querySelectorAll('.comparison-badge').forEach(badge => badge.remove());
}

async function exportAllReports() {
    try {
        // Export as CSV
        const csvData = [];
        
        // Collect data from all tables
        const tables = [
            'workflow-performance-table',
            'geographic-performance-table',
            'deadline-compliance-table',
            'school-performance-table',
            'admin-activity-table',
            'security-audit-table',
            'form-quality-table',
            'category-topic-table'
        ];
        
        tables.forEach(tableId => {
            const table = document.getElementById(tableId);
            if (table) {
                const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
                const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => 
                    Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
                );
                
                if (rows.length > 0 && rows[0].length > 0) {
                    csvData.push({
                        name: tableId.replace('-table', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        headers: headers,
                        rows: rows
                    });
                }
            }
        });
        
        // Convert to CSV format
        let csvContent = '';
        csvData.forEach(section => {
            csvContent += `\n${section.name}\n`;
            csvContent += section.headers.join(',') + '\n';
            section.rows.forEach(row => {
                csvContent += row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',') + '\n';
            });
            csvContent += '\n';
        });
        
        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `edsight_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Error exporting reports:', error);
        alert('Error exporting reports. Please try again.');
    }
}

function renderGeographicReport(data, level = 'region') {
    const tbody = document.getElementById('geographic-performance-tbody');
    const headers = document.getElementById('geographic-table-headers');
    if (!tbody || !data) return;
    
    let reportData = [];
    let headerColumns = [];
    
    if (level === 'region' && data.by_region) {
        reportData = data.by_region;
        headerColumns = ['Region', 'Total Forms', 'Completed', 'Completion Rate (%)', 'Active Schools'];
    } else if (level === 'division' && data.by_division) {
        reportData = data.by_division;
        headerColumns = ['Division', 'Region', 'Total Forms', 'Completed', 'Completion Rate (%)', 'Active Schools'];
    } else if (level === 'district' && data.by_district) {
        reportData = data.by_district;
        headerColumns = ['District', 'Division', 'Region', 'Total Forms', 'Completed', 'Completion Rate (%)', 'Active Schools'];
    }
    
    if (reportData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="' + headerColumns.length + '" class="text-center">No geographic data available</td></tr>';
        return;
    }
    
    // Update headers
    if (headers) {
        headers.innerHTML = headerColumns.map((col, idx) => {
            const sortKey = col.toLowerCase().replace(/\s+/g, '_').replace('(%)', '').replace('(%)', '').trim();
            return `<th data-sort="${sortKey}">${col}</th>`;
        }).join('');
    }
    
    // Render rows
    tbody.innerHTML = reportData.map(item => {
        if (level === 'region') {
            return `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.total_forms.toLocaleString()}</td>
                    <td>${item.completed_forms.toLocaleString()}</td>
                    <td>${item.completion_rate.toFixed(2)}%</td>
                    <td>${item.active_schools.toLocaleString()}</td>
                </tr>
            `;
        } else if (level === 'division') {
            return `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.region_name}</td>
                    <td>${item.total_forms.toLocaleString()}</td>
                    <td>${item.completed_forms.toLocaleString()}</td>
                    <td>${item.completion_rate.toFixed(2)}%</td>
                    <td>${item.active_schools.toLocaleString()}</td>
                </tr>
            `;
        } else if (level === 'district') {
            return `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.division_name}</td>
                    <td>${item.region_name}</td>
                    <td>${item.total_forms.toLocaleString()}</td>
                    <td>${item.completed_forms.toLocaleString()}</td>
                    <td>${item.completion_rate.toFixed(2)}%</td>
                    <td>${item.active_schools.toLocaleString()}</td>
                </tr>
            `;
        }
    }).join('');
    
    // Add sorting functionality
    addTableSorting('geographic-performance-table');
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
            
            // Determine sort direction
            const isAscending = !this.classList.contains('sort-asc');
            this.classList.toggle('sort-asc', isAscending);
            this.classList.toggle('sort-desc', !isAscending);
            
            // Remove sort classes from other headers
            headers.forEach(h => {
                if (h !== this) {
                    h.classList.remove('sort-asc', 'sort-desc');
                }
            });
            
            // Sort rows
            rows.sort((a, b) => {
                const aText = a.cells[Array.from(headers).indexOf(this)]?.textContent.trim() || '';
                const bText = b.cells[Array.from(headers).indexOf(this)]?.textContent.trim() || '';
                
                // Try to parse as number
                const aNum = parseFloat(aText.replace(/[^0-9.-]/g, ''));
                const bNum = parseFloat(bText.replace(/[^0-9.-]/g, ''));
                
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return isAscending ? aNum - bNum : bNum - aNum;
                }
                
                // String comparison
                return isAscending ? aText.localeCompare(bText) : bText.localeCompare(aText);
            });
            
            // Re-append sorted rows
            rows.forEach(row => tbody.appendChild(row));
        });
    });
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
    filterOptions: {},
    currentDateRange: '30days', // Default to last 30 days
    customDateRange: null // Custom date range when selected
};

// Initialize report tables
function initializeReportTables() {
    // Table functionality removed
}

// Table-related functions removed

// Export events removed

function collectFilters() {
    // Return current filters with date range
    const filters = reportData.currentFilters?.completion || {};
    const dateRange = getDateRangeForFilter(reportData.currentDateRange);
    return {
        ...filters,
        ...dateRange
    };
}

function getDateRangeForFilter(rangeType) {
    // Check if custom date range is set
    if (rangeType === 'custom' && reportData.customDateRange) {
        return {
            date_from: reportData.customDateRange.from,
            date_to: reportData.customDateRange.to
        };
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate = null;
    let endDate = today.toISOString().split('T')[0];
    
    switch(rangeType) {
        case '7days':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 7);
            break;
        case '30days':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 30);
            break;
        case '90days':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 90);
            break;
        case '6months':
            startDate = new Date(today);
            startDate.setMonth(today.getMonth() - 6);
            break;
        case 'year':
            startDate = new Date(today);
            startDate.setFullYear(today.getFullYear() - 1);
            break;
        case 'all':
            startDate = null;
            break;
        default:
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 30);
    }
    
    const result = {};
    if (startDate) {
        result.date_from = startDate.toISOString().split('T')[0];
    }
    if (endDate) {
        result.date_to = endDate;
    }
    return result;
}

function initializeDateRangeSelector() {
    const selector = document.getElementById('date-range-selector');
    const dropdown = document.getElementById('date-range-dropdown');
    const textSpan = document.getElementById('date-range-text');
    const customModal = document.getElementById('custom-date-modal');
    const customOption = document.getElementById('custom-date-range-option');
    const closeModal = document.getElementById('close-custom-date-modal');
    const cancelBtn = document.getElementById('cancel-custom-date');
    const applyBtn = document.getElementById('apply-custom-date');
    const dateFromInput = document.getElementById('custom-date-from');
    const dateToInput = document.getElementById('custom-date-to');
    
    if (!selector || !dropdown || !textSpan) return;
    
    // Toggle dropdown on click
    selector.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });
    
    // Handle option selection
    const options = dropdown.querySelectorAll('.date-range-option');
    options.forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            const range = this.getAttribute('data-range');
            
            if (range === 'custom') {
                // Open custom date modal
                dropdown.classList.remove('show');
                if (customModal) {
                    // Set default dates (last 30 days)
                    const today = new Date();
                    const thirtyDaysAgo = new Date(today);
                    thirtyDaysAgo.setDate(today.getDate() - 30);
                    
                    if (dateFromInput) {
                        dateFromInput.value = thirtyDaysAgo.toISOString().split('T')[0];
                    }
                    if (dateToInput) {
                        dateToInput.value = today.toISOString().split('T')[0];
                    }
                    
                    customModal.classList.add('show');
                }
            } else {
                const text = this.textContent.trim();
                reportData.currentDateRange = range;
                reportData.customDateRange = null; // Clear custom range
                textSpan.textContent = text;
                dropdown.classList.remove('show');
                
                // Reload data with new date range
                loadReportData().then(initializeFilters).catch(console.error);
            }
        });
    });
    
    // Close modal handlers
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            if (customModal) customModal.classList.remove('show');
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            if (customModal) customModal.classList.remove('show');
        });
    }
    
    // Apply custom date range
    if (applyBtn) {
        applyBtn.addEventListener('click', function() {
            const fromDate = dateFromInput?.value;
            const toDate = dateToInput?.value;
            
            if (!fromDate || !toDate) {
                alert('Please select both start and end dates');
                return;
            }
            
            if (new Date(fromDate) > new Date(toDate)) {
                alert('Start date must be before end date');
                return;
            }
            
            // Format dates for display
            const fromFormatted = formatDateForDisplay(fromDate);
            const toFormatted = formatDateForDisplay(toDate);
            
            reportData.currentDateRange = 'custom';
            reportData.customDateRange = {
                from: fromDate,
                to: toDate
            };
            textSpan.textContent = `${fromFormatted} - ${toFormatted}`;
            
            if (customModal) customModal.classList.remove('show');
            
            // Reload data with custom date range
            loadReportData().then(initializeFilters).catch(console.error);
        });
    }
    
    // Close modal when clicking outside
    if (customModal) {
        customModal.addEventListener('click', function(e) {
            if (e.target === customModal) {
                customModal.classList.remove('show');
            }
        });
    }
}

function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function closeDateRangeDropdown() {
    const dropdown = document.getElementById('date-range-dropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

// Initialize currentFilters if it doesn't exist
if (!reportData.currentFilters) {
    reportData.currentFilters = {
        completion: {},
        category: {}
    };
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
        const filters = collectFilters();
        const analyticsResponse = await fetch('/api/analytics/bundle/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
        });
        
        if (!analyticsResponse.ok) {
            throw new Error(`Analytics API error: ${analyticsResponse.status}`);
        }
        
        const analyticsData = await analyticsResponse.json();
        
        // Populate KPI cards with real data
        if (analyticsData.cards) {
            updateKPICards(analyticsData.cards);
        }
        
        // Load chart data
        await loadChartData();
        
        // Load detailed reports
        await loadDetailedReports();
        
        // Load additional reports (deadlines, schools, admin activity)
        await loadAdditionalReports();
        
        // Load security and quality reports
        await loadSecurityQualityReports();
        
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
        
        return reportData;
        
    } catch (error) {
        console.error('Error loading report data:', error);
        return reportData;
    }
}

function updateKPICards(cards) {
    // Update Completion Rate card
    const completionRateEl = document.getElementById('completion-rate');
    const completionRateTrendEl = document.getElementById('completion-rate-trend');
    if (completionRateEl && cards.completion_rate) {
        const rate = cards.completion_rate.value || 0;
        completionRateEl.textContent = `${rate}%`;
        
        if (completionRateTrendEl && cards.completion_rate.change !== undefined) {
            const change = cards.completion_rate.change;
            const isPositive = cards.completion_rate.is_positive;
            const arrowClass = isPositive ? 'ph-arrow-up' : 'ph-arrow-down';
            const sign = change >= 0 ? '+' : '';
            completionRateTrendEl.innerHTML = `<i class="ph-bold ${arrowClass}"></i> ${sign}${change}% from last month`;
            completionRateTrendEl.className = `card-trend ${isPositive ? 'positive' : 'negative'}`;
        }
    }
    
    // Update Avg. Time card
    const avgTimeEl = document.getElementById('avg-time');
    const avgTimeTrendEl = document.getElementById('avg-time-trend');
    if (avgTimeEl && cards.avg_time) {
        const time = cards.avg_time.value || 0;
        avgTimeEl.textContent = `${time}h`;
        
        if (avgTimeTrendEl && cards.avg_time.change !== undefined) {
            const change = cards.avg_time.change;
            const isPositive = cards.avg_time.is_positive;
            const arrowClass = isPositive ? 'ph-arrow-down' : 'ph-arrow-up';
            const sign = change >= 0 ? '+' : '';
            avgTimeTrendEl.innerHTML = `<i class="ph-bold ${arrowClass}"></i> ${sign}${change}h from last month`;
            avgTimeTrendEl.className = `card-trend ${isPositive ? 'positive' : 'negative'}`;
        }
    }
    
    // Update In Workflow card
    const inWorkflowEl = document.getElementById('in-workflow');
    const inWorkflowTrendEl = document.getElementById('in-workflow-trend');
    if (inWorkflowEl && cards.in_workflow) {
        const count = cards.in_workflow.value || 0;
        inWorkflowEl.textContent = count.toLocaleString();
        
        if (inWorkflowTrendEl && cards.in_workflow.change !== undefined) {
            const change = cards.in_workflow.change;
            const isPositive = cards.in_workflow.is_positive;
            const arrowClass = isPositive ? 'ph-arrow-up' : 'ph-arrow-down';
            const sign = change >= 0 ? '+' : '';
            inWorkflowTrendEl.innerHTML = `<i class="ph-bold ${arrowClass}"></i> ${sign}${change} from last month`;
            inWorkflowTrendEl.className = `card-trend ${isPositive ? 'positive' : 'negative'}`;
        }
    }
    
    // Update Active Schools card
    const activeSchoolsEl = document.getElementById('active-schools');
    const activeSchoolsTrendEl = document.getElementById('active-schools-trend');
    if (activeSchoolsEl && cards.active_schools) {
        const count = cards.active_schools.value || 0;
        activeSchoolsEl.textContent = count.toLocaleString();
        
        if (activeSchoolsTrendEl && cards.active_schools.change !== undefined) {
            const change = cards.active_schools.change;
            const isPositive = cards.active_schools.is_positive;
            const arrowClass = isPositive ? 'ph-arrow-up' : 'ph-arrow-down';
            const sign = change >= 0 ? '+' : '';
            activeSchoolsTrendEl.innerHTML = `<i class="ph-bold ${arrowClass}"></i> ${sign}${change} from last month`;
            activeSchoolsTrendEl.className = `card-trend ${isPositive ? 'positive' : 'negative'}`;
        }
    }
    
    // Update On-Time Rate card
    const onTimeRateEl = document.getElementById('on-time-rate');
    const onTimeRateTrendEl = document.getElementById('on-time-rate-trend');
    if (onTimeRateEl && cards.on_time_rate) {
        const rate = cards.on_time_rate.value || 0;
        onTimeRateEl.textContent = `${rate}%`;
        
        if (onTimeRateTrendEl && cards.on_time_rate.change !== undefined) {
            const change = cards.on_time_rate.change;
            const isPositive = cards.on_time_rate.is_positive;
            const arrowClass = isPositive ? 'ph-arrow-up' : 'ph-arrow-down';
            const sign = change >= 0 ? '+' : '';
            onTimeRateTrendEl.innerHTML = `<i class="ph-bold ${arrowClass}"></i> ${sign}${change}% from last month`;
            onTimeRateTrendEl.className = `card-trend ${isPositive ? 'positive' : 'negative'}`;
        }
    }
    
    // Update Forms Returned card
    const formsReturnedEl = document.getElementById('forms-returned');
    const formsReturnedTrendEl = document.getElementById('forms-returned-trend');
    if (formsReturnedEl && cards.forms_returned) {
        const count = cards.forms_returned.value || 0;
        formsReturnedEl.textContent = count.toLocaleString();
        
        if (formsReturnedTrendEl && cards.forms_returned.change !== undefined) {
            const change = cards.forms_returned.change;
            const isPositive = cards.forms_returned.is_positive;
            const arrowClass = isPositive ? 'ph-arrow-down' : 'ph-arrow-up'; // Lower is better for returned forms
            const sign = change >= 0 ? '+' : '';
            formsReturnedTrendEl.innerHTML = `<i class="ph-bold ${arrowClass}"></i> ${sign}${change} from last month`;
            formsReturnedTrendEl.className = `card-trend ${isPositive ? 'positive' : 'negative'}`;
        }
    }
    
    // Update Completed Forms card
    const completedFormsEl = document.getElementById('completed-forms');
    const completedFormsTrendEl = document.getElementById('completed-forms-trend');
    if (completedFormsEl && cards.completed_forms) {
        const count = cards.completed_forms.value || 0;
        completedFormsEl.textContent = count.toLocaleString();
        
        if (completedFormsTrendEl && cards.completed_forms.change !== undefined) {
            const change = cards.completed_forms.change;
            const isPositive = cards.completed_forms.is_positive;
            const arrowClass = isPositive ? 'ph-arrow-up' : 'ph-arrow-down';
            const sign = change >= 0 ? '+' : '';
            completedFormsTrendEl.innerHTML = `<i class="ph-bold ${arrowClass}"></i> ${sign}${change} from last month`;
            completedFormsTrendEl.className = `card-trend ${isPositive ? 'positive' : 'negative'}`;
        }
    }
    
    // Update Pending Forms card
    const pendingFormsEl = document.getElementById('pending-forms');
    const pendingFormsTrendEl = document.getElementById('pending-forms-trend');
    if (pendingFormsEl && cards.pending_forms) {
        const count = cards.pending_forms.value || 0;
        pendingFormsEl.textContent = count.toLocaleString();
        
        if (pendingFormsTrendEl && cards.pending_forms.change !== undefined) {
            const change = cards.pending_forms.change;
            const isPositive = cards.pending_forms.is_positive;
            const arrowClass = isPositive ? 'ph-arrow-down' : 'ph-arrow-up';
            const sign = change >= 0 ? '+' : '';
            pendingFormsTrendEl.innerHTML = `<i class="ph-bold ${arrowClass}"></i> ${sign}${change} from last month`;
            pendingFormsTrendEl.className = `card-trend ${isPositive ? 'positive' : 'negative'}`;
        }
    }
}

function initializeFilters(data) {
    populateFilterDropdowns(data.filterOptions);
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
    
}

// Pagination and table rendering functions removed



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

// Table filter and export functions removed

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
