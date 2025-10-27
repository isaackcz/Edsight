document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.log-tab-content');
    const dateRangeSelect = document.getElementById('dateRange');
    const customDates = document.getElementById('customDates');
    const logSearch = document.getElementById('logSearch');
    
    // Tab switching functionality
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Show corresponding content
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Show/hide custom date inputs
    dateRangeSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
            customDates.style.display = 'flex';
        } else {
            customDates.style.display = 'none';
        }
    });
    
    // Search functionality
    logSearch.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const activeTab = document.querySelector('.log-tab-content.active');
        const tableRows = activeTab.querySelectorAll('tbody tr');
        
        tableRows.forEach(row => {
            const rowText = row.textContent.toLowerCase();
            if (rowText.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
    
    // Set default dates for custom range
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    document.getElementById('startDate').valueAsDate = yesterday;
    document.getElementById('endDate').valueAsDate = today;
    
    // Simulate loading data
    setTimeout(() => {
        document.querySelector('.admin-container').classList.add('loaded');
    }, 500);
});

// Export functionality
function exportCurrentTab(format) {
    if (format !== 'csv') {
        alert('Only CSV export is currently supported');
        return;
    }
    
    // Get current active tab
    const activeTab = document.querySelector('.tab-btn.active');
    if (!activeTab) {
        alert('No active tab selected');
        return;
    }
    
    const tabType = activeTab.getAttribute('data-tab').replace('-', '_');
    
    // Get current filters
    const dateRange = document.getElementById('dateRange').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const search = document.getElementById('logSearch').value;
    
    // Build export URL
    const params = new URLSearchParams({
        type: tabType,
        date_range: dateRange,
        search: search
    });
    
    if (dateRange === 'custom' && startDate && endDate) {
        params.append('start_date', startDate);
        params.append('end_date', endDate);
    }
    
    const exportUrl = '/admin/logs/export/?' + params.toString();
    
    // Create temporary link and trigger download
    const link = document.createElement('a');
    link.href = exportUrl;
    link.download = `${tabType}_${dateRange}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Handle date range changes and reload data
function reloadLogsData() {
    const dateRange = document.getElementById('dateRange').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const search = document.getElementById('logSearch').value;
    
    // Build URL with current filters
    const params = new URLSearchParams({
        date_range: dateRange,
        search: search
    });
    
    if (dateRange === 'custom' && startDate && endDate) {
        params.append('start_date', startDate);
        params.append('end_date', endDate);
    }
    
    // Reload page with new parameters
    window.location.href = window.location.pathname + '?' + params.toString();
}

// Add event listeners for auto-refresh on filter changes
document.addEventListener('DOMContentLoaded', function() {
    const dateRangeSelect = document.getElementById('dateRange');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const searchInput = document.getElementById('logSearch');
    
    // Auto-reload on date range change
    dateRangeSelect.addEventListener('change', function() {
        if (this.value !== 'custom') {
            reloadLogsData();
        }
    });
    
    // Auto-reload on custom date change
    startDateInput.addEventListener('change', function() {
        if (dateRangeSelect.value === 'custom') {
            reloadLogsData();
        }
    });
    
    endDateInput.addEventListener('change', function() {
        if (dateRangeSelect.value === 'custom') {
            reloadLogsData();
        }
    });
    
    // Search with debounce
    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(reloadLogsData, 1000); // Wait 1 second after user stops typing
    });
});