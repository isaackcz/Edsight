// User Dashboard JavaScript - Enhanced Professional Design
let currentUserId = null;

// Pre-loader Manager Class
class PreloaderManager {
    constructor() {
        this.preloader = document.getElementById('preloader');
        this.progressText = document.getElementById('progress-text');
        this.loadingStatus = document.getElementById('loading-status');
        this.loadingDots = document.querySelector('.loading-dots');
        this.totalSteps = 0;
        this.completedSteps = 0;
        this.loadingTasks = [
            { name: 'Authentication Check', weight: 15 },
            { name: 'User Profile', weight: 20 },
            { name: 'Dashboard Statistics', weight: 25 },
            { name: 'Form Sections', weight: 30 },
            { name: 'Analytics Data', weight: 10 }
        ];
    }

    show() {
        if (this.preloader) {
            this.preloader.classList.remove('hidden');
            this.updateProgress(0, 'Initializing application...');
            
            // Set a timeout to force hide if something goes wrong
            this.timeoutId = setTimeout(() => {
                // Preloader timeout reached, forcing hide
                this.forceHide();
            }, 30000); // 30 seconds timeout
        }
    }

    hide() {
        if (this.preloader) {
            // Clear timeout if it exists
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }
            
            setTimeout(() => {
                this.preloader.classList.add('hidden');
            }, 500);
        }
    }

    updateProgress(progress, status) {
        if (this.loadingStatus) {
            this.loadingStatus.textContent = status;
        }
        
        // Add visual feedback to loading dots based on progress
        if (this.loadingDots) {
            const dots = this.loadingDots.querySelectorAll('.dot');
            const activeDotIndex = Math.floor((progress / 100) * dots.length);
            
            dots.forEach((dot, index) => {
                if (index <= activeDotIndex) {
                    dot.style.background = 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)';
                    dot.style.transform = 'scale(1.2)';
                } else {
                    dot.style.background = 'rgba(41, 52, 64, 0.3)';
                    dot.style.transform = 'scale(0.8)';
                }
            });
        }
    }

    updateProgressText(text) {
        if (this.progressText) {
            this.progressText.textContent = text;
        }
    }

    startTask(taskName) {
        const task = this.loadingTasks.find(t => t.name === taskName);
        if (task) {
            this.updateProgressText(`Loading ${taskName}...`);
        }
    }

    completeTask(taskName) {
        const task = this.loadingTasks.find(t => t.name === taskName);
        if (task) {
            this.completedSteps++;
            const progress = (this.completedSteps / this.loadingTasks.length) * 100;
            this.updateProgress(progress, `${taskName} completed`);
            
            // Check if all tasks are complete
            this.checkAllTasksComplete();
        }
    }

    setCustomProgress(progress, status) {
        this.updateProgress(progress, status);
    }

    // Handle all tasks completion
    onAllTasksComplete() {
        this.updateProgress(100, 'All tasks completed!');
        this.updateProgressText('Ready');
        this.loadingStatus.textContent = 'Application ready';
        
        // Show completion state in loading dots
        if (this.loadingDots) {
            const dots = this.loadingDots.querySelectorAll('.dot');
            dots.forEach((dot, index) => {
                setTimeout(() => {
                    dot.classList.add('completed');
                    dot.style.animation = 'none';
                    dot.style.transform = 'scale(1)';
                    dot.style.background = 'var(--success)';
                }, index * 100); // Stagger the completion animation
            });
        }
        
        // Hide preloader after a short delay
        setTimeout(() => {
            this.hide();
        }, 1000);
    }

    // Check if all tasks are complete
    checkAllTasksComplete() {
        if (this.completedSteps >= this.loadingTasks.length) {
            this.onAllTasksComplete();
        }
    }

    // Handle errors gracefully
    handleError(error, taskName) {
        // Error in task
        this.loadingStatus.textContent = `Error loading ${taskName}. Retrying...`;
        
        // Retry after a delay
        setTimeout(() => {
            this.loadingStatus.textContent = 'Retrying...';
        }, 2000);
    }

    // Force hide preloader (for emergency cases)
    forceHide() {
        this.hide();
    }

    // Track individual API call progress
    trackAPICall(apiName, promise) {
        this.startTask(apiName);
        
        return promise
            .then(result => {
                this.completeTask(apiName);
                return result;
            })
            .catch(error => {
                this.handleError(error, apiName);
                // Still complete the task to prevent blocking
                this.completeTask(apiName);
                throw error;
            });
    }
}

// Initialize preloader manager
const preloaderManager = new PreloaderManager();

// Make preloader manager globally accessible
window.preloaderManager = preloaderManager;

document.addEventListener('DOMContentLoaded', function() {
    // Show preloader first
    preloaderManager.show();
    
    // Initialize dashboard with real data
    initializeDashboard();
    initializeCharts();
    setupEventListeners();
    
    // Check authentication first, then load data
    preloaderManager.startTask('Authentication Check');
    fetch('/api/profile/')
        .then(res => {
            if (res.status === 401) {
                preloaderManager.hide();
                window.location.href = '/auth/login/';
                return null;
            }
            preloaderManager.completeTask('Authentication Check');
            preloaderManager.startTask('User Profile');
            return res.json();
        })
        .then(profile => {
            if (profile) {
                preloaderManager.completeTask('User Profile');
                
                // Load real user data and dashboard data immediately
                preloaderManager.startTask('Dashboard Statistics');
                loadUserData();
                loadDashboardData(); // This will load real data from the database
                loadAnalyticsData(); // Add this line to load analytics data
                
                // Initialize dashboard UI manager to handle form state restoration
                preloaderManager.startTask('Form Sections');
                initializeDashboardUIManager();
                
                // Preloader will be hidden automatically when all tasks complete
            }
        })
        .catch(error => {
            // Authentication check failed
            // Still try to load data in case it's a different issue
            loadUserData();
            loadDashboardData();
            loadAnalyticsData(); // Add this line here too
            
            // Preloader will be hidden automatically when all tasks complete
        });
});

// Function to initialize dashboard UI manager
function initializeDashboardUIManager() {
    if (window.DashboardUIManager) {
        const uiManager = new window.DashboardUIManager();
        uiManager.init().then(() => {
            preloaderManager.completeTask('Form Sections');
        }).catch(error => {
            // Error initializing Dashboard UI Manager
            preloaderManager.completeTask('Form Sections');
        });
    } else {
        // DashboardUIManager not available
        preloaderManager.completeTask('Form Sections');
    }
}

// Add page visibility change listener to save form state
document.addEventListener('visibilitychange', function() {
    if (document.hidden && window.dashboardUIManager && window.dashboardUIManager.saveFormState) {
        window.dashboardUIManager.saveFormState();
    }
});

// Add beforeunload listener to save form state
window.addEventListener('beforeunload', function() {
    if (window.dashboardUIManager && window.dashboardUIManager.saveFormState) {
        window.dashboardUIManager.saveFormState();
    }
});

function initializeDashboard() {
    // FormDataManager is already initialized in form-data-manager.js on DOMContentLoaded
    // No need to create another instance here
    
    // Setup page navigation
    setupPageNavigation();
    
    // Initialize sidebar
    setupLogout();
    
    // Setup search functionality
    setupSearch();
    
    // Setup notifications
    setupNotifications();
}

function setupPageNavigation() {
    const menuItems = document.querySelectorAll('.menu-item[data-page]');
    const pages = document.querySelectorAll('.page');
    const breadcrumbCurrent = document.querySelector('.breadcrumb-current');
    
    // Setup breadcrumb functionality
    setupBreadcrumbNavigation();
    
    menuItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
            
            // Remove active class from all menu items and pages
            menuItems.forEach(mi => mi.classList.remove('active'));
            pages.forEach(page => page.classList.remove('active'));
            
            // Get the target page
            const targetPage = this.getAttribute('data-page');
            const pageNames = {
                'dashboard': 'Overview',
                'form': 'Form',
                'analytics': 'Analytics',
                'profile': 'Settings'
            };
            const pageTitle = pageNames[targetPage] || 'Page';
            
            // Use the new navigation function
            navigateToPage(targetPage, pageTitle);
        });
    });
}

function setupBreadcrumbNavigation() {
    const breadcrumbItems = document.querySelectorAll('.breadcrumb-item');
    const breadcrumbCurrent = document.querySelector('.breadcrumb-current');
    
    // Add click handlers to breadcrumb items
    breadcrumbItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetPage = this.getAttribute('data-page') || this.textContent.toLowerCase().trim();
            
            // Navigate based on breadcrumb item clicked
            switch(targetPage) {
                case 'dashboard':
                    navigateToPage('dashboard', 'Overview');
                    break;
                case 'forms':
                    navigateToPage('forms', 'Forms Management');
                    break;
                case 'analytics':
                    navigateToPage('analytics', 'Analytics & Reports');
                    break;
                case 'profile':
                    navigateToPage('profile', 'User Profile');
                    break;
                default:
                    navigateToPage('dashboard', 'Overview');
            }
        });
    });
}

function navigateToPage(pageId, breadcrumbText) {
    // Remove active class from all pages and menu items
    const pages = document.querySelectorAll('.page');
    const menuItems = document.querySelectorAll('.menu-item[data-page]');
    
    pages.forEach(page => page.classList.remove('active'));
    menuItems.forEach(item => item.classList.remove('active'));
    
    // Show target page
    const targetPage = document.getElementById(pageId + '-page');
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // Update active menu item
    const targetMenuItem = document.querySelector(`[data-page="${pageId}"]`);
    if (targetMenuItem) {
        targetMenuItem.classList.add('active');
    }
    
    // Update breadcrumb
    const breadcrumbCurrent = document.querySelector('.breadcrumb-current');
    if (breadcrumbCurrent) {
        breadcrumbCurrent.textContent = breadcrumbText;
    }
    
    // Load page content if needed
    loadPageContent(pageId);
}

function loadPageContent(page) {
    switch(page) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'form':
            // Form data is now handled by DashboardUIManager to prevent race conditions
            // loadFormData(); // Disabled to prevent duplicate loading
            break;
        case 'analytics':
            loadAnalyticsData();
            break;
        case 'profile':
            loadProfileData();
            break;
    }
}

function setupLogout() {
    // Setup logout functionality for both sidebar and mobile navbar
    const logoutBtn = document.getElementById('logout-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    const logoutModal = document.getElementById('logout-modal');
    const confirmLogout = document.getElementById('confirm-logout');
    const closeModal = document.querySelector('.close-modal');
    
    // Handle sidebar logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (logoutModal) {
                logoutModal.classList.add('active');
            } else {
                // Fallback if no modal
                if (confirm('Are you sure you want to logout?')) {
                    window.location.href = '/logout/';
                }
            }
        });
    }
    
    // Handle mobile navbar logout button (handled in responsive.js)
    // This is just a backup in case responsive.js doesn't load
    if (mobileLogoutBtn && !window.mobileLogoutHandled) {
        mobileLogoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                window.location.href = '/logout/';
            }
        });
    }
    
    if (confirmLogout) {
        confirmLogout.addEventListener('click', function() {
            // Perform logout
            window.location.href = '/logout/';
        });
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            logoutModal.classList.remove('active');
        });
    }
}

function setupSearch() {
    const searchInput = document.querySelector('.search-bar input');
    const searchContainer = document.querySelector('.search-bar');
    
    if (searchInput && searchContainer) {
        let searchTimeout;
        let searchResults = null;
        
        // Create search results dropdown
        searchResults = document.createElement('div');
        searchResults.className = 'search-results';
        searchResults.style.display = 'none';
        searchContainer.appendChild(searchResults);
        
        searchInput.addEventListener('input', function() {
            const query = this.value.trim();
            
            // Clear previous timeout
            clearTimeout(searchTimeout);
            
            if (query.length === 0) {
                hideSearchResults(searchResults);
                return;
            }
            
            // Add 1-second delay to prevent system overload
            searchTimeout = setTimeout(() => {
                performSearch(query, searchResults);
            }, 1000);
        });
        
        // Hide results when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchContainer.contains(e.target)) {
                hideSearchResults(searchResults);
            }
        });
        
        // Handle escape key
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                hideSearchResults(searchResults);
                this.blur();
            }
        });
    }
}

function performSearch(query, resultsContainer) {
    if (!query || query.length < 2) {
        hideSearchResults(resultsContainer);
        return;
    }
    
    // Show loading state
    showSearchLoading(resultsContainer);
    
    // Fetch form sections data for searching
    fetch('/api/form/sections/')
        .then(response => response.json())
        .then(data => {
            const searchResults = searchInFormData(query.toLowerCase(), data);
            displaySearchResults(searchResults, resultsContainer, query);
        })
        .catch(error => {
            // Search error
            showSearchError(resultsContainer);
        });
}

function searchInFormData(query, formData) {
    const results = [];
    
    if (!formData || !Array.isArray(formData)) {
        return results;
    }
    
    formData.forEach(category => {
        // Search in category name
        if (category.category_name && category.category_name.toLowerCase().includes(query)) {
            results.push({
                type: 'category',
                id: category.category_id,
                title: category.category_name,
                subtitle: `Category • ${category.total_questions} questions`,
                data: category
            });
        }
        
        if (category.questions && Array.isArray(category.questions)) {
            // Group questions by sub-section and topic for better organization
            const groupedQuestions = {};
            
            category.questions.forEach(question => {
                const subSection = question.sub_section_name;
                const topic = question.topic_name;
                
                // Search in sub-section name
                if (subSection && subSection.toLowerCase().includes(query)) {
                    const key = `${category.category_name}-${subSection}`;
                    if (!groupedQuestions[key]) {
                        results.push({
                            type: 'sub-section',
                            id: `${category.category_id}-${subSection}`,
                            title: subSection,
                            subtitle: `Sub-section in ${category.category_name}`,
                            data: { category, subSection }
                        });
                        groupedQuestions[key] = true;
                    }
                }
                
                // Search in topic name
                if (topic && topic.toLowerCase().includes(query)) {
                    const key = `${category.category_name}-${subSection}-${topic}`;
                    if (!groupedQuestions[key]) {
                        results.push({
                            type: 'topic',
                            id: `${category.category_id}-${subSection}-${topic}`,
                            title: topic,
                            subtitle: `Topic in ${subSection} • ${category.category_name}`,
                            data: { category, subSection, topic }
                        });
                        groupedQuestions[key] = true;
                    }
                }
                
                // Search in question text
                if (question.question_text && question.question_text.toLowerCase().includes(query)) {
                    results.push({
                        type: 'question',
                        id: question.question_id,
                        title: question.question_text,
                        subtitle: `Question in ${topic} • ${subSection}`,
                        data: { category, subSection, topic, question }
                    });
                }
                
                // Search in sub-questions
                if (question.sub_questions && Array.isArray(question.sub_questions)) {
                    question.sub_questions.forEach(subQuestion => {
                        if (subQuestion.sub_question_text && subQuestion.sub_question_text.toLowerCase().includes(query)) {
                            results.push({
                                type: 'sub-question',
                                id: subQuestion.sub_question_id,
                                title: subQuestion.sub_question_text,
                                subtitle: `Sub-question in ${question.question_text.substring(0, 50)}...`,
                                data: { category, subSection, topic, question, subQuestion }
                            });
                        }
                    });
                }
            });
        }
    });
    
    // Limit results to prevent overwhelming UI
    return results.slice(0, 10);
}

function displaySearchResults(results, container, query) {
    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="search-no-results">
                <i class="fas fa-search"></i>
                <p>No results found for "${query}"</p>
            </div>
        `;
        container.style.display = 'block';
        return;
    }
    
    const resultsHTML = results.map(result => {
        const typeIcon = getTypeIcon(result.type);
        const typeLabel = getTypeLabel(result.type);
        
        return `
            <div class="search-result-item" data-type="${result.type}" data-id="${result.id}">
                <div class="search-result-icon">
                    <i class="${typeIcon}"></i>
                </div>
                <div class="search-result-content">
                    <div class="search-result-title">${highlightQuery(result.title, query)}</div>
                    <div class="search-result-subtitle">
                        <span class="search-result-type">${typeLabel}</span>
                        ${result.subtitle}
                    </div>
                </div>
                <div class="search-result-arrow">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = resultsHTML;
    container.style.display = 'block';
    
    // Add click handlers
    container.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', function() {
            const type = this.getAttribute('data-type');
            const id = this.getAttribute('data-id');
            const result = results.find(r => r.id == id && r.type === type);
            
            if (result) {
                navigateToSearchResult(result);
                hideSearchResults(container);
                // Clear search input
                const searchInput = document.querySelector('.search-bar input');
                if (searchInput) searchInput.value = '';
            }
        });
    });
}

function getTypeIcon(type) {
    const icons = {
        'category': 'fas fa-folder',
        'sub-section': 'fas fa-folder-open',
        'topic': 'fas fa-bookmark',
        'question': 'fas fa-question-circle',
        'sub-question': 'fas fa-list-ul'
    };
    return icons[type] || 'fas fa-file';
}

function getTypeLabel(type) {
    const labels = {
        'category': 'Category',
        'sub-section': 'Sub-section',
        'topic': 'Topic',
        'question': 'Question',
        'sub-question': 'Sub-question'
    };
    return labels[type] || 'Item';
}

function highlightQuery(text, query) {
    if (!query || !text) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

function navigateToSearchResult(result) {
    const { type, data } = result;
    
    // Navigate to form page first
    navigateToPage('form', 'Form');
    
    // Wait for page to load and DashboardUIManager to be ready, then navigate to specific item
    const waitForManagerAndNavigate = () => {
        if (window.dashboardUIManager && window.dashboardUIManager.formSections) {
            switch (type) {
                case 'category':
                    navigateToCategory(data.category_id);
                    break;
                case 'sub-section':
                    navigateToSubSection(data.category, data.subSection);
                    break;
                case 'topic':
                    navigateToTopic(data.category, data.subSection, data.topic);
                    break;
                case 'question':
                case 'sub-question':
                    navigateToQuestion(data.category, data.subSection, data.topic, data.question, data.subQuestion);
                    break;
            }
        } else {
            // Retry after a short delay if manager is not ready
            setTimeout(waitForManagerAndNavigate, 200);
        }
    };
    
    setTimeout(waitForManagerAndNavigate, 800);
}

function navigateToCategory(categoryId) {
    // Trigger category view if DashboardUIManager is available
    if (window.dashboardUIManager && typeof window.dashboardUIManager.showCategoryDetails === 'function') {
        window.dashboardUIManager.showCategoryDetails(categoryId);
    }
}

function navigateToSubSection(category, subSectionName) {
    // First show category, then navigate to sub-section
    if (window.dashboardUIManager && typeof window.dashboardUIManager.showCategoryDetails === 'function') {
        window.dashboardUIManager.showCategoryDetails(category.category_id);
        
        setTimeout(() => {
            if (typeof window.dashboardUIManager.showSubSectionDetails === 'function') {
                window.dashboardUIManager.showSubSectionDetails(subSectionName);
            }
        }, 300);
    }
}

function navigateToTopic(category, subSectionName, topicName) {
    navigateToSubSection(category, subSectionName);
    
    // Highlight topic after navigation
    setTimeout(() => {
        highlightElement(`[data-topic="${topicName}"]`);
    }, 800);
}

function navigateToQuestion(category, subSectionName, topicName, question, subQuestion) {
    navigateToSubSection(category, subSectionName);
    
    // Highlight question after navigation
    setTimeout(() => {
        const questionSelector = `[data-question-id="${question.question_id}"]`;
        highlightElement(questionSelector);
        
        // Scroll to question
        const questionElement = document.querySelector(questionSelector);
        if (questionElement) {
            questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 800);
}

function highlightElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.classList.add('search-highlight');
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
            element.classList.remove('search-highlight');
        }, 3000);
    }
}

function showSearchLoading(container) {
    container.innerHTML = `
        <div class="search-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Searching...</p>
        </div>
    `;
    container.style.display = 'block';
}

function showSearchError(container) {
    container.innerHTML = `
        <div class="search-error">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Search failed. Please try again.</p>
        </div>
    `;
    container.style.display = 'block';
}

function hideSearchResults(container) {
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }
}

function setupNotifications() {
    const notificationBtn = document.querySelector('.notification');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function() {
            // Show notifications panel
            showNotifications();
        });
    }
}

function showNotifications() {
    // Implement notifications panel
}

function initializeCharts() {
    // Initialize main progress chart
    initializeMainProgressChart();
    
    // Initialize timeline chart
    initializeTimelineChart();
}

function initializeMainProgressChart() {
    const ctx = document.getElementById('mainProgressChart');
    if (!ctx) return;
    
    // Initialize with real data (will be updated when data loads)
    const progress = 0; // Will be updated with real data from API
    
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [progress, 100 - progress],
                backgroundColor: ['#abc7d6', '#788b95'],
                borderWidth: 0,
                cutout: '75%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            },
            animation: {
                animateRotate: true,
                duration: 1000
            },
            elements: {
                arc: {
                    borderWidth: 0
                }
            }
        }
    });
    
    // Store chart reference for later updates
    window.mainProgressChart = chart;
    
    // Update progress percentage with real data
    const progressPercentage = document.querySelector('.progress-percentage');
    if (progressPercentage) {
        progressPercentage.textContent = progress.toFixed(2) + '%';
    }
}

function initializeCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'In Progress', 'Not Started'],
            datasets: [{
                data: [0, 0, 0], // Will be updated with real data
                backgroundColor: ['#4caf50', '#ff9800', '#788b95'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#293440',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#abc7d6',
                    borderWidth: 1
                }
            },
            animation: {
                animateRotate: true,
                duration: 1000
            },
            elements: {
                arc: {
                    borderWidth: 0
                }
            }
        }
    });
    
    // Store chart reference for later updates
    window.categoryChart = chart;
}

function initializeTimelineChart() {
    const ctx = document.getElementById('timelineChart');
    if (!ctx) return;
    
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Progress',
                data: [10, 25, 45, 75],
                borderColor: '#abc7d6',
                backgroundColor: 'rgba(171, 199, 214, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#293440',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#abc7d6',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: '#e0ebf6'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        },
                        color: '#788b95'
                    }
                },
                x: {
                    grid: {
                        color: '#e0ebf6'
                    },
                    ticks: {
                        color: '#788b95'
                    }
                }
            }
        }
    });
}

function initializeSectionChart() {
    const ctx = document.getElementById('sectionChart');
    if (!ctx) return;
    
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Section A', 'Section B', 'Section C', 'Section D'],
            datasets: [{
                label: 'Completion',
                data: [85, 60, 40, 20],
                backgroundColor: ['#4caf50', '#ff9800', '#f44336', '#788b95'],
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#293440',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#abc7d6',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: '#e0ebf6'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        },
                        color: '#788b95'
                    }
                },
                x: {
                    grid: {
                        color: '#e0ebf6'
                    },
                    ticks: {
                        color: '#788b95'
                    }
                }
            }
        }
    });
}

function initializeResponseChart() {
    const ctx = document.getElementById('responseChart');
    if (!ctx) return;
    
    const chart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Text', 'Number', 'Date', 'Choice'],
            datasets: [{
                data: [40, 25, 20, 15],
                backgroundColor: ['#abc7d6', '#4caf50', '#ff9800', '#f44336'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        color: '#788b95'
                    }
                },
                tooltip: {
                    backgroundColor: '#293440',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#abc7d6',
                    borderWidth: 1
                }
            },
            elements: {
                arc: {
                    borderWidth: 0
                }
            }
        }
    });
}

function setupEventListeners() {
    // Quick action buttons
    setupQuickActions();
    
    // Form actions
    setupFormActions();
    
    // Profile actions
    setupProfileActions();
    
    // User menu functionality
    setupUserMenu();
    
    // Logout functionality
    setupLogout();
}

function setupQuickActions() {
    const batchSubmit = document.getElementById('batch-submit');
    const exportData = document.getElementById('export-data');
    const importDataBtn = document.getElementById('import-data-btn');
    const clearData = document.getElementById('clear-data');
    
    if (batchSubmit) {
        batchSubmit.addEventListener('click', function() {
            if (window.formDataManager) {
                window.formDataManager.saveToDatabase();
            }
        });
    }
    
    if (exportData) {
        exportData.addEventListener('click', function() {
            if (window.formDataManager) {
                window.formDataManager.exportFormData();
            }
        });
    }

    if (importDataBtn) {
        importDataBtn.addEventListener('click', function() {
            const importInput = document.getElementById('import-data');
            if (importInput) {
                importInput.click();
            }
        });
    }

    if (clearData) {
        clearData.addEventListener('click', function() {
            if (window.formDataManager) {
                window.formDataManager.showClearDataConfirmation();
            }
        });
    }

    // Import file handling
    const importInput = document.getElementById('import-data');
    if (importInput) {
        importInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file && window.formDataManager) {
                window.formDataManager.importFormData(file);
            }
        });
    }
}

function setupFormActions() {
    const saveProgressBtn = document.getElementById('save-progress-btn');
    const submitToDistrictBtn = document.getElementById('submit-to-district-btn');
    
    if (saveProgressBtn) {
        saveProgressBtn.addEventListener('click', async function() {
                try {
                    this.disabled = true;
                    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                    
                if (window.formDataManager) {
                    await window.formDataManager.saveToDatabase();
                }
                
                this.innerHTML = '<i class="fas fa-check"></i> Saved!';
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-save"></i> Save Progress';
                    this.disabled = false;
                }, 2000);
                
            } catch (error) {
                // Error saving progress
                this.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-save"></i> Save Progress';
                    this.disabled = false;
                }, 3000);
            }
        });
    }

    if (submitToDistrictBtn) {
        submitToDistrictBtn.addEventListener('click', async function() {
            try {
                submitToDistrictBtn.disabled = true;
                submitToDistrictBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

                // Ensure local changes are saved first
                if (window.formDataManager) {
                    await window.formDataManager.saveToDatabase();
                }

                // Call server to mark submission to district
                const resp = await fetch('/api/form/submit/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ submit_type: 'to_district' })
                });
                const data = await resp.json();
                if (!resp.ok || data.error) {
                    throw new Error(data.error || 'Submit failed');
                }

                submitToDistrictBtn.innerHTML = '<i class="fas fa-check"></i> Submitted';
                setTimeout(() => {
                    submitToDistrictBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit to District';
                    submitToDistrictBtn.disabled = false;
                }, 2000);

                // Optional: show toast
                if (window.showToast) {
                    window.showToast('Form submitted to District for review', 'success');
                }
            } catch (e) {
                submitToDistrictBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
                setTimeout(() => {
                    submitToDistrictBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit to District';
                    submitToDistrictBtn.disabled = false;
                }, 3000);
            }
        });
    }
}

function setupProfileActions() {
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const profileForm = document.querySelector('.profile-form');
    
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (saveProfileBtn) {
                saveProfileBtn.disabled = true;
                saveProfileBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                
                // Simulate profile save
                setTimeout(() => {
                    saveProfileBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
                    setTimeout(() => {
                        saveProfileBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
                        saveProfileBtn.disabled = false;
                    }, 2000);
                }, 1500);
            }
        });
    }
}

function setupUserMenu() {
    // Setup user avatar click functionality for both desktop and mobile
    const userAvatars = document.querySelectorAll('.user-avatar');
    const mobileUserAvatar = document.querySelector('.mobile-header-actions .user-avatar');
    
    // Desktop user avatar in header
    const headerUserAvatar = document.querySelector('.header-actions .user-avatar');
    if (headerUserAvatar) {
        headerUserAvatar.addEventListener('click', function(e) {
            e.preventDefault();
            navigateToProfile();
        });
        
        // Add cursor pointer style
        headerUserAvatar.style.cursor = 'pointer';
        headerUserAvatar.title = 'Go to Profile Settings';
    }
    
    // Mobile user avatar in mobile header
    if (mobileUserAvatar) {
        mobileUserAvatar.addEventListener('click', function(e) {
            e.preventDefault();
            navigateToProfile();
        });
        
        // Add cursor pointer style
        mobileUserAvatar.style.cursor = 'pointer';
        mobileUserAvatar.title = 'Go to Profile Settings';
    }
    
    // Sidebar user profile section
    const sidebarUserProfile = document.querySelector('.user-profile');
    if (sidebarUserProfile) {
        sidebarUserProfile.addEventListener('click', function(e) {
            e.preventDefault();
            navigateToProfile();
        });
        
        // Add cursor pointer style
        sidebarUserProfile.style.cursor = 'pointer';
        sidebarUserProfile.title = 'Go to Profile Settings';
    }
}

function navigateToProfile() {
    // Navigate to profile/settings page
    const profileMenuItem = document.querySelector('.menu-item[data-page="profile"]');
    if (profileMenuItem) {
        // Trigger click on profile menu item to navigate to profile page
        profileMenuItem.click();
    } else {
        // Fallback: directly navigate to profile page
        navigateToPage('profile', 'Settings');
    }
}

function loadUserData() {
    // Load user information from real API
    fetch('/api/profile/')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            updateUserInfo(data);
        })
        .catch(error => {
            // Fallback to sample data
            updateUserInfo({
                username: 'User',
                email: 'user@example.com',
                role: 'school'
            });
        });
}

function updateUserInfo(userData) {
    const username = document.querySelector('.username');
    const role = document.querySelector('.role');
    const profileName = document.querySelector('.profile-info h2');
    const profileEmail = document.querySelector('.profile-info p');
    const profileLastLogin = document.querySelector('#profile-last-login');
    
    // Store user ID globally
    currentUserId = userData.id || userData.user_id || userData.personal_info?.id;
    
    // Update sidebar user info
    if (username) username.textContent = userData.name || userData.username || 'User';
    if (role) role.textContent = userData.role || 'User';
    
    // Update profile page info - display school name instead of username
    const schoolName = userData.personal_info?.school_name || userData.school_name || 'School Name Not Available';
    if (profileName) profileName.textContent = schoolName;
    if (profileEmail) profileEmail.textContent = userData.email || 'Loading...';
    
    // Update last login with actual date/time
    if (profileLastLogin) {
        const lastLoginDate = userData.last_login || userData.personal_info?.last_login || userData.account_settings?.last_login;
        if (lastLoginDate) {
            const loginDate = new Date(lastLoginDate);
            const formattedDate = loginDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const formattedTime = loginDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            profileLastLogin.textContent = `${formattedDate} at ${formattedTime}`;
        } else {
            // Fallback to current date/time for demo purposes
            const now = new Date();
            const formattedDate = now.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const formattedTime = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            profileLastLogin.textContent = `${formattedDate} at ${formattedTime}`;
        }
    }
    
    // Update profile form fields with new structure
    if (userData.personal_info) {
        const schoolNameInput = document.getElementById('school_name');
        const emailInput = document.getElementById('email');
        const regionInput = document.getElementById('region');
        const divisionInput = document.getElementById('division');
        const districtInput = document.getElementById('district');
        
        if (schoolNameInput) schoolNameInput.value = userData.personal_info.school_name || '';
        if (emailInput) emailInput.value = userData.personal_info.email || '';
        if (regionInput) regionInput.value = userData.personal_info.region || '';
        if (divisionInput) divisionInput.value = userData.personal_info.division || '';
        if (districtInput) districtInput.value = userData.personal_info.district || '';
    }
}

function loadDashboardData() {
    // Load all dashboard data from real API endpoints with individual error handling
    const apiCalls = [
        fetch('/api/dashboard/stats/').then(res => {
            if (!res.ok) throw new Error(`Stats API failed: ${res.status}`);
            return res.json();
        }).catch(err => {
            // Stats API error
            return null;
        }),
        fetch('/api/dashboard/categories/').then(res => {
            if (!res.ok) throw new Error(`Categories API failed: ${res.status}`);
            return res.json();
        }).catch(err => {
            // Categories API error
            return null;
        }),
        fetch('/api/dashboard/completion/').then(res => {
            if (!res.ok) throw new Error(`Completion API failed: ${res.status}`);
            return res.json();
        }).catch(err => {
            // Completion API error
            return null;
        }),
        fetch('/api/dashboard/recent-activity/').then(res => {
            if (!res.ok) throw new Error(`Recent Activity API failed: ${res.status}`);
            return res.json();
        }).catch(err => {
            // Recent Activity API error
            return null;
        }),
        fetch('/api/dashboard/quick-stats/').then(res => {
            if (!res.ok) throw new Error(`Quick Stats API failed: ${res.status}`);
            return res.json();
        }).catch(err => {
            // Quick Stats API error
            return null;
        })
    ];
    
    Promise.all(apiCalls)
    .then(([stats, categories, completion, activity, quickStats]) => {
        // Check if we have any valid data
        if (stats || categories || completion || activity || quickStats) {
            // Update dashboard elements with available real data
            if (stats) updateDashboardStats(stats);
            if (categories) updateCategoryProgress(categories);
            if (completion) updateCompletionData(completion);
            if (activity) updateRecentActivity(activity);
    
            if (stats && completion) updateChartsWithRealData(stats, completion);
            
            // Update charts with available data
            if (stats) updateMainProgressChart(stats.overall_progress || 0);
            if (completion) updateCategoryChart(completion);
        } else {
            loadSampleData();
        }
        
        // Complete dashboard statistics task
        preloaderManager.completeTask('Dashboard Statistics');
    })
    .catch(error => {
        // Dashboard data loading failed
        // Fallback to sample data if API fails
        loadSampleData();
        preloaderManager.completeTask('Dashboard Statistics');
    });
}

function updateDashboardStats(data) {
    // Update statistics with real data
    const answeredCount = document.getElementById('answered-count');
    const savedCount = document.getElementById('saved-count');
    const databaseCount = document.getElementById('database-count');
    
    if (answeredCount) answeredCount.textContent = data.answered_questions || 0;
    if (savedCount) savedCount.textContent = data.answered_questions || 0; // Using answered as saved locally
    if (databaseCount) databaseCount.textContent = data.answered_questions || 0; // Using answered as in database
    
    // Update progress percentage with precise decimal values
    const progressPercentage = document.querySelector('.progress-percentage');
    if (progressPercentage) {
        const progress = data.overall_progress || 0;
        // Display the actual precise value, even if very small
        if (progress < 0.01) {
            progressPercentage.textContent = progress.toFixed(4) + '%';
        } else if (progress < 1) {
            progressPercentage.textContent = progress.toFixed(2) + '%';
        } else {
            progressPercentage.textContent = progress.toFixed(1) + '%';
        }
    }
    
    // Update main progress chart with real data
    if (window.mainProgressChart) {
        const progress = data.overall_progress || 0;
        updateMainProgressChart(progress);
    }
    
    // Update deadline
    const deadlineText = document.querySelector('.deadline-text');
    if (deadlineText) {
        deadlineText.textContent = `${data.deadline_days || 30} days remaining`;
    }
    
    const deadlineFill = document.querySelector('.deadline-fill');
    if (deadlineFill) {
        const daysUsed = 30 - (data.deadline_days || 30);
        const percentageUsed = (daysUsed / 30) * 100;
        deadlineFill.style.width = Math.min(percentageUsed, 100) + '%';
    }
    
    // Update deadline percentage
    const deadlinePercentage = document.querySelector('.deadline-percentage');
    if (deadlinePercentage) {
        const percentageUsed = ((30 - (data.deadline_days || 30)) / 30) * 100;
        deadlinePercentage.textContent = `${Math.round(percentageUsed)}% of time used`;
    }
    

}

function updateCompletionData(data) {
    // Update completion by category chart with real data
    const categoryChart = Chart.getChart('categoryChart');
    if (categoryChart && data.categories) {
        // Calculate totals for the chart
        let totalCompleted = 0;
        let totalInProgress = 0;
        let totalNotStarted = 0;
        
        data.categories.forEach(cat => {
            totalCompleted += cat.completed || 0;
            totalInProgress += cat.in_progress || 0;
            totalNotStarted += cat.not_started || 0;
        });
        
        // Update chart data
        categoryChart.data.datasets[0].data = [totalCompleted, totalInProgress, totalNotStarted];
        categoryChart.update();
    }
}

function updateRecentActivity(data) {
    // Update recent activity list with real data
    const activityList = document.querySelector('.activity-list');
    if (activityList && data.activities) {
        activityList.innerHTML = '';
        
        data.activities.forEach(activity => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            
            let iconClass = 'fa-edit';
            if (activity.type === 'answer_submitted') {
                iconClass = 'fa-save';
            } else if (activity.type === 'form_started') {
                iconClass = 'fa-play';
            } else if (activity.type === 'section_completed') {
                iconClass = 'fa-check-circle';
            }
            
            activityItem.innerHTML = `
                <div class="activity-icon">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="activity-content">
                    <h4>${activity.title}</h4>
                    <p>${activity.description}</p>
                    <span class="activity-time">${activity.time_ago}</span>
                </div>
            `;
            
            activityList.appendChild(activityItem);
        });
    }
}

function initializeSubmissionTrendsChart() {
    const ctx = document.getElementById('submissionTrendsChart');
    if (!ctx) return;

    window.submissionTrendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Daily Submissions',
                data: [],
                borderColor: 'var(--primary)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                }
            }
        }
    });
}

function updateChartsWithRealData(stats, completion) {
    // Update main progress chart with real data
    if (window.mainProgressChart) {
        const progress = stats.overall_progress || 0;
        updateMainProgressChart(progress);
        
    }
    
    // Update category chart with real data
    if (window.categoryChart && completion && completion.categories) {
        const totalCompleted = completion.categories.reduce((sum, cat) => sum + (cat.completed || 0), 0);
        const totalInProgress = completion.categories.reduce((sum, cat) => sum + (cat.in_progress || 0), 0);
        const totalNotStarted = completion.categories.reduce((sum, cat) => sum + (cat.not_started || 0), 0);
        
        window.categoryChart.data.datasets[0].data = [totalCompleted, totalInProgress, totalNotStarted];
        window.categoryChart.update();
    }
}

function updateCategoryProgress(categories) {
    // Update category progress display with real data
    const categoryChart = Chart.getChart('categoryChart');
    if (categoryChart && categories && categories.length > 0) {
        // Calculate totals for the chart
        let totalCompleted = 0;
        let totalInProgress = 0;
        let totalNotStarted = 0;
        
        categories.forEach(cat => {
            totalCompleted += cat.completed_questions || 0;
            totalInProgress += Math.max(0, (cat.total_questions || 0) - (cat.completed_questions || 0) - 2);
            totalNotStarted += Math.max(0, 2);
        });
        
        // Update chart data
        categoryChart.data.datasets[0].data = [totalCompleted, totalInProgress, totalNotStarted];
        categoryChart.update();
    }
}

function updateMainProgressChart(progress) {
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

function updateCategoryChart(completion) {
    // Update category chart with real data
    if (window.categoryChart && completion && completion.categories) {
        const totalCompleted = completion.categories.reduce((sum, cat) => sum + (cat.completed || 0), 0);
        const totalInProgress = completion.categories.reduce((sum, cat) => sum + (cat.in_progress || 0), 0);
        const totalNotStarted = completion.categories.reduce((sum, cat) => sum + (cat.not_started || 0), 0);
        
        window.categoryChart.data.datasets[0].data = [totalCompleted, totalInProgress, totalNotStarted];
        window.categoryChart.update();
    }
}

function loadSampleData() {
    // Fallback sample data if API fails
    const sampleStats = {
        answered_questions: 15,
        overall_progress: 35,
        deadline_days: 25
    };
    
    const sampleCategories = [
        { category_name: 'Basic Information', completed_questions: 5, total_questions: 10, progress_percentage: 50 },
        { category_name: 'Academic Details', completed_questions: 3, total_questions: 8, progress_percentage: 37.5 },
        { category_name: 'Infrastructure', completed_questions: 2, total_questions: 6, progress_percentage: 33.3 }
    ];
    
    const sampleCompletion = {
        categories: [
            { name: 'Basic Information', completed: 5, in_progress: 2, not_started: 3 },
            { name: 'Academic Details', completed: 3, in_progress: 1, not_started: 4 },
            { name: 'Infrastructure', completed: 2, in_progress: 1, not_started: 3 }
        ]
    };
    
    const sampleActivity = {
        activities: [
            { title: 'Form section completed', description: 'Basic Information section', time_ago: '2 hours ago', type: 'section_completed' },
            { title: 'Data saved', description: 'Academic details updated', time_ago: '1 hour ago', type: 'answer_submitted' },
            { title: 'Form started', description: 'Infrastructure section', time_ago: '30 minutes ago', type: 'form_started' }
        ]
    };
    
    const sampleQuickStats = {
        total_questions: 50,
        answered_questions: 15,
        completion_rate: 30,
        completed_sections: 3,
        pending_sections: 7,
        last_updated: '2 hours ago'
    };
    
    // Update all dashboard components with sample data
    updateDashboardStats(sampleStats);
    updateCategoryProgress(sampleCategories);
    updateCompletionData(sampleCompletion);
    updateRecentActivity(sampleActivity);

    updateChartsWithRealData(sampleStats, sampleCompletion);
    
    // Update charts with sample data
    updateMainProgressChart(sampleStats.overall_progress || 0);
    updateCategoryChart(sampleCompletion);
}

function loadSampleFormData() {
    // Sample form data when API fails
    const sampleFormData = {
        categories: [
            {
                id: 1,
                name: 'Basic Information',
                sub_sections: [
                    {
                        id: 1,
                        name: 'School Details',
                        topics: [
                            {
                                id: 1,
                                name: 'General Information',
                                questions: [
                                    {
                                        id: 1,
                                        question_text: 'What is the name of your school?',
                                        question_type: 'text',
                                        is_required: true
                                    },
                                    {
                                        id: 2,
                                        question_text: 'What type of school is this?',
                                        question_type: 'select',
                                        options: ['Public', 'Private', 'Charter'],
                                        is_required: true
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                id: 2,
                name: 'Academic Information',
                sub_sections: [
                    {
                        id: 2,
                        name: 'Curriculum',
                        topics: [
                            {
                                id: 2,
                                name: 'Programs Offered',
                                questions: [
                                    {
                                        id: 3,
                                        question_text: 'What academic programs do you offer?',
                                        question_type: 'checkbox',
                                        options: ['Science', 'Arts', 'Commerce', 'Technical'],
                                        is_required: false
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    };
    
    // Render the sample form data
    renderForm(sampleFormData.categories);
}

function loadFormData() {
    // Show loading state immediately
    const formContainer = document.querySelector('.form-container');
    if (formContainer) {
        formContainer.innerHTML = `
            <div class="loading-message">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading form sections...</p>
            </div>
        `;
    }
    
    // Load form data from real API endpoint
    fetch('/api/form/sections/', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
    })
        .then(response => {
            if (response.status === 401) {
                window.location.href = '/auth/login/';
                return;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return response.json();
        })
        .then(data => {
            if (data) {
                renderForm(data);
            }
        })
        .catch(error => {
            // Form API error
            
            // Check if the error is due to HTML response (login page)
            if (error.message.includes('Unexpected token') || error.message.includes('JSON')) {
                // Load sample form data instead of redirecting
                loadSampleFormData();
                return;
            }
            
            // Fallback to drafts endpoint
            fetch('/drafts')
                .then(response => {
                    if (response.ok) {
                        return response.json();
                    }
                    throw new Error('Drafts endpoint failed');
                })
                .then(data => {
                    renderForm(data);
                })
                .catch(fallbackError => {
                    // All form endpoints failed, loading sample data
                    // Load sample form data if both endpoints fail
                    loadSampleFormData();
                });
        });
}

function renderForm(data) {
    const formContainer = document.querySelector('.form-container');
    if (!formContainer) {
        // Form container not found
        return;
    }
    
    // Clear loading message
    formContainer.innerHTML = '';
    
    // Handle different data structures
    let categories = [];
    if (Array.isArray(data)) {
        categories = data; // Direct array of categories
    } else if (data && data.categories && Array.isArray(data.categories)) {
        categories = data.categories; // Object with categories property
    } else {
        formContainer.innerHTML = '<div class="error-message"><p>Invalid form data structure. Please check the API response.</p></div>';
        return;
    }
    
    // Render form sections
    if (categories.length > 0) {
        categories.forEach((category, index) => {
            renderCategory(category, formContainer);
        });
    } else {
        // No categories found in data
        formContainer.innerHTML = '<div class="no-data-message"><p>No form sections available.</p></div>';
    }
    
    // Initialize FormDataManager features after form is loaded
    if (window.formDataManager) {
        window.formDataManager.initializeFormFeatures();
    }
    
    // Ensure progress bars are updated after form rendering is complete
    setTimeout(() => {
        if (window.formDataManager) {
            window.formDataManager.updateProgressIndicators();
        }
    }, 100);
}

function renderCategory(category, container) {
    // Category rendering logic
    const categoryElement = document.createElement('div');
    categoryElement.className = 'category-section';
    
    let categoryHtml = `
        <div class="category-header">
            <div class="category-icon">
                <i class="fas fa-folder"></i>
            </div>
            <div class="category-info">
                <h3 class="category-title">${category.name || 'Unnamed Category'}</h3>
                <p class="category-description">${category.description || ''}</p>
            </div>
            <div class="category-status">
                <span class="status-badge">NOT STARTED</span>
                <span class="question-count">${category.name || 'undefined'} questions</span>
            </div>
            <div class="category-arrow">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `;
    
    // Add sub-sections if they exist
    if (category.sub_sections && category.sub_sections.length > 0) {
        categoryHtml += '<div class="subsections-container">';
        category.sub_sections.forEach(subSection => {
            categoryHtml += renderSubSection(subSection);
        });
        categoryHtml += '</div>';
    }
    
    categoryElement.innerHTML = categoryHtml;
    container.appendChild(categoryElement);
}

function renderSubSection(subSection) {
    let subSectionHtml = `
        <div class="subsection-card" data-subsection="${subSection.name || 'Unnamed SubSection'}">
            <div class="subsection-header">
                <div class="subsection-info">
                    <h4 class="subsection-title">${subSection.name || 'Unnamed SubSection'}</h4>
                    <div class="subsection-stats">
                        <span class="total-questions">${subSection.topics ? subSection.topics.length : 0} topics</span>
                    </div>
                </div>
            </div>
    `;
    
    // Add topics if they exist
    if (subSection.topics && subSection.topics.length > 0) {
        subSectionHtml += '<div class="topics-container">';
        subSection.topics.forEach(topic => {
            subSectionHtml += renderTopic(topic);
        });
        subSectionHtml += '</div>';
    }
    
    subSectionHtml += '</div>';
    return subSectionHtml;
}

function renderTopic(topic) {
    let topicHtml = `
        <div class="topic-card" data-topic="${topic.name || 'Unnamed Topic'}">
            <div class="topic-header">
                <h5 class="topic-title">${topic.name || 'Unnamed Topic'}</h5>
                <span class="question-count">${topic.questions ? topic.questions.length : 0} questions</span>
            </div>
    `;
    
    // Add questions if they exist
    if (topic.questions && topic.questions.length > 0) {
        topicHtml += '<div class="questions-container">';
        topic.questions.forEach(question => {
            topicHtml += renderQuestion(question);
        });
        topicHtml += '</div>';
    }
    
    topicHtml += '</div>';
    return topicHtml;
}

function renderQuestion(question) {
    return `
        <div class="question-item" data-question-id="${question.id || ''}">
            <div class="question-text">${question.question_text || 'No question text'}</div>
            <div class="question-type">Type: ${question.question_type || 'unknown'}</div>
            ${question.is_required ? '<span class="required-badge">Required</span>' : ''}
        </div>
    `;
}

async function loadAnalyticsData() {
    try {
        // Start analytics data loading task
        if (window.preloaderManager) {
            window.preloaderManager.startTask('Analytics Data');
        }
        
        // Show loading states
        showLoadingState();
        
        // Fetch real data from new analytics API - FIXED URL
        const response = await fetch('/api/analytics/data/');
        if (!response.ok) {
            throw new Error('Failed to fetch analytics data');
        }
        
        const data = await response.json();
        
        // Update timeline chart with real data
        if (data.timeline) {
            updateTimelineChart(data.timeline);
        }
        
        // Update form status hierarchy with real data
        if (data.form_status) {
            updateFormStatusHierarchy(data.form_status);
        }
        
        // Initialize hierarchy trees
        initializeHierarchyTrees();
        
        // Initialize category status controls
        initializeCategoryStatusControls();
        
        // Hide loading states
        hideLoadingState();
        
        // Complete analytics data task
        if (window.preloaderManager) {
            window.preloaderManager.completeTask('Analytics Data');
        }
        
    } catch (error) {
        // Error loading analytics data
        // Fallback to sample data if API fails
        loadSampleAnalyticsData();
        hideLoadingState();
        
        // Complete analytics data task even on error
        if (window.preloaderManager) {
            window.preloaderManager.completeTask('Analytics Data');
        }
    }
}

// Loading state functions
function showLoadingState() {
    const loadingElements = document.querySelectorAll('.loading-state');
    loadingElements.forEach(el => {
        if (el) el.style.display = 'flex';
    });
}

function hideLoadingState() {
    const loadingElements = document.querySelectorAll('.loading-state');
    loadingElements.forEach(el => {
        if (el) el.style.display = 'none';
    });
}

function updateSubmissionTrendsChart(stats) {
    if (!window.submissionTrendsChart || !stats.submission_trends) return;
    
    const chart = window.submissionTrendsChart;
    const trends = stats.submission_trends;
    
    chart.data.labels = trends.labels || [];
    chart.data.datasets[0].data = trends.data || [];
    chart.update();
}

// Question Progress functions removed - corresponding HTML section was removed

function initializeHierarchyTrees() {
    const expandToggles = document.querySelectorAll('.expand-toggle');
    
    expandToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const treeNode = this.closest('.tree-node');
            const children = treeNode.querySelector('.tree-children');
            const treeItem = treeNode.querySelector('.tree-item');
            
            if (children) {
                const isExpanded = children.style.display !== 'none';
                children.style.display = isExpanded ? 'none' : 'block';
                this.classList.toggle('rotated', !isExpanded);
                treeItem.classList.toggle('expanded', !isExpanded);
            }
        });
    });
    
    // Initialize all trees as collapsed except first level
    const allChildren = document.querySelectorAll('.tree-children');
    allChildren.forEach(children => {
        children.style.display = 'none';
    });
}

function updateCategoryOverviewStats(categories) {
    if (!categories || categories.length === 0) {
        // Set all counts to 0 if no data
        const completedEl = document.getElementById('completed-categories');
        const progressEl = document.getElementById('progress-categories');
        const pendingEl = document.getElementById('pending-categories');
        
        if (completedEl) completedEl.textContent = '0';
        if (progressEl) progressEl.textContent = '0';
        if (pendingEl) pendingEl.textContent = '0';
        return;
    }
    
    let completed = 0, inProgress = 0, notStarted = 0;
    
    categories.forEach(category => {
        const completion = category.completion || 0;
        if (completion >= 100) {
            completed++;
        } else if (completion > 0) {
            inProgress++;
        } else {
            notStarted++;
        }
    });
    
    const completedEl = document.getElementById('completed-categories');
    const progressEl = document.getElementById('progress-categories');
    const pendingEl = document.getElementById('pending-categories');
    
    if (completedEl) completedEl.textContent = completed;
    if (progressEl) progressEl.textContent = inProgress;
    if (pendingEl) pendingEl.textContent = notStarted;
}

function generateCategoryCard(category) {
    const completion = category.completion || 0;
    const statusClass = completion >= 100 ? 'completed' : completion > 0 ? 'in-progress' : 'not-started';
    const statusText = completion >= 100 ? 'Completed' : completion > 0 ? 'In Progress' : 'Not Started';
    const statusIcon = completion >= 100 ? 'fa-check-circle' : completion > 0 ? 'fa-clock' : 'fa-circle';
    
    // Generate subsection items
    const subsections = category.children || [];
    const subsectionItems = subsections.slice(0, 3).map(sub => {
        const subCompletion = sub.completion || 0;
        return `
            <div class="subsection-item">
                <div class="subsection-info">
                    <span class="subsection-name">${sub.name}</span>
                </div>
                <div class="subsection-progress">
                    <span class="progress-percentage">${Math.round(subCompletion)}%</span>
                </div>
            </div>
        `;
    }).join('');
    
    const moreCount = subsections.length > 3 ? subsections.length - 3 : 0;
    
    return `
        <div class="category-card ${statusClass}" data-category-id="${category.name}">
            <div class="card-header">
                <div class="category-title-section">
                    <h4 class="category-name">${category.name}</h4>
                    <div class="completion-percentage">${Math.round(completion)}%</div>
                </div>
            </div>
            
            <div class="card-body">
                <div class="status-badge ${statusClass}">
                    <i class="fas ${statusIcon}"></i>
                    <span class="status-text">${statusText}</span>
                </div>
                
                ${subsections.length > 0 ? `
                    <div class="subsections-list">
                        ${subsectionItems}
                        ${moreCount > 0 ? `
                            <div class="more-items">
                                <span>+${moreCount} more</span>
                                <button class="btn-view-details-inline" data-category="${category.name}">
                                    <i class="fas fa-eye"></i> View Details
                                </button>
                            </div>
                        ` : ''}
                    </div>
                ` : `
                    <div class="no-subsections">
                        <span class="empty-message">No subsections available</span>
                    </div>
                `}
            </div>
            
            ${moreCount === 0 ? `
                <div class="card-footer">
                    <button class="btn-view-details" data-category="${category.name}">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

function initializeCategoryInteractions() {
    // Initialize progress circles (only if SVG elements exist)
    document.querySelectorAll('.progress-circle').forEach(circle => {
        const progress = parseFloat(circle.dataset.progress) || 0;
        const progressRing = circle.querySelector('.progress-ring-circle');
        
        // Only proceed if SVG progress ring exists
        if (progressRing && progressRing.r && progressRing.r.baseVal) {
            const radius = progressRing.r.baseVal.value;
            const circumference = radius * 2 * Math.PI;
            
            progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
            progressRing.style.strokeDashoffset = circumference;
            
            // Animate progress
            setTimeout(() => {
                const offset = circumference - (progress / 100) * circumference;
                progressRing.style.strokeDashoffset = offset;
            }, 100);
        }
    });
    
    // Add click handlers for view details buttons (including inline buttons)
    document.querySelectorAll('.btn-view-details, .btn-view-details-inline').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const categoryName = btn.dataset.category;
            
            // Navigate to category details using the existing DashboardUIManager
            if (window.dashboardUIManager && window.dashboardUIManager.formSections && window.dashboardUIManager.formSections.length > 0) {
                // First navigate to form page if not already there
                const currentPage = document.querySelector('.page.active');
                if (!currentPage || currentPage.id !== 'form-page') {
                    navigateToPage('form', 'Forms');
                    // Wait for page transition, then show category details
                    setTimeout(() => {
                        window.dashboardUIManager.showCategoryDetails(categoryName);
                    }, 300);
                } else {
                    // Already on form page, show category details immediately
                    window.dashboardUIManager.showCategoryDetails(categoryName);
                }
            } else {
                // Fallback: navigate to form page and show category
                navigateToPage('form', 'Forms');
                // Wait for the dashboard UI manager to load form sections
                setTimeout(() => {
                    if (window.dashboardUIManager) {
                        window.dashboardUIManager.showCategoryDetails(categoryName);
                    }
                }, 800);
            }
        });
    });
    
    // Add hover effects for cards
    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-2px)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
    });
}

function initializeCategoryStatusControls() {
    // Grid/Card view toggle buttons
    const viewToggleBtns = document.querySelectorAll('.view-toggle');
    const categoriesGrid = document.querySelector('.categories-grid');
    
    viewToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all toggle buttons
            viewToggleBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            const viewType = btn.dataset.view;
            if (categoriesGrid) {
                if (viewType === 'grid') {
                    categoriesGrid.classList.remove('card-layout');
                    categoriesGrid.classList.add('grid-layout');
                } else if (viewType === 'cards') {
                    categoriesGrid.classList.remove('grid-layout');
                    categoriesGrid.classList.add('card-layout');
                }
            }
        });
    });
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-status');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            // Add loading state
            const icon = refreshBtn.querySelector('i');
            if (icon) {
                icon.classList.add('fa-spin');
            }
            
            // Reload dashboard data
            loadDashboardData().finally(() => {
                // Remove loading state
                if (icon) {
                    icon.classList.remove('fa-spin');
                }
            });
        });
    }
}

function updateFormStatusHierarchy(categories) {
    const container = document.querySelector('#categories-display');
    if (!container) return;
    
    // Update overview statistics
    updateCategoryOverviewStats(categories);
    
    // Use real data from API if available, otherwise show loading or empty state
    if (categories && categories.length > 0) {
        // Generate category cards
        const categoryCards = categories.map(category => generateCategoryCard(category)).join('');
        
        container.innerHTML = `
            <div class="categories-grid">
                ${categoryCards}
            </div>
        `;
        
        // Initialize interactive features
        initializeCategoryInteractions();
    } else {
        // Show message when no data is available
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-chart-pie"></i>
                </div>
                <h3>No Category Data Available</h3>
                <p>Category completion data will appear here once available.</p>
            </div>
        `;
    }
}

// updateAccessPercentageHierarchy function removed - Access Percentage section has been removed from the dashboard

function generateHierarchyHTML(data) {
    return data.map(item => {
        const percentageClass = item.percentage >= 80 ? 'high' : item.percentage >= 50 ? 'medium' : 'low';
        const hasChildren = item.children && item.children.length > 0;
        
        return `
            <div class="tree-node">
                <div class="tree-item">
                    <div class="tree-content">
                        ${hasChildren ? '<button class="expand-toggle">▶</button>' : '<div class="tree-icon">•</div>'}
                        <span class="tree-label">${item.label}</span>
                    </div>
                    <div class="tree-percentage">
                        <div class="percentage-bar">
                            <div class="percentage-fill ${percentageClass}" style="width: ${item.percentage}%"></div>
                        </div>
                        <span class="percentage-text">${item.percentage}%</span>
                    </div>
                </div>
                ${hasChildren ? `<div class="tree-children">${generateHierarchyHTML(item.children)}</div>` : ''}
            </div>
        `;
    }).join('');
}

function updateTimelineChart(timelineData) {
    const chart = Chart.getChart('timelineChart');
    if (chart && timelineData) {
        chart.data.labels = timelineData.map(item => item.date);
        chart.data.datasets[0].data = timelineData.map(item => item.answers);
        chart.update();
    }
}

function updateAnsweredQuestionsByRange(range) {
    // This function can be implemented later if needed for specific range filtering
}

function loadSampleAnalyticsData() {
    // Fallback sample data for analytics
    updateAnsweredQuestionsByRange('today');
    
    // Load sample hierarchy data
    const sampleCategories = [];
    updateFormStatusHierarchy(sampleCategories);
    
    const sampleTrends = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        data: [12, 19, 8, 15, 22, 18, 25]
    };
    
    if (window.submissionTrendsChart) {
        window.submissionTrendsChart.data.labels = sampleTrends.labels;
        window.submissionTrendsChart.data.datasets[0].data = sampleTrends.data;
        window.submissionTrendsChart.update();
    }
}

function loadProfileData() {
    // Load profile data
    loadSecurityData();
    
    // Only load audit logs if user ID is available
    if (currentUserId) {
        loadAuditLogs();
    } else {
        // Wait a bit for user data to load, then try again
        setTimeout(() => {
            if (currentUserId) {
                loadAuditLogs();
            }
        }, 1000);
    }
}

// Security & Sessions Functions
function loadSecurityData() {
    // Load last login info
    fetch('/api/security/last-login/')
        .then(response => response.json())
        .then(data => {
            updateLastLoginInfo(data);
        })
        .catch(error => {
            // Error loading last login
            // Fallback data
            updateLastLoginInfo({
                last_login: new Date().toISOString(),
                ip_address: '192.168.1.100',
                location: 'Unknown Location',
                device: 'Unknown Device'
            });
        });

    // Load active sessions
    loadActiveSessions();
    
    // Load login history
    loadLoginHistory();
}

function updateLastLoginInfo(data) {
    const lastLoginTime = document.getElementById('last-login-time');
    const lastLoginIP = document.getElementById('last-login-ip');
    const lastLoginLocation = document.getElementById('last-login-location');
    const lastLoginDevice = document.getElementById('last-login-device');
    
    if (lastLoginTime && data.last_login) {
        const loginDate = new Date(data.last_login);
        lastLoginTime.textContent = loginDate.toLocaleString();
    }
    
    if (lastLoginIP && data.ip_address) {
        lastLoginIP.textContent = data.ip_address;
    }
    
    if (lastLoginLocation && data.location) {
        lastLoginLocation.textContent = data.location;
    }
    
    if (lastLoginDevice && data.device) {
        lastLoginDevice.textContent = data.device;
    }
}

function loadActiveSessions() {
    const sessionsList = document.getElementById('sessions-list');
    if (!sessionsList) return;
    
    sessionsList.innerHTML = '<div class="session-loading">Loading active sessions...</div>';
    
    fetch('/api/security/sessions/')
        .then(response => response.json())
        .then(data => {
            renderActiveSessions(data.sessions || []);
        })
        .catch(error => {
            // Error loading sessions
            // Fallback data
            renderActiveSessions([
                {
                    id: 'current',
                    device: 'Current Browser',
                    location: 'Unknown Location',
                    last_activity: new Date().toISOString(),
                    is_current: true
                }
            ]);
        });
}

function renderActiveSessions(sessions) {
    const sessionsList = document.getElementById('sessions-list');
    if (!sessionsList) return;
    
    if (sessions.length === 0) {
        sessionsList.innerHTML = '<div class="session-loading">No active sessions found.</div>';
        return;
    }
    
    sessionsList.innerHTML = sessions.map(session => `
        <div class="session-item ${session.is_current ? 'current' : ''}">
            <div class="session-info">
                <div class="session-device">
                    <i class="fas fa-${getDeviceIcon(session.device)}"></i>
                    ${session.device}
                    ${session.is_current ? '<span class="badge">Current</span>' : ''}
                </div>
                <div class="session-location">
                    <i class="fas fa-map-marker-alt"></i>
                    ${session.location}
                </div>
            </div>
            <div class="session-time">
                ${new Date(session.last_activity).toLocaleString()}
            </div>
            ${!session.is_current ? `
                <div class="session-actions">
                    <button class="btn btn-danger btn-small" onclick="terminateSession('${session.id}')">
                        <i class="fas fa-times"></i> End
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

function loadLoginHistory() {
    const historyList = document.getElementById('login-history');
    if (!historyList) return;
    
    historyList.innerHTML = '<div class="history-loading">Loading login history...</div>';
    
    fetch('/api/security/login-history/')
        .then(response => response.json())
        .then(data => {
            renderLoginHistory(data.history || []);
        })
        .catch(error => {
            // Error loading login history
            // Fallback data
            renderLoginHistory([
                {
                    timestamp: new Date().toISOString(),
                    ip_address: '192.168.1.100',
                    location: 'Unknown Location',
                    device: 'Browser',
                    success: true
                }
            ]);
        });
}

function renderLoginHistory(history) {
    const historyList = document.getElementById('login-history');
    if (!historyList) return;
    
    if (history.length === 0) {
        historyList.innerHTML = '<div class="history-loading">No login history found.</div>';
        return;
    }
    
    historyList.innerHTML = history.map(item => `
        <div class="history-item">
            <div class="history-info">
                <div class="history-device">
                    <i class="fas fa-${getDeviceIcon(item.device)} ${item.success ? 'text-success' : 'text-danger'}"></i>
                    ${item.device}
                    ${item.success ? '<span class="badge badge-success">Success</span>' : '<span class="badge badge-danger">Failed</span>'}
                </div>
                <div class="history-location">
                    <i class="fas fa-map-marker-alt"></i>
                    ${item.location} (${item.ip_address})
                </div>
            </div>
            <div class="history-time">
                ${new Date(item.timestamp).toLocaleString()}
            </div>
        </div>
    `).join('');
}

function getDeviceIcon(device) {
    const deviceLower = device.toLowerCase();
    if (deviceLower.includes('mobile') || deviceLower.includes('phone')) return 'mobile-alt';
    if (deviceLower.includes('tablet') || deviceLower.includes('ipad')) return 'tablet-alt';
    if (deviceLower.includes('desktop') || deviceLower.includes('computer')) return 'desktop';
    return 'laptop';
}

function terminateSession(sessionId) {
    if (!confirm('Are you sure you want to end this session?')) return;
    
    fetch(`/api/security/sessions/${sessionId}/terminate/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadActiveSessions(); // Reload sessions
        } else {
            alert('Failed to terminate session');
        }
    })
    .catch(error => {
        // Error terminating session
        alert('Error terminating session');
    });
}

// Audit Logs Functions
function loadAuditLogs() {
    const auditLogs = document.getElementById('audit-logs');
    if (!auditLogs) return;
    
    // Check if currentUserId is available
    if (!currentUserId) {
        // User ID not available yet, skipping audit logs load
        return;
    }
    
    auditLogs.innerHTML = '<div class="audit-loading">Loading audit logs...</div>';
    
    const filters = getAuditFilters();
    const queryParams = new URLSearchParams(filters);
    
    fetch(`/api/audit/logs/?${queryParams}`)
        .then(response => response.json())
        .then(data => {
            renderAuditLogs(data.logs || []);
        })
        .catch(error => {
            // Error loading audit logs
            // Fallback data
            renderAuditLogs([
                {
                    id: 1,
                    action: 'Modified Question',
                    resource_type: 'question',
                    resource_name: 'Sample Question',
                    old_value: 'Old question text',
                    new_value: 'New question text',
                    timestamp: new Date().toISOString(),
                    saved_locally: true,
                    saved_database: true
                }
            ]);
        });
}

function getAuditFilters() {
    const typeFilter = document.getElementById('audit-type-filter');
    const timeFilter = document.getElementById('audit-time-filter');
    
    return {
        type: typeFilter ? typeFilter.value : 'all',
        time_range: timeFilter ? timeFilter.value : '7d'
    };
}

function renderAuditLogs(logs) {
    const auditLogs = document.getElementById('audit-logs');
    if (!auditLogs) return;
    
    if (logs.length === 0) {
        auditLogs.innerHTML = '<div class="audit-loading">No audit logs found.</div>';
        return;
    }
    
    auditLogs.innerHTML = logs.map(log => {
        // Extract readable values from JSON objects
        let oldValueText = '';
        let newValueText = '';
        
        if (log.old_value) {
            if (typeof log.old_value === 'object') {
                oldValueText = log.old_value.response || JSON.stringify(log.old_value);
            } else {
                oldValueText = log.old_value;
            }
        }
        
        if (log.new_value) {
            if (typeof log.new_value === 'object') {
                newValueText = log.new_value.response || JSON.stringify(log.new_value);
            } else {
                newValueText = log.new_value;
            }
        }
        
        return `
            <div class="audit-item ${log.resource_type}">
                <div class="audit-content">
                    <div class="audit-action">
                        <i class="fas fa-${getAuditIcon(log.resource_type)}"></i>
                        ${log.action}
                    </div>
                    <div class="audit-details">
                        ${log.resource_type}: ${log.resource_name}
                    </div>
                    ${oldValueText || newValueText ? `
                        <div class="audit-changes">
                            <strong>Changed:</strong> "${oldValueText || 'None'}" → "${newValueText || 'None'}"
                        </div>
                    ` : ''}
                    <div class="audit-status">
                        <span class="badge ${log.saved_locally ? 'badge-success' : 'badge-warning'}">
                            <i class="fas fa-${log.saved_locally ? 'check' : 'clock'}"></i>
                            Local: ${log.saved_locally ? 'Saved' : 'Pending'}
                        </span>
                        <span class="badge ${log.saved_database ? 'badge-success' : 'badge-warning'}">
                            <i class="fas fa-${log.saved_database ? 'check' : 'clock'}"></i>
                            DB: ${log.saved_database ? 'Saved' : 'Pending'}
                        </span>
                    </div>
                </div>
                <div class="audit-time">
                    ${new Date(log.timestamp).toLocaleString()}
                </div>
            </div>
        `;
    }).join('');
}

function getAuditIcon(resourceType) {
    const icons = {
        'category': 'folder',
        'subsection': 'folder-open',
        'topic': 'bookmark',
        'question': 'question-circle',
        'sub_question': 'question'
    };
    return icons[resourceType] || 'edit';
}

function setupAuditFilters() {
    const typeFilter = document.getElementById('audit-type-filter');
    const timeFilter = document.getElementById('audit-time-filter');
    
    if (typeFilter) {
        typeFilter.addEventListener('change', loadAuditLogs);
    }
    
    if (timeFilter) {
        timeFilter.addEventListener('change', loadAuditLogs);
    }
}

function exportAuditLogs(format) {
    const filters = getAuditFilters();
    const queryParams = new URLSearchParams({...filters, format});
    
    window.open(`/api/audit/export/?${queryParams}`, '_blank');
}

function getCsrfToken() {
    const token = document.querySelector('[name=csrfmiddlewaretoken]');
    return token ? token.value : '';
}

// Initialize security and audit functionality when profile page loads
document.addEventListener('DOMContentLoaded', function() {
    // Setup audit filters when page loads
    setupAuditFilters();
    
    // Add event listeners for export buttons
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => exportAuditLogs('csv'));
    }
    
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => exportAuditLogs('pdf'));
    }
});

// Performance monitoring
if (typeof PerformanceMonitor !== 'undefined') {
    window.performanceMonitor = new PerformanceMonitor();
}

// Security features functions
async function loadSecuritySessions() {
    try {
        const response = await fetch(`/api/security/sessions?user_id=${currentUserId}`);
        const sessions = await response.json();
        displaySessions(sessions);
    } catch (error) {
        // Error loading sessions
    }
}

async function terminateSession(sessionKey) {
    try {
        const response = await fetch(`/api/security/sessions/${sessionKey}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id: currentUserId })
        });
        
        if (response.ok) {
            loadSecuritySessions(); // Refresh the list
            showNotification('Session terminated successfully', 'success');
        }
    } catch (error) {
        // Error terminating session
        showNotification('Failed to terminate session', 'error');
    }
}



function displaySessions(sessions) {
    // Implementation for displaying sessions
}

function displayAuditLogs(data) {
    // Implementation for displaying audit logs
}

function showNotification(message, type) {
    // Implementation for showing notifications
}