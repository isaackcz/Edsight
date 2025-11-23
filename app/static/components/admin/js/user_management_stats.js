// User Management Statistics Charts
// Uses Google Charts to visualize user statistics

(function() {
    'use strict';
    
    const STATS_ENDPOINT = '/api/user-management/stats/';
    
    let userTypesChart = null;
    let userStatusChart = null;
    let permissionLevelsChart = null;
    
    // Load Google Charts library
    function loadGoogleCharts() {
        return new Promise((resolve, reject) => {
            // Check if Google Charts is already loaded and ready
            if (window.google && window.google.charts && window.google.visualization) {
                resolve();
                return;
            }
            
            // Check if loader script is already in the page
            if (window.google && window.google.charts) {
                window.google.charts.load('current', {
                    'packages': ['corechart']
                });
                window.google.charts.setOnLoadCallback(() => {
                    // Wait a bit to ensure visualization is ready
                    setTimeout(resolve, 100);
                });
                return;
            }
            
            // Load the Google Charts loader script
            const existingScript = document.querySelector('script[src*="gstatic.com/charts"]');
            if (existingScript) {
                // Script is already loading, wait for it
                existingScript.addEventListener('load', function() {
                    window.google.charts.load('current', {
                        'packages': ['corechart']
                    });
                    window.google.charts.setOnLoadCallback(() => {
                        setTimeout(resolve, 100);
                    });
                });
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://www.gstatic.com/charts/loader.js';
            script.async = true;
            script.onload = function() {
                window.google.charts.load('current', {
                    'packages': ['corechart']
                });
                window.google.charts.setOnLoadCallback(() => {
                    // Ensure visualization is available
                    if (window.google.visualization) {
                        setTimeout(resolve, 100);
                    } else {
                        reject(new Error('Google Visualization not available'));
                    }
                });
            };
            script.onerror = () => reject(new Error('Failed to load Google Charts'));
            document.head.appendChild(script);
        });
    }
    
    /**
     * Load user management statistics from API
     */
    function loadStatistics() {
        fetch(STATS_ENDPOINT, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.stats) {
                updateCharts(data.stats);
            } else {
                console.error('Failed to load statistics:', data.error || 'Unknown error');
                showChartsError();
            }
        })
        .catch(error => {
            console.error('Error loading statistics:', error);
            showChartsError();
        });
    }
    
    /**
     * Update charts with new data
     */
    function updateCharts(stats) {
        if (!window.google || !window.google.visualization) {
            loadGoogleCharts().then(() => {
                updateCharts(stats);
            });
            return;
        }
        
        // User Types Pie Chart
        if (stats.user_types) {
            drawUserTypesChart(stats.user_types);
        }
        
        // Status Pie Chart
        if (stats.status_counts) {
            drawUserStatusChart(stats.status_counts);
        }
        
        // Permission Levels Bar Chart
        if (stats.permission_levels) {
            drawPermissionLevelsChart(stats.permission_levels);
        }
    }
    
    /**
     * Draw User Types Pie Chart
     */
    function drawUserTypesChart(userTypes) {
        const data = new window.google.visualization.DataTable();
        data.addColumn('string', 'User Type');
        data.addColumn('number', 'Count');
        
        const rows = [
            ['Central Office', userTypes.central || 0],
            ['Region', userTypes.region || 0],
            ['Division', userTypes.division || 0],
            ['District', userTypes.district || 0],
            ['School', userTypes.school || 0]
        ];
        
        data.addRows(rows);
        
        const options = {
            title: '',
            pieHole: 0.4,
            colors: ['#3a6ea5', '#2196f3', '#4caf50', '#ff9800', '#f44336'],
            chartArea: {
                width: '85%',
                height: '85%'
            },
            legend: {
                position: 'bottom',
                textStyle: {
                    fontSize: 12,
                    fontName: 'Poppins'
                }
            },
            pieSliceText: 'value',
            pieSliceTextStyle: {
                fontSize: 12,
                fontName: 'Poppins',
                bold: true
            },
            tooltip: {
                textStyle: {
                    fontSize: 12,
                    fontName: 'Poppins'
                }
            },
            backgroundColor: 'transparent',
            fontSize: 12,
            fontName: 'Poppins'
        };
        
        const chartElement = document.getElementById('userTypesChart');
        if (chartElement) {
            userTypesChart = new window.google.visualization.PieChart(chartElement);
            userTypesChart.draw(data, options);
        }
    }
    
    /**
     * Draw User Status Pie Chart
     */
    function drawUserStatusChart(statusCounts) {
        const data = new window.google.visualization.DataTable();
        data.addColumn('string', 'Status');
        data.addColumn('number', 'Count');
        
        const rows = [
            ['Active', statusCounts.active || 0],
            ['Inactive', statusCounts.inactive || 0],
            ['Suspended', statusCounts.suspended || 0]
        ];
        
        data.addRows(rows);
        
        const options = {
            title: '',
            pieHole: 0.4,
            colors: ['#4caf50', '#9e9e9e', '#f44336'],
            chartArea: {
                width: '85%',
                height: '85%'
            },
            legend: {
                position: 'bottom',
                textStyle: {
                    fontSize: 12,
                    fontName: 'Poppins'
                }
            },
            pieSliceText: 'value',
            pieSliceTextStyle: {
                fontSize: 12,
                fontName: 'Poppins',
                bold: true
            },
            tooltip: {
                textStyle: {
                    fontSize: 12,
                    fontName: 'Poppins'
                }
            },
            backgroundColor: 'transparent',
            fontSize: 12,
            fontName: 'Poppins'
        };
        
        const chartElement = document.getElementById('userStatusChart');
        if (chartElement) {
            userStatusChart = new window.google.visualization.PieChart(chartElement);
            userStatusChart.draw(data, options);
        }
    }
    
    /**
     * Draw Permission Levels Bar Chart
     */
    function drawPermissionLevelsChart(permissionLevels) {
        const data = new window.google.visualization.DataTable();
        data.addColumn('string', 'Permission');
        data.addColumn('number', 'Users');
        
        const permissionLabels = {
            'can_create_users': 'Create Users',
            'can_manage_users': 'Manage Users',
            'can_set_deadlines': 'Set Deadlines',
            'can_approve_submissions': 'Approve Submissions',
            'can_view_system_logs': 'View System Logs'
        };
        
        const rows = Object.keys(permissionLevels).map(key => [
            permissionLabels[key] || key,
            permissionLevels[key] || 0
        ]);
        
        data.addRows(rows);
        
        const options = {
            title: '',
            colors: ['#3a6ea5'],
            chartArea: {
                width: '70%',
                height: '75%'
            },
            hAxis: {
                title: 'Number of Users',
                titleTextStyle: {
                    fontSize: 12,
                    fontName: 'Poppins',
                    bold: true
                },
                textStyle: {
                    fontSize: 11,
                    fontName: 'Poppins'
                },
                gridlines: {
                    color: 'transparent'
                }
            },
            vAxis: {
                title: '',
                textStyle: {
                    fontSize: 11,
                    fontName: 'Poppins'
                },
                gridlines: {
                    color: 'rgba(0, 0, 0, 0.1)'
                }
            },
            legend: {
                position: 'none'
            },
            tooltip: {
                textStyle: {
                    fontSize: 12,
                    fontName: 'Poppins'
                }
            },
            backgroundColor: 'transparent',
            fontSize: 12,
            fontName: 'Poppins',
            bar: {
                groupWidth: '60%'
            }
        };
        
        const chartElement = document.getElementById('permissionLevelsChart');
        if (chartElement) {
            permissionLevelsChart = new window.google.visualization.BarChart(chartElement);
            permissionLevelsChart.draw(data, options);
        }
    }
    
    /**
     * Show error state for charts
     */
    function showChartsError() {
        const chartElements = [
            document.getElementById('userTypesChart'),
            document.getElementById('userStatusChart'),
            document.getElementById('permissionLevelsChart')
        ];
        
        chartElements.forEach(element => {
            if (element) {
                element.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999; font-family: Poppins;">Failed to load data</div>';
            }
        });
    }
    
    /**
     * Handle window resize for responsive charts
     */
    function handleResize() {
        if (userTypesChart) {
            userTypesChart.draw();
        }
        if (userStatusChart) {
            userStatusChart.draw();
        }
        if (permissionLevelsChart) {
            permissionLevelsChart.draw();
        }
    }
    
    /**
     * Initialize statistics charts
     */
    function init() {
        const chartContainer = document.getElementById('userTypesChart');
        if (chartContainer) {
            loadGoogleCharts().then(() => {
                loadStatistics();
                window.addEventListener('resize', handleResize);
            });
        }
    }
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Export for manual refresh if needed
    window.UserManagementStats = {
        load: loadStatistics,
        refresh: loadStatistics
    };
})();
