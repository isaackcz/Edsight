/**
 * Service Worker Queue Manager
 * Handles IndexedDB operations for queuing failed requests
 */

class SWQueueManager {
    constructor() {
        this.db = null;
        this.dbName = self.PWA_CONFIG.INDEXEDDB.NAME;
        this.dbVersion = self.PWA_CONFIG.INDEXEDDB.VERSION;
        this.storeName = self.PWA_CONFIG.INDEXEDDB.STORES.QUEUE;
    }

    /**
     * Initialize IndexedDB
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, {
                        keyPath: 'id',
                        autoIncrement: false
                    });

                    // Create indexes
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('retries', 'retries', { unique: false });
                    store.createIndex('url', 'url', { unique: false });
                }
            };
        });
    }

    /**
     * Ensure database is initialized
     */
    async ensureDB() {
        if (!this.db) {
            await this.init();
        }
        return this.db;
    }

    /**
     * Generate UUID for queue item
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Serialize request for storage
     */
    async serializeRequest(request) {
        // Request should already be cloned before passing here
        let body = '';
        try {
            body = await request.text();
        } catch (e) {
            // Request body already consumed or empty
            console.debug('Cannot read request body:', e);
        }
        
        const headers = {};
        try {
            for (const [key, value] of request.headers.entries()) {
                headers[key] = value;
            }
        } catch (e) {
            console.debug('Cannot read request headers:', e);
        }

        return {
            url: request.url,
            method: request.method,
            headers: headers,
            body: body,
            mode: request.mode,
            credentials: request.credentials,
            cache: request.cache,
            redirect: request.redirect,
            referrer: request.referrer
        };
    }

    /**
     * Deserialize stored request
     */
    deserializeRequest(serialized) {
        return new Request(serialized.url, {
            method: serialized.method,
            headers: serialized.headers,
            body: serialized.body || null,
            mode: serialized.mode || 'cors',
            credentials: serialized.credentials || 'same-origin',
            cache: serialized.cache || 'default',
            redirect: serialized.redirect || 'follow',
            referrer: serialized.referrer || ''
        });
    }

    /**
     * Add request to queue
     */
    async add(request, maxRetries = self.PWA_CONFIG.SYNC.MAX_RETRIES) {
        await this.ensureDB();

        const serialized = await this.serializeRequest(request);
        const queueItem = {
            id: this.generateUUID(),
            ...serialized,
            timestamp: Date.now(),
            retries: 0,
            maxRetries: maxRetries
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.add(queueItem);

            request.onsuccess = () => {
                console.log('Request queued:', queueItem.id);
                resolve(queueItem.id);
            };

            request.onerror = () => {
                console.error('Failed to queue request:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get all queued requests
     */
    async getAll() {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                console.error('Failed to get queued requests:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get queued request by ID
     */
    async get(id) {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                console.error('Failed to get queued request:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Remove request from queue
     */
    async remove(id) {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log('Request removed from queue:', id);
                resolve(true);
            };

            request.onerror = () => {
                console.error('Failed to remove queued request:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Update request retry count
     */
    async updateRetries(id, retries) {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (!item) {
                    reject(new Error('Queue item not found'));
                    return;
                }

                item.retries = retries;
                item.timestamp = Date.now();

                const putRequest = store.put(item);
                putRequest.onsuccess = () => resolve(item);
                putRequest.onerror = () => reject(putRequest.error);
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Get count of queued requests
     */
    async count() {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.count();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Failed to count queued requests:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Clear all queued requests
     */
    async clear() {
        await this.ensureDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('Queue cleared');
                resolve(true);
            };

            request.onerror = () => {
                console.error('Failed to clear queue:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get requests that need retry (not exceeded max retries)
     */
    async getRetryable() {
        const all = await this.getAll();
        return all.filter(item => item.retries < item.maxRetries);
    }

    /**
     * Remove expired requests (older than 7 days)
     */
    async removeExpired(maxAge = 7 * 24 * 60 * 60 * 1000) {
        await this.ensureDB();
        const all = await this.getAll();
        const now = Date.now();
        const expired = all.filter(item => (now - item.timestamp) > maxAge);

        for (const item of expired) {
            await this.remove(item.id);
        }

        return expired.length;
    }
}

// Create singleton instance
const swQueueManager = new SWQueueManager();

// Initialize on service worker activation
self.addEventListener('activate', async () => {
    try {
        await swQueueManager.init();
        // Clean up expired requests
        await swQueueManager.removeExpired();
    } catch (error) {
        console.error('Failed to initialize queue manager:', error);
    }
});

