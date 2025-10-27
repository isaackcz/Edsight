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
      <div class="treeview-sidebar">
        <div class="sidebar-header">
          <h3>Draft Questionnaires</h3>
        </div>
        <div class="treeview-content">
          <div class="hierarchy-tree" id="draft-tree">
            ${this.buildTreeHTML(categoriesList)}
          </div>
        </div>
      </div>
      <div class="treeview-resizer" id="treeview-resizer"></div>
      <div class="main-content-area">
        <div class="content-header">
          <div class="content-title">
            <h2>Select a Topic</h2>
            <p>Choose a topic from the tree to view and edit its questions</p>
          </div>
        </div>
        <div class="questions-container" id="questions-display">
          <div class="empty-state">
            <i class="ph ph-bold ph-files"></i>
            <h3>No Topic Selected</h3>
            <p>Select a topic from the tree to view its questions</p>
          </div>
        </div>
      </div>
    `;

    this.attachTreeEventHandlers();
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
        <div class="tree-node">
          <div class="tree-node-item category-node" data-category="${categoryName}" data-category-id="${categoryId}">
            <div class="tree-expand-icon">
              <i class="ph ph-bold ph-caret-right"></i>
            </div>
            <div class="tree-node-icon">
              <i class="ph ph-bold ph-${categoryIcon}"></i>
            </div>
            <div class="tree-node-label">${categoryName}</div>
            <div class="tree-node-count">${topics.length}</div>
            <div class="tree-node-actions">
              <button class="tree-action-btn rename-btn" data-type="category" data-id="${categoryId}" title="Rename">
                <i class="ph ph-bold ph-pencil"></i>
              </button>
              <button class="tree-action-btn delete-btn" data-type="category" data-id="${categoryId}" title="Delete">
                <i class="ph ph-bold ph-trash"></i>
              </button>
            </div>
          </div>
          <div class="tree-children">
            ${topics.map(topic => {
              const topicName = topic.topic || topic.name || 'Unnamed Topic';
              return `
              <div class="tree-node">
                <div class="tree-node-item topic-node" data-topic-id="${topic.topic_id}" data-topic-name="${topicName}" data-category="${categoryName}">
                  <div class="tree-node-icon">
                    <i class="ph ph-bold ph-files"></i>
                  </div>
                  <div class="tree-node-label">${topicName}</div>
                  <div class="tree-node-actions">
                    <button class="tree-action-btn rename-btn" data-type="topic" data-id="${topic.topic_id}" title="Rename">
                      <i class="ph ph-bold ph-pencil"></i>
                    </button>
                    <button class="tree-action-btn delete-btn" data-type="topic" data-id="${topic.topic_id}" title="Delete">
                      <i class="ph ph-bold ph-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            `;
            }).join('')}
            <div class="tree-add-button" data-type="topic" data-category-id="${categoryId}">
              <i class="ph ph-bold ph-plus"></i>
              <small>Add Topic</small>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Add + button for creating new categories
    const addCategoryButton = `
      <div class="tree-add-button" data-type="category">
        <i class="ph ph-bold ph-plus"></i>
        <small>Add Category</small>
      </div>
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

  // Toggle category expansion
  toggleCategory(categoryNode) {
    const expandIcon = categoryNode.querySelector('.tree-expand-icon i');
    const treeNode = categoryNode.closest('.tree-node');
    
    if (treeNode) {
      const isExpanded = treeNode.classList.contains('expanded');
      treeNode.classList.toggle('expanded', !isExpanded);
      expandIcon.className = isExpanded ? 'ph ph-bold ph-caret-right' : 'ph ph-bold ph-caret-down';
    }
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
      <div class="questions-section">
        <div class="section-header">
          <div class="section-title">
            <h3>Questions for "${topicName}"</h3>
            <p class="section-description">Category: ${categoryName}</p>
          </div>
          <div class="section-actions">
            <button type="button" id="add-question-in-edit" class="btn secondary modern-btn">
              <i class="ph ph-bold ph-plus"></i>
              <span>Add Question</span>
            </button>
          </div>
        </div>
        
        <!-- Search and Filter Controls -->
        <div class="questions-controls">
          <div class="search-filter-row">
            <div class="search-box">
              <i class="ph ph-bold ph-magnifying-glass"></i>
              <input type="text" id="question-search" placeholder="Search questions..." value="${this.searchTerm}">
            </div>
            <div class="filter-controls">
              <select id="type-filter" class="filter-select">
                <option value="all" ${this.filterType === 'all' ? 'selected' : ''}>All Types</option>
                <option value="text" ${this.filterType === 'text' ? 'selected' : ''}>Text</option>
                <option value="number" ${this.filterType === 'number' ? 'selected' : ''}>Number</option>
                <option value="date" ${this.filterType === 'date' ? 'selected' : ''}>Date</option>
                <option value="percentage" ${this.filterType === 'percentage' ? 'selected' : ''}>Percentage</option>
              </select>
              <select id="required-filter" class="filter-select">
                <option value="all" ${this.filterRequired === 'all' ? 'selected' : ''}>All Questions</option>
                <option value="required" ${this.filterRequired === 'required' ? 'selected' : ''}>Required Only</option>
                <option value="optional" ${this.filterRequired === 'optional' ? 'selected' : ''}>Optional Only</option>
              </select>
              <select id="page-size" class="filter-select">
                <option value="10" ${this.questionsPerPage === 10 ? 'selected' : ''}>10 per page</option>
                <option value="25" ${this.questionsPerPage === 25 ? 'selected' : ''}>25 per page</option>
                <option value="50" ${this.questionsPerPage === 50 ? 'selected' : ''}>50 per page</option>
                <option value="100" ${this.questionsPerPage === 100 ? 'selected' : ''}>100 per page</option>
              </select>
            </div>
          </div>
        </div>

        <div class="form-actions modern-actions">
          <button type="button" id="update-all-questions" class="btn primary modern-btn">
            <i class="ph ph-bold ph-floppy-disk"></i>
            <span>Save Changes</span>
          </button>
        </div>
        
        <div class="questions-list" id="questions-list">
          ${this.renderPaginatedQuestions()}
        </div>
        
        <!-- Pagination Controls -->
        <div class="pagination-controls" id="pagination-controls">
          ${this.renderPaginationControls()}
        </div>
      </div>
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
        <div class="empty-questions">
          <i class="ph ph-bold ph-question-mark"></i>
          <h4>No Questions Found</h4>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      `;
    }

    const startIndex = (this.currentPage - 1) * this.questionsPerPage;
    return paginatedQuestions.map((question, index) => `
      <div class="question-card" data-question-id="${question.question_id || ''}">
        <div class="question-header">
          <div class="question-number">${startIndex + index + 1}</div>
          <div class="question-type">
            <span class="type-badge">${question.answer_type || 'text'}</span>
            ${question.is_required ? '<span class="required-badge">Required</span>' : ''}
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

  // Render pagination controls
  renderPaginationControls() {
    const totalPages = Math.ceil(this.filteredQuestions.length / this.questionsPerPage);
    const startItem = (this.currentPage - 1) * this.questionsPerPage + 1;
    const endItem = Math.min(this.currentPage * this.questionsPerPage, this.filteredQuestions.length);
    
    if (totalPages <= 1) return '';

    let paginationHTML = `
      <div class="pagination-info">
        Showing ${startItem}-${endItem} of ${this.filteredQuestions.length} questions
      </div>
      <div class="pagination-buttons">
    `;

    // Previous button
    if (this.currentPage > 1) {
      paginationHTML += `<button class="pagination-btn prev-btn" data-page="${this.currentPage - 1}">
        <i class="ph ph-bold ph-caret-left"></i> Previous
      </button>`;
    }

    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      paginationHTML += `<button class="pagination-btn page-btn" data-page="1">1</button>`;
      if (startPage > 2) {
        paginationHTML += `<span class="pagination-ellipsis">...</span>`;
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      paginationHTML += `<button class="pagination-btn page-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        paginationHTML += `<span class="pagination-ellipsis">...</span>`;
      }
      paginationHTML += `<button class="pagination-btn page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    // Next button
    if (this.currentPage < totalPages) {
      paginationHTML += `<button class="pagination-btn next-btn" data-page="${this.currentPage + 1}">
        Next <i class="ph ph-bold ph-caret-right"></i>
      </button>`;
    }

    paginationHTML += `</div>`;
    return paginationHTML;
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
    if (confirm('Are you sure you want to delete this question?')) {
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
    // Remove existing modal if any
    const existingModal = document.getElementById('create-question-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal HTML
    const modalHTML = `
      <div id="create-question-modal" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Create New Question</h3>
            <button class="modal-close" id="close-create-modal">&times;</button>
          </div>
          <div class="modal-body">
            <form id="create-question-form">
              <div class="form-group">
                <label for="create-question-text">Question Text *</label>
                <textarea id="create-question-text" name="question_text" required rows="3" placeholder="Enter your question..."></textarea>
              </div>
              
              <div class="form-group">
                <label for="create-answer-type">Answer Type *</label>
                <select id="create-answer-type" name="answer_type" required>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="create-is-required" name="is_required">
                  <span class="checkmark"></span>
                  Required Question
                </label>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn secondary" id="cancel-create-question">Cancel</button>
            <button type="button" class="btn primary" id="save-create-question">Create Question</button>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Attach event listeners
    this.attachCreateModalEventHandlers(topicId, categoryName, topicName);
  }

  // Show edit question modal
  showEditQuestionModal(question) {
    // Remove existing modal if any
    const existingModal = document.getElementById('edit-question-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal HTML
    const modalHTML = `
      <div id="edit-question-modal" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Edit Question</h3>
            <button class="modal-close" id="close-edit-modal">&times;</button>
          </div>
          <div class="modal-body">
            <form id="edit-question-form">
              <div class="form-group">
                <label for="edit-question-text">Question Text *</label>
                <textarea id="edit-question-text" name="question_text" required rows="3" placeholder="Enter your question...">${question.question_text || ''}</textarea>
              </div>
              
              <div class="form-group">
                <label for="edit-answer-type">Answer Type *</label>
                <select id="edit-answer-type" name="answer_type" required>
                  <option value="text" ${question.answer_type === 'text' ? 'selected' : ''}>Text</option>
                  <option value="number" ${question.answer_type === 'number' ? 'selected' : ''}>Number</option>
                  <option value="date" ${question.answer_type === 'date' ? 'selected' : ''}>Date</option>
                  <option value="percentage" ${question.answer_type === 'percentage' ? 'selected' : ''}>Percentage</option>
                </select>
              </div>



              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="edit-is-required" name="is_required" ${question.is_required ? 'checked' : ''}>
                  <span class="checkmark"></span>
                  Required Question
                </label>
              </div>

            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn secondary" id="cancel-edit-question">Cancel</button>
            <button type="button" class="btn primary" id="save-edit-question">Save Changes</button>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Attach event listeners
    this.attachEditModalEventHandlers(question.question_id);
  }

  // Attach create modal event handlers
  attachCreateModalEventHandlers(topicId, categoryName, topicName) {
    const modal = document.getElementById('create-question-modal');
    const closeBtn = document.getElementById('close-create-modal');
    const cancelBtn = document.getElementById('cancel-create-question');
    const saveBtn = document.getElementById('save-create-question');
    const answerTypeSelect = document.getElementById('create-answer-type');

    // Close modal handlers
    const closeModal = () => modal.remove();
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Handle answer type change
    answerTypeSelect.addEventListener('change', (e) => {
      // Clear any errors when user changes selection
      this.clearFieldError('create-answer-type');
    });

    // Add real-time validation
    const questionText = document.getElementById('create-question-text');
    
    if (questionText) {
      questionText.addEventListener('input', () => {
        this.clearFieldError('create-question-text');
      });
    }

    // Save question
    saveBtn.addEventListener('click', async () => {
      await this.saveNewQuestion(topicId, categoryName, topicName);
    });
  }

  // Attach edit modal event handlers
  attachEditModalEventHandlers(questionId) {
    const modal = document.getElementById('edit-question-modal');
    const closeBtn = document.getElementById('close-edit-modal');
    const cancelBtn = document.getElementById('cancel-edit-question');
    const saveBtn = document.getElementById('save-edit-question');
    const answerTypeSelect = document.getElementById('edit-answer-type');

    // Close modal handlers
    const closeModal = () => modal.remove();
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Handle answer type change
    answerTypeSelect.addEventListener('change', (e) => {
      // Clear any errors when user changes selection
      this.clearFieldError('edit-answer-type');
    });

    // Add real-time validation
    const questionText = document.getElementById('edit-question-text');
    
    if (questionText) {
      questionText.addEventListener('input', () => {
        this.clearFieldError('edit-question-text');
      });
    }

    // Save question
    saveBtn.addEventListener('click', async () => {
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

      // Create question
      await this.createQuestion(payload);
      
      // Close modal
      document.getElementById('create-question-modal').remove();
      
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

      // Update question
      await this.updateQuestion(questionId, payload);
      
      // Close modal
      document.getElementById('edit-question-modal').remove();
      
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

  // Clear validation errors
  clearValidationErrors() {
    document.querySelectorAll('.form-group').forEach(group => {
      group.classList.remove('error');
      const input = group.querySelector('input, textarea, select');
      if (input) {
        input.classList.remove('error');
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
    field.classList.add('error');

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
    field.classList.remove('error');
    
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
      background: var(--white);
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
          border-radius: 6px;
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
          border-radius: 6px;
          background: var(--danger, #dc2626);
          color: var(--white);
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
    document.querySelectorAll('.tree-hover-tooltip').forEach(tooltip => tooltip.remove());

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
      tooltip.className = 'tree-hover-tooltip';
      tooltip.textContent = text;
      document.body.appendChild(tooltip);

      // Position tooltip
      const rect = element.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      const left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
      const top = rect.top - tooltipRect.height - 8;
      
      tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - tooltipRect.width - 8, left))}px`;
      tooltip.style.top = `${Math.max(8, top)}px`;

      // Show with animation
      setTimeout(() => {
        if (tooltip) {
          tooltip.classList.add('show');
        }
      }, 10);
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
      clearTimeout(hideTimeout);
      showTimeout = setTimeout(showTooltip, 300);
    });

    element.addEventListener('mouseleave', () => {
      clearTimeout(showTimeout);
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
