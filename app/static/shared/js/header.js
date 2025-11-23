// Header functionality
document.addEventListener("DOMContentLoaded", function () {
  // Profile dropdown toggle
  const profileBtn = document.querySelector(".profile .avatar-btn");
  const profileDropdown = document.querySelector(".profile-dropdown");

  if (profileBtn && profileDropdown) {
    // helper to hide profile dropdown
    function hideProfileDropdown() {
      profileDropdown.classList.remove("show");
      profileDropdown.setAttribute("aria-hidden", "true");
      profileBtn.setAttribute("aria-expanded", "false");
    }

    profileBtn.addEventListener("click", function (e) {
      e.stopPropagation();

      // close notifications panel if open
      const notifPanel = document.querySelector(".notifications-panel");
      if (notifPanel && notifPanel.classList.contains("show")) {
        notifPanel.classList.remove("show");
        notifPanel.setAttribute("aria-hidden", "true");
      }

      // If already open, close it
      if (profileDropdown.classList.contains("show")) {
        hideProfileDropdown();
        return;
      }

      // Keep the dropdown inside the .profile element and rely on CSS
      // (.profile-dropdown { right: 0; top: calc(100% + 8px); }) so it
      // appears directly under the avatar like the notifications menu.
      profileDropdown.classList.add("show");
      profileDropdown.setAttribute("aria-hidden", "false");
      this.setAttribute("aria-expanded", "true");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", function (e) {
      if (
        !profileDropdown.contains(e.target) &&
        !profileBtn.contains(e.target)
      ) {
        hideProfileDropdown();
      }
    });

    // Close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        hideProfileDropdown();
      }
    });
  }

  // Notifications panel toggle: mirror profile dropdown behavior so
  // the panel appears directly under the notification icon and
  // behaves consistently with the profile menu.
  const notifBtn = document.querySelector(".notification");
  const notifPanel = document.querySelector(
    ".notification .notifications-panel"
  );

  if (notifBtn && notifPanel) {
    function hideNotifPanel() {
      notifPanel.classList.remove("show");
      notifPanel.setAttribute("aria-hidden", "true");
    }

    notifBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      const isMobile = window.matchMedia("(max-width: 1000px)").matches;

      if (isMobile) {
        // On mobile, open a separate notifications page instead of a panel
        window.location.href = "/notification.htm";
        return;
      }

      // close profile dropdown if open
      const profileDropdown = document.querySelector(
        ".profile .profile-dropdown"
      );
      const profileBtn = document.querySelector(".profile .avatar-btn");

      if (profileDropdown && profileDropdown.classList.contains("show")) {
        profileDropdown.classList.remove("show");
        if (profileBtn) profileBtn.setAttribute("aria-expanded", "false");
      }

      // toggle notifications panel inside the .notification element
      if (notifPanel.classList.contains("show")) {
        hideNotifPanel();
        this.setAttribute("aria-expanded", "false");
        return;
      }

      notifPanel.classList.add("show");
      notifPanel.setAttribute("aria-hidden", "false");
      this.setAttribute("aria-expanded", "true");
    });

    // Close notifications when clicking outside
    document.addEventListener("click", function (e) {
      if (!notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
        hideNotifPanel();
      }
    });

    // Close on Escape as well
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        hideNotifPanel();
      }
    });
  }

  // Notification badge click (guarded)
  const notification = document.querySelector(".notification");
  if (notification) {
    notification.addEventListener("click", function () {
      const isMobile = window.matchMedia("(max-width: 1000px)").matches;
      if (isMobile) {
        // On mobile, redirect to a dedicated notifications page
        window.location.href = "/notification.html";
        return;
      }
      const b = this.querySelector(".notif-badge");
      if (!b) return;
      b.textContent = "0";
      b.style.backgroundColor = "#4caf50";
    });
  }

  // Load notifications from API when endpoint is provided
  const notificationWrapper = document.querySelector(
    ".notification[data-notifications-endpoint]"
  );

  if (notificationWrapper) {
    const endpoint = notificationWrapper.dataset.notificationsEndpoint;
    const defaultAvatar =
      notificationWrapper.dataset.defaultAvatar ||
      "/static/auth/img/default-profile.jpg";
    const badge = notificationWrapper.querySelector(".notif-badge");
    const list = notificationWrapper.querySelector(
      "[data-notifications-list]"
    );
    const emptyState = notificationWrapper.querySelector(
      "[data-notifications-empty]"
    );

    if (endpoint && badge && list) {
      const loadingMessage = emptyState
        ? emptyState.textContent.trim()
        : "Loading notifications...";

      function setBadge(count) {
        const value = Number(count) || 0;
        if (value <= 0) {
          badge.style.display = "none";
          badge.textContent = "0";
        } else {
          badge.style.display = "inline-flex";
          badge.textContent = value > 99 ? "99+" : String(value);
        }
      }

      function showMessage(message, type) {
        if (!emptyState) return;
        emptyState.textContent = message;
        emptyState.dataset.state = type || "info";
        emptyState.style.display = "block";
      }

      function clearList() {
        list.innerHTML = "";
      }

      function renderNotifications(items) {
        clearList();
        if (!items || items.length === 0) {
          showMessage("No notifications yet.", "empty");
          return;
        }

        if (emptyState) {
          emptyState.style.display = "none";
        }

        items.forEach((notif) => {
          const item = document.createElement("div");
          item.className = "notif-item";

          const avatar = document.createElement("div");
          avatar.className = "notif-avatar";
          const icon = document.createElement("i");
          // Use different icons based on notification type
          if (notif.type === 'deadline_reminder') {
            icon.className = "ph-bold ph-clock";
          } else if (notif.type === 'form_submitted') {
            icon.className = "ph-bold ph-check-circle";
          } else if (notif.type === 'form_approved' || notif.type === 'form_rejected') {
            icon.className = "ph-bold ph-file-text";
          } else {
            icon.className = "ph-bold ph-bell";
          }
          avatar.appendChild(icon);

          const content = document.createElement("div");
          content.className = "notif-content";

          const title = document.createElement("div");
          title.className = "notif-title";
          title.textContent = notif.title || "Notification";

          const message = document.createElement("div");
          message.className = "notif-message";
          message.textContent = notif.message || "No additional details.";

          // Add deadline date for deadline notifications
          if (notif.type === 'deadline_reminder') {
            let deadlineData = null;
            
            // Check both deadline object and metadata
            if (notif.deadline) {
              deadlineData = notif.deadline;
            } else if (notif.metadata) {
              deadlineData = notif.metadata;
            }
            
            if (deadlineData && deadlineData.deadline_date) {
              const deadlineDate = new Date(deadlineData.deadline_date);
              if (!Number.isNaN(deadlineDate.getTime())) {
                const deadlineDateText = deadlineDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                });
                
                // Determine urgency badge
                let badgeClass = 'notif-deadline-badge';
                let badgeText = '';
                const daysRemaining = deadlineData.days_remaining !== undefined ? deadlineData.days_remaining : 
                  Math.ceil((deadlineDate - new Date()) / (1000 * 60 * 60 * 24));
                const isOverdue = deadlineData.is_overdue !== undefined ? deadlineData.is_overdue : daysRemaining < 0;
                
                if (isOverdue) {
                  badgeClass += ' overdue';
                  badgeText = `Overdue: ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''}`;
                } else if (daysRemaining === 0) {
                  badgeClass += ' due-today';
                  badgeText = 'Due Today';
                } else if (daysRemaining <= 3) {
                  badgeClass += ' due-soon';
                  badgeText = `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`;
                } else {
                  badgeClass += ' due-later';
                  badgeText = `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`;
                }
                
                const deadlineInfo = document.createElement("div");
                deadlineInfo.className = "notif-deadline";
                deadlineInfo.innerHTML = `
                  <div class="notif-deadline-header">
                    <i class="ph-bold ph-calendar"></i>
                    <strong>Due Date:</strong> ${deadlineDateText}
                  </div>
                  <span class="${badgeClass}">${badgeText}</span>
                `;
                message.appendChild(deadlineInfo);
              }
            }
          }

          const meta = document.createElement("div");
          meta.className = "notif-meta";
          
          // Add sender name if available
          if (notif.sender && notif.sender !== 'System') {
            const sender = document.createElement("span");
            sender.textContent = notif.sender;
            meta.appendChild(sender);
          }
          
          // Add time
          if (notif.created_at) {
            const createdDate = new Date(notif.created_at);
            if (!Number.isNaN(createdDate.getTime())) {
              const now = new Date();
              const diffMs = now - createdDate;
              const diffMins = Math.floor(diffMs / 60000);
              const diffHours = Math.floor(diffMs / 3600000);
              const diffDays = Math.floor(diffMs / 86400000);
              
              let timeText = '';
              if (diffMins < 1) {
                timeText = 'Just now';
              } else if (diffMins < 60) {
                timeText = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
              } else if (diffHours < 24) {
                timeText = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
              } else if (diffDays < 7) {
                timeText = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
              } else {
                timeText = createdDate.toLocaleDateString();
              }
              
              const timeSpan = document.createElement("span");
              timeSpan.textContent = timeText;
              if (meta.children.length > 0) {
                meta.appendChild(document.createTextNode(' • '));
              }
              meta.appendChild(timeSpan);
            }
          }

          content.appendChild(title);
          content.appendChild(message);
          if (meta.children.length > 0 || meta.textContent) {
            content.appendChild(meta);
          }

          if (notif.action_required && notif.action_url) {
            const action = document.createElement("a");
            action.className = "notif-action";
            action.href = notif.action_url;
            action.textContent = "Open";
            action.target = "_blank";
            action.rel = "noopener noreferrer";
            if (meta.children.length > 0 || meta.textContent) {
              meta.appendChild(document.createTextNode(' • '));
            }
            meta.appendChild(action);
          }

          item.appendChild(avatar);
          item.appendChild(content);
          list.appendChild(item);
        });
      }

      async function loadNotifications() {
        try {
          showMessage(loadingMessage, "loading");
          const response = await fetch(endpoint, {
            credentials: "include",
          });

          if (!response.ok) {
            throw new Error(`Request failed with ${response.status}`);
          }

          const data = await response.json();
          const notifications = data.notifications || [];
          const unread =
            typeof data.unread_count !== "undefined"
              ? data.unread_count
              : notifications.filter((item) => item.is_read === false).length;

          setBadge(unread);
          renderNotifications(notifications);
        } catch (error) {
          console.error("Failed to load notifications:", error);
          showMessage("Could not load notifications.", "error");
          setBadge(0);
        }
      }

      loadNotifications();
      notificationWrapper.addEventListener("notifications:refresh", () => {
        loadNotifications();
      });
    }
  }
});
