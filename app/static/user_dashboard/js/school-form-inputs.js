/**
 * School Form Input Components
 * Renders appropriate input fields based on answer type
 */

class SchoolFormInputs {
    /**
     * Render input based on question type
     */
    static renderInput(question, value = '') {
        switch (question.answer_type) {
            case 'text':
                return this.renderTextInput(question, value);
            case 'number':
                return this.renderNumberInput(question, value);
            case 'date':
                return this.renderDateInput(question, value);
            case 'percentage':
                return this.renderPercentageInput(question, value);
            default:
                return this.renderTextInput(question, value);
        }
    }

    /**
     * Render text input (textarea)
     */
    static renderTextInput(question, value) {
        const helperText = SchoolFormValidation.getHelperText('text');
        const charCount = value ? value.length : 0;

        return `
            <div class="mb-3">
                <textarea 
                    id="answer-${question.question_id}"
                    class="form-control text-input"
                    rows="4"
                    placeholder="Enter your answer..."
                    maxlength="500"
                    ${question.is_required ? 'required' : ''}
                    aria-describedby="helper-${question.question_id}"
                >${this.escapeHtml(value)}</textarea>
                <div class="input-helper" id="helper-${question.question_id}">
                    <span class="helper-text">${helperText}</span>
                    <span class="char-count">${charCount}/500</span>
                </div>
            </div>
        `;
    }

    /**
     * Render number input
     */
    static renderNumberInput(question, value) {
        const helperText = SchoolFormValidation.getHelperText('number');

        return `
            <div class="mb-3">
                <input 
                    type="number"
                    id="answer-${question.question_id}"
                    class="form-control number-input"
                    placeholder="Enter a number..."
                    value="${this.escapeHtml(value)}"
                    step="any"
                    ${question.is_required ? 'required' : ''}
                    aria-describedby="helper-${question.question_id}"
                />
                <div class="input-helper" id="helper-${question.question_id}">
                    <span class="helper-text">${helperText}</span>
                </div>
            </div>
        `;
    }

    /**
     * Render date input
     */
    static renderDateInput(question, value) {
        const helperText = SchoolFormValidation.getHelperText('date');

        return `
            <div class="mb-3">
                <input 
                    type="date"
                    id="answer-${question.question_id}"
                    class="form-control date-input"
                    value="${this.escapeHtml(value)}"
                    ${question.is_required ? 'required' : ''}
                    aria-describedby="helper-${question.question_id}"
                />
                <div class="input-helper" id="helper-${question.question_id}">
                    <span class="helper-text">${helperText}</span>
                </div>
            </div>
        `;
    }

    /**
     * Render percentage input
     */
    static renderPercentageInput(question, value) {
        const helperText = SchoolFormValidation.getHelperText('percentage');

        return `
            <div class="mb-3">
                <div class="input-with-suffix">
                    <input 
                        type="number"
                        id="answer-${question.question_id}"
                        class="form-control percentage-input"
                        placeholder="0"
                        value="${this.escapeHtml(value)}"
                        min="0"
                        max="100"
                        step="0.01"
                        oninput="if(this.value.length > 3) this.value = this.value.slice(0, 3);
                                if(this.value > 100) this.value = 100;"
                        ${question.is_required ? 'required' : ''}
                        aria-describedby="helper-${question.question_id}"
                    />
                    <span class="input-suffix">%</span>
                </div>
                <div class="input-helper" id="helper-${question.question_id}">
                    <span class="helper-text">${helperText}</span>
                </div>
            </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Update character count for text inputs
     */
    static updateCharCount(inputId, maxLength = 500) {
        const input = document.getElementById(inputId);
        if (!input) return;

        const charCountEl = input.closest('.mb-3').querySelector('.char-count');
        if (!charCountEl) return;

        const currentLength = input.value.length;
        charCountEl.textContent = `${currentLength}/${maxLength}`;

        // Add warning class if near limit
        if (currentLength >= maxLength * 0.9) {
            charCountEl.classList.add('warning');
        } else {
            charCountEl.classList.remove('warning');
        }
    }

    /**
     * Setup character counter for text input
     */
    static setupCharCounter(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;

        input.addEventListener('input', () => {
            this.updateCharCount(inputId);
        });
    }
}

// Export for use in other modules
window.SchoolFormInputs = SchoolFormInputs;

