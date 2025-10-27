/**
 * Form Coordinator - Clean, minimal coordination of form modules
 * This replaces the bloated form.js with a clean, focused implementation
 */

// Import backend functions
import {
  fetchCategories,
  fetchDraftedQuestionnaires,
  fetchTopics,
  renameTopic,
  deleteTopic,
  saveTopic,
  fetchQuestions,
  createQuestion,
  deleteQuestion,
  updateQuestion,
  deleteQuestion as deleteQuestionAPI,
} from "./form_backend.js";

class FormCoordinator {
  constructor() {
    this.questionManager = null;
    this.draftManager = null;
    this.uiManager = null;
    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initializeModules());
    } else {
      this.initializeModules();
    }
  }

  initializeModules() {
    // Initialize managers
    this.questionManager = new QuestionManager();
    this.draftManager = new DraftManager();
    this.uiManager = new UIManager();

    // Make managers globally available
    window.questionManager = this.questionManager;
    window.draftManager = this.draftManager;
    window.uiManager = this.uiManager;

    // Initialize form state
    this.initializeForm();
    this.attachEventListeners();
    this.loadInitialData();
  }

  initializeForm() {
    // Initialize form with text inputs instead of dropdowns
    this.restoreFormPageState();
    this.restoreDraftsPageState();
    this.restoreCurrentTopic();
    this.loadDraftedQuestionnaires();
  }

  attachEventListeners() {
    this.attachNavigationListeners();
    this.attachFormListeners();
    this.attachInputListeners();
  }

  attachNavigationListeners() {
    // Navigation buttons
    const nextToQuestionsBtn = document.getElementById("next-to-questions");
    const backToTopicBtn = document.getElementById("back-to-topic");
    const finishTopicBtn = document.getElementById("finish-topic");
    const addAnotherTopicBtn = document.getElementById("add-another-topic");
    const finishProcessBtn = document.getElementById("finish-process");

    if (nextToQuestionsBtn) {
      nextToQuestionsBtn.addEventListener("click", () => {
        this.uiManager.goToQuestions();
        this.saveFormPageState("questions");
      });
    }

    if (backToTopicBtn) {
      backToTopicBtn.addEventListener("click", () => {
        this.uiManager.goBackToTopic();
        this.saveFormPageState("topic");
      });
    }

    if (finishTopicBtn) {
      finishTopicBtn.addEventListener("click", () => {
        this.finishCurrentTopic();
        this.saveFormPageState("confirmation");
      });
    }

    if (addAnotherTopicBtn) {
      addAnotherTopicBtn.addEventListener("click", () => {
        this.startNewTopic();
        this.saveFormPageState("topic");
      });
    }

    if (finishProcessBtn) {
      finishProcessBtn.addEventListener("click", () => {
        this.finishProcess();
        this.saveFormPageState("topic");
      });
    }
  }

  attachFormListeners() {
    // Add question button
    const addQuestionBtn = document.getElementById("add-question");
    if (addQuestionBtn) {
      addQuestionBtn.addEventListener("click", () => {
        this.questionManager.addNewQuestion();
      });
    }

    // Attach real-time validation
    this.uiManager.attachRealtimeValidation();
  }

  attachInputListeners() {
    // Text input change handlers for context updates
    const categoryInput = document.getElementById("category");
    const topicInput = document.getElementById("topic");
    
    if (categoryInput) {
      categoryInput.addEventListener("input", () => {
        this.uiManager.updateTopicContextInfo();
      });
    }
    
    if (topicInput) {
      topicInput.addEventListener("input", () => {
        this.uiManager.updateTopicContextInfo();
      });
    }

    // Checkbox handlers for disabling inputs
    this.attachCheckboxListeners();
  }

  attachCheckboxListeners() {
    // Topic checkbox
    const topicCheckbox = document.getElementById('topic-can-skip');
    const topicInput = document.getElementById('topic');
    
    if (topicCheckbox && topicInput) {
      topicCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          topicInput.disabled = true;
          topicInput.value = ''; // Clear the value when disabled
        } else {
          topicInput.disabled = false;
        }
        // Trigger button validation update
        if (this.uiManager) {
          this.uiManager.updateNextButtonState();
        }
      });
    }
  }

  loadInitialData() {
    // Load categories and other initial data
    this.loadCategories();
  }

  async loadCategories() {
    try {
      const categories = await fetchCategories();
      // Categories are now handled as text inputs, no dropdown population needed
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  }

  async finishCurrentTopic() {
    // Sync questions from DOM
    this.questionManager.syncQuestionsFromDOM();
    
    // Validate required fields
    if (!this.uiManager.validateRequiredFields()) {
      return false;
    }

    // Get form values
    const categoryInput = document.getElementById("category");
    const topicInput = document.getElementById("topic");
    
    const categoryName = categoryInput.value.trim();
    const topicName = topicInput.value.trim();
    const topicCanSkip = document.getElementById('topic-can-skip')?.checked || false;
    
    if (!categoryName || !topicName) {
      return false;
    }

    const currentTopic = this.questionManager.getCurrentTopic();
    const preparedQuestions = this.prepareQuestionsForSave(currentTopic.questions);

    if (preparedQuestions.length === 0) {
      return false;
    }

    try {
      // Create or get category
      let categoryId = await this.createOrGetCategory(categoryName);
      
      const payload = {
        category_id: categoryId,
        name: topicName,
        display_order: 1,
        questions: preparedQuestions,
        can_skip: topicCanSkip,
      };

      // Save topic
      const data = await saveTopic(payload);
      
      if (data.success) {
        // Clear persisted data and reset form
        this.questionManager.clearCurrentTopic();
        this.initForm();
        
        // Show confirmation
        this.showConfirmation(topicName, categoryName, preparedQuestions.length);
        this.uiManager.showSnackbar("Topic and questions saved successfully!", { background: "#4caf50" });
        
        // Reload drafts
        this.draftManager.loadDraftedQuestionnaires();
        return true;
      } else {
        this.uiManager.showSnackbar("Failed to save topic: " + (data.error || "Unknown error"));
        return false;
      }
    } catch (error) {
      console.error('Error in finishCurrentTopic:', error);
      this.uiManager.showSnackbar('Error creating topic: ' + error.message);
      return false;
    }
  }

  prepareQuestionsForSave(questions) {
    return questions.map((q) => ({
      question_text: q.question_text || "",
      answer_type: q.answer_type || "text",
      is_required: q.is_required || false,
      display_order: q.display_order || 1,
      choices: (q.choices || []).filter((c) => c && c.trim()),
      answer_description: q.answer_description || "",
      sub_questions: [],
    }));
  }

  showConfirmation(topicName, categoryName, questionCount) {
    const confirmedTopicName = document.getElementById("confirmed-topic-name");
    if (confirmedTopicName) {
      confirmedTopicName.textContent = topicName;
    }

    const topicMeta = confirmedTopicName?.nextElementSibling;
    if (topicMeta) {
      topicMeta.textContent = `(${categoryName})`;
    }

    const questionsCount = document.getElementById("questions-count");
    if (questionsCount) {
      questionsCount.textContent = questionCount;
    }

    this.uiManager.showConfirmation();
  }

  startNewTopic() {
    const topicInput = document.getElementById("topic");
    if (topicInput) topicInput.value = "";
    
    this.questionManager.clearCurrentTopic();
    this.uiManager.showSection("topic");
    this.uiManager.updateTopicContextInfo();
    // Reset button validation state
    this.uiManager.updateNextButtonState();
  }

  finishProcess() {
    this.initForm();
    this.uiManager.showSection("topic");
  }

  initForm() {
    this.questionManager.clearCurrentTopic();
    
    const categoryInput = document.getElementById("category");
    if (categoryInput) categoryInput.value = "";
    
    const topicInput = document.getElementById("topic");
    if (topicInput) {
      topicInput.value = "";
      topicInput.disabled = false; // Re-enable input
    }
    
    // Clear skip checkboxes
    const topicCanSkip = document.getElementById('topic-can-skip');
    if (topicCanSkip) topicCanSkip.checked = false;
    
    this.uiManager.updateTopicContextInfo();
    // Reset button validation state
    this.uiManager.updateNextButtonState();
  }

  // API helper functions
  async createOrGetCategory(categoryName) {
    try {
      // First try to find existing category
      const response = await fetch('/api/categories/');
      const categories = await response.json();
      const existingCategory = categories.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase());
      
      if (existingCategory) {
        return existingCategory.category_id;
      }
      
      // Create new category if not found
      const createResponse = await fetch('/api/category/create/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': this.getCookie('csrftoken')
        },
        body: JSON.stringify({ name: categoryName })
      });
      
      const result = await createResponse.json();
      if (result.success) {
        return result.category_id;
      } else {
        throw new Error(result.error || 'Failed to create category');
      }
    } catch (error) {
      console.error('Error creating/getting category:', error);
      throw error;
    }
  }

  

  // State persistence
  saveFormPageState(step) {
    const categoryId = document.getElementById("category").value;
    const currentTopic = this.questionManager.getCurrentTopic();
    
    localStorage.setItem(
      "formPageState",
      JSON.stringify({ step, topic: currentTopic, categoryId })
    );
  }

  restoreFormPageState() {
    const state = localStorage.getItem("formPageState");
    if (!state) return;
    
    let parsed;
    try {
      parsed = JSON.parse(state);
    } catch (e) {
      return;
    }
    
    if (!parsed || !parsed.step) return;
    
    if (parsed.topic) {
      this.questionManager.setCurrentTopic(parsed.topic);
    }
    
    if (parsed.categoryId) {
      const categoryInput = document.getElementById("category");
      if (categoryInput) categoryInput.value = parsed.categoryId;
    }
    
    this.uiManager.updateTopicContextInfo();
    
    if (parsed.step === "questions") {
      this.uiManager.goToQuestions();
    } else if (parsed.step === "confirmation") {
      this.uiManager.goToQuestions();
      this.finishCurrentTopic(true);
    } else {
      this.uiManager.goBackToTopic();
    }
  }

  restoreDraftsPageState() {
    const state = localStorage.getItem("draftsPageState");
    if (!state) return;
    
    let parsed;
    try {
      parsed = JSON.parse(state);
    } catch (e) {
      return;
    }
    
    if (!parsed || !parsed.view) return;
    
    if (parsed.view === "topics") {
      this.draftManager.viewTopics(
        parsed.categoryId,
        parsed.categoryName
      );
    } else if (parsed.view === "editQuestions") {
      this.draftManager.viewDraftQuestions(
        parsed.topicId,
        parsed.categoryName,
        parsed.topicName
      );
    }
  }

  restoreCurrentTopic() {
    const data = localStorage.getItem("unsavedTopicQuestions");
    if (!data) return;
    
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === "object") {
        // Normalize questions
        if (Array.isArray(parsed.questions)) {
          parsed.questions = parsed.questions.map((q) => ({
            question_text: q.question_text || q.text || "",
            answer_type: q.answer_type || q.type || "text",
            is_required: typeof q.is_required !== "undefined" ? q.is_required : q.required || false,
            display_order: q.display_order || q.displayOrder || 1,
            choices: Array.isArray(q.choices) ? q.choices : [],
            answer_description: q.answer_description || "",
            question_id: q.question_id || undefined,
            topic_id: q.topic_id || undefined,
          }));
        }
        
        this.questionManager.setCurrentTopic(parsed);
        
        // Restore UI values
        const categoryInput = document.getElementById("category");
        const topicInput = document.getElementById("topic");
        
        if (categoryInput && parsed.category) {
          categoryInput.value = parsed.category;
        }
        
        if (topicInput && parsed.name) {
          topicInput.value = parsed.name;
        }
        
        this.uiManager.updateTopicContextInfo();
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  loadDraftedQuestionnaires() {
    this.draftManager.loadDraftedQuestionnaires();
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
}

// Initialize the form coordinator
const formCoordinator = new FormCoordinator();
