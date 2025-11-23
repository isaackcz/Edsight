/**
 * Charts module
 * Handles rendering all charts using Chart.js
 */

(function() {
    'use strict';
    
    let charts = {};
    
    /**
     * Initialize all charts
     */
    function initCharts() {
        loadRoleDistributionChart();
        loadStatusDistributionChart();
        loadPermissionUsageChart();
        loadPermissionFlagsChart();
        loadAccessScopeChart();
        loadGeographicDistributionChart();
        loadActivityTimelineChart();
    }
    
    /**
     * Load role distribution chart (Pie/Donut)
     */
    function loadRoleDistributionChart() {
        fetch('/api/admin/role-analytics/charts/role-distribution/', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data) {
                renderRoleDistributionChart(data.data);
            }
        })
        .catch(error => {
            console.error('Error loading role distribution:', error);
        });
    }
    
    /**
     * Render role distribution chart
     */
    function renderRoleDistributionChart(chartData) {
        const ctx = document.getElementById('roleDistributionChart');
        if (!ctx) return;
        
        if (charts.roleDistribution) {
            charts.roleDistribution.destroy();
        }
        
        charts.roleDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.data,
                    backgroundColor: chartData.colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Load status distribution chart
     */
    function loadStatusDistributionChart() {
        fetch('/api/admin/role-analytics/charts/status/', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data) {
                renderStatusDistributionChart(data.data);
            }
        })
        .catch(error => {
            console.error('Error loading status distribution:', error);
        });
    }
    
    /**
     * Render status distribution chart
     */
    function renderStatusDistributionChart(chartData) {
        const ctx = document.getElementById('statusDistributionChart');
        if (!ctx) return;
        
        if (charts.statusDistribution) {
            charts.statusDistribution.destroy();
        }
        
        charts.statusDistribution = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.data,
                    backgroundColor: chartData.colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Load permission usage chart (Stacked Bar)
     */
    function loadPermissionUsageChart() {
        fetch('/api/admin/role-analytics/charts/permissions/', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data) {
                renderPermissionUsageChart(data.data);
            }
        })
        .catch(error => {
            console.error('Error loading permission usage:', error);
        });
    }
    
    /**
     * Render permission usage chart
     */
    function renderPermissionUsageChart(chartData) {
        const ctx = document.getElementById('permissionUsageChart');
        if (!ctx) return;
        
        if (charts.permissionUsage) {
            charts.permissionUsage.destroy();
        }
        
        charts.permissionUsage = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: chartData.datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        ticks: {
                            font: {
                                size: 12
                            }
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: {
                                size: 12
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Load permission flags breakdown chart (Horizontal Bar)
     */
    function loadPermissionFlagsChart() {
        fetch('/api/admin/role-analytics/charts/permission-flags/', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data) {
                renderPermissionFlagsChart(data.data);
            }
        })
        .catch(error => {
            console.error('Error loading permission flags:', error);
        });
    }
    
    /**
     * Render permission flags chart
     */
    function renderPermissionFlagsChart(chartData) {
        const ctx = document.getElementById('permissionFlagsChart');
        if (!ctx) return;
        
        if (charts.permissionFlags) {
            charts.permissionFlags.destroy();
        }
        
        charts.permissionFlags = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Permission Count',
                    data: chartData.data,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: {
                                size: 12
                            }
                        }
                    },
                    y: {
                        ticks: {
                            font: {
                                size: 12
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    /**
     * Load access scope analysis chart
     */
    function loadAccessScopeChart() {
        fetch('/api/admin/role-analytics/charts/access-scope/', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data) {
                renderAccessScopeChart(data.data);
            }
        })
        .catch(error => {
            console.error('Error loading access scope:', error);
        });
    }
    
    /**
     * Render access scope chart
     */
    function renderAccessScopeChart(chartData) {
        const ctx = document.getElementById('accessScopeChart');
        if (!ctx) return;
        
        if (charts.accessScope) {
            charts.accessScope.destroy();
        }
        
        charts.accessScope = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.data,
                    backgroundColor: [
                        '#FF6384',
                        '#36A2EB',
                        '#FFCE56',
                        '#4BC0C0',
                        '#9966FF'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Load geographic distribution chart
     */
    function loadGeographicDistributionChart() {
        fetch('/api/admin/role-analytics/charts/geographic/', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data) {
                renderGeographicDistributionChart(data.data);
            }
        })
        .catch(error => {
            console.error('Error loading geographic distribution:', error);
        });
    }
    
    /**
     * Render geographic distribution chart
     */
    function renderGeographicDistributionChart(chartData) {
        const ctx = document.getElementById('geographicDistributionChart');
        if (!ctx) return;
        
        if (charts.geographicDistribution) {
            charts.geographicDistribution.destroy();
        }
        
        // Use regions data
        const regions = chartData.regions || [];
        const labels = regions.map(r => r.name).slice(0, 10);
        const data = regions.map(r => r.count).slice(0, 10);
        
        charts.geographicDistribution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Users',
                    data: data,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: {
                            font: {
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: {
                                size: 12
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    /**
     * Load activity timeline chart
     */
    function loadActivityTimelineChart() {
        fetch('/api/admin/role-analytics/charts/activity/', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data) {
                renderActivityTimelineChart(data.data);
            }
        })
        .catch(error => {
            console.error('Error loading activity timeline:', error);
        });
    }
    
    /**
     * Render activity timeline chart
     */
    function renderActivityTimelineChart(chartData) {
        const ctx = document.getElementById('activityTimelineChart');
        if (!ctx) return;
        
        if (charts.activityTimeline) {
            charts.activityTimeline.destroy();
        }
        
        charts.activityTimeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Users Created',
                    data: chartData.data,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: {
                            font: {
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: {
                                size: 12
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Destroy all charts
     */
    function destroyAllCharts() {
        Object.values(charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        charts = {};
    }
    
    /**
     * Initialize charts module
     */
    function init() {
        // Wait for Chart.js to be available
        if (typeof Chart === 'undefined') {
            setTimeout(init, 100);
            return;
        }
        
        initCharts();
    }
    
    // Export for external access
    window.RoleAnalyticsCharts = {
        init: init,
        reload: initCharts,
        destroy: destroyAllCharts
    };
    
    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

