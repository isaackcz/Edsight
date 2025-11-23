// User Management Tree View
// Handles progressive loading of geographic hierarchy tree

(function() {
    'use strict';
    
    const TREE_ENDPOINTS = {
        regions: '/api/user-management/tree/regions/',
        divisions: '/api/user-management/tree/divisions/',
        districts: '/api/user-management/tree/districts/',
        schools: '/api/user-management/tree/schools/'
    };
    
    let treeState = {
        expandedNodes: new Set(),
        loadedNodes: new Map(),
        selectedNodeId: null // Track currently selected node
    };
    
    /**
     * Load regions (initial tree load)
     */
    function loadRegions() {
        const loadingEl = document.getElementById('treeLoading');
        const contentEl = document.getElementById('treeContent');
        const emptyEl = document.getElementById('treeEmpty');
        
        if (loadingEl) loadingEl.style.display = 'flex';
        if (contentEl) contentEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'none';
        
        fetch(TREE_ENDPOINTS.regions, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.regions) {
                renderRegions(data.regions);
                if (loadingEl) loadingEl.style.display = 'none';
                if (contentEl) contentEl.style.display = 'block';
            } else {
                showTreeEmpty();
            }
        })
        .catch(error => {
            console.error('Error loading regions:', error);
            showTreeEmpty();
        });
    }
    
    /**
     * Render regions in tree
     */
    function renderRegions(regions) {
        const contentEl = document.getElementById('treeContent');
        if (!contentEl) return;
        
        if (regions.length === 0) {
            showTreeEmpty();
            return;
        }
        
        contentEl.innerHTML = regions.map(region => createTreeNode(region, 'region', 0)).join('');
        
        // Attach click handlers
        attachNodeHandlers();
    }
    
    /**
     * Load divisions for a region
     */
    function loadDivisions(regionId) {
        const nodeId = `region-${regionId}`;
        const nodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
        
        if (!nodeEl) return;
        
        // Always trigger table load when region is clicked
        if (window.UserManagementTable && typeof window.UserManagementTable.loadWithRegion === 'function') {
            window.UserManagementTable.loadWithRegion(regionId);
        }
        
        // Mark node as selected
        selectNode(nodeEl);
        
        // Show loading state
        const childrenContainer = nodeEl.querySelector('.tree-node-children');
        if (childrenContainer) {
            childrenContainer.innerHTML = '<div class="tree-node-loading"><div class="spinner-border spinner-border-sm"></div> Loading divisions...</div>';
            childrenContainer.style.display = 'block';
        }
        
        fetch(`${TREE_ENDPOINTS.divisions}?region_id=${regionId}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.divisions) {
                renderDivisions(nodeEl, data.divisions, regionId);
            } else {
                if (childrenContainer) {
                    childrenContainer.innerHTML = '<div class="tree-node-loading">No divisions found</div>';
                }
            }
        })
        .catch(error => {
            console.error('Error loading divisions:', error);
            if (childrenContainer) {
                childrenContainer.innerHTML = '<div class="tree-node-loading">Error loading divisions</div>';
            }
        });
    }
    
    /**
     * Render divisions in tree
     */
    function renderDivisions(parentNode, divisions, regionId) {
        const childrenContainer = parentNode.querySelector('.tree-node-children');
        if (!childrenContainer) return;
        
        if (divisions.length === 0) {
            childrenContainer.innerHTML = '<div class="tree-node-loading">No divisions found</div>';
            return;
        }
        
        childrenContainer.innerHTML = divisions.map(division => createTreeNode(division, 'division', 1)).join('');
        
        // Attach click handlers for new nodes
        attachNodeHandlers();
    }
    
    /**
     * Load districts for a division
     */
    function loadDistricts(divisionId) {
        const nodeId = `division-${divisionId}`;
        const nodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
        
        if (!nodeEl) return;
        
        // Always trigger table load when division is clicked
        if (window.UserManagementTable && typeof window.UserManagementTable.loadWithDivision === 'function') {
            window.UserManagementTable.loadWithDivision(divisionId);
        }
        
        // Mark node as selected
        selectNode(nodeEl);
        
        const childrenContainer = nodeEl.querySelector('.tree-node-children');
        if (childrenContainer) {
            childrenContainer.innerHTML = '<div class="tree-node-loading"><div class="spinner-border spinner-border-sm"></div> Loading districts...</div>';
            childrenContainer.style.display = 'block';
        }
        
        fetch(`${TREE_ENDPOINTS.districts}?division_id=${divisionId}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.districts) {
                renderDistricts(nodeEl, data.districts, divisionId);
            } else {
                if (childrenContainer) {
                    childrenContainer.innerHTML = '<div class="tree-node-loading">No districts found</div>';
                }
            }
        })
        .catch(error => {
            console.error('Error loading districts:', error);
            if (childrenContainer) {
                childrenContainer.innerHTML = '<div class="tree-node-loading">Error loading districts</div>';
            }
        });
    }
    
    /**
     * Render districts in tree
     */
    function renderDistricts(parentNode, districts, divisionId) {
        const childrenContainer = parentNode.querySelector('.tree-node-children');
        if (!childrenContainer) return;
        
        if (districts.length === 0) {
            childrenContainer.innerHTML = '<div class="tree-node-loading">No districts found</div>';
            return;
        }
        
        childrenContainer.innerHTML = districts.map(district => createTreeNode(district, 'district', 2)).join('');
        
        // Attach click handlers for new nodes
        attachNodeHandlers();
    }
    
    /**
     * Load schools/users for a district
     */
    function loadSchools(districtId) {
        const nodeId = `district-${districtId}`;
        const nodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
        
        if (!nodeEl) return;
        
        // Always trigger table load when district is clicked
        // The table will be loaded via the table component
        if (window.UserManagementTable && typeof window.UserManagementTable.loadWithDistrict === 'function') {
            window.UserManagementTable.loadWithDistrict(districtId);
        }
        
        // Mark node as selected
        selectNode(nodeEl);
        
        // Mark node as loaded
        treeState.loadedNodes.set(nodeId, true);
    }
    
    /**
     * Create tree node HTML
     */
    function createTreeNode(node, type, level) {
        const nodeId = `${type}-${node.id}`;
        const iconClass = getIconForType(type);
        const hasChildren = node.has_children !== false;
        
        return `
            <div class="tree-node" data-node-id="${nodeId}" data-node-type="${type}" data-node-level="${level}">
                <div class="tree-node-item" data-action="toggle">
                    <div class="tree-node-toggle" style="display: ${hasChildren ? 'flex' : 'none'}">
                        <i class="ph-bold ph-caret-right"></i>
                    </div>
                    <div class="tree-node-icon ${type}">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="tree-node-content">
                        <span class="tree-node-name">${escapeHtml(node.name)}</span>
                        <span class="tree-node-badge">${node.user_count || 0} users</span>
                    </div>
                </div>
                <div class="tree-node-children" style="display: none;"></div>
            </div>
        `;
    }
    
    /**
     * Get icon class for node type
     */
    function getIconForType(type) {
        const icons = {
            region: 'ph-bold ph-map-pin',
            division: 'ph-bold ph-buildings',
            district: 'ph-bold ph-house',
            school: 'ph-bold ph-graduation-cap'
        };
        return icons[type] || 'ph-bold ph-folder';
    }
    
    /**
     * Attach event handlers to tree nodes
     */
    function attachNodeHandlers() {
        document.querySelectorAll('.tree-node-item[data-action="toggle"]').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                const nodeEl = this.closest('.tree-node');
                const nodeId = nodeEl.getAttribute('data-node-id');
                const nodeType = nodeEl.getAttribute('data-node-type');
                const nodeIdNum = nodeId.split('-')[1];
                
                const isExpanded = nodeEl.querySelector('.tree-node-item').classList.contains('expanded');
                
                // Special handling for nodes that trigger table loads
                if (nodeType === 'region') {
                    // If already expanded, just reload the table (don't collapse)
                    if (isExpanded) {
                        loadDivisions(nodeIdNum);
                    } else {
                        // Expand and load
                        expandNode(nodeEl, nodeType, nodeIdNum);
                    }
                } else if (nodeType === 'division') {
                    // If already expanded, just reload the table (don't collapse)
                    if (isExpanded) {
                        loadDistricts(nodeIdNum);
                    } else {
                        // Expand and load
                        expandNode(nodeEl, nodeType, nodeIdNum);
                    }
                } else if (nodeType === 'district') {
                    // If already expanded, just reload the table (don't collapse)
                    if (isExpanded) {
                        loadSchools(nodeIdNum);
                    } else {
                        // Expand and load
                        expandNode(nodeEl, nodeType, nodeIdNum);
                    }
                } else {
                    // For other node types, toggle expand/collapse
                if (isExpanded) {
                    // Collapse
                    collapseNode(nodeEl);
                } else {
                    // Expand
                    expandNode(nodeEl, nodeType, nodeIdNum);
                    }
                }
            });
        });
    }
    
    /**
     * Expand a tree node
     */
    function expandNode(nodeEl, nodeType, nodeId) {
        const itemEl = nodeEl.querySelector('.tree-node-item');
        const childrenEl = nodeEl.querySelector('.tree-node-children');
        
        // Use requestAnimationFrame to batch DOM updates and prevent flicker
        requestAnimationFrame(() => {
        itemEl.classList.add('expanded');
        if (childrenEl) {
            childrenEl.style.display = 'block';
        }
        });
        
        treeState.expandedNodes.add(nodeEl.getAttribute('data-node-id'));
        
        // Load children if not already loaded
        if (!treeState.loadedNodes.has(nodeEl.getAttribute('data-node-id'))) {
            if (nodeType === 'region') {
                loadDivisions(nodeId);
            } else if (nodeType === 'division') {
                loadDistricts(nodeId);
            } else if (nodeType === 'district') {
                loadSchools(nodeId);
            }
            
            treeState.loadedNodes.set(nodeEl.getAttribute('data-node-id'), true);
        } else {
            // If already loaded, still trigger table load for nodes that filter the table
            if (nodeType === 'region') {
                loadDivisions(nodeId);
            } else if (nodeType === 'division') {
                loadDistricts(nodeId);
            } else if (nodeType === 'district') {
                loadSchools(nodeId);
            }
        }
    }
    
    /**
     * Select a tree node (highlight it and track selection)
     */
    function selectNode(nodeEl) {
        // Use requestAnimationFrame to batch DOM updates and prevent flicker
        requestAnimationFrame(() => {
            // Remove selected class from all nodes
            document.querySelectorAll('.tree-node-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            // Add selected class to current node
            const itemEl = nodeEl.querySelector('.tree-node-item');
            if (itemEl) {
                itemEl.classList.add('selected');
            }
        });
        
        // Track selected node
        treeState.selectedNodeId = nodeEl.getAttribute('data-node-id');
    }
    
    /**
     * Collapse a tree node
     */
    function collapseNode(nodeEl) {
        const itemEl = nodeEl.querySelector('.tree-node-item');
        const childrenEl = nodeEl.querySelector('.tree-node-children');
        
        // Use requestAnimationFrame to batch DOM updates and prevent flicker
        requestAnimationFrame(() => {
        itemEl.classList.remove('expanded');
        if (childrenEl) {
            childrenEl.style.display = 'none';
        }
        });
        
        treeState.expandedNodes.delete(nodeEl.getAttribute('data-node-id'));
    }
    
    /**
     * Show empty tree state
     */
    function showTreeEmpty() {
        const loadingEl = document.getElementById('treeLoading');
        const contentEl = document.getElementById('treeContent');
        const emptyEl = document.getElementById('treeEmpty');
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'flex';
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Initialize tree view
     */
    function init() {
        const treeContainer = document.getElementById('userManagementTree');
        if (treeContainer) {
            loadRegions();
        }
    }
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Export for external access
    window.UserManagementTree = {
        load: loadRegions,
        refresh: loadRegions
    };
})();

