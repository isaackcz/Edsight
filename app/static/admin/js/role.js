document.addEventListener('DOMContentLoaded', function() {
    // Initialize page functionality
    initializePermissionHandlers();
    initializeSearchFunctionality();
    initializeRoleDetailsModal();
    initializeUserRoleModal();
    
    // Permission Handlers
    function initializePermissionHandlers() {
        // Handle toggle all buttons for permission categories
        document.querySelectorAll('.toggle-all-btn').forEach(button => {
            button.addEventListener('click', function() {
                const category = this.dataset.category;
                const categoryElement = this.closest('.permission-category');
                const checkboxes = categoryElement.querySelectorAll('input[type="checkbox"]');
                const isActive = this.classList.contains('active');
                
                // Toggle all checkboxes in this category
                checkboxes.forEach(checkbox => {
                    checkbox.checked = !isActive;
                });
                
                // Update button state
                if (isActive) {
                    this.classList.remove('active');
                    this.querySelector('.toggle-text').textContent = 'Select All';
                } else {
                    this.classList.add('active');
                    this.querySelector('.toggle-text').textContent = 'Deselect All';
                }
            });
        });
        
        // Handle individual permission checkbox changes
        document.addEventListener('change', function(e) {
            if (e.target.type === 'checkbox' && e.target.name === 'permissions') {
                const categoryElement = e.target.closest('.permission-category');
                if (categoryElement) {
                    updateToggleButtonState(categoryElement);
                }
            }
        });
    }
    
    function updateToggleButtonState(categoryElement) {
        const checkboxes = categoryElement.querySelectorAll('input[type="checkbox"]');
        const checkedBoxes = categoryElement.querySelectorAll('input[type="checkbox"]:checked');
        const toggleBtn = categoryElement.querySelector('.toggle-all-btn');
        
        if (checkedBoxes.length === checkboxes.length) {
            toggleBtn.classList.add('active');
            toggleBtn.querySelector('.toggle-text').textContent = 'Deselect All';
        } else {
            toggleBtn.classList.remove('active');
            toggleBtn.querySelector('.toggle-text').textContent = 'Select All';
        }
    }
    
    // Search Functionality
    function initializeSearchFunctionality() {
        // Permission search
        const permissionSearch = document.getElementById('permissionSearch');
        if (permissionSearch) {
            permissionSearch.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                const permissionRows = document.querySelectorAll('.permissions-table tbody tr');
                
                permissionRows.forEach(row => {
                    const permissionText = row.cells[0].textContent.toLowerCase();
                    if (permissionText.includes(searchTerm)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            });
        }
        
        // Enhanced User search functionality for both views
        const userSearchInputs = document.querySelectorAll('input[placeholder*="Search users"]');
        userSearchInputs.forEach(input => {
            input.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                
                // Search in card view
                const userCards = document.querySelectorAll('.user-card');
                userCards.forEach(card => {
                    const userName = card.querySelector('.user-name')?.textContent.toLowerCase() || '';
                    const userEmail = card.querySelector('.user-email')?.textContent.toLowerCase() || '';
                    const userRole = card.querySelector('.current-role-badge span')?.textContent.toLowerCase() || '';
                    
                    if (userName.includes(searchTerm) || userEmail.includes(searchTerm) || userRole.includes(searchTerm)) {
                        card.style.display = '';
                    } else {
                        card.style.display = 'none';
                    }
                });
                
                // Search in table view
                const userRows = document.querySelectorAll('.user-row');
                userRows.forEach(row => {
                    const userName = row.querySelector('.user-name-table')?.textContent.toLowerCase() || '';
                    const userEmail = row.querySelector('.user-email-table')?.textContent.toLowerCase() || '';
                    const userRole = row.querySelector('.role-badge-table span')?.textContent.toLowerCase() || '';
                    
                    if (userName.includes(searchTerm) || userEmail.includes(searchTerm) || userRole.includes(searchTerm)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            });
        });
    }

    // Enhanced Filter functionality for both views
    document.querySelectorAll('.filter-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            // Remove active from all tags
            document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
            // Add active to clicked tag
            this.classList.add('active');
            
            const filterType = this.querySelector('span').textContent.toLowerCase();
            
            // Filter card view
            const userCards = document.querySelectorAll('.user-card');
            userCards.forEach(card => {
                if (filterType === 'all users') {
                    card.style.display = '';
                } else {
                    const userRole = card.querySelector('.current-role-badge span')?.textContent.toLowerCase() || '';
                    if (userRole.includes(filterType.replace(' office', '').replace('regional', 'region'))) {
                        card.style.display = '';
                    } else {
                        card.style.display = 'none';
                    }
                }
            });
            
            // Filter table view
            const userRows = document.querySelectorAll('.user-row');
            userRows.forEach(row => {
                if (filterType === 'all users') {
                    row.style.display = '';
                } else {
                    const userRole = row.querySelector('.role-badge-table span')?.textContent.toLowerCase() || '';
                    if (userRole.includes(filterType.replace(' office', '').replace('regional', 'region'))) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                }
            });
        });
    });

    // Enhanced View toggle functionality
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const viewType = this.dataset.view;
            
            // Remove active from all toggle buttons
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            // Add active to clicked button
            this.classList.add('active');
            
            // Toggle between card and table views
            const cardView = document.getElementById('userCardsView');
            const tableView = document.getElementById('userTableView');
            
            if (viewType === 'table') {
                // Show table view, hide card view
                if (cardView) cardView.style.display = 'none';
                if (tableView) tableView.style.display = 'block';
                
                // Add table view class for additional styling
                const userListContainer = document.querySelector('.user-list-container');
                if (userListContainer) {
                    userListContainer.classList.add('table-view-active');
                }
                
                // Show notification
                showNotification('Switched to table view', 'info');
            } else {
                // Show card view, hide table view
                if (cardView) cardView.style.display = 'grid';
                if (tableView) tableView.style.display = 'none';
                
                // Remove table view class
                const userListContainer = document.querySelector('.user-list-container');
                if (userListContainer) {
                    userListContainer.classList.remove('table-view-active');
                }
                
                // Show notification
                showNotification('Switched to card view', 'info');
            }
        });
    });
    
    // Enhanced Sorting functionality
    function initializeSorting() {
        const sortDropdown = document.querySelector('.sort-dropdown select');
        const sortContainer = document.querySelector('.sort-dropdown');
        
        if (sortDropdown) {
            sortDropdown.addEventListener('change', function() {
                const sortBy = this.value;
                
                // Add visual feedback
                if (sortContainer) {
                    sortContainer.classList.add('sorting');
                }
                
                // Add small delay for visual feedback
                setTimeout(() => {
                    sortUsers(sortBy);
                    showNotification(`Sorted by ${sortBy.replace('Sort by ', '')}`, 'info');
                    
                    // Remove visual feedback
                    if (sortContainer) {
                        sortContainer.classList.remove('sorting');
                    }
                }, 100);
            });
        }
    }
    
    function sortUsers(sortBy) {
        // Get both card and table containers
        const cardContainer = document.getElementById('userCardsView');
        const tableContainer = document.querySelector('.users-table tbody');
        
        if (!cardContainer && !tableContainer) return;
        
        // Get all user cards and table rows (including hidden ones)
        const userCards = Array.from(cardContainer?.querySelectorAll('.user-card') || []);
        const userRows = Array.from(tableContainer?.querySelectorAll('.user-row') || []);
        
        // Store current visibility states
        const cardVisibility = userCards.map(card => ({
            element: card,
            visible: card.style.display !== 'none'
        }));
        
        const rowVisibility = userRows.map(row => ({
            element: row,
            visible: row.style.display !== 'none'
        }));
        
        // Sort cards
        if (userCards.length > 0) {
            const sortedCards = sortElements(userCards, sortBy, 'card');
            // Clear and re-append sorted cards
            const emptyState = cardContainer.querySelector('.no-users-message');
            cardContainer.innerHTML = '';
            sortedCards.forEach(card => cardContainer.appendChild(card));
            if (emptyState && sortedCards.length === 0) {
                cardContainer.appendChild(emptyState);
            }
            
            // Restore visibility states
            cardVisibility.forEach(item => {
                if (!item.visible) {
                    item.element.style.display = 'none';
                }
            });
        }
        
        // Sort table rows
        if (userRows.length > 0) {
            const sortedRows = sortElements(userRows, sortBy, 'row');
            // Clear and re-append sorted rows
            tableContainer.innerHTML = '';
            sortedRows.forEach(row => tableContainer.appendChild(row));
            
            // Restore visibility states
            rowVisibility.forEach(item => {
                if (!item.visible) {
                    item.element.style.display = 'none';
                }
            });
        }
    }
    
    function sortElements(elements, sortBy, type) {
        return elements.sort((a, b) => {
            let valueA, valueB;
            
            switch (sortBy) {
                case 'Sort by Name':
                    if (type === 'card') {
                        valueA = a.querySelector('.user-name')?.textContent || '';
                        valueB = b.querySelector('.user-name')?.textContent || '';
                    } else {
                        valueA = a.querySelector('.user-name-table')?.textContent || '';
                        valueB = b.querySelector('.user-name-table')?.textContent || '';
                    }
                    return valueA.localeCompare(valueB);
                    
                case 'Sort by Role':
                    if (type === 'card') {
                        valueA = a.querySelector('.current-role-badge span')?.textContent || '';
                        valueB = b.querySelector('.current-role-badge span')?.textContent || '';
                    } else {
                        valueA = a.querySelector('.role-badge-table span')?.textContent || '';
                        valueB = b.querySelector('.role-badge-table span')?.textContent || '';
                    }
                    // Sort by role hierarchy (Central=5, Region=4, Division=3, District=2, School=1)
                    const roleOrder = {
                        'Central Office': 5,
                        'Region': 4,
                        'Division': 3,
                        'District': 2,
                        'School': 1
                    };
                    const orderA = roleOrder[valueA] || 0;
                    const orderB = roleOrder[valueB] || 0;
                    return orderB - orderA; // Descending order (highest role first)
                    
                case 'Sort by Date Added':
                    // Sort by creation date (newest first)
                    valueA = a.dataset.userCreated || '0';
                    valueB = b.dataset.userCreated || '0';
                    return new Date(valueB) - new Date(valueA);
                    
                case 'Sort by Last Active':
                    if (type === 'card') {
                        // For cards, get the "Last Active" stat value
                        const statsA = a.querySelectorAll('.stat');
                        const statsB = b.querySelectorAll('.stat');
                        valueA = 'Never';
                        valueB = 'Never';
                        
                        statsA.forEach(stat => {
                            if (stat.querySelector('.stat-label')?.textContent === 'Last Active') {
                                valueA = stat.querySelector('.stat-value')?.textContent || 'Never';
                            }
                        });
                        
                        statsB.forEach(stat => {
                            if (stat.querySelector('.stat-label')?.textContent === 'Last Active') {
                                valueB = stat.querySelector('.stat-value')?.textContent || 'Never';
                            }
                        });
                    } else {
                        valueA = a.querySelector('.activity-status')?.textContent?.trim() || 'Never';
                        valueB = b.querySelector('.activity-status')?.textContent?.trim() || 'Never';
                    }
                    
                    // Convert activity strings to sortable values (minutes since activity)
                    const getActivityValue = (activity) => {
                        if (activity === 'Never') return 999999; // Put "Never" at the end
                        
                        const match = activity.match(/(\d+)\s+(minutes?|hours?|days?)\s+ago/i);
                        if (!match) return 999999;
                        
                        const [, number, unit] = match;
                        const num = parseInt(number) || 0;
                        
                        switch (unit.toLowerCase()) {
                            case 'minute':
                            case 'minutes':
                                return num;
                            case 'hour':
                            case 'hours':
                                return num * 60;
                            case 'day':
                            case 'days':
                                return num * 1440; // 24 * 60
                            default:
                                return 999999;
                        }
                    };
                    
                    const activityA = getActivityValue(valueA);
                    const activityB = getActivityValue(valueB);
                    return activityA - activityB; // Most recent first (smallest time value)
                    
                default:
                    return 0;
            }
        });
    }
    
    // Initialize sorting when page loads
    initializeSorting();
    
    // Role assignment functionality
    document.querySelectorAll('.change-role-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userCard = this.closest('.user-card');
            const userName = userCard.querySelector('.user-name').textContent;
            
            // Simple confirmation dialog (can be replaced with a proper modal)
            if (confirm(`Change role for ${userName}?`)) {
                // Here you would typically open a role selection modal
                // For now, just show a message
                alert('Role change functionality would be implemented here');
            }
        });
    });

    // Export functionality
    document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent.includes('Export')) {
            btn.addEventListener('click', function() {
                const exportType = this.textContent.includes('Roles') ? 'roles' : 'users';
                
                // Simple export simulation
                console.log(`Exporting ${exportType}...`);
                
                // Show feedback
                const originalText = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
                this.disabled = true;
                
                setTimeout(() => {
                    this.innerHTML = originalText;
                    this.disabled = false;
                    alert(`${exportType.charAt(0).toUpperCase() + exportType.slice(1)} exported successfully!`);
                }, 2000);
            });
        }
    });

    // Notification functionality
function showNotification(message, type = 'info') {
        // Simple notification system
    const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
            background: var(--dark-bg-elevated);
            color: var(--dark-text-primary);
        padding: 1rem 1.5rem;
        border-radius: 8px;
            border-left: 4px solid var(--dark-accent-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'});
            box-shadow: var(--dark-shadow-lg);
            z-index: 1000;
            transition: all 0.3s ease;
        `;
        
    document.body.appendChild(notification);
    
        // Auto remove after 3 seconds
    setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
        }, 3000);
    }

    // Role Details Modal
    function initializeRoleDetailsModal() {
        const modal = document.getElementById('roleDetailsModal');
        const closeBtn = document.getElementById('closeRoleDetailsModal');
        const closeFooterBtn = document.getElementById('closeRoleDetailsBtn');
        const exportBtn = document.getElementById('exportRoleDetailsBtn');
        
        // View Details button handlers
        document.querySelectorAll('.view-details-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const roleType = this.dataset.role;
                openRoleDetailsModal(roleType);
            });
        });
        
        // Close modal handlers
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeRoleDetailsModal());
        }
        if (closeFooterBtn) {
            closeFooterBtn.addEventListener('click', () => closeRoleDetailsModal());
        }
        
        // Click outside to close
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal || e.target.classList.contains('modal-overlay')) {
                    closeRoleDetailsModal();
                }
            });
        }
        
        // Escape key to close
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
                closeRoleDetailsModal();
            }
        });
        
        // Export functionality
        if (exportBtn) {
            exportBtn.addEventListener('click', function() {
                const roleName = document.getElementById('roleDetailsName').textContent;
                exportRoleDetails(roleName);
            });
        }
    }
    
    function openRoleDetailsModal(roleType) {
        const modal = document.getElementById('roleDetailsModal');
        if (!modal) return;
        
        // Get role data
        const roleData = getRoleData(roleType);
        
        // Populate modal with role data
        populateRoleDetails(roleData);
        
        // Show modal
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function closeRoleDetailsModal() {
        const modal = document.getElementById('roleDetailsModal');
        if (!modal) return;
        
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    function getRoleData(roleType) {
        // Get real user count data from server
        const dbStats = window.rolePermissionStats || {};
        
        // Map role types to admin levels
        const roleTypeMap = {
            'central-office': 'central',
            'region-office': 'region', 
            'division-office': 'division',
            'district-office': 'district',
            'school': 'school'
        };
        
        const adminLevel = roleTypeMap[roleType] || 'school';
        const realUserCount = dbStats[adminLevel]?.count || 0;
        const realPermissionCount = dbStats[adminLevel]?.permissions || 0;
        
        const roleDataMap = {
            'central-office': {
                name: 'Central Office',
                level: 'Level 5',
                scope: 'Nationwide',
                description: 'Highest level of administrative control with full system access and nationwide oversight responsibilities.',
                icon: 'fas fa-crown',
                userCount: realUserCount,
                permissionCount: realPermissionCount,
                accessScope: 'Full',
                reportsTo: 'Department Head',
                manages: 'Regional Offices',
                canCreate: 'All user types',
                permissions: {
                    'User Management': [
                        'Create all user accounts',
                        'Edit all user information', 
                        'Delete/deactivate users',
                        'Reset passwords',
                        'Assign roles and permissions'
                    ],
                    'Data & Forms': [
                        'Create and design forms',
                        'Final form submission',
                        'Approve all submissions',
                        'Export all data',
                        'Set system deadlines'
                    ],
                    'System Administration': [
                        'Full system control',
                        'Manage system settings',
                        'View all audit logs',
                        'Manage backups',
                        'Configure integrations'
                    ]
                }
            },
            'region-office': {
                name: 'Region Office',
                level: 'Level 4',
                scope: 'Regional',
                description: 'Regional oversight with authority over multiple divisions within a specific geographic region.',
                icon: 'fas fa-map-marked-alt',
                userCount: realUserCount,
                permissionCount: realPermissionCount,
                accessScope: 'Regional',
                reportsTo: 'Central Office',
                manages: 'Division Offices',
                canCreate: 'Division/District users',
                permissions: {
                    'User Management': [
                        'Create division/district accounts',
                        'Edit subordinate users',
                        'Reset regional passwords'
                    ],
                    'Data & Forms': [
                        'Set regional deadlines',
                        'Verify forms to central',
                        'Regional data export',
                        'Approve division submissions'
                    ],
                    'System Administration': [
                        'Regional oversight',
                        'View regional logs',
                        'Manage regional settings'
                    ]
                }
            },
            'division-office': {
                name: 'Division Office',
                level: 'Level 3',
                scope: 'Division',
                description: 'Division-level administration responsible for multiple districts within the division area.',
                icon: 'fas fa-building',
                userCount: realUserCount,
                permissionCount: realPermissionCount,
                accessScope: 'Division',
                reportsTo: 'Region Office',
                manages: 'District Offices',
                canCreate: 'District/School users',
                permissions: {
                    'User Management': [
                        'Create district/school accounts',
                        'Password reset',
                        'Profile update',
                        'Manage division users'
                    ],
                    'Data & Forms': [
                        'Submit forms to region',
                        'Approve district submissions',
                        'Division data management'
                    ],
                    'System Administration': [
                        'Division oversight',
                        'Local system management'
                    ]
                }
            },
            'district-office': {
                name: 'District Office',
                level: 'Level 2',
                scope: 'District',
                description: 'District coordination with oversight of schools within the district boundaries.',
                icon: 'fas fa-school',
                userCount: realUserCount,
                permissionCount: realPermissionCount,
                accessScope: 'District',
                reportsTo: 'Division Office',
                manages: 'Schools',
                canCreate: 'School users',
                permissions: {
                    'User Management': [
                        'View district schools only',
                        'Manage school users'
                    ],
                    'Data & Forms': [
                        'Verify forms to division',
                        'Monitor school submissions',
                        'District oversight'
                    ],
                    'System Administration': [
                        'District system access',
                        'Local configuration'
                    ]
                }
            },
            'school': {
                name: 'School',
                level: 'Level 1',
                scope: 'School',
                description: 'School-level access for data entry and form submission with limited system permissions.',
                icon: 'fas fa-graduation-cap',
                userCount: realUserCount,
                permissionCount: realPermissionCount,
                accessScope: 'School',
                reportsTo: 'District Office',
                manages: 'School Data',
                canCreate: 'None',
                permissions: {
                    'User Management': [
                        'View own school only'
                    ],
                    'Data & Forms': [
                        'Fill forms',
                        'Submit to district',
                        'Manage school data'
                    ],
                    'System Administration': [
                        'Basic school access'
                    ]
                }
            }
        };
        
        return roleDataMap[roleType] || roleDataMap['school'];
    }
    
    function populateRoleDetails(roleData) {
        // Update basic information
        document.getElementById('roleDetailsTitle').textContent = roleData.name;
        document.getElementById('roleDetailsName').textContent = roleData.name;
        document.getElementById('roleDetailsLevel').textContent = roleData.level;
        document.getElementById('roleDetailsScope').textContent = roleData.scope;
        document.getElementById('roleDetailsDescription').textContent = roleData.description;
        
        // Update icon
        const iconElement = document.querySelector('#roleDetailsIcon i');
        if (iconElement) {
            iconElement.className = roleData.icon;
        }
        
        // Update statistics
        document.getElementById('roleDetailsUserCount').textContent = roleData.userCount;
        document.getElementById('roleDetailsPermissionCount').textContent = roleData.permissionCount;
        document.getElementById('roleDetailsAccessScope').textContent = roleData.accessScope;
        
        // Update hierarchy
        document.getElementById('roleDetailsReportsTo').textContent = roleData.reportsTo;
        document.getElementById('roleDetailsManages').textContent = roleData.manages;
        document.getElementById('roleDetailsCanCreate').textContent = roleData.canCreate;
        
        // Update detailed permissions
        const permissionsContainer = document.getElementById('roleDetailsPermissions');
        if (permissionsContainer) {
            permissionsContainer.innerHTML = '';
            
            Object.entries(roleData.permissions).forEach(([category, permissions]) => {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'permission-group';
                
                const categoryIcons = {
                    'User Management': 'fas fa-users',
                    'Data & Forms': 'fas fa-file-alt',
                    'System Administration': 'fas fa-cogs'
                };
                
                groupDiv.innerHTML = `
                    <h5><i class="${categoryIcons[category]}"></i>${category}</h5>
                    <ul class="permission-list">
                        ${permissions.map(permission => `
                            <li><i class="fas fa-check"></i>${permission}</li>
                        `).join('')}
                    </ul>
                `;
                
                permissionsContainer.appendChild(groupDiv);
            });
        }
    }
    
    function exportRoleDetails(roleName) {
        // Simulate export functionality
        showNotification(`Exporting ${roleName} details...`, 'info');
        
        setTimeout(() => {
            showNotification(`${roleName} details exported successfully!`, 'success');
        }, 2000);
    }

    // Add some utility functions for potential future use
    window.EdSightAdmin = {
        showNotification: showNotification,
        refreshUserList: function() {
            console.log('Refreshing user list...');
            showNotification('User list refreshed', 'success');
        },
        exportData: function(type) {
            console.log(`Exporting ${type}...`);
            showNotification(`${type} export started`, 'info');
        },
        openRoleDetails: openRoleDetailsModal
    };

    // User Role Modal functionality
    function initializeUserRoleModal() {
        const modal = document.getElementById('userRoleModal');
        const closeBtn = document.getElementById('closeUserRoleModal');
        const closeFooterBtn = document.getElementById('closeUserRoleModalBtn');
        
        // View Role button handlers
        document.querySelectorAll('.view-user-role-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const userData = {
                    id: this.dataset.userId,
                    name: this.dataset.userName,
                    email: this.dataset.userEmail,
                    role: this.dataset.userRole,
                    assignment: this.dataset.userAssignment,
                    permissions: this.dataset.userPermissions ? this.dataset.userPermissions.split(',') : [],
                    permissionCount: this.dataset.userPermissionCount,
                    accessScope: this.dataset.userAccessScope
                };
                openUserRoleModal(userData);
            });
        });
        
        // Close modal handlers
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeUserRoleModal());
        }
        if (closeFooterBtn) {
            closeFooterBtn.addEventListener('click', () => closeUserRoleModal());
        }
        
        // Click outside to close
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal || e.target.classList.contains('modal-overlay')) {
                    closeUserRoleModal();
                }
            });
        }
        
        // Escape key to close
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
                closeUserRoleModal();
            }
        });
    }
    
    function openUserRoleModal(userData) {
        const modal = document.getElementById('userRoleModal');
        if (!modal) return;
        
        // Populate modal with user data
        populateUserRoleDetails(userData);
        
        // Show modal
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    function closeUserRoleModal() {
        const modal = document.getElementById('userRoleModal');
        if (!modal) return;
        
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    function populateUserRoleDetails(userData) {
        // Generate user avatar initials
        const nameParts = userData.name.split(' ');
        const initials = nameParts.length > 1 ? 
            nameParts[0][0] + nameParts[nameParts.length - 1][0] : 
            userData.name.substring(0, 2);
        
        // Update user avatar and basic info
        document.getElementById('userModalAvatar').textContent = initials.toUpperCase();
        document.getElementById('userModalName').textContent = userData.name;
        document.getElementById('userModalEmail').textContent = userData.email;
        document.getElementById('userModalRole').textContent = userData.role;
        
        // Update role information cards
        document.getElementById('userModalRoleDisplay').textContent = userData.role;
        document.getElementById('userModalAssignmentFull').textContent = userData.assignment;
        
        // Update stats
        document.getElementById('userModalPermissionCount').textContent = userData.permissionCount;
        document.getElementById('userModalAccessScope').textContent = userData.accessScope;
        
        // Update permission count badge
        const permissionCountBadge = document.getElementById('permissionCountBadge');
        if (permissionCountBadge) {
            permissionCountBadge.textContent = userData.permissionCount;
        }
        
        // Update permissions container
        const permissionsContainer = document.getElementById('userModalPermissions');
        if (userData.permissions.length > 0 && userData.permissions[0] !== '') {
            // Create permission items
            const permissionItems = userData.permissions.map(permission => `
                <div class="permission-item">
                    <i class="fas fa-check-circle"></i>
                    <span>${permission}</span>
                </div>
            `).join('');
            
            permissionsContainer.innerHTML = permissionItems;
        } else {
            // Show no permissions state
            permissionsContainer.innerHTML = `
                <div class="no-permissions-state">
                    <div class="empty-state-icon">
                        <i class="fas fa-lock"></i>
                    </div>
                    <h5>No Specific Permissions</h5>
                    <p>This user has standard role-based permissions only</p>
                </div>
            `;
        }
        
        // Add some visual feedback
        const modal = document.getElementById('userRoleModal');
        if (modal) {
            // Add a subtle animation when modal content is loaded
            modal.style.opacity = '0.8';
            setTimeout(() => {
                modal.style.opacity = '1';
            }, 100);
        }
    }

    console.log('EdSight Admin Role Management initialized');
});