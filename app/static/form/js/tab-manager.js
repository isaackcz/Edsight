/**
 * Tab Manager - Handles tab switching functionality
 * Clean, focused module for tab operations
 */

class TabManager {
  constructor() {
    this.currentTab = 'draft-questions';
    this.tabButtons = [];
    this.tabContents = [];
    this.init();
  }

  init() {
    this.initializeElements();
    this.attachEventListeners();
    this.setupInitialState();
  }

  initializeElements() {
    this.tabButtons = document.querySelectorAll('.tab-button');
    this.tabContents = document.querySelectorAll('.tab-content');
  }

  attachEventListeners() {
    this.tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabId = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tabId);
      });

      // Keyboard navigation
      button.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const tabId = e.currentTarget.getAttribute('data-tab');
          this.switchTab(tabId);
        }
      });
    });

    // Arrow key navigation between tabs
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const activeButton = document.querySelector('.tab-button.active');
        if (activeButton && document.activeElement === activeButton) {
          e.preventDefault();
          this.navigateTabs(e.key === 'ArrowLeft' ? -1 : 1);
        }
      }
    });
  }

  setupInitialState() {
    // Set initial active tab
    this.switchTab('draft-questions');
    
    // Set up ARIA attributes for accessibility
    this.tabButtons.forEach((button, index) => {
      const tabId = button.getAttribute('data-tab');
      const isActive = button.classList.contains('active');
      
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', isActive);
      button.setAttribute('aria-controls', `${tabId}-tab`);
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    this.tabContents.forEach(content => {
      const tabId = content.id.replace('-tab', '');
      const isActive = content.classList.contains('active');
      
      content.setAttribute('role', 'tabpanel');
      content.setAttribute('aria-labelledby', tabId);
      content.setAttribute('aria-hidden', !isActive);
    });
  }

  switchTab(tabId) {
    if (this.currentTab === tabId) return;

    const previousTab = this.currentTab;

    // Update button states
    this.tabButtons.forEach(button => {
      const buttonTabId = button.getAttribute('data-tab');
      const isActive = buttonTabId === tabId;
      
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive);
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    // Update content visibility
    this.tabContents.forEach(content => {
      const contentTabId = content.id.replace('-tab', '');
      const isActive = contentTabId === tabId;
      
      content.classList.toggle('active', isActive);
      content.setAttribute('aria-hidden', !isActive);
    });

    this.currentTab = tabId;
    
    // Trigger custom event for other components
    this.dispatchTabChangeEvent(tabId);
    
    // Update URL hash (optional)
    this.updateUrlHash(tabId);
  }


  navigateTabs(direction) {
    const currentIndex = Array.from(this.tabButtons).findIndex(
      button => button.classList.contains('active')
    );
    
    const newIndex = currentIndex + direction;
    const maxIndex = this.tabButtons.length - 1;
    const targetIndex = newIndex < 0 ? maxIndex : newIndex > maxIndex ? 0 : newIndex;
    
    const targetButton = this.tabButtons[targetIndex];
    const targetTabId = targetButton.getAttribute('data-tab');
    
    this.switchTab(targetTabId);
    targetButton.focus();
  }

  dispatchTabChangeEvent(tabId) {
    const event = new CustomEvent('tabChanged', {
      detail: {
        tabId: tabId,
        previousTab: this.currentTab
      }
    });
    document.dispatchEvent(event);
  }

  updateUrlHash(tabId) {
    // Update URL hash without triggering page reload
    if (history.pushState) {
      const newUrl = `${window.location.pathname}#${tabId}`;
      history.pushState(null, null, newUrl);
    }
  }

  // Public methods for external control
  getCurrentTab() {
    return this.currentTab;
  }

  getTabContent(tabId) {
    return document.getElementById(`${tabId}-tab`);
  }

  showTab(tabId) {
    this.switchTab(tabId);
  }

  // Method to handle URL hash changes
  handleHashChange() {
    const hash = window.location.hash.replace('#', '');
    if (hash && hash !== this.currentTab) {
      const targetTab = document.querySelector(`[data-tab="${hash}"]`);
      if (targetTab) {
        this.switchTab(hash);
      }
    }
  }

  // Initialize from URL hash
  initializeFromHash() {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const targetTab = document.querySelector(`[data-tab="${hash}"]`);
      if (targetTab) {
        this.switchTab(hash);
        return;
      }
    }
    // Default to first tab if no valid hash
    this.switchTab('draft-questions');
  }
}

// Initialize tab manager when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  window.tabManager = new TabManager();
  
  // Handle browser back/forward navigation
  window.addEventListener('hashchange', function() {
    window.tabManager.handleHashChange();
  });
  
  // Initialize from URL hash
  window.tabManager.initializeFromHash();
});

// Export for use in other modules
window.TabManager = TabManager;
