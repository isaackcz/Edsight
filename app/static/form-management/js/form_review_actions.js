/**
 * Form Review Actions Manager
 * Handles approve and return actions with confirmation modals
 */

class FormReviewActions {
    constructor(formId, formReviewMain) {
        this.formId = formId;
        this.formReviewMain = formReviewMain;
        this.workflowManager = new FormWorkflowManager();
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const approveBtn = document.getElementById('approveFormBtn');
        const returnBtn = document.getElementById('returnFormBtn');
        const clearRemarksBtn = document.getElementById('clearRemarksBtn');
        
        const workflowStatus = this.formReviewMain?.formData?.workflow_status;
        const isCompleted = workflowStatus === 'completed';
        const isCurrentUserCentral = window.currentAdminLevel === 'central';
        const isReadOnly = isCurrentUserCentral && isCompleted;
        
        if (approveBtn) {
            if (isReadOnly) {
                approveBtn.disabled = true;
                approveBtn.classList.add('btn-disabled');
            } else {
                approveBtn.addEventListener('click', () => this.handleApprove());
            }
        }
        
        if (returnBtn) {
            if (isReadOnly) {
                returnBtn.disabled = true;
                returnBtn.classList.add('btn-disabled');
            } else {
                returnBtn.addEventListener('click', () => this.handleReturn());
            }
        }

        if (clearRemarksBtn) {
            this.clearRemarksButton = clearRemarksBtn;
            if (isReadOnly) {
                clearRemarksBtn.disabled = true;
                clearRemarksBtn.classList.add('btn-disabled');
                clearRemarksBtn.style.display = 'none';
            } else {
                clearRemarksBtn.addEventListener('click', () => this.handleClearRemarks());
                this.toggleClearRemarksButton(this.clearRemarksButton);
                this._remarksChangedHandler = (event) => {
                    const hasRemarks = event?.detail?.hasRemarks;
                    this.toggleClearRemarksButton(this.clearRemarksButton, hasRemarks);
                };
                window.addEventListener('formRemarksChanged', this._remarksChangedHandler);
            }
        }
    }
    
    async handleApprove() {
        try {
            const formData = this.formReviewMain.formData;
            if (!formData) {
                this.formReviewMain.showError('Form data not loaded');
                return;
            }

            let clearedRemarksEarly = false;
            if (await this.hasBlockingRemarks()) {
                const confirmed = await this.showAlertDialog(
                    'Remarks Detected',
                    `<p style="margin: 0; color: #475569; font-size: 0.95rem;">
                        This form still has remarks. To approve it, all remarks from your admin level must be cleared first.
                    </p>`,
                    'Clear Remarks & Continue'
                );
                if (!confirmed) {
                    return;
                }
                await this.clearAllRemarks();
                clearedRemarksEarly = true;
            }
            
            // Get current level and transition info
            const currentLevel = this.workflowManager.getCurrentLevelFromStatus(formData.workflow_status);
            const transition = this.workflowManager.getApproveTransition(currentLevel);
            
            if (!transition) {
                this.formReviewMain.showError('Cannot determine approval workflow');
                return;
            }
            
            // Build confirmation message
            const message = `
                <div style="text-align: left; margin-bottom: 16px;">
                    <p style="margin: 0 0 12px; color: #334155; font-size: 1rem; line-height: 1.6;">
                        You are about to approve the form from <strong style="color: #3a6ea5;">${this.escapeHtml(formData.school.school_name)}</strong>.
                    </p>
                    <div style="padding: 12px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; margin-bottom: 12px;">
                        <p style="margin: 0; color: #1e40af; font-size: 0.9rem; font-weight: 500;">
                            <i class="fas fa-arrow-right" style="margin-right: 6px;"></i>
                            ${this.workflowManager.getLevelDisplay(currentLevel)} → ${this.workflowManager.getLevelDisplay(transition.toLevel)}
                        </p>
                        <p style="margin: 8px 0 0; color: #1e40af; font-size: 0.875rem;">
                            ${transition.description}
                        </p>
                    </div>
                    <div style="padding: 10px 12px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin-bottom: 12px;">
                        <p style="margin: 0; color: #92400e; font-size: 0.875rem;">
                            <i class="fas fa-info-circle" style="margin-right: 6px;"></i>
                            Note: All remarks for this form will be cleared upon approval.
                        </p>
                    </div>
                    <p style="margin: 0; color: #64748b; font-size: 0.875rem;">
                        <i class="fas fa-circle-info" style="margin-right: 6px;"></i>
                        Current Status: <strong>${this.workflowManager.getStatusDisplay(formData.workflow_status)}</strong>
                    </p>
                </div>
            `;
            
            // Show confirmation dialog
            const confirmed = await this.showConfirmDialog(
                'Approve Form',
                message,
                'Approve & Forward',
                'Cancel'
            );
            
            if (!confirmed) return;
            
            // Clear remarks first, then approve
            if (!clearedRemarksEarly) {
                await this.clearAllRemarks();
            }
            await this.approveForm();
            
        } catch (error) {
            console.error('Failed to approve form:', error);
            this.formReviewMain.showError('Failed to approve form');
        }
    }
    
    async hasBlockingRemarks() {
        if (window.formReviewRemarksApp && typeof window.formReviewRemarksApp.hasAnyRemarks === 'function') {
            if (window.formReviewRemarksApp.hasAnyRemarks()) {
                return true;
            }
        }
        
        try {
            const response = await fetch(`/api/form-management/forms/${this.formId}/remarks/`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            if (!data.success) {
                return false;
            }
            return this.hasRemarksInData(data.remarks);
        } catch (error) {
            console.error('Failed to verify remarks before approval:', error);
            this.formReviewMain.showError('Could not verify remarks status. Please try again.');
            return true;
        }
    }
    
    hasRemarksInData(remarks) {
        if (!remarks) return false;
        return Object.values(remarks).some(group => {
            if (!group) return false;
            return Object.values(group).some(list => Array.isArray(list) && list.length > 0);
        });
    }
    
    async clearAllRemarks() {
        try {
            const response = await fetch(`/api/form-management/forms/${this.formId}/remarks/clear/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({ scope: 'current_admin_level' })
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to clear remarks');
            }
            // If remarks manager is present, clear local cache/badges for immediate UI consistency
            if (window.formReviewRemarksApp) {
                window.formReviewRemarksApp.remarks = { category: {}, topic: {}, question: {} };
                if (typeof window.formReviewRemarksApp.updateAllBadges === 'function') {
                    window.formReviewRemarksApp.updateAllBadges();
                }
                if (typeof window.formReviewRemarksApp.emitRemarksChanged === 'function') {
                    window.formReviewRemarksApp.emitRemarksChanged();
                }
            }
            this.toggleClearRemarksButton(this.clearRemarksButton, false);
        } catch (error) {
            console.error('Failed to clear remarks before approval:', error);
            throw error;
        }
    }

    toggleClearRemarksButton(buttonEl, hasRemarksOverride) {
        if (!buttonEl) return;
        let hasRemarks;
        if (typeof hasRemarksOverride === 'boolean') {
            hasRemarks = hasRemarksOverride;
        } else if (window.formReviewRemarksApp && typeof window.formReviewRemarksApp.hasAnyRemarks === 'function') {
            hasRemarks = window.formReviewRemarksApp.hasAnyRemarks();
        } else {
            hasRemarks = false;
        }
        buttonEl.style.display = hasRemarks ? 'flex' : 'none';
    }
    
    async handleReturn() {
        try {
            const formData = this.formReviewMain.formData;
            if (!formData) {
                this.formReviewMain.showError('Form data not loaded');
                return;
            }
            
            // Get current level and transition info
            const currentLevel = this.workflowManager.getCurrentLevelFromStatus(formData.workflow_status);
            const transition = this.workflowManager.getReturnTransition(currentLevel);
            
            if (!transition) {
                this.formReviewMain.showError('Cannot return form from this level');
                return;
            }
            
            if (window.formReviewRemarksApp && typeof window.formReviewRemarksApp.hasAnyRemarks === 'function') {
                if (!window.formReviewRemarksApp.hasAnyRemarks()) {
                    await this.showAlertDialog(
                        'Cannot Return Form',
                        `<p style="margin: 0; color: #475569; font-size: 0.95rem;">
                            You must add at least one remark before returning the form so the school knows what to address.
                        </p>`,
                        'Close'
                    );
                    return;
                }
            } else {
                try {
                    const remarksCheck = await fetch(`/api/form-management/forms/${this.formId}/remarks/`);
                    const remarksData = await remarksCheck.json();
                    if (!remarksData.success || !this.hasRemarksInData(remarksData.remarks)) {
                        await this.showAlertDialog(
                            'Cannot Return Form',
                            `<p style="margin: 0; color: #475569; font-size: 0.95rem;">
                                You must add at least one remark before returning the form so the school knows what to address.
                            </p>`,
                            'Close'
                        );
                        return;
                    }
                } catch (error) {
                    console.error('Failed to verify remarks before returning form:', error);
                    this.formReviewMain.showError('Could not verify remarks status. Please try again.');
                    return;
                }
            }

            // Build confirmation message
            const message = `
                <div style="text-align: left; margin-bottom: 16px;">
                    <p style="margin: 0 0 12px; color: #334155; font-size: 1rem; line-height: 1.6;">
                        You are about to return the form from <strong style="color: #3a6ea5;">${this.escapeHtml(formData.school.school_name)}</strong>.
                    </p>
                    <div style="padding: 12px; background: #fff3e0; border-left: 4px solid #ff9800; border-radius: 4px; margin-bottom: 12px;">
                        <p style="margin: 0; color: #e65100; font-size: 0.9rem; font-weight: 500;">
                        <i class="fas fa-rotate-left" style="margin-right: 6px;"></i>
                            ${this.workflowManager.getLevelDisplay(currentLevel)} → ${this.workflowManager.getLevelDisplay(transition.toLevel)}
                        </p>
                        <p style="margin: 8px 0 0; color: #e65100; font-size: 0.875rem;">
                            ${transition.description}
                        </p>
                    </div>
                    <p style="margin: 0; color: #64748b; font-size: 0.875rem;">
                        <i class="fas fa-circle-info" style="margin-right: 6px;"></i>
                        Current Status: <strong>${this.workflowManager.getStatusDisplay(formData.workflow_status)}</strong>
                    </p>
                </div>
            `;
            
            // Show return dialog with comments
            const comments = await this.showReturnDialog(
                'Return Form',
                message,
                'Return Form',
                'Cancel'
            );
            
            if (comments === null) return; // User cancelled
            
            // Make return API call
            await this.returnForm(comments);
            
        } catch (error) {
            console.error('Failed to return form:', error);
            this.formReviewMain.showError('Failed to return form');
        }
    }
    
    async approveForm() {
        try {
            const response = await fetch(`/api/admin/form-management/forms/${this.formId}/approve/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({ comments: '' })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to approve form');
            }
            
            this.formReviewMain.showSuccess('Form approved successfully');
            
            // Redirect back to form management after a short delay
            setTimeout(() => {
                window.location.href = '/form-management/';
            }, 2000);
            
        } catch (error) {
            console.error('Failed to approve form:', error);
            throw error;
        }
    }
    
    async returnForm(comments) {
        try {
            const response = await fetch(`/api/admin/form-management/forms/${this.formId}/return/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({ comments: comments })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to return form');
            }
            
            this.formReviewMain.showSuccess('Form returned successfully');
            
            // Redirect back to form management after a short delay
            setTimeout(() => {
                window.location.href = '/form-management/';
            }, 2000);
            
        } catch (error) {
            console.error('Failed to return form:', error);
            throw error;
        }
    }
    
    showConfirmDialog(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.2s ease;
            `;
            
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: white;
                border-radius: 16px;
                padding: 32px;
                width: 90%;
                max-width: 500px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                animation: slideUp 0.3s ease;
            `;
            
            modal.innerHTML = `
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="width: 64px; height: 64px; margin: 0 auto 16px; background: #e6fffa; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-circle-check" style="font-size: 32px; color: #16a34a;"></i>
                    </div>
                    <h3 style="margin: 0 0 12px; color: #1e293b; font-size: 1.5rem; font-weight: 600;">
                        ${this.escapeHtml(title)}
                    </h3>
                </div>
                <div style="margin-bottom: 24px;">
                    ${message}
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn-cancel" style="padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; background: #f5f5f5; color: #666;">
                        ${this.escapeHtml(cancelText)}
                    </button>
                    <button class="btn-confirm" style="padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; background: #4caf50; color: white;">
                        ${this.escapeHtml(confirmText)}
                    </button>
                </div>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            const cleanup = () => {
                overlay.remove();
            };
            
            modal.querySelector('.btn-cancel').addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            modal.querySelector('.btn-confirm').addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
            
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            });
        });
    }
    
    showAlertDialog(title, message, buttonText = 'Close') {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.2s ease;
            `;
            
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: white;
                border-radius: 16px;
                padding: 28px;
                width: 90%;
                max-width: 420px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                animation: slideUp 0.3s ease;
                text-align: center;
            `;
            
            modal.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <div style="width: 56px; height: 56px; margin: 0 auto 16px; background: #fff1f2; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 26px; color: #e11d48;"></i>
                    </div>
                    <h3 style="margin: 0 0 12px; color: #1e293b; font-size: 1.35rem; font-weight: 600;">
                        ${this.escapeHtml(title)}
                    </h3>
                </div>
                <div style="margin-bottom: 24px; color: #475569; font-size: 0.95rem; line-height: 1.5;">
                    ${message}
                </div>
                <button class="btn-close-alert" style="padding: 10px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; background: #ef4444; color: white;">
                    ${this.escapeHtml(buttonText)}
                </button>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            const cleanup = () => {
                overlay.remove();
            };
            
            modal.querySelector('.btn-close-alert').addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
            
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            });
        });
    }

    async handleClearRemarks() {
        try {
            const confirmed = await this.showConfirmDialog(
                'Clear All Remarks',
                `<p style="margin: 0; color: #475569; font-size: 0.95rem;">
                    This will remove all remarks created by your admin level for this form. Are you sure you want to continue?
                </p>`,
                'Clear Remarks',
                'Cancel'
            );
            if (!confirmed) return;

            await this.clearAllRemarks();
            this.formReviewMain.showSuccess('All remarks have been cleared for this form.');
            this.toggleClearRemarksButton(this.clearRemarksButton, false);
        } catch (error) {
            console.error('Failed to clear remarks manually:', error);
            this.formReviewMain.showError('Failed to clear remarks');
        }
    }
    
    showReturnDialog(title, message, confirmText = 'Return', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.2s ease;
            `;
            
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: white;
                border-radius: 16px;
                padding: 32px;
                width: 90%;
                max-width: 500px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                animation: slideUp 0.3s ease;
            `;
            
            modal.innerHTML = `
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="width: 64px; height: 64px; margin: 0 auto 16px; background: #fff3e0; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-rotate-left" style="font-size: 32px; color: #ff9800;"></i>
                    </div>
                    <h3 style="margin: 0 0 12px; color: #1e293b; font-size: 1.5rem; font-weight: 600;">
                        ${this.escapeHtml(title)}
                    </h3>
                </div>
                <div style="margin-bottom: 20px;">
                    ${message}
                </div>
                <div style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 600; color: #333;">
                        Comments (Required) <span style="color: #f44336;">*</span>
                    </label>
                    <textarea 
                        id="returnComments" 
                        style="width: 100%; min-height: 100px; padding: 12px; border: 1px solid #e0e0e0; border-radius: 8px; font-family: inherit; font-size: 14px; resize: vertical;"
                        placeholder="Please provide a reason for returning this form..."
                        required
                    ></textarea>
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn-cancel" style="padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; background: #f5f5f5; color: #666;">
                        ${this.escapeHtml(cancelText)}
                    </button>
                    <button class="btn-confirm" disabled style="padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; background: #ff9800; color: white;">
                        ${this.escapeHtml(confirmText)}
                    </button>
                </div>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            const textarea = modal.querySelector('#returnComments');
            const confirmBtn = modal.querySelector('.btn-confirm');
            
            // Enable/disable confirm button based on textarea content
            textarea.addEventListener('input', () => {
                confirmBtn.disabled = textarea.value.trim() === '';
                confirmBtn.style.background = textarea.value.trim() === '' ? '#ccc' : '#ff9800';
                confirmBtn.style.cursor = textarea.value.trim() === '' ? 'not-allowed' : 'pointer';
            });
            
            const cleanup = () => {
                overlay.remove();
            };
            
            modal.querySelector('.btn-cancel').addEventListener('click', () => {
                cleanup();
                resolve(null);
            });
            
            confirmBtn.addEventListener('click', () => {
                const comments = textarea.value.trim();
                if (comments) {
                    cleanup();
                    resolve(comments);
                }
            });
            
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(null);
                }
            });
            
            // Focus textarea
            setTimeout(() => textarea.focus(), 100);
        });
    }
    
    getCSRFToken() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return value;
            }
        }
        return '';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize actions manager after FormReviewMain is initialized
document.addEventListener('DOMContentLoaded', function() {
    // Wait for FormReviewMain to be initialized
    const checkInterval = setInterval(() => {
        if (window.formReviewApp) {
            window.formReviewActionsApp = new FormReviewActions(
                window.formReviewApp.formId,
                window.formReviewApp
            );
            clearInterval(checkInterval);
        }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => clearInterval(checkInterval), 5000);
});

