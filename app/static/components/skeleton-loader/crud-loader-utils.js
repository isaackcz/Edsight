/**
 * CRUD Loader Utilities
 * Provides easy-to-use functions for common CRUD operations with skeleton loading
 */

class CrudLoaderUtils {
  constructor() {
    this.activeOperations = new Map();
  }

  /**
   * Execute a CRUD operation with skeleton loading
   * @param {string} operation - Operation name (create, read, update, delete)
   * @param {Function} operationFn - Function to execute
   * @param {HTMLElement} targetElement - Element to show loading on
   * @param {Object} options - Configuration options
   */
  async executeWithLoading(operation, operationFn, targetElement, options = {}) {
    const config = {
      showButton: true,
      showContainer: true,
      message: `${operation}...`,
      ...options
    };

    const operationId = `${operation}_${Date.now()}`;
    let buttonLoadingId, containerLoadingId;

    try {
      // Show button loading if target is a button
      if (config.showButton && targetElement.tagName === 'BUTTON') {
        buttonLoadingId = window.skeletonLoader.showButtonLoading(targetElement, config.message);
      }

      // Show container loading
      if (config.showContainer && targetElement) {
        containerLoadingId = window.skeletonLoader.showCrudLoading(operation, targetElement, {
          type: 'question',
          message: config.message
        });
      }

      // Execute the operation
      const result = await operationFn();
      
      return result;
    } catch (error) {
      console.error(`Error in ${operation} operation:`, error);
      throw error;
    } finally {
      // Hide all loading states
      if (buttonLoadingId) window.skeletonLoader.hideButtonLoading(buttonLoadingId);
      if (containerLoadingId) window.skeletonLoader.hide(containerLoadingId);
    }
  }

  /**
   * Create question with loading
   */
  async createQuestion(questionData, targetElement) {
    return this.executeWithLoading('Creating', async () => {
      const response = await fetch('/api/question/create/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': this.getCookie('csrftoken')
        },
        body: JSON.stringify(questionData)
      });

      if (!response.ok) {
        throw new Error('Failed to create question');
      }

      return await response.json();
    }, targetElement);
  }

  /**
   * Update question with loading
   */
  async updateQuestion(questionId, questionData, targetElement) {
    return this.executeWithLoading('Updating', async () => {
      const response = await fetch(`/api/question/${questionId}/update/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': this.getCookie('csrftoken')
        },
        body: JSON.stringify(questionData)
      });

      if (!response.ok) {
        throw new Error('Failed to update question');
      }

      return await response.json();
    }, targetElement);
  }

  /**
   * Delete question with loading
   */
  async deleteQuestion(questionId, targetElement) {
    return this.executeWithLoading('Deleting', async () => {
      const response = await fetch(`/api/questions/${questionId}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': this.getCookie('csrftoken')
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete question');
      }

      return await response.json();
    }, targetElement);
  }

  /**
   * Fetch questions with loading
   */
  async fetchQuestions(topicId, targetElement) {
    return this.executeWithLoading('Loading', async () => {
      const response = await fetch(`/api/topics/${topicId}/questions/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }

      return await response.json();
    }, targetElement);
  }

  /**
   * Save form with loading
   */
  async saveForm(formData, targetElement) {
    return this.executeWithLoading('Saving', async () => {
      const response = await fetch('/api/form/submit/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': this.getCookie('csrftoken')
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to save form');
      }

      return await response.json();
    }, targetElement);
  }

  /**
   * Bulk update questions with loading
   */
  async bulkUpdateQuestions(questions, targetElement) {
    return this.executeWithLoading('Updating', async () => {
      const updatePromises = questions.map((q) => {
        if (!q.question_id) return Promise.resolve();
        
        return this.updateQuestion(q.question_id, {
          question_text: q.question_text,
          answer_type: q.answer_type,
          is_required: q.is_required,
          display_order: q.display_order,
          choices: q.choices || [],
          answer_description: q.answer_description || "",
        }, null); // Don't show loading for individual updates
      });

      return await Promise.all(updatePromises);
    }, targetElement);
  }

  /**
   * Get CSRF token from cookies
   */
  getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  /**
   * Show loading for any custom operation
   */
  showLoading(operation, targetElement, options = {}) {
    return window.skeletonLoader.showCrudLoading(operation, targetElement, options);
  }

  /**
   * Hide loading for any operation
   */
  hideLoading(operationId) {
    return window.skeletonLoader.hide(operationId);
  }
}

// Create global instance
window.crudLoader = new CrudLoaderUtils();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CrudLoaderUtils;
}
