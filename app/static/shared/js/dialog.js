/**
 * Reusable Dialog Modal Component
 * Can be used across all pages to replace toast notifications
 */

/**
 * Show a dialog modal
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Dialog message
 * @param {string} options.type - Dialog type: 'success', 'error', 'warning', 'info', 'danger'
 * @param {Object} options.buttons - Custom buttons configuration
 * @param {Function} options.onConfirm - Callback when confirm button is clicked
 * @param {Function} options.onCancel - Callback when cancel button is clicked
 * @param {boolean} options.showCancel - Show cancel button (default: true for confirm dialogs)
 * @param {string} options.confirmText - Confirm button text (default: 'OK')
 * @param {string} options.cancelText - Cancel button text (default: 'Cancel')
 * @returns {Promise} Promise that resolves when dialog is closed
 */
function showDialog(options = {}) {
    return new Promise((resolve) => {
        const {
            title = 'Notification',
            message = '',
            type = 'info',
            buttons = null,
            onConfirm = null,
            onCancel = null,
            showCancel = false,
            confirmText = 'OK',
            cancelText = 'Cancel'
        } = options;

        // Remove existing dialog if any
        const existingDialog = document.querySelector('.dialog-backdrop');
        if (existingDialog) {
            existingDialog.remove();
        }

        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'dialog-backdrop';

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'dialog-modal';

        // Get icon and type configuration
        const iconConfig = getDialogIcon(type);

        // Build header
        const header = `
            <div class="dialog-header">
                <div class="dialog-title-wrapper">
                    <div class="dialog-icon ${type}">
                        <i class="${iconConfig.icon}"></i>
                    </div>
                    <div class="dialog-title-content">
                        <h2 class="dialog-title">${title}</h2>
                    </div>
                </div>
                <button class="dialog-close-btn" aria-label="Close dialog" type="button">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Build body
        const body = `
            <div class="dialog-body">
                <p class="dialog-message">${message}</p>
            </div>
        `;

        // Build footer
        let footer = '';
        if (buttons) {
            // Custom buttons
            footer = `
                <div class="dialog-footer">
                    ${buttons.map(btn => `
                        <button class="dialog-btn ${btn.class || 'dialog-btn-primary'}" 
                                data-action="${btn.action || 'custom'}"
                                type="button">
                            ${btn.icon ? `<i class="${btn.icon}"></i>` : ''}
                            ${btn.text || 'Button'}
                        </button>
                    `).join('')}
                </div>
            `;
        } else {
            // Default buttons
            const cancelBtn = showCancel ? `
                <button class="dialog-btn dialog-btn-secondary" data-action="cancel" type="button">
                    <i class="fas fa-times"></i>
                    ${cancelText}
                </button>
            ` : '';
            
            footer = `
                <div class="dialog-footer">
                    ${cancelBtn}
                    <button class="dialog-btn dialog-btn-primary" data-action="confirm" type="button">
                        <i class="fas fa-check"></i>
                        ${confirmText}
                    </button>
                </div>
            `;
        }

        modal.innerHTML = header + body + footer;
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        // Show dialog with animation
        requestAnimationFrame(() => {
            backdrop.classList.add('show');
        });

        // Handle close events
        const closeDialog = (action, result = null) => {
            backdrop.classList.remove('show');
            setTimeout(() => {
                backdrop.remove();
                resolve(result);
            }, 300);
        };

        // Close button
        const closeBtn = modal.querySelector('.dialog-close-btn');
        closeBtn.addEventListener('click', () => {
            if (onCancel) onCancel();
            closeDialog('close', false);
        });

        // Footer buttons
        modal.querySelectorAll('.dialog-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                
                if (action === 'confirm') {
                    if (onConfirm) {
                        const result = onConfirm();
                        if (result !== false) {
                            closeDialog('confirm', true);
                        }
                    } else {
                        closeDialog('confirm', true);
                    }
                } else if (action === 'cancel') {
                    if (onCancel) onCancel();
                    closeDialog('cancel', false);
                } else {
                    // Custom button action
                    const customBtn = buttons.find(b => b.action === action);
                    if (customBtn && customBtn.onClick) {
                        const result = customBtn.onClick();
                        if (result !== false) {
                            closeDialog(action, action);
                        }
                    } else {
                        closeDialog(action, action);
                    }
                }
            });
        });

        // Close on backdrop click
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                if (onCancel) onCancel();
                closeDialog('backdrop', false);
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                if (onCancel) onCancel();
                closeDialog('escape', false);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    });
}

/**
 * Get icon configuration for dialog type
 */
function getDialogIcon(type) {
    const icons = {
        success: { icon: 'fas fa-check-circle' },
        error: { icon: 'fas fa-exclamation-circle' },
        danger: { icon: 'fas fa-exclamation-triangle' },
        warning: { icon: 'fas fa-exclamation-triangle' },
        info: { icon: 'fas fa-info-circle' }
    };
    return icons[type] || icons.info;
}

/**
 * Convenience functions for different dialog types
 */

function showSuccessDialog(message, title = 'Success') {
    return showDialog({
        title,
        message,
        type: 'success',
        confirmText: 'OK'
    });
}

function showErrorDialog(message, title = 'Error') {
    return showDialog({
        title,
        message,
        type: 'error',
        confirmText: 'OK'
    });
}

function showWarningDialog(message, title = 'Warning') {
    return showDialog({
        title,
        message,
        type: 'warning',
        confirmText: 'OK'
    });
}

function showInfoDialog(message, title = 'Information') {
    return showDialog({
        title,
        message,
        type: 'info',
        confirmText: 'OK'
    });
}

function showConfirmDialog(message, title = 'Confirm', confirmText = 'Confirm', cancelText = 'Cancel') {
    return showDialog({
        title,
        message,
        type: 'warning',
        showCancel: true,
        confirmText,
        cancelText
    });
}

