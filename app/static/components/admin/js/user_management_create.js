/**
 * Main controller for user management create page
 * Coordinates all create form modules
 */

(function() {
    'use strict';
    
    /**
     * Show create user page
     */
    function showCreateUserPage() {
        const mainPage = document.getElementById('userManagementMainPage');
        const createPage = document.getElementById('userManagementCreatePage');
        
        if (!mainPage || !createPage) return;
        
        // Hide main page
        mainPage.style.display = 'none';
        
        // Show create page
        createPage.style.display = 'block';
        
        // Save state to localStorage
        try {
            localStorage.setItem('userManagementView', 'create');
        } catch (e) {
            console.warn('Could not save view state to localStorage:', e);
        }
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    /**
     * Hide create user page
     */
    function hideCreateUserPage() {
        const mainPage = document.getElementById('userManagementMainPage');
        const createPage = document.getElementById('userManagementCreatePage');
        
        if (!mainPage || !createPage) return;
        
        // Hide create page
        createPage.style.display = 'none';
        
        // Show main page
        mainPage.style.display = 'block';
        
        // Save state to localStorage
        try {
            localStorage.setItem('userManagementView', 'main');
        } catch (e) {
            console.warn('Could not save view state to localStorage:', e);
        }
    }
    
    /**
     * Initialize create page
     */
    function init() {
        // Handle create button click
        const createBtn = document.getElementById('createNewUserBtn');
        if (createBtn) {
            createBtn.addEventListener('click', function(e) {
                e.preventDefault();
                showCreateUserPage();
            });
        }
        
        // Handle back button
        const backBtn = document.getElementById('backToUserManagementFromCreate');
        if (backBtn) {
            backBtn.addEventListener('click', function(e) {
                e.preventDefault();
                hideCreateUserPage();
            });
        }
        
        // Initialize all modules (they auto-initialize, but ensure they're loaded)
        // Autocomplete, validation, permissions, and submit modules handle their own initialization
    }
    
    // Export for external access
    window.UserManagementCreate = {
        show: showCreateUserPage,
        hide: hideCreateUserPage
    };
    
    // Also export to UserManagementTable namespace for compatibility
    if (window.UserManagementTable) {
        window.UserManagementTable.showCreateUser = showCreateUserPage;
        window.UserManagementTable.hideUserCreate = hideCreateUserPage;
    }
    
    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

