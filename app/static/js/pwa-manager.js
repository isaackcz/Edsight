// EdSight PWA Manager - Handles offline capabilities and service worker
class PWAManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.serviceWorker = null;
        this.offlineData = [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.registerServiceWorker();
        this.setupOfflineDetection();
        this.setupBackgroundSync();
    }

    setupEventListeners() {
        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.handleOnline();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.handleOffline();
        });

        // Listen for beforeunload to save any pending data
        window.addEventListener('beforeunload', () => {
            this.savePendingData();
        });
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/static/sw.js');
                this.serviceWorker = registration;
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateNotification();
                        }
                    });
                });

                // Handle service worker messages
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleServiceWorkerMessage(event.data);
                });

            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    setupOfflineDetection() {
        // Create offline indicator
        this.createOfflineIndicator();
        
        // Check connection status periodically
        setInterval(() => {
            this.checkConnectionStatus();
        }, 30000); // Check every 30 seconds
    }

    createOfflineIndicator() {
        // Create offline status indicator
        const indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.innerHTML = `
            <div class="offline-status">
                <i class="fas fa-wifi"></i>
                <span>You're offline - data will sync when connected</span>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #offline-indicator {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #fef3c7;
                border-bottom: 1px solid #f59e0b;
                color: #92400e;
                padding: 8px 16px;
                text-align: center;
                font-size: 14px;
                z-index: 9999;
                transform: translateY(-100%);
                transition: transform 0.3s ease;
            }
            
            #offline-indicator.show {
                transform: translateY(0);
            }
            
            .offline-status {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            .offline-status i {
                font-size: 16px;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(indicator);
    }

    setupBackgroundSync() {
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
            // Register background sync for offline form submissions
            navigator.serviceWorker.ready.then((registration) => {
                registration.sync.register('sync-offline-submissions');
            });
        }
    }

    handleOffline() {
        // Show offline indicator
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.classList.add('show');
        }

        // Show offline notification with more helpful message
        this.showNotification('You\'re offline - your data is being saved locally and will sync when you reconnect', 'warning');
        
        // Update any form inputs to show they're in offline mode
        this.updateFormOfflineStatus(true);
    }

    handleOnline() {
        // Hide offline indicator
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.classList.remove('show');
        }

        // Show reconnection notification
        this.showNotification('Connection restored! Syncing offline data...', 'success');
        
        // Update form inputs to show they're back online
        this.updateFormOfflineStatus(false);
        
        // Sync any offline data
        setTimeout(() => {
            this.syncOfflineData();
        }, 1000);
    }

    updateFormOfflineStatus(isOffline) {
        // Add visual indicators to form inputs
        const inputs = document.querySelectorAll('.question-input, .sub-question-input');
        inputs.forEach(input => {
            if (isOffline) {
                input.classList.add('offline-mode');
                input.setAttribute('data-offline', 'true');
            } else {
                input.classList.remove('offline-mode');
                input.removeAttribute('data-offline');
            }
        });
        
        // Update any save buttons or indicators
        const saveButtons = document.querySelectorAll('.btn[data-action="save"]');
        saveButtons.forEach(button => {
            if (isOffline) {
                button.innerHTML = '<i class="fas fa-save"></i> Save Offline';
                button.classList.add('offline');
            } else {
                button.innerHTML = '<i class="fas fa-save"></i> Save';
                button.classList.remove('offline');
            }
        });
    }

    async checkConnectionStatus() {
        try {
            const response = await fetch('/api/dashboard/stats/', {
                method: 'GET',
                cache: 'no-cache'
            });
            
            if (response.ok && !this.isOnline) {
                this.isOnline = true;
                this.handleOnline();
            }
        } catch (error) {
            if (this.isOnline) {
                this.isOnline = false;
                this.handleOffline();
            }
        }
    }

    async syncOfflineData() {
        // Get offline submissions from IndexedDB
        const offlineData = await this.getOfflineData();
        
        if (offlineData.length > 0) {
            this.showNotification(`Syncing ${offlineData.length} offline submissions...`, 'info');
            
            for (const data of offlineData) {
                try {
                    const response = await fetch('/api/form/submit/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    
                    if (response.ok) {
                        await this.removeOfflineData(data.id);

                        // Also remove corresponding entry from localStorage cache if present
                        try {
                            if (window.formDataManager) {
                                const qid = (data.sub_question_id || data.question_id || data.questionId || '').toString();
                                if (qid) {
                                    window.formDataManager.markAsSavedToDatabase(qid);
                                }
                            } else {
                                // Fallback: manipulate localStorage directly
                                const key = 'edsight_form_data';
                                const raw = localStorage.getItem(key);
                                if (raw) {
                                    const json = JSON.parse(raw);
                                    const qid = (data.sub_question_id || data.question_id || data.questionId || '').toString();
                                    if (qid && json[qid]) {
                                        delete json[qid];
                                        localStorage.setItem(key, JSON.stringify(json));
                                    }
                                }
                            }
                        } catch (e) {
                            // Ignore cleanup errors
                        }
                    }
                } catch (error) {
                    console.error('Failed to sync offline data:', error);
                }
            }
            
            this.showNotification('Offline data synced successfully!', 'success');

            // New logic: after offline sync completes successfully, clear all locally saved answers
            try {
                if (window.formDataManager && window.formDataManager.clearAllLocalSavedAnswers) {
                    window.formDataManager.clearAllLocalSavedAnswers();
                }
            } catch (e) {
                // No-op
            }
        }
    }

    async saveOfflineData(data) {
        if (!this.isOnline) {
            try {
                const db = await this.openIndexedDB();
                const id = await db.add('offline_submissions', {
                    ...data,
                    timestamp: Date.now(),
                    synced: false
                });
                
                this.offlineData.push({ id, ...data });
                this.showNotification('Data saved offline', 'info');
                return true;
            } catch (error) {
                console.error('Failed to save offline data:', error);
                return false;
            }
        }
        return false;
    }

    async getOfflineData() {
        try {
            const db = await this.openIndexedDB();
            return await db.getAllFromIndex('offline_submissions', 'synced', false);
        } catch (error) {
            console.error('Failed to get offline data:', error);
            return [];
        }
    }

    async removeOfflineData(id) {
        try {
            const db = await this.openIndexedDB();
            await db.delete('offline_submissions', id);
            
            // Remove from local array
            this.offlineData = this.offlineData.filter(item => item.id !== id);
        } catch (error) {
            console.error('Failed to remove offline data:', error);
        }
    }

    async openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('edsight-offline', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('offline_submissions')) {
                    const store = db.createObjectStore('offline_submissions', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('synced', 'synced', { unique: false });
                }
            };
        });
    }

    savePendingData() {
        // Save any unsaved form data before page unload
        const formInputs = document.querySelectorAll('input[data-question-id], input[data-sub-question-id]');
        const pendingData = [];
        
        formInputs.forEach(input => {
            if (input.value.trim()) {
                pendingData.push({
                    questionId: input.dataset.questionId || input.dataset.subQuestionId,
                    answer: input.value.trim(),
                    timestamp: Date.now()
                });
            }
        });
        
        if (pendingData.length > 0) {
            localStorage.setItem('edsight-pending-data', JSON.stringify(pendingData));
        }
    }

    showUpdateNotification() {
        const notification = document.createElement('div');
        notification.className = 'update-notification';
        notification.innerHTML = `
            <div class="update-content">
                <i class="fas fa-download"></i>
                <span>New version available</span>
                <button onclick="location.reload()">Update Now</button>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .update-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #3b82f6;
                color: white;
                padding: 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                animation: slideIn 0.3s ease;
            }
            
            .update-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .update-content button {
                background: white;
                color: #3b82f6;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 10000);
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `pwa-notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .pwa-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 12px 16px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 8px;
                animation: slideIn 0.3s ease;
                max-width: 300px;
            }
            
            .pwa-notification.success {
                border-color: #10b981;
                color: #065f46;
            }
            
            .pwa-notification.warning {
                border-color: #f59e0b;
                color: #92400e;
            }
            
            .pwa-notification.error {
                border-color: #ef4444;
                color: #991b1b;
            }
            
            .pwa-notification.info {
                border-color: #3b82f6;
                color: #1e40af;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'warning': return 'fa-exclamation-triangle';
            case 'error': return 'fa-exclamation-circle';
            default: return 'fa-info-circle';
        }
    }

    handleServiceWorkerMessage(data) {
        switch (data.type) {
            case 'offline-data-saved':
                this.showNotification('Data saved offline successfully', 'success');
                break;
            case 'sync-completed':
                this.showNotification('Offline data synced successfully', 'success');
                break;
            case 'sync-failed':
                this.showNotification('Failed to sync offline data', 'error');
                break;
        }
    }

    // Public methods for external use
    isOffline() {
        return !this.isOnline;
    }

    async saveFormData(data) {
        // Always used as a fallback (called only when network failed or offline)
        return await this.saveOfflineData(data);
    }
}

// Initialize PWA Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.pwaManager = new PWAManager();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PWAManager;
} 