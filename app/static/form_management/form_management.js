/**
 * Standalone Form Management JavaScript
 * Handles form workflow, tree view, and table interactions
 */

class FormManagementSystem {
    constructor() {
        this.currentUser = null;
        this.currentView = 'table'; // 'table' or 'tree'
        this.selectedForms = new Set();
		this.currentForms = [];
		this.sortState = { field: null, dir: 'asc' };
        this.filters = {
            search: '',
            status: '',
            level: ''
        };
        
        this.init();
    }
    
    async init() {
        try {
            await this.loadCurrentUser();
            await this.loadStatistics();
			this.setupEventListeners();
			this.initializeDataGrid();
			this.initializeTreeView();
            await this.loadFormData();
            this.setupNotifications();
        } catch (error) {
            console.error('Failed to initialize form management system:', error);
            this.showNotification('Failed to initialize system', 'error');
        }
    }
    
    async loadCurrentUser() {
        try {
            const response = await fetch('/api/admin/form-management/user-info/');
            const data = await response.json();
            this.currentUser = data;
            document.getElementById('admin-role').textContent = data.admin_level_display;
        } catch (error) {
            console.error('Failed to load user info:', error);
        }
    }
    
    async loadStatistics() {
        try {
            const response = await fetch('/api/admin/form-management/statistics/');
            const data = await response.json();
            
            document.getElementById('pending-count').textContent = data.pending_review || 0;
            document.getElementById('approved-count').textContent = data.approved_today || 0;
            document.getElementById('returned-count').textContent = data.returned_for_revision || 0;
            document.getElementById('total-count').textContent = data.total_forms || 0;
            
            // Update trends (simplified for now)
            document.getElementById('pending-trend').innerHTML = `<i class="fas fa-arrow-up"></i> ${data.pending_trend || 'No change'}`;
            document.getElementById('approved-trend').innerHTML = `<i class="fas fa-arrow-up"></i> ${data.approved_trend || 'No change'}`;
            document.getElementById('returned-trend').innerHTML = `<i class="fas fa-arrow-down"></i> ${data.returned_trend || 'No change'}`;
            document.getElementById('total-trend').innerHTML = `<i class="fas fa-arrow-up"></i> ${data.total_trend || 'No change'}`;
        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    }
    
    setupEventListeners() {
        // Search functionality
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.debounceSearch();
        });
        
        // Filter dropdowns
        document.getElementById('status-filter').addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.loadFormData();
        });
        
        document.getElementById('level-filter').addEventListener('change', (e) => {
            this.filters.level = e.target.value;
            this.loadFormData();
        });
        
        // View toggle buttons
        document.getElementById('table-view-btn').addEventListener('click', () => {
            this.switchToTableView();
        });
        
        document.getElementById('tree-view-btn').addEventListener('click', () => {
            this.switchToTreeView();
        });
        
        // Action buttons
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadFormData();
            this.loadStatistics();
        });
        
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportData();
        });
        
        document.getElementById('bulk-approve-btn').addEventListener('click', () => {
            this.bulkApprove();
        });
        
        document.getElementById('bulk-return-btn').addEventListener('click', () => {
            this.bulkReturn();
        });
        
        // Modal controls
        document.getElementById('close-modal').addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('modal-cancel').addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('modal-approve').addEventListener('click', () => {
            this.approveForm();
        });
        
        document.getElementById('modal-return').addEventListener('click', () => {
            this.returnForm();
        });
        
        // Close modal when clicking outside
        document.getElementById('form-detail-modal').addEventListener('click', (e) => {
            if (e.target.id === 'form-detail-modal') {
                this.closeModal();
            }
        });
    }
    
    initializeDataGrid() {
        const container = document.getElementById('form-data-grid');
        container.innerHTML = `
            <table class="data-table" id="fm-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="fm-select-all"></th>
                        <th data-field="school_name" class="fm-sort">School Name</th>
                        <th data-field="submitted_date" class="fm-sort">Date Submitted</th>
                        <th data-field="status" class="fm-sort">Status</th>
                        <th data-field="current_level" class="fm-sort">Current Level</th>
                        <th data-field="academic_year" class="fm-sort">Academic Year</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="fm-tbody"></tbody>
            </table>
        `;
        const selectAll = document.getElementById('fm-select-all');
        selectAll.addEventListener('change', () => {
            const checkboxes = document.querySelectorAll('.fm-row-select');
            checkboxes.forEach(cb => {
                cb.checked = selectAll.checked;
                const id = parseInt(cb.dataset.id);
                if (selectAll.checked) this.selectedForms.add(id); else this.selectedForms.delete(id);
            });
            this.updateBulkActions();
        });
        document.querySelectorAll('#fm-table thead th.fm-sort').forEach(th => {
            th.style.cursor = 'pointer';
            th.addEventListener('click', () => {
                const field = th.getAttribute('data-field');
                this.toggleSort(field);
                this.renderTable();
            });
        });
    }
    
    initializeTreeView() {
        const container = document.getElementById('tree-view');
        container.innerHTML = '';
    }
    
    async loadFormData() {
        try {
            const params = new URLSearchParams(this.filters);
            const response = await fetch(`/api/admin/form-management/forms/?${params}`);
            const data = await response.json();
            
            this.currentForms = data.forms || [];
            if (this.currentView === 'table') {
                this.renderTable();
            } else {
                this.renderTree();
            }
        } catch (error) {
            console.error('Failed to load form data:', error);
            this.showNotification('Failed to load form data', 'error');
        }
    }
    
    renderTree() {
        const container = document.getElementById('tree-view');
        // If there are no submitted forms, show message
        const hasSubmitted = (this.currentForms || []).some(f => !!f.submitted_date);
        if (!hasSubmitted) {
            container.innerHTML = '<div class="empty-state">No form submission</div>';
            return;
        }
        const treeData = this.buildHierarchicalData(this.currentForms.filter(f => !!f.submitted_date));
        const html = treeData.map(d => `
            <div class="tree-district">
                <div class="tree-district-label"><i class="fas fa-folder"></i> ${this.escapeHtml(d.label)}</div>
                <ul class="tree-school-list">
                    ${d.children.map(c => `<li class="tree-school-item" data-id="${c.id}">
                        <button class="icon-btn view-btn" onclick="formManager.viewForm(${parseInt(String(c.id).replace('form-',''))})" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${this.escapeHtml(c.label)}
                    </li>`).join('')}
                </ul>
            </div>
        `).join('');
        container.innerHTML = html || '<div>No data.</div>';
    }

    renderTable() {
        const tbody = document.getElementById('fm-tbody');
        if (!tbody) return;
        const submitted = (this.currentForms || []).filter(r => !!r.submitted_date);
        // If none submitted, show message and clear table
        if (submitted.length === 0) {
            tbody.innerHTML = '';
            document.getElementById('table-info').textContent = 'No form submission';
            return;
        }
        // Sort only submitted rows
        const original = this.currentForms;
        this.currentForms = submitted;
        const rows = this.getSortedRows();
        this.currentForms = original;
        tbody.innerHTML = rows.map(r => `
            <tr>
                <td><input type="checkbox" class="fm-row-select" data-id="${r.id}" ${this.selectedForms.has(r.id) ? 'checked' : ''}></td>
                <td>${this.escapeHtml(r.school_name || '')}</td>
                <td>${r.submitted_date ? new Date(r.submitted_date).toLocaleDateString() : 'Not submitted'}</td>
                <td><span class="status-badge ${this.getStatusClass(r.status)}">${this.getStatusDisplay(r.status)}</span></td>
                <td>${this.escapeHtml(r.current_level || '')}</td>
                <td>${this.escapeHtml(r.academic_year || '')}</td>
                <td>
                    <div class="action-buttons">
                        <button class="icon-btn view-btn" onclick="formManager.viewForm(${r.id})" title="View Details"><i class="fas fa-eye"></i></button>
                        <button class="icon-btn approve-btn" onclick="formManager.quickApprove(${r.id})" title="Approve"><i class="fas fa-check"></i></button>
                        <button class="icon-btn return-btn" onclick="formManager.quickReturn(${r.id})" title="Return"><i class="fas fa-undo"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
        document.querySelectorAll('.fm-row-select').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                if (e.target.checked) this.selectedForms.add(id); else this.selectedForms.delete(id);
                this.updateBulkActions();
            });
        });
        document.getElementById('table-info').textContent = `Showing ${rows.length} entries`;
    }

    getSortedRows() {
        const { field, dir } = this.sortState;
        const rows = [...this.currentForms];
        if (!field) return rows;
        rows.sort((a, b) => {
            const av = a[field];
            const bv = b[field];
            if (av == null && bv == null) return 0;
            if (av == null) return dir === 'asc' ? -1 : 1;
            if (bv == null) return dir === 'asc' ? 1 : -1;
            if (field === 'submitted_date') {
                const ad = av ? new Date(av).getTime() : 0;
                const bd = bv ? new Date(bv).getTime() : 0;
                return dir === 'asc' ? ad - bd : bd - ad;
            }
            const as = String(av).toLowerCase();
            const bs = String(bv).toLowerCase();
            if (as < bs) return dir === 'asc' ? -1 : 1;
            if (as > bs) return dir === 'asc' ? 1 : -1;
            return 0;
        });
        return rows;
    }

    toggleSort(field) {
        if (this.sortState.field === field) {
            this.sortState.dir = this.sortState.dir === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortState.field = field;
            this.sortState.dir = 'asc';
        }
    }
    
    buildHierarchicalData(forms) {
        const districts = {};
        
        forms.forEach(form => {
            const districtName = form.district_name || 'Unknown District';
            const schoolName = form.school_name || 'Unknown School';
            
            if (!districts[districtName]) {
                districts[districtName] = {
                    id: `district-${districtName}`,
                    label: districtName,
                    children: []
                };
            }
            
            districts[districtName].children.push({
                id: `form-${form.id}`,
                label: `${schoolName} (${this.getStatusDisplay(form.status)})`,
                formData: form
            });
        });
        
        return Object.values(districts);
    }
    
    handleTreeItemClick(itemId) {
        if (itemId.startsWith('form-')) {
            const formId = parseInt(itemId.replace('form-', ''));
            this.viewForm(formId);
        }
    }
    
    switchToTableView() {
        this.currentView = 'table';
        
        const tableContainer = document.getElementById('table-container');
        const treeContainer = document.getElementById('tree-view-container');
        const tableBtn = document.getElementById('table-view-btn');
        const treeBtn = document.getElementById('tree-view-btn');
        
        tableContainer.style.display = 'block';
        treeContainer.style.display = 'none';
        
        tableBtn.classList.add('active');
        treeBtn.classList.remove('active');
        
        this.loadFormData(); // Reload data for table view
    }
    
    switchToTreeView() {
        this.currentView = 'tree';
        
        const tableContainer = document.getElementById('table-container');
        const treeContainer = document.getElementById('tree-view-container');
        const tableBtn = document.getElementById('table-view-btn');
        const treeBtn = document.getElementById('tree-view-btn');
        
        tableContainer.style.display = 'none';
        treeContainer.style.display = 'block';
        
        tableBtn.classList.remove('active');
        treeBtn.classList.add('active');
        
        this.loadFormData(); // Reload data for tree view
    }
    
    async viewForm(formId) {
        try {
            const response = await fetch(`/api/admin/form-management/forms/${formId}/`);
            const data = await response.json();
            
            if (data.success) {
                this.showFormModal(data.form);
            } else {
                this.showNotification(data.message || 'Failed to load form details', 'error');
            }
        } catch (error) {
            console.error('Failed to load form details:', error);
            this.showNotification('Failed to load form details', 'error');
        }
    }
    
    showFormModal(form) {
        const modal = document.getElementById('form-detail-modal');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        
        title.textContent = `Form Details - ${form.school_name}`;
        
        // Build form details HTML with MUI X Tree View for hierarchical display
        body.innerHTML = this.buildFormDetailsHTML(form);
        
        // Store current form for actions
        this.currentForm = form;
        
        modal.style.display = 'block';
        
        // Initialize tree view for form data display
        this.initializeFormDataTreeView(form);
    }
    
    buildFormDetailsHTML(form) {
        return `
            <div class="form-details">
                <div class="form-header">
                    <div class="form-info">
                        <h3>${form.school_name}</h3>
                        <p><strong>Status:</strong> <span class="status-badge ${this.getStatusClass(form.status)}">${this.getStatusDisplay(form.status)}</span></p>
                        <p><strong>Current Level:</strong> ${form.current_level}</p>
                        <p><strong>Academic Year:</strong> ${form.academic_year}</p>
                        <p><strong>Submitted:</strong> ${form.submitted_date ? new Date(form.submitted_date).toLocaleString() : 'Not submitted'}</p>
                    </div>
                </div>
                
                <div class="form-content">
                    <h4>Form Data</h4>
                    <div id="form-data-tree" style="height: 400px; border: 1px solid rgba(255,255,255,0.1); padding: 10px; border-radius: 8px;"></div>
                </div>
                
                <div class="form-actions">
                    <div class="comments-section">
                        <label for="approval-comments">Comments:</label>
                        <textarea id="approval-comments" rows="3" placeholder="Add comments for approval/return..."></textarea>
                    </div>
                </div>
            </div>
        `;
    }
    
    initializeFormDataTreeView(form) {
        const container = document.getElementById('form-data-tree');
        
        // Build hierarchical structure for form data
        const treeData = this.buildFormDataTree(form.answers || []);
        
        // Render nested list instead of MUI component
        const html = treeData.map(cat => `
            <div class="tree-cat">
                <div class="tree-district-label"><i class="fas fa-folder"></i> ${this.escapeHtml(cat.label)}</div>
                ${(cat.children || []).map(sub => `
                    <div class="tree-sub">
                        <div class="tree-district-label"><i class="fas fa-folder-open"></i> ${this.escapeHtml(sub.label)}</div>
                        <ul>
                            ${(sub.children || []).map(topic => `
                                <li>
                                    <div><strong>${this.escapeHtml(topic.label)}</strong></div>
                                    <ul>
                                        ${(topic.children || []).map(ans => `<li>${this.escapeHtml(ans.label)}</li>`).join('')}
                                    </ul>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
        `).join('');
        container.innerHTML = html || '<div>No data.</div>';
    }
    
    buildFormDataTree(answers) {
        // Group answers by category, subsection, topic
        const structure = {};
        
        answers.forEach(answer => {
            const category = answer.category_name || 'Uncategorized';
            const subsection = answer.subsection_name || 'Uncategorized';
            const topic = answer.topic_name || 'Uncategorized';
            
            if (!structure[category]) {
                structure[category] = {
                    id: `category-${category}`,
                    label: category,
                    children: {}
                };
            }
            
            if (!structure[category].children[subsection]) {
                structure[category].children[subsection] = {
                    id: `subsection-${category}-${subsection}`,
                    label: subsection,
                    children: {}
                };
            }
            
            if (!structure[category].children[subsection].children[topic]) {
                structure[category].children[subsection].children[topic] = {
                    id: `topic-${category}-${subsection}-${topic}`,
                    label: topic,
                    children: []
                };
            }
            
            structure[category].children[subsection].children[topic].children.push({
                id: `answer-${answer.question_id}`,
                label: `${answer.question_text}: ${answer.response || 'No response'}`
            });
        });
        
        // Convert to flat array structure for MUI Tree View
        return this.flattenTreeStructure(structure);
    }
    
    flattenTreeStructure(structure) {
        const result = [];
        
        Object.values(structure).forEach(category => {
            const categoryItem = {
                id: category.id,
                label: category.label,
                children: []
            };
            
            Object.values(category.children).forEach(subsection => {
                const subsectionItem = {
                    id: subsection.id,
                    label: subsection.label,
                    children: []
                };
                
                Object.values(subsection.children).forEach(topic => {
                    subsectionItem.children.push({
                        id: topic.id,
                        label: topic.label,
                        children: topic.children
                    });
                });
                
                categoryItem.children.push(subsectionItem);
            });
            
            result.push(categoryItem);
        });
        
        return result;
    }

    escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    async approveForm() {
        if (!this.currentForm) return;
        
        const comments = document.getElementById('approval-comments').value;
        
        try {
            const response = await fetch(`/api/admin/form-management/forms/${this.currentForm.id}/approve/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({ comments })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Form approved successfully', 'success');
                this.closeModal();
                this.loadFormData();
                this.loadStatistics();
            } else {
                this.showNotification(data.message || 'Failed to approve form', 'error');
            }
        } catch (error) {
            console.error('Failed to approve form:', error);
            this.showNotification('Failed to approve form', 'error');
        }
    }
    
    async returnForm() {
        if (!this.currentForm) return;
        
        const comments = document.getElementById('approval-comments').value;
        
        if (!comments.trim()) {
            this.showNotification('Please provide comments for returning the form', 'warning');
            return;
        }
        
        try {
            const response = await fetch(`/api/admin/form-management/forms/${this.currentForm.id}/return/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({ comments })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Form returned for revision', 'success');
                this.closeModal();
                this.loadFormData();
                this.loadStatistics();
            } else {
                this.showNotification(data.message || 'Failed to return form', 'error');
            }
        } catch (error) {
            console.error('Failed to return form:', error);
            this.showNotification('Failed to return form', 'error');
        }
    }
    
    async quickApprove(formId) {
        if (confirm('Are you sure you want to approve this form?')) {
            try {
                const response = await fetch(`/api/admin/form-management/forms/${formId}/approve/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCSRFToken()
                    },
                    body: JSON.stringify({ comments: 'Quick approval' })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.showNotification('Form approved successfully', 'success');
                    this.loadFormData();
                    this.loadStatistics();
                } else {
                    this.showNotification(data.message || 'Failed to approve form', 'error');
                }
            } catch (error) {
                console.error('Failed to approve form:', error);
                this.showNotification('Failed to approve form', 'error');
            }
        }
    }
    
    async quickReturn(formId) {
        const comments = prompt('Please provide comments for returning this form:');
        if (!comments) return;
        
        try {
            const response = await fetch(`/api/admin/form-management/forms/${formId}/return/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({ comments })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Form returned for revision', 'success');
                this.loadFormData();
                this.loadStatistics();
            } else {
                this.showNotification(data.message || 'Failed to return form', 'error');
            }
        } catch (error) {
            console.error('Failed to return form:', error);
            this.showNotification('Failed to return form', 'error');
        }
    }
    
    async bulkApprove() {
        if (this.selectedForms.size === 0) return;
        
        if (confirm(`Are you sure you want to approve ${this.selectedForms.size} forms?`)) {
            const comments = prompt('Please provide comments for bulk approval:');
            if (!comments) return;
            
            try {
                const response = await fetch('/api/admin/form-management/bulk-approve/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCSRFToken()
                    },
                    body: JSON.stringify({
                        form_ids: Array.from(this.selectedForms),
                        comments
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.showNotification(`Successfully approved ${data.approved_count} forms`, 'success');
                    this.selectedForms.clear();
                    this.updateBulkActions();
                    this.loadFormData();
                    this.loadStatistics();
                } else {
                    this.showNotification(data.message || 'Failed to approve forms', 'error');
                }
            } catch (error) {
                console.error('Failed to bulk approve forms:', error);
                this.showNotification('Failed to approve forms', 'error');
            }
        }
    }
    
    async bulkReturn() {
        if (this.selectedForms.size === 0) return;
        
        const comments = prompt('Please provide comments for returning these forms:');
        if (!comments) return;
        
        try {
            const response = await fetch('/api/admin/form-management/bulk-return/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    form_ids: Array.from(this.selectedForms),
                    comments
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification(`Successfully returned ${data.returned_count} forms`, 'success');
                this.selectedForms.clear();
                this.updateBulkActions();
                this.loadFormData();
                this.loadStatistics();
            } else {
                this.showNotification(data.message || 'Failed to return forms', 'error');
            }
        } catch (error) {
            console.error('Failed to bulk return forms:', error);
            this.showNotification('Failed to return forms', 'error');
        }
    }
    
    updateBulkActions() {
        const bulkApproveBtn = document.getElementById('bulk-approve-btn');
        const bulkReturnBtn = document.getElementById('bulk-return-btn');
        
        const hasSelection = this.selectedForms.size > 0;
        bulkApproveBtn.disabled = !hasSelection;
        bulkReturnBtn.disabled = !hasSelection;
        
        if (hasSelection) {
            bulkApproveBtn.innerHTML = `<i class="fas fa-check"></i> Bulk Approve (${this.selectedForms.size})`;
            bulkReturnBtn.innerHTML = `<i class="fas fa-undo"></i> Bulk Return (${this.selectedForms.size})`;
        } else {
            bulkApproveBtn.innerHTML = '<i class="fas fa-check"></i> Bulk Approve';
            bulkReturnBtn.innerHTML = '<i class="fas fa-undo"></i> Bulk Return';
        }
    }
    
    closeModal() {
        const modal = document.getElementById('form-detail-modal');
        modal.style.display = 'none';
        this.currentForm = null;
    }
    
    async exportData() {
        try {
            const params = new URLSearchParams(this.filters);
            const response = await fetch(`/api/admin/form-management/export/?${params}`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `form-data-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showNotification('Data exported successfully', 'success');
            } else {
                this.showNotification('Failed to export data', 'error');
            }
        } catch (error) {
            console.error('Failed to export data:', error);
            this.showNotification('Failed to export data', 'error');
        }
    }
    
    debounceSearch() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.loadFormData();
        }, 300);
    }
    
    setupNotifications() {
        // Poll for new notifications every 30 seconds
        setInterval(() => {
            this.checkNotifications();
        }, 30000);
    }
    
    async checkNotifications() {
        try {
            const response = await fetch('/api/admin/form-management/notifications/');
            const data = await response.json();
            
            if (data.notifications && data.notifications.length > 0) {
                data.notifications.forEach(notification => {
                    this.showNotification(notification.message, 'info');
                });
            }
        } catch (error) {
            console.error('Failed to check notifications:', error);
        }
    }
    
    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        container.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
    
    getStatusClass(status) {
        const classes = {
            'draft': 'draft',
            'submitted': 'submitted',
            'district_pending': 'pending',
            'district_approved': 'approved',
            'district_returned': 'returned',
            'division_pending': 'pending',
            'division_approved': 'approved',
            'division_returned': 'returned',
            'region_pending': 'pending',
            'region_approved': 'approved',
            'region_returned': 'returned',
            'central_pending': 'pending',
            'central_approved': 'approved',
            'central_returned': 'returned',
            'completed': 'completed'
        };
        return classes[status] || 'unknown';
    }
    
    getStatusDisplay(status) {
        const displays = {
            'draft': 'Draft',
            'submitted': 'Submitted',
            'district_pending': 'Pending District Review',
            'district_approved': 'District Approved',
            'district_returned': 'Returned to School',
            'division_pending': 'Pending Division Review',
            'division_approved': 'Division Approved',
            'division_returned': 'Returned to District',
            'region_pending': 'Pending Region Review',
            'region_approved': 'Region Approved',
            'region_returned': 'Returned to Division',
            'central_pending': 'Pending Central Review',
            'central_approved': 'Central Approved',
            'central_returned': 'Returned to Region',
            'completed': 'Completed'
        };
        return displays[status] || status;
    }
    
    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
               document.querySelector('meta[name="csrf-token"]')?.content || '';
    }
}

// Initialize the form management system when the page loads
let formManager;
document.addEventListener('DOMContentLoaded', () => {
    formManager = new FormManagementSystem();
});
