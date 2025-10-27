/**
 * Skeleton Loader Component
 * Provides loading states for CRUD operations
 */
class SkeletonLoader {
  constructor() {
    this.activeLoaders = new Map();
  }

  /**
   * Show skeleton loader for a specific operation
   * @param {string} operationId - Unique identifier for the operation
   * @param {HTMLElement} targetElement - Element to show loader in
   * @param {Object} options - Configuration options
   */
  show(operationId, targetElement, options = {}) {
    const config = {
      type: 'default', // 'default', 'inline', 'overlay', 'question', 'card'
      message: 'Loading...',
      size: 'medium', // 'small', 'medium', 'large'
      position: 'replace', // 'replace', 'overlay', 'prepend', 'append'
      ...options
    };

    // Remove existing loader if any
    this.hide(operationId);

    const loaderElement = this.createLoader(config);
    this.activeLoaders.set(operationId, {
      element: loaderElement,
      target: targetElement,
      config: config
    });

    this.insertLoader(loaderElement, targetElement, config.position);
  }

  /**
   * Hide skeleton loader for a specific operation
   * @param {string} operationId - Unique identifier for the operation
   */
  hide(operationId) {
    const loader = this.activeLoaders.get(operationId);
    if (loader) {
      loader.element.remove();
      this.activeLoaders.delete(operationId);
    }
  }

  /**
   * Hide all active loaders
   */
  hideAll() {
    this.activeLoaders.forEach((loader, operationId) => {
      this.hide(operationId);
    });
  }

  /**
   * Create skeleton loader element based on configuration
   * @param {Object} config - Loader configuration
   * @returns {HTMLElement} - Skeleton loader element
   */
  createLoader(config) {
    const loader = document.createElement('div');
    loader.className = `skeleton-loader skeleton-${config.type}`;

    if (config.type === 'overlay') {
      loader.classList.add('skeleton-loader-overlay');
    }

    switch (config.type) {
      case 'inline':
        loader.innerHTML = this.createInlineLoader(config);
        break;
      case 'question':
        loader.innerHTML = this.createQuestionLoader(config);
        break;
      case 'card':
        loader.innerHTML = this.createCardLoader(config);
        break;
      case 'overlay':
        loader.innerHTML = this.createOverlayLoader(config);
        break;
      default:
        loader.innerHTML = this.createDefaultLoader(config);
    }

    return loader;
  }

  /**
   * Create default skeleton loader
   */
  createDefaultLoader(config) {
    return `
      <div class="skeleton-line ${config.size}"></div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-card-actions">
        <div class="skeleton-button"></div>
        <div class="skeleton-button"></div>
      </div>
    `;
  }

  /**
   * Create inline skeleton loader
   */
  createInlineLoader(config) {
    return `
      <div class="skeleton-spinner"></div>
      <div class="skeleton-line short"></div>
    `;
  }

  /**
   * Create question skeleton loader
   */
  createQuestionLoader(config) {
    return `
      <div class="skeleton-question">
        <div class="skeleton-question-header">
          <div class="skeleton-line long"></div>
          <div class="skeleton-icon"></div>
        </div>
        <div class="skeleton-question-content">
          <div class="skeleton-line extra-long"></div>
          <div class="skeleton-line medium"></div>
        </div>
        <div class="skeleton-question-actions">
          <div class="skeleton-button"></div>
          <div class="skeleton-button"></div>
        </div>
      </div>
    `;
  }

  /**
   * Create card skeleton loader
   */
  createCardLoader(config) {
    return `
      <div class="skeleton-card">
        <div class="skeleton-card-header">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-card-content">
            <div class="skeleton-line medium"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
        <div class="skeleton-line long"></div>
        <div class="skeleton-card-actions">
          <div class="skeleton-button"></div>
          <div class="skeleton-button"></div>
        </div>
      </div>
    `;
  }

  /**
   * Create overlay skeleton loader
   */
  createOverlayLoader(config) {
    return `
      <div class="skeleton-spinner skeleton-spinner-large"></div>
      <div class="skeleton-line medium" style="margin-top: 12px;"></div>
    `;
  }

  /**
   * Insert loader into target element
   */
  insertLoader(loaderElement, targetElement, position) {
    switch (position) {
      case 'prepend':
        targetElement.insertBefore(loaderElement, targetElement.firstChild);
        break;
      case 'append':
        targetElement.appendChild(loaderElement);
        break;
      case 'overlay':
        targetElement.style.position = 'relative';
        targetElement.appendChild(loaderElement);
        break;
      case 'replace':
      default:
        targetElement.innerHTML = '';
        targetElement.appendChild(loaderElement);
        break;
    }
  }

  /**
   * Show loading state for CRUD operations
   */
  showCrudLoading(operation, targetElement, options = {}) {
    const operationId = `${operation}_${Date.now()}`;
    const defaultOptions = {
      type: 'question',
      message: `${operation}...`,
      position: 'replace'
    };

    this.show(operationId, targetElement, { ...defaultOptions, ...options });
    return operationId;
  }

  /**
   * Show loading for question operations
   */
  showQuestionLoading(operation, targetElement) {
    return this.showCrudLoading(operation, targetElement, {
      type: 'question',
      message: `${operation} question...`
    });
  }

  /**
   * Show loading for form operations
   */
  showFormLoading(operation, targetElement) {
    return this.showCrudLoading(operation, targetElement, {
      type: 'card',
      message: `${operation} form...`
    });
  }

  /**
   * Show inline loading for buttons
   */
  showButtonLoading(button, operation) {
    const originalContent = button.innerHTML;
    const operationId = `button_${Date.now()}`;
    
    button.innerHTML = `
      <div class="skeleton-loader-inline">
        <div class="skeleton-spinner"></div>
        <div class="skeleton-line short"></div>
      </div>
    `;
    button.disabled = true;

    this.activeLoaders.set(operationId, {
      element: button,
      originalContent: originalContent,
      operation: operation
    });

    return operationId;
  }

  /**
   * Hide button loading and restore original content
   */
  hideButtonLoading(operationId) {
    const loader = this.activeLoaders.get(operationId);
    if (loader && loader.originalContent) {
      loader.element.innerHTML = loader.originalContent;
      loader.element.disabled = false;
      this.activeLoaders.delete(operationId);
    }
  }

  /**
   * Show loading for API calls
   */
  showApiLoading(apiCall, targetElement, options = {}) {
    const operationId = `api_${Date.now()}`;
    this.show(operationId, targetElement, {
      type: 'overlay',
      message: 'Processing...',
      position: 'overlay',
      ...options
    });

    return apiCall()
      .then(result => {
        this.hide(operationId);
        return result;
      })
      .catch(error => {
        this.hide(operationId);
        throw error;
      });
  }
}

// Create global instance
window.skeletonLoader = new SkeletonLoader();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SkeletonLoader;
}
