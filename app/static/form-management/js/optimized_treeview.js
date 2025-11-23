
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
        
        // Admin scope properties
        this.adminScope = null;
        
        // Initialize workflow manager
        this.workflowManager = new FormWorkflowManager();
        
        this.init();
    }

    isCentralAdminScope() {
        return this.adminScope && this.adminScope.admin_level === 'central';
    }
    
    async init() {
        try {
            // console.log('OptimizedTreeviewManager: Initializing...');
            this.setupEventListeners();
            
            // Load admin scope and regions in parallel for faster initialization
            const [adminScopeResult, regionsResult] = await Promise.allSettled([
                this.loadAdminScope(),
                this.loadRegions()
            ]);
            
            // Handle admin scope result
            if (adminScopeResult.status === 'rejected') {
                console.warn('Failed to load admin scope:', adminScopeResult.reason);
            }
            
            // Handle regions result
            if (regionsResult.status === 'rejected') {
                throw new Error('Failed to load regions: ' + regionsResult.reason);
            }
            
            this.renderTree();
            
            // Auto-expand tree based on admin level
            if (this.adminScope && this.adminScope.auto_expand_levels.length > 0) {
                await this.autoExpandTreePath();
            }
            
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
        
        // Action menu button clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.action-menu-btn')) {
                e.stopPropagation();
                const btn = e.target.closest('.action-menu-btn');
                const schoolId = btn.dataset.schoolId;
                
                // Check if tooltip already exists for this button
                const existingTooltip = document.querySelector('.action-menu-tooltip');
                if (existingTooltip) {
                    existingTooltip.remove();
                }
                
                this.showActionMenu(schoolId);
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
    
    async loadAdminScope() {
        try {
            const response = await fetch('/api/form-management/admin-scope/');
            
            if (!response.ok) {
                // If admin scope endpoint fails, continue without auto-expand
                console.warn('Failed to load admin scope, continuing without auto-expand');
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.adminScope = {
                    admin_level: data.admin_level,
                    region_id: data.region_id,
                    division_id: data.division_id,
                    district_id: data.district_id,
                    auto_expand_levels: data.auto_expand_levels || []
                };
            }
        } catch (error) {
            // Silently fail - admin scope is optional for auto-expand feature
            console.warn('Could not load admin scope:', error);
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
    
    async autoExpandTreePath() {
        if (!this.adminScope || !this.adminScope.auto_expand_levels.length) {
            return;
        }
        
        try {
            // Sequential expansion to prevent system overload
            // Step 1: Expand and load region
            if (this.adminScope.auto_expand_levels.includes('region') && this.adminScope.region_id) {
                const regionId = `region-${this.adminScope.region_id}`;
                const region = this.loadedData.regions.find(r => r.id === regionId);
                
                if (region) {
                    // Expand region
                    this.expandedNodes.add(regionId);
                    this.renderTree();
                    
                    // Load divisions for this region
                    await this.loadDivisions(this.adminScope.region_id);
                    
                    // Step 2: Expand and load division (if needed)
                    if (this.adminScope.auto_expand_levels.includes('division') && this.adminScope.division_id) {
                        const divisionId = `division-${this.adminScope.division_id}`;
                        const divisions = this.loadedData.divisions[this.adminScope.region_id] || [];
                        const division = divisions.find(d => d.id === divisionId);
                        
                        if (division) {
                            // Expand division
                            this.expandedNodes.add(divisionId);
                            this.renderTree();
                            
                            // Load districts for this division
                            await this.loadDistricts(this.adminScope.division_id);
                            
                            // Step 3: Expand and load district (if needed)
                            if (this.adminScope.auto_expand_levels.includes('district') && this.adminScope.district_id) {
                                const districtId = `district-${this.adminScope.district_id}`;
                                const districts = this.loadedData.districts[this.adminScope.division_id] || [];
                                const district = districts.find(d => d.id === districtId);
                                
                                if (district) {
                                    // Expand district and load schools
                                    this.expandedNodes.add(districtId);
                                    this.updateSelection(districtId, 'district');
                                    this.renderTree();
                                    
                                    // Load schools for this district
                                    await this.loadSchools(this.adminScope.district_id, 1, this.pageSize);
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to auto-expand tree path:', error);
            // Don't show error to user - auto-expand is a convenience feature
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
                            <th>Date Submitted</th>
                            <th>Workflow Status</th>
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
                                <td class="status-cell">
                                    <div class="status-badge">${this.formatDateOnly(school.submitted_at) || '-'}</div>
                                </td>
                                <td class="workflow-cell">
                                    <div class="status-badge">${this.escapeHtml(school.workflow_status || '-')}</div>
                                </td>
                                <td class="actions-cell">
                                    <button class="action-menu-btn" data-school-id="${school.id}" title="Actions">
                                        <i class="ph-bold ph-dots-three-vertical"></i>
                                        </button>
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
    
    showActionMenu(schoolId) {
        // Remove any existing tooltips
        const existingTooltips = document.querySelectorAll('.action-menu-tooltip');
        existingTooltips.forEach(tooltip => tooltip.remove());
        
        // Find the button that triggered this
        const button = document.querySelector(`.action-menu-btn[data-school-id="${schoolId}"]`);
        if (!button) return;
        
        // Get button position
        const rect = button.getBoundingClientRect();
        
        // Create tooltip container
        const tooltip = document.createElement('div');
        tooltip.className = 'action-menu-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            top: ${rect.bottom + 8}px;
            right: ${window.innerWidth - rect.right}px;
            background: white;
            border-radius: 8px;
            padding: 8px;
            min-width: 180px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            animation: tooltipFadeIn 0.2s ease;
        `;
        
        tooltip.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <button class="action-menu-item" data-action="view" style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    border: none;
                    background: transparent;
                    color: #334155;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.875rem;
                    font-weight: 500;
                    transition: all 0.15s ease;
                    text-align: left;
                    width: 100%;
                ">
                    <i class="ph-bold ph-eye" style="font-size: 18px; color: #3b82f6;"></i>
                    <span>View</span>
                </button>
                <button class="action-menu-item" data-action="approve" style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    border: none;
                    background: transparent;
                    color: #334155;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.875rem;
                    font-weight: 500;
                    transition: all 0.15s ease;
                    text-align: left;
                    width: 100%;
                ">
                    <i class="ph-bold ph-check-circle" style="font-size: 18px; color: #16a34a;"></i>
                    <span>Approve</span>
                </button>
                <button class="action-menu-item" data-action="clear-remarks" style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    border: none;
                    background: transparent;
                    color: #334155;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.875rem;
                    font-weight: 500;
                    transition: all 0.15s ease;
                    text-align: left;
                    width: 100%;
                ">
                    <i class="ph-bold ph-broom" style="font-size: 18px; color: #6366f1;"></i>
                    <span>Clear Remarks</span>
                </button>
                <button class="action-menu-item" data-action="return" style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    border: none;
                    background: transparent;
                    color: #334155;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.875rem;
                    font-weight: 500;
                    transition: all 0.15s ease;
                    text-align: left;
                    width: 100%;
                ">
                    <i class="ph-bold ph-arrow-counter-clockwise" style="font-size: 18px; color: #d97706;"></i>
                    <span>Return</span>
                </button>
            </div>
        `;
        
        // Add hover styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes tooltipFadeIn {
                from {
                    opacity: 0;
                    transform: translateY(-4px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            .action-menu-item:hover {
                background: #f8fafc !important;
            }
            .action-menu-item[data-action="view"]:hover {
                background: #eff6ff !important;
                color: #3b82f6 !important;
            }
            .action-menu-item[data-action="approve"]:hover {
                background: #f0fdf4 !important;
                color: #16a34a !important;
            }
            .action-menu-item[data-action="clear-remarks"]:hover {
                background: #eef2ff !important;
                color: #6366f1 !important;
            }
            .action-menu-item[data-action="return"]:hover {
                background: #fffbeb !important;
                color: #d97706 !important;
            }
        `;
        if (!document.querySelector('style[data-action-menu-styles]')) {
            style.setAttribute('data-action-menu-styles', 'true');
            document.head.appendChild(style);
        }
        
        // Position tooltip to avoid going off screen
        // First append to get accurate measurements
        document.body.appendChild(tooltip);
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Check if tooltip goes off right side - align to left of button
        if (tooltipRect.right > viewportWidth) {
            tooltip.style.right = 'auto';
            tooltip.style.left = `${rect.left}px`;
        }
        
        // Check if tooltip goes off bottom - show above button
        if (tooltipRect.bottom > viewportHeight) {
            tooltip.style.top = 'auto';
            tooltip.style.bottom = `${viewportHeight - rect.top + 8}px`;
        }
        
        // Recalculate if left positioning changed
        const newRect = tooltip.getBoundingClientRect();
        if (newRect.left < 0) {
            tooltip.style.left = '8px';
            tooltip.style.right = 'auto';
        }
        
        // Handle clicks
        const closeTooltip = () => {
            tooltip.style.animation = 'tooltipFadeIn 0.2s ease reverse';
            setTimeout(() => tooltip.remove(), 200);
        };
        
        tooltip.querySelectorAll('.action-menu-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                closeTooltip();
                setTimeout(() => {
                    this.handleSchoolAction(schoolId, action);
                }, 100);
            });
        });
        
        // Close on outside click
        const clickHandler = (e) => {
            if (!tooltip.contains(e.target) && !button.contains(e.target)) {
                closeTooltip();
                document.removeEventListener('click', clickHandler);
            }
        };
        
        // Use setTimeout to avoid immediate closure
        setTimeout(() => {
            document.addEventListener('click', clickHandler);
        }, 0);
    }
    
    handleSchoolAction(schoolId, action) {
        const existingTooltips = document.querySelectorAll('.action-menu-tooltip');
        existingTooltips.forEach(tooltip => tooltip.remove());

        const school = this.filteredSchools.find(s => String(s.id) === String(schoolId));
        const isReadOnly = this.isCentralAdminScope() && school && school.workflow_status === 'completed';

        if (isReadOnly && ['approve', 'return', 'clear-remarks'].includes(action)) {
            this.showAlertModal(
                'Read-Only Form',
                `<p style="margin: 0; color: #475569;">
                    This form has already been completed at the Central Office and is read-only.
                </p>`,
                'Close'
            );
            return;
        }

        switch (action) {
            case 'view':
                this.viewSchoolForms(schoolId);
                break;
            case 'approve':
                this.approveSchoolForm(schoolId);
                break;
            case 'return':
                this.returnSchoolForm(schoolId);
                break;
            case 'clear-remarks':
                this.clearSchoolRemarks(schoolId);
                break;
        }
    }
    
    async approveSchoolForm(schoolId) {
        try {
            // Get forms for this school
            const response = await fetch(`/api/form-management/schools/${schoolId}/forms/`);
            const data = await response.json();
            
            if (!data.success || !data.forms || data.forms.length === 0) {
                this.showError('No forms found for this school');
                return;
            }
            
            const pendingForm = data.forms.find(form =>
                form.workflow_status && this.workflowManager.isPending(form.workflow_status)
            );
            
            if (!pendingForm) {
                if (this.isCentralAdminScope() && this.hasCompletedForm(data.forms)) {
                    await this.showAlertModal(
                        'Form Already Completed',
                        `<p style="margin: 0; color: #475569;">
                            This form has already been approved at the Central Office and is read-only.
                        </p>`,
                        'Close'
                    );
                } else {
                    this.showError('No pending forms found for this school');
                }
                return;
            }
            
            const formToApprove = pendingForm;
            
            const canProceed = await this.ensureFormHasNoRemarks(formToApprove.id);
            if (!canProceed) {
                return;
            }
            
            // Get workflow transition info
            const currentLevel = this.workflowManager.getCurrentLevelFromStatus(formToApprove.workflow_status);
            const transition = this.workflowManager.getApproveTransition(currentLevel);
            
            // Build confirmation message
            const message = `
                <div style="text-align: left; margin-bottom: 16px;">
                    <p style="margin: 0 0 12px; color: #334155; font-size: 1rem; line-height: 1.6;">
                        You are about to approve the form for <strong style="color: #3a6ea5;">${this.escapeHtml(formToApprove.school_name || 'this school')}</strong>.
                    </p>
                    <div style="padding: 12px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; margin-bottom: 12px;">
                        <p style="margin: 0; color: #1e40af; font-size: 0.9rem; font-weight: 500;">
                            <i class="ph-bold ph-arrow-right" style="margin-right: 6px;"></i>
                            ${this.workflowManager.getLevelDisplay(currentLevel)} → ${this.workflowManager.getLevelDisplay(transition.toLevel)}
                        </p>
                        <p style="margin: 8px 0 0; color: #1e40af; font-size: 0.875rem;">
                            ${transition.description}
                        </p>
                    </div>
                    <div style="padding: 10px 12px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin-bottom: 12px;">
                        <p style="margin: 0; color: #92400e; font-size: 0.875rem;">
                            <i class="ph-bold ph-info" style="margin-right: 6px;"></i>
                            Note: All remarks for this form will be cleared upon approval.
                        </p>
                    </div>
                    <p style="margin: 0; color: #64748b; font-size: 0.875rem;">
                        <i class="ph-bold ph-info" style="margin-right: 6px;"></i>
                        Current Status: <strong>${this.workflowManager.getStatusDisplay(formToApprove.workflow_status)}</strong>
                    </p>
                </div>
            `;
            
            // Show confirmation dialog
            const confirmed = await this.showApproveConfirmDialog(
                'Approve Form',
                message,
                'Approve & Forward',
                'Cancel'
            );
            
            if (!confirmed) return;
            
            // Clear remarks first
            await this.clearAllRemarksForForm(formToApprove.id);
            
            // Approve the form
            const approveResponse = await fetch(`/api/admin/form-management/forms/${formToApprove.id}/approve/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({ comments: '' })
            });
            
            const approveData = await approveResponse.json();
            
            if (approveData.success) {
                this.showSuccess(`Form approved and forwarded to ${this.workflowManager.getLevelDisplay(transition.toLevel)}`);
                // Reload schools to update status
                if (this.currentSelection) {
                    const parts = (this.currentSelection || '').split('-');
                    const actualId = parts.length > 1 ? parts[1] : null;
                    if (actualId) {
                        await this.loadSchools(actualId, this.currentPage, this.pageSize);
                    }
                }
            } else {
                this.showError(approveData.message || 'Failed to approve form');
            }
        } catch (error) {
            console.error('Failed to approve form:', error);
            this.showError('Failed to approve form');
        }
    }

    async clearSchoolRemarks(schoolId) {
        try {
            const response = await fetch(`/api/form-management/schools/${schoolId}/forms/`);
            const data = await response.json();

            if (!data.success || !data.forms || data.forms.length === 0) {
                this.showError('No forms found for this school');
                return;
            }

            const pendingForm = data.forms.find(form =>
                form.workflow_status && this.workflowManager.isPending(form.workflow_status)
            );

            const targetForm = pendingForm || (this.isCentralAdminScope() ? this.getMostRecentForm(data.forms) : null);
            if (!targetForm) {
                this.showError('No forms found for this school');
                return;
            }

            if (this.isCentralAdminScope() && targetForm.workflow_status === 'completed') {
                await this.showAlertModal(
                    'Read-Only Form',
                    `<p style="margin: 0; color: #475569;">
                        This form has already been completed at the Central Office and is read-only.
                    </p>`,
                    'Close'
                );
                return;
            }

            const remarksResp = await fetch(`/api/form-management/forms/${targetForm.id}/remarks/`);
            const remarksData = await remarksResp.json();
            const hasRemarks = remarksData.success && this.hasRemarksInData(remarksData.remarks);
            if (!hasRemarks) {
                await this.showAlertModal(
                    'No Remarks Found',
                    `<p style="margin: 0; color: #475569;">
                        There are currently no remarks for this form.
                    </p>`,
                    'Close'
                );
                return;
            }

            const message = `
                <p style="margin: 0 0 12px; color: #334155; font-size: 1rem; line-height: 1.6;">
                    This will clear all remarks created by your admin level for <strong style="color: #3a6ea5;">${this.escapeHtml(targetForm.school_name || 'this school')}</strong>.
                </p>
                <div style="padding: 10px 12px; background: #eef2ff; border-left: 4px solid #4f46e5; border-radius: 4px; margin-bottom: 8px;">
                    <p style="margin: 0; color: #312e81; font-size: 0.9rem;">
                        Use this action when the remarks have been addressed and you need to reset them before approving.
                    </p>
                </div>
            `;

            const confirmed = await this.showApproveConfirmDialog(
                'Clear Remarks',
                message,
                'Clear Remarks',
                'Cancel'
            );

            if (!confirmed) return;

            await this.clearAllRemarksForForm(targetForm.id);
            this.showSuccess('All remarks have been cleared for this form.');

            if (window.formReviewApp && window.formReviewApp.formId === targetForm.id && window.formReviewRemarksApp) {
                window.formReviewRemarksApp.remarks = { category: {}, topic: {}, question: {} };
                if (typeof window.formReviewRemarksApp.updateAllBadges === 'function') {
                    window.formReviewRemarksApp.updateAllBadges();
                }
                if (typeof window.formReviewRemarksApp.emitRemarksChanged === 'function') {
                    window.formReviewRemarksApp.emitRemarksChanged();
                }
            }

            if (this.currentSelection) {
                const parts = (this.currentSelection || '').split('-');
                const actualId = parts.length > 1 ? parts[1] : null;
                if (actualId) {
                    await this.loadSchools(actualId, this.currentPage, this.pageSize);
                }
            }
        } catch (error) {
            console.error('Failed to clear remarks:', error);
            this.showError('Failed to clear remarks');
        }
    }

    async clearAllRemarksForForm(formId) {
        try {
            const resp = await fetch(`/api/form-management/forms/${formId}/remarks/clear/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({ scope: 'current_admin_level' })
            });
            const data = await resp.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to clear remarks');
            }
        } catch (err) {
            console.error('Failed to clear remarks before approval:', err);
            throw err;
        }
    }

    hasRemarksInData(remarks) {
        if (!remarks) return false;
        return Object.values(remarks).some(group => {
            if (!group) return false;
            return Object.values(group).some(list => Array.isArray(list) && list.length > 0);
        });
    }

    hasCompletedForm(forms) {
        return forms.some(form => form.workflow_status === 'completed');
    }

    getMostRecentForm(forms) {
        if (!forms || forms.length === 0) return null;
        const sorted = [...forms].sort((a, b) => {
            const dateA = new Date(a.submitted_date || a.created_at);
            const dateB = new Date(b.submitted_date || b.created_at);
            return dateB - dateA;
        });
        return sorted[0];
    }
    
    async returnSchoolForm(schoolId) {
        try {
            // Get forms for this school
            const response = await fetch(`/api/form-management/schools/${schoolId}/forms/`);
            const data = await response.json();
            
            if (!data.success || !data.forms || data.forms.length === 0) {
                this.showError('No forms found for this school');
                return;
            }
            
            // Find first pending form
            const pendingForm = data.forms.find(form => 
                form.workflow_status && this.workflowManager.isPending(form.workflow_status)
            );
            
            if (!pendingForm) {
                if (this.isCentralAdminScope() && this.hasCompletedForm(data.forms)) {
                    await this.showAlertModal(
                        'Form Already Completed',
                        `<p style="margin: 0; color: #475569;">
                            This form has already been completed at the Central Office and cannot be returned.
                        </p>`,
                        'Close'
                    );
                } else {
                    this.showError('No pending forms found for this school');
                }
                return;
            }
            
            const remarksResp = await fetch(`/api/form-management/forms/${pendingForm.id}/remarks/`);
            const remarksData = await remarksResp.json();
            const hasRemarks = remarksData.success && this.hasRemarksInData(remarksData.remarks);
            if (!hasRemarks) {
                await this.showAlertModal(
                    'Cannot Return Form',
                    `<p style="margin: 0; color: #475569;">
                        You must add at least one remark before returning the form so the school knows what to address.
                    </p>`,
                    'Close'
                );
                return;
            }
            
            // Get workflow transition info
            const currentLevel = this.workflowManager.getCurrentLevelFromStatus(pendingForm.workflow_status);
            const transition = this.workflowManager.getReturnTransition(currentLevel);
            
            // Build message with workflow info
            const message = `
                <p style="margin: 0 0 12px; color: #334155; font-size: 1rem; line-height: 1.6;">
                    You are about to return the form for <strong style="color: #3a6ea5;">${this.escapeHtml(pendingForm.school_name || 'this school')}</strong> for revision.
                </p>
                <div style="padding: 12px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px; margin-bottom: 12px;">
                    <p style="margin: 0; color: #92400e; font-size: 0.9rem; font-weight: 500;">
                        <i class="ph-bold ph-arrow-left" style="margin-right: 6px;"></i>
                        ${this.workflowManager.getLevelDisplay(currentLevel)} → School
                    </p>
                    <p style="margin: 8px 0 0; color: #92400e; font-size: 0.875rem;">
                        ${transition.description}
                    </p>
                </div>
                <p style="margin: 0 0 16px; color: #64748b; font-size: 0.875rem;">
                    <i class="ph-bold ph-info" style="margin-right: 6px;"></i>
                    Current Status: <strong>${this.workflowManager.getStatusDisplay(pendingForm.workflow_status)}</strong>
                </p>
            `;
            
            // Show confirmation dialog with comment input
            const result = await this.showReturnDialog(
                'Return Form for Revision',
                message,
                'Return to School',
                'Cancel'
            );
            
            if (!result) return;
            
            if (!result.comments || !result.comments.trim()) {
                this.showError('Comments are required when returning a form');
                return;
            }
            
            // Return the form
            const returnResponse = await fetch(`/api/admin/form-management/forms/${pendingForm.id}/return/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({ comments: result.comments })
            });
            
            const returnData = await returnResponse.json();
            
            if (returnData.success) {
                this.showSuccess(`Form returned to school for revision`);
                // Reload schools to update status
                if (this.currentSelection) {
                    const parts = (this.currentSelection || '').split('-');
                    const actualId = parts.length > 1 ? parts[1] : null;
                    if (actualId) {
                        await this.loadSchools(actualId, this.currentPage, this.pageSize);
                    }
                }
            } else {
                this.showError(returnData.message || 'Failed to return form');
            }
        } catch (error) {
            console.error('Failed to return form:', error);
            this.showError('Failed to return form');
        }
    }
    
    showApproveConfirmDialog(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            // Remove any existing overlays
            const existingOverlays = document.querySelectorAll('.confirmation-modal-overlay');
            existingOverlays.forEach(overlay => overlay.remove());
            
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'confirmation-modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                animation: fadeIn 0.2s ease;
            `;
            
            // Create modal
            const modal = document.createElement('div');
            modal.className = 'confirmation-modal';
            modal.style.cssText = `
                background: white;
                border-radius: 12px;
                padding: 32px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                animation: slideUp 0.3s ease;
                position: relative;
            `;
            
            modal.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            modal.innerHTML = `
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="width: 64px; height: 64px; margin: 0 auto 16px; background: #f0fdf4; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i class="ph-bold ph-check-circle" style="font-size: 32px; color: #16a34a;"></i>
                    </div>
                    <h3 style="margin: 0 0 12px; color: #1e293b; font-size: 1.5rem; font-weight: 600;">
                        ${title}
                    </h3>
                </div>
                <div style="margin-bottom: 24px;">
                    ${message}
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn-cancel" style="
                        padding: 10px 24px;
                        border: 1px solid #e2e8f0;
                        background: white;
                        color: #334155;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        font-weight: 500;
                        transition: all 0.2s ease;
                    ">
                        ${this.escapeHtml(cancelText)}
                    </button>
                    <button class="btn-confirm" style="
                        padding: 10px 24px;
                        border: none;
                        background: #4caf50;
                        color: white;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        font-weight: 600;
                        transition: all 0.2s ease;
                    ">
                        ${this.escapeHtml(confirmText)}
                    </button>
                </div>
            `;
            
            // Add hover styles
            const style = document.createElement('style');
            style.textContent = `
                .btn-cancel:hover {
                    background: #f8fafc !important;
                    border-color: #cbd5e1 !important;
                }
                .btn-confirm:hover {
                    background: #45a049 !important;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(76, 175, 80, 0.3);
                }
            `;
            document.head.appendChild(style);
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            const closeModal = (result) => {
                overlay.style.animation = 'fadeOut 0.2s ease';
                setTimeout(() => {
                    overlay.remove();
                    resolve(result);
                }, 200);
            };
            
            modal.querySelector('.btn-confirm').addEventListener('click', () => closeModal(true));
            modal.querySelector('.btn-cancel').addEventListener('click', () => closeModal(false));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal(false);
            });
        });
    }
    
    showAlertModal(title, message, buttonText = 'Close') {
        return new Promise((resolve) => {
            const existingOverlays = document.querySelectorAll('.confirmation-modal-overlay');
            existingOverlays.forEach(overlay => overlay.remove());
            
            const overlay = document.createElement('div');
            overlay.className = 'confirmation-modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                animation: fadeIn 0.2s ease;
            `;
            
            const modal = document.createElement('div');
            modal.className = 'confirmation-modal';
            modal.style.cssText = `
                background: white;
                border-radius: 12px;
                padding: 28px;
                max-width: 420px;
                width: 90%;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                animation: slideUp 0.3s ease;
                position: relative;
                text-align: center;
            `;
            
            modal.addEventListener('click', (e) => e.stopPropagation());
            
            modal.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <div style="width: 56px; height: 56px; margin: 0 auto 16px; background: #fef2f2; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i class="ph-bold ph-warning" style="font-size: 28px; color: #dc2626;"></i>
                    </div>
                    <h3 style="margin: 0 0 12px; color: #1f2937; font-size: 1.35rem; font-weight: 600;">
                        ${this.escapeHtml(title)}
                    </h3>
                </div>
                <div style="margin-bottom: 24px; color: #4b5563; font-size: 0.95rem; line-height: 1.6;">
                    ${message}
                </div>
                <button class="btn-alert-close" style="
                    padding: 10px 24px;
                    border: none;
                    border-radius: 8px;
                    background: #dc2626;
                    color: white;
                    cursor: pointer;
                    font-size: 0.95rem;
                    font-weight: 600;
                ">
                    ${this.escapeHtml(buttonText)}
                </button>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            const closeModal = () => {
                overlay.style.animation = 'fadeOut 0.2s ease';
                setTimeout(() => {
                    overlay.remove();
                    resolve();
                }, 200);
            };
            
            modal.querySelector('.btn-alert-close').addEventListener('click', closeModal);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal();
            });
        });
    }
    
    showReturnDialog(title, message, confirmText = 'Return', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            // Remove any existing overlays
            const existingOverlays = document.querySelectorAll('.confirmation-modal-overlay');
            existingOverlays.forEach(overlay => overlay.remove());
            
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'confirmation-modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                animation: fadeIn 0.2s ease;
            `;
            
            // Create modal
            const modal = document.createElement('div');
            modal.className = 'confirmation-modal';
            modal.style.cssText = `
                background: white;
                border-radius: 12px;
                padding: 32px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                animation: slideUp 0.3s ease;
                position: relative;
                max-height: 90vh;
                overflow-y: auto;
            `;
            
            modal.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            modal.innerHTML = `
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="width: 64px; height: 64px; margin: 0 auto 16px; background: #fef3c7; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i class="ph-bold ph-arrow-counter-clockwise" style="font-size: 32px; color: #d97706;"></i>
                    </div>
                    <h3 style="margin: 0 0 12px; color: #1e293b; font-size: 1.5rem; font-weight: 600;">
                        ${title}
                    </h3>
                </div>
                <div style="margin-bottom: 24px;">
                    ${message}
                    <div>
                        <label for="return-comments" style="display: block; margin-bottom: 8px; color: #1e293b; font-weight: 500; font-size: 0.9rem;">
                            Comments <span style="color: #ef4444;">*</span>
                        </label>
                        <textarea id="return-comments" rows="4" style="
                            width: 100%;
                            padding: 12px;
                            border: 1px solid #e2e8f0;
                            border-radius: 8px;
                            font-family: inherit;
                            font-size: 0.9rem;
                            resize: vertical;
                            transition: border-color 0.2s ease;
                            color: #334155;
                        " placeholder="Please provide a reason for returning this form..."></textarea>
                        <p style="margin: 8px 0 0; color: #64748b; font-size: 0.875rem;">
                            <i class="ph-bold ph-info" style="margin-right: 4px;"></i>
                            Comments are required when returning a form for revision.
                        </p>
                    </div>
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn-cancel" style="
                        padding: 10px 24px;
                        border: 1px solid #e2e8f0;
                        background: white;
                        color: #334155;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        font-weight: 500;
                        transition: all 0.2s ease;
                    ">
                        ${this.escapeHtml(cancelText)}
                    </button>
                    <button class="btn-confirm" style="
                        padding: 10px 24px;
                        border: none;
                        background: #f59e0b;
                        color: white;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        font-weight: 600;
                        transition: all 0.2s ease;
                    ">
                        ${this.escapeHtml(confirmText)}
                    </button>
                </div>
            `;
            
            // Add hover styles
            const style = document.createElement('style');
            style.textContent = `
                .btn-cancel:hover {
                    background: #f8fafc !important;
                    border-color: #cbd5e1 !important;
                }
                .btn-confirm:hover {
                    background: #d97706 !important;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(217, 119, 6, 0.3);
                }
                #return-comments:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
            `;
            document.head.appendChild(style);
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            const closeModal = (result) => {
                if (result) {
                    const comments = modal.querySelector('#return-comments').value;
                    overlay.style.animation = 'fadeOut 0.2s ease';
                    setTimeout(() => {
                        overlay.remove();
                        resolve({ comments });
                    }, 200);
                } else {
                    overlay.style.animation = 'fadeOut 0.2s ease';
                    setTimeout(() => {
                        overlay.remove();
                        resolve(null);
                    }, 200);
                }
            };
            
            modal.querySelector('.btn-confirm').addEventListener('click', () => closeModal(true));
            modal.querySelector('.btn-cancel').addEventListener('click', () => closeModal(false));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal(false);
            });
            
            // Focus on textarea
            setTimeout(() => {
                modal.querySelector('#return-comments').focus();
            }, 300);
        });
    }

    async ensureFormHasNoRemarks(formId) {
        try {
            const response = await fetch(`/api/form-management/forms/${formId}/remarks/`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to verify remarks');
            }
            const hasRemarks = this.hasRemarksInData(data.remarks);
            if (hasRemarks) {
                await this.showAlertModal(
                    'Cannot Approve Form',
                    `<p style="margin: 0; color: #475569;">
                        You cannot approve a form that still has remarks. Please resolve or clear all remarks before approving.
                    </p>`,
                    'Got it'
                );
                return false;
            }
            return true;
        } catch (error) {
            console.error('Failed to verify remarks before approval:', error);
            this.showError('Could not verify remarks status. Please try again.');
            return false;
        }
    }
    
    hasRemarksInData(remarks) {
        if (!remarks) return false;
        return Object.values(remarks).some(group => {
            if (!group) return false;
            return Object.values(group).some(list => Array.isArray(list) && list.length > 0);
        });
    }
    
    async viewSchoolForms(schoolId) {
        try {
            // Fetch forms for this school
            const response = await fetch(`/api/form-management/schools/${schoolId}/forms/`);
            const data = await response.json();
            
            if (!data.success || !data.forms || data.forms.length === 0) {
                this.showError('No forms found for this school');
                return;
            }
            
            // Open form review page in new tab for the first form
            const formId = data.forms[0].id;
            window.open(`/form-management/view/${formId}/`, '_blank');
            
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
    
    formatDateOnly(dateValue) {
        if (!dateValue) return '';
        try {
            const d = new Date(dateValue);
            if (isNaN(d.getTime())) return String(dateValue);
            return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
        } catch (_) {
            return String(dateValue);
        }
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