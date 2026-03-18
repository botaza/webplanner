// js/fcm-client.js - WebPlanner Firebase Cloud Messaging Client
// PATCHED: Proper token management, notification permission handling, and subscription saving

import { state } from './state.js';
import { saveSubscription } from './api.js';
import { saveNotificationHistory } from './notification-history.js';

// Firebase Messaging instance (initialized when Firebase SDK loads)
let messaging = null;

/**
 * Initialize Firebase Cloud Messaging
 * Sets up notification permissions and token registration
 */
export async function initFCM() {
    try {
        // Check if Firebase is loaded
        if (typeof firebase === 'undefined') {
            console.warn('Firebase SDK not loaded. Push notifications disabled.');
            updateNotificationStatus('disabled', 'Firebase not loaded');
            return;
        }
        
        // Initialize messaging
        messaging = firebase.messaging();
        
        // Check if service worker is available
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker not supported. Push notifications disabled.');
            updateNotificationStatus('disabled', 'Service Worker not supported');
            return;
        }
        
        // Request notification permission
        const permission = await requestNotificationPermission();
        
        if (permission === 'granted') {
            // Get FCM token
            const token = await getFCMToken();
            if (token) {
                state.notifications.enabled = true;
                state.notifications.token = token;
                state.notifications.permission = 'granted';
                
                // Save token to server
                await saveTokenToServer(token);
                
                updateNotificationStatus('enabled', 'Notifications enabled');
                console.log('FCM initialized successfully. Token:', token);
            } else {
                updateNotificationStatus('disabled', 'Failed to get token');
            }
        } else if (permission === 'denied') {
            state.notifications.permission = 'denied';
            updateNotificationStatus('disabled', 'Permission denied');
        } else {
            state.notifications.permission = 'default';
            updateNotificationStatus('pending', 'Permission pending');
        }
        
        // Set up foreground message handler
        setupForegroundMessageHandler();
        
    } catch (error) {
        console.error('FCM initialization failed:', error);
        updateNotificationStatus('disabled', 'Initialization failed');
    }
}

/**
 * Request notification permission from user
 * @returns {Promise<string>} - 'granted', 'denied', or 'default'
 */
async function requestNotificationPermission() {
    try {
        if (!('Notification' in window)) {
            console.warn('Notifications not supported in this browser');
            return 'denied';
        }
        
        const permission = await Notification.requestPermission();
        return permission;
    } catch (error) {
        console.error('Permission request failed:', error);
        return 'denied';
    }
}

/**
 * Get FCM token for push notifications
 * @returns {Promise<string|null>}
 */
async function getFCMToken() {
    try {
        if (!messaging) {
            console.warn('Messaging not initialized');
            return null;
        }
        
        // Get registration token
        const token = await messaging.getToken({
            vapidKey: 'YOUR_VAPID_KEY' // ✅ Replace with your Firebase VAPID key
        });
        
        return token;
    } catch (error) {
        console.error('Failed to get FCM token:', error);
        return null;
    }
}

/**
 * Save FCM token to server for push notification delivery
 * @param {string} token - FCM token
 */
async function saveTokenToServer(token) {
    try {
        const result = await saveSubscription(token);
        if (result.success) {
            console.log('Token saved to server successfully');
        } else {
            console.warn('Token save failed:', result.error);
        }
    } catch (error) {
        console.error('Token save error:', error);
    }
}

/**
 * Set up handler for foreground messages (when app is open)
 */
function setupForegroundMessageHandler() {
    if (!messaging) return;
    
    messaging.onMessage((payload) => {
        console.log('Foreground message received:', payload);
        
        const notification = payload.notification;
        if (notification) {
            // Show in-app notification
            showInAppNotification(notification);
            
            // Save to notification history
            saveNotificationHistory({
                title: notification.title,
                body: notification.body,
                data: payload.data || {},
                receivedAt: new Date().toISOString()
            });
            
            // Refresh relevant screens
            refreshScreensOnNotification(payload.data);
        }
    });
}

/**
 * Show in-app notification banner
 * @param {Object} notification - Notification payload
 */
function showInAppNotification(notification) {
    // Create notification banner
    const banner = document.createElement('div');
    banner.className = 'fixed top-4 left-4 right-4 max-w-xl mx-auto bg-zinc-800 border border-zinc-700 rounded-2xl p-4 shadow-lg z-50 animate-slide-down';
    banner.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="text-2xl">🔔</div>
            <div class="flex-1 min-w-0">
                <div class="font-medium text-zinc-200">${escapeHtml(notification.title)}</div>
                <div class="text-sm text-zinc-400 mt-1">${escapeHtml(notification.body)}</div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="text-zinc-500 hover:text-zinc-300 text-xl">&times;</button>
        </div>
    `;
    
    document.body.appendChild(banner);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (banner.parentElement) {
            banner.remove();
        }
    }, 5000);
}

/**
 * Refresh screens when notification is received
 * @param {Object} data - Notification data payload
 */
function refreshScreensOnNotification(data) {
    // Parse event ID from notification data
    const eventId = data?.event_id;
    
    if (eventId && window.loadPlanner) {
        // Refresh planner to show updated event state
        window.loadPlanner();
    }
    
    if (window.loadDashboard) {
        // Refresh dashboard stats
        window.loadDashboard();
    }
}

/**
 * Enable notifications (called from UI button)
 */
export async function enableNotifications() {
    const btn = document.getElementById('notif-enable-btn');
    if (btn) {
        btn.textContent = 'Enabling...';
        btn.disabled = true;
    }
    
    try {
        // Request permission
        const permission = await requestNotificationPermission();
        
        if (permission === 'granted') {
            // Get and save token
            const token = await getFCMToken();
            if (token) {
                await saveTokenToServer(token);
                state.notifications.enabled = true;
                state.notifications.token = token;
                state.notifications.permission = 'granted';
                
                updateNotificationStatus('enabled', 'Notifications enabled');
                
                if (btn) {
                    btn.textContent = 'Enabled ✓';
                    btn.classList.add('bg-emerald-600');
                    btn.classList.remove('bg-zinc-800');
                }
                
                alert('Push notifications enabled! You will receive reminders for upcoming events.');
            } else {
                throw new Error('Failed to get token');
            }
        } else if (permission === 'denied') {
            updateNotificationStatus('disabled', 'Permission denied');
            
            if (btn) {
                btn.textContent = 'Denied ✗';
                btn.classList.add('bg-red-600');
                btn.classList.remove('bg-zinc-800');
            }
            
            alert('Notification permission denied. You can enable it in browser settings.');
        } else {
            updateNotificationStatus('pending', 'Permission pending');
            
            if (btn) {
                btn.textContent = 'Pending...';
            }
        }
    } catch (error) {
        console.error('Enable notifications failed:', error);
        updateNotificationStatus('disabled', 'Failed to enable');
        
        if (btn) {
            btn.textContent = 'Enable';
            btn.disabled = false;
        }
        
        alert('Failed to enable notifications: ' + error.message);
    }
}

/**
 * Disable notifications (revoke token)
 */
export async function disableNotifications() {
    try {
        if (messaging && state.notifications.token) {
            // Delete token from Firebase
            await messaging.deleteToken();
        }
        
        // Clear local state
        state.notifications.enabled = false;
        state.notifications.token = null;
        state.notifications.permission = 'default';
        
        updateNotificationStatus('disabled', 'Notifications disabled');
        
        const btn = document.getElementById('notif-enable-btn');
        if (btn) {
            btn.textContent = 'Enable';
            btn.classList.remove('bg-emerald-600', 'bg-red-600');
            btn.classList.add('bg-zinc-800');
            btn.disabled = false;
        }
        
        console.log('Notifications disabled');
    } catch (error) {
        console.error('Disable notifications failed:', error);
    }
}

/**
 * Update notification status UI
 * @param {string} status - 'enabled', 'disabled', or 'pending'
 * @param {string} message - Status message
 */
function updateNotificationStatus(status, message) {
    const statusEl = document.getElementById('notif-status');
    const btn = document.getElementById('notif-enable-btn');
    
    if (statusEl) {
        statusEl.className = `notif-status ${status}`;
        statusEl.textContent = message;
    }
    
    if (btn) {
        switch (status) {
            case 'enabled':
                btn.textContent = 'Enabled ✓';
                btn.classList.add('bg-emerald-600');
                btn.classList.remove('bg-zinc-800', 'bg-red-600');
                break;
            case 'disabled':
                btn.textContent = 'Enable';
                btn.classList.add('bg-zinc-800');
                btn.classList.remove('bg-emerald-600', 'bg-red-600');
                break;
            case 'pending':
                btn.textContent = 'Pending...';
                btn.classList.add('bg-zinc-800');
                btn.classList.remove('bg-emerald-600', 'bg-red-600');
                break;
        }
    }
}

/**
 * Get current notification permission status
 * @returns {string} - 'granted', 'denied', or 'default'
 */
export function getNotificationPermission() {
    if (!('Notification' in window)) {
        return 'denied';
    }
    return Notification.permission;
}

/**
 * Check if notifications are supported
 * @returns {boolean}
 */
export function isNotificationSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Refresh notification status UI
 */
export async function refreshNotificationStatus() {
    const permission = getNotificationPermission();
    const btn = document.getElementById('notif-enable-btn');
    
    if (permission === 'granted' && state.notifications.enabled) {
        updateNotificationStatus('enabled', 'Notifications enabled');
    } else if (permission === 'denied') {
        updateNotificationStatus('disabled', 'Permission denied in browser');
    } else {
        updateNotificationStatus('pending', 'Click Enable to allow notifications');
    }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Handle background messages (via service worker)
 * This is called when the app is closed or in background
 * Note: Actual handling is in firebase-messaging-sw.js
 */
export function handleBackgroundMessage() {
    // Service worker handles background messages
    // This function is here for documentation purposes
    console.log('Background messages handled by firebase-messaging-sw.js');
}

/**
 * Subscribe to topic (for group notifications)
 * @param {string} topic - Topic name
 */
export async function subscribeToTopic(topic) {
    try {
        if (!messaging || !state.notifications.token) {
            console.warn('Cannot subscribe: messaging or token not available');
            return false;
        }
        
        // Note: Topic subscription must be done server-side with FCM Admin SDK
        // This is a placeholder for future implementation
        console.log('Topic subscription requested:', topic);
        return true;
    } catch (error) {
        console.error('Topic subscription failed:', error);
        return false;
    }
}

/**
 * Unsubscribe from topic
 * @param {string} topic - Topic name
 */
export async function unsubscribeFromTopic(topic) {
    try {
        // Note: Topic unsubscription must be done server-side with FCM Admin SDK
        console.log('Topic unsubscription requested:', topic);
        return true;
    } catch (error) {
        console.error('Topic unsubscription failed:', error);
        return false;
    }
}

/**
 * Get notification settings for UI
 * @returns {Object}
 */
export function getNotificationSettings() {
    return {
        enabled: state.notifications.enabled,
        permission: state.notifications.permission,
        token: state.notifications.token,
        supported: isNotificationSupported()
    };
}

// ✅ PATCH: Expose functions to window for inline HTML onclick handlers
Object.assign(window, {
    enableNotifications,
    disableNotifications,
    refreshNotificationStatus,
    getNotificationPermission,
    isNotificationSupported,
    getNotificationSettings
});

// Export default for module imports
export default {
    initFCM,
    enableNotifications,
    disableNotifications,
    refreshNotificationStatus,
    getNotificationPermission,
    isNotificationSupported,
    getNotificationSettings,
    subscribeToTopic,
    unsubscribeFromTopic
};