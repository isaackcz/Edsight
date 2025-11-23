// Shared Filter Component
const ReportFilters = {
    currentFilters: {
        date_from: null,
        date_to: null,
        region: null,
        division: null,
        district: null,
        school: null,
        category: null,
        status: null,
        admin_level: null,
        alert_type: null,
        severity: null,
        quality_score_min: null,
        quality_score_max: null
    },
    
    filterOptions: {},
    
    init() {
        this.loadFilterOptions();
    },
    
    async loadFilterOptions() {
        try {
            const response = await fetch('/api/analytics/filter-options/');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.filterOptions = data.filterOptions || {};
                }
            }
        } catch (error) {
            console.error('Error loading filter options:', error);
        }
    },
    
    collect() {
        const filters = {};
        
        // Date range
        if (this.currentFilters.date_from) {
            filters.date_from = this.currentFilters.date_from;
        }
        if (this.currentFilters.date_to) {
            filters.date_to = this.currentFilters.date_to;
        }
        
        // Geographic filters - can be single value or array
        if (this.currentFilters.region) {
            filters.region = this.currentFilters.region;
            // Also set region_ids for backend compatibility
            if (Array.isArray(this.currentFilters.region)) {
                filters.region_ids = this.currentFilters.region;
            } else {
                filters.region_ids = [this.currentFilters.region];
            }
        }
        if (this.currentFilters.division) {
            filters.division = this.currentFilters.division;
            // Also set division_ids for backend compatibility
            if (Array.isArray(this.currentFilters.division)) {
                filters.division_ids = this.currentFilters.division;
            } else {
                filters.division_ids = [this.currentFilters.division];
            }
        }
        if (this.currentFilters.district) {
            filters.district = this.currentFilters.district;
            // Also set district_ids for backend compatibility
            if (Array.isArray(this.currentFilters.district)) {
                filters.district_ids = this.currentFilters.district;
            } else {
                filters.district_ids = [this.currentFilters.district];
            }
        }
        if (this.currentFilters.school) {
            filters.school = this.currentFilters.school;
        }
        
        // Other filters
        if (this.currentFilters.category) {
            filters.category = this.currentFilters.category;
        }
        if (this.currentFilters.status) {
            // Status can be a single value or array
            filters.status = this.currentFilters.status;
        }
        if (this.currentFilters.admin_level) {
            filters.admin_level = this.currentFilters.admin_level;
        }
        if (this.currentFilters.alert_type) {
            filters.alert_type = this.currentFilters.alert_type;
        }
        if (this.currentFilters.severity) {
            filters.severity = this.currentFilters.severity;
        }
        if (this.currentFilters.quality_score_min !== null) {
            filters.quality_score_min = this.currentFilters.quality_score_min;
        }
        if (this.currentFilters.quality_score_max !== null) {
            filters.quality_score_max = this.currentFilters.quality_score_max;
        }
        
        return filters;
    },
    
    set(key, value) {
        this.currentFilters[key] = value;
    },
    
    get(key) {
        return this.currentFilters[key];
    },
    
    reset() {
        this.currentFilters = {
            date_from: null,
            date_to: null,
            region: null,
            division: null,
            district: null,
            school: null,
            category: null,
            status: null,
            admin_level: null,
            alert_type: null,
            severity: null,
            quality_score_min: null,
            quality_score_max: null
        };
    },
    
    // Date range helpers
    setDateRange(range) {
        const today = new Date();
        let dateFrom, dateTo;
        
        switch(range) {
            case '7days':
                dateFrom = new Date(today);
                dateFrom.setDate(today.getDate() - 7);
                break;
            case '30days':
                dateFrom = new Date(today);
                dateFrom.setDate(today.getDate() - 30);
                break;
            case '90days':
                dateFrom = new Date(today);
                dateFrom.setDate(today.getDate() - 90);
                break;
            case '6months':
                dateFrom = new Date(today);
                dateFrom.setMonth(today.getMonth() - 6);
                break;
            case 'year':
                dateFrom = new Date(today);
                dateFrom.setFullYear(today.getFullYear() - 1);
                break;
            case 'all':
                dateFrom = null;
                dateTo = null;  // Set both to null for "all" to show all data
                break;
            case 'custom':
                // Custom date range is handled separately
                return;
            default:
                dateFrom = new Date(today);
                dateFrom.setDate(today.getDate() - 30);
                dateTo = today;
        }
        
        // Only set dateTo if it wasn't already set (for 'all' case)
        if (dateTo === undefined) {
            dateTo = today;
        }
        
        this.currentFilters.date_from = dateFrom ? dateFrom.toISOString().split('T')[0] : null;
        this.currentFilters.date_to = dateTo ? dateTo.toISOString().split('T')[0] : null;
    },
    
    setCustomDateRange(from, to) {
        this.currentFilters.date_from = from;
        this.currentFilters.date_to = to;
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    ReportFilters.init();
});

// Export for use in other scripts
window.ReportFilters = ReportFilters;

