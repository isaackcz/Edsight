/**
 * Cleanup Script for Old Form Data System
 * This script removes all localStorage data from the old PWA/offline system
 * Run this once to clean up user browsers before deploying the new React system
 */

(function() {
    console.log('🧹 EdSight Storage Cleanup - Starting...');
    
    // List of old localStorage keys to remove
    const oldKeys = [
        'edsight_form_data',
        'edsight_user_data',
        'edsight_offline_queue',
        'edsight_sync_status',
        'edsight_last_sync',
        'formPageState',
        'draftsPageState',
        'unsavedTopicQuestions',
        'user', // Old user data storage
    ];
    
    let removedCount = 0;
    
    // Remove specific old keys
    oldKeys.forEach(key => {
        if (localStorage.getItem(key) !== null) {
            localStorage.removeItem(key);
            console.log(`✓ Removed: ${key}`);
            removedCount++;
        }
    });
    
    // Remove any other edsight_* prefixed keys
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
        if (key.startsWith('edsight_') && !oldKeys.includes(key)) {
            localStorage.removeItem(key);
            console.log(`✓ Removed: ${key}`);
            removedCount++;
        }
    });
    
    // Unregister old service worker if it exists
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for(let registration of registrations) {
                if (registration.active && registration.active.scriptURL.includes('sw.js')) {
                    registration.unregister().then(function(success) {
                        if (success) {
                            console.log('✓ Unregistered old service worker');
                        }
                    });
                }
            }
        });
    }
    
    // Clear any old caches
    if ('caches' in window) {
        caches.keys().then(function(cacheNames) {
            cacheNames.forEach(function(cacheName) {
                if (cacheName.startsWith('edsight-')) {
                    caches.delete(cacheName).then(function(success) {
                        if (success) {
                            console.log(`✓ Cleared cache: ${cacheName}`);
                        }
                    });
                }
            });
        });
    }
    
    console.log(`🧹 EdSight Storage Cleanup Complete - Removed ${removedCount} items`);
    console.log('✅ Your browser is now ready for the new system!');
    
    // Optionally show user notification
    if (removedCount > 0) {
        // Store cleanup flag so we don't run this again
        localStorage.setItem('edsight_cleanup_done', 'true');
    }
})();

