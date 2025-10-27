/**
 * Skeleton Loader Integration
 * Integrates skeleton loader with existing CRUD operations
 */

// Initialize skeleton loader when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Ensure skeleton loader is available
  if (typeof window.skeletonLoader === 'undefined') {
    console.warn('Skeleton loader not found. Please include skeleton-loader.js');
    return;
  }

  // Add skeleton loader styles to head if not already present
  if (!document.querySelector('link[href*="skeleton-loader.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/static/components/skeleton-loader/skeleton-loader.css';
    document.head.appendChild(link);
  }

  // Enhance existing CRUD operations with skeleton loading
  enhanceCrudOperations();
});

/**
 * Enhance existing CRUD operations with skeleton loading
 */
function enhanceCrudOperations() {
  // Enhance form submissions
  enhanceFormSubmissions();
  
  // Enhance button clicks
  enhanceButtonClicks();
  
  // Enhance API calls
  enhanceApiCalls();
}

/**
 * Enhance form submissions with loading states
 */
function enhanceFormSubmissions() {
  // Find all forms and add loading states
  document.addEventListener('submit', function(e) {
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    
    if (submitButton && !submitButton.disabled) {
      const loadingId = window.skeletonLoader.showButtonLoading(submitButton, 'Submitting');
      
      // Hide loading when form submission completes
      form.addEventListener('submit', function() {
        setTimeout(() => {
          window.skeletonLoader.hideButtonLoading(loadingId);
        }, 1000);
      }, { once: true });
    }
  });
}

/**
 * Enhance button clicks with loading states
 */
function enhanceButtonClicks() {
  // Add loading to buttons with specific classes
  document.addEventListener('click', function(e) {
    const button = e.target.closest('button');
    if (!button) return;

    // Check for specific button types
    if (button.classList.contains('btn-primary') || 
        button.classList.contains('btn-secondary') ||
        button.classList.contains('modern-btn')) {
      
      // Skip if already loading
      if (button.disabled || button.querySelector('.skeleton-loader-inline')) {
        return;
      }

      // Add loading state for specific operations
      if (button.textContent.includes('Save') || 
          button.textContent.includes('Update') ||
          button.textContent.includes('Submit') ||
          button.textContent.includes('Create')) {
        
        const loadingId = window.skeletonLoader.showButtonLoading(button, 'Processing');
        
        // Auto-hide after 3 seconds if not manually hidden
        setTimeout(() => {
          window.skeletonLoader.hideButtonLoading(loadingId);
        }, 3000);
      }
    }
  });
}

/**
 * Enhance API calls with loading states
 */
function enhanceApiCalls() {
  // Override fetch to add loading states
  const originalFetch = window.fetch;
  
  window.fetch = function(url, options = {}) {
    // Only add loading for our API endpoints
    if (url.includes('/api/')) {
      const method = options.method || 'GET';
      const isModifying = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      
      if (isModifying) {
        // Find the triggering element
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'BUTTON') {
          const loadingId = window.skeletonLoader.showButtonLoading(activeElement, 'Processing');
          
          // Return a promise that hides loading when complete
          return originalFetch(url, options)
            .then(response => {
              window.skeletonLoader.hideButtonLoading(loadingId);
              return response;
            })
            .catch(error => {
              window.skeletonLoader.hideButtonLoading(loadingId);
              throw error;
            });
        }
      }
    }
    
    return originalFetch(url, options);
  };
}

/**
 * Show loading for specific operations
 */
window.showCrudLoading = function(operation, targetElement, options = {}) {
  return window.skeletonLoader.showCrudLoading(operation, targetElement, options);
};

/**
 * Hide loading for specific operations
 */
window.hideCrudLoading = function(operationId) {
  return window.skeletonLoader.hide(operationId);
};

/**
 * Show loading for question operations
 */
window.showQuestionLoading = function(operation, targetElement) {
  return window.skeletonLoader.showQuestionLoading(operation, targetElement);
};

/**
 * Show loading for form operations
 */
window.showFormLoading = function(operation, targetElement) {
  return window.skeletonLoader.showFormLoading(operation, targetElement);
};

/**
 * Show loading for API calls
 */
window.showApiLoading = function(apiCall, targetElement, options = {}) {
  return window.skeletonLoader.showApiLoading(apiCall, targetElement, options);
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    enhanceCrudOperations,
    enhanceFormSubmissions,
    enhanceButtonClicks,
    enhanceApiCalls
  };
}
