 /**
 * School Form Tree View Manager
 * Adapted from draft-manager.js for school form answering
 * Displays categories/topics tree with progress tracking
 */

class SchoolFormTree {
    constructor(api, onTopicSelect, remarks = null) {
        this.api = api;
        this.onTopicSelect = onTopicSelect;
        this.remarks = remarks;
        this.categories = [];
        this.expandedCategories = new Set();
        this.selectedTopic = null;
        this.treeContainer = document.getElementById('treeContent');
        
        if (!this.treeContainer) {
            console.error('Tree container not found: #treeContent');
            return;
        }

        this.init();
    }

    async init() {
        await this.loadCategories();
        this.attachEventListeners();
    }

    /**
     * Load categories from API
     */
    async loadCategories() {
        try {
            this.showLoading();
            const response = await this.api.getCategories();
            this.categories = response.categories || [];
            this.renderTree();
        } catch (error) {
            console.error('Failed to load categories:', error);
            this.showError('Failed to load categories');
        }
    }

    /**
     * Load topics for a specific category
     */
    async loadTopics(categoryId) {
        try {
            const response = await this.api.getTopics(categoryId);
            return response.topics || [];
        } catch (error) {
            console.error('Failed to load topics:', error);
            return [];
        }
    }

    /**
     * Render tree view
     */
    renderTree() {
        if (!this.treeContainer) return;

        if (this.categories.length === 0) {
            this.treeContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>No categories available</p>
                </div>
            `;
            return;
        }

        const treeHTML = this.categories.map(category => this.renderCategory(category)).join('');
        this.treeContainer.innerHTML = `<div class="hierarchy-tree">${treeHTML}</div>`;
        
        // Update remark badges after rendering
        const remarksApp = this.remarks || window.schoolFormRemarksApp;
        if (remarksApp && typeof remarksApp.updateAllBadges === 'function') {
            setTimeout(() => remarksApp.updateAllBadges(), 100);
        }
    }

    /**
     * Render a single category node
     */
    renderCategory(category) {
        const isExpanded = this.expandedCategories.has(category.category_id);
        const expandIcon = isExpanded ? 'fa-chevron-down' : 'fa-chevron-right';
        
        // Determine category completion status
        const isComplete = category.is_complete || false;
        const statusClass = isComplete ? 'complete' : '';
        const folderIcon = isComplete ? 'fa-folder-check' : 'fa-folder';
        const statusIcon = isComplete ? '<i class="fas fa-check-circle category-status-icon"></i>' : '';

        return `
            <div class="tree-node ${isExpanded ? 'expanded' : ''}" data-category-id="${category.category_id}">
                <div class="tree-node-item category-item ${statusClass}" data-type="category" data-id="${category.category_id}">
                    <i class="fas ${expandIcon} tree-expand-icon ${isExpanded ? 'expanded' : ''}"></i>
                    ${statusIcon}
                    <i class="fas ${folderIcon} tree-node-icon"></i>
                    <span class="tree-node-label">${this.escapeHtml(category.name)}</span>
                    <span class="tree-node-count">${category.topic_count || 0}</span>
                    <button class="remark-icon-btn" data-remark-type="category" data-entity-id="${category.category_id}" style="display:none;" aria-label="View remarks">
                        <i class="fas fa-comment-dots"></i>
                        <span class="remark-badge-count">0</span>
                    </button>
                </div>
                <div class="tree-children" id="topics-${category.category_id}">
                    ${isExpanded ? '<div class="loading-topics"><i class="fas fa-spinner fa-spin"></i> Loading topics...</div>' : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render topics for a category
     */
    renderTopics(categoryId, topics) {
        const container = document.getElementById(`topics-${categoryId}`);
        if (!container) return;

        if (topics.length === 0) {
            container.innerHTML = '<div class="empty-topics">No topics found</div>';
            return;
        }

        const topicsHTML = topics.map(topic => this.renderTopic(topic)).join('');
        container.innerHTML = topicsHTML;
        
        // Update remark badges after rendering
        const remarksApp = this.remarks || window.schoolFormRemarksApp;
        if (remarksApp && typeof remarksApp.updateAllBadges === 'function') {
            setTimeout(() => remarksApp.updateAllBadges(), 100);
        }
    }

    /**
     * Render a single topic node
     */
    renderTopic(topic) {
        const isSelected = this.selectedTopic === topic.topic_id;
        const percentage = topic.completion_percentage || 0;
        const isComplete = topic.is_complete;

        let statusIcon = 'fa-circle';
        let statusClass = 'not-started';

        if (isComplete) {
            statusIcon = 'fa-check-circle';
            statusClass = 'complete';
        } else if (percentage > 0) {
            statusIcon = 'fa-exclamation-circle';
            statusClass = 'in-progress';
        }

        return `
            <div class="tree-node">
                <div class="tree-node-item topic-item ${isSelected ? 'selected' : ''} ${statusClass}" 
                     data-type="topic" 
                     data-id="${topic.topic_id}"
                     data-category-id="${topic.category_id || ''}">
                    <i class="fas ${statusIcon} tree-node-icon"></i>
                    <span class="tree-node-label">${this.escapeHtml(topic.name)}</span>
                    <span class="tree-node-count">${topic.answered_questions || 0}/${topic.total_questions || 0}</span>
                    <button class="remark-icon-btn" data-remark-type="topic" data-entity-id="${topic.topic_id}" style="display:none;" aria-label="View remarks">
                        <i class="fas fa-comment-dots"></i>
                        <span class="remark-badge-count">0</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        if (!this.treeContainer) return;

        this.treeContainer.addEventListener('click', async (e) => {
            const nodeItem = e.target.closest('.tree-node-item');
            if (!nodeItem) return;

            const type = nodeItem.dataset.type;
            const id = parseInt(nodeItem.dataset.id);

            if (type === 'category') {
                await this.toggleCategory(id);
            } else if (type === 'topic') {
                this.selectTopic(id, nodeItem.dataset.categoryId);
            }
        });
    }

    /**
     * Toggle category expansion
     */
    async toggleCategory(categoryId) {
        const isExpanded = this.expandedCategories.has(categoryId);

        if (isExpanded) {
            // Collapse
            this.expandedCategories.delete(categoryId);
            const categoryNode = document.querySelector(`.tree-node[data-category-id="${categoryId}"]`);
            if (categoryNode) {
                categoryNode.classList.remove('expanded');
                const expandIcon = categoryNode.querySelector('.tree-expand-icon');
                if (expandIcon) {
                    expandIcon.classList.remove('fa-chevron-down', 'expanded');
                    expandIcon.classList.add('fa-chevron-right');
                }
            }
        } else {
            // Expand
            this.expandedCategories.add(categoryId);
            const categoryNode = document.querySelector(`.tree-node[data-category-id="${categoryId}"]`);
            if (categoryNode) {
                categoryNode.classList.add('expanded');
                const expandIcon = categoryNode.querySelector('.tree-expand-icon');
                if (expandIcon) {
                    expandIcon.classList.remove('fa-chevron-right');
                    expandIcon.classList.add('fa-chevron-down', 'expanded');
                }
            }

            // Load topics
            const topics = await this.loadTopics(categoryId);
            this.renderTopics(categoryId, topics);
            
            // Cache topics on-demand for offline use
            if (window.APICacheHelper && typeof window.APICacheHelper.cacheTopicsForCategory === 'function') {
                window.APICacheHelper.cacheTopicsForCategory(categoryId).catch(err => {
                    console.debug('Failed to cache topics:', err);
                });
            }
        }
    }

    /**
     * Select a topic
     */
    selectTopic(topicId, categoryId) {
        // Deselect previous
        const previousSelected = this.treeContainer.querySelector('.tree-node-item.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }

        // Select new
        this.selectedTopic = topicId;
        const topicNode = this.treeContainer.querySelector(`.tree-node-item[data-type="topic"][data-id="${topicId}"]`);
        if (topicNode) {
            topicNode.classList.add('selected');
        }

        // Notify parent
        if (this.onTopicSelect) {
            this.onTopicSelect(topicId, categoryId);
        }
    }

    /**
     * Refresh tree to update progress
     */
    async refresh() {
        await this.loadCategories();
        
        // Re-expand previously expanded categories
        for (const categoryId of this.expandedCategories) {
            const topics = await this.loadTopics(categoryId);
            this.renderTopics(categoryId, topics);
        }

        // Re-select previous topic if any
        if (this.selectedTopic) {
            const topicNode = this.treeContainer.querySelector(`.tree-node-item[data-type="topic"][data-id="${this.selectedTopic}"]`);
            if (topicNode) {
                topicNode.classList.add('selected');
            }
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        if (!this.treeContainer) return;
        this.treeContainer.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading categories...</p>
            </div>
        `;
    }

    /**
     * Show error state
     */
    showError(message) {
        if (!this.treeContainer) return;
        this.treeContainer.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${this.escapeHtml(message)}</p>
                <button class="btn btn-secondary" onclick="location.reload()">Retry</button>
            </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in other modules
window.SchoolFormTree = SchoolFormTree;

