/**
 * School Form Remarks Manager
 * Handles displaying remarks on categories, topics, and questions with hover tooltips
 */

class SchoolFormRemarks {
    constructor(api) {
        this.api = api;
        this.remarks = {
            category: {},
            topic: {},
            question: {}
        };
        this.hierarchy = {
            question_to_topic: {},
            topic_to_category: {}
        };
        this.currentTooltip = null;
        this.currentTooltipBtn = null;
        this.tooltipTimeout = null;
        
        this.init();
    }
    
    async init() {
        try {
            // Load all remarks
            await this.loadRemarks();
            
            // Setup event listeners for hover tooltips
            this.setupEventListeners();
            
            // Update remark badges in tree
            this.updateAllBadges();
            
        } catch (error) {
            console.error('Failed to initialize remarks:', error);
        }
    }
    
    async loadRemarks() {
        try {
            const response = await this.api.getRemarks();
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to load remarks');
            }
            
            this.remarks = response.remarks || {
                category: {},
                topic: {},
                question: {}
            };
            
            // Store hierarchy mappings for cascading badge counts
            this.hierarchy = response.hierarchy || {
                question_to_topic: {},
                topic_to_category: {}
            };
            
        } catch (error) {
            console.error('Failed to load remarks:', error);
            // Don't throw - just use empty remarks
            this.remarks = {
                category: {},
                topic: {},
                question: {}
            };
            this.hierarchy = {
                question_to_topic: {},
                topic_to_category: {}
            };
        }
    }
    
    setupEventListeners() {
        // Tooltips for remark icons (use mouseover/mouseout + debounce)
        this._onOver = (e) => {
            const src = e.target;
            if (!(src instanceof Element)) return;
            const btn = src.closest('.remark-icon-btn');
            if (!btn) return;
            const remarkType = btn.dataset.remarkType;
            const entityId = (btn.dataset.entityId || '').toString();
            const list = (this.remarks[remarkType] && this.remarks[remarkType][entityId]) || [];
            if (list.length === 0) return;
            if (this.currentTooltipBtn === btn) return;
            if (this.tooltipTimeout) clearTimeout(this.tooltipTimeout);
            this.tooltipTimeout = setTimeout(() => {
                this.showTooltip(btn, list);
                this.currentTooltipBtn = btn;
            }, 200);
        };

        this._onOut = (e) => {
            const src = e.target;
            if (!(src instanceof Element)) return;
            const btn = src.closest('.remark-icon-btn');
            if (!btn) return;
            const toEl = e.relatedTarget instanceof Element ? e.relatedTarget.closest('.remark-tooltip') : null;
            if (toEl) return;
            if (this.tooltipTimeout) {
                clearTimeout(this.tooltipTimeout);
                this.tooltipTimeout = null;
            }
            this.hideTooltip();
            this.currentTooltipBtn = null;
        };

        document.addEventListener('mouseover', this._onOver, true);
        document.addEventListener('mouseout', this._onOut, true);
        window.addEventListener('scroll', () => this.hideTooltip(), { passive: true });
    }
    
    updateAllBadges() {
        // Update badges for all entities with direct remarks
        for (const remarkType of ['category', 'topic', 'question']) {
            for (const entityId in this.remarks[remarkType]) {
                this.updateBadge(remarkType, parseInt(entityId));
            }
        }
        
        // Also update badges for categories and topics that have child remarks but no direct remarks
        // Get all unique categories and topics from hierarchy
        const categoriesNeedingUpdate = new Set();
        const topicsNeedingUpdate = new Set();
        
        // Collect all topics from hierarchy
        for (const [topicId, categoryId] of Object.entries(this.hierarchy.topic_to_category || {})) {
            topicsNeedingUpdate.add(parseInt(topicId));
            categoriesNeedingUpdate.add(parseInt(categoryId));
        }
        
        // Collect all categories and topics that have direct remarks
        const entitiesWithDirectRemarks = {
            category: new Set(Object.keys(this.remarks.category || {}).map(id => parseInt(id))),
            topic: new Set(Object.keys(this.remarks.topic || {}).map(id => parseInt(id)))
        };
        
        // Update categories that don't have direct remarks but might have child remarks
        categoriesNeedingUpdate.forEach(catId => {
            if (!entitiesWithDirectRemarks.category.has(catId)) {
                this.updateBadge('category', catId);
            }
        });
        
        // Update topics that don't have direct remarks but might have child remarks
        topicsNeedingUpdate.forEach(topicId => {
            if (!entitiesWithDirectRemarks.topic.has(topicId)) {
                this.updateBadge('topic', topicId);
            }
        });
    }
    
    getChildRemarksCount(remarkType, entityId) {
        let count = 0;
        
        if (remarkType === 'category') {
            // For categories, count all remarks from topics and questions under this category
            // Use hierarchy mapping to find all topics under this category
            for (const [topicId, categoryId] of Object.entries(this.hierarchy.topic_to_category || {})) {
                // JSON keys are always strings, values might be numbers
                if (parseInt(categoryId) === entityId) {
                    // This topic belongs to this category, add its direct remarks
                    const topicKey = topicId.toString();
                    if (this.remarks.topic && this.remarks.topic[topicKey]) {
                        count += this.remarks.topic[topicKey].length;
                    }
                    
                    // Add questions under this topic's remarks
                    for (const [questionId, topicIdFromQuestion] of Object.entries(this.hierarchy.question_to_topic || {})) {
                        if (parseInt(topicIdFromQuestion) === parseInt(topicId)) {
                            const questionKey = questionId.toString();
                            if (this.remarks.question && this.remarks.question[questionKey]) {
                                count += this.remarks.question[questionKey].length;
                            }
                        }
                    }
                }
            }
        } else if (remarkType === 'topic') {
            // For topics, count all remarks from questions under this topic
            for (const [questionId, topicId] of Object.entries(this.hierarchy.question_to_topic || {})) {
                if (parseInt(topicId) === entityId) {
                    const questionKey = questionId.toString();
                    if (this.remarks.question && this.remarks.question[questionKey]) {
                        count += this.remarks.question[questionKey].length;
                    }
                }
            }
        }
        
        return count;
    }
    
    updateBadge(remarkType, entityId) {
        const entityKey = entityId.toString();
        const directRemarksCount = (this.remarks[remarkType] && this.remarks[remarkType][entityKey] ? this.remarks[remarkType][entityKey].length : 0);
        
        // Get child remarks count for categories and topics
        let childRemarksCount = 0;
        if (remarkType === 'category' || remarkType === 'topic') {
            childRemarksCount = this.getChildRemarksCount(remarkType, entityId);
        }
        
        // Total count = direct remarks + child remarks
        const totalRemarksCount = directRemarksCount + childRemarksCount;

        // Update remark icon/badge if present
        const iconBtn = document.querySelector(`.remark-icon-btn[data-remark-type="${remarkType}"][data-entity-id="${entityId}"]`);
        if (iconBtn) {
            if (totalRemarksCount > 0) {
                iconBtn.style.display = 'flex';
                const badge = iconBtn.querySelector('.remark-badge-count');
                if (badge) badge.textContent = totalRemarksCount;
            } else {
                iconBtn.style.display = 'none';
            }
        }
    }
    
    showTooltip(targetEl, remarksList) {
        this.hideTooltip();
        const rect = targetEl.getBoundingClientRect();
        const tooltip = document.createElement('div');
        tooltip.className = 'remark-tooltip';
        const count = remarksList.length;
        const preview = remarksList.slice(0, 5).map(r => {
            const date = new Date(r.created_at);
            const ts = date.toLocaleString();
            const text = (r.remark_text || '').toString();
            const safe = this.escapeHtml(text.length > 150 ? text.slice(0, 150) + '…' : text);
            const name = this.escapeHtml(r.admin?.full_name || r.admin?.username || '');
            const level = this.escapeHtml(r.admin?.admin_level || '');
            return `<div class="tooltip-item">${safe}<span class="meta">${name} (${level}) • ${ts}</span></div>`;
        }).join('');
        tooltip.innerHTML = `
            <div class="tooltip-header">
                <span>Remarks (${count})</span>
            </div>
            <div class="tooltip-list">${preview}</div>
        `;
        document.body.appendChild(tooltip);
        const top = rect.top + window.scrollY - tooltip.offsetHeight - 8;
        const left = Math.min(
            Math.max(rect.left + window.scrollX - tooltip.offsetWidth / 2 + rect.width / 2, 8),
            window.scrollX + document.documentElement.clientWidth - tooltip.offsetWidth - 8
        );
        tooltip.style.top = `${Math.max(top, 8)}px`;
        tooltip.style.left = `${left}px`;
        this.currentTooltip = tooltip;
    }

    hideTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.remove();
            this.currentTooltip = null;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in other modules
window.SchoolFormRemarks = SchoolFormRemarks;

