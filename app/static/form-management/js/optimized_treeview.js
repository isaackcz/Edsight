/**
 * Optimized Treeview Component for Form Management
 * Implements hierarchical lazy loading to prevent database overload
 * Features GitHub-style loading animations and client-side search
 */

class OptimizedTreeviewManager {
    constructor() {
        this.currentSelection = null;
        this.currentNodeType = null;
        this.expandedNodes = new Set();
        this.loadedData = {
            regions: [],
            divisions: {},
            districts: {},
            schools: {}
        };
        this.selectedSchools = new Set();
        this.searchTerm = '';
        this.filteredSchools = [];
        this.abortController = null;
        
        // Pagination properties
        this.currentPage = 1;
        this.pageSize = 25;
        this.totalPages = 0;
        this.totalSchools = 0;
        this.paginationData = null;
        
        this.init();
    }
    
    async init() {
        try {
            // console.log('OptimizedTreeviewManager: Initializing...');
            this.setupEventListeners();
            await this.loadRegions();
            this.renderTree();
            // console.log('OptimizedTreeviewManager: Initialization complete');
        } catch (error) {
            console.error('Failed to initialize optimized treeview:', error);
            this.showError('Failed to load organizational structure');
        }
    }
    
    setupEventListeners() {
        // Tree node clicks
        document.addEventListener('click', (e) => {
            const nodeItem = e.target.closest('.tree-node-item');
            if (nodeItem) {
                this.handleNodeClick(nodeItem);
            }
        });
        
        // Search functionality
        const searchInput = document.getElementById('school-search-input');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                
                // Debounce search to avoid too many API calls
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterSchools();
                }, 300); // Wait 300ms after user stops typing
            });
        }
        
        // School selection
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('school-select-checkbox') || e.target.closest('.school-select-checkbox')) {
                this.handleSchoolSelection(e.target.closest('.school-select-checkbox') || e.target);
            }
        });
        
        // Select all checkbox
        document.addEventListener('click', (e) => {
            if (e.target.id === 'select-all-schools') {
                this.handleSelectAll(e.target);
            }
        });
        
        // School action buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('.school-action-btn')) {
                this.handleSchoolAction(e.target.closest('.school-action-btn'));
            }
        });
        
        // View forms button
        const viewFormsBtn = document.getElementById('view-forms-btn');
        if (viewFormsBtn) {
            viewFormsBtn.addEventListener('click', () => {
                this.viewSelectedSchoolForms();
            });
        }
        
        // Export button
        const exportBtn = document.getElementById('export-schools-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportSelectedSchools();
            });
        }
        
        // Pagination controls
        const prevPageBtn = document.getElementById('prev-page-btn');
        const nextPageBtn = document.getElementById('next-page-btn');
        const pageSizeSelect = document.getElementById('page-size-select');
        
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                this.goToPage(this.currentPage - 1);
            });
        }
        
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                this.goToPage(this.currentPage + 1);
            });
        }
        
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.setPageSize(parseInt(e.target.value));
            });
        }
    }
    
    async loadRegions() {
        try {
            // console.log('OptimizedTreeviewManager: Loading regions...');
            this.showTreeviewLoadingState();
            const response = await fetch('/api/form-management/regions/');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            // console.log('OptimizedTreeviewManager: Regions response:', data);
            
            if (data.success) {
                this.loadedData.regions = data.regions;
                // console.log('OptimizedTreeviewManager: Loaded regions:', data.regions);
                this.renderTree();
            } else {
                throw new Error(data.error || 'Failed to load regions');
            }
        } catch (error) {
            console.error('Failed to load regions:', error);
            this.showError('Failed to load regions: ' + error.message);
        }
    }
    
    async loadDivisions(regionId) {
        try {
            // console.log('Loading divisions for region:', regionId);
            this.showNodeLoadingState(regionId);
            const response = await fetch(`/api/form-management/divisions/?region_id=${regionId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            // console.log('Divisions response:', data);
            
            if (data.success) {
                this.loadedData.divisions[regionId] = data.divisions;
                // console.log('Loaded divisions:', data.divisions);
                this.clearNodeLoadingState(regionId);
                this.renderTree();
            } else {
                throw new Error(data.error || 'Failed to load divisions');
            }
        } catch (error) {
            console.error('Failed to load divisions:', error);
            this.clearNodeLoadingState(regionId);
            this.showError('Failed to load divisions: ' + error.message);
        }
    }
    
    async loadDistricts(divisionId) {
        try {
            this.showNodeLoadingState(divisionId);
            const response = await fetch(`/api/form-management/districts/?division_id=${divisionId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.loadedData.districts[divisionId] = data.districts;
                this.clearNodeLoadingState(divisionId);
                this.renderTree();
            } else {
                throw new Error(data.error || 'Failed to load districts');
            }
        } catch (error) {
            console.error('Failed to load districts:', error);
            this.clearNodeLoadingState(divisionId);
            this.showError('Failed to load districts: ' + error.message);
        }
    }
    
    async loadSchools(districtId, page = 1, pageSize = 25) {
        try {
            this.showNodeLoadingState(districtId);
            const response = await fetch(`/api/form-management/schools-table/?district_id=${districtId}&page=${page}&page_size=${pageSize}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.loadedData.schools[districtId] = data.schools;
                this.filteredSchools = data.schools;
                this.paginationData = data.pagination;
                this.currentPage = data.pagination.current_page;
                this.pageSize = data.pagination.page_size;
                this.totalPages = data.pagination.total_pages;
                this.totalSchools = data.pagination.total_schools;
                
                this.clearNodeLoadingState(districtId);
                this.renderSchools(); // This renders the MUI table
                this.renderPagination();
                // Don't call renderTree() here as it might interfere with the tree structure
            } else {
                throw new Error(data.error || 'Failed to load schools');
            }
        } catch (error) {
            console.error('Failed to load schools:', error);
            this.clearNodeLoadingState(districtId);
            this.showError('Failed to load schools: ' + error.message);
        }
    }
    
    renderTree() {
        // console.log('OptimizedTreeviewManager: Rendering tree...');
        const container = document.getElementById('hierarchy-tree');
        if (!container) {
            console.error('OptimizedTreeviewManager: hierarchy-tree container not found!');
            return;
        }
        
        // console.log('OptimizedTreeviewManager: Container found, regions count:', this.loadedData.regions.length);
        
        if (this.loadedData.regions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ph-bold ph-folder-open"></i>
                    <h3>No Regions Available</h3>
                    <p>No regions found in the system.</p>
                </div>
            `;
            return;
        }
        
        const html = this.buildTreeHTML(this.loadedData.regions);
        // console.log('OptimizedTreeviewManager: Generated HTML:', html);
        container.innerHTML = html;
        // console.log('OptimizedTreeviewManager: Tree rendered successfully');
    }
    
    buildTreeHTML(regions, level = 0) {
        return regions.map(region => {
            const isExpanded = this.expandedNodes.has(region.id);
            // Extract actual ID from region.id (e.g., 'region-1' -> '1')
            const actualRegionId = region.id.split('-')[1];
            const hasDivisions = this.loadedData.divisions[actualRegionId] && this.loadedData.divisions[actualRegionId].length > 0;
            const isSelected = this.currentSelection === region.id;
            
            return `
                <div class="tree-node" data-level="${level}">
                    <div class="tree-node-item ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}" 
                         data-id="${region.id}" 
                         data-type="region"
                         data-level="${level}">
                        <div class="tree-expand-icon ${isExpanded ? 'expanded' : ''}">
                            <i class="ph-bold ph-caret-right"></i>
                        </div>
                        
                        <div class="tree-node-icon">
                            <i class="ph-bold ph-map-pin"></i>
                        </div>
                        
                        <div class="tree-node-label">${this.escapeHtml(region.name || 'Unnamed Region')}</div>
                        
                        <div class="tree-node-count">${region.school_count || 0}</div>
                    </div>
                    
                    ${isExpanded ? `
                        <div class="tree-children">
                            ${this.renderDivisions(actualRegionId, level + 1)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
    
    renderDivisions(regionId, level) {
        const divisions = this.loadedData.divisions[regionId] || [];
        return divisions.map(division => {
            const isExpanded = this.expandedNodes.has(division.id);
            // Extract actual ID from division.id (e.g., 'division-1' -> '1')
            const actualDivisionId = division.id.split('-')[1];
            const hasDistricts = this.loadedData.districts[actualDivisionId] && this.loadedData.districts[actualDivisionId].length > 0;
            const isSelected = this.currentSelection === division.id;
            
            return `
                <div class="tree-node" data-level="${level}">
                    <div class="tree-node-item ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}" 
                         data-id="${division.id}" 
                         data-type="division"
                         data-level="${level}">
                        <div class="tree-expand-icon ${isExpanded ? 'expanded' : ''}">
                            <i class="ph-bold ph-caret-right"></i>
                        </div>
                        
                        <div class="tree-node-icon">
                            <i class="ph-bold ph-buildings"></i>
                        </div>
                        
                        <div class="tree-node-label">${this.escapeHtml(division.name || 'Unnamed Division')}</div>
                        
                        <div class="tree-node-count">${division.school_count || 0}</div>
                    </div>
                    
                    ${isExpanded ? `
                        <div class="tree-children">
                            ${this.renderDistricts(actualDivisionId, level + 1)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
    
    renderDistricts(divisionId, level) {
        const districts = this.loadedData.districts[divisionId] || [];
        return districts.map(district => {
            const isExpanded = this.expandedNodes.has(district.id);
            // Extract actual ID from district.id (e.g., 'district-1' -> '1')
            const actualDistrictId = district.id.split('-')[1];
            const hasSchools = this.loadedData.schools[actualDistrictId] && this.loadedData.schools[actualDistrictId].length > 0;
            const isSelected = this.currentSelection === district.id;
            
            return `
                <div class="tree-node" data-level="${level}">
                    <div class="tree-node-item ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}" 
                         data-id="${district.id}" 
                         data-type="district"
                         data-level="${level}">
                        <div class="tree-expand-icon ${isExpanded ? 'expanded' : ''}">
                            <i class="ph-bold ph-caret-right"></i>
                        </div>
                        
                        <div class="tree-node-icon">
                            <i class="ph-bold ph-map"></i>
                        </div>
                        
                        <div class="tree-node-label">${this.escapeHtml(district.name || 'Unnamed District')}</div>
                        
                        <div class="tree-node-count">${district.school_count || 0}</div>
                    </div>
                    
                    ${isExpanded ? `
                        <div class="tree-children">
                            <!-- Schools are displayed in the MUI table, not in the tree -->
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
    
    renderSchools(districtId, level) {
        // Schools are now displayed in the MUI table, not in the tree
        // This method is kept for compatibility but returns empty string
        return '';
    }
    
    handleNodeClick(nodeItem) {
        const nodeId = nodeItem.dataset.id;
        const nodeType = nodeItem.dataset.type;
        const hasChildren = nodeItem.querySelector('.tree-expand-icon i');
        
        // console.log('Node clicked:', { nodeId, nodeType, hasChildren: !!hasChildren });
        
        // Toggle expansion for nodes with children
        if (hasChildren) {
            this.toggleNodeExpansion(nodeId, nodeType);
        }
        
        // Update selection
        this.updateSelection(nodeId, nodeType);
        
        // Load children if not already loaded
        this.loadChildrenIfNeeded(nodeId, nodeType);
    }
    
    toggleNodeExpansion(nodeId, nodeType) {
        if (this.expandedNodes.has(nodeId)) {
            this.expandedNodes.delete(nodeId);
        } else {
            this.expandedNodes.add(nodeId);
        }
        
        this.renderTree();
    }
    
    updateSelection(nodeId, nodeType) {
        this.currentSelection = nodeId;
        this.currentNodeType = nodeType;
        
        // Update visual selection
        document.querySelectorAll('.tree-node-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const selectedItem = document.querySelector(`[data-id="${nodeId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
        
        // Update content title
        this.updateContentTitle(nodeId, nodeType);
    }
    
    updateContentTitle(nodeId, nodeType) {
        const titleElement = document.getElementById('content-title');
        const subtitleElement = document.getElementById('content-subtitle');
        
        if (!titleElement || !subtitleElement) return;
        
        let nodeName = '';
        let count = 0;
        
        if (nodeType === 'region') {
            const region = this.loadedData.regions.find(r => r.id == nodeId);
            nodeName = region?.name || 'Unknown Region';
            count = this.loadedData.divisions[nodeId]?.length || 0;
            subtitleElement.textContent = `Select a division to view districts`;
        } else if (nodeType === 'division') {
            const division = this.loadedData.divisions[Object.keys(this.loadedData.divisions).find(key => 
                this.loadedData.divisions[key].some(d => d.id == nodeId)
            )]?.find(d => d.id == nodeId);
            nodeName = division?.name || 'Unknown Division';
            count = this.loadedData.districts[nodeId]?.length || 0;
            subtitleElement.textContent = `Select a district to view schools`;
        } else if (nodeType === 'district') {
            const district = this.loadedData.districts[Object.keys(this.loadedData.districts).find(key => 
                this.loadedData.districts[key].some(d => d.id == nodeId)
            )]?.find(d => d.id == nodeId);
            nodeName = district?.name || 'Unknown District';
            count = this.totalSchools || 0;
            subtitleElement.textContent = `${count} schools found - Select a school to view forms`;
        } else if (nodeType === 'school') {
            const school = this.loadedData.schools[Object.keys(this.loadedData.schools).find(key => 
                this.loadedData.schools[key].some(s => s.id == nodeId)
            )]?.find(s => s.id == nodeId);
            nodeName = school?.school_name || 'Unknown School';
            count = 1;
            subtitleElement.textContent = `School details and forms`;
        }
        
        titleElement.textContent = nodeName;
    }
    
    getNodeTypeLabel(type) {
        const labels = {
            'region': 'Region',
            'division': 'Division', 
            'district': 'District',
            'school': 'School'
        };
        return labels[type] || 'Location';
    }
    
    async loadChildrenIfNeeded(nodeId, nodeType) {
        // Extract the actual ID from the nodeId (e.g., 'region-1' -> '1')
        const actualId = nodeId.split('-')[1];
        
        // console.log('loadChildrenIfNeeded:', { nodeId, nodeType, actualId });
        
        if (nodeType === 'region' && !this.loadedData.divisions[actualId]) {
            // console.log('Loading divisions for region:', actualId);
            await this.loadDivisions(actualId);
        } else if (nodeType === 'division' && !this.loadedData.districts[actualId]) {
            // console.log('Loading districts for division:', actualId);
            await this.loadDistricts(actualId);
        } else if (nodeType === 'district' && !this.loadedData.schools[actualId]) {
            // console.log('Loading schools for district:', actualId);
            await this.loadSchools(actualId, 1, this.pageSize);
        }
    }
    
    renderSchools() {
        const container = document.getElementById('schools-list');
        if (!container) return;
        
        if (this.filteredSchools.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ph-bold ph-school"></i>
                    <h3>No Schools Found</h3>
                    <p>No schools in this location have submitted forms yet.</p>
                </div>
            `;
            // Still show pagination even when no results
            return;
        }
        
        // Create MUI-style table for schools
        const html = `
            <div class="mui-table-container">
                <table class="mui-table">
                    <thead>
                        <tr>
                            <th class="select-column">
                                <label class="select-all-checkbox">
                                    <input type="checkbox" id="select-all-schools">
                                    <span>Select All</span>
                                </label>
                            </th>
                            <th>School Name</th>
                            <th>School ID</th>
                            <th>Region Validation</th>
                            <th>Division Validation</th>
                            <th>District Validation</th>
                            <th class="actions-column">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.filteredSchools.map(school => `
                            <tr class="school-row" data-school-id="${school.id}">
                                <td class="select-cell">
                                    <label class="school-select-checkbox">
                                        <input type="checkbox" data-school-id="${school.id}">
                                        <span>Select</span>
                                    </label>
                                </td>
                                <td class="school-name-cell">
                                    <div class="school-name">${this.escapeHtml(school.school_name || 'Unnamed School')}</div>
                                </td>
                                <td class="school-id-cell">
                                    <div class="school-id">${this.escapeHtml(school.school_id || 'N/A')}</div>
                                </td>
                                <td class="validation-cell">
                                    <div class="validation-status">-</div>
                                </td>
                                <td class="validation-cell">
                                    <div class="validation-status">-</div>
                                </td>
                                <td class="validation-cell">
                                    <div class="validation-status">-</div>
                                </td>
                                <td class="actions-cell">
                                    <div class="action-buttons">
                                        <button class="school-action-btn primary" data-school-id="${school.id}" data-action="view-forms" title="View Forms">
                                            <i class="ph-bold ph-eye"></i>
                                        </button>
                                        <button class="school-action-btn" data-school-id="${school.id}" data-action="view-details" title="View Details">
                                            <i class="ph-bold ph-info"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Setup select all functionality
        this.setupSelectAllCheckbox();
    }
    
    renderPagination() {
        const container = document.getElementById('pagination-container');
        const infoText = document.getElementById('pagination-info-text');
        const pagesContainer = document.getElementById('pagination-pages');
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        const pageSizeSelect = document.getElementById('page-size-select');
        
        if (!container || !this.paginationData) return;
        
        // Always show pagination, even for single page results
        container.style.display = 'flex';
        
        // Update info text
        const startItem = ((this.currentPage - 1) * this.pageSize) + 1;
        const endItem = Math.min(this.currentPage * this.pageSize, this.totalSchools);
        infoText.textContent = `Showing ${startItem}-${endItem} of ${this.totalSchools} schools`;
        
        // Update page size selector
        if (pageSizeSelect) {
            pageSizeSelect.value = this.pageSize;
        }
        
        // Update navigation buttons
        if (prevBtn) {
            prevBtn.disabled = !this.paginationData.has_previous;
        }
        if (nextBtn) {
            nextBtn.disabled = !this.paginationData.has_next;
        }
        
        // Generate page numbers
        if (pagesContainer) {
            const pages = this.generatePageNumbers();
            pagesContainer.innerHTML = pages.map(page => {
                if (page === '...') {
                    return '<span class="pagination-ellipsis">...</span>';
                }
                return `<button class="pagination-btn ${page === this.currentPage ? 'active' : ''}" 
                        data-page="${page}" onclick="treeviewManager.goToPage(${page})">${page}</button>`;
            }).join('');
        }
    }
    
    generatePageNumbers() {
        const pages = [];
        const maxVisible = 5;
        
        if (this.totalPages <= maxVisible) {
            for (let i = 1; i <= this.totalPages; i++) {
                pages.push(i);
            }
        } else {
            const start = Math.max(1, this.currentPage - 2);
            const end = Math.min(this.totalPages, start + maxVisible - 1);
            
            if (start > 1) {
                pages.push(1);
                if (start > 2) {
                    pages.push('...');
                }
            }
            
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
            
            if (end < this.totalPages) {
                if (end < this.totalPages - 1) {
                    pages.push('...');
                }
                pages.push(this.totalPages);
            }
        }
        
        return pages;
    }
    
    hidePagination() {
        const container = document.getElementById('pagination-container');
        if (container) {
            container.style.display = 'none';
        }
    }
    
    goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) return;
        
        this.currentPage = page;
        const actualId = this.currentSelection.split('-')[1];
        this.loadSchools(actualId, page, this.pageSize);
    }
    
    setPageSize(newPageSize) {
        if (newPageSize === this.pageSize) return;
        
        this.pageSize = newPageSize;
        this.currentPage = 1;
        const actualId = this.currentSelection.split('-')[1];
        this.loadSchools(actualId, 1, newPageSize);
    }
    
    async filterSchools() {
        const actualId = this.currentSelection.split('-')[1];
        if (!actualId) return;
        
        // Reset to page 1 when searching (but keep current page when clearing search)
        const pageToLoad = this.searchTerm ? 1 : this.currentPage;
        
        // Always reload schools from server with search term
        // This ensures we search across all schools, not just the current page
        try {
            this.showNodeLoadingState(this.currentSelection);
            const response = await fetch(`/api/form-management/schools-table/?district_id=${actualId}&page=${pageToLoad}&page_size=${this.pageSize}&search=${encodeURIComponent(this.searchTerm)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.loadedData.schools[actualId] = data.schools;
                this.filteredSchools = data.schools;
                this.paginationData = data.pagination;
                this.currentPage = data.pagination.current_page;
                this.pageSize = data.pagination.page_size;
                this.totalPages = data.pagination.total_pages;
                this.totalSchools = data.pagination.total_schools;
                
                this.clearNodeLoadingState(this.currentSelection);
                this.renderSchools();
                
                // Always show pagination
                this.renderPagination();
            } else {
                throw new Error(data.error || 'Failed to load schools');
            }
        } catch (error) {
            console.error('Failed to filter schools:', error);
            this.clearNodeLoadingState(this.currentSelection);
            this.showError('Failed to search schools: ' + error.message);
        }
    }
    
    setupSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('select-all-schools');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                this.handleSelectAll(e.target);
            });
        }
    }
    
    handleSelectAll(selectAllCheckbox) {
        const isChecked = selectAllCheckbox.checked;
        const schoolCheckboxes = document.querySelectorAll('.school-select-checkbox input[type="checkbox"]:not(#select-all-schools)');
        
        schoolCheckboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
            const schoolId = parseInt(checkbox.dataset.schoolId);
            
            if (isChecked) {
                this.selectedSchools.add(schoolId);
            } else {
                this.selectedSchools.delete(schoolId);
            }
        });
        
        this.updateActionButtons();
    }
    
    handleSchoolSelection(checkbox) {
        const input = checkbox.querySelector('input[type="checkbox"]');
        if (!input) return;
        
        const schoolId = parseInt(input.dataset.schoolId);
        
        if (input.checked) {
            this.selectedSchools.add(schoolId);
        } else {
            this.selectedSchools.delete(schoolId);
        }
        
        this.updateSelectAllState();
        this.updateActionButtons();
    }
    
    updateSelectAllState() {
        const selectAllCheckbox = document.getElementById('select-all-schools');
        if (!selectAllCheckbox) return;
        
        const schoolCheckboxes = document.querySelectorAll('.school-select-checkbox input[type="checkbox"]:not(#select-all-schools)');
        const checkedCheckboxes = document.querySelectorAll('.school-select-checkbox input[type="checkbox"]:not(#select-all-schools):checked');
        
        if (checkedCheckboxes.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCheckboxes.length === schoolCheckboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
    
    handleSchoolAction(button) {
        const schoolId = parseInt(button.dataset.schoolId);
        const action = button.dataset.action;
        
        switch (action) {
            case 'view-forms':
                this.viewSchoolForms(schoolId);
                break;
            case 'view-details':
                this.viewSchoolDetails(schoolId);
                break;
        }
    }
    
    async viewSchoolForms(schoolId) {
        try {
            window.location.href = `/form-management/?school_id=${schoolId}`;
        } catch (error) {
            console.error('Failed to view school forms:', error);
            this.showError('Failed to load school forms');
        }
    }
    
    async viewSchoolDetails(schoolId) {
        try {
            const school = this.filteredSchools.find(s => s.id == schoolId);
            if (school) {
                this.showSchoolDetailsModal(school);
            }
        } catch (error) {
            console.error('Failed to view school details:', error);
            this.showError('Failed to load school details');
        }
    }
    
    showSchoolDetailsModal(school) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>School Details - ${this.escapeHtml(school.school_name)}</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="school-details-content">
                        <div class="detail-group">
                            <h4>Basic Information</h4>
                            <p><strong>School Name:</strong> ${this.escapeHtml(school.school_name)}</p>
                            <p><strong>School ID:</strong> ${this.escapeHtml(school.id || 'N/A')}</p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn outline" onclick="this.closest('.modal').remove()">Close</button>
                    <button class="btn primary" onclick="optimizedTreeviewManager.viewSchoolForms(${school.id}); this.closest('.modal').remove()">
                        <i class="ph-bold ph-eye"></i>
                        View Forms
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    viewSelectedSchoolForms() {
        if (this.selectedSchools.size === 0) {
            this.showError('Please select at least one school');
            return;
        }
        
        const schoolIds = Array.from(this.selectedSchools).join(',');
        window.location.href = `/form-management/?school_ids=${schoolIds}`;
    }
    
    async exportSelectedSchools() {
        if (this.selectedSchools.size === 0) {
            this.showError('Please select at least one school');
            return;
        }
        
        try {
            const schoolIds = Array.from(this.selectedSchools);
            const response = await fetch('/api/admin/form-management/export-schools/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({ school_ids: schoolIds })
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `schools-export-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showSuccess('Schools exported successfully');
            } else {
                throw new Error('Failed to export schools');
            }
        } catch (error) {
            console.error('Failed to export schools:', error);
            this.showError('Failed to export schools');
        }
    }
    
    updateActionButtons() {
        const viewFormsBtn = document.getElementById('view-forms-btn');
        const exportBtn = document.getElementById('export-schools-btn');
        
        const hasSelection = this.selectedSchools.size > 0;
        
        if (viewFormsBtn) {
            viewFormsBtn.disabled = !hasSelection;
            viewFormsBtn.textContent = hasSelection ? 
                `View Forms (${this.selectedSchools.size})` : 'View Forms';
        }
        
        if (exportBtn) {
            exportBtn.disabled = !hasSelection;
            exportBtn.textContent = hasSelection ? 
                `Export (${this.selectedSchools.size})` : 'Export';
        }
    }
    
    showTreeviewLoadingState() {
        const container = document.getElementById('hierarchy-tree');
        if (container) {
            container.innerHTML = `
                <div class="github-loading">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Loading regions...</div>
                </div>
            `;
        }
    }
    
    showNodeLoadingState(nodeId) {
        const nodeItem = document.querySelector(`[data-id="${nodeId}"]`);
        if (nodeItem) {
            // Add loading class to the node
            nodeItem.classList.add('tree-node-loading');
            
            // Show loading spinner in the count area
            const countElement = nodeItem.querySelector('.tree-node-count');
            if (countElement) {
                countElement.innerHTML = `
                    <div class="loading-text">
                        <div class="node-loading-spinner"></div>
                        Loading...
                    </div>
                `;
            }
            
            // Show loading state in the expand icon
            const expandIcon = nodeItem.querySelector('.tree-expand-icon i');
            if (expandIcon) {
                expandIcon.style.display = 'none';
                const spinner = document.createElement('div');
                spinner.className = 'node-loading-spinner';
                spinner.style.width = '12px';
                spinner.style.height = '12px';
                nodeItem.querySelector('.tree-expand-icon').appendChild(spinner);
            }
        }
    }
    
    clearNodeLoadingState(nodeId) {
        const nodeItem = document.querySelector(`[data-id="${nodeId}"]`);
        if (nodeItem) {
            // Remove loading class
            nodeItem.classList.remove('tree-node-loading');
            
            // Restore expand icon
            const expandIcon = nodeItem.querySelector('.tree-expand-icon i');
            const spinner = nodeItem.querySelector('.tree-expand-icon .node-loading-spinner');
            if (expandIcon) {
                expandIcon.style.display = 'block';
            }
            if (spinner) {
                spinner.remove();
            }
        }
    }
    
    showError(message) {
        const container = document.getElementById('schools-list');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ph-bold ph-warning-circle"></i>
                    <h3>Error</h3>
                    <p>${this.escapeHtml(message)}</p>
                </div>
            `;
        }
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container') || document.body;
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="ph-bold ph-${this.getNotificationIcon(type)}"></i>
                <span>${this.escapeHtml(message)}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="ph-bold ph-x"></i>
                </button>
            </div>
        `;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'warning-circle',
            'warning': 'warning',
            'info': 'info'
        };
        return icons[type] || 'info';
    }
    
    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
               document.querySelector('meta[name="csrf-token"]')?.content || '';
    }
    
    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    cleanup() {
        if (this.abortController) {
            this.abortController.abort();
        }
        
        this.selectedSchools.clear();
        this.expandedNodes.clear();
        this.loadedData = {
            regions: [],
            divisions: {},
            districts: {},
            schools: {}
        };
        this.filteredSchools = [];
    }
}

// Initialize optimized treeview manager when DOM is loaded
let optimizedTreeviewManager;
document.addEventListener('DOMContentLoaded', () => {
    window.treeviewManager = new OptimizedTreeviewManager();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.treeviewManager) {
        window.treeviewManager.cleanup();
    }
});
