// firebase-messaging-sw.js - Firebase Cloud Messaging Service Worker
// PATCHED: Complete FCM handling, background notifications, and click actions

// Import Firebase SDKs (via CDN in production, or bundler in development)
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Firebase configuration - MUST match the config in index.html
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log('[FCM-SW] Firebase initialized');
} catch (error) {
    console.error('[FCM-SW] Firebase initialization failed:', error);
}

// Get messaging instance
const messaging = firebase.messaging ? firebase.messaging() : null;

if (messaging) {
    console.log('[FCM-SW] Firebase Messaging initialized');
} else {
    console.warn('[FCM-SW] Firebase Messaging not available');
}

// ==================== BACKGROUND MESSAGE HANDLER ====================

/**
 * Handle background push messages
 * Called when app is in background or closed
 */
if (messaging) {
    messaging.onBackgroundMessage((payload) => {
        console.log('[FCM-SW] Background message received:', payload);
        
        // Extract notification data
        const notification = payload.notification || {};
        const data = payload.data || {};
        
        // Build notification options
        const title = notification.title || data.title || 'WebPlanner';
        const body = notification.body || data.body || 'You have a new notification';
        const icon = data.icon || '/icons/icon-192.png';
        const badge = data.badge || '/icons/badge-72.png';
        const url = data.url || data.click_action || '/';
        const eventId = data.event_id || null;
        const rule = data.rule || 'unknown';
        const tag = data.tag || `webplanner-${Date.now()}`;
        
        // Notification options
        const options = {
            body: body,
            icon: icon,
            badge: badge,
            vibrate: [100, 50, 100],
            data: {
                url: url,
                event_id: eventId,
                rule: rule,
                timestamp: Date.now(),
                notificationId: tag
            },
            actions: [
                {
                    action: 'view',
                    title: 'View',
                    icon: '/icons/view.png'
                },
                {
                    action: 'complete',
                    title: 'Mark Done',
                    icon: '/icons/complete.png'
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss',
                    icon: '/icons/dismiss.png'
                }
            ],
            tag: tag,
            renotify: true,
            requireInteraction: false,
            silent: false,
            timestamp: Date.now()
        };
        
        // Add image if provided
        if (data.image) {
            options.image = data.image;
        }
        
        // Add color if provided
        if (data.color) {
            options.color = data.color;
        }
        
        // Show notification
        self.registration.showNotification(title, options)
            .then(() => {
                console.log('[FCM-SW] Notification displayed');
                
                // Save to notification history (via IndexedDB or cache)
                saveNotificationToHistory({
                    title: title,
                    body: body,
                    data: data,
                    receivedAt: new Date().toISOString(),
                    read: false
                });
            })
            .catch((error) => {
                console.error('[FCM-SW] Failed to show notification:', error);
            });
    });
}

// ==================== NOTIFICATION CLICK HANDLER ====================

self.addEventListener('notificationclick', (event) => {
    console.log('[FCM-SW] Notification clicked:', event.action);
    
    // Close the notification
    event.notification.close();
    
    // Get notification data
    const notificationData = event.notification.data || {};
    const urlToOpen = notificationData.url || '/';
    const eventId = notificationData.event_id;
    const rule = notificationData.rule;
    
    // Handle different actions
    if (event.action === 'dismiss') {
        // User dismissed notification
        console.log('[FCM-SW] Notification dismissed');
        return;
    }
    
    if (event.action === 'complete') {
        // User wants to mark event as complete
        console.log('[FCM-SW] Mark complete action triggered for event:', eventId);
        
        // Send message to client to handle completion
        event.waitUntil(
            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            }).then((clientList) => {
                for (const client of clientList) {
                    client.postMessage({
                        type: 'MARK_COMPLETE',
                        event_id: eventId
                    });
                    if ('focus' in client) {
                        client.focus();
                    }
                    return;
                }
                
                // No client open, open app and send message
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen).then((client) => {
                        if (client) {
                            // Wait for client to be ready
                            setTimeout(() => {
                                client.postMessage({
                                    type: 'MARK_COMPLETE',
                                    event_id: eventId
                                });
                            }, 1000);
                        }
                    });
                }
            })
        );
        return;
    }
    
    // Default action or 'view' - open the app
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((clientList) => {
            // Check if there's already a window open
            for (const client of clientList) {
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    client.focus();
                    
                    // Send message to client about the notification click
                    client.postMessage({
                        type: 'NOTIFICATION_CLICK',
                        event_id: eventId,
                        rule: rule,
                        url: urlToOpen,
                        timestamp: Date.now()
                    });
                    return;
                }
            }
            
            // No window open, open new one
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen).then((client) => {
                    if (client) {
                        // Send message once client is ready
                        setTimeout(() => {
                            client.postMessage({
                                type: 'NOTIFICATION_CLICK',
                                event_id: eventId,
                                rule: rule,
                                url: urlToOpen,
                                timestamp: Date.now()
                            });
                        }, 1000);
                    }
                });
            }
        })
    );
});

// ==================== NOTIFICATION CLOSE HANDLER ====================

self.addEventListener('notificationclose', (event) => {
    console.log('[FCM-SW] Notification closed');
    
    const notificationData = event.notification.data || {};
    const notificationId = notificationData.notificationId;
    
    // Could track notification dismissal analytics here
    // For example, send to server that user dismissed without action
});

// ==================== NOTIFICATION HISTORY (IndexedDB) ====================

// IndexedDB database name
const DB_NAME = 'webplanner-notifications';
const DB_VERSION = 1;
const STORE_NAME = 'notifications';

/**
 * Open IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            console.error('[FCM-SW] IndexedDB error:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                
                // Create indexes
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('read', 'read', { unique: false });
                store.createIndex('event_id', 'event_id', { unique: false });
                
                console.log('[FCM-SW] IndexedDB store created');
            }
        };
    });
}

/**
 * Save notification to history (IndexedDB)
 * @param {Object} notification - Notification data
 * @returns {Promise}
 */
async function saveNotificationToHistory(notification) {
    try {
        const db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const entry = {
            title: notification.title,
            body: notification.body,
            data: notification.data || {},
            receivedAt: notification.receivedAt || new Date().toISOString(),
            read: notification.read || false,
            timestamp: Date.now()
        };
        
        const request = store.add(entry);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                console.log('[FCM-SW] Notification saved to history');
                resolve(request.result);
            };
            request.onerror = () => {
                console.error('[FCM-SW] Failed to save notification:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('[FCM-SW] Save notification failed:', error);
        // Fallback: don't fail the notification display if history save fails
        return Promise.resolve();
    }
}

/**
 * Get all notifications from history
 * @returns {Promise<Array>}
 */
async function getNotificationHistory() {
    try {
        const db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        
        const request = store.getAll();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                resolve(request.result || []);
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('[FCM-SW] Get notification history failed:', error);
        return [];
    }
}

/**
 * Mark notification as read
 * @param {number} id - Notification ID
 * @returns {Promise}
 */
async function markNotificationAsRead(id) {
    try {
        const db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const getRequest = store.get(id);
        
        return new Promise((resolve, reject) => {
            getRequest.onsuccess = () => {
                const notification = getRequest.result;
                if (notification) {
                    notification.read = true;
                    const putRequest = store.put(notification);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve();
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    } catch (error) {
        console.error('[FCM-SW] Mark as read failed:', error);
        return Promise.reject(error);
    }
}

/**
 * Clear all notifications from history
 * @returns {Promise}
 */
async function clearNotificationHistory() {
    try {
        const db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const request = store.clear();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                console.log('[FCM-SW] Notification history cleared');
                resolve();
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('[FCM-SW] Clear history failed:', error);
        return Promise.reject(error);
    }
}

/**
 * Get unread notification count
 * @returns {Promise<number>}
 */
async function getUnreadCount() {
    try {
        const history = await getNotificationHistory();
        return history.filter(n => !n.read).length;
    } catch (error) {
        console.error('[FCM-SW] Get unread count failed:', error);
        return 0;
    }
}

// ==================== MESSAGE HANDLER (Client Communication) ====================

self.addEventListener('message', (event) => {
    console.log('[FCM-SW] Message received from client:', event.data);
    
    if (!event.data || !event.data.type) {
        return;
    }
    
    switch (event.data.type) {
        case 'GET_NOTIFICATION_HISTORY':
            // Return notification history to client
            event.waitUntil(
                getNotificationHistory().then((history) => {
                    event.ports[0].postMessage({
                        type: 'NOTIFICATION_HISTORY',
                        history: history
                    });
                })
            );
            break;
            
        case 'MARK_NOTIFICATION_READ':
            // Mark notification as read
            if (event.data.id) {
                event.waitUntil(
                    markNotificationAsRead(event.data.id).then(() => {
                        event.ports[0].postMessage({
                            type: 'NOTIFICATION_MARKED_READ',
                            id: event.data.id
                        });
                    })
                );
            }
            break;
            
        case 'CLEAR_NOTIFICATION_HISTORY':
            // Clear all notifications
            event.waitUntil(
                clearNotificationHistory().then(() => {
                    event.ports[0].postMessage({
                        type: 'NOTIFICATION_HISTORY_CLEARED'
                    });
                })
            );
            break;
            
        case 'GET_UNREAD_COUNT':
            // Return unread count
            event.waitUntil(
                getUnreadCount().then((count) => {
                    event.ports[0].postMessage({
                        type: 'UNREAD_COUNT',
                        count: count
                    });
                })
            );
            break;
            
        case 'SUBSCRIBE_TO_TOPIC':
            // Subscribe to FCM topic (must be done server-side usually)
            console.log('[FCM-SW] Topic subscription requested:', event.data.topic);
            break;
            
        case 'UNSUBSCRIBE_FROM_TOPIC':
            // Unsubscribe from FCM topic
            console.log('[FCM-SW] Topic unsubscription requested:', event.data.topic);
            break;
            
        case 'SKIP_WAITING':
            // Force service worker activation
            self.skipWaiting();
            break;
            
        default:
            console.warn('[FCM-SW] Unknown message type:', event.data.type);
    }
});

// ==================== PUSH SUBSCRIPTION CHANGE ====================

self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[FCM-SW] Push subscription changed');
    
    event.waitUntil(
        // Re-subscribe with same options
        self.registration.pushManager.subscribe(event.oldSubscription.options)
            .then((newSubscription) => {
                console.log('[FCM-SW] Re-subscribed successfully');
                
                // Send new subscription to server
                return fetch('/php/save-subscription.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        token: newSubscription.endpoint,
                        keys: newSubscription.keys
                    })
                });
            })
            .then((response) => {
                if (response.ok) {
                    console.log('[FCM-SW] Subscription updated on server');
                } else {
                    console.error('[FCM-SW] Failed to update subscription on server');
                }
            })
            .catch((error) => {
                console.error('[FCM-SW] Push subscription change failed:', error);
            })
    );
});

// ==================== INSTALL & ACTIVATE EVENTS ====================

self.addEventListener('install', (event) => {
    console.log('[FCM-SW] Installing Firebase Messaging Service Worker');
    // Skip waiting to activate immediately
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[FCM-SW] Activating Firebase Messaging Service Worker');
    // Claim all clients immediately
    event.waitUntil(self.clients.claim());
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Get current push subscription
 * @returns {Promise<PushSubscription|null>}
 */
export async function getPushSubscription() {
    const registration = await self.registration;
    return registration.pushManager.getSubscription();
}

/**
 * Check if push is supported
 * @returns {boolean}
 */
export function isPushSupported() {
    return 'PushManager' in window && 'serviceWorker' in navigator;
}

/**
 * Get notification permission status
 * @returns {string}
 */
export function getNotificationPermission() {
    if (!('Notification' in window)) {
        return 'denied';
    }
    return Notification.permission;
}

/**
 * Request notification permission
 * @returns {Promise<string>}
 */
export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        return 'denied';
    }
    return Notification.requestPermission();
}

// Log service worker load
console.log('[FCM-SW] Firebase Messaging Service Worker loaded');