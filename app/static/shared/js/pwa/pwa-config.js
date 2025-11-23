/**
 * PWA Configuration
 * Centralized configuration for Progressive Web App features
 */

const PWA_CONFIG = {
    // Service Worker version - increment to force cache update
    VERSION: '1.0.0',
    
    // Cache names
    CACHE_NAMES: {
        STATIC: 'edsight-static-v1',
        PAGES: 'edsight-pages-v1',
        API: 'edsight-api-v1'
    },
    
    // Cache size limits (in MB)
    CACHE_LIMITS: {
        STATIC: 50,  // 50MB for static assets
        PAGES: 20,   // 20MB for HTML pages
        API: 10      // 10MB for API responses
    },
    
    // Cache expiration (in days)
    CACHE_EXPIRATION: {
        STATIC: 30,  // Static assets cached for 30 days
        PAGES: 7,    // HTML pages cached for 7 days
        API: 1       // API responses cached for 1 day
    },
    
    // Background Sync configuration
    SYNC: {
        TAG: 'sync-form-answers',
        MAX_RETRIES: 5,
        RETRY_DELAY: 1000,  // Initial retry delay in ms
        MAX_RETRY_DELAY: 30000  // Max retry delay in ms (exponential backoff)
    },
    
    // IndexedDB configuration
    INDEXEDDB: {
        NAME: 'edsight-pwa-db',
        VERSION: 1,
        STORES: {
            QUEUE: 'request-queue',
            CACHE_META: 'cache-metadata'
        }
    },
    
    // Route patterns for cache strategies
    ROUTES: {
        // Static assets - Cache First
        STATIC: [
            /\.(?:js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/,
            /\/static\//,
            /cdn\.jsdelivr\.net/,
            /cdnjs\.cloudflare\.com/,
            /fonts\.googleapis\.com/,
            /fonts\.gstatic\.com/
        ],
        
        // HTML pages - Network First
        PAGES: [
            /^\/user\/dashboard/,
            /\.html$/
        ],
        
        // API endpoints - Network First with queue fallback
        API: [
            /\/api\//,
            /\/user\/dashboard\/api\//
        ],
        
        // Form save endpoints - Network First + queue on failure
        FORM_SAVE: [
            /\/save-answers\//,
            /\/submit-form\//
        ]
    },
    
    // URLs to precache on install (optional - happens in background)
    // Empty array = no precaching (faster install)
    PRECACHE_URLS: [
        // Precache only critical pages (or leave empty for faster install)
        // '/user/dashboard/',
        // '/user/dashboard/form/',
    ],
    
    // Critical API endpoints to precache (optional)
    // These will be cached when service worker installs
    PRECACHE_APIS: [
        // Add critical API endpoints that should be available offline
        // '/user/dashboard/api/categories/',
        // '/user/dashboard/api/topics/',
    ],
    
    // URLs to never cache
    NO_CACHE: [
        /\/logout\//,
        /\/auth\//
    ],
    
    // Service Worker file path (served via Django view with proper scope header)
    SW_PATH: '/user/dashboard/service-worker.js',
    
    // Manifest file path
    MANIFEST_PATH: '/static/shared/manifest.json'
};

// Export for use in service worker (using self for service worker context)
if (typeof self !== 'undefined' && self.importScripts) {
    // Service worker context
    self.PWA_CONFIG = PWA_CONFIG;
} else {
    // Client context
    window.PWA_CONFIG = PWA_CONFIG;
}

