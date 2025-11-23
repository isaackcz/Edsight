/**
 * School Form Validation
 * Client-side validation rules for different answer types
 */

class SchoolFormValidation {
    /**
     * Validate answer based on question type
     */
    static validate(question, value) {
        const valueStr = String(value || '').trim();

        // Check if required
        if (question.is_required && !valueStr) {
            return {
                valid: false,
                error: 'This question is required',
            };
        }

        // If empty and not required, it's valid
        if (!valueStr) {
            return { valid: true, error: null };
        }

        // Validate based on answer type
        switch (question.answer_type) {
            case 'text':
                return this.validateText(valueStr);
            case 'number':
                return this.validateNumber(valueStr);
            case 'date':
                return this.validateDate(valueStr);
            case 'percentage':
                return this.validatePercentage(valueStr);
            default:
                return { valid: true, error: null };
        }
    }

    /**
     * Validate text input
     */
    static validateText(value) {
        if (value.length > 500) {
            return {
                valid: false,
                error: 'Text must be 500 characters or less',
            };
        }

        return { valid: true, error: null };
    }

    /**
     * Validate number input
     */
    static validateNumber(value) {
        const num = parseFloat(value);

        if (isNaN(num)) {
            return {
                valid: false,
                error: 'Must be a valid number',
            };
        }

        if (num < -999999999 || num > 999999999) {
            return {
                valid: false,
                error: 'Number is out of range',
            };
        }

        return { valid: true, error: null };
    }

    /**
     * Validate date input
     */
    static validateDate(value) {
        // Try to parse date
        const date = new Date(value);

        if (isNaN(date.getTime())) {
            return {
                valid: false,
                error: 'Invalid date format',
            };
        }

        // Check if date is reasonable (between 1900 and 2100)
        const year = date.getFullYear();
        if (year < 1900 || year > 2100) {
            return {
                valid: false,
                error: 'Date must be between 1900 and 2100',
            };
        }

        return { valid: true, error: null };
    }

    /**
     * Validate percentage input
     */
    static validatePercentage(value) {
        const num = parseFloat(value);

        if (isNaN(num)) {
            return {
                valid: false,
                error: 'Must be a valid percentage',
            };
        }

        if (num < 0 || num > 100) {
            return {
                valid: false,
                error: 'Percentage must be between 0 and 100',
            };
        }

        // Check decimal places (max 2)
        const decimalPlaces = (value.split('.')[1] || '').length;
        if (decimalPlaces > 2) {
            return {
                valid: false,
                error: 'Maximum 2 decimal places allowed',
            };
        }

        return { valid: true, error: null };
    }

    /**
     * Get helper text for input type
     */
    static getHelperText(answerType) {
        const helpers = {
            text: 'Maximum 500 characters',
            number: 'Enter a valid number',
            date: 'Format: YYYY-MM-DD',
            percentage: 'Enter a value between 0 and 100',
        };

        return helpers[answerType] || '';
    }
}

// Export for use in other modules
window.SchoolFormValidation = SchoolFormValidation;

