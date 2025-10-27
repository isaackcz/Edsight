/**
 * Animation Integration
 * Integrates fade animations with existing form functionality
 */

// Initialize animations when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Ensure fade animations are available
  if (typeof window.fadeAnimations === 'undefined') {
    console.warn('Fade animations not found. Please include fade-animations.js');
    return;
  }

  // Add animation styles to head if not already present
  if (!document.querySelector('link[href*="fade-animations.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/static/components/animations/fade-animations.css';
    document.head.appendChild(link);
  }

  // Enhance existing functionality with animations
  enhanceFormAnimations();
  enhanceButtonAnimations();
  enhanceNotificationAnimations();
});

/**
 * Enhance form functionality with animations
 */
function enhanceFormAnimations() {
  // Add animations to form submissions
  document.addEventListener('submit', function(e) {
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    
    if (submitButton && window.fadeAnimations) {
      window.fadeAnimations.animateButton(submitButton, 'click');
    }
  });

  // Add animations to button clicks
  document.addEventListener('click', function(e) {
    // Ensure target is an Element before calling closest
    if (e.target && e.target.closest && typeof e.target.closest === 'function') {
      const button = e.target.closest('button');
      if (button && window.fadeAnimations) {
        window.fadeAnimations.animateButton(button, 'click');
      }
    }
  });
}

/**
 * Enhance button interactions with animations
 */
function enhanceButtonAnimations() {
  // Add hover animations to buttons
  document.addEventListener('mouseenter', function(e) {
    // Ensure target is an Element before calling closest
    if (e.target && e.target.closest && typeof e.target.closest === 'function') {
      const button = e.target.closest('button');
      if (button && window.fadeAnimations) {
        window.fadeAnimations.animateButton(button, 'hover');
      }
    }
  }, true);
}

/**
 * Enhance notification system with animations
 */
function enhanceNotificationAnimations() {
  // Override showSnackbar if it exists
  if (typeof window.showSnackbar === 'function') {
    const originalShowSnackbar = window.showSnackbar;
    window.showSnackbar = function(message, options = {}) {
      const notification = originalShowSnackbar(message, options);
      
      if (notification && window.fadeAnimations) {
        window.fadeAnimations.animateNotification(notification, {
          duration: 300,
          autoHide: true,
          hideDelay: 3000
        });
      }
      
      return notification;
    };
  }
}

/**
 * Animate page transitions
 */
window.animatePageTransition = function(currentPage, newPage, options = {}) {
  if (window.fadeAnimations) {
    return window.fadeAnimations.animatePageTransition(currentPage, newPage, options);
  }
  return Promise.resolve();
};

/**
 * Animate section transitions
 */
window.animateSectionTransition = function(container, contentGenerator, options = {}) {
  if (window.fadeAnimations) {
    return window.fadeAnimations.animateSectionTransition(container, contentGenerator, options);
  }
  return Promise.resolve();
};

/**
 * Animate question cards
 */
window.animateQuestionCards = function(cards, options = {}) {
  if (window.fadeAnimations) {
    return window.fadeAnimations.animateQuestionCards(cards, options);
  }
  return Promise.resolve();
};

/**
 * Animate element
 */
window.animateElement = function(element, animationType, options = {}) {
  if (window.fadeAnimations) {
    return window.fadeAnimations.animateElement(element, animationType, options);
  }
  return Promise.resolve();
};

/**
 * Check if animations are supported
 */
window.isAnimationSupported = function() {
  if (window.fadeAnimations) {
    return window.fadeAnimations.isAnimationSupported();
  }
  return false;
};

/**
 * Stop all animations
 */
window.stopAllAnimations = function() {
  if (window.fadeAnimations) {
    window.fadeAnimations.stopAllAnimations();
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    enhanceFormAnimations,
    enhanceButtonAnimations,
    enhanceNotificationAnimations
  };
}
