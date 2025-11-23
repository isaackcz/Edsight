/**
 * Install Prompt Handler
 * Handles PWA installation prompts and UI
 */

class InstallPromptHandler {
    constructor() {
        this.deferredPrompt = null;
        this.installButton = null;
        this.isInstalled = false;
        this.setupBeforeInstallPrompt();
        this.checkIfInstalled();
    }

    /**
     * Setup beforeinstallprompt event listener
     */
    setupBeforeInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            
            // Stash the event so it can be triggered later
            this.deferredPrompt = e;
            
            // Show install button
            this.showInstallButton();
            
            console.log('PWA install prompt available');
        });
    }

    /**
     * Check if app is already installed
     */
    checkIfInstalled() {
        // Check if running as standalone (installed)
        if (window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
            this.hideInstallButton();
            return;
        }

        // Check if running in standalone mode on iOS
        if (window.navigator.standalone === true) {
            this.isInstalled = true;
            this.hideInstallButton();
            return;
        }

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            this.hideInstallButton();
            this.deferredPrompt = null;
            console.log('PWA installed');
        });
    }

    /**
     * Show install button
     */
    showInstallButton() {
        if (this.isInstalled) return;

        const button = document.getElementById('pwa-install-button');
        if (button) {
            button.style.display = 'flex';
            this.installButton = button;
            
            // Add click handler if not already added
            if (!button.dataset.handlerAdded) {
                button.addEventListener('click', () => this.promptInstall());
                button.dataset.handlerAdded = 'true';
            }
        }
    }

    /**
     * Hide install button
     */
    hideInstallButton() {
        const button = document.getElementById('pwa-install-button');
        if (button) {
            button.style.display = 'none';
        }
    }

    /**
     * Prompt user to install
     */
    async promptInstall() {
        if (!this.deferredPrompt) {
            console.log('Install prompt not available');
            return false;
        }

        // Show the install prompt
        this.deferredPrompt.prompt();

        // Wait for user response
        const { outcome } = await this.deferredPrompt.userChoice;

        console.log(`User response to install prompt: ${outcome}`);

        // Clear the deferred prompt
        this.deferredPrompt = null;
        this.hideInstallButton();

        return outcome === 'accepted';
    }

    /**
     * Check if install prompt is available
     */
    isAvailable() {
        return this.deferredPrompt !== null && !this.isInstalled;
    }

    /**
     * Get install status
     */
    getStatus() {
        return {
            isInstalled: this.isInstalled,
            isAvailable: this.isAvailable(),
            isStandalone: window.matchMedia('(display-mode: standalone)').matches
        };
    }
}

// Create singleton instance
window.InstallPromptHandler = InstallPromptHandler;
const installPromptHandler = new InstallPromptHandler();

