/**
 * School Form API Client
 * Handles all API calls to backend with error handling
 */

class SchoolFormAPI {
    constructor() {
        this.baseURL = '/user/dashboard/api';
        this.csrfToken = this.getCookie('csrftoken');
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
     * Check if session is still valid
     */
    async checkSession() {
        console.debug('[API] Checking session validity...');
        try {
            // Refresh CSRF token first
            const newCsrfToken = this.getCookie('csrftoken');
            console.debug('[API] Session check - CSRF token:', {
                found: !!newCsrfToken,
                length: newCsrfToken?.length || 0,
                previousTokenLength: this.csrfToken?.length || 0
            });
            
            if (!newCsrfToken) {
                console.warn('[API] Session check failed: No CSRF token found');
                console.debug('[API] Available cookies:', document.cookie);
                return false;
            }
            this.csrfToken = newCsrfToken;
            
            // Use a lightweight endpoint to check session
            const checkUrl = `${this.baseURL}/categories/`;
            console.debug('[API] Session check - Making request to:', checkUrl);
            
            const response = await fetch(checkUrl, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': this.csrfToken,
                },
            });
            
            console.debug('[API] Session check - Response:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries())
            });
            
            if (response.status === 403 || response.status === 401) {
                console.warn('[API] Session check failed: Authentication error', {
                    status: response.status,
                    statusText: response.statusText
                });
                
                // Try to get error details
                try {
                    const errorData = await response.json();
                    console.error('[API] Session check error details:', errorData);
                } catch (e) {
                    console.debug('[API] Could not parse error response');
                }
                
                return false;
            }
            
            // Refresh CSRF token again after request (in case it was updated)
            const updatedCsrfToken = this.getCookie('csrftoken');
            if (updatedCsrfToken && updatedCsrfToken !== this.csrfToken) {
                console.debug('[API] CSRF token updated after session check');
                this.csrfToken = updatedCsrfToken;
            }
            
            const isValid = response.ok;
            console.debug('[API] Session check result:', isValid);
            return isValid;
        } catch (error) {
            console.error('[API] Session check exception:', {
                error: error.message,
                stack: error.stack,
                cookies: document.cookie
            });
            return false;
        }
    }

    /**
     * Generic fetch wrapper with error handling
     */
    async request(url, options = {}) {
        // Refresh CSRF token before each request
        const currentCsrfToken = this.getCookie('csrftoken');
        const hadCsrfToken = !!this.csrfToken;
        const csrfTokenChanged = currentCsrfToken && currentCsrfToken !== this.csrfToken;
        
        console.debug('[API] Request started:', {
            url,
            method: options.method || 'GET',
            hadCsrfToken,
            hasCurrentCsrfToken: !!currentCsrfToken,
            csrfTokenChanged,
            csrfTokenLength: this.csrfToken?.length || 0,
            currentCsrfTokenLength: currentCsrfToken?.length || 0
        });
        
        if (currentCsrfToken && currentCsrfToken !== this.csrfToken) {
            console.debug('[API] CSRF token refreshed');
            this.csrfToken = currentCsrfToken;
        } else if (!currentCsrfToken) {
            console.warn('[API] No CSRF token found in cookies!');
        }

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.csrfToken,
            },
            credentials: 'same-origin',
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {}),
            },
        };

        // Check for session cookie
        const allCookies = document.cookie.split(';').map(c => c.trim());
        const sessionCookie = allCookies.find(c => c.startsWith('sessionid='));
        const csrfCookie = allCookies.find(c => c.startsWith('csrftoken='));
        
        // Log request details (without sensitive data)
        console.debug('[API] Request details:', {
            url,
            method: mergedOptions.method || 'GET',
            hasCsrfToken: !!mergedOptions.headers['X-CSRFToken'],
            csrfTokenLength: mergedOptions.headers['X-CSRFToken']?.length || 0,
            credentials: mergedOptions.credentials,
            bodySize: mergedOptions.body ? JSON.stringify(mergedOptions.body).length : 0,
            hasSessionCookie: !!sessionCookie,
            sessionCookieLength: sessionCookie ? sessionCookie.length : 0,
            allCookies: allCookies.map(c => c.split('=')[0]) // Just cookie names, not values
        });

        try {
            const response = await fetch(url, mergedOptions);
            
            console.debug('[API] Response received:', {
                url,
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries())
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                console.error('[API] Request failed:', {
                    url,
                    status: response.status,
                    statusText: response.statusText,
                    errorData,
                    responseHeaders: Object.fromEntries(response.headers.entries())
                });
                
                // Check if it's an authentication error
                if (response.status === 403 || response.status === 401 || 
                    errorData.error === 'Authentication system error' ||
                    errorData.error === 'Not authenticated') {
                    // Session might have expired
                // Check for session cookie again
                const allCookies = document.cookie.split(';').map(c => c.trim());
                const sessionCookie = allCookies.find(c => c.startsWith('sessionid='));
                const csrfCookie = allCookies.find(c => c.startsWith('csrftoken='));
                
                console.error('[API] Authentication error detected:', {
                    status: response.status,
                    error: errorData.error,
                    message: errorData.message,
                    csrfTokenPresent: !!this.csrfToken,
                    sessionCookiePresent: !!sessionCookie,
                    sessionCookieLength: sessionCookie ? sessionCookie.length : 0,
                    allCookieNames: allCookies.map(c => c.split('=')[0]),
                    cookies: document.cookie
                });
                    
                    const authError = new Error(errorData.error || 'Authentication failed');
                    authError.isAuthError = true;
                    authError.status = response.status;
                    authError.details = errorData;
                    throw authError;
                }
                
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            // Cache successful GET requests for offline use (before consuming response)
            if ((mergedOptions.method === 'GET' || !mergedOptions.method) && response.ok) {
                if (window.APICacheHelper && typeof window.APICacheHelper.cacheAPIResponse === 'function') {
                    // Clone response before reading (responses can only be read once)
                    const clonedResponse = response.clone();
                    window.APICacheHelper.cacheAPIResponse(url, clonedResponse).catch(err => {
                        console.debug('Failed to cache API response:', err);
                    });
                }
            }

            const data = await response.json();
            console.debug('[API] Request successful:', { url, dataKeys: Object.keys(data) });
            return data;
        } catch (error) {
            console.error('[API] Request error:', {
                url,
                error: error.message,
                isAuthError: error.isAuthError,
                status: error.status,
                details: error.details,
                stack: error.stack,
                cookies: document.cookie,
                csrfToken: this.csrfToken ? 'present' : 'missing'
            });
            throw error;
        }
    }

    /**
     * Get all categories with topic count
     */
    async getCategories() {
        return await this.request(`${this.baseURL}/categories/`);
    }

    /**
     * Get topics for a specific category
     */
    async getTopics(categoryId) {
        return await this.request(`${this.baseURL}/topics/?category_id=${categoryId}`);
    }

    /**
     * Get questions for a specific topic (paginated)
     */
    async getQuestions(topicId, page = 1, pageSize = 20, search = '', filterType = 'all') {
        const params = new URLSearchParams({
            topic_id: topicId,
            page: page,
            page_size: pageSize,
        });

        if (search) {
            params.append('search', search);
        }

        if (filterType !== 'all') {
            params.append('filter_type', filterType);
        }

        return await this.request(`${this.baseURL}/questions/?${params.toString()}`);
    }

    /**
     * Save answers (batch)
     */
    async saveAnswers(answers, isOfflineSync = false) {
        return await this.request(`${this.baseURL}/save-answers/`, {
            method: 'POST',
            body: JSON.stringify({
                answers: answers,
                is_offline_sync: isOfflineSync,
            }),
        });
    }

    /**
     * Validate single answer
     */
    async validateAnswer(questionId, answer) {
        return await this.request(`${this.baseURL}/validate-answer/`, {
            method: 'POST',
            body: JSON.stringify({
                question_id: questionId,
                answer: answer,
            }),
        });
    }

    /**
     * Get form progress
     */
    async getProgress() {
        return await this.request(`${this.baseURL}/progress/`);
    }

    /**
     * Get all saved answers
     */
    async getSavedAnswers() {
        return await this.request(`${this.baseURL}/saved-answers/`);
    }

    /**
     * Submit form to district
     */
    async submitForm() {
        return await this.request(`${this.baseURL}/submit-form/`, {
            method: 'POST',
        });
    }

    /**
     * Cancel form submission and revert to draft
     */
    async cancelSubmission() {
        return await this.request(`${this.baseURL}/cancel-submission/`, {
            method: 'POST',
        });
    }

    /**
     * Get user's district information
     */
    async getUserDistrict() {
        return await this.request(`${this.baseURL}/user-district/`);
    }

    /**
     * Get all remarks for the user's form
     */
    async getRemarks() {
        return await this.request(`${this.baseURL}/remarks/`);
    }

    /**
     * Get all form data for export (with category, topic, question, answer)
     */
    async getFormDataForExport() {
        return await this.request(`${this.baseURL}/export-data/`);
    }
}

// Export for use in other modules
window.SchoolFormAPI = SchoolFormAPI;

