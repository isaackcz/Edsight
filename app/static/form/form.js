import {
    fetchCategories,
    fetchSubSections,
    fetchDraftedQuestionnaires,
    fetchTopics,
    renameTopic,
    deleteTopic,
    saveTopic,
    fetchQuestions,
    createQuestion,
    deleteQuestion,
    updateQuestion,
    deleteQuestion as deleteQuestionAPI
} from './form_backend.js';

// Helper function to get answer type label
function getAnswerTypeLabel(type) {
    const labels = {
        'text': 'Text',
        'number': 'Number', 
        'date': 'Date',
        'percentage': 'Percentage'
    };
    return labels[type] || 'Text';
}

document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const topicSection = document.getElementById('topic-section');
    const questionsSection = document.getElementById('questions-section');
    const confirmationSection = document.getElementById('confirmation-section');
    const nextToQuestionsBtn = document.getElementById('next-to-questions');
    const backToTopicBtn = document.getElementById('back-to-topic');
    const addQuestionBtn = document.getElementById('add-question');
    const finishTopicBtn = document.getElementById('finish-topic');
    const addAnotherTopicBtn = document.getElementById('add-another-topic');
    const finishProcessBtn = document.getElementById('finish-process');
    const questionsContainer = document.getElementById('questions-container');
    const currentTopicName = document.getElementById('current-topic-name');
    const confirmedTopicName = document.getElementById('confirmed-topic-name');
    const questionsCount = document.getElementById('questions-count');
    const draftsContainer = document.querySelector('.drafts-container');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebar = document.querySelector('.sidebar');
    const sidebarClose = document.getElementById('sidebar-close');

    // State
    let currentTopic = {
        category: '',
        subSection: '',
        name: '',
        questions: []
    };

    // Initialize the form
    initForm();
    restoreFormPageState();
    restoreDraftsPageState();
    initModernUI();
    // Defensive: fetchCategories usage
    fetchCategories().then(categories => {
        const categorySelect = document.getElementById('category');
        if (!categorySelect) return;
        categorySelect.innerHTML = '<option value="">Select a category</option>';
        if (!Array.isArray(categories)) categories = [];
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.category_id || cat.id || cat.pk;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });
        // Only restore after categories are loaded
        restoreCurrentTopic();
    }).catch(err => {
        console.error('Failed to fetch categories:', err);
    });
    loadDraftedQuestionnaires();

    // Event listeners
    backToTopicBtn.addEventListener('click', function() {
        goBackToTopic();
        saveFormPageState('topic');
    });
    addQuestionBtn.addEventListener('click', addNewQuestion);
    finishTopicBtn.addEventListener('click', function() {
        finishCurrentTopic();
        saveFormPageState('confirmation');
    });
    addAnotherTopicBtn.addEventListener('click', function() {
        startNewTopic();
        saveFormPageState('topic');
    });
    finishProcessBtn.addEventListener('click', function() {
        finishProcess();
        saveFormPageState('topic');
    });

    // Theme toggle removed - project does not support dark mode

    // Category change handler
    const categorySelect = document.getElementById('category');
    const subSectionSelect = document.getElementById('sub-section'); // Declare only once
    if (categorySelect) {
        categorySelect.addEventListener('change', function() {
            const categoryId = this.value;
            if (!subSectionSelect) return;
            subSectionSelect.innerHTML = '<option value="">Select a sub-section</option>';
            updateTopicContextInfo();
            if (!categoryId) return;
            fetchSubSections(categoryId).then(subSections => {
                if (!Array.isArray(subSections)) subSections = [];
                subSections.forEach(sub => {
                    const option = document.createElement('option');
                    option.value = sub.sub_section_id || sub.id || sub.pk;
                    option.textContent = sub.name;
                    subSectionSelect.appendChild(option);
                });
                updateTopicContextInfo();
            }).catch(err => console.error('Failed to fetch sub-sections:', err));
        });
    }
    if (subSectionSelect) {
        subSectionSelect.addEventListener('change', function() {
            updateTopicContextInfo();
            // Remove old topic list rendering logic (autocomplete now handles topic selection)
            const topicArea = document.getElementById('topic-area');
            if (topicArea) topicArea.innerHTML = '';
        });
    }
    // Defensive: sub-section change event
    if (subSectionSelect) {
        subSectionSelect.addEventListener('change', function() {
            updateTopicContextInfo();
        });
    }

    // Sidebar handling
    // Defensive: sidebar handling
    if (sidebar) {
        sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-modal', 'true');
        sidebar.setAttribute('aria-label', 'Main menu');
        sidebar.setAttribute('tabindex', '-1');
    }
    if (sidebarToggle) {
        sidebarToggle.setAttribute('aria-controls', 'sidebar');
        sidebarToggle.setAttribute('aria-expanded', 'false');
        sidebarToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            openSidebar();
        });
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }
    if (sidebarClose) {
        sidebarClose.addEventListener('click', closeSidebar);
    }
    if (sidebar) {
        document.querySelectorAll('.sidebar .menu-item').forEach(item => {
            item.addEventListener('click', function() {
                if (window.innerWidth <= 900) closeSidebar();
            });
        });
    }
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
            closeSidebar();
        }
        if (document.body.classList.contains('sidebar-open') && sidebar) {
            const focusable = sidebar.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])');
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        }
    });
    window.addEventListener('resize', function() {
        if (window.innerWidth > 900) closeSidebar();
    });

    // Draft state persistence
    function saveDraftsPageState(state) {
        localStorage.setItem('draftsPageState', JSON.stringify(state));
    }
    function restoreDraftsPageState() {
        const state = localStorage.getItem('draftsPageState');
        if (!state) return;
        let parsed;
        try { parsed = JSON.parse(state); } catch (e) { return; }
        if (!parsed || !parsed.view) return;
        if (parsed.view === 'topics') {
            viewTopics(parsed.subSectionId, parsed.categoryName, parsed.subSectionName);
        } else if (parsed.view === 'editQuestions') {
            viewDraftQuestions(parsed.topicId, parsed.subSectionId, parsed.categoryName, parsed.topicName, parsed.subSectionName);
        }
    }
    window.addEventListener('pagehide', function() {
        localStorage.removeItem('draftsPageState');
    });

    // Form state persistence
    function saveFormPageState(step) {
        const categoryId = document.getElementById('category').value;
        const subSectionId = document.getElementById('sub-section').value;
        localStorage.setItem('formPageState', JSON.stringify({ step, topic: currentTopic, categoryId, subSectionId }));
    }
    function restoreFormPageState() {
        const state = localStorage.getItem('formPageState');
        if (!state) return;
        let parsed;
        try { parsed = JSON.parse(state); } catch (e) { return; }
        if (!parsed || !parsed.step) return;
        if (parsed.topic) currentTopic = parsed.topic;
        if (parsed.categoryId) {
            const categorySelect = document.getElementById('category');
            if (!categorySelect) return;
            const checkCategoriesLoaded = () => {
                if (categorySelect.options.length > 1) {
                    categorySelect.value = parsed.categoryId;
                    if (parsed.subSectionId) {
                        fetchSubSections(parsed.categoryId).then(subSections => {
                            const subSectionSelect = document.getElementById('sub-section');
                            if (!subSectionSelect) return;
                            subSectionSelect.innerHTML = '<option value="">Select a sub-section</option>';
                            if (!Array.isArray(subSections)) subSections = [];
                            subSections.forEach(sub => {
                                const option = document.createElement('option');
                                option.value = sub.sub_section_id || sub.id || sub.pk;
                                option.textContent = sub.name;
                                subSectionSelect.appendChild(option);
                            });
                            subSectionSelect.value = parsed.subSectionId;
                            restoreFormStepPage(parsed);
                        }).catch(err => console.error('Failed to fetch sub-sections:', err));
                    } else {
                        restoreFormStepPage(parsed);
                    }
                } else {
                    setTimeout(checkCategoriesLoaded, 50);
                }
            };
            checkCategoriesLoaded();
        } else {
            restoreFormStepPage(parsed);
        }
    }
    function restoreFormStepPage(parsed) {
        if (parsed.topic && parsed.topic.name) {
            const topicInput = document.getElementById('topic');
            if (topicInput) topicInput.value = parsed.topic.name;
        }
        // Always update context info after setting values
        updateTopicContextInfo();
        if (parsed.step === 'questions') {
            goToQuestions();
        } else if (parsed.step === 'confirmation') {
            goToQuestions();
            finishCurrentTopic(true);
        } else {
            goBackToTopic();
        }
    }

    // Helper functions
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    // Remove any quotes that might be wrapping the value
                    if (cookieValue.startsWith('"') && cookieValue.endsWith('"')) {
                        cookieValue = cookieValue.slice(1, -1);
                    }
                    break;
                }
            }
        }
        // Add debug logging
        console.log('Getting cookie:', name, 'Value:', cookieValue, 'Length:', cookieValue ? cookieValue.length : 0, 'Raw cookie:', document.cookie);
        if (!cookieValue || cookieValue.length < 32) {
            console.warn('CSRF token appears invalid - length should be 32+ characters');
        }
        return cookieValue;
    }

    function updateTopicContextInfo() {
        const categorySelect = document.getElementById('category');
        const subSectionSelect = document.getElementById('sub-section');
        const infoDiv = document.getElementById('topic-context-info');
        if (!infoDiv) return;
        const categoryName = categorySelect ? categorySelect.options[categorySelect.selectedIndex]?.text || 'Not selected' : 'Not selected';
        const subSectionName = subSectionSelect ? subSectionSelect.options[subSectionSelect.selectedIndex]?.text || 'Not selected' : 'Not selected';
        infoDiv.textContent = `Category: ${categoryName}   |   Sub-section: ${subSectionName}`;
    }

    function initForm() {
        currentTopic = { category: '', subSection: '', name: '', questions: [] };
        const categorySelect = document.getElementById('category');
        if (categorySelect) categorySelect.value = '';
        const subSectionSelect = document.getElementById('sub-section');
        if (subSectionSelect) subSectionSelect.value = '';
        const topicInput = document.getElementById('topic');
        if (topicInput) topicInput.value = '';
        // Ensure context info is updated on init
        updateTopicContextInfo();
    }

    function loadDraftedQuestionnaires() {
        // Ensure grid is reset for list view
        draftsContainer.classList.remove('single-column');
        draftsContainer.classList.remove('single-column');
        draftsContainer.classList.add('modern-grid');
        
        // Show "create a new topic" section and step indicator when loading drafts
        const topicSection = document.getElementById('topic-section');
        if (topicSection) {
            topicSection.style.display = 'block';
        }
        
        const progressContainer = document.querySelector('.progress-container');
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
        fetchDraftedQuestionnaires().then(draftedData => {
            draftsContainer.innerHTML = '';
            const grouped = {};
            if (!Array.isArray(draftedData)) draftedData = [];
            draftedData.forEach(item => {
                const category = item.category || item.category_name || 'No category';
                const subSection = item.subSection || item.sub_section || 'No sub-section';
                if (!grouped[category]) grouped[category] = {};
                if (!grouped[category][subSection]) grouped[category][subSection] = [];
                grouped[category][subSection].push(item);
            });
            Object.entries(grouped).forEach(([categoryName, subSections], catIdx) => {
                let iconClass = 'fa-folder';
                if (categoryName.toLowerCase().includes('access')) iconClass = 'fa-unlock';
                else if (categoryName.toLowerCase().includes('quality')) iconClass = 'fa-star';
                else if (categoryName.toLowerCase().includes('governance')) iconClass = 'fa-gavel';
                const categoryCard = document.createElement('div');
                categoryCard.className = 'category-card';
                categoryCard.innerHTML = `
                    <div class="category-header">
                        <div class="category-title category-clickable" data-category="${categoryName}">
                            <i class="fas ${iconClass}"></i>
                            <span>${categoryName}</span>
                        </div>
                        <div class="category-actions">
                            <button class="edit-category" data-id="${catIdx}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="toggle-category">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                        </div>
                    </div>
                    <div class="sub-sections-container">
                        ${Object.entries(subSections).map(([subSectionName, topics]) => `
                            <div class="sub-section-item sub-section-clickable" data-category="${categoryName}" data-subsection="${subSectionName}" data-subsectionid="${topics[0].sub_section_id}">
                                <div class="sub-section-name">${subSectionName}</div>
                                <div class="sub-section-actions">
                                    <button class="edit-sub-section" data-id="${topics[0].sub_section_id}">
                                        <i class="fas fa-edit"></i> Edit
                                    </button>
                                    <button class="view-topics" data-id="${topics[0].sub_section_id}">
                                        <i class="fas fa-arrow-right"></i> View Topics
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                draftsContainer.appendChild(categoryCard);
                const categoryTitleDiv = categoryCard.querySelector('.category-title');
                if (categoryTitleDiv) {
                    categoryTitleDiv.addEventListener('click', function(e) {
                        if (e.target.closest('.edit-category') || e.target.closest('.toggle-category')) return;
                        const subSectionsContainer = categoryCard.querySelector('.sub-sections-container');
                        const isExpanded = subSectionsContainer ? subSectionsContainer.style.display === 'block' : false;
                        if (subSectionsContainer) subSectionsContainer.style.display = isExpanded ? 'none' : 'block';
                    });
                }
                const toggleBtn = categoryCard.querySelector('.toggle-category');
                const subSectionsContainer = categoryCard.querySelector('.sub-sections-container');
                if (toggleBtn) {
                    toggleBtn.addEventListener('click', function() {
                        const isExpanded = subSectionsContainer ? subSectionsContainer.style.display === 'block' : false;
                        if (subSectionsContainer) subSectionsContainer.style.display = isExpanded ? 'none' : 'block';
                        toggleBtn.innerHTML = isExpanded ? '<i class="fas fa-chevron-down"></i>' : '<i class="fas fa-chevron-up"></i>';
                    });
                }
                const subSectionItems = categoryCard.querySelectorAll('.sub-section-clickable');
                if (subSectionItems) {
                    subSectionItems.forEach(subSectionDiv => {
                        subSectionDiv.addEventListener('click', function(e) {
                            if (e.target.closest('.edit-sub-section') || e.target.closest('.view-topics')) return;
                            const subSectionId = this.getAttribute('data-subsectionid');
                            viewTopics(subSectionId, categoryName, this.getAttribute('data-subsection'));
                        });
                    });
                }
                const viewTopicsBtns = categoryCard.querySelectorAll('.view-topics');
                if (viewTopicsBtns) {
                    viewTopicsBtns.forEach(btn => {
                        btn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            const subSectionId = this.getAttribute('data-id');
                            viewTopics(subSectionId, categoryName);
                        });
                    });
                }
            });
        }).catch(err => console.error('Failed to load drafts:', err));
    }

    function goToQuestions() {
        const categoryInput = document.getElementById('category');
        const subSectionInput = document.getElementById('sub-section');
        const topicInput = document.getElementById('topic');
        let valid = true;

        if (!categoryInput || !subSectionInput || !topicInput) return;

        [categoryInput, subSectionInput, topicInput].forEach(input => {
            if (!input.value) {
                input.style.border = '2px solid red';
                valid = false;
            } else {
                input.style.border = '';
            }
        });
        if (!valid) return;

        currentTopic.category = categoryInput.options[categoryInput.selectedIndex].text;
        currentTopic.subSection = subSectionInput.options[subSectionInput.selectedIndex].text;
        currentTopic.name = topicInput.value;

        currentTopicName.textContent = topicInput.value;
        document.querySelector('.topic-meta').textContent = `(${currentTopic.category} > ${currentTopic.subSection})`;

        document.querySelectorAll('.step')[0].classList.remove('active');
        document.querySelectorAll('.step')[1].classList.add('active');

        topicSection.style.display = 'none';
        questionsSection.style.display = 'block';
        confirmationSection.style.display = 'none';
        
        // Hide draft questionnaire section when proceeding to step 2
        const draftsSection = document.querySelector('.drafts-section');
        if (draftsSection) {
            draftsSection.style.display = 'none';
        }

        if (currentTopic.questions.length === 0) {
            addNewQuestion();
        } else {
            renderQuestions(currentTopic.questions, questionsContainer);
        }
        updateTopicContextInfo();
    }

    function goBackToTopic() {
        document.querySelectorAll('.step')[1].classList.remove('active');
        document.querySelectorAll('.step')[0].classList.add('active');
        topicSection.style.display = 'block';
        questionsSection.style.display = 'none';
        confirmationSection.style.display = 'none';
        
        // Show draft questionnaire section when going back to step 1
        const draftsSection = document.querySelector('.drafts-section');
        if (draftsSection) {
            draftsSection.style.display = 'block';
        }
        
        updateTopicContextInfo();
    }

    function addNewQuestion() {
        syncQuestionsFromDOM();
        const usedOrders = currentTopic.questions.map(q => q.displayOrder || q.display_order);
        let nextOrder = 1;
        while (usedOrders.includes(nextOrder)) nextOrder++;
        const newQuestion = {
            question_text: '',
            answer_type: 'number', // default to 'number'
            is_required: true,
            display_order: '', // empty by default for placeholder
            choices: [],
            answer_description: '',
            subQuestions: []
        };
        currentTopic.questions.push(newQuestion);
        renderQuestions(currentTopic.questions, questionsContainer);
        setTimeout(() => {
            const allCards = questionsContainer.querySelectorAll('.question-card');
            const newQuestionCard = allCards[allCards.length - 1];
            if (newQuestionCard) {
                newQuestionCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const textarea = newQuestionCard.querySelector('.question-text');
                if (textarea) textarea.focus();
            }
        }, 100);
    }

    function toggleChoicesContainer(questionId, type) {
        const question = currentTopic.questions.find(q => q.question_id == questionId);
        if (question) {
            question.answer_type = type;
            if (type !== 'choice' && type !== 'multiple') {
                question.choices = [];
            }
            renderQuestions(currentTopic.questions, questionsContainer);
        }
    }

    function addChoice(questionId) {
        const question = currentTopic.questions.find(q => q.question_id == questionId) ||
                        window.currentDraftQuestions?.find(q => q.question_id == questionId);
        if (question) {
            question.choices.push('');
            const container = question.question_id ? questionsContainer : window.currentDraftQuestionsContainer;
            renderQuestions(question.question_id ? currentTopic.questions : window.currentDraftQuestions, container);
        }
    }

    function updateQuestionText(questionId, text) {
        const question = currentTopic.questions.find(q => q.question_id == questionId);
        if (question) {
            question.question_text = text;
        }
    }

    function updateQuestionRequired(questionId, isRequired) {
        const question = currentTopic.questions.find(q => q.question_id == questionId);
        if (question) {
            question.is_required = isRequired;
        }
    }

    function updateDisplayOrder(questionId, newOrder) {
        const question = currentTopic.questions.find(q => q.question_id == questionId);
        if (question) {
            if (currentTopic.questions.some(q => q.display_order == newOrder && q.question_id != questionId)) {
                alert('Display order already taken. Please choose another number.');
                renderQuestions(currentTopic.questions, questionsContainer);
                return;
            }
            question.display_order = newOrder;
            currentTopic.questions.sort((a, b) => a.display_order - b.display_order);
            renderQuestions(currentTopic.questions, questionsContainer);
        }
    }

    function updateChoiceLabel(questionId, choiceIndex, newLabel) {
        const question = currentTopic.questions.find(q => q.question_id == questionId);
        if (question) {
            question.choices[choiceIndex] = newLabel;
        }
    }

    function removeChoice(questionId, choiceIndex) {
        const question = currentTopic.questions.find(q => q.question_id == questionId);
        if (question) {
            question.choices.splice(choiceIndex, 1);
            renderQuestions(currentTopic.questions, questionsContainer);
        }
    }

    // --- Question Rendering and CRUD Logic ---

    /**
     * Render all questions for a topic into the given container.
     * Handles UI for editing, deleting, and reordering questions.
     */
    function renderQuestions(questions, container, options = {}) {
        if (!Array.isArray(questions)) questions = [];
        container.innerHTML = '';
        const section = document.createElement('div');
        section.className = 'form-section';
        const questionsContainer = document.createElement('div');
        questionsContainer.className = 'questions-container';
        section.appendChild(questionsContainer);
        container.appendChild(section);
        questions.forEach((q, idx) => {
            if (typeof q.answer_description === 'undefined') q.answer_description = '';
            if (q.question_id !== undefined && q.question_id !== null) q.question_id = String(q.question_id);
            const card = document.createElement('div');
            card.className = 'question-card';
            card.setAttribute('draggable', 'true');
            card.setAttribute('data-qidx', idx);
            card.innerHTML = `
                <div class="question-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span class="question-circle" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#bfc9d1;color:#fff;font-weight:700;font-size:18px;">${idx + 1}</span>
                        <span style="font-weight:700;font-size:18px;color:#222;">Question ${idx + 1}</span>
                    </div>
                    <button type="button" class="btn btn-xs btn-outline add-subquestion-btn sub-question-toggle-btn" data-question-id="${q.question_id !== undefined ? q.question_id : idx}" style="white-space: nowrap;">
                        <i class="fas fa-plus"></i> Sub-Question
                    </button>
                </div>
                <div class="question-text-container">
                    <div class="section-label" style="font-weight:600;color:var(--primary);margin-bottom:6px;">Question Text</div>
                    <textarea class="question-text" data-id="${q.question_id !== undefined ? q.question_id : ''}" placeholder="Enter question text">${q.question_text || q.text || ''}</textarea>
                    <div class="inline-error" style="display:none;"></div>
                </div>
                <div class="question-settings-container">
                    <div class="section-label" style="font-weight:600;color:var(--primary);margin-bottom:6px;">Question Settings</div>
                    <div class="settings-delete-row" style="display:flex;align-items:center;gap:0;">
                        <div class="grouped-meta" style="flex:7;">
                            <div class="meta-field answer-type-meta">
                                <i class="fas fa-list-alt"></i>
                                <select class="answer-type" data-id="${q.question_id !== undefined ? q.question_id : ''}">
                                    <option value="text" ${(q.answer_type === 'text' || !q.answer_type) ? 'selected' : ''}>Text</option>
                                    <option value="number" ${q.answer_type === 'number' ? 'selected' : ''}>Number</option>
                                    <option value="date" ${q.answer_type === 'date' ? 'selected' : ''}>Date</option>
                                    <option value="percentage" ${q.answer_type === 'percentage' ? 'selected' : ''}>Percentage</option>
                                </select>
                            </div>
                            <div class="meta-field required-meta">
                                <i class="fas fa-asterisk"></i>
                                <div class="toggle-switch">
                                    <input type="checkbox" class="is-required" ${(q.is_required || q.required) ? 'checked' : ''} data-id="${q.question_id !== undefined ? q.question_id : idx}" id="required-${q.question_id !== undefined ? q.question_id : idx}">
                                    <label for="required-${q.question_id !== undefined ? q.question_id : idx}"></label>
                                </div>
                                <span class="toggle-label">Required</span>
                            </div>
                        </div>
                        <div class="vertical-divider" style="height:40px;width:1px;background:#d0d4db;margin:0 18px;"></div>
                        <div class="delete-btn-container" style="flex:3;display:flex;justify-content:center;align-items:center;">
                            <button class="btn danger delete-question" data-id="${q.question_id !== undefined ? q.question_id : idx}" style="margin:0 0 0 0;width:90%;"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    </div>
                </div>
                <div class="sub-questions-container" data-question-id="${q.question_id !== undefined ? q.question_id : idx}" style="display: none; margin-top: 20px;">
                    <div class="sub-questions-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                        <h4 style="margin: 0; color: #4e73df; font-size: 16px;">
                            <i class="fas fa-list"></i> Sub-Questions
                        </h4>
                        <button type="button" class="btn btn-xs btn-outline close-subquestions-btn" data-question-id="${q.question_id !== undefined ? q.question_id : idx}" style="white-space: nowrap;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="sub-questions-list" data-question-id="${q.question_id !== undefined ? q.question_id : idx}">
                        <!-- Sub-questions will be added here -->
                    </div>
                    <button type="button" class="btn btn-sm secondary add-subquestion-item-btn" data-question-id="${q.question_id !== undefined ? q.question_id : idx}" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> Add Sub-Question
                    </button>
                </div>
            `;
            questionsContainer.appendChild(card);
            // --- Robust event handlers: update and persist on every change ---
            card.querySelector('.question-text').addEventListener('input', function() {
                if (currentTopic.questions[idx]) {
                    currentTopic.questions[idx].question_text = this.value;
                    persistCurrentTopic();
                }
            });
            // Material Design dropdown event handlers
            const answerTypeSelect = card.querySelector('.answer-type');
            if (answerTypeSelect) {
                answerTypeSelect.addEventListener('change', function() {
                    if (currentTopic.questions[idx]) {
                        currentTopic.questions[idx].answer_type = this.value;
                        persistCurrentTopic();
                    }
                });
            }
            card.querySelector('.is-required').addEventListener('change', function() {
                if (currentTopic.questions[idx]) {
                    currentTopic.questions[idx].is_required = this.checked;
                    persistCurrentTopic();
                }
            });
            card.querySelectorAll('.choice-label').forEach((input, i) => {
                input.addEventListener('input', function() {
                    if (currentTopic.questions[idx]) {
                        currentTopic.questions[idx].choices[i] = this.value;
                        persistCurrentTopic();
                    }
                });
            });
            card.querySelectorAll('.remove-choice').forEach((btn, i) => {
                btn.addEventListener('click', function() {
                    if (currentTopic.questions[idx]) {
                        currentTopic.questions[idx].choices.splice(i, 1);
                        persistCurrentTopic();
                    }
                });
            });
            // --- End robust event handlers ---
            
            // Sub-question event handlers
            card.querySelector('.add-subquestion-btn').addEventListener('click', function() {
                const questionId = this.getAttribute('data-question-id');
                const subQuestionsContainer = card.querySelector('.sub-questions-container');
                subQuestionsContainer.style.display = 'block';
            });
            
            card.querySelector('.close-subquestions-btn').addEventListener('click', function() {
                const questionId = this.getAttribute('data-question-id');
                const subQuestionsContainer = card.querySelector('.sub-questions-container');
                subQuestionsContainer.style.display = 'none';
            });
            
            card.querySelector('.add-subquestion-item-btn').addEventListener('click', function() {
                const questionId = this.getAttribute('data-question-id');
                addSubQuestionItem(questionId, card);
            });
            
            // Existing delete handler remains
            card.querySelector('.delete-question').onclick = function() {
                if (!confirm('Are you sure you want to delete this question?')) {
                    return;
                }
                const questionId = q.question_id;
                const idxToDelete = questions.findIndex(q => (q.question_id) == questionId);
                if (questionId !== undefined && questionId !== null && !isNaN(Number(questionId))) {
                    const xhr = new XMLHttpRequest();
                    xhr.open('DELETE', `/api/questions/${questionId}/`, true);
                    xhr.setRequestHeader('X-CSRFToken', getCookie('csrftoken'));
                    xhr.onload = function() {
                        if (xhr.status === 204 || xhr.status === 200) {
                            questions.splice(idxToDelete, 1);
                            renderQuestions(questions, container);
                            showErrorSnackbar('Question deleted successfully', { background: '#4caf50' });
                        } else {
                            showErrorSnackbar('Failed to delete question', { background: '#f44336' });
                        }
                    };
                    xhr.onerror = function() {
                        showErrorSnackbar('Error deleting question', { background: '#f44336' });
                    };
                    xhr.send();
                } else {
                    questions.splice(idxToDelete, 1);
                    renderQuestions(questions, container);
                }
                persistCurrentTopic();
            };
        });

        if (options.addBtn) {
            section.insertBefore(options.addBtn, questionsContainer);
        }
        if (options.afterRender) options.afterRender(questions, questionsContainer);
    }

    function deleteQuestion(questionId) {
        if (confirm('Are you sure you want to delete this question?')) {
            currentTopic.questions = currentTopic.questions.filter(q => q.question_id != questionId);
            renderQuestions(currentTopic.questions, questionsContainer);
        }
    }

    function addSubQuestionItem(questionId, questionCard) {
        const subQuestionsList = questionCard.querySelector('.sub-questions-list');
        const subQuestionItem = document.createElement('div');
        subQuestionItem.className = 'question-card sub-question-card';
        subQuestionItem.setAttribute('draggable', 'true');
        
        const subQuestionCount = subQuestionsList.children.length + 1;
        const subQuestionId = `sub_${questionId}_${subQuestionCount}`;
        
        subQuestionItem.innerHTML = `
            <div class="question-header" style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                <span class="question-circle sub-question-circle" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;font-size:14px;">${subQuestionCount}</span>
                <span style="font-weight:600;font-size:16px;color:var(--secondary);">Sub-Question ${subQuestionCount}</span>
            </div>
            <div class="question-text-container">
                <div class="section-label" style="font-weight:600;color:var(--primary);margin-bottom:6px;">Sub-Question Text</div>
                <textarea class="question-text" data-id="${subQuestionId}" placeholder="Enter sub-question text"></textarea>
                <div class="inline-error" style="display:none;"></div>
            </div>
            <div class="question-settings-container">
                <div class="section-label" style="font-weight:600;color:var(--primary);margin-bottom:6px;">Sub-Question Settings</div>
                <div class="settings-delete-row" style="display:flex;align-items:center;gap:0;">
                    <div class="grouped-meta" style="flex:7;">
                        <div class="meta-field answer-type-meta">
                            <i class="fas fa-list-alt"></i>
                            <select class="answer-type" data-id="${subQuestionId}">
                                <option value="text" selected>Text</option>
                                <option value="number">Number</option>
                                <option value="date">Date</option>
                                <option value="percentage">Percentage</option>
                            </select>
                        </div>
                        <div class="meta-field required-meta">
                            <i class="fas fa-asterisk"></i>
                            <div class="toggle-switch">
                                <input type="checkbox" class="is-required" checked data-id="${subQuestionId}" id="required-${subQuestionId}">
                                <label for="required-${subQuestionId}"></label>
                            </div>
                            <span class="toggle-label">Required</span>
                        </div>
                    </div>
                    <div class="vertical-divider" style="height:40px;width:1px;background:#d0d4db;margin:0 18px;"></div>
                    <div class="delete-btn-container" style="flex:3;display:flex;justify-content:center;align-items:center;">
                        <button class="btn danger delete-subquestion" data-id="${subQuestionId}" style="margin:0 0 0 0;width:90%;"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            </div>
        `;
        
        subQuestionsList.appendChild(subQuestionItem);
        
        // Add event handlers for sub-question
        subQuestionItem.querySelector('.question-text').addEventListener('input', function() {
            const question = currentTopic.questions.find(q => (q.question_id || q.tempId) == questionId);
            if (question) {
                if (!question.subQuestions) question.subQuestions = [];
                const subQuestionIndex = Array.from(subQuestionsList.children).indexOf(subQuestionItem);
                if (!question.subQuestions[subQuestionIndex]) {
                    question.subQuestions[subQuestionIndex] = {
                        question_text: '',
                        answer_type: 'number',
                        is_required: true,
                        display_order: subQuestionIndex + 1
                    };
                }
                question.subQuestions[subQuestionIndex].question_text = this.value;
                persistCurrentTopic();
            }
        });
        
        // Material Design dropdown event handlers for sub-questions
        const subAnswerTypeSelect = subQuestionItem.querySelector('.answer-type');
        if (subAnswerTypeSelect) {
            subAnswerTypeSelect.addEventListener('change', function() {
                const question = currentTopic.questions.find(q => (q.question_id || q.tempId) == questionId);
                if (question) {
                    if (!question.subQuestions) question.subQuestions = [];
                    const subQuestionIndex = Array.from(subQuestionsList.children).indexOf(subQuestionItem);
                    if (!question.subQuestions[subQuestionIndex]) {
                        question.subQuestions[subQuestionIndex] = {
                            question_text: '',
                            answer_type: 'text',
                            is_required: true,
                            display_order: subQuestionIndex + 1
                        };
                    }
                    question.subQuestions[subQuestionIndex].answer_type = this.value;
                    persistCurrentTopic();
                }
            });
        }
        
        subQuestionItem.querySelector('.is-required').addEventListener('change', function() {
            const question = currentTopic.questions.find(q => (q.question_id || q.tempId) == questionId);
            if (question) {
                if (!question.subQuestions) question.subQuestions = [];
                const subQuestionIndex = Array.from(subQuestionsList.children).indexOf(subQuestionItem);
                if (!question.subQuestions[subQuestionIndex]) {
                    question.subQuestions[subQuestionIndex] = {
                        question_text: '',
                        answer_type: 'number',
                        is_required: true,
                        display_order: subQuestionIndex + 1
                    };
                }
                question.subQuestions[subQuestionIndex].is_required = this.checked;
                persistCurrentTopic();
            }
        });
        
        // Delete sub-question handler (local removal and re-number UI)
        subQuestionItem.querySelector('.delete-subquestion').addEventListener('click', function() {
            if (!confirm('Are you sure you want to delete this sub-question?')) {
                return;
            }
            const question = currentTopic.questions.find(q => (q.question_id || q.tempId) == questionId);
            if (question && question.subQuestions) {
                const subQuestionIndex = Array.from(subQuestionsList.children).indexOf(subQuestionItem);
                question.subQuestions.splice(subQuestionIndex, 1);
            }
            subQuestionItem.remove();
            Array.from(subQuestionsList.children).forEach((el, i) => {
                const circle = el.querySelector('.sub-question-circle');
                if (circle) circle.textContent = (i + 1);
            });
        });
    }

    function addDraftSubQuestionItem(questionId, questionCard) {
        const subQuestionsList = questionCard.querySelector('.sub-questions-list');
        const subQuestionItem = document.createElement('div');
        subQuestionItem.className = 'question-card sub-question-card';
        subQuestionItem.setAttribute('draggable', 'true');
        
        const subQuestionCount = subQuestionsList.children.length + 1;
        const subQuestionId = `sub_${questionId}_${subQuestionCount}`;
        
        subQuestionItem.innerHTML = `
            <div class="question-header" style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                <span class="question-circle sub-question-circle" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;font-size:14px;">${subQuestionCount}</span>
                <span style="font-weight:600;font-size:16px;color:var(--secondary);">Sub-Question ${subQuestionCount}</span>
            </div>
            <div class="question-text-container">
                <div class="section-label" style="font-weight:600;color:var(--primary);margin-bottom:6px;">Sub-Question Text</div>
                <textarea class="question-text" data-id="${subQuestionId}" placeholder="Enter sub-question text"></textarea>
                <div class="inline-error" style="display:none;"></div>
            </div>
            <div class="question-settings-container">
                <div class="section-label" style="font-weight:600;color:var(--primary);margin-bottom:6px;">Sub-Question Settings</div>
                <div class="settings-delete-row" style="display:flex;align-items:center;gap:0;">
                    <div class="grouped-meta" style="flex:7;">
                        <div class="meta-field answer-type-meta">
                            <i class="fas fa-list-alt"></i>
                            <select class="answer-type" data-id="${subQuestionId}">
                                <option value="text" selected>Text</option>
                                <option value="number">Number</option>
                                <option value="date">Date</option>
                                <option value="percentage">Percentage</option>
                            </select>
                        </div>
                        <div class="meta-field required-meta">
                            <i class="fas fa-asterisk"></i>
                            <div class="toggle-switch">
                                <input type="checkbox" class="is-required" checked data-id="${subQuestionId}" id="required-${subQuestionId}">
                                <label for="required-${subQuestionId}"></label>
                            </div>
                            <span class="toggle-label">Required</span>
                        </div>
                    </div>
                    <div class="vertical-divider" style="height:40px;width:1px;background:#d0d4db;margin:0 18px;"></div>
                    <div class="delete-btn-container" style="flex:3;display:flex;justify-content:center;align-items:center;">
                        <button class="btn danger delete-subquestion" data-id="${subQuestionId}" style="margin:0 0 0 0;width:90%;"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            </div>
        `;
        
        subQuestionsList.appendChild(subQuestionItem);
        
        // Set the default dropdown value using our helper function
        setDropdownValue(subQuestionItem, 'text');
        
        // Add event handlers for the new sub-question
        subQuestionItem.querySelector('.delete-subquestion').addEventListener('click', function() {
            subQuestionItem.remove();
        });
        
        // Initialize the sub-question in the questions array
        const mainCard = questionCard;
        const qidx = parseInt(mainCard.getAttribute('data-qidx'), 10);
        if (qidx >= 0 && qidx < window.currentDraftQuestions.length) {
            if (!window.currentDraftQuestions[qidx].sub_questions) {
                window.currentDraftQuestions[qidx].sub_questions = [];
            }
            window.currentDraftQuestions[qidx].sub_questions.push({
                sub_question_text: '',
                answer_type: 'text',
                is_required: true,
                display_order: subQuestionCount
            });
        }
    }

    function prepareQuestionData(question, options = {}) {
        const preparedData = {
            question_text: question.question_text || question.text || '',
            answer_type: question.answer_type || question.type || 'text',
            is_required: question.is_required || question.required || false,
            display_order: question.display_order || question.displayOrder || 1,
            choices: (question.choices || []).filter(c => c && c.trim()),
            answer_description: question.answer_description || '',
            sub_questions: question.subQuestions || []
        };
        if (
            question.question_id &&
            (typeof question.question_id !== 'string' || !question.question_id.startsWith('new_'))
        ) {
            preparedData.question_id = question.question_id;
        }
        if (question.topic_id) preparedData.topic_id = question.topic_id;
        if (options.includeMetadata) {
            if (question.created_at) preparedData.created_at = question.created_at;
            if (question.updated_at) preparedData.updated_at = question.updated_at;
        }
        return preparedData;
    }

    function validateQuestion(questionData, index) {
        const errors = [];
        if (!(questionData.question_text && typeof questionData.question_text === 'string' && questionData.question_text.trim())) {
            errors.push(`Question #${index + 1}: Question text is required`);
        }
        if (!questionData.display_order || questionData.display_order < 1) {
            errors.push(`Question #${index + 1}: Display order must be a positive number`);
        }
        if (questionData.answer_type === 'choice' && (!Array.isArray(questionData.choices) || questionData.choices.length === 0)) {
            errors.push(`Question #${index + 1}: Multiple choice questions must have at least one choice`);
        }
        return errors;
    }

    let saveTimeout = null;
    // --- Real-time validation helpers ---
    function validateRequiredFields() {
        let valid = true;
        // Category, sub-section, topic
        const categoryInput = document.getElementById('category');
        const subSectionInput = document.getElementById('sub-section');
        const topicInput = document.getElementById('topic');
        [categoryInput, subSectionInput, topicInput].forEach(input => {
            if (input && !input.value) {
                input.style.border = '2px solid red';
                valid = false;
            } else if (input) {
                input.style.border = '';
            }
        });
        // Question textareas
        const cards = questionsContainer.querySelectorAll('.question-card');
        cards.forEach(card => {
            const textArea = card.querySelector('.question-text');
            if (textArea && !textArea.value.trim()) {
                textArea.style.border = '2px solid red';
                valid = false;
            } else if (textArea) {
                textArea.style.border = '';
            }
        });
        // Always select the current finish button
        const btn = document.getElementById('finish-topic');
        if (btn) btn.disabled = !valid;
        return valid;
    }

    // Attach real-time validation to all relevant fields
    function attachRealtimeValidation() {
        const categoryInput = document.getElementById('category');
        const subSectionInput = document.getElementById('sub-section');
        const topicInput = document.getElementById('topic');
        if (categoryInput) categoryInput.addEventListener('change', validateRequiredFields);
        if (subSectionInput) subSectionInput.addEventListener('change', validateRequiredFields);
        if (topicInput) topicInput.addEventListener('input', validateRequiredFields);
        // For question textareas, attach on render
        const observer = new MutationObserver(() => {
            const cards = questionsContainer.querySelectorAll('.question-card');
            cards.forEach(card => {
                const textArea = card.querySelector('.question-text');
                if (textArea && !textArea._realtimeValidationAttached) {
                    textArea.addEventListener('input', validateRequiredFields);
                    textArea.addEventListener('blur', validateRequiredFields);
                    textArea._realtimeValidationAttached = true;
                }
            });
        });
        observer.observe(questionsContainer, { childList: true, subtree: true });
    }
    attachRealtimeValidation();

    // --- Patch finishTopicBtn to only allow save if enabled ---
    if (finishTopicBtn && finishTopicBtn.parentNode) {
        const newBtn = finishTopicBtn.cloneNode(true);
        finishTopicBtn.parentNode.replaceChild(newBtn, finishTopicBtn);
        newBtn.onclick = function() {
            if (newBtn.disabled) return;
            const ok = finishCurrentTopic();
            if (ok) saveFormPageState('confirmation');
        };
    }

    // --- Only clear/reset draft after successful save ---
    // (This logic is already correct in the saveTopic success handler)
    // Remove submit-time border highlighting and validation logic from finishCurrentTopic
    function finishCurrentTopic(silent = false) {
        syncQuestionsFromDOM();
        // Only allow save if all required fields are filled
        if (!validateRequiredFields()) return false;
        // Always use fresh DOM queries for topic, category, sub-section
        const topicInputEl = document.getElementById('topic');
        const categorySelectEl = document.getElementById('category');
        const subSectionSelectEl = document.getElementById('sub-section');
        currentTopic.name = topicInputEl ? topicInputEl.value : '';
        currentTopic.category = categorySelectEl && categorySelectEl.selectedIndex > 0 ? categorySelectEl.options[categorySelectEl.selectedIndex].text : '';
        currentTopic.subSection = subSectionSelectEl && subSectionSelectEl.selectedIndex > 0 ? subSectionSelectEl.options[subSectionSelectEl.selectedIndex].text : '';
        const errors = [];
        const preparedQuestions = currentTopic.questions.map((q, idx) => {
            const preparedData = prepareQuestionData(q);
            errors.push(...validateQuestion(preparedData, idx));
            return preparedData;
        });
        if (errors.length > 0) return false;
        const subSectionSelect = document.getElementById('sub-section');
        const topicInput = document.getElementById('topic');
        const sub_section_id = parseInt(subSectionSelect.value, 10);
        const name = topicInput.value;
        const display_order = 1;
        if (isNaN(sub_section_id) || !name.trim() || preparedQuestions.length === 0) return false;
        const payload = { sub_section_id, name, display_order, questions: preparedQuestions };
        // Store display text for confirmation BEFORE save/reset
        const topicName = name;
        const categoryName = categorySelectEl && categorySelectEl.value ? categorySelectEl.options[categorySelectEl.selectedIndex].text : 'No category';
        const subSectionName = subSectionSelectEl && subSectionSelectEl.value ? subSectionSelectEl.options[subSectionSelectEl.selectedIndex].text : 'No sub-section';
        if (silent) return true;
        if (saveTimeout) return false;
        saveTimeout = setTimeout(() => {
            saveTopic(payload).then(data => {
                if (data.success) {
                    clearPersistedCurrentTopic();
                    initForm();
                    // Use stored values for confirmation
                    confirmedTopicName.textContent = topicName;
                    document.getElementById('confirmed-topic-name').nextElementSibling.textContent =
                        `(${categoryName} > ${subSectionName})`;
                    questionsCount.textContent = payload.questions.length;
                    document.querySelectorAll('.step')[1].classList.remove('active');
                    document.querySelectorAll('.step')[2].classList.add('active');
                    topicSection.style.display = 'none';
                    questionsSection.style.display = 'none';
                    confirmationSection.style.display = 'block';
                    loadDraftedQuestionnaires();
                    showErrorSnackbar('Topic and questions saved successfully!', { background: '#4caf50' });
                } else {
                    showErrorSnackbar('Failed to save topic: ' + (data.error || 'Unknown error'));
                }
            }).catch(err => {
                console.error('[finishCurrentTopic] Error:', err);
                showErrorSnackbar('Failed to save topic: ' + (err.message || 'Unknown error'));
            }).finally(() => {
                saveTimeout = null;
            });
        }, 300);
        return true;
    }

    function startNewTopic() {
        const topicInput = document.getElementById('topic');
        if (topicInput) topicInput.value = '';
        currentTopic.questions = [];
        document.querySelectorAll('.step')[2].classList.remove('active');
        document.querySelectorAll('.step')[0].classList.add('active');
        topicSection.style.display = 'block';
        questionsSection.style.display = 'none';
        confirmationSection.style.display = 'none';
        
        // Show draft questionnaire section when starting a new topic (back to step 1)
        const draftsSection = document.querySelector('.drafts-section');
        if (draftsSection) {
            draftsSection.style.display = 'block';
        }
        
        updateTopicContextInfo();
    }

    function finishProcess() {
        initForm();
        document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
        document.querySelectorAll('.step')[0].classList.add('active');
        topicSection.style.display = 'block';
        questionsSection.style.display = 'none';
        confirmationSection.style.display = 'none';
    }

    function editCategory(categoryId) {
        alert(`Editing category with ID: ${categoryId}`);
    }

    function viewTopics(subSectionId, categoryName, subSectionName) {
        saveDraftsPageState({ view: 'topics', subSectionId, categoryName, subSectionName });
        draftsContainer.classList.remove('drafts-container');
        draftsContainer.classList.remove('single-column');
        draftsContainer.innerHTML = `<button class="btn-back" id="back-to-subsections"><i class="fas fa-arrow-left"></i> Back to Sub-sections</button>`;
        
        // Hide "create a new topic" section and step indicator when subsection is selected
        const topicSection = document.getElementById('topic-section');
        if (topicSection) {
            topicSection.style.display = 'none';
        }
        
        const progressContainer = document.querySelector('.progress-container');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
        
        // Fix: Ensure the button event handler is properly attached
        const backButton = document.getElementById('back-to-subsections');
        if (backButton) {
            backButton.onclick = () => {
                localStorage.removeItem('draftsPageState');
                draftsContainer.classList.add('drafts-container');
                draftsContainer.classList.remove('single-column');
                
                // Show "create a new topic" section and step indicator when going back to subsections
                const topicSection = document.getElementById('topic-section');
                if (topicSection) {
                    topicSection.style.display = 'block';
                }
                
                const progressContainer = document.querySelector('.progress-container');
                if (progressContainer) {
                    progressContainer.style.display = 'block';
                }
                
                loadDraftedQuestionnaires();
            };
        }
        fetchTopics(subSectionId).then(topics => {
            if (!Array.isArray(topics) || topics.length === 0) {
                draftsContainer.innerHTML += `
                    <div class="modern-section">
                        <div class="section-header">
                            <div class="section-icon">
                                <i class="fas fa-folder-open"></i>
                            </div>
                            <div class="section-title">
                                <h3>No Topics Found</h3>
                                <p class="section-description">No topics have been created for this sub-section yet.</p>
                            </div>
                        </div>
                    </div>
                `;
                return;
            }
            draftsContainer.innerHTML += `
                <div class="modern-section">
                    <div class="section-header">
                        <div class="section-icon">
                            <i class="fas fa-list-ul"></i>
                        </div>
                        <div class="section-title">
                            <h3>Select a Topic</h3>
                            <p class="section-description">Choose a topic to view and edit its questions.</p>
                        </div>
                    </div>
                    <div class="modern-grid">
                        ${topics.map(topic => `
                            <div class="topic-selection-card topic-clickable" data-topic-id="${topic.topic_id}" data-topic-name="${topic.name}">
                                <div class="topic-card-header">
                                    <div class="topic-card-icon">
                                        <i class="fas fa-file-alt"></i>
                                    </div>
                                    <div class="topic-card-content">
                                        <h4 class="topic-card-title">${topic.name}</h4>
                                        <p class="topic-card-description">Click to view and edit questions</p>
                                    </div>
                                </div>
                                <div class="topic-card-actions">
                                    <button class="btn-icon rename-topic" data-id="${topic.topic_id}" title="Rename topic">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn-icon delete-topic" data-id="${topic.topic_id}" title="Delete topic">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            draftsContainer.querySelectorAll('.topic-clickable').forEach(topicDiv => {
                topicDiv.addEventListener('click', function(e) {
                    if (e.target.closest('.rename-topic') || e.target.closest('.delete-topic')) return;
                    const topicId = this.getAttribute('data-topic-id');
                    viewDraftQuestions(topicId, subSectionId, categoryName, this.getAttribute('data-topic-name'), subSectionName);
                });
            });
            draftsContainer.querySelectorAll('.rename-topic').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const topicId = this.getAttribute('data-id');
                    const card = this.closest('.category-card');
                    const labelDiv = card.querySelector('.topic-label');
                    const oldName = labelDiv.textContent;
                    labelDiv.innerHTML = `<input type="text" class="rename-input" value="${oldName}" style="width: 180px;"> <button class="btn btn-inline primary save-rename">Save</button> <button class="btn btn-inline outline cancel-rename">Cancel</button>`;
                    const input = labelDiv.querySelector('.rename-input');
                    if (input) input.focus();
                    labelDiv.querySelector('.save-rename').onclick = function(ev) {
                        ev.stopPropagation();
                        const newName = input.value.trim();
                        if (newName && newName !== oldName) {
                            renameTopic(topicId, newName).then(() => viewTopics(subSectionId, categoryName, subSectionName));
                        } else {
                            labelDiv.textContent = oldName;
                        }
                    };
                    labelDiv.querySelector('.cancel-rename').onclick = function(ev) {
                        ev.stopPropagation();
                        labelDiv.textContent = oldName;
                    };
                    input.onkeydown = function(ev) {
                        if (ev.key === 'Enter') labelDiv.querySelector('.save-rename').click();
                        if (ev.key === 'Escape') labelDiv.querySelector('.cancel-rename').click();
                    };
                });
            });
            draftsContainer.querySelectorAll('.delete-topic').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const topicId = this.getAttribute('data-id');
                    if (confirm('Are you sure you want to delete this topic?')) {
                        deleteTopic(topicId).then(() => viewTopics(subSectionId, categoryName, subSectionName));
                    }
                });
            });
        }).catch(err => console.error('Failed to load topics:', err));
    }

    let lastDeletedQuestion = null;
    let lastDeletedIndex = null;
    let undoTimeout = null;
    let undoSnackbar = null;

    function showDeleteModal(onConfirm) {
        // Remove any previous overlay if exists
        let overlay = document.querySelector('.modal-overlay');
        if (overlay) {
            document.body.removeChild(overlay);
        }
        overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal author-dialog">
                <h4>Delete Question?</h4>
                <div>Are you sure you want to delete this question? This cannot be undone.</div>
                <div class="modal-actions">
                    <button class="btn danger confirm-delete">Delete</button>
                    <button class="btn secondary cancel-delete">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.confirm-delete').onclick = () => {
            onConfirm();
            document.body.removeChild(overlay);
        };
        overlay.querySelector('.cancel-delete').onclick = () => {
            document.body.removeChild(overlay);
        };
    }

    /**
     * Show the delete confirmation modal for a question.
     */
    function showDeleteQuestionDetailsModal(question, onConfirm) {
        // Remove any previous overlay if exists
        let overlay = document.querySelector('.modal-overlay');
        if (overlay) {
            document.body.removeChild(overlay);
        }
        overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal author-dialog">
                <h4>Delete Question?</h4>
                <div style="margin-bottom:10px;">
                    <strong>ID:</strong> ${(question.question_id && !isNaN(Number(question.question_id))) ? question.question_id : '(unsaved)'}<br>
                    <strong>Text:</strong> ${question.question_text || question.text}<br>
                    <strong>Type:</strong> ${question.answer_type || question.type}<br>
                    <strong>Required:</strong> ${(question.is_required || question.required) ? 'Yes' : 'No'}<br>
                    <strong>Display Order:</strong> ${question.display_order || question.displayOrder}<br>
                    <strong>Choices:</strong> ${(question.choices || []).join(', ')}
                </div>
                <div>Are you sure you want to delete this question? This cannot be undone.</div>
                <div class="modal-actions">
                    <button class="btn danger confirm-delete">Delete</button>
                    <button class="btn secondary cancel-delete">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.confirm-delete').onclick = () => {
            onConfirm();
            document.body.removeChild(overlay);
        };
        overlay.querySelector('.cancel-delete').onclick = () => {
            document.body.removeChild(overlay);
        };
    }

    /**
     * Show a temporary snackbar for undoing a delete.
     */
    function showUndoSnackbar(onUndo, onExpire) {
        if (undoSnackbar) {
            document.body.removeChild(undoSnackbar);
            undoSnackbar = null;
        }
        undoSnackbar = document.createElement('div');
        undoSnackbar.className = 'undo-snackbar';
        undoSnackbar.style = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:#323232;color:#fff;padding:16px 32px;border-radius:6px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:flex;align-items:center;gap:16px;font-size:16px;';
        undoSnackbar.innerHTML = `Question deleted. <button class="btn btn-sm secondary" style="background:#fff;color:#323232;border-radius:4px;font-weight:600;">Undo</button>`;
        document.body.appendChild(undoSnackbar);
        undoSnackbar.querySelector('button').onclick = function() {
            if (undoTimeout) clearTimeout(undoTimeout);
            document.body.removeChild(undoSnackbar);
            undoSnackbar = null;
            onUndo();
        };
        undoTimeout = setTimeout(() => {
            if (undoSnackbar) {
                document.body.removeChild(undoSnackbar);
                undoSnackbar = null;
            }
            onExpire();
        }, 5000);
    }

    /**
     * Fetch all questions for a topic from the backend.
     */
    function fetchTopicQuestions(topicId) {
        return fetch(`/api/topics/${topicId}/questions/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch questions');
            }
            return response.json();
        });
    }

    /**
     * Load and render questions for a topic in the drafts section.
     */
    function viewDraftQuestions(topicId, subSectionId, categoryName, topicName, subSectionName) {
        saveDraftsPageState({ view: 'editQuestions', topicId, subSectionId, categoryName, topicName, subSectionName });
        // Stack layout for edit mode
        draftsContainer.classList.remove('modern-grid');
        draftsContainer.classList.add('single-column');
        draftsContainer.innerHTML = `<button class="btn-back" id="back-to-topics"><i class="fas fa-arrow-left"></i> Back to Topics</button>`;
        
        // Fix: Ensure the button event handler is properly attached
        const backButton = document.getElementById('back-to-topics');
        if (backButton) {
            backButton.onclick = () => viewTopics(subSectionId, categoryName, subSectionName);
        }
        fetchTopicQuestions(topicId).then(questions => {
            questions = questions.map(q => {
                let realId = (q.question_id !== undefined && q.question_id !== null && !isNaN(Number(q.question_id))) ? String(q.question_id) : undefined;
                return {
                    ...q,
                    question_id: realId,
                    topic_id: q.topic_id ? String(q.topic_id) : topicId
                };
            });
            window.currentDraftQuestions = questions;
            
            // Create modern section header
            draftsContainer.innerHTML += `
                <div class="modern-section">
                    <div class="section-header">
                        <div class="section-icon">
                            <i class="fas fa-edit"></i>
                        </div>
                        <div class="section-title">
                            <h3>Edit Questions</h3>
                            <p class="section-description">Modify question text, types, and settings. Changes are saved automatically.</p>
                        </div>
                        <div class="section-actions" style="margin-left:auto;display:flex;gap:10px;align-items:center;">
                            <button type="button" id="add-question-in-edit" class="btn secondary modern-btn">
                                <i class="fas fa-plus"></i>
                                <span>Add Question</span>
                            </button>
                        </div>
                    </div>
                    <div class="context-info-card">
                        <div class="context-item">
                            <i class="fas fa-file-alt"></i>
                            <span class="context-label">Topic:</span>
                            <span class="context-value">${topicName}</span>
                        </div>
                        <div class="context-separator"></div>
                        <div class="context-item">
                            <i class="fas fa-layer-group"></i>
                            <span class="context-label">Sub-section:</span>
                            <span class="context-value">${subSectionName}</span>
                        </div>
                        <div class="context-separator"></div>
                        <div class="context-item">
                            <i class="fas fa-folder"></i>
                            <span class="context-label">Category:</span>
                            <span class="context-value">${categoryName}</span>
                        </div>
                    </div>
                    <div class="form-actions modern-actions">
                        <button type="button" id="update-all-questions" class="btn primary modern-btn">
                            <i class="fas fa-save"></i>
                            <span>Update All Questions</span>
                        </button>
                    </div>
                </div>
            `;
            
            // Add event listener for update button
            const updateBtn = document.getElementById('update-all-questions');
            updateBtn.onclick = function() {
                // Sync all current input values from DOM to questions array
                const questionsContainer = draftsContainer.querySelector('.questions-container');
                if (questionsContainer) {
                    // Only process main question cards, not sub-question cards
                    const mainQuestionCards = questionsContainer.querySelectorAll('.question-card:not(.sub-question-card)');
                    mainQuestionCards.forEach((card) => {
                        const qidx = parseInt(card.getAttribute('data-qidx'), 10);
                        if (qidx >= 0 && qidx < questions.length) {
                            const textArea = card.querySelector('.question-text');
                            if (textArea) questions[qidx].question_text = textArea.value;
                            const answerTypeSelect = card.querySelector('.answer-type');
                            if (answerTypeSelect) {
                                questions[qidx].answer_type = answerTypeSelect.value;
                            }
                            const displayOrder = card.querySelector('.display-order');
                            if (displayOrder) questions[qidx].display_order = parseInt(displayOrder.value, 10);
                            const isRequired = card.querySelector('.is-required');
                            if (isRequired) questions[qidx].is_required = isRequired.checked;
                            // Choices
                            const choicesInputs = card.querySelectorAll('.choice-label');
                            if (choicesInputs.length) {
                                questions[qidx].choices = Array.from(choicesInputs).map(input => input.value);
                            }
                            
                            // Update sub-questions
                            const subQuestionsList = card.querySelector('.sub-questions-list');
                            if (subQuestionsList) {
                                const subQuestionCards = subQuestionsList.querySelectorAll('.sub-question-card');
                                questions[qidx].sub_questions = Array.from(subQuestionCards).map((subCard, subIdx) => {
                                    const subTextArea = subCard.querySelector('.question-text');
                                    const subIsRequired = subCard.querySelector('.is-required');
                                    
                                    return {
                                        sub_question_id: questions[qidx].sub_questions && questions[qidx].sub_questions[subIdx] ? questions[qidx].sub_questions[subIdx].sub_question_id : undefined,
                                        sub_question_text: subTextArea ? subTextArea.value : '',
                                        answer_type: subIsRequired ? subIsRequired.checked : false,
                                        is_required: subIsRequired ? subIsRequired.checked : false,
                                        display_order: subIdx + 1
                                    };
                                });
                            }
                        }
                    });
                }
                // Send update for each question (could be optimized to batch if backend supports)
                Promise.all(questions.map(q => {
                    if (!q.question_id) return Promise.resolve(); // skip unsaved
                    // collect sub-questions from DOM if visible
                    const card = questionsContainer.querySelector(`.question-card[data-qidx="${questions.indexOf(q)}"]`);
                    let subQuestions = q.sub_questions || [];
                    if (card) {
                        const subList = card.querySelector('.sub-questions-list');
                        if (subList) {
                            subQuestions = Array.from(subList.querySelectorAll('.sub-question-card')).map((subCard, sidx) => {
                                const subTextArea = subCard.querySelector('.question-text');
                                const subIsRequired = subCard.querySelector('.is-required');
                                
                                return {
                                    sub_question_id: (q.sub_questions && q.sub_questions[sidx] && q.sub_questions[sidx].sub_question_id) ? q.sub_questions[sidx].sub_question_id : undefined,
                                    sub_question_text: (subTextArea?.value || '').trim(),
                                    answer_type: subIsRequired ? subIsRequired.checked : false,
                                    is_required: subIsRequired ? subIsRequired.checked : false,
                                    display_order: sidx + 1
                                };
                            }).filter(sq => sq.sub_question_text);
                        }
                    }
                    return updateQuestion(q.question_id, {
                        question_text: q.question_text,
                        answer_type: q.answer_type,
                        is_required: q.is_required,
                        display_order: q.display_order,
                        choices: q.choices,
                        sub_questions: subQuestions,
                        answer_description: q.answer_description || ''
                    }, getCookie('csrftoken'));
                })).then(() => {
                    showErrorSnackbar('All questions updated successfully!', { background: '#4caf50' });
                }).catch(err => {
                    showErrorSnackbar('Failed to update questions: ' + (err.message || 'Unknown error'));
                });
            };

            // Add Question in edit mode (creates on server then refreshes list)
            const addQuestionEditBtn = document.getElementById('add-question-in-edit');
            if (addQuestionEditBtn) {
                addQuestionEditBtn.onclick = function() {
                    const payload = {
                        topic_id: topicId,
                        question_text: 'New question',
                        answer_type: 'text',
                        is_required: false,
                        display_order: (questions?.length || 0) + 1,
                        choices: []
                    };
                    createQuestion(payload, getCookie('csrftoken')).then(() => {
                        return fetchTopicQuestions(topicId);
                    }).then(refreshed => {
                        draftsContainer.innerHTML = `<button class="btn-back" id="back-to-topics"><i class="fas fa-arrow-left"></i> Back to Topics</button>`;
                        
                        // Fix: Ensure the button event handler is properly attached
                        const backButton = document.getElementById('back-to-topics');
                        if (backButton) {
                            backButton.onclick = () => viewTopics(subSectionId, categoryName, subSectionName);
                        }
                        
                        // Re-run the view with fresh data
                        viewDraftQuestions(topicId, subSectionId, categoryName, topicName, subSectionName);
                        showErrorSnackbar('Question added', { background: '#4caf50' });
                    }).catch(err => {
                        showErrorSnackbar('Failed to add question: ' + (err.message || 'Unknown error'));
                    });
                };
            }
            
            const questionsContainer = document.createElement('div');
            questionsContainer.className = 'questions-container';
            draftsContainer.appendChild(questionsContainer);
            window.currentDraftQuestionsContainer = questionsContainer;
            renderEditQuestions(questions, questionsContainer);
            addDraftEditListeners(questions, questionsContainer, topicId);
        }).catch(err => {
            showErrorSnackbar('Failed to load questions: ' + (err.message || 'Unknown error'));
        });
    }

    /**
     * Render questions specifically for the edit interface - using exact same design as Step 2
     */
    function renderEditQuestions(questions, container) {
        if (!Array.isArray(questions)) questions = [];
        
        container.innerHTML = '';
        
        questions.forEach((q, idx) => {
            if (typeof q.answer_description === 'undefined') q.answer_description = '';
            if (q.question_id !== undefined && q.question_id !== null) q.question_id = String(q.question_id);
            
            const card = document.createElement('div');
            card.className = 'question-card';
            card.setAttribute('data-qidx', idx);
            const hasSubQuestions = Array.isArray(q.sub_questions) && q.sub_questions.length > 0;
            
            // Create the basic HTML structure without complex template logic
            card.innerHTML = `
                <div class="question-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span class="question-circle" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#bfc9d1;color:#fff;font-weight:700;font-size:18px;">${idx + 1}</span>
                        <span style="font-weight:700;font-size:18px;color:#222;">Question ${idx + 1}</span>
                    </div>
                    <button type="button" class="btn btn-xs btn-outline add-subquestion-btn sub-question-toggle-btn" data-question-id="${q.question_id !== undefined ? q.question_id : idx}" style="white-space: nowrap;">
                        <i class="fas fa-plus"></i> Sub-Question
                    </button>
                </div>
                <div class="question-text-container">
                    <div class="section-label" style="font-weight:600;color:var(--primary);margin-bottom:6px;">Question Text</div>
                    <textarea class="question-text" data-id="${q.question_id !== undefined ? q.question_id : ''}" placeholder="Enter question text">${q.question_text || q.text || ''}</textarea>
                    <div class="inline-error" style="display:none;"></div>
                </div>
                <div class="question-settings-container">
                    <div class="section-label" style="font-weight:600;color:var(--primary);margin-bottom:6px;">Question Settings</div>
                    <div class="settings-delete-row" style="display:flex;align-items:center;gap:0;">
                        <div class="grouped-meta" style="flex:7;">
                            <div class="meta-field answer-type-meta">
                                <i class="fas fa-list-alt"></i>
                                <select class="answer-type" data-id="${q.question_id !== undefined ? q.question_id : ''}">
                                    <option value="text" ${(q.answer_type === 'text' || !q.answer_type) ? 'selected' : ''}>Text</option>
                                    <option value="number" ${q.answer_type === 'number' ? 'selected' : ''}>Number</option>
                                    <option value="date" ${q.answer_type === 'date' ? 'selected' : ''}>Date</option>
                                    <option value="percentage" ${q.answer_type === 'percentage' ? 'selected' : ''}>Percentage</option>
                                </select>
                            </div>
                            <div class="meta-field required-meta">
                                <i class="fas fa-asterisk"></i>
                                <div class="toggle-switch">
                                    <input type="checkbox" class="is-required" ${(q.is_required || q.required) ? 'checked' : ''} data-id="${q.question_id !== undefined ? q.question_id : idx}" id="required-${q.question_id !== undefined ? q.question_id : idx}">
                                    <label for="required-${q.question_id !== undefined ? q.question_id : idx}"></label>
                                </div>
                                <span class="toggle-label">Required</span>
                            </div>
                        </div>
                        <div class="vertical-divider" style="height:40px;width:1px;background:#d0d4db;margin:0 18px;"></div>
                        <div class="delete-btn-container" style="flex:3;display:flex;justify-content:center;align-items:center;">
                            <button class="btn danger delete-question" data-id="${q.question_id !== undefined ? q.question_id : idx}" style="margin:0 0 0 0;width:90%;"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    </div>
                </div>
                <div class="sub-questions-container" data-question-id="${q.question_id !== undefined ? q.question_id : idx}" style="display: ${hasSubQuestions ? 'block' : 'none'}; margin-top: 20px;">
                    <div class="sub-questions-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                        <h4 style="margin: 0; color: #4e73df; font-size: 16px;">
                            <i class="fas fa-list"></i> Sub-Questions
                        </h4>
                        <button type="button" class="btn btn-xs btn-outline close-subquestions-btn" data-question-id="${q.question_id !== undefined ? q.question_id : idx}" style="white-space: nowrap;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="sub-questions-list" data-question-id="${q.question_id !== undefined ? q.question_id : idx}">
                        ${q.sub_questions && q.sub_questions.length > 0 ? q.sub_questions.map((subQ, subIdx) => `
                            <div class="question-card sub-question-card" data-sub-id="${subIdx}">
                                <div class="question-header" style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                                    <span class="question-circle sub-question-circle" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;font-size:14px;">${subIdx + 1}</span>
                                    <span style="font-weight:600;font-size:16px;color:var(--secondary);">Sub-Question ${subIdx + 1}</span>
                                </div>
                                <div class="question-text-container">
                                    <div class="section-label" style="font-weight:600;color:var(--primary);margin-bottom:6px;">Sub-Question Text</div>
                                    <textarea class="question-text" data-id="${subQ.sub_question_id || ''}" placeholder="Enter sub-question text">${subQ.sub_question_text || ''}</textarea>
                                    <div class="inline-error" style="display:none;"></div>
                                </div>
                                <div class="question-settings-container">
                                    <div class="section-label" style="font-weight:600;color:var(--primary);margin-bottom:6px;">Sub-Question Settings</div>
                                    <div class="settings-delete-row" style="display:flex;align-items:center;gap:0;">
                                        <div class="grouped-meta" style="flex:7;">
                                            <div class="meta-field answer-type-meta">
                                                <i class="fas fa-list-alt"></i>
                                                <select class="answer-type" data-id="${subQ.sub_question_id || ''}">
                                                    <option value="text" selected>Text</option>
                                                    <option value="number">Number</option>
                                                    <option value="date">Date</option>
                                                    <option value="percentage">Percentage</option>
                                                </select>
                                            </div>
                                            <div class="meta-field required-meta">
                                                <i class="fas fa-asterisk"></i>
                                                <div class="toggle-switch">
                                                    <input type="checkbox" class="is-required" ${subQ.is_required ? 'checked' : ''} data-id="${subQ.sub_question_id || ''}" id="required-${q.question_id !== undefined ? q.question_id : idx}-${subIdx}">
                                                    <label for="required-${q.question_id !== undefined ? q.question_id : idx}-${subIdx}"></label>
                                                </div>
                                                <span class="toggle-label">Required</span>
                                            </div>
                                        </div>
                                        <div class="vertical-divider" style="height:40px;width:1px;background:#d0d4db;margin:0 18px;"></div>
                                        <div class="delete-btn-container" style="flex:3;display:flex;justify-content:center;align-items:center;">
                                            <button class="btn danger delete-subquestion" data-id="${subQ.sub_question_id || ''}" style="margin:0 0 0 0;width:90%;"><i class="fas fa-trash"></i> Delete</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('') : ''}
                    </div>
                    <button type="button" class="btn btn-sm secondary add-subquestion-item-btn" data-question-id="${q.question_id !== undefined ? q.question_id : idx}" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> Add Sub-Question
                    </button>
                </div>
            `;
            
            // Set initial native select value if present
            const initialSelect = card.querySelector('select.answer-type');
            if (initialSelect && q.answer_type) {
                initialSelect.value = q.answer_type;
            }
            // Set sub-question select values
            if (q.sub_questions && q.sub_questions.length > 0) {
                q.sub_questions.forEach((subQ, subIdx) => {
                    const subCard = card.querySelector(`.sub-question-card[data-sub-id="${subIdx}"]`);
                    if (subCard) {
                        const subSelect = subCard.querySelector('select.answer-type');
                        if (subSelect && subQ.answer_type) subSelect.value = subQ.answer_type;
                    }
                });
            }
            
            container.appendChild(card);
        });
    }
    
    /**
     * Simple function to set dropdown value directly
     */
    function setDropdownValue(card, value) {
        const materialDropdown = card.querySelector('.material-dropdown');
        if (materialDropdown && value) {
            // Update the display value
            const valueSpan = materialDropdown.querySelector('.material-dropdown-value');
            if (valueSpan) {
                valueSpan.textContent = getAnswerTypeLabel(value);
            }
            
            // Update selected state
            const items = materialDropdown.querySelectorAll('.material-dropdown-item');
            items.forEach(item => {
                item.classList.remove('selected');
                if (item.getAttribute('data-value') === value) {
                    item.classList.add('selected');
                }
            });
        }
    }

    function addDraftEditListeners(questions, questionsContainer, topicId) {
        let saveTimeout = null;
        
        // Add sub-question toggle and add handlers
        questionsContainer.querySelectorAll('.add-subquestion-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const questionId = this.getAttribute('data-question-id');
                const card = this.closest('.question-card');
                const subQuestionsContainer = card.querySelector('.sub-questions-container');
                if (subQuestionsContainer) {
                    subQuestionsContainer.style.display = 'block';
                }
            });
        });
        
        questionsContainer.querySelectorAll('.close-subquestions-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const questionId = this.getAttribute('data-question-id');
                const card = this.closest('.question-card');
                const subQuestionsContainer = card.querySelector('.sub-questions-container');
                if (subQuestionsContainer) {
                    subQuestionsContainer.style.display = 'none';
                }
            });
        });
        
        questionsContainer.querySelectorAll('.add-subquestion-item-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const questionId = this.getAttribute('data-question-id');
                const card = this.closest('.question-card');
                addDraftSubQuestionItem(questionId, card);
            });
        });
        
        // Delete sub-question handlers (updated for new structure)
        questionsContainer.querySelectorAll('.delete-subquestion').forEach(btn => {
            btn.addEventListener('click', function() {
                const subId = this.getAttribute('data-id');
                const subCard = this.closest('.sub-question-card');
                const subList = subCard.closest('.sub-questions-list');
                const mainCard = subCard.closest('.question-card:not(.sub-question-card)');
                const questionId = mainCard.querySelector('.add-subquestion-btn').getAttribute('data-question-id');
                
                if (confirm('Are you sure you want to delete this sub-question?')) {
                    // Find the question in the questions array
                    const qidx = parseInt(mainCard.getAttribute('data-qidx'), 10);
                    if (qidx >= 0 && qidx < questions.length && questions[qidx].sub_questions) {
                        const subIdx = Array.from(subList.children).indexOf(subCard);
                        questions[qidx].sub_questions.splice(subIdx, 1);
                    }
                    subCard.remove();
                    // Re-number remaining sub-questions
                    Array.from(subList.children).forEach((el, i) => {
                        const circle = el.querySelector('.sub-question-circle');
                        if (circle) circle.textContent = (i + 1);
                    });
                }
            });
        });
        
        // Main question text handlers
        questionsContainer.querySelectorAll('.question-card:not(.sub-question-card) .question-text').forEach(input => {
            input.addEventListener('input', function() {
                const card = this.closest('.question-card');
                const qidx = parseInt(card.getAttribute('data-qidx'), 10);
                if (qidx >= 0 && qidx < questions.length) {
                    questions[qidx].question_text = this.value;
                }
                const errorDiv = this.parentElement.querySelector('.inline-error');
                if (!this.value.trim()) {
                    errorDiv.textContent = 'Question text is required.';
                    errorDiv.style.display = '';
                } else {
                    errorDiv.textContent = '';
                    errorDiv.style.display = 'none';
                }
            });
        });
        
        // Main question answer type handlers
        questionsContainer.querySelectorAll('.question-card:not(.sub-question-card) select.answer-type').forEach(selectEl => {
            selectEl.addEventListener('change', function() {
                const card = this.closest('.question-card');
                const qidx = parseInt(card.getAttribute('data-qidx'), 10);
                if (qidx >= 0 && qidx < questions.length) {
                    questions[qidx].answer_type = this.value;
                    persistCurrentTopic();
                }
            });
        });
        
        // Main question required toggle handlers
        questionsContainer.querySelectorAll('.question-card:not(.sub-question-card) .is-required').forEach(input => {
            input.addEventListener('change', function() {
                const card = this.closest('.question-card');
                const qidx = parseInt(card.getAttribute('data-qidx'), 10);
                if (qidx >= 0 && qidx < questions.length) {
                    questions[qidx].is_required = this.checked;
                }
            });
        });
        
        // Sub-question text handlers
        questionsContainer.querySelectorAll('.sub-question-card .question-text').forEach(input => {
            input.addEventListener('input', function() {
                const subCard = this.closest('.sub-question-card');
                const subList = subCard.closest('.sub-questions-list');
                const mainCard = subCard.closest('.question-card:not(.sub-question-card)');
                const qidx = parseInt(mainCard.getAttribute('data-qidx'), 10);
                
                if (qidx >= 0 && qidx < questions.length) {
                    if (!questions[qidx].sub_questions) questions[qidx].sub_questions = [];
                    const subIdx = Array.from(subList.children).indexOf(subCard);
                    if (subIdx >= 0) {
                        if (!questions[qidx].sub_questions[subIdx]) {
                            questions[qidx].sub_questions[subIdx] = {
                                sub_question_text: '',
                                answer_type: 'text',
                                is_required: false,
                                display_order: subIdx + 1
                            };
                        }
                        questions[qidx].sub_questions[subIdx].sub_question_text = this.value;
                    }
                }
            });
        });
        
        // Sub-question answer type handlers
        questionsContainer.querySelectorAll('.sub-question-card select.answer-type').forEach(selectEl => {
            selectEl.addEventListener('change', function() {
                const subCard = this.closest('.sub-question-card');
                const subList = subCard.closest('.sub-questions-list');
                const mainCard = subCard.closest('.question-card:not(.sub-question-card)');
                const qidx = parseInt(mainCard.getAttribute('data-qidx'), 10);
                const subIdx = Array.from(subList.children).indexOf(subCard);
                if (qidx >= 0 && qidx < questions.length) {
                    if (!questions[qidx].sub_questions) questions[qidx].sub_questions = [];
                    if (!questions[qidx].sub_questions[subIdx]) {
                        questions[qidx].sub_questions[subIdx] = {
                            sub_question_text: '',
                            answer_type: 'text',
                            is_required: false,
                            display_order: subIdx + 1
                        };
                    }
                    questions[qidx].sub_questions[subIdx].answer_type = this.value;
                    persistCurrentTopic();
                }
            });
        });
        
        // Sub-question required toggle handlers
        questionsContainer.querySelectorAll('.sub-question-card .is-required').forEach(input => {
            input.addEventListener('change', function() {
                const subCard = this.closest('.sub-question-card');
                const subList = subCard.closest('.sub-questions-list');
                const mainCard = subCard.closest('.question-card:not(.sub-question-card)');
                const qidx = parseInt(mainCard.getAttribute('data-qidx'), 10);
                
                if (qidx >= 0 && qidx < questions.length) {
                    if (!questions[qidx].sub_questions) questions[qidx].sub_questions = [];
                    const subIdx = Array.from(subList.children).indexOf(subCard);
                    if (subIdx >= 0) {
                        if (!questions[qidx].sub_questions[subIdx]) {
                            questions[qidx].sub_questions[subIdx] = {
                                sub_question_text: '',
                                answer_type: 'text',
                                is_required: false,
                                display_order: subIdx + 1
                            };
                        }
                        questions[qidx].sub_questions[subIdx].is_required = this.checked;
                    }
                }
            });
        });

        questionsContainer.querySelectorAll('.delete-question').forEach(btn => {
            btn.onclick = function() {
                const qid = this.dataset.id;
                const question = questions.find(q => q.question_id == qid);
                showDeleteQuestionDetailsModal(question, () => {
                    const idx = questions.findIndex(q => q.question_id == qid);
                    const deletedQ = questions[idx];
                    questions.splice(idx, 1);
                    lastDeletedQuestion = deletedQ;
                    lastDeletedIndex = idx;
                    // Only update UI locally, do not call viewDraftQuestions with undefined topic_id
                    if (qid.startsWith('new_')) {
                        showUndoSnackbar(() => {
                            questions.splice(lastDeletedIndex, 0, lastDeletedQuestion);
                            renderQuestions(questions, questionsContainer);
                            lastDeletedQuestion = null;
                            lastDeletedIndex = null;
                        }, () => {
                            lastDeletedQuestion = null;
                            lastDeletedIndex = null;
                        });
                    } else {
                        deleteQuestionAPI(qid, getCookie('csrftoken')).then(data => {
                            if (data.success) {
                                // Remove from array and re-render UI
                                questions.splice(idx, 1);
                                renderQuestions(questions, questionsContainer);
                                showErrorSnackbar('Question deleted successfully', { background: '#4caf50' });
                            } else {
                                alert('Failed to delete question: ' + (data.error || 'Unknown error'));
                                questions.splice(lastDeletedIndex, 0, lastDeletedQuestion);
                                viewDraftQuestions(questions[0]?.topic_id);
                            }
                            lastDeletedQuestion = null;
                            lastDeletedIndex = null;
                        }, () => {
                            lastDeletedQuestion = null;
                            lastDeletedIndex = null;
                        });
                    }
                });
            };
        });
        questionsContainer.querySelectorAll('.display-order').forEach(input => {
            input.oninput = function() {
                const q = questions.find(q => q.question_id == this.dataset.id);
                const errorDiv = this.parentElement.querySelector('.inline-error');
                let newOrder = parseInt(this.value, 10);
                if (isNaN(newOrder) || newOrder < 1) {
                    errorDiv.textContent = 'Display order must be a positive integer.';
                    errorDiv.style.display = '';
                } else if (questions.some(qq => qq.display_order == newOrder && qq.question_id != q.question_id)) {
                    errorDiv.textContent = 'Display order already taken.';
                    errorDiv.style.display = '';
                } else {
                    errorDiv.textContent = '';
                    errorDiv.style.display = 'none';
                }
            };
        });
        questionsContainer.querySelectorAll('.choices-list').forEach(list => {
            list.querySelectorAll('.choice-label').forEach(input => {
                input.oninput = function() {
                    const q = questions.find(q => q.question_id == this.dataset.qid);
                    const errorDiv = this.parentElement.parentElement.querySelector('.inline-error');
                    if (!this.value.trim()) {
                        errorDiv.textContent = 'Choice label is required.';
                        errorDiv.style.display = '';
                    } else {
                        errorDiv.textContent = '';
                        errorDiv.style.display = 'none';
                    }
                };
            });
        });
        // Save functionality removed as it's handled by finish topic
        questionsContainer.querySelectorAll('.delete-question').forEach(btn => {
            btn.onclick = function() {
                const qid = this.dataset.id;
                const question = questions.find(q => q.question_id == qid);
                showDeleteQuestionDetailsModal(question, () => {
                    const idx = questions.findIndex(q => q.question_id == qid);
                    const deletedQ = questions[idx];
                    questions.splice(idx, 1);
                    lastDeletedQuestion = deletedQ;
                    lastDeletedIndex = idx;
                    viewDraftQuestions(questions[0]?.topic_id);
                    if (qid.startsWith('new_')) {
                        showUndoSnackbar(() => {
                            questions.splice(lastDeletedIndex, 0, lastDeletedQuestion);
                            viewDraftQuestions(questions[0]?.topic_id);
                            lastDeletedQuestion = null;
                            lastDeletedIndex = null;
                        }, () => {
                            lastDeletedQuestion = null;
                            lastDeletedIndex = null;
                        });
                    } else {
                        showUndoSnackbar(() => {
                            questions.splice(lastDeletedIndex, 0, lastDeletedQuestion);
                            viewDraftQuestions(questions[0]?.topic_id);
                            lastDeletedQuestion = null;
                            lastDeletedIndex = null;
                        }, () => {
                            deleteQuestionAPI(qid, getCookie('csrftoken')).then(data => {
                                if (!data.success) {
                                    alert('Failed to delete question: ' + (data.error || 'Unknown error'));
                                    questions.splice(lastDeletedIndex, 0, lastDeletedQuestion);
                                    viewDraftQuestions(questions[0]?.topic_id);
                                }
                                lastDeletedQuestion = null;
                                lastDeletedIndex = null;
                            });
                        });
                    }
                });
            };
        });
    }

    function openSidebar() {
        document.body.classList.add('sidebar-open');
        if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'true');
        if (sidebar) sidebar.focus();
        if (sidebarOverlay) sidebarOverlay.style.display = 'block';
    }

    function closeSidebar() {
        document.body.classList.remove('sidebar-open');
        if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
        if (sidebarOverlay) sidebarOverlay.style.display = 'none';
        if (sidebarToggle) sidebarToggle.focus();
    }

    function showErrorSnackbar(message, options = {}) {
        let snackbar = document.getElementById('global-error-snackbar');
        if (!snackbar) {
            snackbar = document.createElement('div');
            snackbar.id = 'global-error-snackbar';
            snackbar.style.position = 'fixed';
            snackbar.style.bottom = '32px';
            snackbar.style.left = '50%';
            snackbar.style.transform = 'translateX(-50%)';
            snackbar.style.background = options.background || '#d32f2f';
            snackbar.style.color = '#fff';
            snackbar.style.padding = '16px 32px';
            snackbar.style.borderRadius = '6px';
            snackbar.style.zIndex = '99999';
            snackbar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            snackbar.style.fontSize = '16px';
            snackbar.style.display = 'flex';
            snackbar.style.alignItems = 'center';
            snackbar.style.gap = '16px';
            snackbar.innerHTML = `<span>${message}</span><button style="background:#fff;color:#323232;padding:4px 16px;border-radius:4px;font-weight:600;border:none;cursor:pointer;">Dismiss</button>`;
            document.body.appendChild(snackbar);
            snackbar.querySelector('button').onclick = function() {
                snackbar.style.display = 'none';
            };
        } else {
            snackbar.querySelector('span').textContent = message;
            snackbar.style.display = 'flex';
        }
        setTimeout(() => {
            snackbar.style.display = 'none';
        }, options.duration || 7000);
    }

    document.addEventListener('click', function(e) {
        const addChoiceBtn = e.target.closest('.add-choice');
        if (addChoiceBtn) {
            const questionId = addChoiceBtn.dataset.qid;
            addChoice(questionId);
        }
    });

    // --- Input Persistence for Unsaved Questions ---
    const LOCAL_STORAGE_KEY = 'unsavedTopicQuestions';

    function persistCurrentTopic() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentTopic));
        } catch (e) {
            // Ignore quota errors
        }
    }

    function restoreCurrentTopic() {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!data) return;
        try {
            const parsed = JSON.parse(data);
            if (parsed && typeof parsed === 'object') {
                // Normalize questions
                if (Array.isArray(parsed.questions)) {
                    parsed.questions = parsed.questions.map(q => ({
                        question_text: q.question_text || q.text || '',
                        answer_type: q.answer_type || q.type || 'text',
                        is_required: typeof q.is_required !== 'undefined' ? q.is_required : (q.required || false),
                        display_order: q.display_order || q.displayOrder || 1,
                        choices: Array.isArray(q.choices) ? q.choices : [],
                        answer_description: q.answer_description || '',
                        question_id: q.question_id || undefined,
                        topic_id: q.topic_id || undefined
                    }));
                }
                currentTopic = parsed;
                // Restore UI
                const categorySelect = document.getElementById('category');
                const subSectionSelect = document.getElementById('sub-section');
                const topicInput = document.getElementById('topic');
                if (categorySelect && parsed.category) {
                    for (let i = 0; i < categorySelect.options.length; i++) {
                        if (categorySelect.options[i].text === parsed.category) {
                            categorySelect.selectedIndex = i;
                            break;
                        }
                    }
                }
                if (subSectionSelect && parsed.subSection && categorySelect) {
                    // Fetch sub-sections for the selected category, then set the sub-section value
                    const selectedCategoryOption = categorySelect.options[categorySelect.selectedIndex];
                    const selectedCategoryId = selectedCategoryOption ? selectedCategoryOption.value : null;
                    if (selectedCategoryId) {
                        fetchSubSections(selectedCategoryId).then(subSections => {
                            subSectionSelect.innerHTML = '<option value="">Select a sub-section</option>';
                            if (!Array.isArray(subSections)) subSections = [];
                            subSections.forEach(sub => {
                                const option = document.createElement('option');
                                option.value = sub.sub_section_id || sub.id || sub.pk;
                                option.textContent = sub.name;
                                subSectionSelect.appendChild(option);
                            });
                    for (let i = 0; i < subSectionSelect.options.length; i++) {
                        if (subSectionSelect.options[i].text === parsed.subSection) {
                            subSectionSelect.selectedIndex = i;
                            break;
                        }
                    }
                            // Now restore topic name and questions
                            if (topicInput && parsed.name) {
                                topicInput.value = parsed.name;
                            }
                            renderQuestions(currentTopic.questions, questionsContainer);
                            updateTopicContextInfo();
                        });
                        return; // Wait for async sub-section restore
                    }
                }
                // If no async needed, restore topic and questions immediately
                if (topicInput && parsed.name) {
                    topicInput.value = parsed.name;
                }
                renderQuestions(currentTopic.questions, questionsContainer);
                updateTopicContextInfo();
            }
        } catch (e) {
            // Ignore parse errors
        }
    }

    function clearPersistedCurrentTopic() {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }

    // --- Sync DOM to Data before re-rendering ---
    function syncQuestionsFromDOM() {
        const cards = questionsContainer.querySelectorAll('.question-card');
        cards.forEach(card => {
            const qidx = parseInt(card.getAttribute('data-qidx'), 10);
            if (isNaN(qidx) || !currentTopic.questions[qidx]) return;
            const textArea = card.querySelector('.question-text');
            if (textArea) currentTopic.questions[qidx].question_text = textArea.value;
            const answerTypeSelect = card.querySelector('.answer-type');
            if (answerTypeSelect) {
                currentTopic.questions[qidx].answer_type = answerTypeSelect.value;
            }
            const displayOrder = card.querySelector('.display-order');
            if (displayOrder) currentTopic.questions[qidx].display_order = parseInt(displayOrder.value, 10);
            const isRequired = card.querySelector('.is-required');
            if (isRequired) currentTopic.questions[qidx].is_required = isRequired.checked;
            // Choices
            const choicesInputs = card.querySelectorAll('.choice-label');
            if (choicesInputs.length) {
                currentTopic.questions[qidx].choices = Array.from(choicesInputs).map(input => input.value);
            }
        });
    }

    // Patch addNewQuestion to sync before adding
    const originalAddNewQuestion2 = addNewQuestion;
    addNewQuestion = function() {
        syncQuestionsFromDOM();
        originalAddNewQuestion2.apply(this, arguments);
    };

    // Patch toggleChoicesContainer to sync before changing type
    const originalToggleChoicesContainer = toggleChoicesContainer;
    toggleChoicesContainer = function(questionId, type) {
        syncQuestionsFromDOM();
        originalToggleChoicesContainer.apply(this, arguments);
    };

    // Patch updateQuestionText
    const originalUpdateQuestionText = updateQuestionText;
    updateQuestionText = function(questionId, text) {
        originalUpdateQuestionText.apply(this, arguments);
        persistCurrentTopic();
    };

    // Patch updateQuestionRequired
    const originalUpdateQuestionRequired = updateQuestionRequired;
    updateQuestionRequired = function(questionId, isRequired) {
        originalUpdateQuestionRequired.apply(this, arguments);
        persistCurrentTopic();
    };

    // Patch updateDisplayOrder
    const originalUpdateDisplayOrder = updateDisplayOrder;
    updateDisplayOrder = function(questionId, newOrder) {
        originalUpdateDisplayOrder.apply(this, arguments);
        persistCurrentTopic();
    };

    // Patch updateChoiceLabel
    const originalUpdateChoiceLabel = updateChoiceLabel;
    updateChoiceLabel = function(questionId, choiceIndex, newLabel) {
        originalUpdateChoiceLabel.apply(this, arguments);
        persistCurrentTopic();
    };

    // Patch removeChoice
    const originalRemoveChoice = removeChoice;
    removeChoice = function(questionId, choiceIndex) {
        originalRemoveChoice.apply(this, arguments);
        persistCurrentTopic();
    };

    // Patch deleteQuestion (local removal)
    const originalDeleteQuestion = deleteQuestion;
    deleteQuestion = function(questionId) {
        originalDeleteQuestion.apply(this, arguments);
        persistCurrentTopic();
    };

    // When finishing/saving topic, clear persisted data
    const originalFinishCurrentTopic = finishCurrentTopic;
    finishCurrentTopic = function(silent = false) {
        const result = originalFinishCurrentTopic.apply(this, arguments);
        if (!silent) {
            clearPersistedCurrentTopic();
            initForm();
        }
        return result;
    };

    // Also clear on startNewTopic and finishProcess
    const originalStartNewTopic = startNewTopic;
    startNewTopic = function() {
        originalStartNewTopic.apply(this, arguments);
        clearPersistedCurrentTopic();
    };
    const originalFinishProcess = finishProcess;
    finishProcess = function() {
        originalFinishProcess.apply(this, arguments);
        clearPersistedCurrentTopic();
    };

    // --- Autocomplete for Topic Input ---
    const topicInput = document.getElementById('topic');
    const topicSuggestions = document.getElementById('topic-suggestions');
    let currentTopicSuggestions = [];
    let selectedTopicId = null;

    function showTopicSuggestions(topics) {
        if (!topicSuggestions) return;
        topicSuggestions.innerHTML = '';
        if (!topics.length) {
            topicSuggestions.style.display = 'none';
            return;
        }
        topics.forEach(topic => {
            const div = document.createElement('div');
            div.className = 'autocomplete-suggestion';
            div.textContent = topic.name;
            div.style.padding = '8px 12px';
            div.style.cursor = 'pointer';
            div.onmousedown = function(e) { // use onmousedown to avoid blur before click
                topicInput.value = topic.name;
                selectedTopicId = topic.topic_id;
                topicSuggestions.style.display = 'none';
                // Set currentTopic for adding question to existing topic
                currentTopic = { category: categorySelect.options[categorySelect.selectedIndex].text, subSection: subSectionSelect.options[subSectionSelect.selectedIndex].text, name: topic.name, topic_id: topic.topic_id, questions: [] };
                // Show add question UI for this topic
                document.getElementById('topic-section').style.display = 'none';
                document.getElementById('questions-section').style.display = 'block';
                document.getElementById('confirmation-section').style.display = 'none';
                // Render a single empty question for adding
                currentTopic.questions = [{
                    question_text: '',
                    answer_type: 'text',
                    is_required: true,
                    display_order: 1,
                    choices: [],
                    answer_description: ''
                }];
                renderQuestions(currentTopic.questions, questionsContainer);
                // Remove the Save Question button if it exists
                let saveBtn = document.getElementById('save-new-question-btn');
                if (saveBtn) saveBtn.remove();
            };
            topicSuggestions.appendChild(div);
        });
        topicSuggestions.style.display = 'block';
    }

    if (topicInput && topicSuggestions && subSectionSelect) {
        let lastSubSectionId = null;
        let lastFetchedTopics = [];
        function fetchAndShowSuggestions() {
            const subSectionId = subSectionSelect.value;
            if (!subSectionId) {
                topicSuggestions.style.display = 'none';
                return;
            }
            // Only fetch if sub-section changed or no cache
            if (lastSubSectionId !== subSectionId) {
                fetchTopics(subSectionId).then(topics => {
                    lastFetchedTopics = topics || [];
                    lastSubSectionId = subSectionId;
                    filterAndShowSuggestions();
                });
            } else {
                filterAndShowSuggestions();
            }
        }
        function filterAndShowSuggestions() {
            const val = topicInput.value.trim().toLowerCase();
            const filtered = lastFetchedTopics.filter(t => t.name.toLowerCase().includes(val));
            showTopicSuggestions(filtered);
        }
        topicInput.addEventListener('focus', fetchAndShowSuggestions);
        topicInput.addEventListener('input', fetchAndShowSuggestions);
        topicInput.addEventListener('blur', function() {
            setTimeout(() => { topicSuggestions.style.display = 'none'; }, 150);
        });
    }

    // When user clicks Next: Add Questions, treat as new topic if not selecting from suggestions
    if (nextToQuestionsBtn) {
        nextToQuestionsBtn.addEventListener('click', function() {
            // If selectedTopicId is set, treat as existing topic (handled by autocomplete)
            if (selectedTopicId) return;
            // Otherwise, treat as new topic
            goToQuestions();
            saveFormPageState('questions');
        });
    }

    // --- Robust patch for Finish Topic button ---
    function patchFinishTopicBtn(retries = 5) {
        const btn = document.getElementById('finish-topic');
        if (btn && btn.parentNode) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.onclick = function() {
                if (newBtn.disabled) return;
                const ok = finishCurrentTopic();
                if (ok) saveFormPageState('confirmation');
            };
            // Immediately validate to set disabled state
            validateRequiredFields();
        } else if (retries > 0) {
            setTimeout(() => patchFinishTopicBtn(retries - 1), 200);
        }
    }
    document.addEventListener('DOMContentLoaded', () => patchFinishTopicBtn());
    // Also call after rendering questions
    const originalRenderQuestions = renderQuestions;
    renderQuestions = function() {
        originalRenderQuestions.apply(this, arguments);
        patchFinishTopicBtn();
        validateRequiredFields();
    };
    // Also validate on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        patchFinishTopicBtn();
        validateRequiredFields();
    });

    // Initialize modern UI enhancements
    function initModernUI() {
        // Add smooth scrolling for better UX
        document.documentElement.style.scrollBehavior = 'smooth';
        
        // Add loading states to buttons
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(button => {
            button.addEventListener('click', function() {
                if (this.classList.contains('primary') || this.classList.contains('modern-btn')) {
                    this.style.transform = 'scale(0.98)';
                    setTimeout(() => {
                        this.style.transform = '';
                    }, 150);
                }
            });
        });

        // Add focus indicators for better accessibility
        const focusableElements = document.querySelectorAll('input, select, button, textarea');
        focusableElements.forEach(element => {
            element.addEventListener('focus', function() {
                this.style.outline = '2px solid var(--primary)';
                this.style.outlineOffset = '2px';
            });
            
            element.addEventListener('blur', function() {
                this.style.outline = '';
                this.style.outlineOffset = '';
            });
        });

        // Add hover effects to cards
        const cards = document.querySelectorAll('.modern-card, .modern-section');
        cards.forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
            });
        });

        // Update context display when selections change
        const categorySelect = document.getElementById('category');
        const subSectionSelect = document.getElementById('sub-section');
        const categoryDisplay = document.getElementById('category-display');
        const subsectionDisplay = document.getElementById('subsection-display');

        if (categorySelect && categoryDisplay) {
            categorySelect.addEventListener('change', function() {
                categoryDisplay.textContent = this.value || 'Not selected';
                categoryDisplay.style.color = this.value ? 'var(--primary)' : 'var(--accent)';
            });
        }

        if (subSectionSelect && subsectionDisplay) {
            subSectionSelect.addEventListener('change', function() {
                subsectionDisplay.textContent = this.value || 'Not selected';
                subsectionDisplay.style.color = this.value ? 'var(--primary)' : 'var(--accent)';
            });
        }

        // Add progress indicator animations
        const progressIndicator = document.querySelector('.progress-indicator');
        if (progressIndicator) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }
                });
            });
            
            observer.observe(progressIndicator);
        }
    }
});