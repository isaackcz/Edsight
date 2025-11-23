/**
 * Service Worker Cache Manager
 * Handles cache strategies and cache management
 */

class SWCacheManager {
    constructor() {
        this.config = self.PWA_CONFIG;
    }

    /**
     * Check if URL matches pattern
     */
    matchesPattern(url, patterns) {
        return patterns.some(pattern => {
            if (pattern instanceof RegExp) {
                return pattern.test(url);
            }
            if (typeof pattern === 'string') {
                return url.includes(pattern);
            }
            return false;
        });
    }

    /**
     * Check if URL should not be cached
     */
    shouldNotCache(url) {
        return this.matchesPattern(url, this.config.ROUTES.NO_CACHE || []);
    }

    /**
     * Determine cache strategy for URL
     */
    getCacheStrategy(url) {
        // Don't cache certain URLs
        if (this.shouldNotCache(url)) {
            return 'no-cache';
        }

        // Static assets - Cache First
        if (this.matchesPattern(url, this.config.ROUTES.STATIC)) {
            return 'cache-first';
        }

        // Form save endpoints - Network First with queue
        if (this.matchesPattern(url, this.config.ROUTES.FORM_SAVE)) {
            return 'network-first-queue';
        }

        // API endpoints - Network First
        if (this.matchesPattern(url, this.config.ROUTES.API)) {
            return 'network-first';
        }

        // HTML pages - Network First
        if (this.matchesPattern(url, this.config.ROUTES.PAGES)) {
            return 'network-first';
        }

        // Default: Network First
        return 'network-first';
    }

    /**
     * Get cache name for URL
     */
    getCacheName(url) {
        if (this.matchesPattern(url, this.config.ROUTES.STATIC)) {
            return this.config.CACHE_NAMES.STATIC;
        }
        if (this.matchesPattern(url, this.config.ROUTES.PAGES)) {
            return this.config.CACHE_NAMES.PAGES;
        }
        if (this.matchesPattern(url, this.config.ROUTES.API)) {
            return this.config.CACHE_NAMES.API;
        }
        return this.config.CACHE_NAMES.PAGES;
    }

    /**
     * Cache First strategy
     */
    async cacheFirst(request, cacheName) {
        const cache = await caches.open(cacheName);
        const cached = await cache.match(request);

        if (cached) {
            return cached;
        }

        try {
            const response = await fetch(request);
            // Only cache GET requests (Cache API doesn't support POST/PUT/PATCH)
            if (response.ok && request.method === 'GET') {
                cache.put(request, response.clone()).catch(err => {
                    console.debug('Cache put failed (non-critical):', err);
                });
            }
            return response;
        } catch (error) {
            console.error('Cache First fetch failed:', error);
            throw error;
        }
    }

    /**
     * Network First strategy
     */
    async networkFirst(request, cacheName) {
        const cache = await caches.open(cacheName);

        try {
            const response = await fetch(request);
            // Cache successful responses (including API responses)
            // Only cache GET requests (Cache API doesn't support POST/PUT/PATCH)
            // Cache 200-299 status codes and also cache 304 (Not Modified)
            if ((response.ok || response.status === 200 || response.status === 304) && request.method === 'GET') {
                // Clone response before caching (responses can only be read once)
                const responseToCache = response.clone();
                
                // Create a new response with cache-friendly headers
                const headers = new Headers(responseToCache.headers);
                headers.set('sw-cached-at', Date.now().toString());
                
                const cachedResponse = new Response(responseToCache.body, {
                    status: responseToCache.status,
                    statusText: responseToCache.statusText,
                    headers: headers
                });
                
                // Cache the response (await to ensure it's cached)
                await cache.put(request, cachedResponse).catch(err => {
                    console.debug('Cache put failed (non-critical):', err);
                });
                console.log('Cached response:', request.url);
            }
            return response;
        } catch (error) {
            console.log('Network First failed, trying cache:', request.url, error);
            
            // Try exact match first
            let cached = await cache.match(request);
            if (cached) {
                console.log('Serving from cache:', request.url);
                return cached;
            }
            
            // For API requests, try to find similar cached responses
            if (this.matchesPattern(request.url, this.config.ROUTES.API)) {
                // Try to find any cached API response for the same endpoint
                const allKeys = await cache.keys();
                const urlObj = new URL(request.url);
                const endpoint = urlObj.pathname;
                
                // Find cached responses for the same endpoint (different query params)
                const matchingKey = allKeys.find(key => {
                    const keyUrl = key.url || (typeof key === 'string' ? key : '');
                    try {
                        const keyUrlObj = new URL(keyUrl);
                        return keyUrlObj.pathname === endpoint;
                    } catch {
                        return keyUrl.includes(endpoint);
                    }
                });
                
                if (matchingKey) {
                    cached = await cache.match(matchingKey);
                    if (cached) {
                        console.log('Serving similar cached API response:', matchingKey.url);
                        return cached;
                    }
                }
            }
            
            // For navigation requests, try to find any cached page
            if (request.mode === 'navigate') {
                const allKeys = await cache.keys();
                const matchingKey = allKeys.find(key => {
                    const url = key.url || (typeof key === 'string' ? key : '');
                    return url.includes('/user/dashboard/');
                });
                
                if (matchingKey) {
                    cached = await cache.match(matchingKey);
                    if (cached) {
                        console.log('Serving alternative cached page:', matchingKey.url);
                        return cached;
                    }
                }
            }
            
            throw error;
        }
    }

    /**
     * Network First with queue fallback
     */
    async networkFirstQueue(request, cacheName) {
        const cache = await caches.open(cacheName);
        
        // Clone request BEFORE fetch (for queuing if needed)
        // Only clone if it's a POST/PUT/PATCH request (has body)
        const shouldQueue = ['POST', 'PUT', 'PATCH'].includes(request.method);
        let requestClone = null;
        if (shouldQueue) {
            try {
                requestClone = request.clone();
            } catch (e) {
                // Request body already consumed, can't queue
                console.debug('Cannot clone request for queuing:', e);
            }
        }

        try {
            const response = await fetch(request);
            // Only cache GET requests (Cache API doesn't support POST/PUT/PATCH)
            if (response.ok && request.method === 'GET') {
                cache.put(request, response.clone()).catch(err => {
                    console.debug('Cache put failed (non-critical):', err);
                });
            }
            return response;
        } catch (error) {
            console.log('Network First Queue failed, trying cache:', error);
            
            // Only queue POST/PUT/PATCH requests (not GET requests)
            if (shouldQueue && requestClone && typeof swQueueManager !== 'undefined') {
                try {
                    await swQueueManager.add(requestClone);
                    
                    // Register background sync
                    if ('sync' in self.registration) {
                        try {
                            await self.registration.sync.register(this.config.BACKGROUND_SYNC_TAG);
                        } catch (syncError) {
                            console.debug('Background sync registration failed:', syncError);
                        }
                    }
                } catch (queueError) {
                    console.debug('Failed to queue request:', queueError);
                }
            }

            // Try cache as fallback
            const cached = await cache.match(request);
            if (cached) {
                return cached;
            }

            // For GET requests, return error
            // For POST/PUT/PATCH, return queued response
            if (shouldQueue) {
                return new Response(JSON.stringify({
                    queued: true,
                    message: 'Request queued for sync when online'
                }), {
                    status: 202,
                    statusText: 'Accepted',
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // For GET requests, throw error to be handled by caller
            throw error;
        }
    }

    /**
     * Stale While Revalidate strategy
     */
    async staleWhileRevalidate(request, cacheName) {
        const cache = await caches.open(cacheName);
        const cached = await cache.match(request);

        const fetchPromise = fetch(request).then(response => {
            // Only cache GET requests (Cache API doesn't support POST/PUT/PATCH)
            if (response.ok && request.method === 'GET') {
                cache.put(request, response.clone()).catch(err => {
                    console.debug('Cache put failed (non-critical):', err);
                });
            }
            return response;
        }).catch(() => {
            // Ignore fetch errors
        });

        return cached || fetchPromise;
    }

    /**
     * Handle fetch with appropriate strategy
     */
    async handleFetch(request) {
        const url = new URL(request.url);

        // Skip non-GET requests for caching (but allow queueing)
        if (request.method !== 'GET') {
            const strategy = this.getCacheStrategy(url.href);
            if (strategy === 'network-first-queue') {
                return this.networkFirstQueue(request, this.getCacheName(url.href));
            }
            // For other non-GET requests, just try network
            try {
                return await fetch(request);
            } catch (error) {
                // Queue if it's a POST/PUT/DELETE to form endpoints
                if (this.matchesPattern(url.href, this.config.ROUTES.FORM_SAVE)) {
                    if (typeof swQueueManager !== 'undefined') {
                        await swQueueManager.add(request);
                        if ('sync' in self.registration) {
                            await self.registration.sync.register(this.config.SYNC.TAG);
                        }
                    }
                    return new Response(JSON.stringify({
                        queued: true,
                        message: 'Request queued for sync when online'
                    }), {
                        status: 202,
                        statusText: 'Accepted',
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                throw error;
            }
        }

        const strategy = this.getCacheStrategy(url.href);
        const cacheName = this.getCacheName(url.href);

        switch (strategy) {
            case 'no-cache':
                return fetch(request);

            case 'cache-first':
                return this.cacheFirst(request, cacheName);

            case 'network-first':
                return this.networkFirst(request, cacheName);

            case 'network-first-queue':
                return this.networkFirstQueue(request, cacheName);

            case 'stale-while-revalidate':
                return this.staleWhileRevalidate(request, cacheName);

            default:
                return this.networkFirst(request, cacheName);
        }
    }

    /**
     * Precache URLs on install (non-blocking, happens in background)
     */
    async precache(urls) {
        // Don't block - precache in background
        setTimeout(async () => {
            try {
                const pageCache = await caches.open(this.config.CACHE_NAMES.PAGES);
                const apiCache = await caches.open(this.config.CACHE_NAMES.API);
                
                const requests = urls.map(url => new Request(url));
                
                // Fetch all in parallel but don't wait for all to complete
                const precachePromises = requests.map(async (request) => {
                    try {
                        const response = await fetch(request);
                        // Only cache GET requests (Cache API doesn't support POST/PUT/PATCH)
                        if (response && response.ok && request.method === 'GET') {
                            // Determine which cache to use
                            const isAPI = this.matchesPattern(request.url, this.config.ROUTES.API);
                            const cache = isAPI ? apiCache : pageCache;
                            
                            await cache.put(request, response).catch(err => {
                                console.debug('Precache put failed (non-critical):', err);
                            });
                            console.log(`Precached: ${request.url}`);
                        }
                    } catch (error) {
                        // Silently fail for individual URLs
                        console.debug(`Precache failed for ${request.url}:`, error);
                    }
                });
                
                // Also precache critical APIs if configured
                if (this.config.PRECACHE_APIS && this.config.PRECACHE_APIS.length > 0) {
                    const apiRequests = this.config.PRECACHE_APIS.map(url => new Request(url));
                    apiRequests.forEach(async (request) => {
                        try {
                            const response = await fetch(request);
                            if (response && response.ok) {
                                // Only cache GET requests
                                if (request.method === 'GET') {
                                    await apiCache.put(request, response).catch(err => {
                                        console.debug('Cache put failed (non-critical):', err);
                                    });
                                }
                                console.log(`Precached API: ${request.url}`);
                            }
                        } catch (error) {
                            console.debug(`API precache failed for ${request.url}:`, error);
                        }
                    });
                }
                
                // Don't wait for all - let them complete in background
                Promise.all(precachePromises).then(() => {
                    console.log(`Precaching completed for ${urls.length} URLs`);
                }).catch(err => {
                    console.warn('Some precache operations failed:', err);
                });
            } catch (error) {
                console.warn('Precache initialization failed:', error);
            }
        }, 100); // Small delay to not block install
    }

    /**
     * Clean up old caches
     */
    async cleanupOldCaches() {
        const cacheNames = await caches.keys();
        const currentCacheNames = Object.values(this.config.CACHE_NAMES);
        
        const oldCaches = cacheNames.filter(name => {
            // Keep current caches
            if (currentCacheNames.includes(name)) {
                return false;
            }
            // Remove old versioned caches
            return name.startsWith('edsight-');
        });

        await Promise.all(
            oldCaches.map(cacheName => {
                console.log('Deleting old cache:', cacheName);
                return caches.delete(cacheName);
            })
        );

        return oldCaches.length;
    }

    /**
     * Get cache size estimate
     */
    async getCacheSize(cacheName) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        let totalSize = 0;

        for (const key of keys) {
            const response = await cache.match(key);
            if (response) {
                const blob = await response.blob();
                totalSize += blob.size;
            }
        }

        return totalSize;
    }

    /**
     * Check if cache exceeds limit and clean if needed
     */
    async enforceCacheLimits() {
        const limits = this.config.CACHE_LIMITS;
        const cacheNames = Object.keys(this.config.CACHE_NAMES);

        for (const cacheName of cacheNames) {
            const limitKey = cacheName.replace('edsight-', '').replace('-v1', '').toUpperCase();
            const limitBytes = (limits[limitKey] || 50) * 1024 * 1024; // Convert MB to bytes
            const currentSize = await this.getCacheSize(this.config.CACHE_NAMES[cacheName]);

            if (currentSize > limitBytes) {
                console.log(`Cache ${cacheName} exceeds limit, cleaning...`);
                // Simple cleanup: remove oldest 25% of entries
                await this.cleanupCache(this.config.CACHE_NAMES[cacheName], 0.25);
            }
        }
    }

    /**
     * Cleanup cache by removing oldest entries
     */
    async cleanupCache(cacheName, percentage = 0.25) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        const entries = [];

        for (const key of keys) {
            const response = await cache.match(key);
            if (response) {
                const headers = response.headers;
                const dateHeader = headers.get('date') || headers.get('last-modified');
                entries.push({
                    key,
                    date: dateHeader ? new Date(dateHeader).getTime() : 0
                });
            }
        }

        // Sort by date (oldest first)
        entries.sort((a, b) => a.date - b.date);

        // Remove oldest percentage
        const toRemove = Math.ceil(entries.length * percentage);
        for (let i = 0; i < toRemove; i++) {
            await cache.delete(entries[i].key);
        }

        console.log(`Cleaned up ${toRemove} entries from ${cacheName}`);
    }
}

// Create singleton instance
const swCacheManager = new SWCacheManager();

