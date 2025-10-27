/**
 * Fade Animation System for Form Transitions
 * Provides smooth page transitions and element animations
 */
class FadeAnimations {
  constructor() {
    this.activeAnimations = new Map();
    this.animationQueue = [];
    this.isAnimating = false;
  }

  /**
   * Animate element with fade transition
   * @param {HTMLElement} element - Element to animate
   * @param {string} animationType - Type of animation (fade, slide, scale)
   * @param {Object} options - Animation options
   */
  animateElement(element, animationType = 'fade', options = {}) {
    const config = {
      duration: 300,
      delay: 0,
      easing: 'ease-in-out',
      direction: 'enter', // 'enter' or 'exit'
      ...options
    };

    return new Promise((resolve) => {
      const animationId = `anim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add animation classes
      element.classList.add(`${animationType}-${config.direction}`);
      element.classList.add('animate-container');
      
      // Store animation info
      this.activeAnimations.set(animationId, {
        element,
        animationType,
        config,
        resolve
      });

      // Trigger animation
      requestAnimationFrame(() => {
        element.classList.add(`${animationType}-${config.direction}-active`);
      });

      // Clean up after animation
      setTimeout(() => {
        this.cleanupAnimation(animationId);
        resolve();
      }, config.duration + config.delay);
    });
  }

  /**
   * Animate page transition
   * @param {HTMLElement} currentPage - Current page element
   * @param {HTMLElement} newPage - New page element
   * @param {Object} options - Animation options
   */
  async animatePageTransition(currentPage, newPage, options = {}) {
    const config = {
      duration: 400,
      type: 'fade',
      ...options
    };

    if (this.isAnimating) {
      return new Promise((resolve) => {
        this.animationQueue.push(() => this.animatePageTransition(currentPage, newPage, options).then(resolve));
      });
    }

    this.isAnimating = true;

    try {
      // Prepare new page
      newPage.style.position = 'absolute';
      newPage.style.top = '0';
      newPage.style.left = '0';
      newPage.style.right = '0';
      newPage.style.zIndex = '1';
      newPage.style.opacity = '0';
      newPage.style.transform = 'translateY(30px) scale(0.98)';

      // Add to container
      const container = currentPage.parentElement;
      container.appendChild(newPage);

      // Animate out current page
      if (currentPage) {
        await this.animateElement(currentPage, config.type, {
          direction: 'exit',
          duration: 300
        });
      }

      // Animate in new page
      await this.animateElement(newPage, config.type, {
        direction: 'enter',
        duration: config.duration
      });

      // Clean up
      if (currentPage) {
        currentPage.remove();
      }
      newPage.style.position = '';
      newPage.style.top = '';
      newPage.style.left = '';
      newPage.style.right = '';
      newPage.style.zIndex = '';
      newPage.style.opacity = '';
      newPage.style.transform = '';

    } finally {
      this.isAnimating = false;
      this.processQueue();
    }
  }

  /**
   * Animate question cards with stagger effect
   * @param {NodeList|Array} cards - Question cards to animate
   * @param {Object} options - Animation options
   */
  async animateQuestionCards(cards, options = {}) {
    const config = {
      staggerDelay: 50,
      duration: 300,
      ...options
    };

    const promises = Array.from(cards).map((card, index) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          this.animateElement(card, 'fade', {
            direction: 'enter',
            duration: config.duration
          }).then(resolve);
        }, index * config.staggerDelay);
      });
    });

    return Promise.all(promises);
  }

  /**
   * Animate form section transition
   * @param {HTMLElement} container - Container element
   * @param {Function} contentGenerator - Function that generates new content
   * @param {Object} options - Animation options
   */
  async animateSectionTransition(container, contentGenerator, options = {}) {
    const config = {
      duration: 300,
      type: 'fade',
      ...options
    };

    // Create temporary container for new content
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.top = '0';
    tempContainer.style.left = '0';
    tempContainer.style.right = '0';
    tempContainer.style.zIndex = '1';
    tempContainer.style.opacity = '0';

    // Generate new content
    const newContent = contentGenerator();
    if (typeof newContent === 'string') {
      tempContainer.innerHTML = newContent;
    } else {
      tempContainer.appendChild(newContent);
    }

    // Add to container
    container.appendChild(tempContainer);

    // Animate out old content
    const oldContent = Array.from(container.children).filter(child => child !== tempContainer);
    for (const child of oldContent) {
      await this.animateElement(child, config.type, {
        direction: 'exit',
        duration: 200
      });
    }

    // Animate in new content
    await this.animateElement(tempContainer, config.type, {
      direction: 'enter',
      duration: config.duration
    });

    // Clean up
    oldContent.forEach(child => child.remove());
    tempContainer.style.position = '';
    tempContainer.style.top = '';
    tempContainer.style.left = '';
    tempContainer.style.right = '';
    tempContainer.style.zIndex = '';
    tempContainer.style.opacity = '';
  }

  /**
   * Animate button interactions
   * @param {HTMLElement} button - Button element
   * @param {string} action - Action type (click, hover, etc.)
   */
  animateButton(button, action = 'click') {
    button.classList.add('btn-animate');
    
    if (action === 'click') {
      button.style.transform = 'scale(0.95)';
      setTimeout(() => {
        button.style.transform = '';
      }, 150);
    }
  }

  /**
   * Animate loading states
   * @param {HTMLElement} element - Element to show loading on
   * @param {Object} options - Animation options
   */
  animateLoading(element, options = {}) {
    const config = {
      duration: 200,
      ...options
    };

    return this.animateElement(element, 'fade', {
      direction: 'enter',
      duration: config.duration
    });
  }

  /**
   * Animate notification
   * @param {HTMLElement} notification - Notification element
   * @param {Object} options - Animation options
   */
  async animateNotification(notification, options = {}) {
    const config = {
      duration: 300,
      autoHide: true,
      hideDelay: 3000,
      ...options
    };

    await this.animateElement(notification, 'slide', {
      direction: 'enter',
      duration: config.duration
    });

    if (config.autoHide) {
      setTimeout(async () => {
        await this.animateElement(notification, 'slide', {
          direction: 'exit',
          duration: 200
        });
        notification.remove();
      }, config.hideDelay);
    }
  }

  /**
   * Clean up animation
   * @param {string} animationId - Animation ID to clean up
   */
  cleanupAnimation(animationId) {
    const animation = this.activeAnimations.get(animationId);
    if (animation) {
      const { element, animationType, config } = animation;
      
      // Remove animation classes
      element.classList.remove(`${animationType}-${config.direction}`);
      element.classList.remove(`${animationType}-${config.direction}-active`);
      element.classList.remove('animate-container');
      
      // Resolve promise
      animation.resolve();
      
      // Remove from active animations
      this.activeAnimations.delete(animationId);
    }
  }

  /**
   * Process animation queue
   */
  processQueue() {
    if (this.animationQueue.length > 0 && !this.isAnimating) {
      const nextAnimation = this.animationQueue.shift();
      nextAnimation();
    }
  }

  /**
   * Stop all animations
   */
  stopAllAnimations() {
    this.activeAnimations.forEach((animation, animationId) => {
      this.cleanupAnimation(animationId);
    });
    this.animationQueue = [];
    this.isAnimating = false;
  }

  /**
   * Check if animations are supported
   */
  isAnimationSupported() {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}

// Create global instance
window.fadeAnimations = new FadeAnimations();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FadeAnimations;
}
