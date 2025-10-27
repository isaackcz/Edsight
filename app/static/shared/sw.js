// EdSight Service Worker - Offline Capabilities
const CACHE_NAME = 'edsight-v1.0.0';
const STATIC_CACHE = 'edsight-static-v1.0.0';
const DYNAMIC_CACHE = 'edsight-dynamic-v1.0.0';
const OFFLINE_CACHE = 'edsight-offline-v1.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
    '/static/user_dash/user_dash.css',
    '/static/user_dash/user_dash.js',
    '/static/user_dash/user_dash_api.js',
    '/static/js/pwa-manager.js',
    '/static/manifest.json',
    '/static/images/icon-192x192.png',
    '/static/images/icon-512x512.png',
    '/user-dashboard/',
    '/api/dashboard/stats/',
    '/api/dashboard/categories/',
    '/api/form/sections/',
    '/api/profile/'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== STATIC_CACHE && 
                        cacheName !== DYNAMIC_CACHE && 
                        cacheName !== OFFLINE_CACHE) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch event - handle offline/online requests
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Handle API requests for form data
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleApiRequest(request));
        return;
    }

    // Handle static file requests
    if (request.destination === 'style' || 
        request.destination === 'script' || 
        request.destination === 'image') {
        event.respondWith(handleStaticRequest(request));
        return;
    }

    // Handle navigation requests
    if (request.mode === 'navigate') {
        event.respondWith(handleNavigationRequest(request));
        return;
    }
});

// Handle API requests with offline support
async function handleApiRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // For form submission, store in IndexedDB for later sync
        if (request.method === 'POST' && request.url.includes('/api/form/submit/')) {
            return handleOfflineFormSubmission(request);
        }

        // Return offline fallback
        return new Response(JSON.stringify({
            error: 'Offline mode - data will sync when connection is restored'
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handle static file requests
async function handleStaticRequest(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        // Return offline fallback for critical files
        if (request.url.includes('user_dash.css')) {
            return new Response(`
                body { 
                    background: #f8fafc; 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 0; padding: 20px;
                }
                .offline-notice {
                    background: #fef3c7; border: 1px solid #f59e0b; 
                    padding: 12px; border-radius: 8px; margin-bottom: 20px;
                    color: #92400e;
                }
            `, { headers: { 'Content-Type': 'text/css' } });
        }
        throw error;
    }
}

// Handle navigation requests
async function handleNavigationRequest(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Return offline page
        return caches.match('/offline.html');
    }
}

// Handle offline form submissions
async function handleOfflineFormSubmission(request) {
    try {
        const formData = await request.clone().json();
        
        // Store in IndexedDB for later sync
        await storeOfflineSubmission(formData);
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Data saved offline - will sync when connection is restored',
            offline: true
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to save offline data'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Store offline submissions in IndexedDB
async function storeOfflineSubmission(formData) {
    const db = await openDB('edsight-offline', 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('submissions')) {
                const store = db.createObjectStore('submissions', { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('questionId', 'questionId', { unique: false });
            }
        }
    });

    await db.add('submissions', {
        ...formData,
        timestamp: Date.now(),
        synced: false
    });
}

// Background sync for offline data
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-offline-submissions') {
        event.waitUntil(syncOfflineSubmissions());
    }
});

// Sync offline submissions when connection is restored
async function syncOfflineSubmissions() {
    const db = await openDB('edsight-offline', 1);
    const submissions = await db.getAllFromIndex('submissions', 'synced', false);

    for (const submission of submissions) {
        try {
            const response = await fetch('/api/form/submit/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submission)
            });

            if (response.ok) {
                await db.put('submissions', { ...submission, synced: true });
            }
        } catch (error) {
            console.error('Failed to sync submission:', error);
        }
    }
}

// Helper function to open IndexedDB
function openDB(name, version, upgradeCallback) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, version);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => upgradeCallback(request.result);
    });
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/static/images/icon-192x192.png',
            badge: '/static/images/icon-72x72.png',
            tag: 'edsight-notification',
            data: data.data
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/user-dashboard/')
    );
}); 