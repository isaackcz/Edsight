/**
 * Client-Side Queue Manager
 * Provides interface for interacting with service worker queue
 */

class QueueManager {
    constructor() {
        this.config = window.PWA_CONFIG;
        this.serviceWorker = null;
    }

    /**
     * Get service worker registration
     */
    async getServiceWorker() {
        if (!this.serviceWorker && 'serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            this.serviceWorker = registration.active;
        }
        return this.serviceWorker;
    }

    /**
     * Send message to service worker
     */
    async sendMessage(type, data = {}) {
        const sw = await this.getServiceWorker();
        if (!sw) {
            throw new Error('Service worker not available');
        }

        return new Promise((resolve, reject) => {
            const messageChannel = new MessageChannel();
            
            messageChannel.port1.onmessage = (event) => {
                if (event.data.error) {
                    reject(new Error(event.data.error));
                } else {
                    resolve(event.data);
                }
            };

            sw.postMessage({ type, data }, [messageChannel.port2]);
        });
    }

    /**
     * Get queue count
     */
    async getQueueCount() {
        try {
            const result = await this.sendMessage('get-queue-count');
            return result.count || 0;
        } catch (error) {
            console.error('Failed to get queue count:', error);
            return 0;
        }
    }

    /**
     * Manually trigger queue processing
     */
    async processQueue() {
        try {
            await this.sendMessage('process-queue');
            return true;
        } catch (error) {
            console.error('Failed to process queue:', error);
            return false;
        }
    }

    /**
     * Clear queue
     */
    async clearQueue() {
        try {
            await this.sendMessage('clear-queue');
            return true;
        } catch (error) {
            console.error('Failed to clear queue:', error);
            return false;
        }
    }

    /**
     * Listen for service worker messages
     */
    setupMessageListener(callback) {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (callback) {
                    callback(event.data);
                }
            });
        }
    }

    /**
     * Get sync status
     */
    async getSyncStatus() {
        if (!('serviceWorker' in navigator)) {
            return { supported: false };
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            const syncSupported = 'sync' in registration;
            
            return {
                supported: syncSupported,
                available: syncSupported && navigator.onLine
            };
        } catch (error) {
            return { supported: false, error: error.message };
        }
    }

    /**
     * Register background sync
     */
    async registerSync(tag = null) {
        if (!('serviceWorker' in navigator)) {
            throw new Error('Service workers not supported');
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            
            if (!('sync' in registration)) {
                throw new Error('Background Sync not supported');
            }

            const syncTag = tag || this.config.SYNC.TAG;
            await registration.sync.register(syncTag);
            
            return true;
        } catch (error) {
            console.error('Failed to register background sync:', error);
            throw error;
        }
    }

    /**
     * Monitor queue count and update UI
     */
    startQueueMonitoring(updateCallback, interval = 30000) {
        let monitoring = true;

        const checkQueue = async () => {
            if (!monitoring) return;

            try {
                const count = await this.getQueueCount();
                if (updateCallback) {
                    updateCallback(count);
                }
            } catch (error) {
                console.error('Queue monitoring error:', error);
            }

            if (monitoring) {
                setTimeout(checkQueue, interval);
            }
        };

        // Initial check
        checkQueue();

        // Also listen for sync events
        this.setupMessageListener((message) => {
            if (message.type && message.type.startsWith('pwa-sync-')) {
                // Sync event occurred, check queue count
                setTimeout(() => this.getQueueCount().then(count => {
                    if (updateCallback) {
                        updateCallback(count);
                    }
                }), 1000);
            }
        });

        // Return stop function
        return () => {
            monitoring = false;
        };
    }
}

// Create singleton instance
window.QueueManager = QueueManager;
const queueManager = new QueueManager();

