// Sidebar functionality
document.addEventListener("DOMContentLoaded", function () {
  // Hamburger: collapse/expand sidebar with sliding animation
  const root = document.querySelector(".dashboard-container");
  const hamburger = document.querySelector(".hamburger");

  if (hamburger) {
    // start with expanded state
    hamburger.setAttribute("aria-expanded", "true");

    hamburger.addEventListener("click", function (e) {
      const isMobile = window.matchMedia("(max-width: 1000px)").matches;

      if (isMobile) {
        // Toggle off-canvas open state for mobile
        const isOpen = root.classList.toggle("sidebar-open");
        this.setAttribute("aria-expanded", isOpen ? "true" : "false");
        this.title = isOpen ? "Close menu" : "Open menu";
      } else {
        // Desktop: toggle collapsed sidebar (existing behavior)
        const isCollapsed = root.classList.toggle("sidebar-collapsed");
        this.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
        this.title = isCollapsed ? "Open menu" : "Close menu";
      }
      // Keep the hamburger icon visually constant (do not swap to an X).
    });

    // Close mobile sidebar when clicking the backdrop
    document.addEventListener("click", function (e) {
      const isMobile = window.matchMedia("(max-width: 1000px)").matches;
      if (!isMobile) return;

      const container = document.querySelector(".dashboard-container");
      if (!container) return;
      if (!container.classList.contains("sidebar-open")) return;

      // If click happened inside the sidebar or on the hamburger, ignore
      const sidebarEl = document.querySelector(".sidebar");
      const hamburgerEl = document.querySelector(".hamburger");

      if (sidebarEl && (sidebarEl.contains(e.target) || sidebarEl === e.target))
        return;
      if (
        hamburgerEl &&
        (hamburgerEl.contains(e.target) || hamburgerEl === e.target)
      )
        return;

      // otherwise close the mobile sidebar
      container.classList.remove("sidebar-open");
      if (hamburger) hamburger.setAttribute("aria-expanded", "false");
    });

    // Close mobile sidebar on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        const isMobile = window.matchMedia("(max-width: 1000px)").matches;
        if (!isMobile) return;

        const container = document.querySelector(".dashboard-container");
        if (container && container.classList.contains("sidebar-open")) {
          container.classList.remove("sidebar-open");
          if (hamburger) hamburger.setAttribute("aria-expanded", "false");
        }
      }
    });

    // accessibility: allow Enter/Space to toggle when focused
    hamburger.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.click();
      }
    });
  }
});
