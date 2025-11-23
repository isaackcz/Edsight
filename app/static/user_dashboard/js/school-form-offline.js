/**
 * School Form Offline Manager
 * Handles offline storage, sync, and network detection
 */

class SchoolFormOffline {
    constructor(api) {
        this.api = api;
        this.storageKey = 'school_form_offline_answers';
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.queueManager = null;
        this.queueCount = 0;
        this.setupNetworkListeners();
        this.setupPWAIntegration();
    }

    /**
     * Setup network status listeners
     */
    setupNetworkListeners() {
        window.addEventListener('online', async () => {
            this.isOnline = true;
            this.updateOnlineIndicator(true);
            
            // Wait longer to ensure connection is stable and session is ready
            // This gives the browser time to restore cookies and session
            // Try multiple times with increasing delays to catch session restoration
            let sessionRestored = false;
            let attempts = 0;
            const maxAttempts = 3;
            
            while (attempts < maxAttempts && !sessionRestored) {
                attempts++;
                const waitTime = attempts * 1000; // 1s, 2s, 3s
                console.debug(`[SYNC] Waiting ${waitTime}ms for session restoration (attempt ${attempts}/${maxAttempts})...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
                // Check if connection is still online
                if (!navigator.onLine) {
                    console.debug('[SYNC] Connection dropped, aborting');
                    return; // Connection dropped again
                }
                
                // Check if session cookie is now present
                const allCookies = document.cookie.split(';').map(c => c.trim());
                const sessionCookie = allCookies.find(c => c.startsWith('sessionid='));
                if (sessionCookie) {
                    console.debug('[SYNC] Session cookie found after wait');
                    sessionRestored = true;
                    break;
                } else {
                    console.debug(`[SYNC] Session cookie still missing after ${waitTime}ms`);
                }
            }
            
            // Automatically sync offline data when connection is restored
            const unsyncedCount = this.getUnsyncedAnswers().length;
            if (unsyncedCount > 0) {
                if (sessionRestored) {
                    this.showNotification('Connection restored. Syncing offline data...', 'info');
                } else {
                    this.showNotification('Connection restored, but session expired. Please refresh to sync.', 'warning');
                }
                // Automatically sync (not silent - we want to show success/error notifications)
                await this.syncOfflineData(false);
            } else {
                // Also check for queued items from service worker
                if (this.queueCount > 0) {
                    this.showNotification('Connection restored. Queued items will sync automatically.', 'info');
                } else {
                    this.showOnlineNotification();
                }
            }
            
            // Trigger background sync for service worker queue if available
            this.triggerBackgroundSync();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showOfflineNotification();
            this.updateOnlineIndicator(false);
        });

        // Initial state
        this.updateOnlineIndicator(this.isOnline);
    }

    /**
     * Setup PWA integration (queue manager and sync events)
     */
    setupPWAIntegration() {
        // Initialize queue manager if available
        if (typeof QueueManager !== 'undefined') {
            this.queueManager = new QueueManager();
            
            // Start monitoring queue count
            this.queueManager.startQueueMonitoring((count) => {
                this.queueCount = count;
                this.updateOfflineCount();
                this.updateOnlineIndicator(this.isOnline);
            });

            // Listen for sync events
            window.addEventListener('pwa-sync-started', () => {
                this.syncInProgress = true;
                this.updateSyncButton(true);
            });

            window.addEventListener('pwa-sync-complete', (e) => {
                this.syncInProgress = false;
                this.updateSyncButton(false);
                
                const { detail } = e;
                if (detail.success > 0) {
                    // Mark synced items in localStorage
                    this.markSyncedFromQueue();
                }
            });

            window.addEventListener('pwa-sync-success', (e) => {
                // Individual item synced successfully
                this.markSyncedFromQueue();
            });
        }
    }

    /**
     * Trigger background sync
     */
    async triggerBackgroundSync() {
        if (this.queueManager && this.isOnline) {
            try {
                await this.queueManager.registerSync();
            } catch (error) {
                console.log('Background sync not available:', error);
            }
        }
    }

    /**
     * Mark items as synced from queue (when background sync succeeds)
     */
    markSyncedFromQueue() {
        // This will be called when background sync completes
        // The service worker handles the actual sync, we just update UI
        this.updateOfflineCount();
    }

    /**
     * Generate UUID for answer
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Save answer to offline storage
     */
    saveOffline(questionId, answer) {
        const offlineData = this.getOfflineData();
        
        // Check if answer already exists
        const existingIndex = offlineData.findIndex(item => item.question_id === questionId);
        
        const answerData = {
            uuid: this.generateUUID(),
            question_id: questionId,
            answer: answer,
            timestamp: Date.now(),
            synced: false,
        };

        if (existingIndex >= 0) {
            // Update existing
            offlineData[existingIndex] = answerData;
        } else {
            // Add new
            offlineData.push(answerData);
        }

        localStorage.setItem(this.storageKey, JSON.stringify(offlineData));
        this.updateOfflineCount();
    }

    /**
     * Get offline data from localStorage
     */
    getOfflineData() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error reading offline data:', error);
            return [];
        }
    }

    /**
     * Get unsynced answers
     */
    getUnsyncedAnswers() {
        const offlineData = this.getOfflineData();
        return offlineData.filter(item => !item.synced);
    }

    /**
     * Sync offline data to server
     */
    async syncOfflineData(silent = false) {
        console.debug('[SYNC] syncOfflineData called', { silent, syncInProgress: this.syncInProgress });
        
        if (this.syncInProgress) {
            console.log('[SYNC] Sync already in progress, skipping');
            return;
        }

        const unsyncedAnswers = this.getUnsyncedAnswers();
        console.debug('[SYNC] Unsynced answers count:', unsyncedAnswers.length);
        
        if (unsyncedAnswers.length === 0) {
            console.debug('[SYNC] No offline data to sync');
            if (!silent) {
                this.showNotification('No offline data to sync', 'info');
            }
            return;
        }

        this.syncInProgress = true;
        this.updateSyncButton(true);

        try {
            // Check if session is still valid before syncing
            // Wait a bit longer after coming online to ensure session is ready
            console.debug('[SYNC] Waiting 500ms before session check...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check for session cookie
            const allCookies = document.cookie.split(';').map(c => c.trim());
            const sessionCookie = allCookies.find(c => c.startsWith('sessionid='));
            const csrfCookie = allCookies.find(c => c.startsWith('csrftoken='));
            
            console.debug('[SYNC] Checking session validity...', {
                isOnline: navigator.onLine,
                hasSessionCookie: !!sessionCookie,
                sessionCookieLength: sessionCookie ? sessionCookie.length : 0,
                hasCsrfCookie: !!csrfCookie,
                allCookieNames: allCookies.map(c => c.split('=')[0]),
                timestamp: new Date().toISOString()
            });
            
            // If no session cookie visible, try to verify session by making a test request
            // (Session cookies might be HttpOnly and not visible to JavaScript, but still sent with requests)
            if (!sessionCookie) {
                console.warn('[SYNC] No session cookie visible in JavaScript - checking if session is valid via API...');
                
                // Make a lightweight test request to verify if session is actually valid
                // Even if cookie is HttpOnly, it will be sent with the request
                try {
                    const testResponse = await fetch(`${this.api.baseURL}/categories/`, {
                        method: 'GET',
                        credentials: 'same-origin',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    });
                    
                    if (testResponse.status === 401 || testResponse.status === 403) {
                        // Session is definitely invalid
                        console.error('[SYNC] Session verified as invalid via API test', {
                            status: testResponse.status,
                            allCookies: allCookies.map(c => c.split('=')[0]),
                            timestamp: new Date().toISOString()
                        });
                        
                        // Ensure all answers are saved to offline storage
                        unsyncedAnswers.forEach(({ question_id, answer }) => {
                            if (answer) {
                                this.saveOffline(question_id, answer);
                            }
                        });
                        
                        // Create error with proper flag
                        const sessionError = new Error('Session expired. Please refresh the page and log in again.');
                        sessionError.isAuthError = true;
                        sessionError.isSessionExpired = true;
                        throw sessionError;
                    } else if (testResponse.ok) {
                        // Session is valid even though cookie not visible (HttpOnly)
                        console.debug('[SYNC] Session is valid (HttpOnly cookie not visible to JS)');
                        // Continue with sync
                    } else {
                        // Unexpected response - proceed with caution
                        console.warn('[SYNC] Unexpected test response status:', testResponse.status);
                    }
                } catch (testError) {
                    console.error('[SYNC] Session test request failed:', testError);
                    // If test request fails, assume session is invalid
                    unsyncedAnswers.forEach(({ question_id, answer }) => {
                        if (answer) {
                            this.saveOffline(question_id, answer);
                        }
                    });
                    
                    const sessionError = new Error('Session expired. Please refresh the page and log in again.');
                    sessionError.isAuthError = true;
                    sessionError.isSessionExpired = true;
                    throw sessionError;
                }
            }
            
            const sessionValid = await this.api.checkSession();
            console.debug('[SYNC] Session check result:', sessionValid);
            
            if (!sessionValid) {
                console.error('[SYNC] Session invalid - saving answers back to offline storage', {
                    unsyncedCount: unsyncedAnswers.length,
                    cookies: document.cookie
                });
                
                // Session expired - save answers back to offline storage
                unsyncedAnswers.forEach(({ question_id, answer }) => {
                    if (answer) {
                        this.saveOffline(question_id, answer);
                    }
                });
                throw new Error('Session expired. Please refresh the page and log in again.');
            }

            console.debug('[SYNC] Session valid, proceeding with save', {
                answersToSync: unsyncedAnswers.length,
                answerIds: unsyncedAnswers.map(a => a.question_id)
            });

            // Refresh CSRF token one more time before saving
            // The API client will refresh it automatically in the request method

            const response = await this.api.saveAnswers(unsyncedAnswers, true);
            console.debug('[SYNC] Save response received:', {
                success: response.success,
                syncedCount: response.synced_count,
                responseKeys: Object.keys(response)
            });

            if (response.success) {
                console.debug('[SYNC] Marking answers as synced...');
                
                // Mark as synced
                const offlineData = this.getOfflineData();
                const syncedUUIDs = new Set(unsyncedAnswers.map(a => a.uuid));
                
                offlineData.forEach(item => {
                    if (syncedUUIDs.has(item.uuid)) {
                        item.synced = true;
                    }
                });

                localStorage.setItem(this.storageKey, JSON.stringify(offlineData));
                console.debug('[SYNC] Synced answers saved to localStorage');

                // Clean up synced items after a delay
                setTimeout(() => this.cleanupSyncedData(), 1000);

                if (!silent) {
                    this.showNotification(
                        `Successfully synced ${response.synced_count} answer(s)`,
                        'success'
                    );
                }

                this.updateOfflineCount();

                // Dispatch event for other components with synced question IDs
                const syncedQuestionIds = unsyncedAnswers.map(a => a.question_id);
                window.dispatchEvent(new CustomEvent('offlineDataSynced', {
                    detail: { 
                        count: response.synced_count,
                        questionIds: syncedQuestionIds
                    }
                }));
                
                console.debug('[SYNC] Sync completed successfully');
            } else {
                console.warn('[SYNC] Save response indicates failure:', response);
            }
        } catch (error) {
            console.error('[SYNC] Sync failed with error:', {
                error: error.message,
                isAuthError: error.isAuthError,
                status: error.status,
                details: error.details,
                stack: error.stack,
                cookies: document.cookie,
                isOnline: navigator.onLine,
                timestamp: new Date().toISOString()
            });
            
            // Check if it's an authentication error
            if (error.isAuthError || error.isSessionExpired || error.message.includes('Session expired') || 
                error.message.includes('Authentication')) {
                console.error('[SYNC] Authentication error detected - session may have ended', {
                    errorMessage: error.message,
                    errorDetails: error.details,
                    isSessionExpired: error.isSessionExpired,
                    cookies: document.cookie
                });
                
                // Check if session cookie is missing
                const allCookies = document.cookie.split(';').map(c => c.trim());
                const sessionCookie = allCookies.find(c => c.startsWith('sessionid='));
                const hasSession = !!sessionCookie;
                
                if (!hasSession || error.isSessionExpired) {
                    // Session definitely expired - show clear message and auto-prompt to refresh
                    this.showNotification(
                        'Your session has expired. Your data is safe and will sync after you refresh and log in.',
                        'error'
                    );
                    
                    // Auto-prompt to refresh after 3 seconds
                    setTimeout(() => {
                        const shouldRefresh = confirm(
                            'Your session has expired. All your offline data is safely saved.\n\n' +
                            'Would you like to refresh the page now to log in and sync your data?'
                        );
                        if (shouldRefresh) {
                            window.location.reload();
                        }
                    }, 3000);
                } else {
                    // Other authentication error
                    this.showNotification(
                        'Authentication failed. Please refresh the page and log in again to sync your data.',
                        'error'
                    );
                }
                
                // Dispatch event to notify other components
                window.dispatchEvent(new CustomEvent('sessionExpired', {
                    detail: { 
                        message: error.message,
                        details: error.details,
                        isSessionExpired: error.isSessionExpired || !hasSession,
                        timestamp: new Date().toISOString()
                    }
                }));
            } else {
                console.error('[SYNC] Non-authentication error:', error);
                this.showNotification('Sync failed. Will retry later.', 'error');
            }
        } finally {
            console.debug('[SYNC] Sync process finished, resetting flags');
            this.syncInProgress = false;
            this.updateSyncButton(false);
        }
    }

    /**
     * Clean up synced data from localStorage
     */
    cleanupSyncedData() {
        const offlineData = this.getOfflineData();
        const unsyncedData = offlineData.filter(item => !item.synced);
        localStorage.setItem(this.storageKey, JSON.stringify(unsyncedData));
        this.updateOfflineCount();
    }

    /**
     * Update offline indicator in UI
     */
    updateOnlineIndicator(isOnline) {
        const indicator = document.getElementById('offlineIndicator');
        if (!indicator) return;

        if (isOnline) {
            // Show sync status if there are queued items
            if (this.queueCount > 0) {
                indicator.innerHTML = `<i class="fas fa-sync-alt fa-spin"></i> Syncing ${this.queueCount}`;
                indicator.className = 'offline-indicator syncing';
                indicator.style.display = 'flex';
            } else {
                indicator.innerHTML = '<i class="fas fa-wifi"></i> Online';
                indicator.className = 'offline-indicator online';
                indicator.style.display = 'none';
            }
        } else {
            const queuedText = this.queueCount > 0 ? ` (${this.queueCount} queued)` : '';
            indicator.innerHTML = `<i class="fas fa-wifi-slash"></i> Offline${queuedText}`;
            indicator.className = 'offline-indicator offline';
            indicator.style.display = 'flex';
        }
    }

    /**
     * Update offline count badge
     * @param {number} unsavedChangesCount - Optional count of unsaved changes in memory
     */
    updateOfflineCount(unsavedChangesCount = 0) {
        const unsyncedCount = this.getUnsyncedAnswers().length;
        // Include queued items from service worker (updated by queue monitoring, not fetched here)
        const queuedCount = this.queueCount || 0;
        const totalUnsavedCount = unsyncedCount + unsavedChangesCount + queuedCount;
        const badge = document.getElementById('offlineBadge');
        const saveBtn = document.getElementById('saveChangesBtn');

        if (badge) {
            if (totalUnsavedCount > 0) {
                badge.textContent = totalUnsavedCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }

        if (saveBtn) {
            if (totalUnsavedCount > 0) {
                saveBtn.textContent = `Save ${totalUnsavedCount} Change${totalUnsavedCount !== 1 ? 's' : ''}`;
                saveBtn.disabled = false;
            } else {
                saveBtn.textContent = 'All Changes Saved';
                saveBtn.disabled = true;
            }
        }
    }

    /**
     * Update sync button state
     */
    updateSyncButton(syncing) {
        const saveBtn = document.getElementById('saveChangesBtn');
        if (!saveBtn) return;

        if (syncing) {
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
            saveBtn.disabled = true;
        } else {
            this.updateOfflineCount();
        }
    }

    /**
     * Prompt user to sync when back online (deprecated - now auto-syncs)
     * Kept for backward compatibility but no longer used
     */
    promptSync() {
        // This method is deprecated - sync now happens automatically
        // Keeping for backward compatibility
        const unsyncedCount = this.getUnsyncedAnswers().length;
        const queuedCount = this.queueCount || 0;
        const totalCount = unsyncedCount + queuedCount;
        
        if (totalCount > 0 && queuedCount > 0 && this.queueManager) {
            // Background sync will handle queued items automatically
            this.showNotification(
                `Connection restored. ${queuedCount} item(s) will sync automatically.`,
                'info'
            );
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

        // Also log to console
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    /**
     * Show online notification
     */
    showOnlineNotification() {
        this.showNotification('Connection restored', 'success');
    }

    /**
     * Show offline notification
     */
    showOfflineNotification() {
        this.showNotification('You are offline. Answers will be saved locally.', 'warning');
    }

    /**
     * Clear all offline data (for testing/debugging)
     */
    clearOfflineData() {
        localStorage.removeItem(this.storageKey);
        this.updateOfflineCount();
        this.showNotification('Offline data cleared', 'info');
    }
}

// Export for use in other modules
window.SchoolFormOffline = SchoolFormOffline;

