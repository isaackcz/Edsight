/**
 * Draft Manager - Handles draft questionnaire management
 * Clean, focused module for draft operations
 */

class DraftManager {
  constructor() {
    this.draftsContainer = null;
    this.currentDraftQuestions = [];
    this.currentDraftQuestionsContainer = null;
    this.currentTopicId = null;
    this.currentTopicName = null;
    this.currentCategoryName = null;
    
    // Pagination state
    this.currentPage = 1;
    this.questionsPerPage = 10;
    this.filteredQuestions = [];
    this.searchTerm = '';
    this.filterType = 'all';
    this.filterRequired = 'all';
    this.sortOrder = 'asc';
    
    this.init();
  }

  // Simple debounce utility to avoid excessive re-renders while typing
  debounce(fn, delay = 250) {
    let timerId;
    return (...args) => {
      clearTimeout(timerId);
      timerId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  init() {
    this.draftsContainer = document.querySelector(".drafts-container");
    if (!this.draftsContainer) {
      console.error("Drafts container not found");
      return;
    }
    this.attachEventListeners();
    this.setupTabIntegration();
    this.setupResizeListener();
  }

  attachEventListeners() {
    // Delegate clicks inside draftsContainer for dynamically created buttons
    this.draftsContainer.addEventListener("click", (e) => {
      this.handleDraftContainerClick(e);
    });
  }

  setupTabIntegration() {
    // Listen for tab changes to load drafts when draft-questions tab is activated
    document.addEventListener('tabChanged', (e) => {
      if (e.detail.tabId === 'draft-questions') {
        this.loadDraftedQuestionnaires();
      }
    });
  }

  setupResizeListener() {
    // Sync tree view height when window is resized
    window.addEventListener('resize', this.debounce(() => {
      this.syncTreeViewHeight();
    }, 250));
  }

  handleDraftContainerClick(e) {
    // Back to topics
    const backToTopics = e.target.closest("#back-to-topics");
    if (backToTopics) {
      e.preventDefault();
      this.goBackToTopics();
      return;
    }
  }

  goBackToTopics() {
    let parsed = null;
    try {
      const raw = localStorage.getItem("draftsPageState");
      if (raw) parsed = JSON.parse(raw);
    } catch (err) {
      parsed = null;
    }
    
    // Animate back transition
    if (window.fadeAnimations && window.fadeAnimations.isAnimationSupported()) {
      window.fadeAnimations.animateElement(this.draftsContainer, 'fade', {
        direction: 'exit',
        duration: 200
      }).then(() => {
        if (parsed && parsed.categoryId) {
          this.viewTopics(parsed.categoryId, parsed.categoryName);
        } else {
          this.loadDraftedQuestionnaires();
        }
      });
    } else {
      if (parsed && parsed.categoryId) {
        this.viewTopics(parsed.categoryId, parsed.categoryName);
      } else {
        this.loadDraftedQuestionnaires();
      }
    }
  }

  // Load drafted questionnaires with tree view
  loadDraftedQuestionnaires() {
    this.draftsContainer.classList.remove("single-column");
    this.draftsContainer.classList.remove("modern-grid");
    this.draftsContainer.classList.add("tree-view-layout");

    const topicSection = document.getElementById("topic-section");
    if (topicSection) {
      topicSection.style.display = "block";
    }

    const progressContainer = document.querySelector(".progress-container");
    if (progressContainer) {
      progressContainer.style.display = "block";
    }

    // Animate page transition
    const currentContent = this.draftsContainer.innerHTML;
    this.draftsContainer.innerHTML = "";

    this.fetchDraftedQuestionnaires()
      .then((draftedData) => {
        this.renderTreeView(draftedData);
        
        // Animate the new content
        if (window.fadeAnimations && window.fadeAnimations.isAnimationSupported()) {
          const newContent = this.draftsContainer.children;
          window.fadeAnimations.animateQuestionCards(newContent, {
            staggerDelay: 100,
            duration: 300
          });
        }
      })
      .catch((err) => console.error("Failed to load drafts:", err));
  }

  // Fetch categories and topics (includes empty categories/topics without questions)
  async fetchDraftedQuestionnaires() {
    try {
      // 1) Fetch all categories
      const catRes = await fetch('/api/categories/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      if (!catRes.ok) throw new Error('Failed to fetch categories');
      const categories = await catRes.json(); // [{ category_id, name, display_order }]

      // 2) For each category, fetch topics
      const categoriesWithTopics = await Promise.all((categories || []).map(async (cat) => {
        try {
          const topicsRes = await fetch(`/api/topics/?category_id=${encodeURIComponent(cat.category_id)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });
          const topics = topicsRes.ok ? await topicsRes.json() : [];
          return {
            category_id: cat.category_id,
            name: cat.name,
            topics: Array.isArray(topics) ? topics : []
          };
        } catch (e) {
          return {
            category_id: cat.category_id,
            name: cat.name,
            topics: []
          };
        }
      }));

      return categoriesWithTopics;
    } catch (error) {
      console.error('Error fetching categories/topics:', error);
      return [];
    }
  }

    // Render tree view for drafted questionnaires
  renderTreeView(draftedData) {
    this.draftsContainer.innerHTML = "";
    // draftedData is an array of { category_id, name, topics: [...] }
    const categoriesList = Array.isArray(draftedData) ? draftedData : [];

    // Create tree view layout directly in draftsContainer
    this.draftsContainer.innerHTML = `
      <div class="row g-3 align-items-stretch">
        <div class="col-12 col-lg-5 col-xl-4">
          <div class="treeview-sidebar card border-0 shadow-sm rounded-4 h-100">
            <div class="card-header bg-transparent border-0 pb-2">
              <p class="text-uppercase text-secondary mb-1 small fw-medium">Categories & Topics</p>
            </div>
            <div class="treeview-content">
              <div class="hierarchy-tree" id="draft-tree">
                ${this.buildTreeHTML(categoriesList)}
              </div>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-7 col-xl-8">
          <div class="main-content-area card border-0 shadow-sm rounded-4 h-100">
            <div class="card-header bg-transparent border-0 pb-2">
              <p class="text-uppercase text-secondary mb-1 small fw-medium">Topic Workspace</p>
            </div>
            <div class="questions-panel-body">
              <div class="questions-container" id="questions-display">
                <div class="empty-state text-center py-5">
                  <i class="ph ph-bold ph-files fs-1 mb-2"></i>
                  <h3 class="fw-semibold mb-1">No Topic Selected</h3>
                  <p class="text-muted mb-0">Select a topic from the tree to view its questions</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const treeRoot = this.draftsContainer.querySelector('#draft-tree');
    if (treeRoot) {
      const firstNode = treeRoot.querySelector('.tree-node');
      if (firstNode) {
        firstNode.classList.add('expanded');
        const firstChildren = firstNode.querySelector('.tree-children');
        if (firstChildren) {
          firstChildren.classList.remove('d-none');
        }
      }
    }

    this.attachTreeEventHandlers();
    this.updateExpandIcons();
    this.initializeResizer();
  }

  // Build tree HTML structure
  buildTreeHTML(categoriesList) {
    const categoriesHTML = categoriesList.map((cat) => {
      const categoryName = cat.name || 'Unnamed Category';
      const categoryId = cat.category_id || 'unknown';
      const topics = Array.isArray(cat.topics) ? cat.topics : [];
      const categoryIcon = this.getCategoryIcon(categoryName);
      return `
        <div class="tree-node border rounded-3 mb-3 bg-white">
          <div class="tree-node-item category-node d-flex align-items-center gap-2 p-3" data-category="${categoryName}" data-category-id="${categoryId}">
            <div class="tree-expand-icon btn btn-link p-0 text-decoration-none text-dark flex-shrink-0">
              <i class="ph ph-bold ph-caret-right"></i>
            </div>
            <div class="tree-node-icon text-primary flex-shrink-0">
              <i class="ph ph-bold ph-${categoryIcon}"></i>
            </div>
            <div class="tree-node-label fw-semibold flex-grow-1 min-width-0">${categoryName}</div>
            <span class="tree-node-count badge bg-light text-dark">${topics.length}</span>
            <div class="tree-node-actions d-flex gap-2">
              <button class="tree-action-btn rename-btn btn btn-outline-secondary btn-sm d-inline-flex align-items-center justify-content-center" data-type="category" data-id="${categoryId}" title="Rename">
                <i class="ph ph-bold ph-pencil"></i>
              </button>
              <button class="tree-action-btn delete-btn btn btn-outline-danger btn-sm d-inline-flex align-items-center justify-content-center" data-type="category" data-id="${categoryId}" title="Delete">
                <i class="ph ph-bold ph-trash"></i>
              </button>
            </div>
          </div>
          <div class="tree-children d-none border-top bg-body-tertiary">
            <div class="p-3 d-flex flex-column gap-2">
              ${topics.map(topic => {
                const topicName = topic.topic || topic.name || 'Unnamed Topic';
                return `
                <div class="tree-node">
                <div class="tree-node-item topic-node d-flex align-items-center gap-2 py-2 px-3 rounded-3 bg-white shadow-sm" data-topic-id="${topic.topic_id}" data-topic-name="${topicName}" data-category="${categoryName}">
                  <div class="tree-node-icon text-secondary flex-shrink-0">
                    <i class="ph ph-bold ph-files"></i>
                  </div>
                  <div class="tree-node-label flex-grow-1 min-width-0">${topicName}</div>
                    <div class="tree-node-actions d-flex gap-2">
                      <button class="tree-action-btn rename-btn btn btn-outline-secondary btn-sm d-inline-flex align-items-center justify-content-center" data-type="topic" data-id="${topic.topic_id}" title="Rename">
                        <i class="ph ph-bold ph-pencil"></i>
                      </button>
                      <button class="tree-action-btn delete-btn btn btn-outline-danger btn-sm d-inline-flex align-items-center justify-content-center" data-type="topic" data-id="${topic.topic_id}" title="Delete">
                        <i class="ph ph-bold ph-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              `;
              }).join('')}
              <button type="button" class="tree-add-button btn btn-outline-primary btn-sm d-inline-flex align-items-center justify-content-center gap-2 mt-1" data-type="topic" data-category-id="${categoryId}">
                <i class="ph ph-bold ph-plus"></i>
                <span>Add Topic</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Add + button for creating new categories
    const addCategoryButton = `
      <button type="button" class="tree-add-button btn btn-outline-primary w-100 d-inline-flex align-items-center justify-content-center gap-2 mt-2" data-type="category">
        <i class="ph ph-bold ph-plus"></i>
        <span>Add Category</span>
      </button>
    `;

    return categoriesHTML + addCategoryButton;
  }

  // Get category icon based on name
  getCategoryIcon(categoryName) {
    const name = categoryName.toLowerCase();
    if (name.includes("access")) return "key";
    if (name.includes("quality")) return "star";
    if (name.includes("governance")) return "gavel";
    if (name.includes("infrastructure")) return "buildings";
    if (name.includes("safety")) return "shield";
    return "folder";
  }

  // Attach tree event handlers
  attachTreeEventHandlers() {
    const tree = document.getElementById('draft-tree');
    if (!tree) return;

    // Category expand/collapse
    tree.querySelectorAll('.category-node').forEach(categoryNode => {
      categoryNode.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCategory(categoryNode);
      });
    });

    // Topic selection
    tree.querySelectorAll('.topic-node').forEach(topicNode => {
      topicNode.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectTopic(topicNode);
      });
    });

    // Add button handlers
    tree.querySelectorAll('.tree-add-button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = button.getAttribute('data-type');
        const categoryId = button.getAttribute('data-category-id');
        
        if (type === 'category') {
          this.handleAddCategory();
        } else if (type === 'topic' && categoryId) {
          this.handleAddTopic(categoryId);
        }
      });
    });

    // Action button handlers
    tree.querySelectorAll('.tree-action-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = button.getAttribute('data-type');
        const id = button.getAttribute('data-id');
        const action = button.classList.contains('rename-btn') ? 'rename' : 'delete';
        
        if (type === 'category') {
          const categoryName = button.closest('.category-node').querySelector('.tree-node-label').textContent;
          if (action === 'rename') {
            this.handleRenameCategory(id, categoryName);
          } else {
            this.handleDeleteCategory(id, categoryName);
          }
        } else if (type === 'topic') {
          const topicName = button.closest('.topic-node').querySelector('.tree-node-label').textContent;
          if (action === 'rename') {
            this.handleRenameTopic(id, topicName);
          } else {
            this.handleDeleteTopic(id, topicName);
          }
        }
      });
    });

    // Add hover tooltips for long text
    this.attachHoverTooltips();
  }

  // Toggle category expansion (accordion behavior)
  toggleCategory(categoryNode) {
    const treeNode = categoryNode.closest('.tree-node');
    if (!treeNode) return;

    const tree = document.getElementById('draft-tree');
    const shouldExpand = !treeNode.classList.contains('expanded');

    if (tree) {
      tree.querySelectorAll('.tree-node').forEach((node) => {
        if (node !== treeNode) {
          node.classList.remove('expanded');
          const siblingChildren = node.querySelector('.tree-children');
          if (siblingChildren) siblingChildren.classList.add('d-none');
        }
      });
    }

    const children = treeNode.querySelector('.tree-children');
    if (shouldExpand) {
      treeNode.classList.add('expanded');
      if (children) children.classList.remove('d-none');
    } else {
      treeNode.classList.remove('expanded');
      if (children) children.classList.add('d-none');
    }
    this.updateExpandIcons();
  }

  updateExpandIcons() {
    const tree = document.getElementById('draft-tree');
    if (!tree) return;

    tree.querySelectorAll('.category-node').forEach((node) => {
      const icon = node.querySelector('.tree-expand-icon i');
      if (icon) {
        const expanded = node.closest('.tree-node')?.classList.contains('expanded');
        icon.className = expanded ? 'ph ph-bold ph-caret-down' : 'ph ph-bold ph-caret-right';
      }
    });
  }

  // Select topic and load questions
  selectTopic(topicNode) {
    // Remove previous selection
    document.querySelectorAll('.topic-node').forEach(node => {
      node.classList.remove('selected');
    });
    
    // Add selection to current node
    topicNode.classList.add('selected');
    
    const topicId = topicNode.getAttribute('data-topic-id');
    const topicName = topicNode.getAttribute('data-topic-name');
    const categoryName = topicNode.getAttribute('data-category');
    
    // Load questions for this topic
    this.loadTopicQuestions(topicId, topicName, categoryName);
  }

  // Load questions for selected topic
  async loadTopicQuestions(topicId, topicName, categoryName) {
    const questionsDisplay = document.getElementById('questions-display');
    if (!questionsDisplay) return;

    // No loading state - removed to prevent flicker

    try {
      const questions = await this.fetchTopicQuestions(topicId);
      this.renderQuestionsDisplay(questions, topicId, topicName, categoryName);
    } catch (error) {
      questionsDisplay.innerHTML = `
        <div class="error-state">
          <i class="ph ph-bold ph-warning"></i>
          <h3>Error Loading Questions</h3>
          <p>Failed to load questions for this topic</p>
        </div>
      `;
    }
  }

  // Render questions display
  renderQuestionsDisplay(questions, topicId, topicName, categoryName) {
    const questionsDisplay = document.getElementById('questions-display');
    if (!questionsDisplay) return;

    // Store current context
    this.currentTopicId = topicId;
    this.currentTopicName = topicName;
    this.currentCategoryName = categoryName;
    this.currentDraftQuestions = questions;
    this.currentPage = 1;

    questionsDisplay.innerHTML = `
      <section class="questions-section card border-0 shadow-sm rounded-4 p-3 p-md-4">
        <div class="container-fluid px-0">
          <div class="row gy-3 align-items-center">
            <div class="col-12 col-lg">
              <p class="text-uppercase text-secondary mb-1 small fw-medium">Questions</p>
              <h3 class="mb-1">Questions for "${topicName}"</h3>
              <p class="text-muted mb-0">Category: ${categoryName}</p>
            </div>
            <div class="col-12 col-lg-auto">
              <div class="d-flex justify-content-lg-end justify-content-start align-items-center gap-2 flex-wrap">
                <button type="button" id="add-question-in-edit" class="btn d-inline-flex align-items-center gap-2"
                  style="background-color: #4caf50; color: #fff; border: none; transition: background-color 0.2s; min-width: 210px;"
                  onmouseover="this.style.backgroundColor='#1976d2'"
                  onmouseout="this.style.backgroundColor='#4caf50'">
                  <i class="ph ph-bold ph-plus"></i>
                  <span>Add Question</span>
                </button>
                <button type="button" id="update-all-questions" class="btn btn-primary d-inline-flex align-items-center gap-2" style="min-width: 120px;">
                  <i class="ph ph-bold ph-floppy-disk"></i>
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
          <div class="questions-controls mt-3">
            <div class="row g-3 align-items-end">
              <div class="col-12 col-xl-5">
                <label for="question-search" class="form-label text-muted small mb-1">Search questions</label>
                <div class="input-group">
                  <span class="input-group-text bg-transparent border-end-0">
                    <i class="ph ph-bold ph-magnifying-glass"></i>
                  </span>
                  <input type="text" id="question-search" class="form-control border-start-0" placeholder="Search questions..." value="${this.searchTerm}">
                </div>
              </div>
              <div class="col-12 col-sm-4 col-xl-2">
                <label for="type-filter" class="form-label text-muted small mb-1">Type</label>
                <select id="type-filter" class="form-select form-select-sm w-100">
                  <option value="all" ${this.filterType === 'all' ? 'selected' : ''}>All Types</option>
                  <option value="text" ${this.filterType === 'text' ? 'selected' : ''}>Text</option>
                  <option value="number" ${this.filterType === 'number' ? 'selected' : ''}>Number</option>
                  <option value="date" ${this.filterType === 'date' ? 'selected' : ''}>Date</option>
                  <option value="percentage" ${this.filterType === 'percentage' ? 'selected' : ''}>Percentage</option>
                </select>
              </div>
              <div class="col-12 col-sm-4 col-xl-2">
                <label for="required-filter" class="form-label text-muted small mb-1">Requirement</label>
                <select id="required-filter" class="form-select form-select-sm w-100">
                  <option value="all" ${this.filterRequired === 'all' ? 'selected' : ''}>All Questions</option>
                  <option value="required" ${this.filterRequired === 'required' ? 'selected' : ''}>Required Only</option>
                  <option value="optional" ${this.filterRequired === 'optional' ? 'selected' : ''}>Optional Only</option>
                </select>
              </div>
              <div class="col-12 col-sm-4 col-xl-2">
                <label for="page-size" class="form-label text-muted small mb-1">Per page</label>
                <select id="page-size" class="form-select form-select-sm w-100">
                  <option value="10" ${this.questionsPerPage === 10 ? 'selected' : ''}>10 per page</option>
                  <option value="25" ${this.questionsPerPage === 25 ? 'selected' : ''}>25 per page</option>
                  <option value="50" ${this.questionsPerPage === 50 ? 'selected' : ''}>50 per page</option>
                  <option value="100" ${this.questionsPerPage === 100 ? 'selected' : ''}>100 per page</option>
                </select>
              </div>
              <div class="col-12 col-sm-4 col-xl-1">
                <label for="sort-order" class="form-label text-muted small mb-1">Order</label>
                <select id="sort-order" class="form-select form-select-sm w-100">
                  <option value="asc" ${this.sortOrder === 'asc' ? 'selected' : ''}>Asc</option>
                  <option value="desc" ${this.sortOrder === 'desc' ? 'selected' : ''}>Desc</option>
                </select>
              </div>
            </div>
          </div>
          
          
          
          <div class="questions-list mt-4" id="questions-list">
            ${this.renderPaginatedQuestions()}
          </div>
          
          <!-- Pagination Controls -->
          <div class="pagination-controls mt-4 pt-3 border-top" id="pagination-controls">
            ${this.renderPaginationControls()}
          </div>
        </div>
      </section>
    `;

    this.attachQuestionsEventHandlers(questions, topicId, topicName, categoryName);
    this.attachPaginationEventHandlers();
    
    // Sync tree view height with questions section
    setTimeout(() => this.syncTreeViewHeight(), 100);
  }

    // Filter and search questions
  filterQuestions() {
    let filtered = [...this.currentDraftQuestions];
    
    // Apply search filter
    if (this.searchTerm) {
      filtered = filtered.filter(q => 
        q.question_text.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
    
    // Apply type filter
    if (this.filterType !== 'all') {
      filtered = filtered.filter(q => q.answer_type === this.filterType);
    }
    
    // Apply required filter
    if (this.filterRequired === 'required') {
      filtered = filtered.filter(q => q.is_required);
    } else if (this.filterRequired === 'optional') {
      filtered = filtered.filter(q => !q.is_required);
    }
    
    // Apply sort order
    filtered.sort((a, b) => {
      const valueA = a.display_order ?? a.question_id ?? 0;
      const valueB = b.display_order ?? b.question_id ?? 0;
      return this.sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
    });
    
    this.filteredQuestions = filtered;
    this.currentPage = 1; // Reset to first page when filtering
  }

  // Get paginated questions
  getPaginatedQuestions() {
    const startIndex = (this.currentPage - 1) * this.questionsPerPage;
    const endIndex = startIndex + this.questionsPerPage;
    return this.filteredQuestions.slice(startIndex, endIndex);
  }

  // Render paginated questions
  renderPaginatedQuestions() {
    this.filterQuestions();
    const paginatedQuestions = this.getPaginatedQuestions();
    
    if (this.filteredQuestions.length === 0) {
      return `
        <div class="empty-questions text-center py-5 border rounded-4 bg-white">
          <i class="ph ph-bold ph-question-mark fs-1 mb-2"></i>
          <h4 class="fw-semibold mb-1">No Questions Found</h4>
          <p class="text-muted mb-0">Try adjusting your search or filter criteria</p>
        </div>
      `;
    }

    const startIndex = (this.currentPage - 1) * this.questionsPerPage;
    return paginatedQuestions.map((question, index) => `
      <div class="question-card border rounded-4 p-3 p-md-4 mb-3 bg-white shadow-sm" data-question-id="${question.question_id || ''}">
        <div class="question-header d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div class="d-flex align-items-center gap-2">
            <span class="question-number badge bg-primary-subtle text-primary fw-semibold">${(question.display_order ?? (startIndex + index + 1))}</span>
            <div class="question-type d-flex flex-wrap gap-2">
              <span class="type-badge badge bg-light text-dark text-uppercase">${question.answer_type || 'text'}</span>
              ${question.is_required ? '<span class="required-badge badge bg-danger-subtle text-danger">Required</span>' : ''}
            </div>
          </div>
          <div class="question-actions d-flex gap-2">
            <button class="btn-icon edit-question btn btn-outline-secondary btn-sm d-inline-flex align-items-center justify-content-center" data-id="${question.question_id || ''}" title="Edit">
              <i class="ph ph-bold ph-pencil"></i>
            </button>
            <button class="btn-icon delete-question btn btn-outline-danger btn-sm d-inline-flex align-items-center justify-content-center" data-id="${question.question_id || ''}" title="Delete">
              <i class="ph ph-bold ph-trash"></i>
            </button>
          </div>
        </div>
        <div class="question-content mt-3">
          <div class="question-text-display fw-medium">${question.question_text || 'Untitled Question'}</div>
          ${question.answer_description ? `<div class="question-description text-muted mt-2">${question.answer_description}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  // Render pagination controls
  renderPaginationControls() {
    const totalPages = Math.ceil(this.filteredQuestions.length / this.questionsPerPage);
    const startItem = (this.currentPage - 1) * this.questionsPerPage + 1;
    const endItem = Math.min(this.currentPage * this.questionsPerPage, this.filteredQuestions.length);
    
    const infoMarkup = `
      <div class="col-12 col-lg">
        <p class="pagination-info text-muted small mb-0">
          Showing ${this.filteredQuestions.length === 0 ? 0 : startItem}-${endItem} of ${this.filteredQuestions.length} questions
        </p>
      </div>
    `;

    if (totalPages <= 1) {
      return `<div class="row gy-2 align-items-center">${infoMarkup}</div>`;
    }

    let buttonsMarkup = '';

    if (this.currentPage > 1) {
      buttonsMarkup += `<button type="button" class="pagination-btn prev-btn btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" data-page="${this.currentPage - 1}">
        <i class="ph ph-bold ph-caret-left"></i>
        <span>Previous</span>
      </button>`;
    }

    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      buttonsMarkup += `<button type="button" class="pagination-btn page-btn btn btn-outline-secondary btn-sm" data-page="1">1</button>`;
      if (startPage > 2) {
        buttonsMarkup += `<span class="pagination-ellipsis d-inline-flex align-items-center text-muted">...</span>`;
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      buttonsMarkup += `<button type="button" class="pagination-btn page-btn btn btn-sm ${i === this.currentPage ? 'btn-primary text-white' : 'btn-outline-secondary'}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttonsMarkup += `<span class="pagination-ellipsis d-inline-flex align-items-center text-muted">...</span>`;
      }
      buttonsMarkup += `<button type="button" class="pagination-btn page-btn btn btn-outline-secondary btn-sm" data-page="${totalPages}">${totalPages}</button>`;
    }

    if (this.currentPage < totalPages) {
      buttonsMarkup += `<button type="button" class="pagination-btn next-btn btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1" data-page="${this.currentPage + 1}">
        <span>Next</span>
        <i class="ph ph-bold ph-caret-right"></i>
      </button>`;
    }

    return `
      <div class="row gy-3 align-items-center">
        ${infoMarkup}
        <div class="col-12 col-lg-auto">
          <div class="d-flex flex-wrap gap-2 justify-content-lg-end">
            ${buttonsMarkup}
          </div>
        </div>
      </div>
    `;
  }

  // Attach pagination event handlers
  attachPaginationEventHandlers() {
    // Search input (debounced to prevent flicker)
    const searchInput = document.getElementById('question-search');
    if (searchInput) {
      const onSearch = this.debounce((value) => {
        this.searchTerm = value;
        this.refreshQuestionsDisplay();
      }, 300);
      searchInput.addEventListener('input', (e) => onSearch(e.target.value));

      // Keep focus in the search box and caret at the end
      try {
        const end = searchInput.value.length;
        searchInput.focus();
        if (typeof searchInput.setSelectionRange === 'function') {
          searchInput.setSelectionRange(end, end);
        }
      } catch (e) {}

      // Prevent Enter from submitting or blurring; keep focus for rapid searches
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          // Re-apply focus just in case the browser attempts to blur
          searchInput.focus();
        }
      });
    }

    // Filter selects
    const typeFilter = document.getElementById('type-filter');
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        this.filterType = e.target.value;
        this.refreshQuestionsDisplay();
      });
    }

    const requiredFilter = document.getElementById('required-filter');
    if (requiredFilter) {
      requiredFilter.addEventListener('change', (e) => {
        this.filterRequired = e.target.value;
        this.refreshQuestionsDisplay();
      });
    }

    const pageSizeSelect = document.getElementById('page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        this.questionsPerPage = parseInt(e.target.value);
        this.currentPage = 1;
        this.refreshQuestionsDisplay();
      });
    }

    const sortOrderSelect = document.getElementById('sort-order');
    if (sortOrderSelect) {
      sortOrderSelect.addEventListener('change', (e) => {
        this.sortOrder = e.target.value;
        this.refreshQuestionsDisplay();
      });
    }

    // Pagination buttons
    document.querySelectorAll('.pagination-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt(e.target.getAttribute('data-page'));
        if (page && page !== this.currentPage) {
          this.currentPage = page;
          this.refreshQuestionsDisplay();
        }
      });
    });
  }

  // Refresh questions display with current filters and pagination
  refreshQuestionsDisplay() {
    const questionsList = document.getElementById('questions-list');
    const paginationControls = document.getElementById('pagination-controls');
    
    if (questionsList) {
      questionsList.innerHTML = this.renderPaginatedQuestions();
    }
    
    if (paginationControls) {
      paginationControls.innerHTML = this.renderPaginationControls();
      this.attachPaginationEventHandlers(); // Re-attach event handlers
    }

    // Sync tree view height with questions section
    this.syncTreeViewHeight();

    // Restore focus to the search input after re-render
    const searchInput = document.getElementById('question-search');
    if (searchInput) {
      try {
        const end = searchInput.value.length;
        searchInput.focus();
        if (typeof searchInput.setSelectionRange === 'function') {
          searchInput.setSelectionRange(end, end);
        }
      } catch (e) {}
    }
  }

  // Sync tree view height with questions section
  syncTreeViewHeight() {
    const treeViewSidebar = document.querySelector('.treeview-sidebar');
    const questionsDisplay = document.getElementById('questions-display');
    
    if (treeViewSidebar && questionsDisplay) {
      // Get the height of the questions display area
      const questionsHeight = questionsDisplay.offsetHeight;
      const maxHeight = Math.min(questionsHeight, window.innerHeight * 0.8); // 80vh max
      const minHeight = Math.max(questionsHeight, window.innerHeight * 0.7); // 70vh min
      
      // Apply the calculated height
      treeViewSidebar.style.height = `${Math.max(minHeight, Math.min(maxHeight, questionsHeight))}px`;
    }
  }

  // Render questions list (legacy method for compatibility)
  renderQuestionsList(questions) {
    if (!questions || questions.length === 0) {
      return `
        <div class="empty-questions">
          <i class="ph ph-bold ph-question-mark"></i>
          <h4>No Questions Yet</h4>
          <p>Add your first question to get started</p>
        </div>
      `;
    }

    return questions.map((question, index) => `
      <div class="question-card" data-question-id="${question.question_id || ''}">
        <div class="question-header">
          <div class="question-number">${index + 1}</div>
          <div class="question-type">
            <span class="type-badge">${question.answer_type || 'text'}</span>
          </div>
          <div class="question-actions">
            <button class="btn-icon edit-question" data-id="${question.question_id || ''}" title="Edit">
              <i class="ph ph-bold ph-pencil"></i>
            </button>
            <button class="btn-icon delete-question" data-id="${question.question_id || ''}" title="Delete">
              <i class="ph ph-bold ph-trash"></i>
            </button>
          </div>
        </div>
        <div class="question-content">
          <div class="question-text-display">${question.question_text || 'Untitled Question'}</div>
          ${question.answer_description ? `<div class="question-description">${question.answer_description}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  // Attach questions event handlers
  attachQuestionsEventHandlers(questions, topicId, topicName, categoryName) {
    // Add question button
    const addBtn = document.getElementById('add-question-in-edit');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.addQuestionInEditMode(topicId, questions, categoryName, topicName);
      });
    }

    // Update all questions button
    const updateBtn = document.getElementById('update-all-questions');
    if (updateBtn) {
      updateBtn.addEventListener('click', () => {
        this.updateAllQuestions(questions);
      });
    }

    // Question action buttons
    document.querySelectorAll('.edit-question').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const questionId = e.target.closest('.edit-question').getAttribute('data-id');
        this.editQuestion(questionId);
      });
    });

    document.querySelectorAll('.delete-question').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const questionId = e.target.closest('.delete-question').getAttribute('data-id');
        this.deleteQuestion(questionId, topicId, topicName, categoryName);
      });
    });
  }

  // Edit question - open modal with question data
  async editQuestion(questionId) {
    try {
      // Fetch question data
      const question = await this.fetchQuestionById(questionId);
      if (!question) {
        this.showSnackbar("Question not found", { background: "#f44336" });
        return;
      }

      // Show edit modal
      this.showEditQuestionModal(question);
    } catch (error) {
      console.error('Error fetching question:', error);
      this.showSnackbar("Failed to load question data", { background: "#f44336" });
    }
  }

  // Delete question
  async deleteQuestion(questionId, topicId, topicName, categoryName) {
    this.showDeleteConfirmation(
      'Delete Question',
      `Are you sure you want to delete this question from "${topicName}"?`,
      async () => {
        try {
          const response = await fetch(`/api/questions/${questionId}/`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': this.getCookie('csrftoken')
            },
          });
          
          if (!response.ok) {
            throw new Error('Failed to delete question');
          }
          
          // Refresh the questions display
          await this.refreshQuestionsDisplay();
          
          this.showSnackbar("Question deleted successfully!", { background: "#4caf50" });
          
        } catch (error) {
          console.error('Error deleting question:', error);
          this.showSnackbar("Failed to delete question: " + (error.message || "Unknown error"), { background: "#f44336" });
        }
      }
    );
  }

  // Fetch topic questions
  async fetchTopicQuestions(topicId) {
    try {
      const response = await fetch(`/api/topics/${topicId}/questions/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch questions");
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching topic questions:', error);
      return [];
    }
  }

  // Render edit questions interface
  renderEditQuestions(questions, topicId, categoryName, topicName) {
    questions = questions.map((q) => {
      let realId = q.question_id !== undefined && q.question_id !== null && !isNaN(Number(q.question_id))
        ? String(q.question_id) : undefined;
      return {
        ...q,
        question_id: realId,
        topic_id: q.topic_id ? String(q.topic_id) : topicId,
      };
    });

    this.currentDraftQuestions = questions;
    this.currentTopicId = topicId;

    this.draftsContainer.innerHTML += `
      <div class="modern-section" style="background: var(--white);">
        <div class="section-header">
          <div class="section-title">
            <h3>Edit Questions</h3>
            <p class="section-description">Modify question text, types, and settings. Changes are saved automatically.</p>
          </div>
          <div class="section-actions" style="margin-left:auto;display:flex;gap:10px;align-items:center;">
            <button type="button" id="add-question-in-edit" class="btn secondary modern-btn">
              <i class="ph ph-bold ph-plus"></i>
              <span>Add Question</span>
            </button>
          </div>
        </div>
        <div class="context-info-card">
          <div class="context-item">
            <i class="ph ph-bold ph-files"></i>
            <span class="context-label">Topic:</span>
            <span class="context-value">${topicName}</span>
          </div>
          <div class="context-separator"></div>
          <div class="context-item">
            <i class="ph ph-bold ph-folder"></i>
            <span class="context-label">Category:</span>
            <span class="context-value">${categoryName}</span>
          </div>
        </div>
        <div class="form-actions modern-actions">
          <button type="button" id="update-all-questions" class="btn primary modern-btn">
            <i class="ph ph-bold ph-floppy-disk"></i>
            <span>Save</span>
          </button>
        </div>
      </div>
    `;

    this.attachEditQuestionsEventHandlers(questions, topicId, categoryName, topicName);
  }

  // Attach event handlers for edit questions
  attachEditQuestionsEventHandlers(questions, topicId, categoryName, topicName) {
    // Update all questions button
    const updateBtn = document.getElementById("update-all-questions");
    if (updateBtn) {
      updateBtn.onclick = () => {
        this.updateAllQuestions(questions);
      };
    }

    // Add question in edit mode
    const addQuestionEditBtn = document.getElementById("add-question-in-edit");
    if (addQuestionEditBtn) {
      addQuestionEditBtn.onclick = () => {
        this.addQuestionInEditMode(topicId, questions, categoryName, topicName);
      };
    }

    // Create questions container and render questions
    const questionsContainer = document.createElement("div");
    questionsContainer.className = "questions-container";
    this.draftsContainer.appendChild(questionsContainer);
    this.currentDraftQuestionsContainer = questionsContainer;
    
    // Use QuestionManager to render questions
    if (window.questionManager) {
      window.questionManager.renderQuestions(questions, questionsContainer);
    }
  }

  // Update all questions
  async updateAllQuestions(questions) {
    // No loading state - removed to prevent flicker
    const updateButton = document.getElementById("update-all-questions");
    // Light-weight button feedback only (no skeleton during CRUD)
    let originalBtnText;
    if (updateButton) {
      originalBtnText = updateButton.innerHTML;
      updateButton.disabled = true;
      updateButton.innerHTML = '<i class="ph ph-bold ph-floppy-disk"></i><span>Saving...</span>';
    }

    try {
      const updatePromises = questions.map((q) => {
        if (!q.question_id) return Promise.resolve();
        
        return this.updateQuestion(q.question_id, {
          question_text: q.question_text,
          answer_type: q.answer_type,
          is_required: q.is_required,
          display_order: q.display_order,
          choices: q.choices,
          sub_questions: q.sub_questions || [],
          answer_description: q.answer_description || "",
        });
      });

      await Promise.all(updatePromises);
      this.showSnackbar("All questions updated successfully!", { background: "#4caf50" });
    } catch (err) {
      this.showSnackbar("Failed to update questions: " + (err.message || "Unknown error"));
    } finally {
      if (updateButton) {
        updateButton.disabled = false;
        updateButton.innerHTML = originalBtnText || '<i class="ph ph-bold ph-floppy-disk"></i><span>Save Changes</span>';
      }
    }
  }

  // Add question in edit mode - show create modal
  async addQuestionInEditMode(topicId, questions, categoryName, topicName) {
    // Show create question modal
    this.showCreateQuestionModal(topicId, categoryName, topicName);
  }

  // API methods - Note: Topic rename and delete are not implemented in backend

  // Refresh draft questions after deletion
  async refreshDraftQuestions() {
    if (this.currentDraftQuestionsContainer && this.currentTopicId) {
      // No skeleton during CRUD refresh to avoid flicker
      try {
        const questions = await this.fetchTopicQuestions(this.currentTopicId);
        this.currentDraftQuestions = questions;
        
        // Clear and re-render questions
        this.currentDraftQuestionsContainer.innerHTML = '';
        if (window.questionManager) {
          window.questionManager.renderQuestions(questions, this.currentDraftQuestionsContainer);
        }
      } catch (error) {
        console.error('Error refreshing draft questions:', error);
      }
    }
  }

  async createQuestion(payload) {
    try {
      const response = await fetch('/api/question/create/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': this.getCookie('csrftoken')
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error('Failed to create question');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating question:', error);
      throw error;
    }
  }

  async updateQuestion(questionId, payload) {
    try {
      const response = await fetch(`/api/question/${questionId}/update/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': this.getCookie('csrftoken')
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Update failed:', response.status, errorText);
        throw new Error(`Failed to update question: ${response.status} - ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating question:', error);
      throw error;
    }
  }

  // Save drafts page state
  saveDraftsPageState(state) {
    localStorage.setItem("draftsPageState", JSON.stringify(state));
  }

  // Fetch question by ID
  async fetchQuestionById(questionId) {
    try {
      const response = await fetch(`/api/question/${questionId}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch question');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching question:', error);
      return null;
    }
  }

  // Show create question modal
  showCreateQuestionModal(topicId, categoryName, topicName) {
    const existingModal = document.getElementById('create-question-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modalHTML = `
      <div class="modal fade" id="create-question-modal" tabindex="-1" aria-labelledby="createQuestionModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div class="modal-content border-0 rounded-3 shadow">
            <div class="modal-header border-0 pb-0">
              <div class="w-100">
                <div class="d-flex justify-content-between align-items-start">
                  <p class="text-uppercase text-secondary mb-1 small fw-medium">Questions</p>
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
                  <h3 class="modal-title mb-1" id="createQuestionModalLabel">Create New Question</h3>
                  <span class="badge bg-light text-dark border text-uppercase fw-semibold">Draft</span>
                </div>
                <div class="d-flex flex-column gap-2 mt-1">
                  <span class="badge bg-primary-subtle text-primary fw-medium">Category: ${categoryName}</span>
                  <span class="badge bg-secondary-subtle text-secondary fw-medium">Topic: ${topicName}</span>
                </div>
              </div>
            </div>
            <div class="modal-body pt-3">
              <form id="create-question-form" class="rounded-4 shadow-sm bg-light px-3 py-4">
                <div class="row g-4 align-items-end">
                  <div class="col-12 mb-2">
                    <label for="create-question-text" class="form-label text-muted fw-semibold text-uppercase mb-2" style="font-size:1rem;letter-spacing:0.05em;">
                      <span class="me-1">Question Text</span>
                      <span class="text-danger">*</span>
                    </label>
                    <textarea id="create-question-text" name="question_text" required rows="3"
                      class="form-control form-control-lg rounded-3 shadow-none px-3 py-2"
                      style="min-height:92px;font-size:1.1rem;resize:vertical;background-color:#f8fafb;border:1.5px solid #e0e3e8;"
                      placeholder="Enter your question here..."></textarea>
                  </div>

                  <div class="col-md-7 mb-2">
                    <label for="create-answer-type" class="form-label text-muted fw-semibold text-uppercase mb-2" style="font-size:1rem;letter-spacing:0.05em;">
                      <span class="me-1">Answer Type</span>
                      <span class="text-danger">*</span>
                    </label>
                    <div class="input-group">
                      <span class="input-group-text bg-white border-end-0 text-primary px-3" style="font-size:1.3em;">
                        <i class="ph ph-bold ph-file-text"></i>
                      </span>
                      <select id="create-answer-type" name="answer_type" required
                        class="form-select form-select-lg border-start-0 rounded-end"
                        style="font-size:1.07rem;">
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </div>
                  </div>

                  <div class="col-md-5 mb-2 d-flex align-items-center" style="margin-top:28px;">
                    <div class="form-check ms-2 ps-2 flex-fill">
                      <input type="checkbox" id="create-is-required"
                        name="is_required"
                        class="form-check-input bg-primary border-2 border-primary"
                        checked
                        style="width:1.35em;height:1.35em;cursor:pointer;">
                      <label class="form-check-label fw-semibold ms-2 user-select-none" for="create-is-required"
                        style="font-size:1.05rem;">
                        Required
                        <span class="ms-1 text-muted small">(user must answer)</span>
                      </label>
                    </div>
                  </div>
                </div>
                <div class="row mt-4">
                  <div class="col-12">
                    <div class="p-3 border rounded-3 bg-white w-100 shadow-sm">
                      <p class="fw-semibold mb-2 text-dark">Answer Type Tips</p>
                      <ul class="mb-0 small text-muted ps-3">
                        <li><span class="text-primary"><strong>Text</strong></span> – For qualitative responses.</li>
                        <li><span class="text-primary"><strong>Number</strong></span> – Only numeric values allowed.</li>
                        <li><span class="text-primary"><strong>Date</strong></span> – Selects a calendar date.</li>
                        <li><span class="text-primary"><strong>Percentage</strong></span> – Value between 0-100.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer border-0 pt-0 d-flex justify-content-between align-items-center">
              <div class="text-muted small">Fields marked with <span class="text-danger">*</span> are required.</div>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="save-create-question">
                  <i class="ph ph-plus"></i>
                  Create Question
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modalElement = document.getElementById('create-question-modal');
    if (!(window.bootstrap && bootstrap.Modal) || !modalElement) {
      console.error('Bootstrap modal not available.');
      return;
    }

    modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove(), { once: true });
    const modalInstance = new bootstrap.Modal(modalElement);
    modalInstance.show();

    this.attachCreateModalEventHandlers(topicId, categoryName, topicName);
  }

  // Show edit question modal
  showEditQuestionModal(question) {
    const existingModal = document.getElementById('edit-question-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modalHTML = `
      <div class="modal fade" id="edit-question-modal" tabindex="-1" aria-labelledby="editQuestionModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div class="modal-content border-0 rounded-3 shadow">
            <div class="modal-header border-0 pb-0">
              <div class="w-100">
                <div class="d-flex justify-content-between align-items-start">
                  <p class="text-uppercase text-secondary mb-1 small fw-medium">Questions</p>
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
                  <h3 class="modal-title mb-1" id="editQuestionModalLabel">Edit Question</h3>
                  <span class="badge bg-light text-dark border text-uppercase fw-semibold">Existing</span>
                </div>
                <p class="text-muted mb-0 small">Review or update the question details below.</p>
              </div>
            </div>
            <div class="modal-body pt-3">
              <form id="edit-question-form" class="rounded-4 shadow-sm bg-light px-3 py-4">
                <div class="row g-4 align-items-end">
                  <div class="col-12 mb-2">
                    <label for="edit-question-text" class="form-label text-muted fw-semibold text-uppercase mb-2" style="font-size:1rem;letter-spacing:0.05em;">
                      <span class="me-1">Question Text</span>
                      <span class="text-danger">*</span>
                    </label>
                    <textarea id="edit-question-text" name="question_text" required rows="3"
                      class="form-control form-control-lg rounded-3 shadow-none px-3 py-2"
                      style="min-height:92px;font-size:1.1rem;resize:vertical;background-color:#f8fafb;border:1.5px solid #e0e3e8;"
                      placeholder="Enter your question here...">${question.question_text || ''}</textarea>
                  </div>
                  
                  <div class="col-md-7 mb-2">
                    <label for="edit-answer-type" class="form-label text-muted fw-semibold text-uppercase mb-2" style="font-size:1rem;letter-spacing:0.05em;">
                      <span class="me-1">Answer Type</span>
                      <span class="text-danger">*</span>
                    </label>
                    <div class="input-group">
                      <span class="input-group-text bg-white border-end-0 text-primary px-3" style="font-size:1.3em;">
                        <i class="ph ph-bold ph-file-text"></i>
                      </span>
                      <select id="edit-answer-type" name="answer_type" required
                        class="form-select form-select-lg border-start-0 rounded-end"
                        style="font-size:1.07rem;">
                        <option value="text" ${question.answer_type === 'text' ? 'selected' : ''}>Text</option>
                        <option value="number" ${question.answer_type === 'number' ? 'selected' : ''}>Number</option>
                        <option value="date" ${question.answer_type === 'date' ? 'selected' : ''}>Date</option>
                        <option value="percentage" ${question.answer_type === 'percentage' ? 'selected' : ''}>Percentage</option>
                      </select>
                    </div>
                  </div>

                  <div class="col-md-5 mb-2 d-flex align-items-center" style="margin-top:28px;">
                    <div class="form-check ms-2 ps-2 flex-fill">
                      <input type="checkbox" id="edit-is-required"
                        name="is_required"
                        class="form-check-input bg-primary border-2 border-primary"
                        ${question.is_required ? 'checked' : ''}
                        style="width:1.35em;height:1.35em;cursor:pointer;">
                      <label class="form-check-label fw-semibold ms-2 user-select-none" for="edit-is-required"
                        style="font-size:1.05rem;">
                        Required
                        <span class="ms-1 text-muted small">(user must answer)</span>
                      </label>
                    </div>
                  </div>
                </div>
                <div class="row mt-4">
                  <div class="col-12">
                    <div class="p-3 border rounded-3 bg-white w-100 shadow-sm">
                      <p class="fw-semibold mb-2 text-dark">Editing Guidance</p>
                      <ul class="mb-0 small text-muted ps-3">
                        <li>Keep the question concise and measurable.</li>
                        <li>Choose the answer type that matches reporting.</li>
                        <li>Mark as required only when essential.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer border-0 pt-0 d-flex justify-content-between align-items-center">
              <div class="text-muted small">Fields marked with <span class="text-danger">*</span> are required.</div>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="save-edit-question">
                  <i class="ph ph-floppy-disk"></i>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modalElement = document.getElementById('edit-question-modal');
    if (!(window.bootstrap && bootstrap.Modal) || !modalElement) {
      console.error('Bootstrap modal not available.');
      return;
    }

    modalElement.addEventListener('hidden.bs.modal', () => modalElement.remove(), { once: true });
    const modalInstance = new bootstrap.Modal(modalElement);
    modalInstance.show();

    this.attachEditModalEventHandlers(question.question_id);
  }

  // Attach create modal event handlers
  attachCreateModalEventHandlers(topicId, categoryName, topicName) {
    const saveBtn = document.getElementById('save-create-question');
    const answerTypeSelect = document.getElementById('create-answer-type');
    const questionText = document.getElementById('create-question-text');

    answerTypeSelect?.addEventListener('change', () => {
      this.clearFieldError('create-answer-type');
    });

    questionText?.addEventListener('input', () => {
      this.clearFieldError('create-question-text');
    });

    saveBtn?.addEventListener('click', async () => {
      await this.saveNewQuestion(topicId, categoryName, topicName);
    });
  }

  // Attach edit modal event handlers
  attachEditModalEventHandlers(questionId) {
    const saveBtn = document.getElementById('save-edit-question');
    const answerTypeSelect = document.getElementById('edit-answer-type');
    const questionText = document.getElementById('edit-question-text');

    answerTypeSelect?.addEventListener('change', () => {
      this.clearFieldError('edit-answer-type');
    });

    questionText?.addEventListener('input', () => {
      this.clearFieldError('edit-question-text');
    });

    saveBtn?.addEventListener('click', async () => {
      await this.saveEditedQuestion(questionId);
    });
  }

  // Save new question
  async saveNewQuestion(topicId, categoryName, topicName) {
    const form = document.getElementById('create-question-form');
    const formData = new FormData(form);
    
    // Get form values
    const questionText = formData.get('question_text').trim();
    const answerType = formData.get('answer_type');
    const isRequired = formData.get('is_required') === 'on';

    // Clear previous errors
    this.clearValidationErrors();

    // Validate required fields
    let hasErrors = false;

    if (!questionText) {
      this.showFieldError('create-question-text', 'Question text is required');
      hasErrors = true;
    }

    if (!answerType) {
      this.showFieldError('create-answer-type', 'Answer type is required');
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    // No loading state - removed to prevent flicker
    const saveBtn = document.getElementById('save-create-question');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Creating...';
    saveBtn.disabled = true;

    try {
      // Prepare payload
      const payload = {
        topic_id: topicId,
        question_text: questionText,
        answer_type: answerType,
        is_required: isRequired
      };

      await this.createQuestion(payload);
      
      this.hideModal('create-question-modal');
      
      // Refresh the questions display
      await this.refreshQuestionsDisplay();
      
      this.showSnackbar("Question created successfully!", { background: "#4caf50" });
      
    } catch (error) {
      console.error('Error creating question:', error);
      this.showSnackbar("Failed to create question: " + (error.message || "Unknown error"), { background: "#f44336" });
    } finally {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }
  }

  // Save edited question
  async saveEditedQuestion(questionId) {
    const form = document.getElementById('edit-question-form');
    const formData = new FormData(form);
    
    // Get form values
    const questionText = formData.get('question_text').trim();
    const answerType = formData.get('answer_type');
    const isRequired = formData.get('is_required') === 'on';

    // Clear previous errors
    this.clearValidationErrors();

    // Validate required fields
    let hasErrors = false;

    if (!questionText) {
      this.showFieldError('edit-question-text', 'Question text is required');
      hasErrors = true;
    }

    if (!answerType) {
      this.showFieldError('edit-answer-type', 'Answer type is required');
      hasErrors = true;
    }


    if (hasErrors) {
      return;
    }

    // No loading state - removed to prevent flicker
    const saveBtn = document.getElementById('save-edit-question');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
      // Prepare payload
      const payload = {
        question_text: questionText,
        answer_type: answerType,
        is_required: isRequired
      };

      await this.updateQuestion(questionId, payload);
      
      this.hideModal('edit-question-modal');
      
      // Refresh the questions display
      await this.refreshQuestionsDisplay();
      
      this.showSnackbar("Question updated successfully!", { background: "#4caf50" });
      
    } catch (error) {
      console.error('Error updating question:', error);
      this.showSnackbar("Failed to update question: " + (error.message || "Unknown error"), { background: "#f44336" });
    } finally {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }
  }

  hideModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (!modalElement) return;
    const instance =
      window.bootstrap && bootstrap.Modal
        ? bootstrap.Modal.getInstance(modalElement)
        : null;
    if (instance) {
      instance.hide();
    } else {
      modalElement.remove();
    }
  }

  // Clear validation errors
  clearValidationErrors() {
    document.querySelectorAll('.form-group').forEach(group => {
      group.classList.remove('error');
      const input = group.querySelector('input, textarea, select');
      if (input) {
        input.classList.remove('error', 'is-invalid');
      }
      const errorMsg = group.querySelector('.error-message');
      if (errorMsg) {
        errorMsg.remove();
      }
    });
  }

  // Show field error
  showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    const formGroup = field.closest('.form-group');
    if (!formGroup) return;

    // Add error class
    formGroup.classList.add('error');
    field.classList.add('error', 'is-invalid');

    // Remove existing error message
    const existingError = formGroup.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }

    // Add error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    formGroup.appendChild(errorDiv);
  }

  // Clear field error
  clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    const formGroup = field.closest('.form-group');
    if (!formGroup) return;

    formGroup.classList.remove('error');
    field.classList.remove('error', 'is-invalid');
    
    const errorMsg = formGroup.querySelector('.error-message');
    if (errorMsg) {
      errorMsg.remove();
    }
  }

  // Refresh questions display in tree view
  async refreshQuestionsDisplay() {
    const questionsDisplay = document.getElementById('questions-display');
    if (!questionsDisplay) return;

    // Get current topic info from the selected topic node
    const selectedTopic = document.querySelector('.topic-node.selected');
    if (!selectedTopic) return;

    const topicId = selectedTopic.getAttribute('data-topic-id');
    const topicName = selectedTopic.getAttribute('data-topic-name');
    const categoryName = selectedTopic.getAttribute('data-category');

    if (!topicId) return;

    // No loading state - removed to prevent flicker
    // No loading state - removed to prevent flicker

    try {
      // Fetch updated questions
      const questions = await this.fetchTopicQuestions(topicId);
      
      // Re-render the questions display
      this.renderQuestionsDisplay(questions, topicId, topicName, categoryName);
    } catch (error) {
      console.error('Error refreshing questions:', error);
      questionsDisplay.innerHTML = `
        <div class="error-state">
          <i class="ph ph-bold ph-warning"></i>
          <h3>Error Loading Questions</h3>
          <p>Failed to refresh questions</p>
        </div>
      `;
    }
  }

  // Helper function to get cookie
  getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === name + "=") {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          if (cookieValue.startsWith('"') && cookieValue.endsWith('"')) {
            cookieValue = cookieValue.slice(1, -1);
          }
          break;
        }
      }
    }
    return cookieValue;
  }

  // Show snackbar message
  showSnackbar(message, options = {}) {
    let snackbar = document.getElementById("global-error-snackbar");
    if (!snackbar) {
      snackbar = document.createElement("div");
      snackbar.id = "global-error-snackbar";
      snackbar.style.position = "fixed";
      snackbar.style.bottom = "32px";
      snackbar.style.left = "50%";
      snackbar.style.transform = "translateX(-50%)";
      snackbar.style.background = options.background || "#d32f2f";
      snackbar.style.color = "#fff";
      snackbar.style.padding = "16px 32px";
      snackbar.style.borderRadius = "6px";
      snackbar.style.zIndex = "99999";
      snackbar.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      snackbar.style.fontSize = "16px";
      snackbar.style.display = "flex";
      snackbar.style.alignItems = "center";
      snackbar.style.gap = "16px";
      snackbar.innerHTML = `<span>${message}</span><button style="background:#fff;color:#323232;padding:4px 16px;border-radius:4px;font-weight:600;border:none;cursor:pointer;">Dismiss</button>`;
      document.body.appendChild(snackbar);
      snackbar.querySelector("button").onclick = function () {
        snackbar.style.display = "none";
      };
    } else {
      snackbar.querySelector("span").textContent = message;
      snackbar.style.display = "flex";
    }
    setTimeout(() => {
      snackbar.style.display = "none";
    }, options.duration || 7000);
  }

  // CRUD Methods for Categories and Topics
  handleAddCategory() {
    this.showInlineInput('category', null, 'Enter category name', (name) => {
      this.saveCategory(name);
    });
  }

  handleAddTopic(categoryId) {
    this.showInlineInput('topic', categoryId, 'Enter topic name', (name) => {
      this.saveTopic(categoryId, name);
    });
  }

  handleRenameCategory(categoryId, currentName) {
    this.showInlineInput('category', categoryId, 'Enter new name', (newName) => {
      this.updateCategory(categoryId, newName);
    }, currentName);
  }

  handleRenameTopic(topicId, currentName) {
    this.showInlineInput('topic', topicId, 'Enter new name', (newName) => {
      this.updateTopic(topicId, newName);
    }, currentName);
  }

  handleDeleteCategory(categoryId, categoryName) {
    this.showDeleteConfirmation(
      'Delete Category',
      `Are you sure you want to delete the category "${categoryName}" and all its topics?`,
      () => this.deleteCategory(categoryId)
    );
  }

  handleDeleteTopic(topicId, topicName) {
    this.showDeleteConfirmation(
      'Delete Topic',
      `Are you sure you want to delete the topic "${topicName}" and all its questions?`,
      () => this.deleteTopic(topicId)
    );
  }

  showInlineInput(type, id, placeholder, onSave, currentValue = '') {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.placeholder = placeholder;
    input.className = 'tree-inline-input';
    input.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    input.addEventListener('mousedown', (event) => {
      event.stopPropagation();
    });
    
    let isRemoved = false;
    
    const handleSave = () => {
      if (isRemoved) return;
      const value = input.value.trim();
      if (value) {
        onSave(value);
      }
      isRemoved = true;
      input.remove();
      // Restore label visibility
      restoreLabel();
    };

    const handleCancel = () => {
      if (isRemoved) return;
      isRemoved = true;
      input.remove();
      // Restore label visibility
      restoreLabel();
    };

    const restoreLabel = () => {
      if (type === 'category' && id) {
        const categoryNode = document.querySelector(`[data-category-id="${id}"]`);
        if (categoryNode) {
          categoryNode.classList.remove('editing');
          const label = categoryNode.querySelector('.tree-node-label');
          const icon = categoryNode.querySelector('.tree-node-icon');
          const actions = categoryNode.querySelector('.tree-node-actions');
          if (label) label.style.display = '';
          if (icon) icon.style.display = '';
          if (actions) actions.style.display = '';
        }
      } else if (type === 'topic' && id) {
        const topicNode = document.querySelector(`[data-topic-id="${id}"]`);
        if (topicNode) {
          topicNode.classList.remove('editing');
          const label = topicNode.querySelector('.tree-node-label');
          const icon = topicNode.querySelector('.tree-node-icon');
          const actions = topicNode.querySelector('.tree-node-actions');
          if (label) label.style.display = '';
          if (icon) icon.style.display = '';
          if (actions) actions.style.display = '';
        }
      }
    };

    input.addEventListener('blur', handleSave);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    });

    // Find the appropriate container and add input
    if (type === 'category' && !id) {
      // Add category input at the bottom
      const tree = document.getElementById('draft-tree');
      tree.appendChild(input);
    } else if (type === 'category' && id) {
      // Rename category - replace the label with input
      const categoryNode = document.querySelector(`[data-category-id="${id}"]`);
      if (categoryNode) {
        categoryNode.classList.add('editing');
        const label = categoryNode.querySelector('.tree-node-label');
        const icon = categoryNode.querySelector('.tree-node-icon');
        const actions = categoryNode.querySelector('.tree-node-actions');
        if (label) {
          label.style.display = 'none';
          label.parentElement.appendChild(input);
        }
        // Hide icon and actions to give more space
        if (icon) icon.style.display = 'none';
        if (actions) actions.style.display = 'none';
      }
    } else if (type === 'topic' && id) {
      // Check if this is a rename operation (existing topic) or add operation (new topic)
      const topicNode = document.querySelector(`[data-topic-id="${id}"]`);
      if (topicNode) {
        // Rename topic - replace the label with input
        topicNode.classList.add('editing');
        const label = topicNode.querySelector('.tree-node-label');
        const icon = topicNode.querySelector('.tree-node-icon');
        const actions = topicNode.querySelector('.tree-node-actions');
        if (label) {
          label.style.display = 'none';
          label.parentElement.appendChild(input);
        }
        // Hide icon and actions to give more space
        if (icon) icon.style.display = 'none';
        if (actions) actions.style.display = 'none';
      } else {
        // Add topic input in the category's children
        const categoryNode = document.querySelector(`[data-category-id="${id}"]`);
        if (categoryNode) {
          const children = categoryNode.parentElement.querySelector('.tree-children');
          if (children) {
            children.appendChild(input);
          }
        }
      }
    }

    input.focus();
    input.select();
  }

  showDeleteConfirmation(title, message, onConfirm) {
    // Remove any existing modal
    const existingModal = document.getElementById('delete-confirmation-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.id = 'delete-confirmation-modal';
    modal.className = 'confirm-delete-popup';
    modal.style.cssText = `
      position: relative;
      background: white;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      padding: 24px;
      max-width: 400px;
      width: 90%;
      z-index: 1001;
    `;

    modal.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h3 style="margin: 0 0 8px 0; color: var(--text-heading); font-size: 1.2rem; font-weight: 600;">
          ${title}
        </h3>
        <p style="margin: 0; color: var(--text-muted); font-size: 0.95rem; line-height: 1.5;">
          ${message}
        </p>
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn-cancel" style="
          padding: 10px 20px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--white);
          color: var(--text-heading);
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.2s ease;
        ">
          Cancel
        </button>
        <button class="btn-confirm" style="
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          background: var(--danger, #dc2626);
          color: white;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.2s ease;
        ">
          Delete
        </button>
      </div>
    `;

    // Add event listeners
    const cancelBtn = modal.querySelector('.btn-cancel');
    const confirmBtn = modal.querySelector('.btn-confirm');

    const closeModal = () => {
      backdrop.remove();
    };

    const handleConfirm = () => {
      closeModal();
      onConfirm();
    };

    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', handleConfirm);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    // Add hover effects
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = 'var(--gray-50)';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = 'var(--white)';
    });

    confirmBtn.addEventListener('mouseenter', () => {
      confirmBtn.style.background = 'var(--danger-dark, #b91c1c)';
    });
    confirmBtn.addEventListener('mouseleave', () => {
      confirmBtn.style.background = 'var(--danger, #dc2626)';
    });

    // Add keyboard support
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    // Append to body
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Focus the cancel button for accessibility
    cancelBtn.focus();
  }

  attachHoverTooltips() {
    const tree = document.getElementById('draft-tree');
    if (!tree) return;

    // Remove existing tooltips
    document.querySelectorAll('.tree-tooltip').forEach(tooltip => tooltip.remove());

    // Add tooltips to category and topic labels
    const labels = tree.querySelectorAll('.tree-node-label');
    labels.forEach(label => {
      const fullText = label.textContent;
      const labelWidth = label.offsetWidth;
      const textWidth = label.scrollWidth;
      
      // Only show tooltip if text is truncated
      if (textWidth > labelWidth) {
        this.createHoverTooltip(label, fullText);
      }
    });
  }

  createHoverTooltip(element, text) {
    let tooltip = null;
    let showTimeout = null;
    let hideTimeout = null;

    const showTooltip = () => {
      if (tooltip) return;
      
      tooltip = document.createElement('div');
      tooltip.className = 'tree-tooltip';
      tooltip.textContent = text;
      document.body.appendChild(tooltip);

      const rect = element.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      const left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
      const top = rect.top - tooltipRect.height - 8;
      
      tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - tooltipRect.width - 8, left))}px`;
      tooltip.style.top = `${Math.max(8, top)}px`;

      requestAnimationFrame(() => tooltip && tooltip.classList.add('show'));
    };

    const hideTooltip = () => {
      if (tooltip) {
        tooltip.classList.remove('show');
        setTimeout(() => {
          if (tooltip) {
            tooltip.remove();
            tooltip = null;
          }
        }, 200);
      }
    };

    element.addEventListener('mouseenter', () => {
      if (element.closest('.tree-node-item')?.classList.contains('editing')) return;
      clearTimeout(hideTimeout);
      showTimeout = setTimeout(showTooltip, 250);
    });

    element.addEventListener('mouseleave', () => {
      hideTimeout = setTimeout(hideTooltip, 100);
    });

    element.addEventListener('mousemove', () => {
      clearTimeout(hideTimeout);
    });
  }

  async saveCategory(name) {
    try {
      console.log('Creating category:', { name });
      const response = await fetch('/api/category/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      
      console.log('Category creation response status:', response.status);
      const responseData = await response.json();
      console.log('Category creation response data:', responseData);
      
      if (response.ok) {
        this.loadDraftedQuestionnaires(); // Refresh tree
        this.showSnackbar('Category created successfully');
      } else {
        console.error('API Error:', responseData);
        throw new Error('Failed to create category: ' + (responseData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Category creation error:', error);
      this.showSnackbar('Error creating category: ' + error.message, { type: 'error' });
    }
  }

  async saveTopic(categoryId, name) {
    try {
      console.log('Creating topic:', { categoryId, name });
      const response = await fetch('/api/topic/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId, name })
      });
      
      console.log('Topic creation response status:', response.status);
      const responseData = await response.json();
      console.log('Topic creation response data:', responseData);
      
      if (response.ok) {
        this.loadDraftedQuestionnaires(); // Refresh tree
        this.showSnackbar('Topic created successfully');
      } else {
        console.error('API Error:', responseData);
        throw new Error('Failed to create topic: ' + (responseData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Topic creation error:', error);
      this.showSnackbar('Error creating topic: ' + error.message, { type: 'error' });
    }
  }

  async updateCategory(categoryId, name) {
    try {
      const response = await fetch(`/api/category/${categoryId}/update/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      
      if (response.ok) {
        this.loadDraftedQuestionnaires(); // Refresh tree
        this.showSnackbar('Category updated successfully');
      } else {
        throw new Error('Failed to update category');
      }
    } catch (error) {
      this.showSnackbar('Error updating category: ' + error.message, { type: 'error' });
    }
  }

  async updateTopic(topicId, name) {
    try {
      const response = await fetch(`/api/topic/${topicId}/update/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      
      if (response.ok) {
        this.loadDraftedQuestionnaires(); // Refresh tree
        this.showSnackbar('Topic updated successfully');
      } else {
        throw new Error('Failed to update topic');
      }
    } catch (error) {
      this.showSnackbar('Error updating topic: ' + error.message, { type: 'error' });
    }
  }

  async deleteCategory(categoryId) {
    try {
      const response = await fetch(`/api/category/${categoryId}/delete/`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        this.loadDraftedQuestionnaires(); // Refresh tree
        this.showSnackbar('Category deleted successfully');
      } else {
        throw new Error('Failed to delete category');
      }
    } catch (error) {
      this.showSnackbar('Error deleting category: ' + error.message, { type: 'error' });
    }
  }

  async deleteTopic(topicId) {
    try {
      const response = await fetch(`/api/topic/${topicId}/delete/`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        this.loadDraftedQuestionnaires(); // Refresh tree
        this.showSnackbar('Topic deleted successfully');
      } else {
        throw new Error('Failed to delete topic');
      }
    } catch (error) {
      this.showSnackbar('Error deleting topic: ' + error.message, { type: 'error' });
    }
  }

  // Initialize treeview resizer functionality
  initializeResizer() {
    const resizer = document.getElementById('treeview-resizer');
    const sidebar = document.querySelector('.treeview-sidebar');
    const mainContent = document.querySelector('.main-content-area');
    
    if (!resizer || !sidebar || !mainContent) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    const startResize = (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = sidebar.offsetWidth;
      
      // Add visual feedback
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      // Add resize class for styling
      sidebar.classList.add('resizing');
      resizer.classList.add('active');
      
      e.preventDefault();
    };

    const doResize = (e) => {
      if (!isResizing) return;
      
      const deltaX = e.clientX - startX;
      const newWidth = startWidth + deltaX;
      
      // Apply constraints
      const minWidth = 180;
      const maxWidth = 500;
      const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      
      sidebar.style.width = constrainedWidth + 'px';
      
      // Update title display based on width
      this.updateTitleDisplay(sidebar, constrainedWidth);
      
      e.preventDefault();
    };

    const stopResize = () => {
      if (!isResizing) return;
      
      isResizing = false;
      
      // Remove visual feedback
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Remove resize class
      sidebar.classList.remove('resizing');
      resizer.classList.remove('active');
      
      // Save width to localStorage
      const finalWidth = sidebar.offsetWidth;
      localStorage.setItem('treeview-sidebar-width', finalWidth);
    };

    // Event listeners
    resizer.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
    
    // Restore saved width
    const savedWidth = localStorage.getItem('treeview-sidebar-width');
    if (savedWidth) {
      const width = parseInt(savedWidth);
      if (width >= 180 && width <= 500) {
        sidebar.style.width = width + 'px';
        this.updateTitleDisplay(sidebar, width);
      }
    } else {
      // Set initial title display for default width
      this.updateTitleDisplay(sidebar, sidebar.offsetWidth);
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
      const currentWidth = sidebar.offsetWidth;
      const containerWidth = sidebar.parentElement.offsetWidth;
      
      // If sidebar is too wide for container, adjust it
      if (currentWidth > containerWidth * 0.6) {
        sidebar.style.width = Math.min(400, containerWidth * 0.4) + 'px';
      }
    });
  }

  // Update title display based on sidebar width
  updateTitleDisplay(sidebar, width) {
    const labels = sidebar.querySelectorAll('.tree-node-label');
    
    labels.forEach(label => {
      if (width >= 300) {
        // Wide enough to show full titles
        label.style.maxWidth = 'calc(100% - 40px)';
        label.style.textOverflow = 'unset';
        label.style.whiteSpace = 'normal';
        label.style.lineHeight = '1.3';
        label.classList.add('full-title');
      } else {
        // Too narrow, use ellipsis
        label.style.maxWidth = 'calc(100% - 60px)';
        label.style.textOverflow = 'ellipsis';
        label.style.whiteSpace = 'nowrap';
        label.style.lineHeight = 'normal';
        label.classList.remove('full-title');
      }
    });
  }
}

// Export for use in other modules
window.DraftManager = DraftManager;
