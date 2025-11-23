/**
 * Service Worker Background Sync Handler
 * Processes queued requests when connection is restored
 */

class SWSyncHandler {
    constructor() {
        this.config = self.PWA_CONFIG;
        this.isProcessing = false;
    }

    /**
     * Calculate exponential backoff delay
     */
    getRetryDelay(retries) {
        const baseDelay = this.config.SYNC.RETRY_DELAY;
        const maxDelay = this.config.SYNC.MAX_RETRY_DELAY;
        const delay = Math.min(baseDelay * Math.pow(2, retries), maxDelay);
        return delay;
    }

    /**
     * Process a single queued request
     */
    async processRequest(queueItem) {
        try {
            // Deserialize request
            const request = swQueueManager.deserializeRequest(queueItem);

            // Try to fetch
            const response = await fetch(request);

            if (response.ok) {
                // Success - remove from queue
                await swQueueManager.remove(queueItem.id);
                
                // Notify client of success
                this.notifyClient('sync-success', {
                    id: queueItem.id,
                    url: queueItem.url
                });

                return { success: true, id: queueItem.id };
            } else {
                // HTTP error - increment retries
                return await this.handleRetry(queueItem, new Error(`HTTP ${response.status}`));
            }
        } catch (error) {
            // Network error - increment retries
            return await this.handleRetry(queueItem, error);
        }
    }

    /**
     * Handle retry logic
     */
    async handleRetry(queueItem, error) {
        const newRetries = queueItem.retries + 1;

        if (newRetries >= queueItem.maxRetries) {
            // Max retries exceeded - remove from queue
            await swQueueManager.remove(queueItem.id);
            
            // Notify client of failure
            this.notifyClient('sync-failed', {
                id: queueItem.id,
                url: queueItem.url,
                error: error.message,
                retries: newRetries
            });

            console.error(`Max retries exceeded for request ${queueItem.id}:`, error);
            return { success: false, id: queueItem.id, maxRetries: true };
        }

        // Update retry count
        await swQueueManager.updateRetries(queueItem.id, newRetries);

        // Notify client of retry
        this.notifyClient('sync-retry', {
            id: queueItem.id,
            url: queueItem.url,
            retries: newRetries,
            maxRetries: queueItem.maxRetries
        });

        console.log(`Retrying request ${queueItem.id} (attempt ${newRetries}/${queueItem.maxRetries})`);

        // Wait before retry (exponential backoff)
        const delay = this.getRetryDelay(newRetries);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry the request
        return await this.processRequest({
            ...queueItem,
            retries: newRetries
        });
    }

    /**
     * Process all queued requests
     */
    async processQueue() {
        if (this.isProcessing) {
            console.log('Sync already in progress');
            return;
        }

        this.isProcessing = true;

        try {
            // Get all retryable requests
            const queueItems = await swQueueManager.getRetryable();

            if (queueItems.length === 0) {
                console.log('No queued requests to process');
                this.notifyClient('sync-complete', { count: 0 });
                return;
            }

            console.log(`Processing ${queueItems.length} queued requests`);

            // Notify client that sync started
            this.notifyClient('sync-started', { count: queueItems.length });

            // Process requests sequentially to avoid overwhelming the server
            const results = [];
            for (const item of queueItems) {
                try {
                    const result = await this.processRequest(item);
                    results.push(result);
                } catch (error) {
                    console.error(`Error processing request ${item.id}:`, error);
                    results.push({ success: false, id: item.id, error: error.message });
                }
            }

            const successCount = results.filter(r => r.success).length;
            const failureCount = results.length - successCount;

            console.log(`Sync complete: ${successCount} succeeded, ${failureCount} failed`);

            // Notify client of completion
            this.notifyClient('sync-complete', {
                total: results.length,
                success: successCount,
                failed: failureCount
            });
        } catch (error) {
            console.error('Error processing queue:', error);
            this.notifyClient('sync-error', {
                error: error.message
            });
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Notify client via postMessage
     */
    notifyClient(type, data) {
        // Get all clients (tabs/windows)
        self.clients.matchAll({
            includeUncontrolled: true,
            type: 'window'
        }).then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: `pwa-${type}`,
                    data: data,
                    timestamp: Date.now()
                });
            });
        }).catch(error => {
            console.error('Failed to notify clients:', error);
        });
    }

    /**
     * Handle sync event
     */
    async handleSync(event) {
        console.log('Background sync event:', event.tag);

        if (event.tag === this.config.SYNC.TAG) {
            event.waitUntil(this.processQueue());
        }
    }

    /**
     * Handle periodic background sync (if supported)
     */
    async handlePeriodicSync(event) {
        console.log('Periodic background sync:', event.tag);
        // Future: Implement periodic sync for non-critical updates
    }
}

// Create singleton instance
const swSyncHandler = new SWSyncHandler();

// Listen for sync events
self.addEventListener('sync', (event) => {
    swSyncHandler.handleSync(event);
});

// Listen for periodic sync events (if supported)
self.addEventListener('periodicsync', (event) => {
    swSyncHandler.handlePeriodicSync(event);
});

