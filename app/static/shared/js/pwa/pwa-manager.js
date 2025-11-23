/**
 * PWA Manager
 * Handles service worker registration, updates, and lifecycle
 */

class PWAManager {
    constructor() {
        this.config = window.PWA_CONFIG;
        this.registration = null;
        this.updateAvailable = false;
        this.updateCallbacks = [];
    }

    /**
     * Check if service workers are supported
     */
    isSupported() {
        return 'serviceWorker' in navigator;
    }

    /**
     * Register service worker
     */
    async register() {
        if (!this.isSupported()) {
            console.warn('Service workers not supported');
            return null;
        }

        try {
            const swPath = this.config.SW_PATH;
            // Register with scope - service worker is served with Service-Worker-Allowed header
            // which allows it to control the /user/dashboard/ scope
            this.registration = await navigator.serviceWorker.register(swPath, {
                scope: '/user/dashboard/'
            });

            console.log('Service Worker registered:', this.registration.scope);

            // Listen for updates
            this.setupUpdateListener();

            // Listen for controller changes
            this.setupControllerListener();

            // Listen for service worker messages
            this.setupMessageListener();

            return this.registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            return null;
        }
    }

    /**
     * Setup update listener
     */
    setupUpdateListener() {
        if (!this.registration) return;

        // Check for updates periodically
        setInterval(() => {
            this.registration.update();
        }, 60000); // Check every minute

        // Listen for new service worker
        this.registration.addEventListener('updatefound', () => {
            const newWorker = this.registration.installing;

            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker available
                    this.updateAvailable = true;
                    this.notifyUpdateAvailable();
                }
            });
        });
    }

    /**
     * Setup controller change listener
     */
    setupControllerListener() {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('Service Worker controller changed');
            // Reload page to use new service worker
            window.location.reload();
        });
    }

    /**
     * Setup message listener
     */
    setupMessageListener() {
        navigator.serviceWorker.addEventListener('message', (event) => {
            const { type, data } = event.data;

            switch (type) {
                case 'sw-activated':
                    console.log('Service Worker activated:', data.version);
                    this.showNotification('App updated successfully', 'success');
                    break;

                case 'pwa-sync-started':
                    console.log('Background sync started:', data);
                    this.dispatchEvent('sync-started', data);
                    break;

                case 'pwa-sync-complete':
                    console.log('Background sync complete:', data);
                    this.dispatchEvent('sync-complete', data);
                    if (data.success > 0) {
                        this.showNotification(
                            `Synced ${data.success} item(s) successfully`,
                            'success'
                        );
                    }
                    break;

                case 'pwa-sync-failed':
                    console.error('Background sync failed:', data);
                    this.dispatchEvent('sync-failed', data);
                    break;

                case 'pwa-sync-success':
                    this.dispatchEvent('sync-success', data);
                    break;

                default:
                    console.log('Service Worker message:', type, data);
            }
        });
    }

    /**
     * Notify that update is available
     */
    notifyUpdateAvailable() {
        this.updateCallbacks.forEach(callback => {
            if (typeof callback === 'function') {
                callback();
            }
        });
    }

    /**
     * Register update callback
     */
    onUpdateAvailable(callback) {
        this.updateCallbacks.push(callback);
    }

    /**
     * Skip waiting and activate new service worker
     */
    async skipWaiting() {
        if (!this.registration || !this.registration.waiting) {
            return false;
        }

        // Send message to service worker to skip waiting
        this.registration.waiting.postMessage({ type: 'skip-waiting' });
        return true;
    }

    /**
     * Check for updates
     */
    async checkForUpdates() {
        if (!this.registration) {
            return false;
        }

        try {
            await this.registration.update();
            return true;
        } catch (error) {
            console.error('Failed to check for updates:', error);
            return false;
        }
    }

    /**
     * Get service worker version
     */
    async getVersion() {
        if (!this.registration) {
            return null;
        }

        try {
            const sw = this.registration.active || this.registration.waiting || this.registration.installing;
            if (!sw) return null;

            // Send message to get version
            return new Promise((resolve) => {
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = (event) => {
                    resolve(event.data.version);
                };
                sw.postMessage({ type: 'get-version' }, [messageChannel.port2]);
            });
        } catch (error) {
            console.error('Failed to get version:', error);
            return null;
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Dispatch event for notification system
        window.dispatchEvent(new CustomEvent('showNotification', {
            detail: { message, type }
        }));
    }

    /**
     * Dispatch custom event
     */
    dispatchEvent(eventName, data) {
        window.dispatchEvent(new CustomEvent(`pwa-${eventName}`, {
            detail: data
        }));
    }

    /**
     * Unregister service worker
     */
    async unregister() {
        if (!this.registration) {
            return false;
        }

        try {
            const success = await this.registration.unregister();
            if (success) {
                console.log('Service Worker unregistered');
                this.registration = null;
            }
            return success;
        } catch (error) {
            console.error('Failed to unregister service worker:', error);
            return false;
        }
    }
}

// Create singleton instance
window.PWAManager = PWAManager;
const pwaManager = new PWAManager();

// Auto-register on page load (non-blocking)
// Use requestIdleCallback if available, otherwise setTimeout
const registerSW = () => {
    pwaManager.register().catch(err => {
        console.warn('Service Worker registration failed (non-critical):', err);
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Register after page is interactive
        if ('requestIdleCallback' in window) {
            requestIdleCallback(registerSW, { timeout: 2000 });
        } else {
            setTimeout(registerSW, 100);
        }
    });
} else {
    // Page already loaded, register immediately but non-blocking
    if ('requestIdleCallback' in window) {
        requestIdleCallback(registerSW, { timeout: 2000 });
    } else {
        setTimeout(registerSW, 100);
    }
}

