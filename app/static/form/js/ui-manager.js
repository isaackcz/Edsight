/**
 * UI Manager - Handles UI interactions and state management
 * Clean, focused module for UI operations
 */

class UIManager {
  constructor() {
    this.sidebar = null;
    this.sidebarToggle = null;
    this.sidebarOverlay = null;
    this.sidebarClose = null;
    this.init();
  }

  init() {
    this.initializeElements();
    this.attachEventListeners();
    this.initModernUI();
  }

  initializeElements() {
    this.sidebar = document.querySelector(".sidebar");
    this.sidebarToggle = document.getElementById("sidebar-toggle");
    this.sidebarOverlay = document.getElementById("sidebar-overlay");
    this.sidebarClose = document.getElementById("sidebar-close");
  }

  attachEventListeners() {
    this.setupSidebarHandling();
    this.setupKeyboardHandling();
    this.setupResizeHandling();
    this.setupPageStateHandling();
  }

  setupSidebarHandling() {
    if (this.sidebar) {
      this.sidebar.setAttribute("role", "dialog");
      this.sidebar.setAttribute("aria-modal", "true");
      this.sidebar.setAttribute("aria-label", "Main menu");
      this.sidebar.setAttribute("tabindex", "-1");
    }

    if (this.sidebarToggle) {
      this.sidebarToggle.setAttribute("aria-controls", "sidebar");
      this.sidebarToggle.setAttribute("aria-expanded", "false");
      this.sidebarToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openSidebar();
      });
    }

    if (this.sidebarOverlay) {
      this.sidebarOverlay.addEventListener("click", this.closeSidebar.bind(this));
    }

    if (this.sidebarClose) {
      this.sidebarClose.addEventListener("click", this.closeSidebar.bind(this));
    }

    if (this.sidebar) {
      document.querySelectorAll(".sidebar .menu-item").forEach((item) => {
        item.addEventListener("click", () => {
          if (window.innerWidth <= 900) this.closeSidebar();
        });
      });
    }
  }

  setupKeyboardHandling() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("sidebar-open")) {
        this.closeSidebar();
      }
      
      if (document.body.classList.contains("sidebar-open") && this.sidebar) {
        this.handleSidebarTabNavigation(e);
      }
    });
  }

  setupResizeHandling() {
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) this.closeSidebar();
    });
  }

  setupPageStateHandling() {
    window.addEventListener("pagehide", () => {
      localStorage.removeItem("draftsPageState");
    });
  }

  handleSidebarTabNavigation(e) {
    const focusable = this.sidebar.querySelectorAll(
      'a, button, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    
    if (e.key === "Tab") {
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  openSidebar() {
    document.body.classList.add("sidebar-open");
    if (this.sidebarToggle) this.sidebarToggle.setAttribute("aria-expanded", "true");
    if (this.sidebar) this.sidebar.focus();
    if (this.sidebarOverlay) this.sidebarOverlay.style.display = "block";
  }

  closeSidebar() {
    document.body.classList.remove("sidebar-open");
    if (this.sidebarToggle) this.sidebarToggle.setAttribute("aria-expanded", "false");
    if (this.sidebarOverlay) this.sidebarOverlay.style.display = "none";
    if (this.sidebarToggle) this.sidebarToggle.focus();
  }

  // Initialize modern UI enhancements
  initModernUI() {
    // Add smooth scrolling for better UX
    document.documentElement.style.scrollBehavior = "smooth";

    // Button interactions without loading states
    const buttons = document.querySelectorAll(".btn");
    buttons.forEach((button) => {
      button.addEventListener("click", function () {
        if (
          this.classList.contains("primary") ||
          this.classList.contains("modern-btn")
        ) {
          this.style.transform = "scale(0.98)";
          setTimeout(() => {
            this.style.transform = "";
          }, 150);
        }
      });
    });

    // Initialize button validation
    this.initializeButtonValidation();

    // Add focus indicators for better accessibility
    const focusableElements = document.querySelectorAll(
      "input, select, button, textarea"
    );
    focusableElements.forEach((element) => {
      // Do not apply the JS focus outline to question inputs/textareas
      if (element.classList && element.classList.contains("question-text")) {
        return;
      }
      
      element.addEventListener("focus", function () {
        this.style.outline = "2px solid var(--primary)";
        this.style.outlineOffset = "2px";
      });

      element.addEventListener("blur", function () {
        this.style.outline = "";
        this.style.outlineOffset = "";
      });
    });

    // Add hover effects to cards
    const cards = document.querySelectorAll(".modern-card, .modern-section");
    cards.forEach((card) => {
      card.addEventListener("mouseenter", function () {
        this.style.transform = "translateY(-2px)";
      });

      card.addEventListener("mouseleave", function () {
        this.style.transform = "translateY(0)";
      });
    });

    // Add progress indicator animations
    const progressIndicator = document.querySelector(".progress-indicator");
    if (progressIndicator) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
          }
        });
      });
      observer.observe(progressIndicator);
    }
  }

  // Update topic context info display
  updateTopicContextInfo() {
    const categoryInput = document.getElementById("category");
    const categoryDisplay = document.getElementById("category-display");
    
    if (categoryDisplay) {
      categoryDisplay.textContent = categoryInput ? categoryInput.value || "Not selected" : "Not selected";
      categoryDisplay.style.color = categoryInput && categoryInput.value ? "var(--primary)" : "var(--accent)";
    }
    
    
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

  // Navigate between form sections
  goToQuestions() {
    const categoryInput = document.getElementById("category");
    const topicInput = document.getElementById("topic");
    const topicSkipCheckbox = document.getElementById("topic-can-skip");
    let valid = true;

    if (!categoryInput) return;

    // Check category
    if (!categoryInput.value.trim()) {
      categoryInput.style.border = "2px solid red";
      valid = false;
    } else {
      categoryInput.style.border = "";
    }

    // Check topic (only if skip checkbox is not checked)
    if (topicInput && !topicSkipCheckbox?.checked) {
      if (!topicInput.value.trim()) {
        topicInput.style.border = "2px solid red";
        valid = false;
      } else {
        topicInput.style.border = "";
      }
    } else if (topicInput) {
      topicInput.style.border = "";
    }
    
    if (!valid) return;

    // Update current topic
    if (window.questionManager) {
      const currentTopic = window.questionManager.getCurrentTopic();
      currentTopic.category = categoryInput.value;
      currentTopic.name = topicInput.value;
      window.questionManager.setCurrentTopic(currentTopic);
    }

    // Update UI elements
    const currentTopicName = document.getElementById("current-topic-name");
    if (currentTopicName) {
      currentTopicName.textContent = topicInput.value;
    }

    const topicMeta = document.querySelector(".topic-meta");
    if (topicMeta) {
      topicMeta.textContent = `(${categoryInput.value})`;
    }

    // Show questions section
    this.showSection("questions");
    this.updateTopicContextInfo();

    // Add initial question if none exist
    if (window.questionManager && window.questionManager.getCurrentTopic().questions.length === 0) {
      window.questionManager.addNewQuestion();
    }
  }

  goBackToTopic() {
    this.showSection("topic");
    this.updateTopicContextInfo();
  }

  showConfirmation() {
    this.showSection("confirmation");
  }

  showSection(sectionName) {
    const sections = ["topic-section", "questions-section", "confirmation-section"];
    sections.forEach(section => {
      const element = document.getElementById(section);
      if (element) {
        element.style.display = section === `${sectionName}-section` ? "block" : "none";
      }
    });

    // Show/hide drafts section
    const draftsSection = document.querySelector(".drafts-section");
    if (draftsSection) {
      draftsSection.style.display = sectionName === "topic" ? "block" : "none";
    }

    // Show/hide progress container
    const progressContainer = document.querySelector(".progress-container");
    if (progressContainer) {
      progressContainer.style.display = sectionName === "topic" ? "block" : "none";
    }
  }

  // Validate required fields
  validateRequiredFields() {
    let valid = true;
    
    // Category, topic
    const categoryInput = document.getElementById("category");
    const topicInput = document.getElementById("topic");
    
    [categoryInput, topicInput].forEach((input) => {
      if (input && !input.value) {
        input.style.border = "2px solid red";
        valid = false;
      } else if (input) {
        input.style.border = "";
      }
    });

    // Question validation
    if (window.questionManager) {
      const questions = window.questionManager.getCurrentTopic().questions;
      const cards = this.getQuestionsContainer().querySelectorAll(".question-card");
      
      cards.forEach((card) => {
        const textArea = card.querySelector(".question-text");
        const inlineError = card.querySelector(".inline-error");
        if (textArea) {
          if (!textArea.value.trim()) {
            if (inlineError) {
              inlineError.textContent = "Question text is required.";
              inlineError.style.display = "";
            }
            valid = false;
          } else {
            if (inlineError) {
              inlineError.textContent = "";
              inlineError.style.display = "none";
            }
          }
        }
      });
    }

    // Update finish button state
    const finishBtn = document.getElementById("finish-topic");
    if (finishBtn) finishBtn.disabled = !valid;
    
    return valid;
  }

  getQuestionsContainer() {
    return document.getElementById("questions-container");
  }

  // Attach real-time validation to form inputs
  attachRealtimeValidation() {
    const categoryInput = document.getElementById("category");
    const topicInput = document.getElementById("topic");
    const topicSkipCheckbox = document.getElementById("topic-can-skip");
    
    if (categoryInput) {
      categoryInput.addEventListener("input", () => {
        this.updateTopicContextInfo();
        this.validateRequiredFields();
        this.updateNextButtonState();
      });
    }
    
    if (topicInput) {
      topicInput.addEventListener("input", () => {
        this.updateTopicContextInfo();
        this.validateRequiredFields();
        this.updateNextButtonState();
      });
    }

    if (topicSkipCheckbox) {
      topicSkipCheckbox.addEventListener("change", () => {
        this.updateNextButtonState();
      });
    }
  }

  // Initialize button validation - disable NEXT button by default
  initializeButtonValidation() {
    const nextButton = document.getElementById("next-to-questions");
    if (nextButton) {
      // Disable button by default
      nextButton.disabled = true;
      nextButton.style.opacity = "0.5";
      nextButton.style.cursor = "not-allowed";
    }
    
    // Set up initial validation
    this.updateNextButtonState();
  }

  // Update the state of the NEXT button based on form validation
  updateNextButtonState() {
    const nextButton = document.getElementById("next-to-questions");
    if (!nextButton) return;

    const categoryInput = document.getElementById("category");
    const topicInput = document.getElementById("topic");
    const topicSkipCheckbox = document.getElementById("topic-can-skip");

    // Check if category is filled
    const categoryFilled = categoryInput && categoryInput.value.trim() !== "";
    
    // Check if topic is filled OR topic skip is checked
    const topicFilled = topicInput && topicInput.value.trim() !== "";
    const topicSkipped = topicSkipCheckbox && topicSkipCheckbox.checked;
    
    // Enable button only if category is filled AND (topic is filled OR topic is skipped)
    const shouldEnable = categoryFilled && (topicFilled || topicSkipped);

    if (shouldEnable) {
      nextButton.disabled = false;
      nextButton.style.opacity = "1";
      nextButton.style.cursor = "pointer";
    } else {
      nextButton.disabled = true;
      nextButton.style.opacity = "0.5";
      nextButton.style.cursor = "not-allowed";
    }
  }
}

// Export for use in other modules
window.UIManager = UIManager;
