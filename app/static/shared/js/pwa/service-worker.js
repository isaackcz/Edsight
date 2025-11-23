/**
 * Service Worker Entry Point
 * Imports all service worker modules
 */

// Import configuration first
importScripts('/static/shared/js/pwa/pwa-config.js');

// Import queue manager
importScripts('/static/shared/js/pwa/sw-queue.js');

// Import cache manager
importScripts('/static/shared/js/pwa/sw-cache.js');

// Import sync handler
importScripts('/static/shared/js/pwa/sw-sync.js');

// Import main service worker
importScripts('/static/shared/js/pwa/sw-main.js');

console.log('Service Worker loaded successfully');

