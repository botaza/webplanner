// js/sw.js - WebPlanner Service Worker for PWA
// PATCHED: Complete caching strategy, offline support, and push notification handling

// Service Worker version (increment to force update)
const SW_VERSION = '1.0.0';
const CACHE_NAME = `webplanner-cache-v${SW_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/utils.js',
    '/js/state.js',
    '/js/api.js',
    '/js/date-utils.js',
    '/js/planner-crud.js',
    '/js/planner-render.js',
    '/js/planner-filter.js',
    '/js/expenses.js',
    '/js/income.js',
    '/js/dashboard.js',
    '/js/fcm-client.js',
    '/js/notification-history.js',
    '/js/lockscreen.js',
    '/js/suggestions.js',
    '/js/sw.js',
    '/firebase-messaging-sw.js',
    '/php/api.php',
    '/php/save-subscription.php',
    '/php/send-notifications.php'
];

// Dynamic cache name for runtime caching
const DYNAMIC_CACHE_NAME = `webplanner-dynamic-v${SW_VERSION}`;

// Network timeout for fetch requests
const NETWORK_TIMEOUT = 5000;

// Maximum cache size
const MAX_CACHE_SIZE = 100;

// ==================== INSTALL EVENT ====================

self.addEventListener('install', (event) => {
    console.log(`[SW] Installing Service Worker version ${SW_VERSION}`);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Static assets cached successfully');
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Failed to cache static assets:', error);
            })
    );
});

// ==================== ACTIVATE EVENT ====================

self.addEventListener('activate', (event) => {
    console.log(`[SW] Activating Service Worker version ${SW_VERSION}`);
    
    event.waitUntil(
        // Clean up old caches
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => {
                            // Delete old version caches
                            return cacheName.startsWith('webplanner-cache-v') && 
                                   cacheName !== CACHE_NAME;
                        })
                        .map((cacheName) => {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Old caches cleaned up');
                // Claim all clients immediately
                return self.clients.claim();
            })
            .then(() => {
                console.log('[SW] Service Worker activated and controlling clients');
                // Notify clients about update
                return self.clients.matchAll().then((clients) => {
                    clients.forEach((client) => {
                        client.postMessage({
                            type: 'SW_UPDATE',
                            version: SW_VERSION
                        });
                    });
                });
            })
    );
});

// ==================== FETCH EVENT ====================

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // API requests - network first, cache fallback
    if (url.pathname.includes('/php/')) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }
    
    // Static assets - cache first, network fallback
    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirstStrategy(request));
        return;
    }
    
    // HTML pages - stale while revalidate
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(staleWhileRevalidateStrategy(request));
        return;
    }
    
    // Default - network first with timeout
    event.respondWith(networkFirstStrategy(request));
});

// ==================== CACHING STRATEGIES ====================

/**
 * Cache First Strategy
 * Best for static assets that rarely change
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function cacheFirstStrategy(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('[SW] Cache hit:', request.url);
            
            // Update cache in background (stale while revalidate)
            fetchAndCache(request).catch((error) => {
                console.warn('[SW] Background cache update failed:', error);
            });
            
            return cachedResponse;
        }
    } catch (error) {
        console.warn('[SW] Cache read error:', error);
    }
    
    // Fetch from network
    return fetchAndCache(request);
}

/**
 * Network First Strategy
 * Best for API requests and dynamic content
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirstStrategy(request) {
    try {
        // Try network with timeout
        const networkResponse = await fetchWithTimeout(request, NETWORK_TIMEOUT);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            await cache.put(request, networkResponse.clone());
            await trimCache(DYNAMIC_CACHE_NAME, MAX_CACHE_SIZE);
        }
        
        console.log('[SW] Network success:', request.url);
        return networkResponse;
    } catch (error) {
        console.warn('[SW] Network failed, trying cache:', request.url);
        
        // Fallback to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            console.log('[SW] Cache fallback:', request.url);
            return cachedResponse;
        }
        
        // Return offline fallback for navigation requests
        if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
        }
        
        // Return error response
        return new Response('Offline - Content not available in cache', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

/**
 * Stale While Revalidate Strategy
 * Best for HTML pages - show cached immediately, update in background
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function staleWhileRevalidateStrategy(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    // Start network request in background
    const networkPromise = fetchAndCache(request).catch((error) => {
        console.warn('[SW] Background revalidate failed:', error);
    });
    
    // Return cached immediately or wait for network
    if (cachedResponse) {
        console.log('[SW] Stale response:', request.url);
        return cachedResponse;
    }
    
    console.log('[SW] Waiting for network:', request.url);
    return networkPromise;
}

/**
 * Fetch with timeout
 * @param {Request} request
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(request, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(request, {
            signal: controller.signal,
            credentials: 'same-origin'
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Fetch and cache response
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function fetchAndCache(request) {
    const response = await fetch(request, {
        credentials: 'same-origin'
    });
    
    // Only cache successful responses
    if (response.ok) {
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        await cache.put(request, response.clone());
        await trimCache(DYNAMIC_CACHE_NAME, MAX_CACHE_SIZE);
    }
    
    return response;
}

/**
 * Trim cache to maximum size
 * @param {string} cacheName
 * @param {number} maxSize
 */
async function trimCache(cacheName, maxSize) {
    try {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        
        if (keys.length > maxSize) {
            // Delete oldest entries
            const deleteCount = keys.length - maxSize;
            for (let i = 0; i < deleteCount; i++) {
                await cache.delete(keys[i]);
            }
            console.log(`[SW] Trimmed cache to ${maxSize} entries`);
        }
    } catch (error) {
        console.warn('[SW] Cache trim failed:', error);
    }
}

/**
 * Check if URL is a static asset
 * @param {string} pathname
 * @returns {boolean}
 */
function isStaticAsset(pathname) {
    const staticExtensions = [
        '.css',
        '.js',
        '.json',
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.svg',
        '.ico',
        '.woff',
        '.woff2',
        '.ttf',
        '.eot'
    ];
    
    return staticExtensions.some(ext => pathname.endsWith(ext)) ||
           STATIC_ASSETS.some(asset => pathname === asset || pathname.endsWith(asset));
}

// ==================== PUSH NOTIFICATION EVENT ====================

self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');
    
    let data = {};
    
    try {
        if (event.data) {
            data = event.data.json();
        }
    } catch (error) {
        console.error('[SW] Failed to parse push data:', error);
        data = {
            title: 'WebPlanner',
            body: 'You have a new notification'
        };
    }
    
    const title = data.title || 'WebPlanner';
    const options = {
        body: data.body || 'New notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/',
            event_id: data.event_id || null,
            rule: data.rule || 'unknown',
            timestamp: Date.now()
        },
        actions: [
            {
                action: 'view',
                title: 'View',
                icon: '/icons/view.png'
            },
            {
                action: 'dismiss',
                title: 'Dismiss',
                icon: '/icons/dismiss.png'
            }
        ],
        tag: data.tag || 'webplanner-notification',
        renotify: true,
        requireInteraction: false,
        silent: false
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
            .then(() => {
                console.log('[SW] Notification displayed');
            })
            .catch((error) => {
                console.error('[SW] Failed to show notification:', error);
            })
    );
});

// ==================== NOTIFICATION CLICK EVENT ====================

self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.action);
    
    event.notification.close();
    
    if (event.action === 'dismiss') {
        // User dismissed notification
        console.log('[SW] Notification dismissed');
        return;
    }
    
    // Default action or 'view' - open the app
    const urlToOpen = event.notification.data?.url || '/';
    const eventId = event.notification.data?.event_id;
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((clientList) => {
            // Check if there's already a window open
            for (const client of clientList) {
                if (client.url === urlToOpen && 'focus' in client) {
                    client.focus();
                    // Send message to client about the event
                    if (eventId) {
                        client.postMessage({
                            type: 'NOTIFICATION_CLICK',
                            event_id: eventId
                        });
                    }
                    return;
                }
            }
            
            // No window open, open new one
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen).then((client) => {
                    if (eventId && client) {
                        client.postMessage({
                            type: 'NOTIFICATION_CLICK',
                            event_id: eventId
                        });
                    }
                });
            }
        })
    );
});

// ==================== NOTIFICATION CLOSE EVENT ====================

self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed');
    // Could track notification dismissal analytics here
});

// ==================== MESSAGE EVENT ====================

self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);
    
    if (event.data && event.data.type) {
        switch (event.data.type) {
            case 'SKIP_WAITING':
                // Force service worker activation
                self.skipWaiting();
                break;
                
            case 'CACHE_URLS':
                // Cache specific URLs
                if (Array.isArray(event.data.urls)) {
                    event.waitUntil(
                        caches.open(CACHE_NAME)
                            .then((cache) => cache.addAll(event.data.urls))
                    );
                }
                break;
                
            case 'CLEAR_CACHE':
                // Clear all caches
                event.waitUntil(
                    caches.keys()
                        .then((cacheNames) => {
                            return Promise.all(
                                cacheNames.map((cacheName) => caches.delete(cacheName))
                            );
                        })
                );
                break;
                
            case 'GET_CACHE_STATUS':
                // Return cache status to client
                event.waitUntil(
                    getCacheStatus().then((status) => {
                        event.ports[0].postMessage(status);
                    })
                );
                break;
                
            case 'CACHE_VERSION':
                // Return current cache version
                event.ports[0].postMessage({
                    version: SW_VERSION,
                    cacheName: CACHE_NAME
                });
                break;
                
            default:
                console.warn('[SW] Unknown message type:', event.data.type);
        }
    }
});

// ==================== SYNC EVENT (Background Sync) ====================

self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);
    
    if (event.tag === 'sync-events') {
        event.waitUntil(syncEvents());
    } else if (event.tag === 'sync-expenses') {
        event.waitUntil(syncExpenses());
    } else if (event.tag === 'sync-income') {
        event.waitUntil(syncIncome());
    }
});

/**
 * Sync events with server
 * @returns {Promise}
 */
async function syncEvents() {
    try {
        // Get pending events from IndexedDB (would need implementation)
        console.log('[SW] Syncing events with server');
        // Implementation would go here
    } catch (error) {
        console.error('[SW] Events sync failed:', error);
        throw error; // Retry
    }
}

/**
 * Sync expenses with server
 * @returns {Promise}
 */
async function syncExpenses() {
    try {
        console.log('[SW] Syncing expenses with server');
        // Implementation would go here
    } catch (error) {
        console.error('[SW] Expenses sync failed:', error);
        throw error; // Retry
    }
}

/**
 * Sync income with server
 * @returns {Promise}
 */
async function syncIncome() {
    try {
        console.log('[SW] Syncing income with server');
        // Implementation would go here
    } catch (error) {
        console.error('[SW] Income sync failed:', error);
        throw error; // Retry
    }
}

// ==================== PERIODIC BACKGROUND SYNC ====================

self.addEventListener('periodicsync', (event) => {
    console.log('[SW] Periodic sync triggered:', event.tag);
    
    if (event.tag === 'fetch-notifications') {
        event.waitUntil(fetchNotifications());
    }
});

/**
 * Fetch notifications from server periodically
 * @returns {Promise}
 */
async function fetchNotifications() {
    try {
        console.log('[SW] Fetching notifications from server');
        // Would call API to check for new notifications
        // Implementation would go here
    } catch (error) {
        console.error('[SW] Notification fetch failed:', error);
    }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get cache status for debugging
 * @returns {Promise<Object>}
 */
async function getCacheStatus() {
    const cacheNames = await caches.keys();
    const status = {};
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        status[cacheName] = {
            entries: keys.length,
            size: 'Unknown' // Would need to calculate actual size
        };
    }
    
    return {
        version: SW_VERSION,
        caches: status,
        isOnline: navigator.onLine
    };
}

/**
 * Pre-cache critical resources
 * @param {Array<string>} urls
 */
export async function precache(urls) {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(urls);
}

/**
 * Remove item from cache
 * @param {string} url
 */
export async function removeFromCache(url) {
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        await cache.delete(url);
    }
}

/**
 * Clear all caches
 */
export async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
    );
}

/**
 * Check if resource is cached
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function isCached(url) {
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const response = await cache.match(url);
        if (response) {
            return true;
        }
    }
    return false;
}

/**
 * Get cached response
 * @param {string} url
 * @returns {Promise<Response|null>}
 */
export async function getCachedResponse(url) {
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const response = await cache.match(url);
        if (response) {
            return response;
        }
    }
    return null;
}

// Log service worker registration
console.log(`[SW] Service Worker loaded. Version: ${SW_VERSION}`);