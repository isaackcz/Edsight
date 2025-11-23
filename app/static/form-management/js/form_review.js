/**
 * Form Review Main Controller
 * Handles tree view rendering, data loading, and navigation for form review
 */

class FormReviewMain {
    constructor(formId) {
        this.formId = formId;
        this.formData = null;
        this.categories = [];
        this.currentCategory = null;
        this.currentTopic = null;
        this.loadedTopics = {};
        this.loadedQuestions = {};
        
        this.init();
    }
    
    async init() {
        try {
            // Load basic form data
            await this.loadFormBasic();
            
            // Load categories
            await this.loadCategories();
            
            // Setup event listeners
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Failed to initialize form review:', error);
            this.showError('Failed to load form data');
        }
    }
    
    async loadFormBasic() {
        try {
            const response = await fetch(`/api/form-management/forms/${this.formId}/basic/`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to load form');
            }
            
            this.formData = data.form;
            this.updateHeader();
            
        } catch (error) {
            console.error('Failed to load form basic info:', error);
            throw error;
        }
    }
    
    updateHeader() {
        const pageTitle = document.getElementById('pageTitle');
        const formInfo = document.getElementById('formInfo');
        
        if (pageTitle && this.formData) {
            pageTitle.textContent = `Form Review - ${this.formData.school.school_name}`;
        }
        
        if (formInfo && this.formData) {
            const statusClass = this.getStatusClass(this.formData.workflow_status);
            const statusDisplay = this.getStatusDisplay(this.formData.workflow_status);
            
            formInfo.innerHTML = `
                <span class="status-badge ${statusClass}">${statusDisplay}</span>
                <span style="margin-left: 12px; color: #999;">
                    Form ID: ${this.formData.form_id} | 
                    ${this.formData.school.district_name}, ${this.formData.school.division_name} | 
                    Submitted: ${this.formatDate(this.formData.submitted_at)}
                </span>
            `;
        }
    }
    
    getStatusClass(status) {
        if (status && status.includes('_pending')) return 'status-pending';
        if (status === 'submitted') return 'status-submitted';
        if (status && status.includes('_approved')) return 'status-approved';
        if (status && status.includes('_returned')) return 'status-returned';
        return '';
    }
    
    getStatusDisplay(status) {
        const displays = {
            'submitted': 'Submitted',
            'district_pending': 'Pending District Review',
            'district_approved': 'District Approved',
            'district_returned': 'Returned by District',
            'division_pending': 'Pending Division Review',
            'division_approved': 'Division Approved',
            'division_returned': 'Returned by Division',
            'region_pending': 'Pending Region Review',
            'region_approved': 'Region Approved',
            'region_returned': 'Returned by Region',
            'central_pending': 'Pending Central Review',
            'central_approved': 'Central Approved',
            'central_returned': 'Returned by Central',
            'completed': 'Completed'
        };
        return displays[status] || status;
    }
    
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    async loadCategories() {
        try {
            const response = await fetch(`/api/form-management/forms/${this.formId}/categories/`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to load categories');
            }
            
            this.categories = data.categories;
            this.renderTree();
            
        } catch (error) {
            console.error('Failed to load categories:', error);
            throw error;
        }
    }
    
    renderTree() {
        const treeContent = document.getElementById('treeContent');
        if (!treeContent) return;
        
        if (this.categories.length === 0) {
            treeContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>No categories available</p>
                </div>
            `;
            return;
        }
        
        const html = this.categories.map(category => {
            const isExpanded = this.currentCategory === category.category_id;
            const expandIcon = isExpanded ? 'fa-chevron-down expanded' : 'fa-chevron-right';
            const topicsLoaded = !!this.loadedTopics[category.category_id];
            const topicCount = topicsLoaded ? (this.loadedTopics[category.category_id].length || 0) : null;
            return `
                <div class="tree-node ${isExpanded ? 'expanded' : ''}" data-category-id="${category.category_id}">
                    <div class="tree-node-item category-item" data-type="category" data-id="${category.category_id}">
                        <i class="fas ${expandIcon} tree-expand-icon"></i>
                        <i class="fas fa-folder tree-node-icon"></i>
                        <span class="tree-node-label">${this.escapeHtml(category.category_name)}</span>
                        <button class="add-remark-btn icon-only" data-remark-type="category" data-entity-id="${category.category_id}" aria-label="Add remark" title="Add remark" style="margin-left:auto;">
                            <i class="fas fa-comment-dots"></i>
                        </button>
                        <span class="remark-badge" data-remark-type="category" data-entity-id="${category.category_id}" style="display:none;">
                            <i class="ph-bold ph-chat-circle-dots"></i>
                            <span class="remark-count">0</span>
                        </span>
                        ${topicCount !== null ? `<span class=\"tree-node-count\">${topicCount}</span>` : ''}
                    </div>
                    <div class="tree-children" id="topics-${category.category_id}">
                        ${isExpanded ? '<div class="loading-topics"><i class="fas fa-spinner fa-spin"></i> Loading topics...</div>' : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        treeContent.innerHTML = `<div class="hierarchy-tree">${html}</div>`;
        
        // If expanded categories already have topics loaded, render them
        for (const category of this.categories) {
            if (this.currentCategory === category.category_id && this.loadedTopics[category.category_id]) {
                this.injectTopics(category.category_id, this.loadedTopics[category.category_id]);
            }
        }
        // Update remark badges if remarks module is active
        if (window.formReviewRemarksApp && typeof window.formReviewRemarksApp.updateAllBadges === 'function') {
            window.formReviewRemarksApp.updateAllBadges();
        }
    }
    
    injectTopics(categoryId, topics) {
        const container = document.getElementById(`topics-${categoryId}`);
        if (!container) return;
        if (!topics || topics.length === 0) {
            container.innerHTML = '<div class="empty-topics">No topics found</div>';
            return;
        }
        const topicsHTML = topics.map(topic => {
            const isSelected = this.currentTopic === topic.topic_id;
            const countText = (typeof topic.answered_questions !== 'undefined' && typeof topic.total_questions !== 'undefined')
                ? `${topic.answered_questions}/${topic.total_questions}`
                : '';
            return `
                <div class="tree-node">
                    <div class="tree-node-item topic-item ${isSelected ? 'selected' : ''}" data-type="topic" data-id="${topic.topic_id}" data-category-id="${categoryId}">
                        <i class="fas fa-circle tree-node-icon"></i>
                        <span class="tree-node-label">${this.escapeHtml(topic.topic_name)}</span>
                        <button class="add-remark-btn icon-only" data-remark-type="topic" data-entity-id="${topic.topic_id}" aria-label="Add remark" title="Add remark">
                            <i class="fas fa-comment-dots"></i>
                        </button>
                        <span class="remark-badge" data-remark-type="topic" data-entity-id="${topic.topic_id}" style="display:none;">
                            <i class="ph-bold ph-chat-circle-dots"></i>
                            <span class="remark-count">0</span>
                        </span>
                        <span class="tree-node-count">${countText}</span>
                    </div>
                </div>`;
        }).join('');
        container.innerHTML = topicsHTML;
        if (window.formReviewRemarksApp && typeof window.formReviewRemarksApp.updateAllBadges === 'function') {
            window.formReviewRemarksApp.updateAllBadges();
        }
    }
    
    setupEventListeners() {
        const treeContent = document.getElementById('treeContent');
        if (treeContent) {
            treeContent.addEventListener('click', async (e) => {
                const nodeItem = e.target.closest('.tree-node-item');
                if (!nodeItem) return;
                const type = nodeItem.dataset.type;
                const id = parseInt(nodeItem.dataset.id);
                if (type === 'category') {
                    await this.toggleCategory(id);
                } else if (type === 'topic') {
                    await this.selectTopic(id);
                }
            });
        }
    }
    
    async toggleCategory(categoryId) {
        if (this.currentCategory === categoryId) {
            this.currentCategory = null;
            this.renderTree();
            return;
        }
        this.currentCategory = categoryId;
        // Load topics if not already loaded
        if (!this.loadedTopics[categoryId]) {
            await this.loadTopics(categoryId);
        }
        this.renderTree();
    }
    
    async loadTopics(categoryId) {
        try {
            const response = await fetch(`/api/form-management/forms/${this.formId}/categories/${categoryId}/topics/`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to load topics');
            }
            
            this.loadedTopics[categoryId] = data.topics;
            
        } catch (error) {
            console.error('Failed to load topics:', error);
            this.showError('Failed to load topics');
        }
    }
    
    async selectTopic(topicId) {
        this.currentTopic = topicId;
        this.renderTree();
        
        // Load and display questions
        await this.loadQuestions(topicId);
    }
    
    async loadQuestions(topicId) {
        try {
            const response = await fetch(`/api/form-management/forms/${this.formId}/topics/${topicId}/questions/`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to load questions');
            }
            
            this.loadedQuestions[topicId] = data.questions;
            this.renderQuestions(data.questions);
            
        } catch (error) {
            console.error('Failed to load questions:', error);
            this.showError('Failed to load questions');
        }
    }
    
    renderQuestions(questions) {
        const questionsList = document.getElementById('questionsList');
        const topicTitle = document.getElementById('topicTitle');
        
        if (!questionsList) return;
        
        // Find topic name
        let topicName = 'Questions';
        for (const categoryId in this.loadedTopics) {
            const topic = this.loadedTopics[categoryId].find(t => t.topic_id === this.currentTopic);
            if (topic) {
                topicName = topic.topic_name;
                break;
            }
        }
        
        if (topicTitle) {
            topicTitle.textContent = topicName;
        }
        
        if (questions.length === 0) {
            questionsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>No Questions</h3>
                    <p>No questions found for this topic</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            html += this.renderQuestion(question, i + 1);
        }
        
        questionsList.innerHTML = html;
        // Auto-size textareas to fit their content
        this.autoSizeTextareas();
        if (window.formReviewRemarksApp && typeof window.formReviewRemarksApp.updateAllBadges === 'function') {
            window.formReviewRemarksApp.updateAllBadges();
        }
    }
    
    renderQuestion(question, indexInTopic) {
        const answer = question.answer || '';
        const hasAnswer = answer.trim() !== '';
        const number = (typeof question.display_order === 'number' && question.display_order > 0)
            ? question.display_order
            : indexInTopic;
        
        return `
            <div class="question-card review-mode ${hasAnswer ? 'answered' : ''}" data-question-id="${question.question_id}">
                <div class="question-header">
                    <div class="question-number">${number}</div>
                    <div class="question-text-display">
                        ${this.escapeHtml(question.question_text)}
                        ${question.is_required ? '<span class="required-indicator">*</span>' : ''}
                    </div>
                    <button class="add-remark-btn icon-only" data-remark-type="question" data-entity-id="${question.question_id}" aria-label="Add remark" title="Add remark">
                        <i class="fas fa-comment-dots"></i>
                    </button>
                </div>
                <div class="question-content">
                    <div class="question-input">
                        ${this.renderAnswerField(question)}
                    </div>
                </div>
            </div>
        `;
    }
    
    renderAnswerField(question) {
        const answer = question.answer || '';
        const answerType = question.answer_type || 'text';
        
        // All fields are read-only (disabled)
        switch (answerType) {
            case 'textarea':
            case 'long_text':
                return `
                    <textarea 
                        class="text-input form-control" 
                        readonly
                        style="height:auto;overflow:hidden;min-height: 48px;"
                    >${this.escapeHtml(answer)}</textarea>
                `;
            
            case 'number':
                return `
                    <input 
                        type="number" 
                        class="number-input form-control" 
                        value="${this.escapeHtml(answer)}"
                        readonly
                    />
                `;
            
            case 'date':
                return `
                    <input 
                        type="date" 
                        class="date-input form-control" 
                        value="${this.escapeHtml(answer)}"
                        readonly
                    />
                `;
            
            case 'text':
            case 'short_text':
            default:
                return `
                    <input 
                        type="text" 
                        class="text-input form-control" 
                        value="${this.escapeHtml(answer)}"
                        readonly
                    />
                `;
        }
    }
    
    autoSizeTextareas() {
        const textareas = document.querySelectorAll('.questions-list textarea.form-control');
        textareas.forEach((ta) => {
            // Reset height to measure actual scrollHeight
            ta.style.height = 'auto';
            // Set height based on content
            ta.style.height = `${ta.scrollHeight}px`;
        });
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showError(message) {
        this.showDialog('Error', message, 'error');
    }
    
    showSuccess(message) {
        this.showDialog('Success', message, 'success');
    }
    
    showDialog(title, message, type = 'info', confirmText = 'OK') {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 10000;
            display: flex; align-items: center; justify-content: center;`;
        const box = document.createElement('div');
        box.style.cssText = `background: #fff; border-radius: 14px; width: 92%; max-width: 480px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,.2);`;
        const icon = type === 'error' ? 'fa-circle-xmark' : type === 'success' ? 'fa-circle-check' : 'fa-circle-info';
        const color = type === 'error' ? '#e11d48' : type === 'success' ? '#16a34a' : '#0ea5e9';
        box.innerHTML = `
            <div style="text-align:center;">
                <div style="width:64px;height:64px;margin:0 auto 12px;border-radius:50%;background:${type==='error'?'#fee2e2':type==='success'?'#ecfdf5':'#e0f2fe'};display:flex;align-items:center;justify-content:center;">
                    <i class="fas ${icon}" style="font-size:32px;color:${color}"></i>
                </div>
                <h3 style="margin:0 0 8px;font-size:1.25rem;color:#111827;">${this.escapeHtml(title)}</h3>
                <div style="color:#374151;margin-bottom:18px;">${message}</div>
                <button id="dialog-ok" style="padding:10px 18px;border:none;border-radius:8px;background:${color};color:#fff;font-weight:600;cursor:pointer;">${this.escapeHtml(confirmText)}</button>
            </div>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        box.querySelector('#dialog-ok').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }
}

