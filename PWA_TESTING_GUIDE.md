# PWA Testing Guide for Localhost

## Prerequisites

1. **HTTPS or localhost**: Service Workers work on:
   - `localhost` (any port)
   - `127.0.0.1` (any port)
   - HTTPS connections

2. **Modern Browser**: Use Chrome, Edge, or Firefox (latest versions)

## Testing Steps

### 1. Check Service Worker Registration

#### Using Browser DevTools:

1. **Open DevTools** (F12 or Right-click → Inspect)
2. Go to **Application** tab (Chrome/Edge) or **Storage** tab (Firefox)
3. Click **Service Workers** in the left sidebar
4. You should see:
   - Service Worker status: "activated and is running"
   - Scope: `http://localhost:8000/user/dashboard/`
   - Source: `service-worker.js`

#### Using Console:

```javascript
// Check if service worker is registered
navigator.serviceWorker.getRegistration().then(reg => {
    console.log('Service Worker:', reg);
    console.log('Scope:', reg.scope);
    console.log('Active:', reg.active);
});

// Check service worker version
window.pwaManager.getVersion().then(version => {
    console.log('SW Version:', version);
});
```

### 2. Test Offline Functionality

#### Simulate Offline Mode:

1. **Chrome/Edge DevTools**:
   - Open DevTools (F12)
   - Go to **Network** tab
   - Check **Offline** checkbox
   - Or use dropdown: Select "Offline" from throttling dropdown

2. **Firefox DevTools**:
   - Open DevTools (F12)
   - Go to **Network** tab
   - Click the **Network throttling** icon
   - Select "Offline"

#### Test Offline Page Loading:

1. **Before going offline**:
   - Visit `http://localhost:8000/user/dashboard/form/`
   - Let the page fully load
   - This caches the page

2. **Go offline**:
   - Enable offline mode in DevTools
   - Refresh the page (F5)
   - **Expected**: Page should still load from cache

3. **Check cache**:
   - DevTools → Application → Cache Storage
   - You should see caches:
     - `edsight-static-v1` (CSS, JS, images)
     - `edsight-pages-v1` (HTML pages)
     - `edsight-api-v1` (API responses)

### 3. Test Form Saving Offline

#### Steps:

1. **Go to form page**: `http://localhost:8000/user/dashboard/form/`
2. **Go offline** (using DevTools Network tab)
3. **Fill out a question**:
   - Type an answer in any question field
   - Wait 2 seconds (auto-save triggers)
4. **Check offline indicator**:
   - Should show "Offline" status
   - Badge should show count of unsaved changes
5. **Check localStorage**:
   - DevTools → Application → Local Storage
   - Look for `school_form_offline_answers`
   - Should contain your answer
6. **Check IndexedDB queue**:
   - DevTools → Application → IndexedDB
   - Look for `edsight-pwa-db` → `request-queue`
   - Should contain queued API request

### 4. Test Background Sync

#### Steps:

1. **Save answer while offline** (from step 3)
2. **Go back online**:
   - Uncheck "Offline" in Network tab
   - Or select "Online" from throttling dropdown
3. **Watch for automatic sync**:
   - Background Sync API should trigger automatically
   - Check console for sync messages
   - Offline indicator should update
4. **Verify sync**:
   - Check Network tab for API calls to `/save-answers/`
   - Check IndexedDB queue (should be empty after sync)
   - Check localStorage (synced items should be marked)

#### Manual Sync Trigger:

```javascript
// Manually trigger sync
window.queueManager.registerSync().then(() => {
    console.log('Sync registered');
});

// Process queue manually
window.queueManager.processQueue().then(() => {
    console.log('Queue processed');
});
```

### 5. Test Cache Strategies

#### Check What's Cached:

1. **DevTools → Application → Cache Storage**
2. Click on each cache to see cached files
3. **Expected caches**:
   - Static assets (CSS, JS, images) - Cache First
   - HTML pages - Network First
   - API responses - Network First

#### Test Cache Updates:

1. **Make a change** to a CSS/JS file
2. **Update service worker version** in `pwa-config.js`:
   ```javascript
   VERSION: '1.0.1',  // Increment version
   ```
3. **Reload page**:
   - Service worker should detect update
   - Old cache should be deleted
   - New cache should be created

### 6. Test Install Prompt

#### Steps:

1. **Visit the dashboard** in Chrome/Edge
2. **Check install button**:
   - Should appear in header (if PWA is installable)
   - Click to install
3. **Or use browser prompt**:
   - Chrome: Address bar → Install icon
   - Edge: Address bar → App available icon
4. **After installation**:
   - App opens in standalone window
   - No browser UI (address bar, etc.)
   - Check `window.matchMedia('(display-mode: standalone)').matches`

#### Check Install Status:

```javascript
// Check if app is installed
window.installPromptHandler.getStatus();
// Returns: { isInstalled, isAvailable, isStandalone }
```

### 7. Test Queue Management

#### Check Queue Count:

```javascript
// Get queue count
window.queueManager.getQueueCount().then(count => {
    console.log('Queued requests:', count);
});
```

#### Monitor Queue:

```javascript
// Start monitoring queue count
const stopMonitoring = window.queueManager.startQueueMonitoring((count) => {
    console.log('Queue count updated:', count);
});

// Stop monitoring later
// stopMonitoring();
```

### 8. Test Network Status Detection

#### Steps:

1. **Go offline** (DevTools Network tab)
2. **Check offline indicator**:
   - Should show "Offline" status
   - Should show queued items count
3. **Go online**
4. **Check offline indicator**:
   - Should show "Online" or "Syncing"
   - Should update when sync completes

### 9. Debug Service Worker

#### View Service Worker Logs:

1. **DevTools → Application → Service Workers**
2. Click **"Console"** link next to service worker
3. This opens a console for the service worker
4. All `console.log()` from service worker will appear here

#### Unregister Service Worker:

```javascript
// Unregister service worker (for testing)
navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
    console.log('Service workers unregistered');
});
```

#### Clear All Caches:

```javascript
// Clear all caches
caches.keys().then(cacheNames => {
    cacheNames.forEach(cacheName => {
        caches.delete(cacheName);
    });
    console.log('All caches cleared');
});
```

### 10. Test Update Flow

#### Steps:

1. **Visit dashboard** (service worker registers)
2. **Update service worker**:
   - Change version in `pwa-config.js`
   - Save file
3. **Reload page**:
   - New service worker should install
   - Old service worker should be waiting
4. **Check for update notification**:
   - Should see update available message
5. **Activate update**:
   - Click "Update" button (if shown)
   - Or close all tabs and reopen

## Common Issues & Solutions

### Issue: Service Worker Not Registering

**Solution**:
- Check browser console for errors
- Verify service worker file is accessible: `http://localhost:8000/user/dashboard/service-worker.js`
- Check that you're on `localhost` (not `127.0.0.1` if there's a mismatch)
- Clear browser cache and try again

### Issue: Offline Page Not Loading

**Solution**:
- Visit page while online first (to cache it)
- Check Cache Storage in DevTools
- Verify cache strategy is working
- Check service worker console for errors

### Issue: Background Sync Not Working

**Solution**:
- Background Sync requires HTTPS (or localhost)
- Check if `'sync' in registration` returns true
- Verify IndexedDB is working
- Check service worker console for errors

### Issue: Queue Not Syncing

**Solution**:
- Check IndexedDB for queued items
- Manually trigger sync: `window.queueManager.registerSync()`
- Check Network tab for API calls
- Verify API endpoint is correct

## Testing Checklist

- [ ] Service worker registers successfully
- [ ] Service worker activates
- [ ] Page loads from cache when offline
- [ ] Form answers save to localStorage when offline
- [ ] Failed requests queue in IndexedDB
- [ ] Background sync triggers when online
- [ ] Queued requests sync automatically
- [ ] Cache strategies work correctly
- [ ] Install prompt appears (if supported)
- [ ] App installs successfully
- [ ] Service worker updates work
- [ ] Offline indicator shows correct status
- [ ] Queue count updates correctly

## Browser-Specific Notes

### Chrome/Edge:
- Best PWA support
- Full Background Sync support
- Install prompt works well
- DevTools: Application tab

### Firefox:
- Good PWA support
- Limited Background Sync (experimental)
- Install prompt works
- DevTools: Storage tab

### Safari:
- Limited PWA support
- No Background Sync
- Install prompt works (iOS)
- DevTools: Storage tab

## Quick Test Commands

```javascript
// Check PWA status
console.log('SW Registered:', !!navigator.serviceWorker.controller);
console.log('Online:', navigator.onLine);
console.log('Queue Count:', await window.queueManager.getQueueCount());
console.log('Install Status:', window.installPromptHandler.getStatus());

// Force sync
await window.queueManager.registerSync();

// Clear everything (for testing)
await window.queueManager.clearQueue();
caches.keys().then(names => names.forEach(n => caches.delete(n)));
localStorage.clear();
indexedDB.deleteDatabase('edsight-pwa-db');
```

## Next Steps

1. Test all features while online
2. Test all features while offline
3. Test transition from offline to online
4. Test on different browsers
5. Test on mobile devices (if possible)
6. Monitor console for errors
7. Check Network tab for failed requests
8. Verify data persistence

