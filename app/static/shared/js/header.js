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
});
