/**
 * Form Review Remarks Manager
 * Handles adding, displaying, and managing remarks on categories, topics, and questions
 */

class FormReviewRemarks {
    constructor(formId, formReviewMain) {
        this.formId = formId;
        this.formReviewMain = formReviewMain;
        this.remarks = {
            category: {},
            topic: {},
            question: {}
        };
        this.currentModal = null;
        
        this.init();
    }
    
    async init() {
        try {
            // Load all remarks
            await this.loadRemarks();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Update remark badges
            this.updateAllBadges();
            
        } catch (error) {
            console.error('Failed to initialize remarks:', error);
        }
    }
    
    async loadRemarks() {
        try {
            const response = await fetch(`/api/form-management/forms/${this.formId}/remarks/`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to load remarks');
            }
            
            this.remarks = data.remarks;
            this.emitRemarksChanged();
            
        } catch (error) {
            console.error('Failed to load remarks:', error);
            throw error;
        }
    }
    
    hasAnyRemarks() {
        if (!this.remarks) return false;
        const remarkTypes = ['category', 'topic', 'question'];
        return remarkTypes.some(type => {
            const typeRemarks = this.remarks[type];
            if (!typeRemarks) return false;
            return Object.values(typeRemarks).some(list => Array.isArray(list) && list.length > 0);
        });
    }
    
    setupEventListeners() {
        // Delegated event listener for add remark buttons
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.add-remark-btn');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                const remarkType = btn.dataset.remarkType;
                const entityId = parseInt(btn.dataset.entityId);
                this.showRemarkModal(remarkType, entityId);
            }
            
            // Handle remark badge clicks (show remarks)
            const badge = e.target.closest('.remark-badge');
            if (badge) {
                e.preventDefault();
                e.stopPropagation();
                const remarkType = badge.dataset.remarkType;
                const entityId = parseInt(badge.dataset.entityId);
                this.showRemarksForEntity(remarkType, entityId);
            }
        });

        // Tooltips for remark icons (use mouseover/mouseout + debounce to avoid flicker)
        this._onOver = (e) => {
            const src = e.target;
            if (!(src instanceof Element)) return;
            const btn = src.closest('.add-remark-btn');
            if (!btn || !btn.classList.contains('has-remarks')) return;
            // If moving within the same button, skip
            if (this.currentTooltipBtn === btn) return;
            const remarkType = btn.dataset.remarkType;
            const entityId = (btn.dataset.entityId || '').toString();
            const list = (this.remarks[remarkType] && this.remarks[remarkType][entityId]) || [];
            if (list.length === 0) return;
            if (this.tooltipTimeout) clearTimeout(this.tooltipTimeout);
            this.tooltipTimeout = setTimeout(() => {
                this.showTooltip(btn, list);
                this.currentTooltipBtn = btn;
            }, 120);
        };

        this._onOut = (e) => {
            const src = e.target;
            if (!(src instanceof Element)) return;
            const btn = src.closest('.add-remark-btn');
            if (!btn) return;
            const toEl = e.relatedTarget instanceof Element ? e.relatedTarget.closest('.remark-tooltip') : null;
            if (toEl) return; // keep tooltip if entering tooltip
            if (this.tooltipTimeout) { clearTimeout(this.tooltipTimeout); this.tooltipTimeout = null; }
            this.hideTooltip();
            this.currentTooltipBtn = null;
        };

        document.addEventListener('mouseover', this._onOver, true);
        document.addEventListener('mouseout', this._onOut, true);
        window.addEventListener('scroll', () => this.hideTooltip(), { passive: true });
    }
    
    showRemarkModal(remarkType, entityId) {
        // Get entity name and any existing remark (single-remark policy)
        const entityName = this.getEntityName(remarkType, entityId);
        const existing = (this.remarks[remarkType] && this.remarks[remarkType][String(entityId)] && this.remarks[remarkType][String(entityId)][0]) || null;
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'remark-modal-overlay';
        overlay.innerHTML = `
            <div class="remark-modal">
                <div class="remark-modal-header">
                    <h3>Add Remark - ${this.escapeHtml(entityName)}</h3>
                    <button class="remark-modal-close" aria-label="Close">
                        <i class="ph-bold ph-x"></i>
                    </button>
                </div>
                <div class="remark-modal-body">
                    <label for="remarkText">Your Remark</label>
                    <textarea id="remarkText" placeholder="Enter your remark here..." required>${existing ? this.escapeHtml(existing.remark_text || '') : ''}</textarea>
                </div>
                <div class="remark-modal-footer">
                    <button class="btn-cancel">Cancel</button>
                    <button class="btn-submit" ${existing ? '' : 'disabled'}>${existing ? 'Update Remark' : 'Submit Remark'}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.currentModal = overlay;
        
        // Focus textarea
        const textarea = overlay.querySelector('#remarkText');
        textarea.focus();
        
        // Enable/disable submit button based on textarea content
        textarea.addEventListener('input', () => {
            const submitBtn = overlay.querySelector('.btn-submit');
            submitBtn.disabled = textarea.value.trim() === '';
        });
        
        // Handle close button
        overlay.querySelector('.remark-modal-close').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Handle cancel button
        overlay.querySelector('.btn-cancel').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Handle submit button
        overlay.querySelector('.btn-submit').addEventListener('click', async () => {
            const remarkText = textarea.value.trim();
            if (remarkText) {
                await this.submitRemark(remarkType, entityId, remarkText, !!existing);
            }
        });
        
        // Handle click outside modal
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeModal();
            }
        });
        
        // Handle escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }
    
    closeModal() {
        if (this.currentModal) {
            this.currentModal.remove();
            this.currentModal = null;
        }
    }
    
    async submitRemark(remarkType, entityId, remarkText, isUpdate = false) {
        try {
            const submitBtn = this.currentModal.querySelector('.btn-submit');
            submitBtn.disabled = true;
            submitBtn.textContent = isUpdate ? 'Updating...' : 'Submitting...';
            
            const response = await fetch(`/api/form-management/forms/${this.formId}/remarks/upsert/`, {
                method: isUpdate ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    remark_type: remarkType,
                    entity_id: entityId,
                    remark_text: remarkText
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to submit remark');
            }
            
            // Upsert remark in local cache (single per entity)
            const entityKey = entityId.toString();
            if (!this.remarks[remarkType]) this.remarks[remarkType] = {};
            this.remarks[remarkType][entityKey] = [data.remark];
            
            // Update badge
            this.updateBadge(remarkType, entityId);
            this.emitRemarksChanged();
            
            // Close modal and show success dialog
            this.closeModal();
            this.formReviewMain.showSuccess(isUpdate ? 'Remark updated successfully' : 'Remark added successfully');
            
        } catch (error) {
            console.error('Failed to submit remark:', error);
            this.formReviewMain.showError('Failed to submit remark');
            
            // Re-enable submit button
            const submitBtn = this.currentModal?.querySelector('.btn-submit');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = isUpdate ? 'Update Remark' : 'Submit Remark';
            }
        }
    }
    
    showRemarksForEntity(remarkType, entityId) {
        const entityKey = entityId.toString();
        const remarks = this.remarks[remarkType][entityKey] || [];
        
        if (remarks.length === 0) {
            return;
        }
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'remark-modal-overlay';
        
        const entityName = this.getEntityName(remarkType, entityId);
        
        let remarksHTML = '';
        for (const remark of remarks) {
            remarksHTML += this.renderRemarkCard(remark);
        }
        
        overlay.innerHTML = `
            <div class="remark-modal" style="max-width: 600px;">
                <div class="remark-modal-header">
                    <h3>Remarks - ${this.escapeHtml(entityName)}</h3>
                    <button class="remark-modal-close" aria-label="Close">
                        <i class="ph-bold ph-x"></i>
                    </button>
                </div>
                <div class="remark-modal-body">
                    <div class="remarks-list show">
                        ${remarksHTML}
                    </div>
                </div>
                <div class="remark-modal-footer">
                    <button class="btn-cancel">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.currentModal = overlay;
        
        // Handle close button
        overlay.querySelector('.remark-modal-close').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Handle close button in footer
        overlay.querySelector('.btn-cancel').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Handle click outside modal
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeModal();
            }
        });
        
        // Handle escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }
    
    renderRemarkCard(remark) {
        const createdDate = new Date(remark.created_at);
        const formattedDate = createdDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="remark-card">
                <div class="remark-header">
                    <div class="remark-author">
                        <span class="remark-author-name">${this.escapeHtml(remark.admin.full_name)}</span>
                        <span class="remark-author-level">${this.escapeHtml(remark.admin.admin_level)}</span>
                    </div>
                    <span class="remark-timestamp">${formattedDate}</span>
                </div>
                <p class="remark-text">${this.escapeHtml(remark.remark_text)}</p>
            </div>
        `;
    }
    
    updateAllBadges() {
        // Update badges for all entities
        for (const remarkType of ['category', 'topic', 'question']) {
            for (const entityId in this.remarks[remarkType]) {
                this.updateBadge(remarkType, parseInt(entityId));
            }
        }
    }
    
    updateBadge(remarkType, entityId) {
        const entityKey = entityId.toString();
        const remarksCount = (this.remarks[remarkType] && this.remarks[remarkType][entityKey] ? this.remarks[remarkType][entityKey].length : 0);

        // Update badge if present (categories/topics); questions may not have badges
        const badge = document.querySelector(`.remark-badge[data-remark-type="${remarkType}"][data-entity-id="${entityId}"]`);
        if (badge) {
            if (remarksCount > 0) {
                badge.style.display = 'inline-flex';
                const cnt = badge.querySelector('.remark-count');
                if (cnt) cnt.textContent = remarksCount;
            } else {
                badge.style.display = 'none';
            }
        }

        // Sync icon state (works for category/topic/question)
        const iconBtn = document.querySelector(`.add-remark-btn[data-remark-type="${remarkType}"][data-entity-id="${entityId}"]`);
        if (iconBtn) {
            if (remarksCount > 0) iconBtn.classList.add('has-remarks');
            else iconBtn.classList.remove('has-remarks');
        }
    }
    
    getEntityName(remarkType, entityId) {
        if (remarkType === 'category') {
            const category = this.formReviewMain.categories.find(c => c.category_id === entityId);
            return category ? category.category_name : `Category #${entityId}`;
        }
        
        if (remarkType === 'topic') {
            // Find topic in loaded topics
            for (const categoryId in this.formReviewMain.loadedTopics) {
                const topic = this.formReviewMain.loadedTopics[categoryId].find(t => t.topic_id === entityId);
                if (topic) return topic.topic_name;
            }
            return `Topic #${entityId}`;
        }
        
        if (remarkType === 'question') {
            // Find question in loaded questions
            for (const topicId in this.formReviewMain.loadedQuestions) {
                const question = this.formReviewMain.loadedQuestions[topicId].find(q => q.question_id === entityId);
                if (question) return question.question_text.substring(0, 50) + '...';
            }
            return `Question #${entityId}`;
        }
        
        return `${remarkType} #${entityId}`;
    }
    
    getCSRFToken() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return value;
            }
        }
        return '';
    }
    
    showTooltip(targetEl, remarksList) {
        this.hideTooltip();
        const rect = targetEl.getBoundingClientRect();
        const tooltip = document.createElement('div');
        tooltip.className = 'remark-tooltip';
        const count = remarksList.length;
        const preview = remarksList.slice(0, 3).map(r => {
            const date = new Date(r.created_at);
            const ts = date.toLocaleString();
            const text = (r.remark_text || '').toString();
            const safe = this.escapeHtml(text.length > 120 ? text.slice(0, 120) + '…' : text);
            const name = this.escapeHtml(r.admin?.full_name || r.admin?.username || '');
            return `<div class="tooltip-item">${safe}<span class="meta">${name} • ${ts}</span></div>`;
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

    emitRemarksChanged() {
        const hasRemarks = this.hasAnyRemarks();
        window.dispatchEvent(new CustomEvent('formRemarksChanged', {
            detail: { hasRemarks }
        }));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize remarks manager after FormReviewMain is initialized
document.addEventListener('DOMContentLoaded', function() {
    // Wait for FormReviewMain to be initialized
    const checkInterval = setInterval(() => {
        if (window.formReviewApp) {
            window.formReviewRemarksApp = new FormReviewRemarks(
                window.formReviewApp.formId,
                window.formReviewApp
            );
            clearInterval(checkInterval);
        }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => clearInterval(checkInterval), 5000);
});

