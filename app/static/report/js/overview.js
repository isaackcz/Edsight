// Overview Page JavaScript
let comparisonMode = 'none';
let comparisonDateRange = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeDateRangeSelector();
    initializeComparisonSelector();
    initCharts();
    loadOverviewData();
    
    // Export button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            handleExport();
        });
    }
});

// Chart instances
let formsOverTimeChart = null;
let statusDistributionChart = null;
let workflowDistributionChart = null;
let geographicChart = null;

function initCharts() {
    Chart.defaults.font.family = "'Segoe UI', 'Public Sans', sans-serif";
    Chart.defaults.scale.grid.color = 'rgba(225,225,225,0.6)';
    Chart.defaults.scale.grid.borderColor = 'transparent';
    
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
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true }
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
                legend: { position: 'right' }
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
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
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
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true }
            }
        }
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
    
    // Set default to 30 days
    ReportFilters.setDateRange('30days');
    updateDateRangeText('30days');
    
    selector.addEventListener('click', function(e) {
        e.stopPropagation();
        // Close comparison dropdown if open
        const comparisonDropdown = document.getElementById('comparison-dropdown');
        if (comparisonDropdown) comparisonDropdown.classList.remove('show');
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
                loadOverviewData();
            }
        });
    });
    
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
                ReportFilters.setCustomDateRange(from, to);
                textSpan.textContent = `${from} to ${to}`;
                customModal.style.display = 'none';
                loadOverviewData();
            }
        });
    }
}

function initializeComparisonSelector() {
    const selector = document.getElementById('comparison-selector');
    const dropdown = document.getElementById('comparison-dropdown');
    const textSpan = document.getElementById('comparison-text');
    const customModal = document.getElementById('custom-comparison-modal');
    const closeModal = document.getElementById('close-custom-comparison-modal');
    const cancelBtn = document.getElementById('cancel-custom-comparison');
    const applyBtn = document.getElementById('apply-custom-comparison');
    const dateFromInput = document.getElementById('custom-comparison-from');
    const dateToInput = document.getElementById('custom-comparison-to');
    
    if (!selector || !dropdown || !textSpan) return;
    
    selector.addEventListener('click', function(e) {
        e.stopPropagation();
        // Close date range dropdown if open
        const dateRangeDropdown = document.getElementById('date-range-dropdown');
        if (dateRangeDropdown) dateRangeDropdown.classList.remove('show');
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
            const comparison = this.getAttribute('data-comparison');
            
            if (comparison === 'custom') {
                customModal.style.display = 'flex';
                dropdown.classList.remove('show');
            } else {
                comparisonMode = comparison;
                updateComparisonText(comparison);
                dropdown.classList.remove('show');
                if (comparison === 'none') {
                    comparisonDateRange = null;
                    removeComparisonData();
                } else {
                    loadComparisonData(comparison);
                }
            }
        });
    });
    
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
                comparisonMode = 'custom';
                comparisonDateRange = { from, to };
                textSpan.textContent = `${from} to ${to}`;
                customModal.style.display = 'none';
                loadComparisonData('custom', { from, to });
            }
        });
    }
}

function updateComparisonText(comparison) {
    const textSpan = document.getElementById('comparison-text');
    if (!textSpan) return;
    
    const comparisonTexts = {
        'none': 'None',
        'weekly': 'Weekly',
        'monthly': 'Monthly',
        'custom': 'Custom'
    };
    
    textSpan.textContent = comparisonTexts[comparison] || 'None';
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

async function loadOverviewData() {
    try {
        const filters = ReportFilters.collect();
        
        // Load KPI cards
        const analyticsResponse = await fetch('/api/analytics/bundle/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
        });
        
        if (analyticsResponse.ok) {
            const analyticsData = await analyticsResponse.json();
            if (analyticsData.cards) {
                updateKPICards(analyticsData.cards);
            }
        }
        
        // Load chart data
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
        console.error('Error loading overview data:', error);
    }
}

function updateKPICards(cards) {
    // Completion Rate
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
    
    // Avg Time
    const avgTimeEl = document.getElementById('avg-time');
    const avgTimeTrendEl = document.getElementById('avg-time-trend');
    if (avgTimeEl && cards.avg_time) {
        const time = cards.avg_time.value || 0;
        avgTimeEl.textContent = `${time.toFixed(1)}h`;
        if (avgTimeTrendEl && cards.avg_time.change !== undefined) {
            const change = cards.avg_time.change;
            const isPositive = cards.avg_time.is_positive;
            const arrowClass = isPositive ? 'ph-arrow-up' : 'ph-arrow-down';
            const sign = change >= 0 ? '+' : '';
            avgTimeTrendEl.innerHTML = `<i class="ph-bold ${arrowClass}"></i> ${sign}${change.toFixed(1)}h from last month`;
            avgTimeTrendEl.className = `card-trend ${isPositive ? 'positive' : 'negative'}`;
        }
    }
    
    // Completed Forms
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
    
    // Pending Forms
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
    
    // In Workflow
    const inWorkflowEl = document.getElementById('in-workflow');
    const inWorkflowTrendEl = document.getElementById('in-workflow-trend');
    if (inWorkflowEl && cards.in_workflow) {
        const value = cards.in_workflow.value || 0;
        inWorkflowEl.textContent = value.toLocaleString();
        updateTrend(inWorkflowTrendEl, cards.in_workflow.change, cards.in_workflow.is_positive);
    }
    
    // Active Schools
    const activeSchoolsEl = document.getElementById('active-schools');
    const activeSchoolsTrendEl = document.getElementById('active-schools-trend');
    if (activeSchoolsEl && cards.active_schools) {
        const value = cards.active_schools.value || 0;
        activeSchoolsEl.textContent = value.toLocaleString();
        updateTrend(activeSchoolsTrendEl, cards.active_schools.change, cards.active_schools.is_positive);
    }
    
    // On-Time Rate
    const onTimeRateEl = document.getElementById('on-time-rate');
    const onTimeRateTrendEl = document.getElementById('on-time-rate-trend');
    if (onTimeRateEl && cards.on_time_rate) {
        const value = cards.on_time_rate.value || 0;
        onTimeRateEl.textContent = `${value}%`;
        updateTrend(onTimeRateTrendEl, cards.on_time_rate.change, cards.on_time_rate.is_positive, '%');
    }
    
    // Forms Returned
    const formsReturnedEl = document.getElementById('forms-returned');
    const formsReturnedTrendEl = document.getElementById('forms-returned-trend');
    if (formsReturnedEl && cards.forms_returned) {
        const value = cards.forms_returned.value || 0;
        formsReturnedEl.textContent = value.toLocaleString();
        updateTrend(formsReturnedTrendEl, cards.forms_returned.change, cards.forms_returned.is_positive, '', false);
    }
}

function updateTrend(element, change, isPositive, suffix = '', higherIsBetter = true) {
    if (!element || change === undefined) return;
    
    const arrowClass = (higherIsBetter && isPositive) || (!higherIsBetter && !isPositive) ? 'ph-arrow-up' : 'ph-arrow-down';
    const sign = change >= 0 ? '+' : '';
    element.innerHTML = `<i class="ph-bold ${arrowClass}"></i> ${sign}${change}${suffix} from last month`;
    element.className = `card-trend ${isPositive ? 'positive' : 'negative'}`;
}

function updateFormsOverTimeChart(data) {
    if (!formsOverTimeChart || !data) return;
    
    const started = data.started || [];
    const completed = data.completed || [];
    
    const allLabels = new Set();
    started.forEach(item => allLabels.add(item.label));
    completed.forEach(item => allLabels.add(item.label));
    const labels = Array.from(allLabels).sort();
    
    const startedData = new Array(labels.length).fill(0);
    const completedData = new Array(labels.length).fill(0);
    
    started.forEach(item => {
        const index = labels.indexOf(item.label);
        if (index !== -1) startedData[index] = item.count;
    });
    
    completed.forEach(item => {
        const index = labels.indexOf(item.label);
        if (index !== -1) completedData[index] = item.count;
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
    
    const topData = data.slice(0, 10);
    const labels = topData.map(item => item.name || 'Unknown');
    const values = topData.map(item => item.count || 0);
    
    geographicChart.data.labels = labels;
    geographicChart.data.datasets[0].data = values;
    geographicChart.update();
}

async function loadComparisonData(comparisonType, customRange = null) {
    try {
        const filters = ReportFilters.collect();
        let comparisonFilters = {};
        
        if (comparisonType === 'weekly') {
            const today = new Date();
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            comparisonFilters = {
                date_from: weekAgo.toISOString().split('T')[0],
                date_to: today.toISOString().split('T')[0]
            };
        } else if (comparisonType === 'monthly') {
            const today = new Date();
            const monthAgo = new Date(today);
            monthAgo.setMonth(today.getMonth() - 1);
            comparisonFilters = {
                date_from: monthAgo.toISOString().split('T')[0],
                date_to: today.toISOString().split('T')[0]
            };
        } else if (comparisonType === 'custom' && customRange) {
            comparisonFilters = {
                date_from: customRange.from,
                date_to: customRange.to
            };
        }
        
        if (Object.keys(comparisonFilters).length > 0) {
            const response = await fetch('/api/analytics/bundle/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(comparisonFilters)
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.cards) {
                    displayComparison(data.cards);
                }
            }
        }
    } catch (error) {
        console.error('Error loading comparison data:', error);
    }
}

function displayComparison(previousCards) {
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
            const prevValue = previousCards[cardKey].value || 0;
            const currentEl = document.getElementById(cardId);
            if (!currentEl) return;
            
            const currentText = currentEl.textContent || '0';
            const currentValue = parseFloat(currentText.replace(/[^0-9.-]/g, '') || 0);
            const change = currentValue - prevValue;
            const changePercent = prevValue > 0 ? ((change / prevValue) * 100) : 0;
            
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
            badge.innerHTML = `Previous: ${prevValue} (${change >= 0 ? '+' : ''}${changePercent.toFixed(1)}%)`;
        }
    });
}

function removeComparisonData() {
    document.querySelectorAll('.comparison-badge').forEach(badge => badge.remove());
}

function handleExport() {
    if (typeof ReportExport === 'undefined') {
        alert('Export functionality not available');
        return;
    }
    
    // Check if filters are on default
    const dateRangeText = document.getElementById('date-range-text')?.textContent || '';
    const comparisonText = document.getElementById('comparison-text')?.textContent || '';
    
    const isDefaultDateRange = dateRangeText === 'Last 30 Days';
    const isDefaultComparison = comparisonText === 'None' || comparisonText === '';
    
    // If filters are default, export directly
    if (isDefaultDateRange && isDefaultComparison) {
        exportKPIData();
        return;
    }
    
    // Show export modal
    showExportModal();
}

function showExportModal() {
    const modal = document.getElementById('export-modal');
    const filtersInfo = document.getElementById('export-filters-info');
    
    if (!modal || !filtersInfo) return;
    
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
    
    // Comparison info
    const comparisonText = document.getElementById('comparison-text')?.textContent || '';
    if (comparisonText && comparisonText !== 'None') {
        if (comparisonDateRange && comparisonDateRange.from && comparisonDateRange.to) {
            filterInfoHTML += `<div><strong>Comparison:</strong> ${comparisonDateRange.from} to ${comparisonDateRange.to}</div>`;
        } else {
            filterInfoHTML += `<div><strong>Comparison:</strong> ${comparisonText}</div>`;
        }
    } else {
        filterInfoHTML += `<div><strong>Comparison:</strong> None</div>`;
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
            exportKPIData();
            hideModal();
            return;
        }
        
        // Backdrop click
        if (target === modal) {
            hideModal();
        }
    };
}

function exportKPIData() {
    // Check what to export
    const exportKPICards = document.getElementById('export-kpi-cards')?.checked !== false;
    const exportCharts = document.getElementById('export-charts')?.checked !== false;
    
    if (!exportKPICards && !exportCharts) {
        alert('Please select at least one data type to export');
        return;
    }
    
    let csvContent = '';
    let filename = 'overview_export_' + new Date().toISOString().split('T')[0] + '.csv';
    
    // Export KPI Cards
    if (exportKPICards) {
        const kpiData = [];
        
        // Completion Rate
        const completionRate = document.getElementById('completion-rate')?.textContent || '0%';
        const completionRateTrend = document.getElementById('completion-rate-trend')?.textContent || '';
        kpiData.push({
            'Metric': 'Completion Rate',
            'Value': completionRate,
            'Trend': completionRateTrend
        });
        
        // Avg. Time
        const avgTime = document.getElementById('avg-time')?.textContent || '0h';
        const avgTimeTrend = document.getElementById('avg-time-trend')?.textContent || '';
        kpiData.push({
            'Metric': 'Avg. Time',
            'Value': avgTime,
            'Trend': avgTimeTrend
        });
        
        // Completed Forms
        const completedForms = document.getElementById('completed-forms')?.textContent || '0';
        const completedFormsTrend = document.getElementById('completed-forms-trend')?.textContent || '';
        kpiData.push({
            'Metric': 'Completed Forms',
            'Value': completedForms,
            'Trend': completedFormsTrend
        });
        
        // Pending Forms
        const pendingForms = document.getElementById('pending-forms')?.textContent || '0';
        const pendingFormsTrend = document.getElementById('pending-forms-trend')?.textContent || '';
        kpiData.push({
            'Metric': 'Pending Forms',
            'Value': pendingForms,
            'Trend': pendingFormsTrend
        });
        
        // In Workflow
        const inWorkflow = document.getElementById('in-workflow')?.textContent || '0';
        const inWorkflowTrend = document.getElementById('in-workflow-trend')?.textContent || '';
        kpiData.push({
            'Metric': 'In Workflow',
            'Value': inWorkflow,
            'Trend': inWorkflowTrend
        });
        
        // Active Schools
        const activeSchools = document.getElementById('active-schools')?.textContent || '0';
        const activeSchoolsTrend = document.getElementById('active-schools-trend')?.textContent || '';
        kpiData.push({
            'Metric': 'Active Schools',
            'Value': activeSchools,
            'Trend': activeSchoolsTrend
        });
        
        // On-Time Rate
        const onTimeRate = document.getElementById('on-time-rate')?.textContent || '0%';
        const onTimeRateTrend = document.getElementById('on-time-rate-trend')?.textContent || '';
        kpiData.push({
            'Metric': 'On-Time Rate',
            'Value': onTimeRate,
            'Trend': onTimeRateTrend
        });
        
        // Forms Returned
        const formsReturned = document.getElementById('forms-returned')?.textContent || '0';
        const formsReturnedTrend = document.getElementById('forms-returned-trend')?.textContent || '';
        kpiData.push({
            'Metric': 'Forms Returned',
            'Value': formsReturned,
            'Trend': formsReturnedTrend
        });
        
        csvContent += 'KPI Cards\n';
        csvContent += 'Metric,Value,Trend\n';
        kpiData.forEach(row => {
            csvContent += `"${row.Metric.replace(/"/g, '""')}","${row.Value.replace(/"/g, '""')}","${row.Trend.replace(/"/g, '""')}"\n`;
        });
        csvContent += '\n';
    }
    
    // Export Charts Data
    if (exportCharts) {
        csvContent += 'Charts Data\n';
        csvContent += 'Chart Type,Data\n';
        
        // Forms Over Time
        if (formsOverTimeChart && formsOverTimeChart.data) {
            const labels = formsOverTimeChart.data.labels || [];
            const startedData = formsOverTimeChart.data.datasets[0]?.data || [];
            const completedData = formsOverTimeChart.data.datasets[1]?.data || [];
            
            csvContent += 'Forms Over Time\n';
            csvContent += 'Date,Forms Started,Forms Completed\n';
            labels.forEach((label, index) => {
                csvContent += `"${label}","${startedData[index] || 0}","${completedData[index] || 0}"\n`;
            });
            csvContent += '\n';
        }
        
        // Status Distribution
        if (statusDistributionChart && statusDistributionChart.data) {
            const labels = statusDistributionChart.data.labels || [];
            const data = statusDistributionChart.data.datasets[0]?.data || [];
            
            csvContent += 'Status Distribution\n';
            csvContent += 'Status,Count\n';
            labels.forEach((label, index) => {
                csvContent += `"${label}","${data[index] || 0}"\n`;
            });
            csvContent += '\n';
        }
        
        // Workflow Distribution
        if (workflowDistributionChart && workflowDistributionChart.data) {
            const labels = workflowDistributionChart.data.labels || [];
            const data = workflowDistributionChart.data.datasets[0]?.data || [];
            
            csvContent += 'Workflow Distribution\n';
            csvContent += 'Workflow Status,Count\n';
            labels.forEach((label, index) => {
                csvContent += `"${label}","${data[index] || 0}"\n`;
            });
            csvContent += '\n';
        }
        
        // Geographic Distribution
        if (geographicChart && geographicChart.data) {
            const labels = geographicChart.data.labels || [];
            const data = geographicChart.data.datasets[0]?.data || [];
            
            csvContent += 'Geographic Distribution\n';
            csvContent += 'Region,Count\n';
            labels.forEach((label, index) => {
                csvContent += `"${label}","${data[index] || 0}"\n`;
            });
            csvContent += '\n';
        }
    }
    
    // Download CSV
    if (csvContent) {
        ReportExport.downloadCSV(csvContent, filename);
    }
}

