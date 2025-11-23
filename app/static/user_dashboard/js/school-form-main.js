/**
 * School Form Main Coordinator
 * Initializes and coordinates all form modules
 */

class SchoolFormMain {
    constructor() {
        this.api = null;
        this.offline = null;
        this.tree = null;
        this.questions = null;
        this.remarks = null;
        this.workflowManager = typeof FormWorkflowManager !== 'undefined' ? new FormWorkflowManager() : null;
        this._currentWorkflowBannerStatus = null;
        this.init();
    }

    async init() {
        console.log('Initializing School Form System...');

        // Initialize API client
        this.api = new SchoolFormAPI();

        // Initialize offline manager
        this.offline = new SchoolFormOffline(this.api);

        // Initialize remarks manager
        this.remarks = new SchoolFormRemarks(this.api);

        // Initialize tree view (pass remarks manager for badge updates)
        this.tree = new SchoolFormTree(this.api, (topicId, categoryId) => {
            this.onTopicSelect(topicId, categoryId);
        }, this.remarks);

        // Initialize questions manager
        this.questions = new SchoolFormQuestions(
            this.api,
            this.offline,
            SchoolFormValidation
        );

        // Setup UI event listeners
        this.setupEventListeners();

        // Setup notification listener
        this.setupNotificationListener();

        // Note: Saved answers will be loaded when a topic is selected
        // to avoid unnecessary API calls on page load

        // Check form status and disable/enable inputs accordingly
        await this.checkFormStatus();
        
        // Check deadline and disable form if passed
        this.checkDeadline();

        // Check if we need to show success dialog after reload
        this.checkSubmissionSuccess();

        console.log('School Form System initialized successfully');
    }

    /**
     * Handle topic selection
     */
    async onTopicSelect(topicId, categoryId) {
        console.log(`Topic selected: ${topicId}`);

        // Get topic name from tree
        const topicNode = document.querySelector(`.tree-node-item[data-type="topic"][data-id="${topicId}"]`);
        const topicName = topicNode ? topicNode.querySelector('.tree-node-label').textContent : 'Topic';

        // Load questions for selected topic
        await this.questions.loadQuestions(topicId, topicName);
        
        // Cache questions on-demand for offline use (smart caching)
        // Note: Service worker also caches automatically, but explicit caching ensures it's tracked
        if (window.APICacheHelper && typeof window.APICacheHelper.cacheQuestionsForTopic === 'function') {
            const currentPage = this.questions.currentPage || 1;
            const pageSize = this.questions.pageSize || 50;
            window.APICacheHelper.cacheQuestionsForTopic(topicId, currentPage, pageSize).catch(err => {
                console.debug('Failed to cache questions:', err);
            });
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Save changes button
        const saveBtn = document.getElementById('saveChangesBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                await this.handleSaveChanges();
            });
        }

        // Export form button
        const exportBtn = document.getElementById('exportFormBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                await this.handleExportForm();
            });
        }

        // Submit form button - disabled by default until validation passes
        const submitBtn = document.getElementById('submitFormBtn');
        if (submitBtn) {
            // Start with button disabled
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
            submitBtn.style.cursor = 'not-allowed';
            submitBtn.title = 'Please answer all required questions to enable submission';
            
            submitBtn.addEventListener('click', async () => {
                await this.handleSubmitForm();
            });
        }
        
        // Start validation monitoring
        this.startSubmitButtonValidation();

        // Refresh progress button
        const refreshBtn = document.getElementById('refreshProgressBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.refreshProgress();
            });
        }

        // Listen for offline data synced event
        window.addEventListener('offlineDataSynced', async (e) => {
            // Update status indicators for synced questions
            if (this.questions && e.detail && e.detail.questionIds) {
                e.detail.questionIds.forEach(questionId => {
                    this.questions.updateStatusIndicator(questionId, 'database');
                });
            }
            // Invalidate cached progress
            if (this._cachedProgress) {
                this._cachedProgress = null;
            }
            // Refresh tree to update progress (this will call progress API once)
            await this.tree.refresh();
            // Re-check validation after sync
            this.checkFormValidation();
        });

        // Prevent accidental page close with unsaved changes
        window.addEventListener('beforeunload', (e) => {
            const unsyncedCount = this.offline.getUnsyncedAnswers().length;
            if (unsyncedCount > 0) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        });
    }

    /**
     * Setup notification listener
     */
    setupNotificationListener() {
        window.addEventListener('showNotification', (e) => {
            this.showNotification(e.detail.message, e.detail.type);
        });
        
        // Listen for session expired events
        window.addEventListener('sessionExpired', (e) => {
            const message = e.detail?.message || 'Your session has expired. Please refresh the page.';
            this.showNotification(message, 'error');
            
            // Optionally, show a button to refresh the page
            setTimeout(() => {
                if (confirm('Your session has expired. Would you like to refresh the page now?')) {
                    window.location.reload();
                }
            }, 2000);
        });
    }

    /**
     * Handle save changes button click
     */
    async handleSaveChanges() {
        // Check if deadline has passed
        if (this.isDeadlinePassed()) {
            this.showNotification('Cannot save changes: The submission deadline has passed.', 'error');
            return;
        }
        
        // Wait for any ongoing auto-sync to complete
        if (this.offline.syncInProgress) {
            console.debug('[SAVE] Waiting for auto-sync to complete...');
            // Wait up to 5 seconds for sync to complete
            let waitCount = 0;
            while (this.offline.syncInProgress && waitCount < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                waitCount++;
            }
        }
        
        // Ensure session is ready before manual save
        // Wait progressively for session to be restored (similar to auto-sync)
        if (!navigator.onLine) {
            this.showNotification('You are offline. Answers will be saved locally.', 'warning');
            // Save to offline storage
            if (this.questions && this.questions.changedAnswers && this.questions.changedAnswers.size > 0) {
                await this.questions.saveChanges();
            }
            return;
        }
        
        // Wait for session to be ready (progressive wait like auto-sync)
        let sessionReady = false;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts && !sessionReady) {
            attempts++;
            const waitTime = attempts * 1000; // 1s, 2s, 3s
            console.debug(`[SAVE] Waiting ${waitTime}ms for session (attempt ${attempts}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Check if session cookie is present
            const allCookies = document.cookie.split(';').map(c => c.trim());
            const sessionCookie = allCookies.find(c => c.startsWith('sessionid='));
            if (sessionCookie) {
                console.debug('[SAVE] Session cookie found');
                sessionReady = true;
                break;
            } else {
                // Test if session is valid via API (might be HttpOnly)
                try {
                    const testResponse = await fetch(`${this.offline.api.baseURL}/categories/`, {
                        method: 'GET',
                        credentials: 'same-origin',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    });
                    if (testResponse.ok) {
                        console.debug('[SAVE] Session is valid (HttpOnly cookie)');
                        sessionReady = true;
                        break;
                    }
                } catch (e) {
                    console.debug('[SAVE] Session test failed:', e);
                }
            }
        }
        
        if (!sessionReady) {
            this.showNotification('Session expired. Please refresh the page and log in again.', 'error');
            // Save to offline storage as fallback
            if (this.questions && this.questions.changedAnswers && this.questions.changedAnswers.size > 0) {
                await this.questions.saveChanges();
            }
            return;
        }
        
        // First save any in-memory changes
        if (this.questions && this.questions.changedAnswers && this.questions.changedAnswers.size > 0) {
            await this.questions.saveChanges();
            // Invalidate cached progress after saving
            this._cachedProgress = null;
        }
        
        // Then sync offline data (with session already verified)
        await this.offline.syncOfflineData(false);
        
        // Re-check validation after save
        this.checkFormValidation();
    }

    /**
     * Handle export form button click
     */
    async handleExportForm() {
        try {
            // Get all form data for export
            const exportResponse = await this.api.getFormDataForExport();
            
            if (!exportResponse || !exportResponse.data) {
                throw new Error('No data available for export');
            }
            
            // Create export options dialog
            const exportFormat = await this.showExportFormatDialog();
            
            if (!exportFormat) {
                return; // User cancelled
            }
            
            if (exportFormat === 'excel' || exportFormat === 'csv') {
                await this.exportToExcel(exportResponse);
            } else if (exportFormat === 'pdf') {
                await this.exportToPDF(exportResponse);
            } else if (exportFormat === 'json') {
                await this.exportToJSON(exportResponse);
            }
            
        } catch (error) {
            console.error('Error exporting form:', error);
            this.showNotification('Failed to export form data. Please try again.', 'error');
        }
    }

    /**
     * Show export format selection dialog
     */
    async showExportFormatDialog() {
        // Check if showDialog function is available
        if (typeof showDialog === 'undefined') {
            // Fallback to prompt if dialog is not available
            return new Promise((resolve) => {
                const format = prompt('Select export format:\n1. Excel/CSV\n2. PDF\n3. JSON\n\nEnter 1, 2, or 3:');
                
                if (format === '1') {
                    resolve('excel');
                } else if (format === '2') {
                    resolve('pdf');
                } else if (format === '3') {
                    resolve('json');
                } else {
                    resolve(null);
                }
            });
        }

        // Use modal dialog with custom buttons
        const formatButtons = [
            {
                text: 'Excel/CSV',
                icon: 'ph-bold ph-file-xls',
                action: 'excel',
                class: 'dialog-btn-primary'
            },
            {
                text: 'PDF',
                icon: 'ph-bold ph-file-pdf',
                action: 'pdf',
                class: 'dialog-btn-secondary'
            },
            {
                text: 'JSON',
                icon: 'ph-bold ph-file-json',
                action: 'json',
                class: 'dialog-btn-secondary'
            }
        ];

        // Show dialog and return the selected format
        const result = await showDialog({
            title: 'Export Form Data',
            message: 'Please select the export format:',
            type: 'info',
            buttons: formatButtons
        });

        // The dialog returns the action value when a button is clicked, or false/null when cancelled
        if (result === 'excel' || result === 'pdf' || result === 'json') {
            return result;
        }
        
        return null; // User cancelled
    }

    /**
     * Export form data to Excel/CSV
     * Format: Category, Topic, Question, Answer
     */
    async exportToExcel(exportResponse) {
        try {
            const data = exportResponse.data;
            const schoolName = exportResponse.school_name || 'School';
            const exportDate = new Date().toISOString().split('T')[0];
            
            // Create CSV content
            let csvContent = '\uFEFF'; // BOM for UTF-8 Excel compatibility
            
            // Headers
            csvContent += 'Category,Topic,Question,Answer\n';
            
            // Data rows
            data.forEach(row => {
                // Escape commas and quotes in CSV
                const category = this.escapeCSV(row.category || '');
                const topic = this.escapeCSV(row.topic || '');
                const question = this.escapeCSV(row.question || '');
                const answer = this.escapeCSV(row.answer || '');
                
                csvContent += `${category},${topic},${question},${answer}\n`;
            });
            
            // Create blob and download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${schoolName}-form-data-${exportDate}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('Form data exported to CSV successfully.', 'success');
        } catch (error) {
            console.error('Error exporting to Excel/CSV:', error);
            this.showNotification('Failed to export form data to CSV.', 'error');
        }
    }

    /**
     * Escape CSV values (handle commas, quotes, newlines)
     */
    escapeCSV(value) {
        if (value === null || value === undefined) {
            return '';
        }
        
        const stringValue = String(value);
        
        // If value contains comma, quote, or newline, wrap in quotes and escape quotes
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        return stringValue;
    }

    /**
     * Export form data to PDF
     */
    async exportToPDF(exportResponse) {
        // TODO: Implement PDF export
        this.showNotification('PDF export feature coming soon.', 'info');
    }

    /**
     * Export form data to JSON
     */
    async exportToJSON(exportResponse) {
        try {
            const jsonData = JSON.stringify(exportResponse, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const schoolName = exportResponse.school_name || 'School';
            const exportDate = new Date().toISOString().split('T')[0];
            a.download = `${schoolName}-form-data-${exportDate}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('Form data exported to JSON successfully.', 'success');
        } catch (error) {
            console.error('Error exporting to JSON:', error);
            this.showNotification('Failed to export form data to JSON.', 'error');
        }
    }

    /**
     * Handle cancel submission button click
     */
    async handleCancelSubmission() {
        console.log('handleCancelSubmission called', { _canceling: this._canceling, _modalActive: this._modalActive });
        
        // Prevent double clicks and multiple simultaneous calls
        if (this._canceling || this._modalActive) {
            console.log('Cancel submission already in progress or modal active');
            return;
        }
        
        this._canceling = true;
        
        try {
            // Show confirmation dialog
            console.log('Calling showCancelConfirmation...');
            const confirmed = await this.showCancelConfirmation();
            console.log('showCancelConfirmation returned:', confirmed);
            
            if (!confirmed) {
                this._canceling = false;
                return;
            }
            
            // Show loading
            const loadingDialog = this.showLoadingDialog('Canceling submission...');
            
            try {
                // Cancel submission
                const response = await this.api.cancelSubmission();
                
                if (response.success) {
                    loadingDialog.close();
                    
                    // Enable form immediately
                    this.enableForm('draft');
                    
                    // Restart validation monitoring
                    this.startSubmitButtonValidation();
                    
                    // Show success notification
                    this.showNotification('Form submission canceled. Form reverted to draft status.', 'success');
                    
                    // Refresh page to get updated form status
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    throw new Error(response.error || 'Cancel submission failed');
                }
            } catch (error) {
                console.error('Cancel submission error:', error);
                loadingDialog.close();
                this.showNotification(error.message || 'Failed to cancel submission. Please try again.', 'error');
                this._canceling = false;
            }
        } catch (error) {
            console.error('Error in handleCancelSubmission:', error);
            this.showNotification('An error occurred. Please try again.', 'error');
            this._canceling = false;
        }
    }
    
    /**
     * Show cancel submission confirmation dialog
     */
    showCancelConfirmation() {
        return new Promise((resolve) => {
            console.log('showCancelConfirmation called');
            
            // Remove any existing modal overlays first (but check if they're cancel modals)
            const existingOverlays = document.querySelectorAll('.modal-overlay');
            console.log('Existing overlays:', existingOverlays.length);
            
            // Remove all existing overlays
            existingOverlays.forEach(overlay => {
                overlay.remove();
            });
            
            // Reset modal active flag after removing overlays
            this._modalActive = false;
            
            // Small delay to ensure DOM is updated
            setTimeout(() => {
                // Double-check no overlays exist
                const remainingOverlays = document.querySelectorAll('.modal-overlay');
                if (remainingOverlays.length > 0) {
                    console.warn('Overlays still exist, removing them');
                    remainingOverlays.forEach(overlay => overlay.remove());
                }
                
                // Prevent multiple simultaneous modals
                if (this._modalActive) {
                    console.warn('Modal already active, ignoring duplicate request');
                    resolve(false);
                    return;
                }
                
                console.log('Creating modal...');
                this._modalActive = true;
                this._activeModalType = 'cancel';
            
                const overlay = document.createElement('div');
                overlay.className = 'modal-overlay cancel-submission-modal';
                overlay.id = 'cancel-submission-modal-overlay';
                overlay.setAttribute('data-modal-type', 'cancel');
                overlay.style.cssText = `
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    background: rgba(0, 0, 0, 0.5) !important;
                    display: flex !important;
                    justify-content: center !important;
                    align-items: center !important;
                    z-index: 99999 !important;
                    opacity: 1 !important;
                    visibility: visible !important;
                `;
                
                const modal = document.createElement('div');
                modal.id = 'cancel-submission-modal';
                modal.style.cssText = `
                    background: white !important;
                    padding: 2rem !important;
                    border-radius: 8px !important;
                    max-width: 500px !important;
                    width: 90% !important;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
                    position: relative !important;
                    z-index: 100000 !important;
                    opacity: 1 !important;
                    visibility: visible !important;
                `;
                
                // Prevent clicks inside modal from bubbling to overlay
                modal.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                
                modal.innerHTML = `
                <h3 style="margin-top: 0; color: #d32f2f;">Cancel Submission?</h3>
                <p>Are you sure you want to cancel the form submission?</p>
                <p style="color: #666; font-size: 0.9rem;">The form will be reverted to draft status and you can continue editing it.</p>
                <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
                    <button id="cancelCancelBtn" style="padding: 0.5rem 1.5rem; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">No, Keep Submitted</button>
                    <button id="confirmCancelBtn" style="padding: 0.5rem 1.5rem; border: none; background: #d32f2f; color: white; border-radius: 4px; cursor: pointer;">Yes, Cancel Submission</button>
                </div>
                `;
                
                overlay.appendChild(modal);
                document.body.appendChild(overlay);
                console.log('Modal appended to DOM');
                
                let isCleaningUp = false;
                const cleanup = () => {
                    if (isCleaningUp) return;
                    isCleaningUp = true;
                    
                    // Mark modal as inactive only if this is the active modal
                    if (this._activeModalType === 'cancel') {
                        this._modalActive = false;
                        this._activeModalType = null;
                    }
                
                    // Immediately disable pointer events to prevent any further clicks
                    overlay.style.pointerEvents = 'none';
                    overlay.style.opacity = '0';
                    overlay.style.transition = 'opacity 0.2s ease';
                    
                    // Remove after animation
                    setTimeout(() => {
                        if (overlay.parentNode) {
                            overlay.remove();
                        }
                    }, 200);
                };
                
                const cancelBtn = document.getElementById('cancelCancelBtn');
                const confirmBtn = document.getElementById('confirmCancelBtn');
                
                cancelBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    cleanup();
                    resolve(false);
                });
                
                confirmBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    cleanup();
                    resolve(true);
                });
                
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        cleanup();
                        resolve(false);
                    }
                });
                
                // Close on Escape key
                const escapeHandler = (e) => {
                    if (e.key === 'Escape' && !isCleaningUp && this._activeModalType === 'cancel') {
                        cleanup();
                        resolve(false);
                        document.removeEventListener('keydown', escapeHandler);
                    }
                };
                document.addEventListener('keydown', escapeHandler);
            }, 10); // Small delay to ensure DOM is ready
        });
    }

    /**
     * Handle submit form button click
     */
    async handleSubmitForm() {
        // Check if deadline has passed
        if (this.isDeadlinePassed()) {
            this.showNotification('Cannot submit form: The submission deadline has passed.', 'error');
            return;
        }
        
        // Prevent double submissions
        if (this._submitting) {
            console.log('Form submission already in progress');
            return;
        }
        
        // Double-check that button is not disabled before proceeding
        const submitBtn = document.getElementById('submitFormBtn');
        if (submitBtn && submitBtn.disabled) {
            console.log('Submit button is disabled. Submission prevented.');
            this.showNotification('Please complete all required fields before submitting.', 'warning');
            return;
        }
        
        // Set submitting flag
        this._submitting = true;
        
        try {
            // Get user's district information first
            const districtInfo = await this.api.getUserDistrict();
            const districtName = districtInfo.district_name || 'District Office';
            const schoolName = districtInfo.school_name || 'your school';

            // Show confirmation dialog FIRST
            const confirmed = await this.showSubmitConfirmation(districtName, schoolName);
            
            if (!confirmed) {
                this._submitting = false; // Reset flag on cancel
                return;
            }

            // Show loading dialog
            const loadingDialog = this.showLoadingDialog(districtName);
            
            try {
                // Now save any unsaved changes (silently)
                if (this.questions && this.questions.changedAnswers && this.questions.changedAnswers.size > 0) {
                    await this.questions.saveChanges();
                }
                
                // Sync any offline data (silently, no notifications)
                await this.offline.syncOfflineData(true);

                // Submit form
                const response = await this.api.submitForm();
                
                if (response.success) {
                    // Close loading dialog
                    loadingDialog.close();
                    
                    // Show cancel submission button instead of disabling
                    this.showCancelSubmissionButton();
                    
                    // Disable form inputs but keep cancel button enabled
                    if (this.questions) {
                        this.questions.disableAllInputs();
                    }
                    const saveBtn = document.getElementById('saveChangesBtn');
                    if (saveBtn) {
                        saveBtn.disabled = true;
                        saveBtn.style.opacity = '0.6';
                        saveBtn.style.cursor = 'not-allowed';
                    }
                    
                    // Update workflow banner
                    this.updateWorkflowStatusBanner('district_pending', 'submitted');
                    
                    // Show success notification
                    this.showNotification('Form submitted successfully! You can cancel the submission to continue editing.', 'success');
                } else {
                    throw new Error(response.error || 'Submission failed');
                }
            } catch (error) {
                console.error('Submit error:', error);
                loadingDialog.close();
                this.showNotification(error.message || 'Failed to submit form. Please try again.', 'error');
                this._submitting = false; // Reset flag on error
            }
        } catch (error) {
            console.error('Error in handleSubmitForm:', error);
            this.showNotification('An error occurred. Please try again.', 'error');
            this._submitting = false; // Reset flag on error
        }
    }

    /**
     * Show submit confirmation dialog
     */
    showSubmitConfirmation(districtName, schoolName) {
        return new Promise((resolve) => {
            // Remove any existing modal overlays first (but don't remove cancel modals if they're active)
            const existingOverlays = document.querySelectorAll('.modal-overlay:not(.cancel-submission-modal)');
            existingOverlays.forEach(overlay => {
                overlay.remove();
            });
            
            // If a cancel modal is active, don't show submit confirmation
            const cancelModal = document.querySelector('.cancel-submission-modal');
            if (cancelModal || (this._modalActive && this._activeModalType === 'cancel')) {
                console.warn('Cancel modal is active, ignoring submit confirmation request');
                resolve(false);
                return;
            }
            
            // Also remove any existing modal styles
            const existingStyles = document.querySelectorAll('style[data-modal-style]');
            existingStyles.forEach(style => {
                style.remove();
            });
            
            // Prevent multiple simultaneous modals
            if (this._modalActive) {
                console.warn('Modal already active, ignoring duplicate request');
                resolve(false);
                return;
            }
            
            this._modalActive = true;
            this._activeModalType = 'submit';
            
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                animation: fadeIn 0.2s ease;
            `;

            // Create modal
            const modal = document.createElement('div');
            modal.className = 'submit-confirmation-modal';
            modal.style.cssText = `
                background: white;
                border-radius: 12px;
                padding: 32px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                animation: slideUp 0.3s ease;
                position: relative;
                z-index: 10001;
            `;
            
            // Prevent clicks inside modal from bubbling to overlay
            modal.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            modal.innerHTML = `
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="width: 64px; height: 64px; margin: 0 auto 16px; background: var(--warning-light, #fff3e0); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 32px; color: var(--warning, #ff9800);"></i>
                    </div>
                    <h3 style="margin: 0 0 12px; color: var(--text-heading, #1e293b); font-size: 1.5rem; font-weight: 600;">
                        Confirm Form Submission
                    </h3>
                </div>
                <div style="margin-bottom: 24px; text-align: center;">
                    <p style="margin: 0 0 12px; color: var(--text-body, #334155); font-size: 1rem; line-height: 1.6;">
                        You are about to submit your school form to <strong style="color: var(--primary, #3a6ea5);">${this.escapeHtml(districtName)}</strong> for review.
                    </p>
                    <p style="margin: 0 0 12px; color: var(--text-muted, #64748b); font-size: 0.9rem; line-height: 1.6;">
                        Once submitted, your form will be sent to the district office and cannot be edited further. Please ensure all required questions are answered before confirming.
                    </p>
                    <p style="margin: 0; padding: 12px; background: var(--info-light, #e3f2fd); border-radius: 8px; color: var(--info, #2196f3); font-size: 0.9rem; line-height: 1.6;">
                        <i class="fas fa-info-circle" style="margin-right: 6px;"></i>
                        <strong>Note:</strong> If errors or issues are found during the review process, your form will be returned to you for correction.
                    </p>
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn-cancel" style="
                        padding: 10px 24px;
                        border: 1px solid var(--border-color, #e2e8f0);
                        background: white;
                        color: var(--text-body, #334155);
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        font-weight: 500;
                        transition: all 0.2s ease;
                    ">
                        Cancel
                    </button>
                    <button class="btn-confirm" style="
                        padding: 10px 24px;
                        border: none;
                        background: var(--success, #4caf50);
                        color: white;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        font-weight: 600;
                        transition: all 0.2s ease;
                    ">
                        <i class="fas fa-paper-plane"></i> Confirm Submission
                    </button>
                </div>
            `;

            // Add hover effects and animations
            const style = document.createElement('style');
            style.setAttribute('data-modal-style', 'true');
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .btn-cancel:hover {
                    background: var(--gray-50, #f8fafc);
                    border-color: var(--gray-300, #cbd5e1);
                }
                .btn-confirm:hover {
                    background: #45a049;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(76, 175, 80, 0.3);
                }
            `;
            document.head.appendChild(style);

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Handle button clicks
            const cancelBtn = modal.querySelector('.btn-cancel');
            const confirmBtn = modal.querySelector('.btn-confirm');

            let isCleaningUp = false;
            const cleanup = () => {
                if (isCleaningUp) return;
                isCleaningUp = true;
                
                // Mark modal as inactive
                this._modalActive = false;
                
                // Immediately disable pointer events to prevent any further clicks
                overlay.style.pointerEvents = 'none';
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.2s ease';
                
                // Remove after animation
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.remove();
                    }
                    if (style.parentNode) {
                        style.remove();
                    }
                    // Double-check: remove any remaining overlays
                    const remainingOverlays = document.querySelectorAll('.modal-overlay');
                    remainingOverlays.forEach(ov => {
                        if (ov !== overlay) {
                            ov.remove();
                        }
                    });
                }, 200);
            };

            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                resolve(false);
                cleanup();
            });

            confirmBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                resolve(true);
                cleanup();
            });

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    resolve(false);
                    cleanup();
                }
            });

            // Close on Escape key
            const escapeHandler = (e) => {
                if (e.key === 'Escape' && !isCleaningUp) {
                    resolve(false);
                    cleanup();
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
        });
    }

    /**
     * Show loading dialog during form processing
     */
    showLoadingDialog(districtName) {
        // Remove any existing modals first
        const existingOverlays = document.querySelectorAll('.modal-overlay');
        existingOverlays.forEach(overlay => overlay.remove());
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.2s ease;
        `;

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'loading-modal';
        modal.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 40px;
            max-width: 450px;
            width: 90%;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.3s ease;
            position: relative;
            z-index: 10001;
        `;

        modal.innerHTML = `
            <div style="text-align: center;">
                <div style="width: 80px; height: 80px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
                    <div class="loading-spinner" style="
                        width: 50px;
                        height: 50px;
                        border: 4px solid var(--gray-200, #e2e8f0);
                        border-top-color: var(--primary, #3a6ea5);
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    "></div>
                </div>
                <h3 style="margin: 0 0 12px; color: var(--text-heading, #1e293b); font-size: 1.5rem; font-weight: 600;">
                    Processing Submission
                </h3>
                <p style="margin: 0 0 8px; color: var(--text-body, #334155); font-size: 1rem; line-height: 1.6;">
                    Saving your form and preparing for submission to <strong>${this.escapeHtml(districtName)}</strong>
                </p>
                <p style="margin: 0; color: var(--text-muted, #64748b); font-size: 0.9rem; line-height: 1.6;">
                    Please wait while we process your request...
                </p>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Return close function
        return {
            close: () => {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.2s ease';
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.remove();
                    }
                }, 200);
            }
        };
    }

    /**
     * Show success dialog after successful submission
     */
    showSuccessDialog(districtName) {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.2s ease;
        `;

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'success-modal';
        modal.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 40px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.3s ease;
            position: relative;
            z-index: 10001;
        `;

        modal.innerHTML = `
            <div style="text-align: center;">
                <div style="width: 80px; height: 80px; margin: 0 auto 24px; background: var(--success-light, #e8f5e9); border-radius: 50%; display: flex; align-items: center; justify-content: center; animation: scaleIn 0.3s ease;">
                    <i class="fas fa-check-circle" style="font-size: 48px; color: var(--success, #4caf50);"></i>
                </div>
                <h3 style="margin: 0 0 12px; color: var(--text-heading, #1e293b); font-size: 1.5rem; font-weight: 600;">
                    Form Submitted Successfully!
                </h3>
                <p style="margin: 0 0 16px; color: var(--text-body, #334155); font-size: 1rem; line-height: 1.6;">
                    Your school form has been successfully submitted to <strong style="color: var(--primary, #3a6ea5);">${this.escapeHtml(districtName)}</strong> for review.
                </p>
                <div style="padding: 16px; background: var(--info-light, #e3f2fd); border-radius: 8px; margin-bottom: 24px;">
                    <p style="margin: 0 0 8px; color: var(--info, #2196f3); font-size: 0.9rem; font-weight: 600;">
                        <i class="fas fa-info-circle" style="margin-right: 6px;"></i>
                        What happens next?
                    </p>
                    <ul style="margin: 0; padding-left: 20px; color: var(--text-body, #334155); font-size: 0.9rem; line-height: 1.8; text-align: left;">
                        <li>Your form will be reviewed by the district office</li>
                        <li>You'll be notified if any corrections are needed</li>
                        <li>You can track the status in your dashboard</li>
                    </ul>
                </div>
                <button class="btn-close-success" style="
                    padding: 12px 32px;
                    border: none;
                    background: var(--primary, #3a6ea5);
                    color: white;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 1rem;
                    font-weight: 600;
                    transition: all 0.2s ease;
                ">
                    <i class="fas fa-check"></i> Got it!
                </button>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.setAttribute('data-modal-style', 'true');
        style.textContent = `
            @keyframes scaleIn {
                from { transform: scale(0); }
                to { transform: scale(1); }
            }
            .btn-close-success:hover {
                background: #2d5583;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(58, 110, 165, 0.3);
            }
        `;
        document.head.appendChild(style);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Handle close button
        const closeBtn = modal.querySelector('.btn-close-success');
        const handleClose = () => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.2s ease';
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.remove();
                }
                if (style.parentNode) {
                    style.remove();
                }
            }, 200);
        };

        closeBtn.addEventListener('click', handleClose);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                handleClose();
            }
        });

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                handleClose();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    /**
     * Check if we need to show success dialog after page reload
     */
    checkSubmissionSuccess() {
        const districtName = sessionStorage.getItem('showSubmissionSuccess');
        if (districtName) {
            // Clear the flag
            sessionStorage.removeItem('showSubmissionSuccess');
            
            // Show success dialog after a short delay to ensure page is fully loaded
            setTimeout(() => {
                this.showSuccessDialog(districtName);
            }, 500);
        }
    }

    /**
     * Check form status and disable/enable form accordingly
     */
    async checkFormStatus() {
        try {
            const response = await this.api.getProgress();
            const progress = response.progress || {};
            
            // Use workflow_status for workflow-related decisions (approval level)
            // Use form_status for simple state (draft, submitted, completed)
            const workflowStatus = progress.workflow_status || 'draft';
            const formStatus = progress.form_status || 'draft';
            
            // Check if form is submitted (should be disabled)
            // workflow_status indicates position in approval workflow
            const submittedWorkflowStatuses = [
                'district_pending', 'division_pending', 'region_pending', 
                'central_pending', 'completed'
            ];
            
            // Check if form is returned (should be enabled)
            const returnedWorkflowStatuses = [
                'district_returned', 'division_returned', 
                'region_returned', 'central_returned'
            ];
            
            // Also check form_status - if it's 'submitted' or 'completed', show cancel button
            if (formStatus === 'submitted' && workflowStatus === 'district_pending') {
                // Form is submitted at district pending - show cancel submission button
                this.showCancelSubmissionButton();
            } else if (formStatus === 'submitted' || formStatus === 'completed' || 
                submittedWorkflowStatuses.includes(workflowStatus)) {
                // Form is submitted beyond district pending, disable it
                this.disableForm(workflowStatus);
            } else if (returnedWorkflowStatuses.includes(workflowStatus)) {
                // Form is returned for edits, enable it
                this.enableForm(workflowStatus);
                // Restart validation monitoring if not already running
                if (!this._validationTimer) {
                    this.startSubmitButtonValidation();
                }
            } else {
                // Draft or in-progress, enable form
                this.enableForm(workflowStatus);
                // Restart validation monitoring if not already running
                if (!this._validationTimer) {
                    this.startSubmitButtonValidation();
                }
            }

            this.updateWorkflowStatusBanner(workflowStatus, formStatus);
        } catch (error) {
            console.error('Failed to check form status:', error);
            // On error, assume form should be enabled
            this.enableForm();
        }
    }

    /**
     * Check if deadline has passed
     */
    isDeadlinePassed() {
        return window.formDeadlinePassed === true || 
               (window.formDeadlineInfo && window.formDeadlineInfo.isOverdue === true);
    }
    
    /**
     * Check deadline and disable form if passed
     */
    checkDeadline() {
        if (this.isDeadlinePassed()) {
            this.disableForm('deadline_passed');
        }
    }
    
    /**
     * Show cancel submission button (when form is submitted at district_pending)
     */
    showCancelSubmissionButton() {
        // Disable all question inputs
        if (this.questions) {
            this.questions.disableAllInputs();
        }
        
        // Disable save button
        const saveBtn = document.getElementById('saveChangesBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.6';
            saveBtn.style.cursor = 'not-allowed';
            saveBtn.title = 'Form is submitted. Cancel submission to edit.';
        }
        
        const submitBtn = document.getElementById('submitFormBtn');
        console.log('showCancelSubmissionButton called, submitBtn:', submitBtn);
        if (submitBtn) {
            // Stop any validation timers
            if (this._validationTimer) {
                clearInterval(this._validationTimer);
            }
            if (this._enableTimer) {
                clearTimeout(this._enableTimer);
            }
            if (this._lastEnableTimer) {
                clearTimeout(this._lastEnableTimer);
            }
            if (this._countdownInterval) {
                clearInterval(this._countdownInterval);
            }
            
            // Change button to "Cancel Submission"
            const span = submitBtn.querySelector('span');
            const icon = submitBtn.querySelector('i');
            if (span) {
                span.textContent = 'Cancel Submission';
            }
            if (icon) {
                icon.className = 'ph ph-x-circle';
            }
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
            submitBtn.style.pointerEvents = 'auto';
            submitBtn.title = 'Cancel submission and return form to draft status';
            
            // Remove all existing click handlers
            submitBtn.onclick = null;
            if (this._submitFormHandler) {
                submitBtn.removeEventListener('click', this._submitFormHandler);
            }
            if (this._cancelSubmissionHandler) {
                submitBtn.removeEventListener('click', this._cancelSubmissionHandler);
            }
            
            // Create new handler
            this._cancelSubmissionHandler = (e) => {
                console.log('Cancel submission button clicked', e);
                e.preventDefault();
                e.stopPropagation();
                // Prevent multiple rapid clicks
                if (this._canceling || this._modalActive) {
                    console.log('Prevented duplicate click', { _canceling: this._canceling, _modalActive: this._modalActive });
                    return;
                }
                this.handleCancelSubmission();
            };
            
            // Attach handler
            submitBtn.addEventListener('click', this._cancelSubmissionHandler, { once: false, capture: false });
            console.log('Cancel submission handler attached to button. Button disabled:', submitBtn.disabled, 'Button style:', submitBtn.style.cssText);
        } else {
            console.error('submitFormBtn not found!');
        }
    }

    /**
     * Disable form (inputs, buttons, etc.)
     */
    disableForm(workflowStatus = 'submitted') {
        // Disable all question inputs
        if (this.questions) {
            this.questions.disableAllInputs();
        }
        
        // Disable submit and save buttons
        const submitBtn = document.getElementById('submitFormBtn');
        const saveBtn = document.getElementById('saveChangesBtn');
        
        if (submitBtn) {
            // Stop any validation timers
            if (this._validationTimer) {
                clearInterval(this._validationTimer);
            }
            if (this._enableTimer) {
                clearTimeout(this._enableTimer);
            }
            if (this._lastEnableTimer) {
                clearTimeout(this._lastEnableTimer);
            }
            if (this._countdownInterval) {
                clearInterval(this._countdownInterval);
            }
            
            // If form is submitted (not deadline passed), show "Cancel Submission" button
            if (workflowStatus === 'submitted' || workflowStatus === 'district_pending') {
                // Change button to "Cancel Submission"
                const span = submitBtn.querySelector('span');
                const icon = submitBtn.querySelector('i');
                if (span) {
                    span.textContent = 'Cancel Submission';
                }
                if (icon) {
                    icon.className = 'ph ph-x-circle';
                }
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
                submitBtn.title = 'Cancel submission and return form to draft status';
                // Change click handler to cancel submission (remove old handler first)
                submitBtn.onclick = null;
                if (this._submitFormHandler) {
                    submitBtn.removeEventListener('click', this._submitFormHandler);
                }
                // Store reference for later removal and prevent multiple handlers
                if (this._cancelSubmissionHandler) {
                    submitBtn.removeEventListener('click', this._cancelSubmissionHandler);
                }
                this._cancelSubmissionHandler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Prevent multiple rapid clicks
                    if (this._canceling || this._modalActive) {
                        return;
                    }
                    this.handleCancelSubmission();
                };
                submitBtn.addEventListener('click', this._cancelSubmissionHandler);
            } else {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.6';
                submitBtn.style.cursor = 'not-allowed';
                
                // Set appropriate title based on reason
                if (workflowStatus === 'deadline_passed') {
                    submitBtn.title = 'Form is locked - submission deadline has passed';
                } else {
                    submitBtn.title = 'Form has been submitted and cannot be modified';
                }
            }
        }
        
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.6';
            saveBtn.style.cursor = 'not-allowed';
            
            if (workflowStatus === 'deadline_passed') {
                saveBtn.title = 'Form is locked - submission deadline has passed';
            }
        }
        
        // Only update workflow banner if not deadline-related
        if (workflowStatus !== 'deadline_passed') {
            this.updateWorkflowStatusBanner(workflowStatus);
        }
    }

    /**
     * Enable form (inputs, buttons, etc.)
     */
    enableForm(workflowStatus = 'draft') {
        // Enable all question inputs
        if (this.questions) {
            this.questions.enableAllInputs();
        }
        
        // Enable save button (save button will be enabled/disabled based on changes)
        const saveBtn = document.getElementById('saveChangesBtn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '';
            saveBtn.style.cursor = '';
        }
        
        // Reset submit button to "Submit Form" if it was changed to "Cancel Submission"
        const submitBtn = document.getElementById('submitFormBtn');
        if (submitBtn) {
            const span = submitBtn.querySelector('span');
            const icon = submitBtn.querySelector('i');
                if (span && span.textContent === 'Cancel Submission') {
                span.textContent = 'Submit Form';
                if (icon) {
                    icon.className = 'ph ph-paper-plane-tilt';
                }
                // Restore original click handler (remove old handler first)
                submitBtn.onclick = null;
                if (this._cancelSubmissionHandler) {
                    submitBtn.removeEventListener('click', this._cancelSubmissionHandler);
                }
                if (this._submitFormHandler) {
                    submitBtn.addEventListener('click', this._submitFormHandler);
                }
            }
        }
        
        // Note: Submit button is managed by validation system, don't auto-enable here
        // The validation system will enable it after all required questions are answered + 3s delay
        
        this.updateWorkflowStatusBanner(workflowStatus);
    }

    /**
     * Update workflow status banner according to current status
     */
    updateWorkflowStatusBanner(workflowStatus, formStatus = 'draft') {
        const normalizedStatus = workflowStatus || formStatus || 'draft';
        const config = this.getWorkflowAlertConfig(normalizedStatus);
        
        if (!config) {
            this.removeWorkflowStatusBanner();
            return;
        }
        
        this.renderWorkflowStatusBanner(config, normalizedStatus);
    }
    
    /**
     * Build workflow alert configuration for a status
     */
    getWorkflowAlertConfig(status) {
        if (!status || status === 'draft') {
            return null;
        }
        
        if (status === 'submitted') {
            const levelName = this.getLevelDisplayName('district');
            return {
                background: 'linear-gradient(135deg, #64b5f6 0%, #1976d2 100%)',
                icon: 'fas fa-paper-plane',
                title: 'Form Submitted',
                message: `Your form was submitted successfully and is awaiting ${levelName} review. Editing is locked for now.`
            };
        }
        
        if (status === 'completed') {
            return {
                background: 'linear-gradient(135deg, #7b1fa2 0%, #512da8 100%)',
                icon: 'fas fa-flag-checkered',
                title: 'Form Completed',
                message: 'All approvals are done. This form is archived for reporting and cannot be edited.'
            };
        }
        
        const parts = status.split('_');
        if (parts.length !== 2) {
            return null;
        }
        
        const [level, state] = parts;
        const levelName = this.getLevelDisplayName(level);
        
        const variants = {
            pending: {
                background: 'linear-gradient(135deg, #ffb74d 0%, #fb8c00 100%)',
                icon: 'fas fa-hourglass-half',
                title: `Pending ${levelName} Review`,
                message: `Your form is with the ${levelName} team. Editing is locked until they respond.`
            },
            approved: {
                background: 'linear-gradient(135deg, #81c784 0%, #388e3c 100%)',
                icon: 'fas fa-check-circle',
                title: `${levelName} Approved`,
                message: `${levelName} approved your form. It will move to the next stage automatically.`
            },
            returned: {
                background: 'linear-gradient(135deg, #4fc3f7 0%, #0288d1 100%)',
                icon: 'fas fa-undo-alt',
                title: `Returned by ${levelName}`,
                message: `Please review the remarks from ${levelName} and update the form before resubmitting.`
            }
        };
        
        return variants[state] || null;
    }
    
    /**
     * Get display name for a workflow level
     */
    getLevelDisplayName(level) {
        if (!level) {
            return 'Review Office';
        }
        
        if (this.workflowManager && typeof this.workflowManager.getLevelDisplay === 'function') {
            const name = this.workflowManager.getLevelDisplay(level);
            if (name) {
                return name;
            }
        }
        
        return `${level.charAt(0).toUpperCase()}${level.slice(1)}`;
    }
    
    /**
     * Render workflow status banner
     */
    renderWorkflowStatusBanner(config, statusKey) {
        this.removeWorkflowStatusBanner();
        
        const banner = document.createElement('div');
        banner.id = 'workflowStatusBanner';
        banner.style.cssText = `
            width: 100%;
            background: ${config.background};
            color: white;
            padding: 12px 20px;
            text-align: center;
            font-weight: 500;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            margin-bottom: 20px;
        `;
        banner.innerHTML = `
            <i class="${config.icon}" style="margin-right: 8px;"></i>
            <strong>${config.title}:</strong> ${config.message}
        `;
        
        const pageHeader = document.querySelector('.page-header');
        if (pageHeader && pageHeader.parentNode) {
            pageHeader.parentNode.insertBefore(banner, pageHeader);
        } else {
            const contentContainer = document.querySelector('.content') || document.querySelector('.container-fluid');
            if (contentContainer && contentContainer.parentNode) {
                contentContainer.parentNode.insertBefore(banner, contentContainer);
            } else {
                document.body.insertBefore(banner, document.body.firstChild);
            }
        }
        
        this._currentWorkflowBannerStatus = statusKey;
    }
    
    /**
     * Remove workflow status banner if it exists
     */
    removeWorkflowStatusBanner() {
        const banner = document.getElementById('workflowStatusBanner');
        if (banner) {
            banner.remove();
        }
        this._currentWorkflowBannerStatus = null;
    }

    /**
     * Refresh progress
     */
    async refreshProgress() {
        try {
            // Refresh tree to update progress indicators
            await this.tree.refresh();

            // Show success message
            this.showNotification('Progress refreshed', 'success');
        } catch (error) {
            console.error('Failed to refresh progress:', error);
            this.showNotification('Failed to refresh progress', 'error');
        }
    }

    /**
     * Load saved answers from backend
     */
    async loadSavedAnswers() {
        try {
            const response = await this.api.getSavedAnswers();
            const answers = response.answers || [];

            console.log(`Loaded ${answers.length} saved answers`);

            // Store answers for quick access
            this.savedAnswers = answers.reduce((acc, answer) => {
                acc[answer.question_id] = answer.answer;
                return acc;
            }, {});
        } catch (error) {
            console.error('Failed to load saved answers:', error);
        }
    }

    /**
     * Show dialog (replaces notification system)
     */
    showNotification(message, type = 'info') {
        this.showDialog(message, type);
    }

    /**
     * Show dialog
     */
    showDialog(message, type = 'info', title = null) {
        // Remove any existing dialogs
        const existingOverlays = document.querySelectorAll('.notification-dialog-overlay');
        existingOverlays.forEach(overlay => overlay.remove());
        
        // Determine title and icon based on type
        const config = {
            success: { 
                title: title || 'Success', 
                icon: 'fa-check-circle', 
                color: '#4caf50', 
                bgColor: '#e8f5e9' 
            },
            error: { 
                title: title || 'Error', 
                icon: 'fa-exclamation-circle', 
                color: '#f44336', 
                bgColor: '#ffebee' 
            },
            warning: { 
                title: title || 'Warning', 
                icon: 'fa-exclamation-triangle', 
                color: '#ff9800', 
                bgColor: '#fff3e0' 
            },
            info: { 
                title: title || 'Information', 
                icon: 'fa-info-circle', 
                color: '#2196f3', 
                bgColor: '#e3f2fd' 
            }
        };
        
        const settings = config[type] || config.info;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'notification-dialog-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.2s ease;
        `;
        
        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'notification-dialog';
        dialog.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 32px;
            max-width: 450px;
            width: 90%;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            animation: slideUp 0.3s ease;
            position: relative;
            z-index: 10001;
        `;
        
        dialog.innerHTML = `
            <div style="text-align: center;">
                <div style="width: 64px; height: 64px; margin: 0 auto 16px; background: ${settings.bgColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <i class="fas ${settings.icon}" style="font-size: 32px; color: ${settings.color};"></i>
                </div>
                <h3 style="margin: 0 0 12px; color: #1e293b; font-size: 1.3rem; font-weight: 600;">
                    ${this.escapeHtml(settings.title)}
                </h3>
                <p style="margin: 0 0 24px; color: #334155; font-size: 1rem; line-height: 1.6;">
                    ${this.escapeHtml(message)}
                </p>
                <button class="btn-dialog-ok" style="
                    padding: 12px 32px;
                    border: none;
                    background: ${settings.color};
                    color: white;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 1rem;
                    font-weight: 600;
                    transition: all 0.2s ease;
                ">
                    OK
                </button>
            </div>
        `;

        // Prevent clicks inside dialog from closing it
        dialog.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Handle close
        const closeBtn = dialog.querySelector('.btn-dialog-ok');
        const handleClose = () => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.2s ease';
        setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.remove();
                }
            }, 200);
        };
        
        closeBtn.addEventListener('click', handleClose);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                handleClose();
            }
        });
        
        // Close on Escape
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                handleClose();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    /**
     * Start monitoring form validation and manage submit button state
     * Submit button will be enabled 3 seconds after all required questions are answered
     * Uses event-driven updates instead of polling to reduce server load
     */
    startSubmitButtonValidation() {
        // Clear any existing validation timer
        if (this._validationTimer) {
            clearInterval(this._validationTimer);
            this._validationTimer = null;
        }
        if (this._enableTimer) {
            clearTimeout(this._enableTimer);
        }
        
        // Cache for progress to avoid repeated API calls
        this._cachedProgress = null;
        this._lastProgressCheck = 0;
        this._progressCheckThrottle = 5000; // Only check progress max once per 5 seconds
        
        // Initial validation check
        this.checkFormValidation();
        
        // REMOVED: setInterval polling (was causing excessive API calls)
        // Instead, use event-driven updates only
        
        // Check when answers change (debounced to avoid too many checks)
        let inputTimeout;
        const inputHandler = () => {
            clearTimeout(inputTimeout);
            inputTimeout = setTimeout(() => {
                // Invalidate cached progress when answers change
                this._cachedProgress = null;
                this.checkFormValidation();
            }, 1000); // Wait 1 second after last input
        };
        
        // Remove old listener if exists
        if (this._inputHandler) {
            document.removeEventListener('input', this._inputHandler);
        }
        this._inputHandler = inputHandler;
        document.addEventListener('input', inputHandler, { passive: true });
        
        // Check when questions are loaded
        if (this.questions) {
            // Listen for question updates
            this.questions.onQuestionsLoaded = () => {
                this._cachedProgress = null; // Invalidate cache
                this.checkFormValidation();
            };
        }
        
        // Check when answers are saved (offline sync or manual save)
        const syncHandler = () => {
            this._cachedProgress = null; // Invalidate cache
            this.checkFormValidation();
        };
        
        // Remove old listener if exists
        if (this._syncHandler) {
            window.removeEventListener('offlineDataSynced', this._syncHandler);
        }
        this._syncHandler = syncHandler;
        window.addEventListener('offlineDataSynced', syncHandler);
        
        // Listen for answers saved event (from saveChanges)
        const answersSavedHandler = () => {
            this._cachedProgress = null; // Invalidate cache
            this.checkFormValidation();
        };
        
        // Remove old listener if exists
        if (this._answersSavedHandler) {
            window.removeEventListener('answersSaved', this._answersSavedHandler);
        }
        this._answersSavedHandler = answersSavedHandler;
        window.addEventListener('answersSaved', answersSavedHandler);
    }
    
    /**
     * Check if form validation passes (all required questions answered)
     * Enables submit button 3 seconds after validation passes
     * Uses cached progress and throttling to reduce API calls
     */
    async checkFormValidation() {
        const submitBtn = document.getElementById('submitFormBtn');
        if (!submitBtn) return;
        
        // Don't check if button is already enabled (unless it's in countdown)
        if (submitBtn.disabled === false && !this._countdownInterval) {
            return; // Already enabled and not in countdown, skip check
        }
        
        try {
            // Use cached progress if available and recent (within throttle period)
            const now = Date.now();
            let progress = null;
            
            // Check if we're offline - if so, use cached progress only
            const isOffline = !navigator.onLine;
            
            if (this._cachedProgress && ((now - this._lastProgressCheck) < this._progressCheckThrottle || isOffline)) {
                // Use cached progress (always use cache if offline)
                progress = this._cachedProgress;
            } else if (!isOffline) {
                // Only fetch fresh progress if online
                try {
                    const progressResponse = await this.api.getProgress();
                    progress = progressResponse.progress;
                    
                    // Cache the progress
                    this._cachedProgress = progress;
                    this._lastProgressCheck = now;
                } catch (error) {
                    // If fetch fails, use cached progress if available
                    if (this._cachedProgress) {
                        progress = this._cachedProgress;
                    } else {
                        throw error;
                    }
                }
            } else {
                // Offline and no cache - can't validate
                return;
            }
            
            if (!progress || !progress.required) {
                // Can't determine validation, keep button disabled
                this.setSubmitButtonDisabled(submitBtn, 'Unable to verify form completion');
                return;
            }
            
            const totalRequired = progress.required.total_required || 0;
            const answeredRequired = progress.required.answered_required || 0;
            const isValid = totalRequired > 0 && answeredRequired >= totalRequired;
            
            if (isValid) {
                // All required questions are answered
                // Only start countdown if not already started AND button is disabled
                if (submitBtn.disabled && !this._enableTimer && !this._countdownInterval && !this._lastEnableTimer) {
                    console.log('All required questions answered. Starting 3-second countdown...');
                    
                    // Set flag that countdown is starting
                    this._enableTimer = true;
                    
                    // Start countdown display
                    this.startCountdown(submitBtn, 3);
                    
                    // Set timer for 3 seconds to actually enable the button
                    this._lastEnableTimer = setTimeout(() => {
                        console.log('Countdown complete. Enabling submit button.');
                        this.setSubmitButtonEnabled(submitBtn);
                        // Clear flags
                        this._enableTimer = null;
                        this._lastEnableTimer = null;
                        this._countdownInterval = null;
                    }, 3000);
                } else if (this._enableTimer || this._countdownInterval || this._lastEnableTimer) {
                    // Countdown is already running, just wait for it to complete
                    // Don't restart or interfere
                    return;
                }
                // If button is already enabled, we skip (handled by early return at top)
            } else {
                // Not all required questions answered
                console.log(`Validation failed: ${answeredRequired}/${totalRequired} required questions answered`);
                
                // Clear any pending enable timer
                if (this._lastEnableTimer) {
                    clearTimeout(this._lastEnableTimer);
                    this._lastEnableTimer = null;
                }
                if (this._enableTimer) {
                    this._enableTimer = null;
                }
                
                // Stop countdown if running
                if (this._countdownInterval) {
                    clearInterval(this._countdownInterval);
                    this._countdownInterval = null;
                }
                
                // Disable button
                this.setSubmitButtonDisabled(
                    submitBtn, 
                    `Please answer all required questions (${answeredRequired}/${totalRequired} answered)`
                );
            }
        } catch (error) {
            console.error('Error checking form validation:', error);
            // On error, keep button disabled for safety
            this.setSubmitButtonDisabled(submitBtn, 'Error checking form status');
        }
    }
    
    /**
     * Set submit button to disabled state
     */
    setSubmitButtonDisabled(button, tooltipText) {
        button.disabled = true;
        button.style.opacity = '0.6';
        button.style.cursor = 'not-allowed';
        button.title = tooltipText || 'Please answer all required questions to enable submission';
        
        // Clear any timers when disabling
        if (this._lastEnableTimer) {
            clearTimeout(this._lastEnableTimer);
            this._lastEnableTimer = null;
        }
        if (this._enableTimer) {
            this._enableTimer = null;
        }
        if (this._countdownInterval) {
            clearInterval(this._countdownInterval);
            this._countdownInterval = null;
        }
        
        // Reset button text
        const icon = button.querySelector('i');
        const span = button.querySelector('span');
        if (span) {
            span.textContent = 'Submit Form';
        }
    }
    
    /**
     * Set submit button to enabled state
     */
    setSubmitButtonEnabled(button) {
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        button.title = 'All required questions answered. Ready to submit.';
        
        // Reset button text
        const icon = button.querySelector('i');
        const span = button.querySelector('span');
        if (span) {
            span.textContent = 'Submit Form';
        }
        
        // Stop any countdown
        if (this._countdownInterval) {
            clearInterval(this._countdownInterval);
            this._countdownInterval = null;
        }
        
        // Show brief success indicator
        this.showButtonReadyIndicator(button);
    }
    
    /**
     * Start countdown on submit button (3, 2, 1)
     */
    startCountdown(button, seconds) {
        // Clear any existing countdown
        if (this._countdownInterval) {
            clearInterval(this._countdownInterval);
        }
        
        let remaining = seconds;
        const span = button.querySelector('span');
        const originalText = 'Submit Form';
        
        // Update immediately
        if (span) {
            span.textContent = `Enabling in ${remaining}s...`;
        }
        
        // Start countdown interval
        this._countdownInterval = setInterval(() => {
            remaining--;
            if (remaining > 0 && span) {
                span.textContent = `Enabling in ${remaining}s...`;
                console.log(`Countdown: ${remaining} seconds remaining`);
            } else {
                // Countdown finished - clear interval
                clearInterval(this._countdownInterval);
                this._countdownInterval = null;
                // Note: Button will be enabled by the setTimeout in checkFormValidation
                // Don't change text here, let setSubmitButtonEnabled handle it
            }
        }, 1000);
    }
    
    /**
     * Show brief visual indicator when button becomes ready
     */
    showButtonReadyIndicator(button) {
        // Add a brief animation class
        button.classList.add('submit-ready');
        setTimeout(() => {
            button.classList.remove('submit-ready');
        }, 2000);
    }
}

// Note: Initialization is handled in form.html template



