/**
 * Service Worker Main
 * Coordinates all service worker modules and handles lifecycle events
 */

class SWMain {
    constructor() {
        this.config = self.PWA_CONFIG;
        this.version = this.config.VERSION;
    }

    /**
     * Handle install event
     */
    async handleInstall(event) {
        console.log('Service Worker installing, version:', this.version);

        // Skip waiting to activate immediately
        self.skipWaiting();

        // Precache in background (non-blocking)
        // Don't wait for precache to complete - let it happen in background
        event.waitUntil(
            Promise.resolve().then(() => {
                // Start precaching but don't block on it
                swCacheManager.precache(this.config.PRECACHE_URLS).catch(err => {
                    console.warn('Precache failed (non-critical):', err);
                });
                // Return immediately so install completes fast
                return Promise.resolve();
            })
        );
    }

    /**
     * Handle activate event
     */
    async handleActivate(event) {
        console.log('Service Worker activating, version:', this.version);

        // Take control of all clients immediately
        event.waitUntil(
            Promise.all([
                // Initialize queue manager first (fast)
                swQueueManager.init().catch(err => {
                    console.warn('Queue manager init failed:', err);
                }),
                // Claim all clients (fast)
                self.clients.claim()
            ]).then(() => {
                console.log('Service Worker activated');
                // Notify clients of activation
                this.notifyClients('sw-activated', { version: this.version });
                
                // Clean up old caches in background (non-blocking)
                swCacheManager.cleanupOldCaches().catch(err => {
                    console.warn('Cache cleanup failed:', err);
                });
            })
        );
    }

    /**
     * Handle fetch event
     */
    async handleFetch(event) {
        const { request } = event;

        // Skip non-GET requests for caching (but allow queueing)
        // Let cache manager handle the strategy
        try {
            const response = await swCacheManager.handleFetch(request);
            return response;
        } catch (error) {
            console.error('Fetch handler error:', error);
            // Return a fallback response for navigation requests
            if (request.mode === 'navigate') {
                return this.getOfflineFallback();
            }
            throw error;
        }
    }

    /**
     * Get offline fallback page
     */
    async getOfflineFallback() {
        const cache = await caches.open(this.config.CACHE_NAMES.PAGES);
        
        // Try multiple cache keys
        const cacheKeys = [
            '/user/dashboard/form/',
            '/user/dashboard/',
            '/user/dashboard/overview/',
            '/user/dashboard/settings/'
        ];
        
        for (const key of cacheKeys) {
            const cached = await cache.match(key);
            if (cached) {
                console.log('Serving cached page:', key);
                return cached;
            }
        }
        
        // Try to find any cached page in the dashboard
        const allKeys = await cache.keys();
        const dashboardPage = allKeys.find(key => {
            const url = key.url || (typeof key === 'string' ? key : '');
            return url.includes('/user/dashboard/');
        });
        
        if (dashboardPage) {
            const cached = await cache.match(dashboardPage);
            if (cached) {
                console.log('Serving cached dashboard page:', dashboardPage.url);
                return cached;
            }
        }

        // Return a simple offline page
        return new Response(
            `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Offline - EdSight</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background: #f5f5f5;
                        color: #333;
                    }
                    .container {
                        text-align: center;
                        padding: 2rem;
                    }
                    h1 { margin-bottom: 1rem; }
                    p { color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>You're Offline</h1>
                    <p>Please check your internet connection and try again.</p>
                </div>
            </body>
            </html>
            `,
            {
                headers: { 'Content-Type': 'text/html' }
            }
        );
    }

    /**
     * Handle message event from clients
     */
    async handleMessage(event) {
        const { type, data } = event.data;

        console.log('Service Worker received message:', type, data);

        switch (type) {
            case 'get-queue-count':
                try {
                    const count = await swQueueManager.count();
                    event.ports[0].postMessage({ count });
                } catch (error) {
                    event.ports[0].postMessage({ error: error.message });
                }
                break;

            case 'process-queue':
                // Manually trigger queue processing
                event.waitUntil(swSyncHandler.processQueue());
                break;

            case 'clear-queue':
                try {
                    await swQueueManager.clear();
                    event.ports[0].postMessage({ success: true });
                } catch (error) {
                    event.ports[0].postMessage({ error: error.message });
                }
                break;

            case 'get-version':
                event.ports[0].postMessage({ version: this.version });
                break;

            case 'skip-waiting':
                self.skipWaiting();
                break;

            default:
                console.log('Unknown message type:', type);
        }
    }

    /**
     * Notify all clients
     */
    notifyClients(type, data) {
        self.clients.matchAll({
            includeUncontrolled: true,
            type: 'window'
        }).then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: `sw-${type}`,
                    data: data,
                    timestamp: Date.now()
                });
            });
        }).catch(error => {
            console.error('Failed to notify clients:', error);
        });
    }

    /**
     * Initialize service worker
     */
    init() {
        // Install event
        self.addEventListener('install', (event) => {
            this.handleInstall(event);
        });

        // Activate event
        self.addEventListener('activate', (event) => {
            this.handleActivate(event);
        });

        // Fetch event
        self.addEventListener('fetch', (event) => {
            event.respondWith(this.handleFetch(event));
        });

        // Message event
        self.addEventListener('message', (event) => {
            this.handleMessage(event);
        });

        console.log('Service Worker initialized, version:', this.version);
    }
}

// Initialize service worker
const swMain = new SWMain();
swMain.init();

