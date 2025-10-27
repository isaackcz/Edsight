// user_dash_api.js - FastAPI integration for user dashboard

class UserDashboardAPI {
    constructor() {
        this.baseURL = ''; // Use relative URLs to Django
        this.user = null;
    }

    // Get authentication headers
    getHeaders() {
        return {
            'Content-Type': 'application/json',
        };
    }

    // Generic API call method
    async apiCall(endpoint, options = {}) {
        const startTime = Date.now();
        let success = false;
        
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: this.getHeaders(),
                credentials: 'include', // Include cookies for Django session
                ...options
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // Session expired or invalid
                    window.location.href = '/auth/login/';
                    return null;
                }
                throw new Error(`API Error: ${response.status}`);
            }

            success = true;
            return await response.json();
        } catch (error) {
            // API Call Error
            return null;
        } finally {
            // Track performance
            if (window.performanceMonitor) {
                window.performanceMonitor.trackApiCall(endpoint, startTime, Date.now(), success);
            }
        }
    }

    // Get user profile
    async getUserProfile() {
        return await this.apiCall('/api/profile/');
    }

    // Get dashboard statistics
    async getDashboardStats() {
        return await this.apiCall('/api/dashboard/stats/');
    }

    // Get category progress
    async getCategoryProgress() {
        return await this.apiCall('/api/dashboard/categories/');
    }

    // Get form sections
    async getFormSections() {
        return await this.apiCall('/api/form/sections/');
    }

    // Get saved answers from database
    async getSavedAnswers() {
        return await this.apiCall('/api/form/answers/');
    }

    // Submit form answer (supports both regular questions and sub-questions)
    // This method now delegates to the enhanced FormDataManager for better offline/online handling
    async submitFormAnswer(questionId, answer, subQuestionId = null) {
        // Use the enhanced FormDataManager if available
        if (window.formDataManager && window.formDataManager.submitFormAnswer) {
            console.log('Using enhanced FormDataManager for form submission');
            return await window.formDataManager.submitFormAnswer(questionId, answer, subQuestionId);
        }

        // Fallback to original implementation for backward compatibility
        console.log('Falling back to original form submission method');
        
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
        
        try {
            const result = await this.apiCall('/api/form/submit/', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            if (result) {
                return result;
            }
            // If result is null, treat as failure and try offline save
            if (window.pwaManager) {
                const saved = await window.pwaManager.saveFormData(formData);
                if (saved) {
                    return { success: true, offline: true, message: 'Data saved offline' };
                }
            }
            return { success: false };
        } catch (e) {
            console.error('Network error in form submission:', e);
            // Network or other error: fallback to offline save
            if (window.pwaManager) {
                const saved = await window.pwaManager.saveFormData(formData);
                if (saved) {
                    return { success: true, offline: true, message: 'Data saved offline' };
                }
            }
            return { success: false };
        }
    }

    // Update user profile
    async updateProfile(profileData) {
        return await this.apiCall('/api/profile/update/', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }


}

// UI Manager - Handles UI operations and batch submissions
class UIManager {
    constructor() {
        this.isSubmitting = false;
        this.init();
    }

    init() {
        // Initialize UI manager
    }

    // Batch submit all form data
    async batchSubmitFormData() {
        if (this.isSubmitting) {
            return false;
        }

        this.isSubmitting = true;
        
        try {
            // Show loading state
            this.showLoadingState();
            
            // Use the form data manager to save to database
            if (window.formDataManager) {
                const success = await window.formDataManager.batchSubmitFormData();
                
                if (success) {
                    this.showSuccessMessage('All data saved successfully!');
                    return true;
                } else {
                    this.showErrorMessage('Failed to save data. Please try again.');
                    return false;
                }
            } else {
                this.showErrorMessage('Form data manager not available.');
                return false;
            }
        } catch (error) {
            // Error in batch submit
            this.showErrorMessage('An error occurred while saving data.');
            return false;
        } finally {
            this.isSubmitting = false;
            this.hideLoadingState();
        }
    }

    // Show loading state
    showLoadingState() {
        const batchSubmitBtn = document.getElementById('batch-submit');
        if (batchSubmitBtn) {
            batchSubmitBtn.disabled = true;
            batchSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }
    }

    // Hide loading state
    hideLoadingState() {
        const batchSubmitBtn = document.getElementById('batch-submit');
        if (batchSubmitBtn) {
            batchSubmitBtn.disabled = false;
            batchSubmitBtn.innerHTML = '<i class="fas fa-save"></i> Save All';
        }
    }

    // Show success message
    showSuccessMessage(message) {
        if (window.formDataManager) {
            window.formDataManager.showNotification(message, 'success');
        } else {
            alert(message);
        }
    }

    // Show error message
    showErrorMessage(message) {
        if (window.formDataManager) {
            window.formDataManager.showNotification(message, 'error');
        } else {
            alert(message);
        }
    }

    // Show confirmation dialog
    showConfirmation(title, message, details = [], confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning') {
        if (window.formDataManager) {
            return window.formDataManager.createConfirmationModal(title, message, details, confirmText, cancelText, type);
        } else {
            return confirm(message);
        }
    }

    // Get form statistics (includes sub-questions)
    getFormStatistics() {
        if (!window.formDataManager) {
            return {
                totalQuestions: 0,
                answeredQuestions: 0,
                savedLocally: 0,
                savedToDatabase: 0
            };
        }

        const formData = window.formDataManager.getFormData();
        // Include both regular questions and sub-questions
        const allInputs = document.querySelectorAll('input, select, textarea');
        const subQuestionInputs = document.querySelectorAll('[data-sub-question-id]');
        const totalQuestions = allInputs.length;
        
        // Count inputs that have values (either from database or local storage)
        let answeredQuestions = 0;
        let savedLocally = 0;
        let savedToDatabase = 0;
        
        allInputs.forEach(input => {
            const questionId = window.formDataManager.getQuestionId(input);
            const subQuestionId = input.getAttribute('data-sub-question-id');
            const hasValue = input.type === 'radio' || input.type === 'checkbox' ? 
                input.checked : (input.value && input.value.trim() !== '');
            
            if (hasValue) {
                answeredQuestions++;
                
                // Create unique key for sub-questions
                const dataKey = subQuestionId ? `${questionId}_sub_${subQuestionId}` : questionId;
                
                // Check if this is from local storage or database
                const localData = formData[dataKey];
                if (localData && localData.saveState === 'local') {
                    savedLocally++;
                } else if (hasValue) {
                    // If it has a value but not in localStorage, it's from database
                    savedToDatabase++;
                }
            }
        });

        return {
            totalQuestions,
            answeredQuestions,
            savedLocally,
            savedToDatabase
        };
    }

    // Update dashboard statistics
    updateDashboardStats() {
        const stats = this.getFormStatistics();
        
        // Update progress indicators
        if (window.formDataManager) {
            window.formDataManager.updateProgressIndicators();
        }
        
        // Update completion indicators
        if (window.formDataManager) {
            window.formDataManager.checkSectionCompletion();
        }
    }

    // Initialize the UI manager
    static init() {
        if (!window.uiManager) {
            window.uiManager = new UIManager();
        }
        return window.uiManager;
    }
}

// UIManager initialization is handled by DashboardUIManager below
// Removed duplicate DOMContentLoaded listener to prevent conflicts

// Export for use in other scripts
window.UIManager = UIManager;

// Dashboard UI Manager
class DashboardUIManager {
    constructor() {
        this.api = new UserDashboardAPI();
        this.currentPage = localStorage.getItem('userDashPage') || 'dashboard';
        this.formSections = [];
        this.notificationTimeout = null;
        this.currentCategory = null;
        this.currentSubSection = null;
        this.currentTopic = null;
        this.lastFocusedInput = null;
        this.autoSaveTimeout = null;
        
        // Enhanced form state persistence
        this.formState = this.loadFormState();
        
        // Cache for API responses to prevent redundant calls
        this.cache = {
            dashboardStats: null,
            categoryProgress: null,
            formSections: null,
            userProfile: null,
            lastFetch: {
                dashboardStats: 0,
                categoryProgress: 0,
                formSections: 0,
                userProfile: 0
            }
        };
        
        // Cache expiration time (5 minutes)
        this.cacheExpiry = 5 * 60 * 1000;
        
        // Loading states to prevent concurrent requests
        this.loadingStates = {
            dashboardStats: false,
            categoryProgress: false,
            formSections: false,
            userProfile: false
        };
    }

    // Enhanced form state persistence methods
    loadFormState() {
        try {
            const savedState = localStorage.getItem('edsight_form_state');
            if (savedState) {
                const parsed = JSON.parse(savedState);
                return parsed;
            } else {
                return {
                    currentCategory: null,
                    currentSubSection: null,
                    currentTopic: null,
                    scrollPosition: 0,
                    lastVisited: Date.now()
                };
            }
        } catch (error) {
            // Error loading form state
            return {
                currentCategory: null,
                currentSubSection: null,
                currentTopic: null,
                scrollPosition: 0,
                lastVisited: Date.now()
            };
        }
    }

    saveFormState() {
        try {
            const stateToSave = {
                currentCategory: this.currentCategory,
                currentSubSection: this.currentSubSection,
                currentTopic: this.currentTopic,
                scrollPosition: window.scrollY,
                lastVisited: Date.now(),
                // Add more specific identifiers
                categoryId: this.currentCategory?.category_id || this.currentCategory?.category_name,
                subSectionName: this.currentSubSection,
                topicName: this.currentTopic
            };
            
            localStorage.setItem('edsight_form_state', JSON.stringify(stateToSave));
        } catch (error) {
            // Error saving form state
        }
    }

    restoreFormState() {
        if (!this.formState || !this.formState.currentCategory) return;
        
        // Wait for form sections to be loaded first
        const waitForFormSections = () => {
            if (this.formSections && this.formSections.length > 0) {
                this.performFormStateRestoration();
            } else {
                setTimeout(waitForFormSections, 100);
            }
        };
        
        waitForFormSections();
    }

    performFormStateRestoration() {
        try {
            // Step 1: Navigate to the category
            if (this.formState.currentCategory) {
                const categoryId = this.formState.currentCategory.category_id || this.formState.currentCategory.category_name;
                
                // Force navigation to category
                this.showCategoryDetails(categoryId);
                
                // Step 2: Wait for category to load, then navigate to subsection
                setTimeout(() => {
                    if (this.formState.currentSubSection) {
                        // Force navigation to subsection
                        this.showSubSectionDetails(this.formState.currentSubSection);
                        
                        // Step 3: Wait for subsection to load, then scroll to topic
                        setTimeout(() => {
                            if (this.formState.currentTopic) {
                                // Scroll to the specific topic
                                const topicElement = document.getElementById(`topic-${this.slugify(this.formState.currentTopic)}`);
                                if (topicElement) {
                                    topicElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    
                                    // Restore scroll position within the topic
                                    if (this.formState.scrollPosition > 0) {
                                        setTimeout(() => {
                                            window.scrollTo(0, this.formState.scrollPosition);
                                        }, 200);
                                    }
                                } else {
                                    // Topic element not found
                                }
                            }
                        }, 300); // Increased delay for subsection loading
                    }
                }, 200); // Increased delay for category loading
            }
        } catch (error) {
            // Error during form state restoration
        }
    }

    async init() {
        // Initialize UIManager
        UIManager.init();
        
        // Load real data immediately
        await this.loadUserProfile();
        await this.loadDashboardData();
        
        // Setup event listeners
        this.setupEventListeners();
        this.showCurrentPage();
        
        // Make UI manager globally accessible
        window.uiManager = this;
        window.dashboardUIManager = this;
        
        // Auto-restore form state if available
        if (this.formState && this.formState.currentCategory) {
            // Auto-restoring form state on page load
            // Wait a bit for the page to fully load before restoring
            setTimeout(() => {
                this.restoreFormState();
            }, 1000);
        }
    }

    // Cache management methods
    isCacheValid(cacheKey) {
        const lastFetch = this.cache.lastFetch[cacheKey];
        return lastFetch && (Date.now() - lastFetch) < this.cacheExpiry;
    }

    updateCache(cacheKey, data) {
        this.cache[cacheKey] = data;
        this.cache.lastFetch[cacheKey] = Date.now();
    }

    clearCache(cacheKey = null) {
        if (cacheKey) {
            this.cache[cacheKey] = null;
            this.cache.lastFetch[cacheKey] = 0;
        } else {
            // Clear all cache
            Object.keys(this.cache).forEach(key => {
                if (key !== 'lastFetch') {
                    this.cache[key] = null;
                }
            });
            Object.keys(this.cache.lastFetch).forEach(key => {
                this.cache.lastFetch[key] = 0;
            });
        }
    }

    // Refresh specific data (useful after form submissions)
    async refreshData(dataType = null) {
        if (dataType) {
            this.clearCache(dataType);
            switch (dataType) {
                case 'dashboardStats':
                    await this.loadDashboardStats();
                    break;
                case 'categoryProgress':
                    await this.loadCategoryProgress();
                    break;
                case 'formSections':
                    await this.loadFormSections();
                    break;
                case 'userProfile':
                    await this.loadUserProfile();
                    break;
            }
        } else {
            // Refresh all data
            this.clearCache();
            await this.loadDashboardData();
        }
    }

    // Batch submit form data to reduce API calls
    async batchSubmitFormData() {
        if (!window.formDataManager) return;
        
        const formData = window.formDataManager.getFormData();
        const localData = Object.entries(formData)
            .filter(([_, data]) => data.saveState === 'local')
            .map(([questionId, data]) => ({
                question_id: parseInt(questionId),
                answer: data.value
            }));
        
        if (localData.length === 0) return;
        
        try {
            // Submit all local data at once
            const promises = localData.map(item => 
                this.api.submitFormAnswer(item.question_id, item.answer)
            );
            
            const results = await Promise.all(promises);
            const successCount = results.filter(result => result).length;
            
            if (successCount > 0) {
                // Mark successful submissions as saved to database
                localData.forEach((item, index) => {
                    if (results[index]) {
                        window.formDataManager.markAsSavedToDatabase(item.question_id.toString());
                    }
                });
                
                // Refresh dashboard stats
                this.clearCache('dashboardStats');
                await this.loadDashboardStats();
                
                this.showNotification(`${successCount} answers saved to database`, 'success');
            }
        } catch (error) {
            // Batch submit error
            this.showNotification('Some answers failed to save', 'error');
        }
    }

    async loadUserProfile() {
        // Check cache first
        if (this.isCacheValid('userProfile') && this.cache.userProfile) {
            this.updateUserProfile(this.cache.userProfile);
            return;
        }

        // Prevent concurrent requests
        if (this.loadingStates.userProfile) {
            return;
        }

        this.loadingStates.userProfile = true;
        
        try {
            const profile = await this.api.getUserProfile();
            this.updateCache('userProfile', profile);
            this.updateUserProfile(profile);
        } catch (error) {
            // Failed to load user profile
            this.showNotification('Failed to load user profile', 'error');
        } finally {
            this.loadingStates.userProfile = false;
        }
    }

    async loadDashboardData() {
        try {
            // Load data in parallel, but only if not already cached
            const promises = [];
            
            if (!this.isCacheValid('dashboardStats') && !this.loadingStates.dashboardStats) {
                promises.push(this.loadDashboardStats());
            }
            
            if (!this.isCacheValid('categoryProgress') && !this.loadingStates.categoryProgress) {
                promises.push(this.loadCategoryProgress());
            }
            
            if (!this.isCacheValid('formSections') && !this.loadingStates.formSections) {
                promises.push(this.loadFormSections());
            }
            
            // If we have cached data, update UI immediately
            if (this.cache.dashboardStats) {
                this.updateDashboardStats(this.cache.dashboardStats);
            }
            
            if (this.cache.categoryProgress) {
                this.updateCategoryProgress(this.cache.categoryProgress);
            }
            
            if (this.cache.formSections) {
                this.formSections = this.cache.formSections;
            }
            
            // Wait for any new data to load
            if (promises.length > 0) {
                await Promise.all(promises);
            }
        } catch (error) {
            // Failed to load dashboard data
            this.showNotification('Failed to load dashboard data', 'error');
        }
    }

    async loadDashboardStats() {
        // Check cache first
        if (this.isCacheValid('dashboardStats') && this.cache.dashboardStats) {
            this.updateDashboardStats(this.cache.dashboardStats);
            return;
        }

        // Prevent concurrent requests
        if (this.loadingStates.dashboardStats) {
            return;
        }

        this.loadingStates.dashboardStats = true;
        
        try {
            const stats = await this.api.getDashboardStats();
            this.updateCache('dashboardStats', stats);
            this.updateDashboardStats(stats);
        } catch (error) {
            // Failed to load dashboard stats
        } finally {
            this.loadingStates.dashboardStats = false;
        }
    }

    async loadCategoryProgress() {
        // Check cache first
        if (this.isCacheValid('categoryProgress') && this.cache.categoryProgress) {
            this.updateCategoryProgress(this.cache.categoryProgress);
            return;
        }

        // Prevent concurrent requests
        if (this.loadingStates.categoryProgress) {
            return;
        }

        this.loadingStates.categoryProgress = true;
        
        try {
            const categories = await this.api.getCategoryProgress();
            this.updateCache('categoryProgress', categories);
            this.updateCategoryProgress(categories);
        } catch (error) {
            // Failed to load category progress
        } finally {
            this.loadingStates.categoryProgress = false;
        }
    }

    async loadFormSections() {
        // Start form sections loading task
        if (window.preloaderManager) {
            window.preloaderManager.startTask('Form Sections');
        }
        
        // Check cache first
        if (this.isCacheValid('formSections') && this.cache.formSections) {
            this.formSections = this.cache.formSections;
            // Update UI if we're on the form page
            if (this.currentPage === 'form') {
                this.updateFormSections(this.formSections);
            }
            
            // Complete form sections task
            if (window.preloaderManager) {
                window.preloaderManager.completeTask('Form Sections');
            }
            return;
        }

        // Prevent concurrent requests
        if (this.loadingStates.formSections) {
            return;
        }

        this.loadingStates.formSections = true;
        
        try {
            const sections = await this.api.getFormSections();
            this.updateCache('formSections', sections);
            this.formSections = sections;
            
            // Update UI if we're on the form page
            if (this.currentPage === 'form' && sections && sections.length > 0) {
                this.updateFormSections(sections);
            }
        } catch (error) {
            // Failed to load form sections
            if (this.currentPage === 'form') {
                const container = document.querySelector('.form-container');
                if (container) {
                    container.innerHTML = `
                        <div class="loading-message">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>Failed to load form data. Please refresh the page or try again.</p>
                        </div>
                    `;
                }
            }
        } finally {
            this.loadingStates.formSections = false;
            
            // Complete form sections task
            if (window.preloaderManager) {
                window.preloaderManager.completeTask('Form Sections');
            }
        }
    }

    updateUserProfile(profile) {
        const usernameElement = document.querySelector('.username');
        const roleElement = document.querySelector('.role');
        const profileNameElement = document.querySelector('#profile-page h2');
        const profileRoleElement = document.querySelector('#profile-page p');

        if (usernameElement) usernameElement.textContent = profile.name || 'User Name';
        if (roleElement) roleElement.textContent = profile.role || 'User';
        if (profileNameElement) profileNameElement.textContent = profile.name || 'User Name';
        if (profileRoleElement) profileRoleElement.textContent = profile.role || 'User';
        
        // Update profile form fields with new structure
        if (profile.personal_info) {
            const schoolNameInput = document.getElementById('school_name');
            const emailInput = document.getElementById('email');
            const regionInput = document.getElementById('region');
            const divisionInput = document.getElementById('division');
            const districtInput = document.getElementById('district');
            
            if (schoolNameInput) schoolNameInput.value = profile.personal_info.school_name || '';
            if (emailInput) emailInput.value = profile.personal_info.email || '';
            if (regionInput) regionInput.value = profile.personal_info.region || '';
            if (divisionInput) divisionInput.value = profile.personal_info.division || '';
            if (districtInput) districtInput.value = profile.personal_info.district || '';
        }
    }

    updateDashboardStats(stats) {
        // Update progress circle
        const progressCircle = document.querySelector('.progress-circle-large canvas');
        if (progressCircle && window.mainProgressChart) {
            const progress = stats.overall_progress || 0;
            updateMainProgressChart(progress);
        }
        
        // Update progress percentage with precise decimal values
        const progressPercentage = document.querySelector('.progress-percentage');
        if (progressPercentage) {
            const progress = stats.overall_progress || 0;
            // Display the actual precise value, even if very small
            if (progress < 0.01) {
                progressPercentage.textContent = progress.toFixed(4) + '%';
            } else if (progress < 1) {
                progressPercentage.textContent = progress.toFixed(2) + '%';
            } else {
                progressPercentage.textContent = progress.toFixed(1) + '%';
            }
        }

        // Update stats cards
        const answeredCount = document.getElementById('answered-count');
        const savedCount = document.getElementById('saved-count');
        const databaseCount = document.getElementById('database-count');
        
        if (answeredCount) answeredCount.textContent = stats.answered_questions || 0;
        if (savedCount) savedCount.textContent = stats.answered_questions || 0; // Using answered as saved locally
        if (databaseCount) databaseCount.textContent = stats.answered_questions || 0; // Using answered as in database
        
        // Update deadline
        const deadlineText = document.querySelector('.deadline-text');
        if (deadlineText) {
            deadlineText.textContent = `${stats.deadline_days || 30} days remaining`;
        }
        
        const deadlineFill = document.querySelector('.deadline-fill');
        if (deadlineFill) {
            const daysUsed = 30 - (stats.deadline_days || 30);
            const percentageUsed = (daysUsed / 30) * 100;
            deadlineFill.style.width = Math.min(percentageUsed, 100) + '%';
        }
        
        // Update deadline percentage
        const deadlinePercentage = document.querySelector('.deadline-percentage');
        if (deadlinePercentage) {
            const percentageUsed = ((30 - (stats.deadline_days || 30)) / 30) * 100;
            deadlinePercentage.textContent = `${Math.round(percentageUsed)}% of time used`;
        }
    }

    updateCategoryProgress(categories) {
        const container = document.querySelector('.category-progress');
        if (!container) return;

        container.innerHTML = '';
        categories.forEach(category => {
            const progressItem = document.createElement('div');
            progressItem.className = 'progress-item';
            progressItem.innerHTML = `
                <div class="progress-label">
                    <span>${category.category_name}</span>
                    <span>${category.progress_percentage}%</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${category.progress_percentage}%"></div>
                </div>
            `;
            container.appendChild(progressItem);
        });
    }

    updateMainProgressChart(progress) {
        // Update main progress chart with real data
        if (window.mainProgressChart) {
            const actualProgress = progress || 0;
            
            // Handle very small decimal values (less than 1%)
            const chartProgress = Math.max(actualProgress, 0.01); // Minimum 0.01% for visual representation
            const remainingProgress = 100 - chartProgress;
            
            window.mainProgressChart.data.datasets[0].data = [chartProgress, remainingProgress];
            window.mainProgressChart.update();
            
            // Update center text with precise decimal values
            const progressPercentage = document.querySelector('.progress-percentage');
            if (progressPercentage) {
                // Display the actual precise value, even if very small
                if (actualProgress < 0.01) {
                    progressPercentage.textContent = actualProgress.toFixed(4) + '%';
                } else if (actualProgress < 1) {
                    progressPercentage.textContent = actualProgress.toFixed(2) + '%';
                } else {
                    progressPercentage.textContent = actualProgress.toFixed(1) + '%';
                }
            }
        }
    }

    updateFormSections(categories) {
        const container = document.querySelector('.form-container');
        if (!container) {
            return;
        }

        if (!categories || categories.length === 0) {
            container.innerHTML = `
                <div class="loading-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No form data available. Please check your connection or contact support.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        
        // Create category list view
        categories.forEach((category, index) => {
            const categoryElement = document.createElement('div');
            categoryElement.className = `form-section ${category.status}`;
            categoryElement.innerHTML = `
                <div class="section-header" data-category-id="${category.category_id}">
                    <div class="section-title">
                        <i class="fas fa-folder"></i>
                        <h3>${category.category_name}</h3>
                    </div>
                    <div class="section-status">
                        <span class="badge ${this.getStatusClass(category.status)}">${this.getStatusText(category.status)}</span>
                        <span class="question-count">${category.total_questions} questions</span>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            `;
            container.appendChild(categoryElement);
        });

        // Re-attach event listeners
        this.attachFormEventListeners();
        
        // FormDataManager features are initialized in renderForm() in user_dash.js
        // No need to duplicate the call here
    }

    showCategoryDetails(categoryId) {
        const container = document.querySelector('.form-container');
        if (!container) return;

        // Find the category data by ID or name
        const category = this.formSections.find(c => 
            c.category_id == categoryId || 
            c.category_name === categoryId || 
            c.name === categoryId
        );
        if (!category) {
            // Category not found
            return;
        }

        this.currentCategory = category;
        this.currentSubSection = null;
        this.currentTopic = null;
        
        // Save form state
        this.saveFormState();

        // Group questions by sub-section and topic
        const groupedQuestions = this.groupQuestionsBySubSection(category.questions);

        // Create breadcrumb and content
        container.innerHTML = `
            <div class="breadcrumb-navigation">
                <button class="breadcrumb-item" data-action="back-to-categories">
                    <i class="fas fa-home"></i>
                    Categories
                </button>
                <i class="fas fa-chevron-right breadcrumb-separator"></i>
                <span class="breadcrumb-current">${category.category_name}</span>
            </div>
            <div class="sticky-header">
                <h2 class="section-title-main">${category.category_name}</h2>
                <div class="category-summary">
                    <span class="total-questions">${category.total_questions} total questions</span>
                    <span class="answered-questions">${category.answered_questions} answered</span>
                </div>
            </div>
            <div class="subsections-container">
                ${this.renderSubSectionsList(groupedQuestions)}
            </div>
        `;

        // Add breadcrumb event listener
        const backBtn = container.querySelector('[data-action="back-to-categories"]');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.goBackToCategories();
            });
        }

        // Add sub-section click event listeners
        this.attachSubSectionEventListeners();
    }

    renderSubSectionsList(groupedQuestions) {
        let html = '';
        const subSections = Object.keys(groupedQuestions);
        
        subSections.forEach((subSection, index) => {
            // Calculate progress for this sub-section
            let totalQuestions = 0;
            let answeredQuestions = 0;
            
            Object.values(groupedQuestions[subSection]).forEach(questions => {
                questions.forEach(q => {
                    if (q.sub_questions && q.sub_questions.length > 0) {
                        totalQuestions += q.sub_questions.length;
                        // Count answered sub-questions
                        q.sub_questions.forEach(subQ => {
                            if (subQ.is_answered) answeredQuestions += 1;
                        });
                    } else {
                        totalQuestions += 1;
                        if (q.is_answered) answeredQuestions += 1;
                    }
                });
            });
            
            const progressPercent = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
            
            html += `
                <div class="subsection-card" data-subsection="${subSection}">
                    <div class="subsection-header">
                        <div class="subsection-info">
                            <h3 class="subsection-title">${subSection}</h3>
                            <div class="subsection-stats">
                                <span class="total-questions">${totalQuestions} questions</span>
                                <span class="answered-questions">${answeredQuestions} answered</span>
                            </div>
                        </div>
                        <div class="subsection-progress">
                            <div class="progress-circle" style="--progress: ${progressPercent}">
                                <span class="progress-text">${progressPercent}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="subsection-topics">
                        <span class="topics-label">Topics:</span>
                        <div class="topics-list">
                            ${Object.keys(groupedQuestions[subSection]).map(topic => 
                                `<span class="topic-tag">${topic}</span>`
                            ).join('')}
                        </div>
                    </div>
                </div>
            `;
        });
        
        return html;
    }

    attachSubSectionEventListeners() {
        const subSectionCards = document.querySelectorAll('.subsection-card');
        subSectionCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const subSectionName = card.dataset.subsection;
                this.showSubSectionDetails(subSectionName);
            });
        });
    }

    showSubSectionDetails(subSectionName) {
        const container = document.querySelector('.form-container');
        if (!container || !this.currentCategory) return;

        // Group questions by sub-section and topic
        const groupedQuestions = this.groupQuestionsBySubSection(this.currentCategory.questions);
        const subSectionTopics = groupedQuestions[subSectionName];
        
        if (!subSectionTopics) return;

        this.currentSubSection = subSectionName;
        this.currentTopicKeys = Object.keys(subSectionTopics);
        this.currentTopicsData = subSectionTopics;
        
        // Save form state
        this.saveFormState();

        // Build breadcrumb + content-with-rail layout
        container.innerHTML = `
            <div class="breadcrumb-navigation">
                <button class="breadcrumb-item" data-action="back-to-categories">
                    <i class="fas fa-home"></i>
                    Categories
                </button>
                <i class="fas fa-chevron-right breadcrumb-separator"></i>
                <button class="breadcrumb-item" data-action="back-to-category">
                    ${this.currentCategory.category_name}
                </button>
                <i class="fas fa-chevron-right breadcrumb-separator"></i>
                <span class="breadcrumb-current">${subSectionName}</span>
            </div>
            <div class="sticky-header">
                <h2 class="section-title-main">${subSectionName}</h2>
                <div class="category-summary">
                    <span class="total-questions">${Object.values(subSectionTopics).flat().length} total questions</span>
                </div>
            </div>
            <div class="content-with-rail">
                <div class="questions-container"></div>
                <div class="topic-rail" aria-label="Topic navigation">
                    <div class="topic-rail-line"></div>
                    <div class="topic-dots"></div>
                    <div class="sub-sections-panel hidden" aria-label="Sub-sections navigation">
                        <h4 class="sub-sections-title">
                            <i class="fas fa-layer-group"></i>
                            Other Sub-sections
                        </h4>
                        <div class="sub-sections-list"></div>
                    </div>
                </div>
            </div>
        `;

        // Render all topics content
        this.renderAllTopicsInSubSection(subSectionTopics);

        // Setup Topic Rail UI
        this.renderTopicRail();
        this.initScrollSpy();

        // Breadcrumb listeners
        const backToCategoriesBtn = container.querySelector('[data-action="back-to-categories"]');
        const backToCategoryBtn = container.querySelector('[data-action="back-to-category"]');
        if (backToCategoriesBtn) {
            backToCategoriesBtn.addEventListener('click', () => this.goBackToCategories());
        }
        if (backToCategoryBtn) {
            backToCategoryBtn.addEventListener('click', () => this.showCategoryDetails(this.currentCategory.category_id));
        }

        // Re-attach form event listeners & keyboard helpers
        this.attachFormEventListeners();
        this.setupKeyboardNavigation();
        this.autoFocusFirstInput();
        
        // Add scroll listener to save state when user scrolls
        this.addScrollListener();

        // Note: Auto-restoration disabled per user preference
        // Use window.formDataManager.forceRestoreFormData() if manual restore is needed
    }

    // Render all topics for the current sub-section (one after another)
    renderAllTopicsInSubSection(subSectionTopics) {
        const container = document.querySelector('.questions-container');
        if (!container || !subSectionTopics) return;

        let html = '';
        for (const [topic, questions] of Object.entries(subSectionTopics)) {
            // Progress calc
            let total = 0;
            let answered = 0;
            questions.forEach(q => {
                // Check if this question should be treated as a regular question
                if (this.isRegularQuestion(q)) {
                    total += 1;
                    if (q.is_answered) answered += 1;
                } else if (q.sub_questions && q.sub_questions.length > 0) {
                    total += q.sub_questions.length;
                } else {
                    total += 1;
                    if (q.is_answered) answered += 1;
                }
            });
            const percent = total === 0 ? 0 : Math.round((answered / total) * 100);

            html += `<div class="topic-group" data-topic="${topic}" id="topic-${this.slugify(topic)}">`;
            html += `<h4 class="topic-title">${topic}</h4>`;
            html += this.renderTopicProgressBar(percent, answered, total);
            html += `<div class="questions-list">`;
            html += this.renderQuestions(questions);
            html += `</div>`;
            html += `</div>`;
        }

        container.innerHTML = html;
        
        // Initialize FormDataManager features after form inputs are rendered
        if (window.formDataManager) {
            window.formDataManager.initializeFormFeatures();
        }
    }

    // Add scroll listener to save state when user scrolls
    addScrollListener() {
        let scrollTimeout;
        const container = document.querySelector('.form-container');
        
        if (container) {
            container.addEventListener('scroll', () => {
                // Debounce scroll events to avoid excessive state saving
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    this.saveFormState();
                }, 100);
            });
        }
    }

    // Utility to create URL-safe IDs
    slugify(text) {
        return text.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    // Build the Topic Rail as a simple bulleted list
    renderTopicRail() {
        const dotsContainer = document.querySelector('.topic-dots');
        if (!dotsContainer || !this.currentTopicKeys) return;

        let listHtml = '';
        this.currentTopicKeys.forEach((topic, index) => {
            listHtml += `
                <button class="topic-dot" 
                        data-topic="${topic}" 
                        data-index="${index}"
                        aria-label="Go to Topic: ${topic}">
                    <span class="dot-tooltip" aria-hidden="true">${topic}</span>
                </button>
            `;
        });

        dotsContainer.innerHTML = listHtml;

        // Attach listeners once per container to avoid duplicates on re-render
        if (!dotsContainer.dataset.listenersAttached) {
            // Click: jump/scroll to topic
            dotsContainer.addEventListener('click', (e) => {
                const dot = e.target.closest('.topic-dot');
                if (dot) {
                    const topic = dot.dataset.topic;
                    this.currentTopic = topic;
                    
                    // Save state when topic is clicked
                    this.saveFormState();
                    
                    const target = document.getElementById(`topic-${this.slugify(topic)}`);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
                    }
                }
            });

            // Keyboard navigation through list items
            dotsContainer.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const dots = Array.from(dotsContainer.querySelectorAll('.topic-dot'));
                    const currentIndex = dots.findIndex(dot => dot === e.target);
                    let nextIndex;
                    if (e.key === 'ArrowUp') {
                        nextIndex = currentIndex > 0 ? currentIndex - 1 : dots.length - 1;
                    } else {
                        nextIndex = currentIndex < dots.length - 1 ? currentIndex + 1 : 0;
                    }
                    dots[nextIndex].focus();
                }
            });

            dotsContainer.dataset.listenersAttached = 'true';
        }
    }

    // Observe topics to highlight the active dot and toggle the sub-sections panel on last topic
    initScrollSpy() {
        if (this.topicObserver) {
            this.topicObserver.disconnect();
        }
        const topicGroups = document.querySelectorAll('.topic-group');
        if (!topicGroups.length) return;

        this.topicObserver = new IntersectionObserver((entries) => {
            let activeIndex = -1;
            let maxRatio = 0;

            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
                    maxRatio = entry.intersectionRatio;
                    const topic = entry.target.dataset.topic;
                    activeIndex = this.currentTopicKeys.indexOf(topic);
                }
            });

            if (activeIndex >= 0) {
                this.updateActiveTopicDot(activeIndex);
                this.toggleSubSectionPanel(activeIndex === this.currentTopicKeys.length - 1);
            }
        }, {
            threshold: [0, 0.25, 0.5, 0.75, 1],
            rootMargin: '-20% 0px -70% 0px'
        });

        topicGroups.forEach(group => this.topicObserver.observe(group));
    }

    updateActiveTopicDot(activeIndex) {
        const dots = document.querySelectorAll('.topic-dot');
        dots.forEach((dot, index) => {
            if (index === activeIndex) {
                dot.classList.add('active');
                dot.setAttribute('aria-current', 'true');
            } else {
                dot.classList.remove('active');
                dot.removeAttribute('aria-current');
            }
        });
    }

    // Show/Hide the mini sub-sections panel only on the last topic
    toggleSubSectionPanel(show) {
        const panel = document.querySelector('.sub-sections-panel');
        if (!panel) return;

        if (show) {
            panel.classList.remove('hidden');
            this.renderSubSectionsListInPanel();
        } else {
            panel.classList.add('hidden');
        }
    }

    // Populate the mini sub-sections panel (excluding current)
    renderSubSectionsListInPanel() {
        const listContainer = document.querySelector('.sub-sections-list');
        if (!listContainer || !this.currentCategory) return;

        const groupedQuestions = this.groupQuestionsBySubSection(this.currentCategory.questions);
        let html = '';
        for (const [subSection, topics] of Object.entries(groupedQuestions)) {
            if (subSection === this.currentSubSection) continue;
            const totalQuestions = Object.values(topics).flat().length;
            html += `
                <button class="sub-section-item" data-subsection="${subSection}">
                    <span class="sub-section-name">${subSection}</span>
                    <span class="sub-section-count">${totalQuestions} questions</span>
                </button>
            `;
        }
        listContainer.innerHTML = html;

        listContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.sub-section-item');
            if (item) {
                const subSectionName = item.dataset.subsection;
                this.showSubSectionDetails(subSectionName);
            }
        });
    }

    // Render the current topic into the questions container
    renderCurrentTopic() {
        const container = document.querySelector('.questions-container');
        if (!container || !this.currentTopicsData || !this.currentTopicKeys) return;

        const totalTopics = this.currentTopicKeys.length;
        const currentKey = this.currentTopicKeys[this.currentTopicIndex] || '';
        const questions = this.currentTopicsData[currentKey] || [];

        // Build single topic markup
        let total = 0;
        let answered = 0;
        questions.forEach(q => {
            if (q.sub_questions && q.sub_questions.length > 0) {
                total += q.sub_questions.length;
            } else {
                total += 1;
                if (q.is_answered) answered += 1;
            }
        });
        const percent = total === 0 ? 0 : Math.round((answered / total) * 100);

        container.innerHTML = [
            `<div class="topic-group" data-topic="${currentKey}">`,
            `<h4 class="topic-title">${currentKey}</h4>`,
            this.renderTopicProgressBar(percent, answered, total),
            `<div class="questions-list">`,
            this.renderQuestions(questions),
            `</div>`,
            `</div>`
        ].join('');

        // Update pagination status and button states
        const posEl = document.querySelector('.topic-pagination .topic-position');
        const nameEl = document.querySelector('.topic-pagination .topic-name');
        if (posEl) posEl.textContent = `Topic ${this.currentTopicIndex + 1} of ${totalTopics}`;
        if (nameEl) nameEl.textContent = currentKey ? ` — ${currentKey}` : '';

        const prevBtn = document.querySelector('.topic-pagination .prev');
        const nextBtn = document.querySelector('.topic-pagination .next');
        if (prevBtn) prevBtn.disabled = this.currentTopicIndex <= 0;
        if (nextBtn) nextBtn.disabled = this.currentTopicIndex >= totalTopics - 1;

        // Initialize FormDataManager features after form inputs are rendered
        if (window.formDataManager) {
            window.formDataManager.initializeFormFeatures();
        }
        
        // Re-attach form listeners for newly rendered inputs
        this.attachFormEventListeners();
        this.setupKeyboardNavigation();
        this.autoFocusFirstInput();

        // Note: Auto-restoration disabled per user preference
        // Use window.formDataManager.forceRestoreFormData() if manual restore is needed
    }

    attachTopicPaginationListeners() {
        const prevBtn = document.querySelector('.topic-pagination .prev');
        const nextBtn = document.querySelector('.topic-pagination .next');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentTopicIndex > 0) {
                    this.currentTopicIndex--;
                    this.renderCurrentTopic();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.currentTopicIndex < this.currentTopicKeys.length - 1) {
                    this.currentTopicIndex++;
                    this.renderCurrentTopic();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        }
    }

    groupQuestionsBySubSection(questions) {
        const grouped = {};
        questions.forEach(question => {
            const subSection = question.sub_section_name || 'Uncategorized';
            const topic = question.topic_name || 'General';
            
            if (!grouped[subSection]) {
                grouped[subSection] = {};
            }
            if (!grouped[subSection][topic]) {
                grouped[subSection][topic] = [];
            }
            grouped[subSection][topic].push(question);
        });
        
        return grouped;
    }

    renderGroupedQuestions(groupedQuestions) {
        let html = '';
        for (const [subSection, topics] of Object.entries(groupedQuestions)) {
            const safeSubSection = subSection || 'Uncategorized';
            html += `<div class="subsection-group">`;
            html += `<h3 class="subsection-title">${safeSubSection}</h3>`;
            
            for (const [topic, questions] of Object.entries(topics)) {
                const safeTopic = topic || 'General';
                // Progress bar calculation
                let total = 0;
                let answered = 0;
                questions.forEach(q => {
                    if (q.sub_questions && q.sub_questions.length > 0) {
                        total += q.sub_questions.length;
                        // Count answered sub-questions
                        q.sub_questions.forEach(subQ => {
                            if (subQ.is_answered) answered += 1;
                        });
                    } else {
                        total += 1;
                        if (q.is_answered) answered += 1;
                    }
                });
                // For now, progress is always 0, but structure is ready for real data
                let percent = total === 0 ? 0 : Math.round((answered / total) * 100);
                html += `<div class="topic-group" data-topic="${safeTopic}">`;
                html += `<h4 class="topic-title">${safeTopic}</h4>`;
                html += this.renderTopicProgressBar(percent, answered, total, safeTopic);
                html += `<div class="questions-list">`;
                html += this.renderQuestions(questions);
                html += `</div>`;
                html += `</div>`;
            }
            html += `</div>`;
        }
        return html;
    }

    renderTopicProgressBar(percent, answered, total, topic = '') {
        return `
            <div class="topic-progress-bar-container" data-topic-id="${topic}">
                <div class="topic-progress-bar-bg">
                    <div class="topic-progress-bar-fill" style="width: ${percent}%;"></div>
                </div>
                <span class="topic-progress-label">${answered} / ${total} answered</span>
            </div>
        `;
    }

    // Check if a question should be treated as a regular question (not a container for sub-questions)
    isRegularQuestion(question) {
        // Questions like "District" and "Division" should be regular questions
        // even if they have sub-questions in the database
        const regularQuestionTexts = ['District', 'Division', 'Region'];
        return regularQuestionTexts.some(text => question.question_text.includes(text));
    }

    renderQuestions(questions) {
        return questions.map(question => {
            let questionHtml = `
                <div class="form-group question-container" data-question-id="${question.question_id}">
                    <div class="question-header">
                        <label class="question-label">${question.question_text} ${question.is_required ? '*' : ''}</label>
                        ${this.renderCoverageIndicator(question)}
                    </div>`;
            
            // Check if this question should be treated as a regular question (not a container for sub-questions)
            // Some questions like "District" and "Division" should be regular questions even if they have sub-questions
            const shouldBeRegularQuestion = this.isRegularQuestion(question);
            
            if (shouldBeRegularQuestion || !question.sub_questions || question.sub_questions.length === 0) {
                questionHtml += this.renderQuestionInput(question);
            } else {
                // If question has sub-questions, render them nested directly under the question
                questionHtml += this.renderSubQuestionsDirectly(question);
            }
            
            questionHtml += `</div>`;
            return questionHtml;
        }).join('');
    }

    renderCoverageIndicator(question) {
        const subQuestionsCount = question.sub_questions ? question.sub_questions.length : 0;
        if (subQuestionsCount === 0) {
            return '';
        }
        
        // Don't show sub-questions indicator for questions that should be treated as regular questions
        if (this.isRegularQuestion(question)) {
            return '';
        }
        
        return `
            <div class="coverage-indicator" data-question-id="${question.question_id}">
                <span class="coverage-badge">
                    <i class="fas fa-layer-group"></i>
                    ${subQuestionsCount} sub-questions
                </span>
            </div>
        `;
    }

    renderSubQuestionsDirectly(question) {
        if (!question.sub_questions || question.sub_questions.length === 0) {
            return '';
        }
        
        return `
            <div class="sub-questions-layer" id="sub-questions-${question.question_id}">
                <div class="sub-questions-content">
                    ${question.sub_questions.map((subQuestion, index) => `
                        <div class="sub-question-item">
                            <div class="sub-question-header">
                                <span class="sub-question-number">${index + 1}</span>
                                <label class="sub-question-label">${subQuestion.sub_question_text}</label>
                            </div>
                            ${this.renderInputByAnswerType(question.answer_type, {
                                'data-sub-question-id': subQuestion.sub_question_id,
                                'data-question-id': question.question_id,
                                'class': 'sub-question-input',
                                'data-required': question.is_required
                            })}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Helper function to render input based on answer type
    renderInputByAnswerType(answerType, additionalAttributes = {}) {
        // Determine input type and attributes based on answer_type
        let inputType = 'text';
        let placeholder = 'Enter your answer';
        let step = '';
        let min = '';
        let max = '';
        let helpData = null;
        
        switch (answerType) {
            case 'number':
                inputType = 'number';
                placeholder = 'Enter a number';
                step = '1';
                helpData = {
                    title: 'Number Input Help',
                    description: 'Enter a valid numeric value. Use whole numbers or decimals as appropriate.',
                    examples: ['42', '3.14', '1000'],
                    tips: ['Use the arrow keys to increment/decrement values', 'Decimal values are allowed']
                };
                break;
            case 'percentage':
                inputType = 'number';
                placeholder = 'Enter percentage (0-100)';
                step = '0.01';
                min = '0';
                max = '100';
                helpData = {
                    title: 'Percentage Input Help',
                    description: 'Enter a percentage value between 0 and 100. Decimal values are allowed for precision.',
                    examples: ['25', '50.5', '100'],
                    tips: ['Values must be between 0 and 100', 'Use decimals for precise percentages like 33.33']
                };
                break;
            case 'date':
                inputType = 'date';
                placeholder = 'Select a date';
                helpData = {
                    title: 'Date Input Help',
                    description: 'Select a date using the date picker or enter in YYYY-MM-DD format.',
                    examples: ['2024-01-15', '2023-12-31'],
                    tips: ['Click the calendar icon to open date picker', 'Use keyboard arrows to navigate dates']
                };
                break;
            case 'text':
            default:
                inputType = 'text';
                placeholder = 'Enter your answer';
                helpData = {
                    title: 'Text Input Help',
                    description: 'Enter your response as text. Be clear and concise in your answer.',
                    tips: ['Minimum 2 characters required', 'Maximum 500 characters allowed']
                };
                break;
        }
        
        // Generate unique ID for help functionality
        const inputId = `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Build attributes string
        const attributes = [
            `type="${inputType}"`,
            `placeholder="${placeholder}"`,
            `data-answer-type="${answerType}"`,
            `id="${inputId}"`,
            ...(step ? [`step="${step}"`] : []),
            ...(min ? [`min="${min}"`] : []),
            ...(max ? [`max="${max}"`] : []),
            ...Object.entries(additionalAttributes).map(([key, value]) => `${key}="${value}"`)
        ].join(' ');
        
        return `
            <div class="enhanced-input-container" style="position: relative;">
                <input ${attributes}>
                <button type="button" class="help-trigger" onclick="window.formDataManager && window.formDataManager.showContextualHelp(document.getElementById('${inputId}'), ${JSON.stringify(helpData).replace(/"/g, '&quot;')})" title="Show help for this field">
                    <i class="fas fa-question-circle"></i>
                </button>
            </div>
        `;
    }

    renderQuestionInput(question) {
        const inputClass = question.is_required ? 'question-input required' : 'question-input';
        
        return this.renderInputByAnswerType(question.answer_type, {
            'data-question-id': question.question_id,
            'class': inputClass,
            'data-required': question.is_required
        });
    }

    attachFormEventListeners() {
        // Handle category clicks to navigate to sub-sections
        const sectionHeaders = document.querySelectorAll('.section-header');
        sectionHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                const categoryId = header.dataset.categoryId;
                this.showCategoryDetails(categoryId);
            });
        });

        // Handle form submissions with auto-save
        const inputs = document.querySelectorAll('.question-input, .sub-question-input');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                this.handleInputChange(e);
            });
            
            input.addEventListener('keydown', (e) => {
                this.handleKeyNavigation(e);
            });
        });

        // Setup smart input validation for enhanced UX
        this.setupSmartInputAssistance();

        // Note: Auto-restoration disabled per user preference
        // Use window.formDataManager.forceRestoreFormData() if manual restore is needed
    }

    setupSmartInputAssistance() {
        if (window.formDataManager && window.formDataManager.addSmartInputAssistance) {
            const inputs = document.querySelectorAll('.question-input, .sub-question-input');
            inputs.forEach(input => {
                window.formDataManager.addSmartInputAssistance(input);
            });
        }
    }

    handleInputChange(e) {
        const input = e.target;
        const questionId = input.dataset.questionId;
        // Only treat as sub-question if the input has the sub-question-input class
        const subQuestionId = input.classList.contains('sub-question-input') ? input.dataset.subQuestionId : null;
        const answerType = input.dataset.answerType;
        let answer = input.value;
        
        // Validate input based on answer type
        let isValid = true;
        let validationMessage = '';
        
        if (answer.trim()) {
            switch (answerType) {
                case 'number':
                    const numValue = parseFloat(answer);
                    if (isNaN(numValue)) {
                        isValid = false;
                        validationMessage = 'Please enter a valid number';
                    }
                    break;
                    
                case 'percentage':
                    const percentValue = parseFloat(answer);
                    if (isNaN(percentValue) || percentValue < 0 || percentValue > 100) {
                        isValid = false;
                        validationMessage = 'Please enter a percentage between 0 and 100';
                    }
                    break;
                    
                case 'date':
                    const dateValue = new Date(answer);
                    if (isNaN(dateValue.getTime())) {
                        isValid = false;
                        validationMessage = 'Please enter a valid date';
                    }
                    break;
            }
        }
        
        // Update input validation state
        input.classList.remove('valid', 'invalid');
        if (answer.trim()) {
            input.classList.add(isValid ? 'valid' : 'invalid');
        }
        
        // Show validation message if needed
        this.showValidationMessage(input, validationMessage);
        
        // Use smart validation from FormDataManager if available
        if (window.formDataManager && window.formDataManager.validateInputSmart) {
            window.formDataManager.validateInputSmart(input);
        }
        
        // Do not persist locally here. We'll attempt server save first,
        // and only save to local storage on failure/offline.
        
        // Update topic-specific progress bars (user_dash_api.js specific)
        this.updateProgress();
        
        // Clear previous timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        // Set new timeout for auto-save to server (less frequent)
        this.autoSaveTimeout = setTimeout(async () => {
            // Always submit, even if empty, to reflect deletions server-side
            try {
                const result = await this.api.submitFormAnswer(
                    parseInt(questionId), 
                    answer,
                    subQuestionId ? parseInt(subQuestionId) : null
                );
                if (result && result.success) {
                    if (window.formDataManager) {
                        const actualQuestionId = subQuestionId ? subQuestionId : questionId;
                        window.formDataManager.markAsSavedToDatabase(actualQuestionId);
                        // After marking saved, if value is empty, reset indicator to none
                        if (!answer.trim()) {
                            window.formDataManager.updateSaveIndicator(actualQuestionId, 'none');
                        }
                        // New logic: on any successful save to database, clear all locally saved answers
                        if (window.formDataManager.clearAllLocalSavedAnswers) {
                            window.formDataManager.clearAllLocalSavedAnswers();
                        }
                    }
                    this.showSaveFeedback(input, true);
                    this.clearCache('dashboardStats');
                    await this.loadDashboardStats();
                } else {
                    // Failed due to connectivity or server; try saving offline
                    if (result && result.offline && window.formDataManager) {
                        const actualQuestionId = subQuestionId ? subQuestionId : questionId;
                        // Save locally only on offline path
                        window.formDataManager.saveFormData(actualQuestionId, answer, 'local');
                    }
                    this.showSaveFeedback(input, false);
                }
            } catch (error) {
                // Network error: save offline
                if (window.formDataManager) {
                    const actualQuestionId = subQuestionId ? subQuestionId : questionId;
                    window.formDataManager.saveFormData(actualQuestionId, answer, 'local');
                }
                this.showSaveFeedback(input, false);
            }
        }, 3000); // Auto-save to server after 3 seconds (reduced frequency)
    }

    showValidationMessage(input, message) {
        // Remove existing validation message div
        const existingMessage = input.parentNode.querySelector('.validation-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // Add tooltip validation message if there is one
        if (message) {
            input.setAttribute('title', message);
            input.setAttribute('data-validation-tooltip', 'invalid');
            input.classList.add('validation-invalid');
        } else {
            input.removeAttribute('title');
            input.removeAttribute('data-validation-tooltip');
            input.classList.remove('validation-invalid');
        }
    }

    handleKeyNavigation(e) {
        const input = e.target;
        
        if (e.key === 'Enter') {
            e.preventDefault();
            this.moveToNextInput(input);
        } else if (e.key === 'Tab') {
            // Let default tab behavior work, but mark the input
            this.lastFocusedInput = input;
        }
    }

    moveToNextInput(currentInput) {
        const allInputs = Array.from(document.querySelectorAll('.question-input, .sub-question-input'));
        const currentIndex = allInputs.indexOf(currentInput);
        
        if (currentIndex < allInputs.length - 1) {
            const nextInput = allInputs[currentIndex + 1];
            nextInput.focus();
            nextInput.select();
        }
    }

    showSaveFeedback(input, success) {
        // Remove previous feedback
        input.classList.remove('saved', 'error');
        
        if (success) {
            input.classList.add('saved');
            // Add checkmark icon
            const checkmark = document.createElement('i');
            checkmark.className = 'fas fa-check save-indicator';
            checkmark.style.position = 'absolute';
            checkmark.style.right = '8px';
            checkmark.style.top = '50%';
            checkmark.style.transform = 'translateY(-50%)';
            checkmark.style.color = '#34a853';
            checkmark.style.fontSize = '12px';
            
            // Remove previous checkmark
            const existingCheckmark = input.parentNode.querySelector('.save-indicator');
            if (existingCheckmark) {
                existingCheckmark.remove();
            }
            
            input.parentNode.style.position = 'relative';
            input.parentNode.appendChild(checkmark);
            
            // Remove checkmark after 2 seconds
            setTimeout(() => {
                checkmark.remove();
                input.classList.remove('saved');
            }, 2000);
        } else {
            input.classList.add('error');
            setTimeout(() => {
                input.classList.remove('error');
            }, 2000);
        }
    }

    setupKeyboardNavigation() {
        // Make all inputs tabbable in logical order
        const inputs = document.querySelectorAll('.question-input, .sub-question-input');
        inputs.forEach((input, index) => {
            input.setAttribute('tabindex', index + 1);
        });
    }

    autoFocusFirstInput() {
        const firstInput = document.querySelector('.question-input, .sub-question-input');
        if (firstInput) {
            setTimeout(() => {
                firstInput.focus();
            }, 100);
        }
    }

    updateProgress() {
        // Update progress bars based on current answers - use same logic as form-data-manager
        const topicGroups = document.querySelectorAll('.topic-group');
        
        topicGroups.forEach(topicGroup => {
            const inputs = topicGroup.querySelectorAll('.question-input, .sub-question-input');
            const total = inputs.length;
            
            // Count inputs that have values (same logic as form-data-manager)
            let answered = 0;
            inputs.forEach(input => {
                const hasValue = input.type === 'radio' || input.type === 'checkbox' ? 
                    input.checked : (input.value && input.value.trim() !== '');
                
                if (hasValue) {
                    answered++;
                }
            });
            
            const percent = total === 0 ? 0 : Math.round((answered / total) * 100);
            
            const progressBar = topicGroup.querySelector('.topic-progress-bar-fill');
            const progressLabel = topicGroup.querySelector('.topic-progress-label');
            
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (progressLabel) progressLabel.textContent = `${answered} / ${total} answered`;
        });
    }

    toggleSubQuestions(questionId) {
        const subQuestionsLayer = document.getElementById(`sub-questions-${questionId}`);
        const toggleButton = document.querySelector(`[data-question-id="${questionId}"].toggle-sub-questions`);
        const chevron = toggleButton.querySelector('.fas');
        
        if (subQuestionsLayer.style.display === 'none') {
            subQuestionsLayer.style.display = 'block';
            chevron.classList.remove('fa-chevron-down');
            chevron.classList.add('fa-chevron-up');
            
            // Focus first sub-question input
            const firstSubInput = subQuestionsLayer.querySelector('.sub-question-input');
            if (firstSubInput) {
                setTimeout(() => firstSubInput.focus(), 100);
            }
        } else {
            subQuestionsLayer.style.display = 'none';
            chevron.classList.remove('fa-chevron-up');
            chevron.classList.add('fa-chevron-down');
        }
    }

    goBackToCategories() {
        this.currentCategory = null;
        this.currentSubSection = null;
        this.currentTopic = null;
        this.updateFormSections(this.formSections);
    }

    getStatusClass(status) {
        switch (status) {
            case 'completed': return 'success';
            case 'in-progress': return 'warning';
            default: return 'default';
        }
    }

    getStatusText(status) {
        switch (status) {
            case 'completed': return 'Completed';
            case 'in-progress': return 'In Progress';
            default: return 'Not Started';
        }
    }

    setupEventListeners() {
        // Navigation event listeners
        const menuItems = document.querySelectorAll('.menu-item');
        
        menuItems.forEach((item, index) => {
            if (item.id !== 'logout-btn') {
                item.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const page = item.dataset.page;
                    await this.navigateToPage(page);
                });
            }
        });

        // Profile update event listeners
        const profileForm = document.querySelector('.profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleProfileUpdate();
            });
        }

        // Save form state on page unload
        window.addEventListener('beforeunload', () => {
            this.saveFormState();
        });

        // Save form state on page visibility change (when user switches tabs)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveFormState();
            }
        });
    }

    async navigateToPage(page) {
        this.currentPage = page;
        localStorage.setItem('userDashPage', page);
        this.showCurrentPage();
        
        // Load page-specific data only if needed
        if (page === 'form') {
            // Show loading state immediately
            const container = document.querySelector('.form-container');
            if (container && (!this.formSections || this.formSections.length === 0)) {
                container.innerHTML = `
                    <div class="loading-message">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading form sections...</p>
                    </div>
                `;
            }
            
            // Use cached data if available, otherwise load
            if (this.cache.formSections && this.formSections.length > 0) {
                this.updateFormSections(this.formSections);
            } else if (!this.loadingStates.formSections) {
                await this.loadFormSections();
                // updateFormSections is already called in loadFormSections, no need to call again
            }
        }
    }

    showCurrentPage() {
        // Hide all pages
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => {
            page.classList.remove('active');
        });

        // Show current page
        const currentPageElement = document.getElementById(`${this.currentPage}-page`);
        if (currentPageElement) {
            currentPageElement.classList.add('active');
        }

        // Update navigation
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            if (item.id !== 'logout-btn') {
                item.classList.remove('active');
                if (item.dataset.page === this.currentPage) {
                    item.classList.add('active');
                }
            }
        });
        
        // Don't automatically update form sections here to prevent race conditions
        // Form data will be handled in navigateToPage method
    }

    async handleProfileUpdate() {
        const formData = new FormData(document.querySelector('.profile-form'));
        const profileData = {
            school_name: formData.get('school_name'),
            email: formData.get('email'),
            region: formData.get('region'),
            division: formData.get('division'),
            district: formData.get('district')
        };

        // Handle password change if provided
        const currentPassword = formData.get('current_password');
        const newPassword = formData.get('new_password');
        const confirmPassword = formData.get('confirm_password');

        if (currentPassword || newPassword || confirmPassword) {
            // Validate password fields
            if (!currentPassword) {
                this.showNotification('Current password is required to change password', 'error');
                return;
            }
            if (!newPassword) {
                this.showNotification('New password is required', 'error');
                return;
            }
            if (newPassword !== confirmPassword) {
                this.showNotification('New password and confirm password do not match', 'error');
                return;
            }
            if (newPassword.length < 8) {
                this.showNotification('New password must be at least 8 characters long', 'error');
                return;
            }

            profileData.current_password = currentPassword;
            profileData.new_password = newPassword;
        }

        try {
            const result = await this.api.updateProfile(profileData);
            if (result && result.success) {
                this.showNotification(result.message || 'Profile updated successfully!', 'success');
                await this.loadUserProfile();
                // Clear password fields after successful update
                document.getElementById('current_password').value = '';
                document.getElementById('new_password').value = '';
                document.getElementById('confirm_password').value = '';
            } else {
                this.showNotification(result.message || 'Failed to update profile', 'error');
            }
        } catch (error) {
            this.showNotification('Failed to update profile', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Clear existing notification
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }

        const notification = document.createElement('div');
        notification.className = `notification-toast ${type}`;
        notification.innerHTML = `
            <i class="fas ${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;

        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification-toast');
        existingNotifications.forEach(n => n.remove());

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Hide notification after 3 seconds
        this.notificationTimeout = setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }
}

// Export DashboardUIManager for use in other scripts
window.DashboardUIManager = DashboardUIManager;

// Initialize the dashboard when the page loads (only if preloader is not managing it)
document.addEventListener('DOMContentLoaded', async () => {
    // Check if preloader is handling initialization
    if (!window.preloaderManager) {
        const dashboard = new DashboardUIManager();
        await dashboard.init();
    }
});