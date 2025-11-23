// Admin Base JavaScript - Sidebar toggle, header interactions, Bootstrap initialization

document.addEventListener("DOMContentLoaded", function () {
    // Sidebar functionality
    const root = document.querySelector(".dashboard-container");
    const hamburger = document.querySelector("#sidebar-toggle, .hamburger-btn");

    if (hamburger) {
        // Start with expanded state
        hamburger.setAttribute("aria-expanded", "true");

        hamburger.addEventListener("click", function (e) {
            const isMobile = window.matchMedia("(max-width: 1000px)").matches;

            if (isMobile) {
                // Toggle off-canvas open state for mobile
                const isOpen = root.classList.toggle("sidebar-open");
                this.setAttribute("aria-expanded", isOpen ? "true" : "false");
                this.title = isOpen ? "Close menu" : "Open menu";
            } else {
                // Desktop: toggle collapsed sidebar
                const isCollapsed = root.classList.toggle("sidebar-collapsed");
                this.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
                this.title = isCollapsed ? "Open menu" : "Close menu";
            }
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
            const hamburgerEl = document.querySelector("#sidebar-toggle, .hamburger-btn");

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

        // Accessibility: allow Enter/Space to toggle when focused
        hamburger.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                this.click();
            }
        });
    }

    // Header functionality
    // Profile dropdown toggle
    const profileBtn = document.querySelector(".profile .avatar-btn");
    const profileDropdown = document.querySelector(".profile-dropdown");

    if (profileBtn && profileDropdown) {
        // Helper to hide profile dropdown
        function hideProfileDropdown() {
            profileDropdown.classList.remove("show");
            profileDropdown.setAttribute("aria-hidden", "true");
            profileBtn.setAttribute("aria-expanded", "false");
        }

        profileBtn.addEventListener("click", function (e) {
            e.stopPropagation();

            // Close notifications panel if open
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

            // Show dropdown
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

    // Notifications panel toggle
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
                // On mobile, could redirect to notifications page
                // window.location.href = "/notifications/";
                return;
            }

            // Close profile dropdown if open
            const profileDropdown = document.querySelector(
                ".profile .profile-dropdown"
            );
            const profileBtn = document.querySelector(".profile .avatar-btn");

            if (profileDropdown && profileDropdown.classList.contains("show")) {
                profileDropdown.classList.remove("show");
                if (profileBtn) profileBtn.setAttribute("aria-expanded", "false");
            }

            // Toggle notifications panel
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

        // Close on Escape
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                hideNotifPanel();
            }
        });
    }

    // Initialize Bootstrap components
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Set current year in footer
    const yearEl = document.getElementById('admin-year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
});

