/**
 * Smart API Cache Helper
 * Balances offline support with system load
 * - Caches essential APIs on page load
 * - Caches on-demand when user interacts
 * - Smart prefetching for better UX
 */

class SmartAPICacheHelper {
    constructor() {
        this.config = window.PWA_CONFIG;
        this.isCaching = false;
        
        // Track user interactions for smart prefetching
        this.userInteractions = {
            expandedCategories: new Set(),
            selectedTopics: new Set(),
            viewedPages: new Map() // topicId -> Set of page numbers
        };
        
        // Prefetch settings
        this.prefetchAdjacentTopics = 2; // Prefetch next 2 topics
        this.prefetchNextPages = 1; // Prefetch next page of questions
    }

    /**
     * Step 1: Cache only essential APIs on page load
     * - Categories (small, always needed)
     * - Saved answers (user's data)
     * - Progress (user's progress)
     */
    async ensureEssentialAPIsCached() {
        if (!('caches' in window) || !navigator.onLine || this.isCaching) {
            return;
        }

        this.isCaching = true;
        console.log('Caching essential APIs...');

        try {
            const cache = await caches.open(this.config.CACHE_NAMES.API);
            
            // Only cache these 3 essential APIs
            await Promise.all([
                this.cacheAPI(cache, '/user/dashboard/api/categories/'),
                this.cacheAPI(cache, '/user/dashboard/api/saved-answers/'),
                this.cacheAPI(cache, '/user/dashboard/api/progress/')
            ]);

            console.log('Essential APIs cached');
        } catch (error) {
            console.warn('Failed to cache essential APIs:', error);
        } finally {
            this.isCaching = false;
        }
    }

    /**
     * Step 2: Cache topics when user expands a category (on-demand)
     */
    async cacheTopicsForCategory(categoryId) {
        if (!navigator.onLine || this.userInteractions.expandedCategories.has(categoryId)) {
            return; // Already cached or offline
        }

        this.userInteractions.expandedCategories.add(categoryId);

        try {
            const cache = await caches.open(this.config.CACHE_NAMES.API);
            const topicsUrl = `/user/dashboard/api/topics/?category_id=${categoryId}`;
            
            await this.cacheAPI(cache, topicsUrl);
            console.log(`Cached: topics for category ${categoryId}`);
            
            // Smart prefetch: After caching topics, prefetch questions for first topic
            // This anticipates user's next action
            try {
                const response = await fetch(topicsUrl, {
                    credentials: 'same-origin',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                if (response.ok) {
                    const data = await response.json();
                    const topics = data.topics || [];
                    if (topics.length > 0) {
                        // Prefetch questions for first topic (most likely to be selected)
                        this.prefetchQuestionsForTopic(topics[0].topic_id, 1, 50);
                    }
                }
            } catch (error) {
                // Silently fail - prefetching is optional
            }
        } catch (error) {
            console.debug(`Failed to cache topics for category ${categoryId}:`, error);
        }
    }

    /**
     * Step 3: Cache questions when user selects a topic (on-demand)
     */
    async cacheQuestionsForTopic(topicId, page = 1, pageSize = 50) {
        if (!this.userInteractions.viewedPages.has(topicId)) {
            this.userInteractions.viewedPages.set(topicId, new Set());
        }
        
        const cacheKey = `${topicId}-${page}-${pageSize}`;
        if (!navigator.onLine || this.userInteractions.viewedPages.get(topicId).has(cacheKey)) {
            return; // Already cached or offline
        }

        this.userInteractions.viewedPages.get(topicId).add(cacheKey);
        this.userInteractions.selectedTopics.add(topicId);

        try {
            const cache = await caches.open(this.config.CACHE_NAMES.API);
            const questionsUrl = `/user/dashboard/api/questions/?topic_id=${topicId}&page=${page}&page_size=${pageSize}`;
            
            await this.cacheAPI(cache, questionsUrl);
            console.log(`Cached: questions for topic ${topicId}, page ${page}`);
            
            // Smart prefetch: Prefetch next page in background
            this.prefetchNextPage(topicId, page, pageSize);
        } catch (error) {
            console.debug(`Failed to cache questions for topic ${topicId}, page ${page}:`, error);
        }
    }

    /**
     * Step 4: Smart prefetching - Prefetch adjacent items in background
     */
    async prefetchNextPage(topicId, currentPage, pageSize) {
        if (!navigator.onLine) return;

        const nextPage = currentPage + 1;
        const nextPageUrl = `/user/dashboard/api/questions/?topic_id=${topicId}&page=${nextPage}&page_size=${pageSize}`;

        // Check if already cached
        try {
            const cache = await caches.open(this.config.CACHE_NAMES.API);
            const cached = await cache.match(nextPageUrl);
            if (cached) return; // Already cached

            // Prefetch in background (low priority)
            setTimeout(async () => {
                try {
                    await this.cacheAPI(cache, nextPageUrl);
                    console.log(`Prefetched: questions page ${nextPage} for topic ${topicId}`);
                } catch (error) {
                    // Silently fail - prefetching is optional
                }
            }, 2000); // Wait 2 seconds before prefetching
        } catch (error) {
            // Silently fail
        }
    }

    async prefetchQuestionsForTopic(topicId, page = 1, pageSize = 50) {
        if (!navigator.onLine) return;

        setTimeout(async () => {
            try {
                const cache = await caches.open(this.config.CACHE_NAMES.API);
                const questionsUrl = `/user/dashboard/api/questions/?topic_id=${topicId}&page=${page}&page_size=${pageSize}`;
                
                // Check if already cached
                const cached = await cache.match(questionsUrl);
                if (cached) return;
                
                await this.cacheAPI(cache, questionsUrl);
                console.log(`Prefetched: questions for topic ${topicId}`);
            } catch (error) {
                // Silently fail
            }
        }, 1000);
    }

    /**
     * Helper: Cache a single API
     */
    async cacheAPI(cache, url) {
        try {
            const response = await fetch(url, {
                credentials: 'same-origin',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });

            if (response.ok) {
                await cache.put(url, response.clone());
                return true;
            }
        } catch (error) {
            console.debug(`Failed to cache ${url}:`, error);
        }
        return false;
    }

    /**
     * Cache a specific API response (manual caching from API client)
     */
    async cacheAPIResponse(url, response) {
        if (!('caches' in window)) {
            return;
        }

        try {
            const cache = await caches.open(this.config.CACHE_NAMES.API);
            await cache.put(url, response.clone());
            console.log('Manually cached API:', url);
        } catch (error) {
            console.warn('Failed to cache API:', url, error);
        }
    }

    /**
     * Get cached API response
     */
    async getCachedAPI(url) {
        if (!('caches' in window)) {
            return null;
        }

        try {
            const cache = await caches.open(this.config.CACHE_NAMES.API);
            return await cache.match(url);
        } catch (error) {
            console.warn('Failed to get cached API:', url, error);
            return null;
        }
    }
}

// Create singleton instance
window.APICacheHelper = SmartAPICacheHelper;
const apiCacheHelper = new SmartAPICacheHelper();

// Auto-cache essential APIs when page loads (if online)
// This only caches 3 essential APIs, not everything
if (navigator.onLine) {
    const startEssentialCaching = () => {
        // Only cache essential APIs (categories, saved-answers, progress)
        // Topics/questions will be cached when user interacts with them
        apiCacheHelper.ensureEssentialAPIsCached().catch(err => {
            console.warn('Essential API caching failed:', err);
        });
    };

    // Start caching when browser is idle (non-blocking)
    if (document.readyState === 'loading') {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(startEssentialCaching, { timeout: 1000 });
        } else {
            setTimeout(startEssentialCaching, 1000);
        }
    } else {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(startEssentialCaching, { timeout: 1000 });
        } else {
            setTimeout(startEssentialCaching, 1000);
        }
    }
}
