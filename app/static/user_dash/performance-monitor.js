// Performance Monitor - Track API calls and loading times
class PerformanceMonitor {
    constructor() {
        this.apiCalls = [];
        this.pageLoadTimes = {};
        this.startTime = Date.now();
    }

    // Track API call
    trackApiCall(endpoint, startTime, endTime, success = true) {
        const duration = endTime - startTime;
        this.apiCalls.push({
            endpoint,
            duration,
            success,
            timestamp: new Date().toISOString()
        });

        // Track API call performance
    }

    // Track page load time
    trackPageLoad(pageName, loadTime) {
        this.pageLoadTimes[pageName] = loadTime;
        
        // Track page load performance
    }

    // Get performance summary
    getSummary() {
        const totalCalls = this.apiCalls.length;
        const successfulCalls = this.apiCalls.filter(call => call.success).length;
        const totalDuration = this.apiCalls.reduce((sum, call) => sum + call.duration, 0);
        const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;

        return {
            totalApiCalls: totalCalls,
            successfulCalls,
            failedCalls: totalCalls - successfulCalls,
            totalDuration,
            averageDuration: avgDuration,
            uptime: Date.now() - this.startTime,
            pageLoadTimes: this.pageLoadTimes
        };
    }

    // Get API call statistics by endpoint
    getEndpointStats() {
        const stats = {};
        
        this.apiCalls.forEach(call => {
            if (!stats[call.endpoint]) {
                stats[call.endpoint] = {
                    count: 0,
                    totalDuration: 0,
                    successCount: 0,
                    failureCount: 0
                };
            }
            
            stats[call.endpoint].count++;
            stats[call.endpoint].totalDuration += call.duration;
            
            if (call.success) {
                stats[call.endpoint].successCount++;
            } else {
                stats[call.endpoint].failureCount++;
            }
        });

        // Calculate averages
        Object.keys(stats).forEach(endpoint => {
            const stat = stats[endpoint];
            stat.averageDuration = stat.count > 0 ? stat.totalDuration / stat.count : 0;
        });

        return stats;
    }

    // Log performance summary to console
    logSummary() {
        const summary = this.getSummary();
        const endpointStats = this.getEndpointStats();
        
        // Performance monitoring data collected but not logged to console
    }

    // Clear performance data
    clear() {
        this.apiCalls = [];
        this.pageLoadTimes = {};
        this.startTime = Date.now();
    }
}

// Initialize performance monitor
window.performanceMonitor = new PerformanceMonitor();

// Log summary every 5 minutes
setInterval(() => {
    if (window.performanceMonitor) {
        window.performanceMonitor.logSummary();
    }
}, 5 * 60 * 1000);

// Export for use in other scripts
window.PerformanceMonitor = PerformanceMonitor;