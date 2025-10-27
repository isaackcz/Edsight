/**
 * Performance Monitor for Form Management System
 * Monitors database queries, memory usage, and loading times
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            apiCalls: [],
            loadTimes: {},
            memoryUsage: [],
            queryCounts: {},
            errors: []
        };
        this.startTime = Date.now();
        this.observer = null;
        
        this.init();
    }
    
    init() {
        this.setupPerformanceObserver();
        this.monitorMemoryUsage();
        this.trackAPICalls();
        this.setupErrorHandling();
    }
    
    setupPerformanceObserver() {
        if ('PerformanceObserver' in window) {
            this.observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'navigation') {
                        this.metrics.loadTimes.initialLoad = entry.loadEventEnd - entry.loadEventStart;
                    } else if (entry.entryType === 'resource') {
                        this.trackResourceLoad(entry);
                    }
                }
            });
            
            this.observer.observe({ entryTypes: ['navigation', 'resource'] });
        }
    }
    
    trackResourceLoad(entry) {
        const resourceType = this.getResourceType(entry.name);
        if (!this.metrics.queryCounts[resourceType]) {
            this.metrics.queryCounts[resourceType] = 0;
        }
        this.metrics.queryCounts[resourceType]++;
        
        this.metrics.apiCalls.push({
            url: entry.name,
            duration: entry.duration,
            size: entry.transferSize,
            timestamp: Date.now()
        });
    }
    
    getResourceType(url) {
        if (url.includes('/api/admin/form-management/geographic-data/regions/')) return 'regions';
        if (url.includes('/api/admin/form-management/geographic-data/divisions/')) return 'divisions';
        if (url.includes('/api/admin/form-management/geographic-data/districts/')) return 'districts';
        if (url.includes('/api/admin/form-management/geographic-data/schools/')) return 'schools';
        return 'other';
    }
    
    trackAPICalls() {
        const originalFetch = window.fetch;
        const self = this;
        
        window.fetch = function(...args) {
            const startTime = performance.now();
            const url = args[0];
            
            return originalFetch.apply(this, args)
                .then(response => {
                    const endTime = performance.now();
                    const duration = endTime - startTime;
                    
                    self.metrics.apiCalls.push({
                        url: url,
                        duration: duration,
                        status: response.status,
                        timestamp: Date.now()
                    });
                    
                    // Track specific geographic data calls
                    if (url.includes('/geographic-data/')) {
                        const dataType = self.extractDataType(url);
                        if (dataType) {
                            self.metrics.loadTimes[dataType] = duration;
                        }
                    }
                    
                    return response;
                })
                .catch(error => {
                    self.metrics.errors.push({
                        url: url,
                        error: error.message,
                        timestamp: Date.now()
                    });
                    throw error;
                });
        };
    }
    
    extractDataType(url) {
        if (url.includes('/regions/')) return 'regions';
        if (url.includes('/divisions/')) return 'divisions';
        if (url.includes('/districts/')) return 'districts';
        if (url.includes('/schools/')) return 'schools';
        return null;
    }
    
    monitorMemoryUsage() {
        if ('memory' in performance) {
            setInterval(() => {
                this.metrics.memoryUsage.push({
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit,
                    timestamp: Date.now()
                });
            }, 5000); // Check every 5 seconds
        }
    }
    
    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            this.metrics.errors.push({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                timestamp: Date.now()
            });
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.metrics.errors.push({
                type: 'promise',
                reason: event.reason,
                timestamp: Date.now()
            });
        });
    }
    
    getPerformanceReport() {
        const totalTime = Date.now() - this.startTime;
        const apiCalls = this.metrics.apiCalls.length;
        const errors = this.metrics.errors.length;
        
        // Calculate average load times
        const avgLoadTimes = {};
        Object.keys(this.metrics.loadTimes).forEach(key => {
            const times = this.metrics.apiCalls
                .filter(call => call.url.includes(key))
                .map(call => call.duration);
            if (times.length > 0) {
                avgLoadTimes[key] = times.reduce((a, b) => a + b, 0) / times.length;
            }
        });
        
        // Calculate memory usage trends
        const memoryTrend = this.calculateMemoryTrend();
        
        return {
            totalTime,
            apiCalls,
            errors,
            avgLoadTimes,
            memoryTrend,
            queryCounts: this.metrics.queryCounts,
            recommendations: this.generateRecommendations()
        };
    }
    
    calculateMemoryTrend() {
        if (this.metrics.memoryUsage.length < 2) return 'stable';
        
        const recent = this.metrics.memoryUsage.slice(-5);
        const trend = recent[recent.length - 1].used - recent[0].used;
        
        if (trend > 10 * 1024 * 1024) return 'increasing'; // 10MB increase
        if (trend < -10 * 1024 * 1024) return 'decreasing'; // 10MB decrease
        return 'stable';
    }
    
    generateRecommendations() {
        const recommendations = [];
        
        // Check for too many API calls
        if (this.metrics.apiCalls.length > 50) {
            recommendations.push({
                type: 'warning',
                message: 'High number of API calls detected. Consider implementing caching.',
                impact: 'medium'
            });
        }
        
        // Check for slow load times
        Object.keys(this.metrics.loadTimes).forEach(key => {
            if (this.metrics.loadTimes[key] > 2000) { // 2 seconds
                recommendations.push({
                    type: 'performance',
                    message: `Slow load time for ${key}: ${this.metrics.loadTimes[key].toFixed(2)}ms`,
                    impact: 'high'
                });
            }
        });
        
        // Check for memory leaks
        if (this.metrics.memoryUsage.length > 10) {
            const memoryTrend = this.calculateMemoryTrend();
            if (memoryTrend === 'increasing') {
                recommendations.push({
                    type: 'memory',
                    message: 'Memory usage is increasing. Check for memory leaks.',
                    impact: 'high'
                });
            }
        }
        
        // Check for errors
        if (this.metrics.errors.length > 0) {
            recommendations.push({
                type: 'error',
                message: `${this.metrics.errors.length} errors detected. Check console for details.`,
                impact: 'high'
            });
        }
        
        return recommendations;
    }
    
    logPerformanceReport() {
        const report = this.getPerformanceReport();
        console.group('🚀 Form Management Performance Report');
        console.log('⏱️ Total Time:', report.totalTime + 'ms');
        console.log('📡 API Calls:', report.apiCalls);
        console.log('❌ Errors:', report.errors);
        console.log('⚡ Average Load Times:', report.avgLoadTimes);
        console.log('🧠 Memory Trend:', report.memoryTrend);
        console.log('📊 Query Counts:', report.queryCounts);
        
        if (report.recommendations.length > 0) {
            console.group('💡 Recommendations');
            report.recommendations.forEach(rec => {
                const icon = rec.type === 'error' ? '❌' : 
                           rec.type === 'warning' ? '⚠️' : 
                           rec.type === 'performance' ? '⚡' : '🧠';
                console.log(`${icon} ${rec.message} (${rec.impact} impact)`);
            });
            console.groupEnd();
        }
        
        console.groupEnd();
        return report;
    }
    
    exportMetrics() {
        const report = this.getPerformanceReport();
        const dataStr = JSON.stringify(report, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `performance-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }
    
    cleanup() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}

// Initialize performance monitor
let performanceMonitor;
document.addEventListener('DOMContentLoaded', () => {
    performanceMonitor = new PerformanceMonitor();
    
    // Log performance report every 30 seconds
    setInterval(() => {
        if (performanceMonitor) {
            performanceMonitor.logPerformanceReport();
        }
    }, 30000);
    
    // Cleanup on page unload (removed automatic export)
    window.addEventListener('beforeunload', () => {
        if (performanceMonitor) {
            performanceMonitor.cleanup();
        }
    });
});

// Expose to global scope for debugging
window.performanceMonitor = performanceMonitor;
