/**
 * School Form Questions Manager
 * Handles question display, pagination, search, and filtering
 */

class SchoolFormQuestions {
    constructor(api, offline, validation) {
        this.api = api;
        this.offline = offline;
        this.validation = validation;
        this.container = document.getElementById('questionsList');
        this.currentTopicId = null;
        this.currentPage = 1;
        this.pageSize = 50; // Default to 50 questions per page
        this.totalPages = 1;
        this.totalQuestions = 0; // Total questions across all pages
        this.questions = [];
        this.answers = {};
        this.searchTerm = '';
        this.filterType = 'all';
        this.autoSaveTimeout = null;
        this.changedAnswers = new Map();
        // Track save status for each answer: 'unsaved', 'local', 'database', 'saving'
        this.answerStatus = new Map();
        // Track which answers are currently being saved
        this.savingAnswers = new Set();
        // Track previous values to detect when input is cleared
        this.previousValues = new Map();
        // Track blur timeouts for individual inputs
        this.blurSaveTimeouts = new Map();
        // Track if inputs are disabled after submission
        this.inputsDisabled = false;
    }

    /**
     * Load questions for a topic
     */
    async loadQuestions(topicId, topicName = 'Topic', page = null) {
        this.currentTopicId = topicId;
        if (page !== null) {
            this.currentPage = page;
        } else {
            this.currentPage = 1;
        }
        
        try {
            this.showLoading();
            const response = await this.api.getQuestions(
                topicId,
                this.currentPage,
                this.pageSize,
                this.searchTerm,
                this.filterType
            );

            this.questions = response.questions || [];
            this.totalPages = response.pagination?.total_pages || 1;
            this.totalQuestions = response.pagination?.total || response.questions?.length || 0;

            // Clear previous topic's answers and reload only current topic's answers
            // This prevents accumulating answers from multiple topics
            const currentTopicQuestionIds = new Set(this.questions.map(q => q.question_id));
            
            // Remove answers that don't belong to current topic
            Object.keys(this.answers).forEach(qId => {
                if (!currentTopicQuestionIds.has(parseInt(qId))) {
                    delete this.answers[qId];
                    this.answerStatus.delete(parseInt(qId));
                    this.previousValues.delete(parseInt(qId));
                }
            });

            // Load existing answers into map for current topic only
            this.questions.forEach(q => {
                if (q.answer) {
                    this.answers[q.question_id] = q.answer;
                    // Mark as saved to database if answer exists (loaded from server)
                    this.answerStatus.set(q.question_id, 'database');
                    // Store initial value for comparison
                    this.previousValues.set(q.question_id, q.answer);
                } else {
                    // Store empty as previous value
                    this.previousValues.set(q.question_id, '');
                }
            });

            this.renderQuestions(topicName);
            this.setupAutoSave();
            
            // If inputs are disabled (form submitted), disable the newly rendered inputs too
            if (this.inputsDisabled) {
                this.disableAllInputs();
            }
        } catch (error) {
            console.error('Failed to load questions:', error);
            this.showError('Failed to load questions');
        }
    }

    /**
     * Render questions
     */
    renderQuestions(topicName) {
        if (!this.container) {
            console.error('Questions container not found');
            return;
        }

        // Update topic title
        const topicTitle = document.getElementById('topicTitle');
        if (topicTitle) {
            topicTitle.textContent = topicName;
        }

        // Update progress indicator
        const progressIndicator = document.getElementById('progressIndicator');
        const progressText = document.getElementById('progressText');
        if (progressIndicator && progressText) {
            // Count only answers for questions in the current topic (not accumulated from other topics)
            const currentTopicQuestionIds = new Set(this.questions.map(q => q.question_id));
            const answeredCount = this.questions.filter(q => {
                const answer = this.answers[q.question_id];
                return answer && answer.toString().trim() !== '';
            }).length;
            progressText.textContent = `${answeredCount} of ${this.questions.length} answered`;
            progressIndicator.style.display = this.questions.length > 0 ? 'flex' : 'none';
        }

        // Show/hide controls - keep visible even when no questions (for search/filter)
        const questionsControls = document.getElementById('questionsControls');
        if (questionsControls) {
            // Always show controls if we have a topic selected
            questionsControls.style.display = this.currentTopicId ? 'flex' : 'none';
        }

        // Render questions
        if (this.questions.length === 0) {
            // Add class to indicate empty state
            if (this.container) {
                this.container.classList.add('empty-state-container');
            }
            this.container.innerHTML = this.renderEmptyState();
        } else {
            // Remove empty state class if it exists
            if (this.container) {
                this.container.classList.remove('empty-state-container');
            }
            // Render question cards
            const questionsHTML = this.questions.map((q, index) => 
                this.renderQuestion(q, index + ((this.currentPage - 1) * this.pageSize) + 1)
            ).join('');

            this.container.innerHTML = questionsHTML;
        }

        // Always update pagination (will hide itself if no questions)
        this.updatePagination();

        // Attach event listeners
        this.attachEventListeners();
        
        // Update remark badges after rendering
        if (window.schoolFormRemarksApp && typeof window.schoolFormRemarksApp.updateAllBadges === 'function') {
            setTimeout(() => window.schoolFormRemarksApp.updateAllBadges(), 100);
        }
        
        // Update status indicators for all inputs after rendering
        this.questions.forEach(q => {
            const questionId = q.question_id;
            const status = this.answerStatus.get(questionId);
            if (status) {
                // Use setTimeout to ensure DOM is ready
                setTimeout(() => {
                    this.updateStatusIndicator(questionId, status);
                }, 100);
            }
        });
        
        // Update save button state
        if (this.offline && typeof this.offline.updateOfflineCount === 'function') {
            this.offline.updateOfflineCount(this.changedAnswers.size);
        }
    }

    /**
     * Render a single question
     */
    renderQuestion(question, number) {
        const answer = this.answers[question.question_id] || '';
        const inputComponent = window.SchoolFormInputs.renderInput(question, answer);
        const questionId = question.question_id;
        // Get status - use existing status or determine from answer existence
        let status = this.answerStatus.get(questionId);
        if (!status && answer) {
            // If answer exists but no status set, check if it's in changedAnswers
            status = this.changedAnswers.has(questionId) ? 'unsaved' : 'database';
        }

        return `
            <div class="question-card" data-question-id="${questionId}">
                <div class="question-header">
                    <div class="row g-2 align-items-center">
                        <div class="col-auto">
                    <div class="question-number">${number}</div>
                        </div>
                        <div class="col">
                    <div class="question-type">
                        <span class="type-badge">${question.answer_type}</span>
                        ${question.is_required ? '<span class="required-badge">Required</span>' : ''}
                            </div>
                        </div>
                        <div class="col-auto">
                            <button class="remark-icon-btn" data-remark-type="question" data-entity-id="${questionId}" style="display:none;" aria-label="View remarks">
                                <i class="fas fa-comment-dots"></i>
                                <span class="remark-badge-count">0</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="question-content">
                    <div class="question-text-display">${this.escapeHtml(question.question_text)}</div>
                    <div class="question-input">
                        ${inputComponent}
                    </div>
                    <div class="validation-message" id="validation-${questionId}" style="display:none;"></div>
                </div>
            </div>
        `;
    }

    /**
     * Update status indicator for a question input
     */
    updateStatusIndicator(questionId, status) {
        if (status) {
            this.answerStatus.set(questionId, status);
        } else {
            this.answerStatus.delete(questionId);
        }
        
        // Find the input element for this question
        const input = document.getElementById(`answer-${questionId}`);
        if (!input) return;
        
        // Remove all status classes
        input.classList.remove(
            'status-unsaved',
            'status-local',
            'status-database',
            'status-failed',
            'status-saving',
            'status-updating'
        );
        
        // Add appropriate status class and tooltip
        let tooltip = '';
        if (status) {
            switch (status) {
                case 'unsaved':
                    input.classList.add('status-unsaved');
                    tooltip = 'Unsaved changes';
                    break;
                case 'local':
                    input.classList.add('status-local');
                    tooltip = 'Saved locally (offline)';
                    break;
                case 'database':
                    input.classList.add('status-database');
                    tooltip = 'Saved to database';
                    break;
                case 'failed':
                    input.classList.add('status-failed');
                    tooltip = 'Failed to save';
                    break;
                case 'saving':
                    input.classList.add('status-saving');
                    tooltip = 'Saving...';
                    break;
                case 'updating':
                    input.classList.add('status-updating');
                    tooltip = 'Updating to database...';
                    break;
            }
        }
        
        // Update tooltip (only if not showing cleared tooltip)
        const hasClearedTooltip = input.classList.contains('input-cleared');
        if (tooltip && !hasClearedTooltip) {
            input.setAttribute('title', tooltip);
        } else if (!tooltip && !hasClearedTooltip) {
            input.removeAttribute('title');
        }
    }

    /**
     * Show tooltip when input is cleared
     */
    showClearedTooltip(questionId) {
        const input = document.getElementById(`answer-${questionId}`);
        if (!input) return;
        
        // Add class to mark as cleared
        input.classList.add('input-cleared');
        
        // Set tooltip
        const question = this.questions.find(q => q.question_id === questionId);
        const tooltipText = question && question.is_required 
            ? 'This field is required. Please enter a value.' 
            : 'Field cleared. This will not be saved.';
        input.setAttribute('title', tooltipText);
        
        // Show tooltip immediately (trigger a hover event)
        // Create and dispatch a mouseenter event to show tooltip
        const event = new MouseEvent('mouseenter', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        input.dispatchEvent(event);
    }

    /**
     * Hide cleared tooltip
     */
    hideClearedTooltip(questionId) {
        const input = document.getElementById(`answer-${questionId}`);
        if (!input) return;
        
        // Remove cleared class
        input.classList.remove('input-cleared');
        
        // Restore status tooltip if exists
        const status = this.answerStatus.get(questionId);
        if (status) {
            this.updateStatusIndicator(questionId, status);
        } else {
            input.removeAttribute('title');
        }
    }

    /**
     * Update pagination controls - MUI Style
     */
    updatePagination() {
        const paginationControls = document.getElementById('paginationControls');
        const paginationInfo = document.getElementById('paginationInfo');
        const paginationButtons = document.getElementById('paginationButtons');

        if (!paginationControls || !paginationInfo || !paginationButtons) return;

        // Always show pagination (even with few questions, cards take up vertical space)
        // Only hide if there are no questions at all
        if (this.totalQuestions === 0) {
            paginationControls.style.display = 'none';
            return;
        }
        
        paginationControls.style.display = 'flex';

        // Update rows per page selector to current value
        const rowsPerPageSelect = document.getElementById('rowsPerPage');
        if (rowsPerPageSelect) {
            rowsPerPageSelect.value = this.pageSize;
        }

        // Update info (MUI style: "1–20 of 100")
        const start = ((this.currentPage - 1) * this.pageSize) + 1;
        const end = Math.min(this.currentPage * this.pageSize, this.totalQuestions);
        paginationInfo.innerHTML = `
            <span>${start}–${end}</span>
            <span>of</span>
            <span>${this.totalQuestions}</span>
        `;

        // Generate page numbers with smart ellipsis
        const pages = this.generatePageNumbers(this.currentPage, this.totalPages);

        // Render MUI-style pagination buttons
        const buttonsHTML = `
            <button class="pagination-btn first-page" 
                    id="firstPage" 
                    title="First page"
                    ${this.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-angle-double-left"></i>
            </button>
            <button class="pagination-btn" 
                    id="prevPage" 
                    title="Previous page"
                    ${this.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
            ${pages.map(page => {
                if (page === '...') {
                    return '<span class="pagination-ellipsis">⋯</span>';
                }
                return `
                    <button class="pagination-btn ${page === this.currentPage ? 'active' : ''}" 
                            data-page="${page}"
                            title="Page ${page}"
                            aria-label="Page ${page}"
                            ${page === this.currentPage ? 'aria-current="page"' : ''}>
                        ${page}
                    </button>
                `;
            }).join('')}
            <button class="pagination-btn" 
                    id="nextPage" 
                    title="Next page"
                    ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
            <button class="pagination-btn last-page" 
                    id="lastPage" 
                    title="Last page"
                    ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                <i class="fas fa-angle-double-right"></i>
            </button>
        `;

        paginationButtons.innerHTML = buttonsHTML;
    }

    /**
     * Generate page numbers with smart ellipsis (MUI style)
     */
    generatePageNumbers(currentPage, totalPages) {
        const pages = [];
        const showPages = 7; // Show up to 7 page numbers

        if (totalPages <= showPages) {
            // Show all pages if total is small
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            if (currentPage <= 3) {
                // Near the beginning
                for (let i = 2; i <= 5; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                // Near the end
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                // In the middle
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            }
        }

        return pages;
    }

    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="empty-state-inline">
                <i class="fas fa-clipboard-question"></i>
                <span>No questions found</span>
                <span class="empty-state-hint">Try adjusting your search or filter</span>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Search
        const searchInput = document.getElementById('questionSearch');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                this.searchTerm = e.target.value;
                this.loadQuestions(this.currentTopicId);
            }, 500));
        }

        // Filter
        const filterSelect = document.getElementById('filterStatus');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filterType = e.target.value;
                this.loadQuestions(this.currentTopicId);
            });
        }

        // Rows per page selector
        const rowsPerPageSelect = document.getElementById('rowsPerPage');
        if (rowsPerPageSelect) {
            // Set current value
            rowsPerPageSelect.value = this.pageSize;
            
            rowsPerPageSelect.addEventListener('change', async (e) => {
                const newPageSize = parseInt(e.target.value);
                if (newPageSize !== this.pageSize) {
                    // Save changes before changing page size
                    if (this.changedAnswers.size > 0) {
                        await this.saveChanges();
                    }
                    
                    this.pageSize = newPageSize;
                    this.currentPage = 1; // Reset to first page
                    
                    // Reload questions with new page size
                    const topicTitle = document.getElementById('topicTitle');
                    const topicName = topicTitle ? topicTitle.textContent : 'Topic';
                    await this.loadQuestions(this.currentTopicId, topicName, 1);
                }
            });
        }

        // Pagination - MUI style with first/last
        const firstBtn = document.getElementById('firstPage');
        if (firstBtn) {
            firstBtn.addEventListener('click', () => this.goToPage(1));
        }

        const prevBtn = document.getElementById('prevPage');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        }

        const nextBtn = document.getElementById('nextPage');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        }

        const lastBtn = document.getElementById('lastPage');
        if (lastBtn) {
            lastBtn.addEventListener('click', () => this.goToPage(this.totalPages));
        }

        // Page number buttons
        document.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.closest('[data-page]').dataset.page);
                this.goToPage(page);
            });
        });

        // Question inputs
        this.questions.forEach(question => {
            const input = document.getElementById(`answer-${question.question_id}`);
            if (input) {
                input.addEventListener('input', (e) => {
                    this.handleAnswerChange(question, e.target.value);
                    // Clear any pending blur save timeout when user types
                    this.clearBlurSaveTimeout(question.question_id);
                });
                input.addEventListener('blur', (e) => {
                    this.validateAnswer(question, e.target.value);
                    // Start 2-second timer to save after user leaves input
                    this.scheduleBlurSave(question);
                });
            }
        });
    }

    /**
     * Handle answer change
     */
    handleAnswerChange(question, value) {
        // Don't handle changes if inputs are disabled
        if (this.inputsDisabled) {
            return;
        }
        
        const questionId = question.question_id;
        const trimmedValue = String(value || '').trim();
        const previousValue = this.previousValues.get(questionId) || '';
        
        // Check if input was cleared (had value before, now empty)
        const wasCleared = previousValue && !trimmedValue;
        
        // Update previous value
        this.previousValues.set(questionId, trimmedValue);
        
        this.answers[questionId] = trimmedValue;
        
        // If input is empty, remove from changedAnswers (don't save empty answers)
        // Exception: if it's required, keep it in changedAnswers to show validation error
        if (!trimmedValue && !question.is_required) {
            this.changedAnswers.delete(questionId);
            // Clear status indicator for empty non-required fields
            if (!this.savingAnswers.has(questionId)) {
                this.answerStatus.delete(questionId);
                this.updateStatusIndicator(questionId, null);
                // Show tooltip when input is cleared
                if (wasCleared) {
                    this.showClearedTooltip(questionId);
                }
            }
        } else {
            this.changedAnswers.set(questionId, trimmedValue);
            // Mark as unsaved (unless already saving)
            if (!this.savingAnswers.has(questionId)) {
                this.updateStatusIndicator(questionId, 'unsaved');
            }
            // Clear cleared tooltip if user starts typing again
            this.hideClearedTooltip(questionId);
        }
        
        // Clear validation message
        this.clearValidationMessage(questionId);
        
        // Update save button state
        if (this.offline && typeof this.offline.updateOfflineCount === 'function') {
            this.offline.updateOfflineCount(this.changedAnswers.size);
        }
        
        // Note: Auto-save is now handled on blur (2 seconds after leaving input)
        // Keep the periodic auto-save as backup
        this.triggerAutoSave();
    }

    /**
     * Validate answer
     */
    validateAnswer(question, value) {
        const result = this.validation.validate(question, value);
        
        if (!result.valid) {
            this.showValidationMessage(question.question_id, result.error, 'error');
        } else {
            this.clearValidationMessage(question.question_id);
        }

        return result.valid;
    }

    /**
     * Show validation message
     */
    showValidationMessage(questionId, message, type = 'error') {
        const messageEl = document.getElementById(`validation-${questionId}`);
        if (!messageEl) return;

        messageEl.textContent = message;
        messageEl.className = `validation-message ${type}`;
        messageEl.style.display = 'block';
    }

    /**
     * Clear validation message
     */
    clearValidationMessage(questionId) {
        const messageEl = document.getElementById(`validation-${questionId}`);
        if (messageEl) {
            messageEl.style.display = 'none';
        }
    }

    /**
     * Schedule save 2 seconds after user leaves input (blur)
     */
    scheduleBlurSave(question) {
        const questionId = question.question_id;
        
        // Clear any existing timeout for this question
        this.clearBlurSaveTimeout(questionId);
        
        // Only schedule save if there are unsaved changes for this question
        if (!this.changedAnswers.has(questionId)) {
            return;
        }
        
        // Set timeout to save after 2 seconds
        const timeoutId = setTimeout(async () => {
            await this.saveSingleAnswer(questionId);
            this.blurSaveTimeouts.delete(questionId);
        }, 2000);
        
        this.blurSaveTimeouts.set(questionId, timeoutId);
    }

    /**
     * Clear blur save timeout for a question
     */
    clearBlurSaveTimeout(questionId) {
        const timeoutId = this.blurSaveTimeouts.get(questionId);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.blurSaveTimeouts.delete(questionId);
        }
    }

    /**
     * Save a single answer
     */
    async saveSingleAnswer(questionId) {
        // Check if answer is still in changedAnswers
        if (!this.changedAnswers.has(questionId)) {
            return;
        }

        const question = this.questions.find(q => q.question_id === questionId);
        if (!question) {
            return;
        }

        const answer = this.changedAnswers.get(questionId);
        const trimmedAnswer = String(answer || '').trim();

        // Skip empty answers (unless required - validation will catch this)
        if (!trimmedAnswer && !question.is_required) {
            this.changedAnswers.delete(questionId);
            if (!this.savingAnswers.has(questionId)) {
                this.answerStatus.delete(questionId);
                this.updateStatusIndicator(questionId, null);
            }
            return;
        }

        // Validate answer before saving
        const validationResult = this.validation.validate(question, trimmedAnswer);
        
        if (!validationResult.valid) {
            // Show validation error
            this.showValidationMessage(questionId, validationResult.error, 'error');
            return;
        }

        const answersToSave = [{
            question_id: questionId,
            answer: trimmedAnswer,
        }];

        // Show saving indicator
        this.savingAnswers.add(questionId);
        const previousStatus = this.answerStatus.get(questionId);
        if (previousStatus === 'local') {
            this.updateStatusIndicator(questionId, 'updating');
        } else {
            this.updateStatusIndicator(questionId, 'saving');
        }

        // Remove from changedAnswers before saving
        this.changedAnswers.delete(questionId);

        // Update save button state
        if (this.offline && typeof this.offline.updateOfflineCount === 'function') {
            this.offline.updateOfflineCount(this.changedAnswers.size);
        }

        try {
            if (this.offline.isOnline) {
                // Save online
                try {
                    await this.api.saveAnswers(answersToSave, false);
                    console.log(`Answer saved successfully for question ${questionId}`);
                    
                    this.savingAnswers.delete(questionId);
                    this.updateStatusIndicator(questionId, 'database');
                } catch (error) {
                    console.error('Failed to save answer:', error);
                    this.savingAnswers.delete(questionId);
                    this.updateStatusIndicator(questionId, 'failed');
                    // Save to offline storage
                    if (trimmedAnswer) {
                        this.offline.saveOffline(questionId, trimmedAnswer);
                        setTimeout(() => {
                            this.updateStatusIndicator(questionId, 'local');
                        }, 2000);
                    }
                }
            } else {
                // Save to offline storage
                if (trimmedAnswer) {
                    this.savingAnswers.delete(questionId);
                    this.offline.saveOffline(questionId, trimmedAnswer);
                    this.updateStatusIndicator(questionId, 'local');
                }
            }
        } catch (error) {
            console.error('Error saving answer:', error);
            this.savingAnswers.delete(questionId);
        }

        // Update save button state after save operation completes
        if (this.offline && typeof this.offline.updateOfflineCount === 'function') {
            this.offline.updateOfflineCount(this.changedAnswers.size);
        }
    }

    /**
     * Trigger auto-save
     */
    triggerAutoSave() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        this.autoSaveTimeout = setTimeout(() => {
            this.saveChanges();
        }, 5000); // Auto-save after 5 seconds of inactivity (backup)
    }

    /**
     * Setup auto-save
     */
    setupAutoSave() {
        // Auto-save every 30 seconds
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        this.autoSaveInterval = setInterval(() => {
            if (this.changedAnswers.size > 0) {
                this.saveChanges();
            }
        }, 30000);
    }

    /**
     * Save changes
     */
    async saveChanges() {
        if (this.changedAnswers.size === 0) return;
        
        // Check if deadline has passed
        if (window.formDeadlinePassed === true || 
            (window.formDeadlineInfo && window.formDeadlineInfo.isOverdue === true)) {
            console.warn('Cannot save: Deadline has passed');
            // Show notification if available
            if (window.schoolFormApp && typeof window.schoolFormApp.showNotification === 'function') {
                window.schoolFormApp.showNotification('Cannot save changes: The submission deadline has passed.', 'error');
            }
            return;
        }

        // Get questions map for validation
        const questionsMap = new Map(this.questions.map(q => [q.question_id, q]));

        // Filter and validate answers before saving
        const validAnswers = [];
        const invalidAnswers = [];

        for (const [questionId, answer] of this.changedAnswers.entries()) {
            const question = questionsMap.get(questionId);
            if (!question) continue;

            const trimmedAnswer = String(answer || '').trim();
            
            // Skip empty answers (unless required - validation will catch this)
            if (!trimmedAnswer && !question.is_required) {
                // Remove from changedAnswers since we're not saving empty non-required fields
                this.changedAnswers.delete(questionId);
                continue;
            }

            // Validate answer
            const validationResult = this.validation.validate(question, trimmedAnswer);
            
            if (!validationResult.valid) {
                // Show validation error
                this.showValidationMessage(questionId, validationResult.error, 'error');
                invalidAnswers.push({ question_id: questionId, question: question });
            } else {
                validAnswers.push({
            question_id: questionId,
                    answer: trimmedAnswer,
                });
            }
        }

        // Don't save if there are invalid answers
        if (invalidAnswers.length > 0) {
            console.log('Cannot save: Some answers failed validation', invalidAnswers);
            return;
        }

        // Don't save if no valid answers
        if (validAnswers.length === 0) {
            return;
        }

        const answersToSave = validAnswers;

        // Show saving indicators
        answersToSave.forEach(({ question_id }) => {
            this.savingAnswers.add(question_id);
            // Check if was previously saved locally
            const previousStatus = this.answerStatus.get(question_id);
            if (previousStatus === 'local') {
                this.updateStatusIndicator(question_id, 'updating');
            } else {
                this.updateStatusIndicator(question_id, 'saving');
            }
        });

        // Remove saved answers from changedAnswers
        answersToSave.forEach(({ question_id }) => {
            this.changedAnswers.delete(question_id);
        });

        // Update save button state after clearing changedAnswers
        if (this.offline && typeof this.offline.updateOfflineCount === 'function') {
            this.offline.updateOfflineCount(this.changedAnswers.size);
        }

        if (this.offline.isOnline) {
            // Save online
            try {
                await this.api.saveAnswers(answersToSave, false);
                console.log('Answers saved successfully');
                
                // Update status to database for all saved answers
                answersToSave.forEach(({ question_id }) => {
                    this.savingAnswers.delete(question_id);
                    this.updateStatusIndicator(question_id, 'database');
                });
            } catch (error) {
                console.error('Failed to save answers:', error);
                
                // Check if it's an authentication error
                if (error.isAuthError || error.message.includes('Authentication')) {
                    // Session expired - save to offline and notify user
                    answersToSave.forEach(({ question_id, answer }) => {
                        this.savingAnswers.delete(question_id);
                        if (answer) {
                            this.offline.saveOffline(question_id, answer);
                            setTimeout(() => {
                                this.updateStatusIndicator(question_id, 'local');
                            }, 500);
                        }
                    });
                    
                    // Dispatch session expired event
                    window.dispatchEvent(new CustomEvent('sessionExpired', {
                        detail: { message: 'Session expired. Answers saved offline.' }
                    }));
                } else {
                    // Other errors - show failed status and save to offline
                    answersToSave.forEach(({ question_id }) => {
                        this.savingAnswers.delete(question_id);
                        this.updateStatusIndicator(question_id, 'failed');
                        // Save to offline storage
                        const answerValue = answersToSave.find(a => a.question_id === question_id)?.answer || '';
                        if (answerValue) {
                            this.offline.saveOffline(question_id, answerValue);
                            // After a delay, show local status if saved offline successfully
                            setTimeout(() => {
                                this.updateStatusIndicator(question_id, 'local');
                            }, 2000);
                        }
                    });
                }
            }
        } else {
            // Save to offline storage
            answersToSave.forEach(({ question_id, answer }) => {
                if (answer) {
                    this.savingAnswers.delete(question_id);
                this.offline.saveOffline(question_id, answer);
                    this.updateStatusIndicator(question_id, 'local');
                }
            });
        }
        
        // Update save button state after save operation completes
        if (this.offline && typeof this.offline.updateOfflineCount === 'function') {
            this.offline.updateOfflineCount(this.changedAnswers.size);
        }
    }

    /**
     * Go to page
     */
    async goToPage(page) {
        if (page < 1 || page > this.totalPages) return;

        // Save changes before navigating
        if (this.changedAnswers.size > 0) {
            await this.saveChanges();
        }

        // Get topic name before loading
        const topicTitle = document.getElementById('topicTitle');
        const topicName = topicTitle ? topicTitle.textContent : 'Topic';
        
        await this.loadQuestions(this.currentTopicId, topicName, page);
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * Show loading state
     */
    showLoading() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading questions...</p>
            </div>
        `;
    }

    /**
     * Show error state
     */
    showError(message) {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${this.escapeHtml(message)}</p>
                <button class="btn btn-secondary" onclick="location.reload()">Retry</button>
            </div>
        `;
    }

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Disable all inputs (used after form submission)
     */
    disableAllInputs() {
        // Disable all answer inputs
        const allInputs = document.querySelectorAll('[id^="answer-"]');
        allInputs.forEach(input => {
            input.disabled = true;
            input.readOnly = true;
            input.style.cursor = 'not-allowed';
            input.style.opacity = '0.6';
        });
        
        // Keep search and filter enabled - do not disable them
        // Users should still be able to search and filter questions even when form is disabled
        const searchInput = document.getElementById('questionSearch');
        if (searchInput) {
            searchInput.disabled = false;
            searchInput.style.opacity = '1';
            searchInput.style.cursor = 'text';
        }
        
        const filterSelect = document.getElementById('filterStatus');
        if (filterSelect) {
            filterSelect.disabled = false;
            filterSelect.style.opacity = '1';
            filterSelect.style.cursor = 'pointer';
        }
        
        // Keep pagination buttons enabled - do not disable them
        // Users should still be able to navigate through questions even when form is disabled
        const paginationButtons = document.querySelectorAll('.pagination-btn');
        paginationButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        });
        
        // Keep rows per page selector enabled - do not disable it
        const rowsPerPageSelect = document.getElementById('rowsPerPage');
        if (rowsPerPageSelect) {
            rowsPerPageSelect.disabled = false;
            rowsPerPageSelect.style.opacity = '1';
            rowsPerPageSelect.style.cursor = 'pointer';
        }
        
        // Mark as disabled
        this.inputsDisabled = true;
    }

    /**
     * Enable all inputs (used when form is returned)
     */
    enableAllInputs() {
        // Enable all answer inputs
        const allInputs = document.querySelectorAll('[id^="answer-"]');
        allInputs.forEach(input => {
            input.disabled = false;
            input.readOnly = false;
            input.style.cursor = '';
            input.style.opacity = '';
        });
        
        // Enable search and filter
        const searchInput = document.getElementById('questionSearch');
        if (searchInput) {
            searchInput.disabled = false;
            searchInput.style.opacity = '';
            searchInput.style.cursor = '';
        }
        
        const filterSelect = document.getElementById('filterStatus');
        if (filterSelect) {
            filterSelect.disabled = false;
            filterSelect.style.opacity = '';
            filterSelect.style.cursor = '';
        }
        
        // Enable pagination buttons
        const paginationButtons = document.querySelectorAll('.pagination-btn');
        paginationButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '';
            btn.style.cursor = '';
        });
        
        // Enable rows per page selector
        const rowsPerPageSelect = document.getElementById('rowsPerPage');
        if (rowsPerPageSelect) {
            rowsPerPageSelect.disabled = false;
            rowsPerPageSelect.style.opacity = '';
            rowsPerPageSelect.style.cursor = '';
        }
        
        // Mark as enabled
        this.inputsDisabled = false;
    }

    /**
     * Escape HTML
     */s
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in other modules
window.SchoolFormQuestions = SchoolFormQuestions;


