/**
 * Question Manager - Handles all question CRUD operations
 * Clean, focused module for question management
 */

class QuestionManager {
  constructor() {
    this.currentTopic = {
      category: "",
      name: "",
      questions: [],
    };
    this.questionsContainer = null;
    this.init();
  }

  init() {
    // Look for questions container in the main content area
    this.questionsContainer = document.getElementById("questions-display") || 
                             document.getElementById("questions-container");
    if (!this.questionsContainer) {
      console.log("Questions container not found - this is expected if not in question editing mode");
      return;
    }
  }

  // Add a new question to the current topic
  addNewQuestion() {
    this.syncQuestionsFromDOM();
    
    const usedOrders = this.currentTopic.questions.map(
      (q) => q.displayOrder || q.display_order
    );
    let nextOrder = 1;
    while (usedOrders.includes(nextOrder)) nextOrder++;
    
    const newQuestion = {
      question_text: "",
      answer_type: "number", // default to 'number'
      is_required: true,
      display_order: nextOrder,
      choices: [],
      answer_description: "",
    };
    
    this.currentTopic.questions.push(newQuestion);
    this.renderQuestions(this.currentTopic.questions, this.questionsContainer);
    
    // Focus on the new question
    setTimeout(() => {
      const allCards = this.questionsContainer.querySelectorAll(".question-card");
      const newQuestionCard = allCards[allCards.length - 1];
      if (newQuestionCard) {
        newQuestionCard.scrollIntoView({ behavior: "smooth", block: "center" });
        const textarea = newQuestionCard.querySelector(".question-text");
        if (textarea) textarea.focus();
      }
    }, 100);
  }

  // Render questions in the container
  renderQuestions(questions, container) {
    if (!Array.isArray(questions)) questions = [];
    container.innerHTML = "";
    
    const section = document.createElement("div");
    section.className = "form-section";
    const questionsContainer = document.createElement("div");
    questionsContainer.className = "questions-container";
    section.appendChild(questionsContainer);
    container.appendChild(section);
    
    questions.forEach((q, idx) => {
      if (typeof q.answer_description === "undefined")
        q.answer_description = "";
      if (q.question_id !== undefined && q.question_id !== null)
        q.question_id = String(q.question_id);
        
      const card = this.createQuestionCard(q, idx);
      questionsContainer.appendChild(card);
      this.attachQuestionEventHandlers(card, q, idx);
    });
    
    // Animate new questions
    if (window.fadeAnimations && window.fadeAnimations.isAnimationSupported()) {
      setTimeout(() => {
        const questionCards = questionsContainer.querySelectorAll('.question-card');
        if (questionCards.length > 0) {
          window.fadeAnimations.animateQuestionCards(questionCards, {
            staggerDelay: 60,
            duration: 300
          });
        }
      }, 50);
    }
  }

  // Create a question card element
  createQuestionCard(q, idx) {
    const card = document.createElement("div");
    card.className = "question-card";
    card.setAttribute("draggable", "true");
    card.setAttribute("data-qidx", idx);
    
    card.innerHTML = `
      <div class="question-header" style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
        <span class="question-circle" style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:#cbd5e0;color:#25303a;font-weight:700;font-size:20px;flex:0 0 auto;">${idx + 1}</span>
        <div style="display:flex;flex-direction:column;">
          <span class="question-title" style="font-weight:700;font-size:20px;color:#111;">Question ${idx + 1}</span>
        </div>
        
      </div>
      
      <div class="question-details">
        <!-- Left Column: Question Text -->
        <div class="question-content-column">
          <div class="question-text-container">
            <textarea class="question-text" data-id="${q.question_id !== undefined ? q.question_id : ""}" placeholder="Enter your question text here..." style="width:100%;min-height:70px;padding:16px;border-radius:12px;border:1px solid rgba(0,0,0,0.08);font-size:16px;color:var(--black);box-shadow:none;resize:vertical;font-family:inherit;">${(q.question_text || q.text || "").replace(/"/g, "&quot;")}</textarea>
            <div class="inline-error" style="display:none;"></div>
          </div>
        </div>
        
        <!-- Right Column: Question Settings -->
        <div class="question-settings-column">
          <div class="settings-inline-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div class="form-group" style="flex:1;min-width:120px;">
              <select class="answer-type" data-id="${q.question_id !== undefined ? q.question_id : ""}" style="width:100%;padding:8px 10px;border-radius:4px;border:1px solid rgba(0,0,0,0.08);font-size:13px;background:#fff;">
                <option value="text" ${q.answer_type === "text" || !q.answer_type ? "selected" : ""}>Text</option>
                <option value="number" ${q.answer_type === "number" ? "selected" : ""}>Number</option>
                <option value="date" ${q.answer_type === "date" ? "selected" : ""}>Date</option>
                <option value="percentage" ${q.answer_type === "percentage" ? "selected" : ""}>Percentage</option>
              </select>
            </div>
            
            <div class="form-group" style="flex:0 0 auto;">
              <div style="display:flex;align-items:center;gap:6px;">
                <div class="toggle-switch">
                  <input type="checkbox" class="is-required" ${q.is_required || q.required ? "checked" : ""} data-id="${q.question_id !== undefined ? q.question_id : idx}" id="required-${q.question_id !== undefined ? q.question_id : idx}" />
                  <label for="required-${q.question_id !== undefined ? q.question_id : idx}"></label>
                </div>
                <span class="toggle-label" style="font-weight:600;color:var(--black);font-size:13px;">Required</span>
              </div>
            </div>
            
            <div class="form-group" style="flex:0 0 auto;">
              <button class="btn danger delete-question" data-id="${q.question_id !== undefined ? q.question_id : idx}" style="background:var(--danger);color: #fff;border:none;padding:8px 12px;border-radius:4px;font-weight:600;font-size:13px;white-space:nowrap;">
                <i class="ph ph-bold ph-trash" style="margin-right:6px;color:inherit;"></i>Delete
              </button>
            </div>
          </div>
        </div>
      </div>
      
      
    `;
    
    return card;
  }

  // Attach event handlers to question card
  attachQuestionEventHandlers(card, q, idx) {
    // Question text input
    card.querySelector(".question-text").addEventListener("input", (e) => {
      if (this.currentTopic.questions[idx]) {
        this.currentTopic.questions[idx].question_text = e.target.value;
        this.persistCurrentTopic();
      }
    });

    // Answer type select
    const answerTypeSelect = card.querySelector(".answer-type");
    if (answerTypeSelect) {
      answerTypeSelect.addEventListener("change", (e) => {
        if (this.currentTopic.questions[idx]) {
          this.currentTopic.questions[idx].answer_type = e.target.value;
          this.persistCurrentTopic();
        }
      });
    }

    // Required toggle
    card.querySelector(".is-required").addEventListener("change", (e) => {
      if (this.currentTopic.questions[idx]) {
        this.currentTopic.questions[idx].is_required = e.target.checked;
        this.persistCurrentTopic();
      }
    });

    

    // Delete question
    card.querySelector(".delete-question").addEventListener("click", (e) => {
      this.deleteQuestion(q, idx);
    });
  }

  

  // Delete a question
  deleteQuestion(question, idx) {
    if (!confirm("Are you sure you want to delete this question?")) {
      return;
    }
    
    const questionId = question.question_id;
    const questionCard = document.querySelector(`[data-question-id="${questionId}"]`)?.closest('.question-card');
    
    // No skeleton loader - removed to prevent flicker
    
    if (questionId !== undefined && questionId !== null && !isNaN(Number(questionId))) {
      // Delete from server
      const xhr = new XMLHttpRequest();
      xhr.open("DELETE", `/api/questions/${questionId}/`, true);
      xhr.setRequestHeader("X-CSRFToken", this.getCookie("csrftoken"));
      xhr.onload = () => {
        if (xhr.status === 204 || xhr.status === 200) {
          this.currentTopic.questions.splice(idx, 1);
          
          // Animate question removal
          if (window.fadeAnimations && window.fadeAnimations.isAnimationSupported() && questionCard) {
            window.fadeAnimations.animateElement(questionCard, 'fade', {
              direction: 'exit',
              duration: 200
            }).then(() => {
              this.renderQuestions(this.currentTopic.questions, this.questionsContainer);
            });
          } else {
            this.renderQuestions(this.currentTopic.questions, this.questionsContainer);
          }
          
          this.showSnackbar("Question deleted successfully", { background: "#4caf50" });
          
          // Notify draft-manager if it's active
          if (window.draftManager && window.draftManager.currentDraftQuestionsContainer) {
            window.draftManager.refreshDraftQuestions();
          }
        } else {
          this.showSnackbar("Failed to delete question", { background: "#f44336" });
        }
      };
      xhr.onerror = () => {
        this.showSnackbar("Error deleting question", { background: "#f44336" });
      };
      xhr.send();
    } else {
      // Local deletion
      this.currentTopic.questions.splice(idx, 1);
      this.renderQuestions(this.currentTopic.questions, this.questionsContainer);
      
      // Notify draft-manager if it's active
      if (window.draftManager && window.draftManager.currentDraftQuestionsContainer) {
        window.draftManager.refreshDraftQuestions();
      }
    }
    this.persistCurrentTopic();
  }

  // Sync questions from DOM to data
  syncQuestionsFromDOM() {
    const cards = this.questionsContainer.querySelectorAll(".question-card");
    cards.forEach((card) => {
      const qidx = parseInt(card.getAttribute("data-qidx"), 10);
      if (isNaN(qidx) || !this.currentTopic.questions[qidx]) return;
      
      const textArea = card.querySelector(".question-text");
      if (textArea) this.currentTopic.questions[qidx].question_text = textArea.value;
      
      const answerTypeSelect = card.querySelector(".answer-type");
      if (answerTypeSelect) {
        this.currentTopic.questions[qidx].answer_type = answerTypeSelect.value;
      }
      
      const isRequired = card.querySelector(".is-required");
      if (isRequired) {
        this.currentTopic.questions[qidx].is_required = isRequired.checked;
      }
    });
  }

  // Persist current topic to localStorage
  persistCurrentTopic() {
    try {
      localStorage.setItem("unsavedTopicQuestions", JSON.stringify(this.currentTopic));
    } catch (e) {
      // Ignore quota errors
    }
  }

  // Get current topic
  getCurrentTopic() {
    return this.currentTopic;
  }

  // Set current topic
  setCurrentTopic(topic) {
    this.currentTopic = topic;
  }

  // Clear current topic
  clearCurrentTopic() {
    this.currentTopic = {
      category: "",
      name: "",
      questions: [],
    };
    localStorage.removeItem("unsavedTopicQuestions");
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
}

// Export for use in other modules
window.QuestionManager = QuestionManager;
