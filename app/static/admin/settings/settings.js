// Settings Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Tab switching functionality
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.settings-tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // Remove active class from all tabs and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });

    // Edit button functionality for general settings
    const editButtons = document.querySelectorAll('.setting-card .btn');
    editButtons.forEach(button => {
        if (button.textContent.includes('Edit') || button.textContent.includes('Change')) {
            button.addEventListener('click', function() {
                const settingCard = this.closest('.setting-card');
                const input = settingCard.querySelector('.form-input');
                
                if (input && input.hasAttribute('readonly')) {
                    input.removeAttribute('readonly');
                    input.removeAttribute('disabled');
                    input.focus();
                    this.textContent = 'Save';
                    this.classList.remove('btn-outline');
                    this.classList.add('btn-primary');
                } else if (input) {
                    input.setAttribute('readonly', true);
                    this.textContent = this.textContent.includes('Change') ? 'Change' : 'Edit';
                    this.classList.remove('btn-primary');
                    this.classList.add('btn-outline');
                    
                    // Show success message
                    showNotification('Settings updated successfully!', 'success');
                }
            });
        }
    });

    // Clear cache functionality
    const clearCacheBtn = document.querySelector('.btn-primary');
    if (clearCacheBtn && clearCacheBtn.textContent.includes('Clear Cache')) {
        clearCacheBtn.addEventListener('click', function() {
            // Simulate cache clearing
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clearing...';
            this.disabled = true;
            
            setTimeout(() => {
                this.innerHTML = 'Clear Cache';
                this.disabled = false;
                showNotification('Cache cleared successfully!', 'success');
                
                // Update cache sizes
                const cacheSizes = document.querySelectorAll('.cache-size');
                cacheSizes.forEach(size => {
                    size.textContent = '0 MB';
                });
            }, 2000);
        });
    }

    // Toggle switches functionality
    const toggleSwitches = document.querySelectorAll('.toggle-switch input');
    toggleSwitches.forEach(toggle => {
        toggle.addEventListener('change', function() {
            const category = this.closest('.notification-category');
            const categoryTitle = category.querySelector('h3').textContent;
            const optionTitle = this.closest('.notification-option')?.querySelector('.option-title')?.textContent || 'Category';
            
            const status = this.checked ? 'enabled' : 'disabled';
            showNotification(`${optionTitle} notifications ${status}`, 'info');
        });
    });

    // Integration connection buttons
    const integrationButtons = document.querySelectorAll('.integration-card .btn');
    integrationButtons.forEach(button => {
        button.addEventListener('click', function() {
            const integrationCard = this.closest('.integration-card');
            const integrationName = integrationCard.querySelector('h3').textContent;
            const statusSpan = integrationCard.querySelector('.integration-status');
            
            if (this.textContent === 'Connect') {
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                this.disabled = true;
                
                setTimeout(() => {
                    statusSpan.textContent = 'Connected';
                    statusSpan.className = 'integration-status connected';
                    this.textContent = 'Configure';
                    this.disabled = false;
                    showNotification(`${integrationName} connected successfully!`, 'success');
                }, 2000);
            } else if (this.textContent === 'Test') {
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
                this.disabled = true;
                
                setTimeout(() => {
                    this.textContent = 'Test';
                    this.disabled = false;
                    showNotification(`${integrationName} test completed successfully!`, 'success');
                }, 1500);
            }
        });
    });

    // Backup functionality
    const backupButtons = document.querySelectorAll('.backup-actions .btn, .backup-item .btn');
    backupButtons.forEach(button => {
        button.addEventListener('click', function() {
            const buttonText = this.textContent.trim();
            
            if (buttonText === 'Create Backup Now') {
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Backup...';
                this.disabled = true;
                
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-download"></i> Create Backup Now';
                    this.disabled = false;
                    showNotification('Backup created successfully!', 'success');
                    
                    // Add new backup to history
                    addBackupToHistory();
                }, 3000);
            } else if (buttonText === 'Download') {
                showNotification('Backup download started', 'info');
            } else if (buttonText === 'Restore') {
                if (confirm('Are you sure you want to restore from this backup? This action cannot be undone.')) {
                    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Restoring...';
                    this.disabled = true;
                    
                    setTimeout(() => {
                        this.textContent = 'Restore';
                        this.disabled = false;
                        showNotification('System restored successfully!', 'success');
                    }, 4000);
                }
            }
        });
    });

    // Maintenance tools functionality
    const maintenanceTools = document.querySelectorAll('.tool-card .btn');
    maintenanceTools.forEach(button => {
        button.addEventListener('click', function() {
            const toolCard = this.closest('.tool-card');
            const toolName = toolCard.querySelector('h4').textContent;
            const originalText = this.textContent;
            
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            this.disabled = true;
            
            setTimeout(() => {
                this.textContent = originalText;
                this.disabled = false;
                
                if (toolName.includes('Clean')) {
                    showNotification('Temporary files cleaned successfully!', 'success');
                } else if (toolName.includes('Optimization')) {
                    showNotification('Database optimization completed!', 'success');
                } else if (toolName.includes('Restart')) {
                    showNotification('Services restarted successfully!', 'success');
                } else if (toolName.includes('Report')) {
                    showNotification('Performance report generated!', 'success');
                }
            }, 2000);
        });
    });

    // Save all changes button
    const saveAllBtn = document.querySelector('.settings-footer .btn-primary');
    if (saveAllBtn) {
        saveAllBtn.addEventListener('click', function() {
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            this.disabled = true;
            
            setTimeout(() => {
                this.textContent = 'Save All Changes';
                this.disabled = false;
                showNotification('All settings saved successfully!', 'success');
            }, 1500);
        });
    }

    // Reset to defaults button
    const resetBtn = document.querySelector('.settings-footer .btn-outline');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to reset all settings to their default values? This action cannot be undone.')) {
                showNotification('Settings reset to defaults', 'info');
                
                // Reset form inputs to default values
                const inputs = document.querySelectorAll('.form-input');
                inputs.forEach(input => {
                    if (input.type === 'text' && input.value === 'EdSight Admin Panel') {
                        // Keep as is
                    } else if (input.type === 'number') {
                        input.value = '30';
                    }
                });
                
                // Reset toggles to default state
                const toggles = document.querySelectorAll('.toggle-switch input');
                toggles.forEach((toggle, index) => {
                    // Set some default states
                    toggle.checked = index % 2 === 0;
                });
            }
        });
    }

    // Date range selector for custom dates
    const dateRangeSelect = document.getElementById('dateRange');
    const customDates = document.getElementById('customDates');
    
    if (dateRangeSelect && customDates) {
        dateRangeSelect.addEventListener('change', function() {
            if (this.value === 'custom') {
                customDates.style.display = 'flex';
            } else {
                customDates.style.display = 'none';
            }
        });
    }

    // Menu item navigation (only prevent default for items without proper URLs)
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            if (this.getAttribute('href') === '#') {
                e.preventDefault();
            }
        });
    });

    console.log('Settings page initialized');
});

// Helper function to show notifications
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close">&times;</button>
    `;
    
    // Add notification styles with dark theme support
    const isDarkTheme = document.body.classList.contains('dark-theme');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${isDarkTheme ? 'var(--dark-bg-card)' : 'white'};
        border: 1px solid ${isDarkTheme ? 'var(--dark-border-primary)' : '#e2e8f0'};
        border-radius: 8px;
        padding: 1rem;
        box-shadow: ${isDarkTheme ? 'var(--dark-shadow-lg)' : '0 4px 12px rgba(0, 0, 0, 0.1)'};
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 300px;
        animation: slideInRight 0.3s ease;
        color: ${isDarkTheme ? 'var(--dark-text-primary)' : '#1a202c'};
    `;
    
    // Add type-specific styling with dark theme support
    const colors = isDarkTheme ? {
        success: 'var(--dark-accent-success)',
        warning: 'var(--dark-accent-warning)',
        danger: 'var(--dark-accent-danger)',
        info: 'var(--dark-accent-info)'
    } : {
        success: '#48bb78',
        warning: '#ecc94b',
        danger: '#e53e3e',
        info: '#4299e1'
    };
    
    notification.style.borderLeftColor = colors[type];
    notification.style.borderLeftWidth = '4px';
    
    // Add to page
    document.body.appendChild(notification);
    
    // Add close functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Helper function to get notification icons
function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        warning: 'exclamation-triangle',
        danger: 'times-circle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// Helper function to add backup to history
function addBackupToHistory() {
    const backupList = document.querySelector('.backup-list');
    if (backupList) {
        const now = new Date();
        const timeString = now.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        const newBackup = document.createElement('div');
        newBackup.className = 'backup-item';
        newBackup.innerHTML = `
            <div class="backup-info">
                <span class="backup-date">${timeString}</span>
                <span class="backup-type">Manual</span>
                <span class="backup-size">1.2 GB</span>
            </div>
            <div class="backup-actions">
                <button class="btn btn-outline btn-sm">Download</button>
                <button class="btn btn-outline btn-sm">Restore</button>
            </div>
        `;
        
        // Insert at the beginning of the list
        backupList.insertBefore(newBackup, backupList.firstChild);
        
        // Add event listeners to new buttons
        const newButtons = newBackup.querySelectorAll('.btn');
        newButtons.forEach(button => {
            button.addEventListener('click', function() {
                const buttonText = this.textContent.trim();
                
                if (buttonText === 'Download') {
                    showNotification('Backup download started', 'info');
                } else if (buttonText === 'Restore') {
                    if (confirm('Are you sure you want to restore from this backup? This action cannot be undone.')) {
                        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Restoring...';
                        this.disabled = true;
                        
                        setTimeout(() => {
                            this.textContent = 'Restore';
                            this.disabled = false;
                            showNotification('System restored successfully!', 'success');
                        }, 4000);
                    }
                }
            });
        });
    }
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
    }
    
    .notification-close {
        background: none;
        border: none;
        font-size: 1.2rem;
        cursor: pointer;
        color: ${isDarkTheme ? 'var(--dark-text-muted)' : '#718096'};
        padding: 0;
        margin-left: 0.5rem;
    }
    
    .notification-close:hover {
        color: ${isDarkTheme ? 'var(--dark-text-primary)' : '#2d3748'};
    }
`;
document.head.appendChild(style);
