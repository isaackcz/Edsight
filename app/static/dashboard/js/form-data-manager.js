// Form Data Manager - Handles local storage, save states, and data persistence
class FormDataManager {
    constructor() {
        this.storageKey = 'edsight_form_data';
        this.unsavedChanges = new Set();
        this.saveStates = new Map(); // question_id -> save state
        this.autoSaveInterval = null;
        this.hasUnsavedData = false;
        this.completedSections = new Set(); // Track completed sections to avoid duplicate notifications
        this.autoRestoreEnabled = false; // Flag to control auto-restoration
        this.init();
    }

    // Normalize any backend-provided value to a string suitable for input assignment
    normalizeValueForInput(value, inputType) {
        if (value === null || typeof value === 'undefined') {
            return '';
        }
        // Handle date formats to YYYY-MM-DD for date inputs
        if (inputType === 'date') {
            try {
                // Accept raw YYYY-MM-DD, ISO strings, or timestamps
                if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    return value;
                }
                const d = new Date(value);
                if (!isNaN(d.getTime())) {
                    const iso = d.toISOString();
                    return iso.slice(0, 10);
                }
                return '';
            } catch (e) {
                return '';
            }
        }
        if (typeof value === 'number') {
            return String(value);
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        return String(value);
    }

    // Safely check if a value is non-empty (supports number 0, booleans, strings)
    isNonEmptyValue(value) {
        if (value === null || typeof value === 'undefined') return false;
        if (typeof value === 'number') return true; // 0 is valid
        if (typeof value === 'boolean') return true;
        const str = String(value);
        return str.trim() !== '';
    }

    init() {
        this.setupBeforeUnload();
        this.startAutoSave();
        this.setupConnectionMonitoring();
        
        // Add window load event listener to ensure progress bars are updated when page is fully loaded
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.updateProgressIndicators();
                // Also call user_dash_api updateProgress for consistency
                if (window.dashboardUIManager && window.dashboardUIManager.updateProgress) {
                    window.dashboardUIManager.updateProgress();
                }
            }, 200);
        });
        
        // Add MutationObserver to watch for DOM changes and update progress bars
        this.setupProgressBarObserver();
        
        // Don't restore form data here - it will be called after form elements are created
        // Don't update progress indicators immediately - wait for form to be loaded
        // this.updateProgressIndicators();
        // Don't check completion immediately - wait for form to be loaded
        // setTimeout(() => {
        //     this.checkSectionCompletion();
        // }, 500);
    }
    
    // Enable or disable auto-restoration of form data
    setAutoRestore(enabled) {
        this.autoRestoreEnabled = enabled;
    }
    
    // Setup MutationObserver to watch for DOM changes and update progress bars
    setupProgressBarObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldUpdateProgress = false;
            
            mutations.forEach((mutation) => {
                // Check if new form elements were added
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if the added node contains form inputs or progress bars
                            if (node.querySelector && (
                                node.querySelector('.question-input, .sub-question-input') ||
                                node.querySelector('.topic-progress-bar-container') ||
                                node.classList.contains('question-input') ||
                                node.classList.contains('sub-question-input') ||
                                node.classList.contains('topic-progress-bar-container')
                            )) {
                                shouldUpdateProgress = true;
                            }
                        }
                    });
                }
                
                // Check if input values changed
                if (mutation.type === 'attributes' && 
                    (mutation.attributeName === 'value' || mutation.attributeName === 'checked')) {
                    shouldUpdateProgress = true;
                }
            });
            
            if (shouldUpdateProgress) {
                // Debounce the update to avoid excessive calls
                clearTimeout(this.progressUpdateTimeout);
                this.progressUpdateTimeout = setTimeout(() => {
                    this.updateProgressIndicators();
                }, 100);
            }
        });
        
        // Start observing the document body for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['value', 'checked']
        });
    }
    
    // Force restore form data regardless of auto-restore setting
    forceRestoreFormData() {
        this.restoreFormDataForContainer(true);
    }

    // Initialize form-specific functionality after form is loaded
    initializeFormFeatures() {
        // Only run if form container exists
        const formContainer = document.querySelector('.form-container');
        if (formContainer && formContainer.children.length > 0) {
            // Load saved answers from database first, then restore form data
            this.loadSavedAnswersFromDatabase().then(() => {
                // Update progress indicators immediately
                this.updateProgressIndicators();
                
                // Update again after a short delay to ensure DOM is ready
                setTimeout(() => {
                    this.updateProgressIndicators();
                    this.checkSectionCompletion();
                }, 100);
                
                // Update once more after a longer delay to catch any late-loading elements
                setTimeout(() => {
                    this.updateProgressIndicators();
                }, 500);
                
                // Also call user_dash_api updateProgress for consistency
                setTimeout(() => {
                    if (window.dashboardUIManager && window.dashboardUIManager.updateProgress) {
                        window.dashboardUIManager.updateProgress();
                    }
                }, 200);
            });
        }
    }

    // Load saved answers from database and populate form inputs (DATABASE FIRST APPROACH)
    async loadSavedAnswersFromDatabase() {
        try {
            if (!window.dashboardUIManager || !window.dashboardUIManager.api) {
                console.log('API not available, falling back to local storage only');
                this.restoreFormData();
                return;
            }

            console.log('Loading form data from database (priority)...');
            const response = await window.dashboardUIManager.api.getSavedAnswers();
            
            if (response && response.success && response.answers) {
                console.log('Successfully loaded data from database, populating form...');
                
                // First pass: Handle concatenated sub-question data
                Object.keys(response.answers).forEach(questionId => {
                    const data = response.answers[questionId];
                    
                    // Handle sub-question answers stored in concatenated format (both multiple and single)
                    if (data && data.value && data.value.includes(':') && /^\d+:/.test(data.value)) {
                        // Parse concatenated sub-question answers like "8375:pap;8376:pew" or "8371:2025-09-04"
                        const subAnswers = data.value.includes(';') ? data.value.split(';') : [data.value];
                        subAnswers.forEach(subAnswer => {
                            if (subAnswer.includes(':')) {
                                const [subQuestionId, answerValue] = subAnswer.split(':', 2);
                                if (subQuestionId && subQuestionId.trim() !== '') {
                                    // Find the input for this sub-question
                                    const subInput = document.querySelector(`[data-sub-question-id="${subQuestionId.trim()}"]`);
                                    if (subInput) {
                                        if (this.isNonEmptyValue(answerValue)) {
                                            // Set value based on input type
                                            if (subInput.type === 'radio') {
                                                const radios = document.querySelectorAll(`input[name='${subInput.name}']`);
                                                const target = Array.from(radios).find(r => String(r.value) === String(answerValue));
                                                if (target) target.checked = true;
                                            } else if (subInput.type === 'checkbox') {
                                                subInput.checked = (String(answerValue) === 'true' || String(answerValue) === String(subInput.value));
                                            } else {
                                                const normalized = this.normalizeValueForInput(answerValue, subInput.type);
                                                subInput.value = normalized;
                                            }
                                            this.updateSaveIndicator(subQuestionId.trim(), 'database');
                                            this.markAsSavedToDatabase(subQuestionId.trim());
                                        }
                                    } else {
                                        // No input found for sub-question ID
                                    }
                                }
                            }
                        });
                    }
                });
                
                // Second pass: Handle regular answers (non-concatenated)
                Object.keys(response.answers).forEach(questionId => {
                    const data = response.answers[questionId];
                    
                    // Skip concatenated data (already processed above)
                    const isConcatenatedData = data && data.value && data.value.includes(':') && /^\d+:/.test(data.value);
                    
                    if (data && this.isNonEmptyValue(data.value) && !isConcatenatedData) {
                        // Find the input element
                        let input = document.querySelector(`[data-sub-question-id="${questionId}"]`);
                        if (!input) {
                            // Look for actual input elements, not containers
                            input = document.querySelector(`input[id="q_${questionId}"], input[name='q_${questionId}'], input[data-question-id="${questionId}"], select[id="q_${questionId}"], select[name='q_${questionId}'], select[data-question-id="${questionId}"], textarea[id="q_${questionId}"], textarea[name='q_${questionId}'], textarea[data-question-id="${questionId}"]`);
                            
                            // If still not found, look within question containers
                            if (!input) {
                                const questionContainer = document.querySelector(`[data-question-id="${questionId}"]`);
                                if (questionContainer) {
                                    input = questionContainer.querySelector('input, select, textarea');
                                }
                            }
                        }
                        
                        if (input) {
                            // Set the input value with normalization per input type
                            if (input.type === 'radio') {
                                const radios = document.querySelectorAll(`input[name='${input.name}']`);
                                const target = Array.from(radios).find(r => String(r.value) === String(data.value));
                                if (target) target.checked = true;
                            } else if (input.type === 'checkbox') {
                                input.checked = (String(data.value) === 'true' || String(data.value) === String(input.value));
                            } else {
                                const normalized = this.normalizeValueForInput(data.value, input.type);
                                input.value = normalized;
                            }
                            
                            // Update visual indicator to show it's from database
                            this.updateSaveIndicator(questionId, 'database');
                            // Clear any stale local cache for this question
                            this.markAsSavedToDatabase(questionId);
                        } else {
                            // No input element found for a saved answer
                        }
                    }
                    
                    // Handle sub-question answers stored in concatenated format (both multiple and single)
                    if (data && data.value && data.value.includes(':') && /^\d+:/.test(data.value)) {
                        // Parse concatenated sub-question answers like "8375:pap;8376:pew" or "8371:2025-09-04"
                        const subAnswers = data.value.includes(';') ? data.value.split(';') : [data.value];
                        subAnswers.forEach(subAnswer => {
                            if (subAnswer.includes(':')) {
                                const [subQuestionId, answerValue] = subAnswer.split(':', 2);
                                if (subQuestionId && subQuestionId.trim() !== '') {
                                    // Find the input for this sub-question
                                    const subInput = document.querySelector(`[data-sub-question-id="${subQuestionId.trim()}"]`);
                                    if (subInput) {
                                        if (this.isNonEmptyValue(answerValue)) {
                                            // Set the answer value
                                            if (subInput.type === 'radio') {
                                                const radios = document.querySelectorAll(`input[name='${subInput.name}']`);
                                                const target = Array.from(radios).find(r => String(r.value) === String(answerValue));
                                                if (target) target.checked = true;
                                            } else if (subInput.type === 'checkbox') {
                                                subInput.checked = (String(answerValue) === 'true' || String(answerValue) === String(subInput.value));
                                            } else {
                                                const normalized = this.normalizeValueForInput(answerValue, subInput.type);
                                                subInput.value = normalized;
                                            }
                                            this.updateSaveIndicator(subQuestionId.trim(), 'database');
                                            this.markAsSavedToDatabase(subQuestionId.trim());
                                        } else {
                                            // Empty answer: clear input and remove from local cache
                                            if (subInput.type === 'radio' || subInput.type === 'checkbox') {
                                                subInput.checked = false;
                                            } else {
                                                subInput.value = '';
                                            }
                                            this.updateSaveIndicator(subQuestionId.trim(), 'none');
                                            // Remove from local cache
                                            const formData = this.getFormData();
                                            if (formData[subQuestionId.trim()]) {
                                                delete formData[subQuestionId.trim()];
                                                localStorage.setItem(this.storageKey, JSON.stringify(formData));
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    }
                });
                
                // Only restore local storage data for inputs that are still empty (unsaved changes)
                this.restoreFormDataOnlyEmpty();
                
                // Update progress bars after all data is loaded and restored
                setTimeout(() => {
                    this.updateProgressIndicators();
                }, 50);
                
                console.log('Database data loaded and local storage merged successfully');
            } else {
                console.log('No database answers found, using local storage data');
                // No database answers, just restore local storage data fully
                this.restoreFormData();
            }
        } catch (error) {
            console.log('Error loading saved answers from database:', error);
            console.log('Falling back to local storage only');
            // Fallback to local storage only
            this.restoreFormData();
        }
    }

    // Setup warning when user tries to close tab
    setupBeforeUnload() {
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedData) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes that are saved locally. Please do not clear your browser cache to preserve your data.';
                return e.returnValue;
            }
        });

        // Also warn on page unload
        window.addEventListener('unload', () => {
            if (this.hasUnsavedData) {
                // Show a more detailed message
                this.showNotification('Your data is saved locally. Do not clear browser cache!', 'warning');
            }
        });
    }

    // Start auto-save functionality
    startAutoSave() {
        this.autoSaveInterval = setInterval(() => {
            this.saveAllFormData();
        }, 30000); // Auto-save every 30 seconds
    }

    // Stop auto-save
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    // Save form data to local storage (handles empty by removing local cache)
    saveFormData(questionId, value, saveState = 'local') {
        try {
            const trimmed = (value ?? '').toString().trim();
            const formData = this.getFormData();

            if (trimmed === '') {
                // Remove local cache when value is cleared
                if (formData[questionId]) {
                    delete formData[questionId];
                    localStorage.setItem(this.storageKey, JSON.stringify(formData));
                }
                this.saveStates.delete(questionId);
                this.unsavedChanges.delete(questionId);
                this.updateSaveIndicator(questionId, 'none');
                this.updateProgressIndicators();
                return true;
            }

            formData[questionId] = {
                value: value,
                timestamp: new Date().toISOString(),
                saveState: saveState
            };
            localStorage.setItem(this.storageKey, JSON.stringify(formData));

            this.saveStates.set(questionId, saveState);
            this.hasUnsavedData = true;

            this.updateSaveIndicator(questionId, saveState);
            this.updateProgressIndicators();
            
            // Also save form state for refresh persistence
            if (window.dashboardUIManager && window.dashboardUIManager.saveFormState) {
                window.dashboardUIManager.saveFormState();
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    // Get all form data from local storage
    getFormData() {
        try {
            const data = localStorage.getItem(this.storageKey);
            const parsedData = data ? JSON.parse(data) : {};
            return parsedData;
        } catch (error) {
            return {};
        }
    }

    // Debug method to show current localStorage state
    debugLocalStorage() {
        // Also try to restore data immediately
        this.restoreFormData();
        this.restoreFormDataForForm('#quiz-form');
    }

    // Restore form data to inputs
    restoreFormData(onlyEmpty = false) {
        const formData = this.getFormData();
        const inputs = document.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            const questionId = this.getQuestionId(input);
            if (questionId && formData[questionId]) {
                const data = formData[questionId];
                
                // Only restore if it's not already filled or if onlyEmpty is true
                if (onlyEmpty && input.value && input.value.trim() !== '') {
                    return;
                }

                // Restore value
                if (input.type === 'radio') {
                    const radio = document.querySelector(`input[name="${input.name}"][value="${data.value}"]`);
                    if (radio) {
                        radio.checked = true;
                    }
                } else if (input.type === 'checkbox') {
                    input.checked = data.value === 'true';
                } else {
                    input.value = data.value;
                }
                
                // Update save state
                this.saveStates.set(questionId, data.saveState);
                this.updateSaveIndicator(questionId, data.saveState);
                
                // Mark as unsaved if it's local data
                if (data.saveState === 'local') {
                    this.unsavedChanges.add(questionId);
                }
            }
        });
        
        this.updateProgressIndicators();
        this.checkSectionCompletion();
    }

    // Restore data for a specific form (called when form is rendered)
    restoreFormDataForForm(formSelector = '#quiz-form') {
        const form = document.querySelector(formSelector);
        if (!form) {
            return;
        }

        const formData = this.getFormData();
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            const questionId = this.getQuestionId(input);
            if (questionId && formData[questionId]) {
                const data = formData[questionId];
                
                // Restore value
                if (input.type === 'radio') {
                    const radio = form.querySelector(`input[name="${input.name}"][value="${data.value}"]`);
                    if (radio) {
                        radio.checked = true;
                    }
                } else if (input.type === 'checkbox') {
                    input.checked = data.value === 'true';
                } else {
                    input.value = data.value;
                }
                
                // Update save state
                this.saveStates.set(questionId, data.saveState);
                this.updateSaveIndicator(questionId, data.saveState);
                
                // Mark as unsaved if it's local data
                if (data.saveState === 'local') {
                    this.unsavedChanges.add(questionId);
                }
            }
        });
        
        this.updateProgressIndicators();
        this.checkSectionCompletion();
    }

    // Restore data for the form container (used by user dashboard)
    restoreFormDataForContainer(forceRestore = false) {
        // Only restore if auto-restore is enabled or force restore is requested
        if (!this.autoRestoreEnabled && !forceRestore) {
            return;
        }
        
        const container = document.querySelector('.form-container');
        if (!container) {
            return;
        }

        const formData = this.getFormData();
        const inputs = container.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            const questionId = this.getQuestionId(input);
            if (questionId && formData[questionId]) {
                const data = formData[questionId];
                if (data.value && data.value.trim() !== '') {
                    // Restore value
                    if (input.type === 'radio') {
                        const radio = container.querySelector(`input[name="${input.name}"][value="${data.value}"]`);
                        if (radio) {
                            radio.checked = true;
                        }
                    } else if (input.type === 'checkbox') {
                        input.checked = data.value === 'true';
                    } else {
                        input.value = data.value;
                    }
                    
                    // Update save state
                    this.saveStates.set(questionId, data.saveState);
                    this.updateSaveIndicator(questionId, data.saveState);
                    
                    // Mark as unsaved if it's local data
                    if (data.saveState === 'local') {
                        this.unsavedChanges.add(questionId);
                    }
                }
            }
        });
        
        this.updateProgressIndicators();
        this.checkSectionCompletion();
    }

    // Restore local storage data only for empty inputs (used after database load)
    restoreFormDataOnlyEmpty() {
        const formData = this.getFormData();
        const inputs = document.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            const questionId = this.getQuestionId(input);
            if (questionId && formData[questionId]) {
                const data = formData[questionId];
                
                // Only restore if the input is currently empty/unchecked
                const isEmpty = (input.type === 'radio' || input.type === 'checkbox') ? 
                    !input.checked : 
                    (!input.value || input.value.trim() === '');
                
                if (isEmpty && data.value && data.value.trim() !== '') {
                    // Restore value
                    if (input.type === 'radio') {
                        const radio = document.querySelector(`input[name="${input.name}"][value="${data.value}"]`);
                        if (radio) {
                            radio.checked = true;
                        }
                    } else if (input.type === 'checkbox') {
                        input.checked = data.value === 'true';
                    } else {
                        input.value = data.value;
                    }
                    
                    // Update save state
                    this.saveStates.set(questionId, data.saveState);
                    this.updateSaveIndicator(questionId, data.saveState);
                    
                    // Mark as unsaved if it's local data
                    if (data.saveState === 'local') {
                        this.unsavedChanges.add(questionId);
                    }
                    
                    console.log(`Restored local data for empty input ${questionId}: ${data.value}`);
                }
            }
        });
        
        this.updateProgressIndicators();
        this.checkSectionCompletion();
    }

    // Get question ID from input element
    getQuestionId(input) {
        // Check if this is a sub-question input by looking at the class
        const isSubQuestion = input.classList.contains('sub-question-input');
        
        if (isSubQuestion) {
            // For sub-questions, use the sub-question ID
            const subQuestionId = input.getAttribute('data-sub-question-id');
            if (subQuestionId) {
                return subQuestionId;
            }
        }
        
        // For regular questions, use the question ID
        const questionId = input.id?.replace('q_', '') || 
                          input.name?.replace('q_', '') || 
                          input.getAttribute('data-question-id');
        
        return questionId;
    }

    // Update save indicator for a specific question
    updateSaveIndicator(questionId, saveState) {
        // Try to find input by sub-question ID first, then by regular question ID
        let input = document.querySelector(`[data-sub-question-id="${questionId}"]`);
        if (!input) {
            input = document.querySelector(`[id="q_${questionId}"], [name='q_${questionId}'], [data-question-id="${questionId}"]`);
        }
        if (!input) return;

        // Remove existing save state classes from input
        input.classList.remove('saved-local', 'saved-database', 'saved-unsaved');
        
        // Find and update question label
        let questionLabel = null;
        if (input.closest('.question-container')) {
            questionLabel = input.closest('.question-container').querySelector('.question-label');
        } else if (input.closest('.sub-question-item')) {
            questionLabel = input.closest('.sub-question-item').querySelector('.sub-question-label');
        }
        
        // Remove existing save state classes from label
        if (questionLabel) {
            questionLabel.classList.remove('saved-local', 'saved-database', 'saved-unsaved');
        }
        
        // Add appropriate class based on save state
        switch (saveState) {
            case 'none':
                // Cleared state: remove icons and classes
                if (questionLabel) questionLabel.classList.remove('saved-local', 'saved-database', 'saved-unsaved');
                // Remove existing save icon
                const existing = input.parentNode.querySelector('.save-status-icon');
                if (existing) existing.remove();
                break;
            case 'local':
                input.classList.add('saved-local');
                if (questionLabel) questionLabel.classList.add('saved-local');
                this.addSaveIcon(input, '🔄', 'Saved locally - Will sync to server');
                break;
            case 'database':
                input.classList.add('saved-database');
                if (questionLabel) questionLabel.classList.add('saved-database');
                this.addSaveIcon(input, '💾', 'Saved to database');
                break;
            case 'unsaved':
                input.classList.add('saved-unsaved');
                if (questionLabel) questionLabel.classList.add('saved-unsaved');
                this.addSaveIcon(input, '⏳', 'Unsaved changes');
                break;
        }
        
        // Update tooltip for sub-questions
        this.updateSubQuestionTooltipOnRestore(input, saveState);
    }

    // Add save icon to input
    addSaveIcon(input, icon, title) {
        // Remove existing save icon
        const existingIcon = input.parentNode.querySelector('.save-status-icon');
        if (existingIcon) {
            existingIcon.remove();
        }

        // Create new save icon
        const saveIcon = document.createElement('span');
        saveIcon.className = 'save-status-icon';
        saveIcon.innerHTML = icon;
        saveIcon.title = title;
        saveIcon.style.cssText = `
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 14px;
            pointer-events: auto;
            z-index: 10;
            cursor: help;
        `;

        // Position the icon relative to input
        const inputContainer = input.parentNode;
        if (inputContainer.style.position !== 'relative') {
            inputContainer.style.position = 'relative';
        }
        
        inputContainer.appendChild(saveIcon);
        
        // Update tooltip for sub-question if it exists
        this.updateSubQuestionTooltip(input, title);
    }
    
    // Update tooltip for sub-question container
    updateSubQuestionTooltip(input, statusMessage) {
        // Find the sub-question container (parent of the input)
        const subQuestionContainer = input.closest('.sub-question-item');
        if (subQuestionContainer) {
            // Remove any existing title attributes from all elements
            const subQuestionHeader = subQuestionContainer.querySelector('.sub-question-header');
            if (subQuestionHeader) {
                subQuestionHeader.removeAttribute('title');
            }
            
            const subQuestionNumber = subQuestionContainer.querySelector('.sub-question-number');
            if (subQuestionNumber) {
                subQuestionNumber.removeAttribute('title');
            }
            
            const subQuestionLabel = subQuestionContainer.querySelector('.sub-question-label');
            if (subQuestionLabel) {
                subQuestionLabel.removeAttribute('title');
            }
        }
    }
    
    // Update tooltip for sub-question on data restoration
    updateSubQuestionTooltipOnRestore(input, saveState) {
        let statusMessage = '';
        switch (saveState) {
            case 'local':
                statusMessage = 'Saved locally - Will sync to server';
                break;
            case 'database':
                statusMessage = 'Saved to database';
                break;
            case 'unsaved':
                statusMessage = 'Unsaved changes';
                break;
        }
        this.updateSubQuestionTooltip(input, statusMessage);
    }

    // Update progress indicators
    updateProgressIndicators() {
        const formData = this.getFormData();
        const allInputs = document.querySelectorAll('input, select, textarea');
        const totalQuestions = allInputs.length;
        
        // Count inputs that have values (either from database or local storage)
        let answeredQuestions = 0;
        let localCount = 0;
        let databaseCount = 0;
        
        allInputs.forEach(input => {
            const questionId = this.getQuestionId(input);
            const hasValue = input.type === 'radio' || input.type === 'checkbox' ? 
                input.checked : (input.value && input.value.trim() !== '');
            
            if (hasValue) {
                answeredQuestions++;
                
                // Check if this is from local storage or database
                const localData = formData[questionId];
                if (localData && localData.saveState === 'local') {
                    localCount++;
                } else if (hasValue) {
                    // If it has a value but not in localStorage, it's from database
                    databaseCount++;
                }
            }
        });
        
        const progressPercentage = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

        // Update progress bar
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.background = `conic-gradient(var(--success) 0% ${progressPercentage}%, var(--background) ${progressPercentage}% 100%)`;
            progressBar.setAttribute('data-progress', progressPercentage);
        }

        // Update progress text
        const progressText = document.querySelector('.progress-text span');
        if (progressText) {
            progressText.textContent = `${progressPercentage}%`;
        }

        // Update dashboard stats
        const answeredCountElement = document.getElementById('answered-count');
        const savedCountElement = document.getElementById('saved-count');
        const databaseCountElement = document.getElementById('database-count');

        if (answeredCountElement) answeredCountElement.textContent = answeredQuestions;
        if (savedCountElement) savedCountElement.textContent = localCount;
        if (databaseCountElement) databaseCountElement.textContent = databaseCount;

        // Update answered count in other locations
        const answeredCount = document.querySelector('.answered-questions');
        if (answeredCount) {
            answeredCount.innerHTML = `<i class="fas fa-check-circle"></i> ${answeredQuestions} answered`;
        }

        // Update topic progress bars
        this.updateTopicProgressBars();
        
        // Also update progress bars using user_dash_api method for consistency
        if (window.dashboardUIManager && window.dashboardUIManager.updateProgress) {
            window.dashboardUIManager.updateProgress();
        }
        
        // Check section completion and update visual indicators
        this.checkSectionCompletion();
        
        // Save form state for refresh persistence
        if (window.dashboardUIManager && window.dashboardUIManager.saveFormState) {
            window.dashboardUIManager.saveFormState();
        }
    }

    // Update topic-specific progress bars
    updateTopicProgressBars() {
        const topicContainers = document.querySelectorAll('.topic-progress-bar-container');
        
        topicContainers.forEach(container => {
            const topicId = container.getAttribute('data-topic-id');
            if (!topicId) return;

            // Find inputs in the parent topic group, not within the progress bar container
            const topicGroup = container.closest('.topic-group');
            if (!topicGroup) return;
            
            const inputs = topicGroup.querySelectorAll('.question-input, .sub-question-input');
            const totalInputs = inputs.length;
            let answeredInputs = 0;

            inputs.forEach(input => {
                // Count based on actual DOM value/checked state, regardless of localStorage
                const hasValue = input.type === 'radio' || input.type === 'checkbox'
                    ? input.checked
                    : (input.value && input.value.trim() !== '');
                if (hasValue) {
                    answeredInputs++;
                }
            });

            const progressPercentage = totalInputs > 0 ? Math.round((answeredInputs / totalInputs) * 100) : 0;
                        
            const progressFill = container.querySelector('.topic-progress-bar-fill');
            if (progressFill) {
                progressFill.style.width = `${progressPercentage}%`;
            }

            const progressLabel = container.querySelector('.topic-progress-label');
            if (progressLabel) {
                progressLabel.textContent = `${answeredInputs} / ${totalInputs} answered`;
            }
        });
    }

    // Save all form data
    saveAllFormData() {
        const inputs = document.querySelectorAll('input, select, textarea');
        let savedCount = 0;

        inputs.forEach(input => {
            const questionId = this.getQuestionId(input);
            if (!questionId) return;

            let value = '';
            if (input.type === 'radio') {
                const checkedRadio = document.querySelector(`input[name="${input.name}"]:checked`);
                value = checkedRadio ? checkedRadio.value : '';
            } else if (input.type === 'checkbox') {
                value = input.checked ? 'true' : 'false';
            } else {
                value = input.value;
            }

            if (value && value.trim() !== '') {
                this.saveFormData(questionId, value, 'local');
                savedCount++;
            }
        });

        if (savedCount > 0) {
            this.showNotification(`${savedCount} answers auto-saved locally`, 'info');
        }
    }

    // Mark data as saved to database and remove from localStorage
    markAsSavedToDatabase(questionId) {
        const formData = this.getFormData();
        if (formData[questionId]) {
            // Remove the data from localStorage since it's now in the database
            delete formData[questionId];
            localStorage.setItem(this.storageKey, JSON.stringify(formData));
            
            // Update in-memory state
            this.saveStates.delete(questionId);
            this.unsavedChanges.delete(questionId);
            
            // Update visual indicator to show it's saved to database
            // Note: The input will still show the value because it's loaded from database
            this.updateSaveIndicator(questionId, 'database');
        }
    }

    // Clear all locally saved answers while preserving input values (mark as database)
    clearAllLocalSavedAnswers() {
        try {
            const formData = this.getFormData();
            const questionIds = Object.keys(formData);
            if (questionIds.length === 0) {
                this.hasUnsavedData = false;
                return;
            }
            questionIds.forEach((qid) => {
                this.markAsSavedToDatabase(qid);
            });
            this.hasUnsavedData = false;
            this.updateProgressIndicators();
        } catch (error) {
            // No-op on failure; better to keep local data than lose it
        }
    }

    // Mark data as having unsaved changes
    markAsUnsaved(questionId) {
        const formData = this.getFormData();
        if (formData[questionId]) {
            formData[questionId].saveState = 'unsaved';
            formData[questionId].timestamp = new Date().toISOString();
            localStorage.setItem(this.storageKey, JSON.stringify(formData));
            
            this.saveStates.set(questionId, 'unsaved');
            this.updateSaveIndicator(questionId, 'unsaved');
            this.unsavedChanges.add(questionId);
            this.hasUnsavedData = true;
        }
    }

    // Clear form data
    clearFormData() {
        try {
            // Clear localStorage
            localStorage.removeItem(this.storageKey);
            
            // Clear in-memory data
            this.saveStates.clear();
            this.unsavedChanges.clear();
            
            // Update all form inputs
            const inputs = document.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                if (input.type === 'radio' || input.type === 'checkbox') {
                    input.checked = false;
                } else {
                    input.value = '';
                }
                
                // Remove save state classes from input
                input.classList.remove('saved-local', 'saved-database', 'saved-unsaved');
                
                // Remove save state classes from question labels
                let questionLabel = null;
                if (input.closest('.question-container')) {
                    questionLabel = input.closest('.question-container').querySelector('.question-label');
                } else if (input.closest('.sub-question-item')) {
                    questionLabel = input.closest('.sub-question-item').querySelector('.sub-question-label');
                }
                
                if (questionLabel) {
                    questionLabel.classList.remove('saved-local', 'saved-database', 'saved-unsaved');
                }
                
                // Remove save icons
                const existingIcon = input.parentNode.querySelector('.save-status-icon');
                if (existingIcon) {
                    existingIcon.remove();
                }
            });
            
            // Update progress indicators
            this.updateProgressIndicators();
            this.checkSectionCompletion();
            
            this.showNotification('Form data cleared successfully', 'success');
            // Form data cleared successfully
            
        } catch (error) {
            // Error clearing form data
            this.showNotification('Error clearing form data', 'error');
        }
    }

    // Force refresh form data from server
    async forceRefreshFormData() {
        try {
            this.showNotification('Refreshing form data from server...', 'info');
            
            // Clear current data
            this.clearFormData();
            
            // Reload the page to get fresh data from server
            window.location.reload();
            
        } catch (error) {
            // Error refreshing form data
            this.showNotification('Error refreshing form data', 'error');
        }
    }

    // Show confirmation dialog for clearing data
    showClearDataConfirmation() {
        const modal = this.createConfirmationModal(
            'Clear All Data',
            'Are you sure you want to clear all form data? This action will:',
            [
                '• Remove all your answers from the form',
                '• Clear all locally saved data',
                '• Reset all progress indicators',
                '• This action cannot be undone'
            ],
            'Clear All Data',
            'Cancel',
            'danger'
        );

        modal.confirmButton.addEventListener('click', () => {
            this.clearFormData();
            this.closeModal(modal);
        });

        modal.cancelButton.addEventListener('click', () => {
            this.closeModal(modal);
        });

        // Close modal when clicking outside or pressing Escape
        modal.overlay.addEventListener('click', (e) => {
            if (e.target === modal.overlay) {
                this.closeModal(modal);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modal);
            }
        });
    }

    // Create a reusable confirmation modal
    createConfirmationModal(title, message, details = [], confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning') {
        const modal = document.createElement('div');
        modal.className = 'confirmation-modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;

        const modalContent = document.createElement('div');
        modalContent.className = 'confirmation-modal-content';
        modalContent.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            animation: slideIn 0.3s ease;
        `;

        // Icon based on type
        const iconMap = {
            'danger': 'fas fa-exclamation-triangle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle',
            'success': 'fas fa-check-circle'
        };

        const colorMap = {
            'danger': '#dc3545',
            'warning': '#ffc107',
            'info': '#17a2b8',
            'success': '#28a745'
        };

        const icon = iconMap[type] || iconMap.warning;
        const color = colorMap[type] || colorMap.warning;

        modalContent.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
                <i class="${icon}" style="font-size: 24px; color: ${color}; margin-right: 12px;"></i>
                <h3 style="margin: 0; color: #333; font-size: 18px;">${title}</h3>
            </div>
            <p style="margin: 0 0 16px 0; color: #666; line-height: 1.5;">${message}</p>
            ${details.length > 0 ? `
                <div style="background: #f8f9fa; padding: 12px; border-radius: 4px; margin-bottom: 20px;">
                    ${details.map(detail => `<div style="color: #495057; margin-bottom: 4px;">${detail}</div>`).join('')}
                </div>
            ` : ''}
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button class="cancel-btn" style="
                    padding: 8px 16px;
                    border: 1px solid #ddd;
                    background: white;
                    color: #666;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">${cancelText}</button>
                <button class="confirm-btn" style="
                    padding: 8px 16px;
                    border: none;
                    background: ${color};
                    color: white;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                ">${confirmText}</button>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Add CSS animations
        if (!document.querySelector('#modal-styles')) {
            const style = document.createElement('style');
            style.id = 'modal-styles';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideIn {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .confirmation-modal-overlay {
                    backdrop-filter: blur(2px);
                }
                .confirmation-modal-content {
                    border: 1px solid #e9ecef;
                }
                .cancel-btn:hover {
                    background: #f8f9fa !important;
                }
                .confirm-btn:hover {
                    opacity: 0.9;
                }
            `;
            document.head.appendChild(style);
        }

        return {
            overlay: modal,
            content: modalContent,
            confirmButton: modalContent.querySelector('.confirm-btn'),
            cancelButton: modalContent.querySelector('.cancel-btn')
        };
    }

    // Close modal
    closeModal(modal) {
        if (modal && modal.overlay) {
            modal.overlay.remove();
        }
    }

    // Get unsaved changes count
    getUnsavedChangesCount() {
        return this.unsavedChanges.size;
    }

    // Check if there are any unsaved changes
    hasUnsavedChanges() {
        return this.unsavedChanges.size > 0;
    }

    // Check if a section is complete and update visual indicators
    checkSectionCompletion() {
        this.checkTopicCompletion();
        this.checkCategoryCompletion();
        this.checkSubSectionCompletion();
        this.checkQuestionCompletion();
        this.checkSubQuestionCompletion();
    }

    // Check if a topic is complete (all questions answered)
    checkTopicCompletion() {
        const topicContainers = document.querySelectorAll('.topic-progress-bar-container');
        
        topicContainers.forEach(container => {
            const topicId = container.getAttribute('data-topic-id');
            if (!topicId) return;

            // Find inputs in the parent topic group, not within the progress bar container
            const topicGroup = container.closest('.topic-group');
            if (!topicGroup) return;
            
            const inputs = topicGroup.querySelectorAll('.question-input, .sub-question-input');
            const totalInputs = inputs.length;
            let answeredInputs = 0;

            inputs.forEach(input => {
                const questionId = this.getQuestionId(input);
                if (questionId && this.getFormData()[questionId] && this.getFormData()[questionId].value.trim() !== '') {
                    answeredInputs++;
                }
            });

            const isComplete = answeredInputs === totalInputs && totalInputs > 0;
            
            // Update topic container styling
            const topicBlock = container.closest('.sneat-topic-block');
            if (topicBlock) {
                if (isComplete) {
                    topicBlock.classList.add('completed');
                    topicBlock.style.border = '2px solid #10b981'; // Green border
                    topicBlock.style.backgroundColor = '#f0fdf4'; // Light green background
                    
                    // Add completion indicator
                    let completionIndicator = topicBlock.querySelector('.completion-indicator');
                    if (!completionIndicator) {
                        completionIndicator = document.createElement('div');
                        completionIndicator.className = 'completion-indicator';
                        completionIndicator.innerHTML = '<i class="fas fa-check-circle"></i> Complete';
                        completionIndicator.style.cssText = `
                            position: absolute;
                            top: 10px;
                            right: 10px;
                            background: #10b981;
                            color: white;
                            padding: 4px 8px;
                            border-radius: 12px;
                            font-size: 12px;
                            font-weight: 600;
                        `;
                        topicBlock.style.position = 'relative';
                        topicBlock.appendChild(completionIndicator);
                    }
                    
                    // Show completion notification (only if not already completed)
                    const topicTitle = topicBlock.querySelector('.sneat-topic-title')?.textContent || 'Unknown';
                    const topicKey = `topic-${topicTitle}`;
                    if (!this.completedSections.has(topicKey)) {
                        this.completedSections.add(topicKey);
                        this.showNotification(`Topic "${topicTitle}" completed!`, 'success');
                    }
                    
                    // Auto-collapse after a delay
                    setTimeout(() => {
                        if (isComplete && !topicBlock.classList.contains('user-interacting')) {
                            this.collapseTopic(topicBlock);
                        }
                    }, 2000);
                } else {
                    topicBlock.classList.remove('completed');
                    topicBlock.style.border = '';
                    topicBlock.style.backgroundColor = '';
                    
                    const completionIndicator = topicBlock.querySelector('.completion-indicator');
                    if (completionIndicator) {
                        completionIndicator.remove();
                    }
                }
            }
        });
    }

    // Check if a category is complete (all sub-sections complete)
    checkCategoryCompletion() {
        const categoryCards = document.querySelectorAll('.sneat-category-card');
        
        categoryCards.forEach(card => {
            const categoryName = card.getAttribute('data-category');
            if (!categoryName) return;

            // Find all sub-sections in this category
            const subSections = document.querySelectorAll(`[data-category="${categoryName}"]`);
            let totalSubSections = 0;
            let completedSubSections = 0;

            subSections.forEach(subSection => {
                if (subSection.classList.contains('sneat-subsection-panel')) {
                    totalSubSections++;
                    if (this.isSubSectionComplete(subSection)) {
                        completedSubSections++;
                    }
                }
            });

            const isComplete = completedSubSections === totalSubSections && totalSubSections > 0;
            
            if (isComplete) {
                card.classList.add('completed');
                card.style.border = '2px solid #10b981';
                card.style.backgroundColor = '#f0fdf4';
                
                // Add completion indicator
                let completionIndicator = card.querySelector('.completion-indicator');
                if (!completionIndicator) {
                    completionIndicator = document.createElement('div');
                    completionIndicator.className = 'completion-indicator';
                    completionIndicator.innerHTML = '<i class="fas fa-check-circle"></i> Complete';
                    completionIndicator.style.cssText = `
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        background: #10b981;
                        color: white;
                        padding: 4px 8px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 600;
                    `;
                    card.style.position = 'relative';
                    card.appendChild(completionIndicator);
                    
                    // Show completion notification (only if not already completed)
                    const categoryKey = `category-${categoryName}`;
                    if (!this.completedSections.has(categoryKey)) {
                        this.completedSections.add(categoryKey);
                        this.showNotification(`Category "${categoryName}" completed!`, 'success');
                    }
                }
            } else {
                card.classList.remove('completed');
                card.style.border = '';
                card.style.backgroundColor = '';
                
                const completionIndicator = card.querySelector('.completion-indicator');
                if (completionIndicator) {
                    completionIndicator.remove();
                }
            }
        });
    }

    // Check if a sub-section is complete (all topics complete)
    checkSubSectionCompletion() {
        const subSectionPanels = document.querySelectorAll('.sneat-subsection-panel');
        
        subSectionPanels.forEach(panel => {
            const categoryName = panel.getAttribute('data-category');
            const subSectionName = panel.getAttribute('data-subsection');
            if (!categoryName || !subSectionName) return;

            // Find all topics in this sub-section
            const topics = document.querySelectorAll(`[data-category="${categoryName}"][data-subsection="${subSectionName}"]`);
            let totalTopics = 0;
            let completedTopics = 0;

            topics.forEach(topic => {
                if (topic.classList.contains('sneat-topic-block')) {
                    totalTopics++;
                    if (topic.classList.contains('completed')) {
                        completedTopics++;
                    }
                }
            });

            const isComplete = completedTopics === totalTopics && totalTopics > 0;
            
            if (isComplete) {
                panel.classList.add('completed');
                panel.style.border = '2px solid #10b981';
                panel.style.backgroundColor = '#f0fdf4';
                
                // Add completion indicator
                let completionIndicator = panel.querySelector('.completion-indicator');
                if (!completionIndicator) {
                    completionIndicator = document.createElement('div');
                    completionIndicator.className = 'completion-indicator';
                    completionIndicator.innerHTML = '<i class="fas fa-check-circle"></i> Complete';
                    completionIndicator.style.cssText = `
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        background: #10b981;
                        color: white;
                        padding: 4px 8px;
                        border-radius: 12px;
                        font-size: 12px;
                        font-weight: 600;
                    `;
                    panel.style.position = 'relative';
                    panel.appendChild(completionIndicator);
                    
                    // Show completion notification (only if not already completed)
                    const subSectionKey = `subsection-${subSectionName}`;
                    if (!this.completedSections.has(subSectionKey)) {
                        this.completedSections.add(subSectionKey);
                        this.showNotification(`Sub-section "${subSectionName}" completed!`, 'success');
                    }
                }
            } else {
                panel.classList.remove('completed');
                panel.style.border = '';
                panel.style.backgroundColor = '';
                
                const completionIndicator = panel.querySelector('.completion-indicator');
                if (completionIndicator) {
                    completionIndicator.remove();
                }
            }
        });
    }

    // Check if a question is complete
    checkQuestionCompletion() {
        const questionCards = document.querySelectorAll('.quiz-card');
        
        questionCards.forEach(card => {
            const inputs = card.querySelectorAll('input, select, textarea');
            let isComplete = false;

            inputs.forEach(input => {
                const questionId = this.getQuestionId(input);
                if (questionId && this.getFormData()[questionId] && this.getFormData()[questionId].value.trim() !== '') {
                    isComplete = true;
                }
            });

            if (isComplete) {
                card.classList.add('completed');
                card.style.border = '2px solid #10b981';
                card.style.backgroundColor = '#f0fdf4';
                
                // Add completion indicator
                let completionIndicator = card.querySelector('.completion-indicator');
                if (!completionIndicator) {
                    completionIndicator = document.createElement('div');
                    completionIndicator.className = 'completion-indicator';
                    completionIndicator.innerHTML = '<i class="fas fa-check-circle"></i>';
                    completionIndicator.style.cssText = `
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        background: #10b981;
                        color: white;
                        padding: 4px;
                        border-radius: 50%;
                        font-size: 12px;
                        width: 20px;
                        height: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    `;
                    card.style.position = 'relative';
                    card.appendChild(completionIndicator);
                }
            } else {
                card.classList.remove('completed');
                card.style.border = '';
                card.style.backgroundColor = '';
                
                const completionIndicator = card.querySelector('.completion-indicator');
                if (completionIndicator) {
                    completionIndicator.remove();
                }
            }
        });
    }

    // Check if a sub-question is complete
    checkSubQuestionCompletion() {
        const subQuestionItems = document.querySelectorAll('.sub-question-item');
        
        subQuestionItems.forEach(item => {
            const inputs = item.querySelectorAll('input, select, textarea');
            let isComplete = false;

            inputs.forEach(input => {
                const questionId = this.getQuestionId(input);
                if (questionId && this.getFormData()[questionId] && this.getFormData()[questionId].value.trim() !== '') {
                    isComplete = true;
                }
            });

            if (isComplete) {
                item.classList.add('completed');
                item.style.border = '2px solid #10b981';
                item.style.backgroundColor = '#f0fdf4';
                
                // Add completion indicator
                let completionIndicator = item.querySelector('.completion-indicator');
                if (!completionIndicator) {
                    completionIndicator = document.createElement('div');
                    completionIndicator.className = 'completion-indicator';
                    completionIndicator.innerHTML = '<i class="fas fa-check-circle"></i>';
                    completionIndicator.style.cssText = `
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        background: #10b981;
                        color: white;
                        padding: 4px;
                        border-radius: 50%;
                        font-size: 12px;
                        width: 20px;
                        height: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    `;
                    item.style.position = 'relative';
                    item.appendChild(completionIndicator);
                }
            } else {
                item.classList.remove('completed');
                item.style.border = '';
                item.style.backgroundColor = '';
                
                const completionIndicator = item.querySelector('.completion-indicator');
                if (completionIndicator) {
                    completionIndicator.remove();
                }
            }
        });
    }

    // Helper method to check if a sub-section is complete
    isSubSectionComplete(subSection) {
        const categoryName = subSection.getAttribute('data-category');
        const subSectionName = subSection.getAttribute('data-subsection');
        if (!categoryName || !subSectionName) return false;

        // Find all topics in this sub-section
        const topics = document.querySelectorAll(`[data-category="${categoryName}"][data-subsection="${subSectionName}"]`);
        let totalTopics = 0;
        let completedTopics = 0;

        topics.forEach(topic => {
            if (topic.classList.contains('sneat-topic-block')) {
                totalTopics++;
                if (topic.classList.contains('completed')) {
                    completedTopics++;
                }
            }
        });

        return completedTopics === totalTopics && totalTopics > 0;
    }

    // Collapse a completed topic
    collapseTopic(topicBlock) {
        const questionList = document.getElementById('question-list');
        if (questionList && questionList.style.display === '') {
            // If we're currently viewing this topic's questions, go back to topics
            const backButton = document.getElementById('back-to-topics');
            if (backButton) {
                backButton.click();
            }
        }
    }

    // Enhanced form submission with database-first approach and offline fallback
    async submitFormAnswer(questionId, answer, subQuestionId = null) {
        try {
            console.log(`Attempting to submit answer for question ${questionId}${subQuestionId ? ` (sub: ${subQuestionId})` : ''}: ${answer}`);
            
            // Get user information from localStorage
            const userData = localStorage.getItem('user');
            let user_id = null;
            if (userData) {
                try {
                    const user = JSON.parse(userData);
                    user_id = user.id || user.user_id;
                } catch (e) {
                    console.log('Could not parse user data from localStorage');
                }
            }

            const formData = {
                question_id: questionId,
                sub_question_id: subQuestionId ? subQuestionId : null,
                answer: answer,
                user_id: user_id
            };

            // Try to submit to database first (DATABASE PRIORITY)
            try {
                const response = await fetch('/api/form/submit/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        console.log(`Successfully saved to database: ${questionId}`);
                        // Mark as saved to database and remove from local storage
                        const storageKey = subQuestionId ? subQuestionId.toString() : questionId.toString();
                        this.markAsSavedToDatabase(storageKey);
                        this.showNotification('Answer saved to database', 'success');
                        return { success: true, database: true };
                    } else {
                        throw new Error(result.message || 'Database save failed');
                    }
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (networkError) {
                console.log(`Database submission failed (${networkError.message}), falling back to local storage`);
                
                // OFFLINE FALLBACK: Save to local storage
                const storageKey = subQuestionId ? subQuestionId.toString() : questionId.toString();
                const saved = this.saveFormData(storageKey, answer, 'local');
                
                if (saved) {
                    this.showNotification('No internet connection. Answer saved locally and will sync when connection is restored.', 'warning');
                    this.hasUnsavedData = true;
                    
                    // Schedule automatic sync attempt
                    this.scheduleAutoSync();
                    
                    return { success: true, offline: true, message: 'Data saved offline' };
                } else {
                    throw new Error('Failed to save locally');
                }
            }
        } catch (error) {
            console.error('Complete submission failure:', error);
            this.showNotification(`Failed to save answer: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    // Save form data to database (batch operation)
    async saveToDatabase() {
        try {
            const formData = this.getFormData();
            const answers = [];
            
            // Convert form data to the format expected by the server
            Object.keys(formData).forEach(questionId => {
                const data = formData[questionId];
                if (data && data.value && data.value.trim() !== '') {
                    answers.push({
                        question_id: parseInt(questionId),
                        answer: data.value
                    });
                }
            });

            if (answers.length === 0) {
                this.showNotification('No data to save', 'warning');
                return false;
            }

            // Send each answer individually to database
            let successCount = 0;
            let errorCount = 0;
            let invalidQuestionIds = [];
            
            // Get user information from localStorage
            const userData = localStorage.getItem('user');
            let user_id = null;
            if (userData) {
                try {
                    const user = JSON.parse(userData);
                    user_id = user.id || user.user_id;
                } catch (e) {
                    console.log('Could not parse user data from localStorage');
                }
            }
            
            for (const answer of answers) {
                try {
                    const response = await fetch('/api/form/submit/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            question_id: answer.question_id,
                            answer: answer.answer,
                            user_id: user_id
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (result.success) {
                            successCount++;
                            this.markAsSavedToDatabase(answer.question_id.toString());
                        } else {
                            errorCount++;
                            if (result.message && result.message.includes('does not exist')) {
                                invalidQuestionIds.push(answer.question_id);
                            }
                        }
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error(`Error submitting answer for question ${answer.question_id}:`, error);
                    errorCount++;
                }
            }
            
            // Clean up invalid question IDs
            if (invalidQuestionIds.length > 0) {
                invalidQuestionIds.forEach(questionId => {
                    const formData = this.getFormData();
                    delete formData[questionId];
                    localStorage.setItem(this.storageKey, JSON.stringify(formData));
                });
                this.showNotification(`Cleaned up ${invalidQuestionIds.length} invalid question entries`, 'warning');
            }
            
            if (successCount > 0) {
                this.showNotification(`${successCount} answers saved to database successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`, 'success');
                // Clear all locally saved answers after successful database save
                this.clearAllLocalSavedAnswers();
                return true;
            } else {
                throw new Error(`Failed to save any answers. ${errorCount} errors occurred.`);
            }
        } catch (error) {
            console.error('Error saving to database:', error);
            this.showNotification(`Error saving to database: ${error.message}`, 'error');
            return false;
        }
    }

    // Batch submit all form data
    async batchSubmitFormData() {
        try {
            this.showNotification('Saving all data to database...', 'info');
            
            const success = await this.saveToDatabase();
            
            if (success) {
                // Update progress indicators after successful save
                this.updateProgressIndicators();
                this.checkSectionCompletion();
            }
            
            return success;
        } catch (error) {
            // Error in batch submit
            this.showNotification('Error during batch submit', 'error');
            return false;
        }
    }

    // Get CSRF token from cookies
    getCSRFToken() {
        const name = 'csrftoken';
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

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification-toast ${type}`;
        notification.innerHTML = `
            <i class="${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove notification after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // Get notification icon
    getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'fas fa-check-circle';
            case 'error': return 'fas fa-exclamation-circle';
            case 'warning': return 'fas fa-exclamation-triangle';
            case 'info': return 'fas fa-info-circle';
            case 'help': return 'fas fa-question-circle';
            case 'tip': return 'fas fa-lightbulb';
            default: return 'fas fa-info-circle';
        }
    }

    // Enhanced contextual help system
    showContextualHelp(element, helpData) {
        const existingHelp = document.querySelector('.contextual-help');
        if (existingHelp) {
            existingHelp.remove();
            return;
        }

        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'help-modal-backdrop';
        
        // Create modal container
        const helpContainer = document.createElement('div');
        helpContainer.className = 'contextual-help';
        helpContainer.innerHTML = `
            <div class="help-content">
                <div class="help-header">
                    <i class="fas fa-question-circle"></i>
                    <span class="help-title">${helpData.title || 'Help'}</span>
                    <button class="help-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="help-body">
                    <p class="help-description">${helpData.description}</p>
                    ${helpData.examples ? `
                        <div class="help-examples">
                            <strong>Examples:</strong>
                            <ul>
                                ${helpData.examples.map(ex => `<li>${ex}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    ${helpData.tips ? `
                        <div class="help-tips">
                            <strong>Tips:</strong>
                            <ul>
                                ${helpData.tips.map(tip => `<li><i class="fas fa-lightbulb"></i> ${tip}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Add backdrop to body
        document.body.appendChild(backdrop);
        // Add modal to backdrop
        backdrop.appendChild(helpContainer);
        
        // Close modal function
        const closeModal = () => {
            backdrop.remove();
        };
        
        // Close on backdrop click
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                closeModal();
            }
        });
        
        // Close on close button click
        const closeButton = helpContainer.querySelector('.help-close');
        closeButton.addEventListener('click', closeModal);
        
        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Auto-hide after 15 seconds
        setTimeout(() => {
            if (document.body.contains(backdrop)) {
                closeModal();
            }
        }, 15000);
    }

    // Smart input assistance
    addSmartInputAssistance(input) {
        const questionId = this.getQuestionId(input);
        if (!questionId) return;

        // Add input validation
        input.addEventListener('input', (e) => {
            this.validateInputSmart(e.target);
        });
    }

    // Smart input validation
    validateInputSmart(input) {
        const value = input.value.trim();
        const inputType = input.type;
        let isValid = true;
        let message = '';

        // Remove existing validation indicators
        this.removeValidationIndicators(input);

        if (value === '') {
            this.addValidationIndicator(input, 'neutral', 'Field is empty');
            return;
        }

        switch (inputType) {
            case 'number':
                const num = parseFloat(value);
                if (isNaN(num)) {
                    isValid = false;
                    message = 'Please enter a valid number';
                } else if (input.hasAttribute('min') && num < parseFloat(input.min)) {
                    isValid = false;
                    message = `Value must be at least ${input.min}`;
                } else if (input.hasAttribute('max') && num > parseFloat(input.max)) {
                    isValid = false;
                    message = `Value must be at most ${input.max}`;
                } else {
                    message = 'Valid number entered';
                }
                break;
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    isValid = false;
                    message = 'Please enter a valid email address';
                } else {
                    message = 'Valid email format';
                }
                break;
            case 'text':
                // Removed minimum length validation
                if (value.length > 500) {
                    isValid = false;
                    message = 'Text is too long (max 500 characters)';
                } else {
                    message = 'Valid text entered';
                }
                break;
        }

        this.addValidationIndicator(input, isValid ? 'valid' : 'invalid', message);
    }

    // Add validation indicator as tooltip
    addValidationIndicator(input, type, message) {
        // Remove any existing tooltip
        input.removeAttribute('title');
        input.removeAttribute('data-validation-tooltip');
        
        // Add tooltip with validation message
        input.setAttribute('title', message);
        input.setAttribute('data-validation-tooltip', type);
        
        // Add CSS class for styling based on validation type
        input.classList.remove('validation-valid', 'validation-invalid', 'validation-neutral');
        input.classList.add(`validation-${type}`);
    }

    // Remove validation indicators
    removeValidationIndicators(input) {
        // Remove tooltip attributes
        input.removeAttribute('title');
        input.removeAttribute('data-validation-tooltip');
        
        // Remove validation CSS classes
        input.classList.remove('validation-valid', 'validation-invalid', 'validation-neutral');
        
        // Also remove any existing validation indicator divs (for backward compatibility)
        const existing = input.parentNode.querySelectorAll('.validation-indicator');
        existing.forEach(indicator => indicator.remove());
    }

    // Get validation icon
    getValidationIcon(type) {
        switch (type) {
            case 'valid': return 'fas fa-check-circle';
            case 'invalid': return 'fas fa-exclamation-circle';
            case 'neutral': return 'fas fa-info-circle';
            default: return 'fas fa-info-circle';
        }
    }



    // Get question text for context
    getQuestionText(input) {
        const questionContainer = input.closest('.question-item, .sub-question-item');
        if (questionContainer) {
            const label = questionContainer.querySelector('.question-label, .sub-question-label');
            return label ? label.textContent : '';
        }
        return '';
    }

    // Export form data
    exportFormData() {
        const formData = this.getFormData();
        const dataStr = JSON.stringify(formData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `edsight_form_data_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }

    // Import form data
    importFormData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                localStorage.setItem(this.storageKey, JSON.stringify(importedData));
                this.restoreFormData();
                this.showNotification('Form data imported successfully', 'success');
            } catch (error) {
                this.showNotification('Error importing form data', 'error');
            }
        };
        reader.readAsText(file);
    }

    // Setup form event listeners
    setupFormEventListeners() {
        // Handle input changes
        document.addEventListener('input', (e) => {
            const questionId = this.getQuestionId(e.target);
            if (questionId) {
                this.markAsUnsaved(questionId);
                this.updateProgressIndicators();
            }
        });

        // Handle form submission
        document.addEventListener('submit', (e) => {
            if (e.target.tagName === 'FORM') {
                this.saveAllFormData();
            }
        });

        // Handle focus events to show save status
        document.addEventListener('focus', (e) => {
            const questionId = this.getQuestionId(e.target);
            if (questionId) {
                const saveState = this.saveStates.get(questionId) || 'none';
                this.updateSaveIndicator(questionId, saveState);
            }
        }, true);
    }

    // Setup connection monitoring for automatic sync
    setupConnectionMonitoring() {
        // Monitor online/offline status
        window.addEventListener('online', () => {
            console.log('Connection restored! Attempting to sync offline data...');
            this.showNotification('Connection restored! Syncing offline data...', 'info');
            this.syncOfflineData();
        });

        window.addEventListener('offline', () => {
            console.log('Connection lost. Data will be saved locally.');
            this.showNotification('Connection lost. Your data will be saved locally and synced when connection is restored.', 'warning');
        });

        // Periodic connection check (every 30 seconds)
        this.connectionCheckInterval = setInterval(() => {
            this.checkConnectionAndSync();
        }, 30000);
    }

    // Check connection status and attempt sync if online
    async checkConnectionAndSync() {
        if (navigator.onLine && this.hasUnsavedChanges()) {
            try {
                // Test connection with a lightweight request
                const response = await fetch('/api/profile/', {
                    method: 'HEAD',
                    timeout: 5000
                });
                
                if (response.ok) {
                    console.log('Connection verified, syncing offline data...');
                    this.syncOfflineData();
                }
            } catch (error) {
                console.log('Connection check failed:', error.message);
            }
        }
    }

    // Sync all offline data to database
    async syncOfflineData() {
        if (!this.hasUnsavedChanges()) {
            return;
        }

        try {
            const formData = this.getFormData();
            const offlineAnswers = [];
            
            // Collect all locally saved answers
            Object.keys(formData).forEach(questionId => {
                const data = formData[questionId];
                if (data && data.saveState === 'local' && data.value && data.value.trim() !== '') {
                    offlineAnswers.push({
                        questionId: questionId,
                        answer: data.value
                    });
                }
            });

            if (offlineAnswers.length === 0) {
                return;
            }

            console.log(`Syncing ${offlineAnswers.length} offline answers to database...`);
            let syncedCount = 0;
            let failedCount = 0;

            // Submit each answer individually
            for (const item of offlineAnswers) {
                try {
                    // Determine if this is a sub-question based on ID
                    const isSubQuestion = parseInt(item.questionId) >= 7663;
                    const result = await this.submitFormAnswer(
                        isSubQuestion ? null : parseInt(item.questionId),
                        item.answer,
                        isSubQuestion ? parseInt(item.questionId) : null
                    );

                    if (result.success && result.database) {
                        syncedCount++;
                    } else {
                        failedCount++;
                    }
                } catch (error) {
                    console.error(`Failed to sync answer for ${item.questionId}:`, error);
                    failedCount++;
                }
            }

            if (syncedCount > 0) {
                this.showNotification(`Successfully synced ${syncedCount} offline answers to database${failedCount > 0 ? `, ${failedCount} failed` : ''}`, 'success');
                this.hasUnsavedData = false;
            } else if (failedCount > 0) {
                this.showNotification(`Failed to sync ${failedCount} offline answers. Will retry later.`, 'warning');
            }

        } catch (error) {
            console.error('Error during offline data sync:', error);
            this.showNotification('Error syncing offline data. Will retry later.', 'error');
        }
    }

    // Schedule automatic sync attempt (with exponential backoff)
    scheduleAutoSync() {
        // Clear any existing sync timeout
        if (this.autoSyncTimeout) {
            clearTimeout(this.autoSyncTimeout);
        }

        // Start with 30 seconds delay, max 5 minutes
        const delay = Math.min(30000 * (this.syncRetryCount || 1), 300000);
        
        this.autoSyncTimeout = setTimeout(() => {
            if (navigator.onLine) {
                this.syncOfflineData();
            } else {
                // Increment retry count for exponential backoff
                this.syncRetryCount = (this.syncRetryCount || 1) + 1;
                this.scheduleAutoSync();
            }
        }, delay);
    }

    // Initialize the form data manager
    static init() {
        if (!window.formDataManager) {
            window.formDataManager = new FormDataManager();
            window.formDataManager.setupFormEventListeners();
        }
        return window.formDataManager;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    FormDataManager.init();
});

// Export for use in other scripts
window.FormDataManager = FormDataManager;