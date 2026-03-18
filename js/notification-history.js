// js/notification-history.js - WebPlanner Notification History Management
// PATCHED: Local storage persistence, proper cleanup, and UI rendering

import { state } from './state.js';
import { api } from './api.js';

// Local storage key for notification history
const NOTIFICATION_HISTORY_KEY = 'webplanner_notification_history';

// Maximum number of notifications to store
const MAX_HISTORY_ITEMS = 100;

/**
 * Load notification history from local storage
 * @returns {Array<Object>}
 */
export function loadNotificationHistory() {
    try {
        const stored = localStorage.getItem(NOTIFICATION_HISTORY_KEY);
        if (stored) {
            const history = JSON.parse(stored);
            state.notificationHistory = Array.isArray(history) ? history : [];
        } else {
            state.notificationHistory = [];
        }
        return state.notificationHistory;
    } catch (error) {
        console.error('Failed to load notification history:', error);
        state.notificationHistory = [];
        return [];
    }
}

/**
 * Save notification history to local storage
 */
function saveNotificationHistory() {
    try {
        // Keep only last MAX_HISTORY_ITEMS
        while (state.notificationHistory.length > MAX_HISTORY_ITEMS) {
            state.notificationHistory.pop();
        }
        localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(state.notificationHistory));
    } catch (error) {
        console.error('Failed to save notification history:', error);
    }
}

/**
 * Add a notification to history
 * @param {Object} notification - Notification data
 */
export function addNotificationToHistory(notification) {
    const entry = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        title: notification.title || 'Notification',
        body: notification.body || '',
        data: notification.data || {},
        receivedAt: notification.receivedAt || new Date().toISOString(),
        read: false,
        eventId: notification.data?.event_id || null,
        rule: notification.data?.rule || 'unknown'
    };
    
    state.notificationHistory.unshift(entry);
    saveNotificationHistory();
    
    return entry;
}

/**
 * Save notification to history (alias for addNotificationToHistory)
 * @param {Object} notif - Notification data
 */
export function saveNotificationHistory(notif) {
    return addNotificationToHistory(notif);
}

/**
 * Mark a notification as read
 * @param {string} id - Notification ID
 */
export function markNotificationAsRead(id) {
    const notification = state.notificationHistory.find(n => n.id === id);
    if (notification) {
        notification.read = true;
        saveNotificationHistory();
    }
}

/**
 * Mark all notifications as read
 */
export function markAllNotificationsAsRead() {
    state.notificationHistory.forEach(n => {
        n.read = true;
    });
    saveNotificationHistory();
}

/**
 * Delete a single notification from history
 * @param {string} id - Notification ID
 */
export function deleteNotification(id) {
    state.notificationHistory = state.notificationHistory.filter(n => n.id !== id);
    saveNotificationHistory();
}

/**
 * Clear all notification history
 */
export function clearNotificationHistory() {
    if (!confirm('Clear all notification history? This cannot be undone.')) {
        return;
    }
    
    state.notificationHistory = [];
    localStorage.removeItem(NOTIFICATION_HISTORY_KEY);
    
    // Re-render the history list
    renderNotificationHistory();
    
    console.log('Notification history cleared');
}

/**
 * Render notification history list in the UI
 */
export function renderNotificationHistory() {
    const container = document.getElementById('notification-history-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!state.notificationHistory || !state.notificationHistory.length) {
        container.innerHTML = `
            <div class="text-center text-zinc-500 py-8">
                <div class="text-4xl mb-2">🔔</div>
                <p>No notifications yet</p>
                <p class="text-sm mt-1">Enable notifications to receive event reminders</p>
            </div>
        `;
        return;
    }
    
    // Group by date
    const grouped = {};
    state.notificationHistory.forEach(notif => {
        const date = notif.receivedAt.slice(0, 10);
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(notif);
    });
    
    // Sort dates descending
    Object.keys(grouped).sort().reverse().forEach(date => {
        const notifications = grouped[date];
        
        // Date header
        const dateHeader = document.createElement('div');
        dateHeader.className = 'text-xs text-zinc-500 uppercase tracking-wider px-2 py-2 mt-3 mb-1';
        
        const dateObj = new Date(date + 'T00:00:00');
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        
        let dateLabel = dateObj.toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        });
        
        if (date === today) {
            dateLabel = 'Today';
        } else if (date === yesterday) {
            dateLabel = 'Yesterday';
        }
        
        dateHeader.textContent = dateLabel;
        container.appendChild(dateHeader);
        
        // Notification items
        notifications.forEach(notif => {
            const item = document.createElement('div');
            item.className = `notif-item ${notif.read ? 'opacity-60' : ''} cursor-pointer hover:bg-zinc-800/50 transition-colors`;
            
            const timeObj = new Date(notif.receivedAt);
            const timeStr = timeObj.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            // Determine icon based on rule type
            let icon = '🔔';
            switch (notif.rule) {
                case 'rule1_1hour':
                    icon = '⏰';
                    break;
                case 'rule2_morning':
                    icon = '🌅';
                    break;
                case 'rule3_evening':
                    icon = '🌆';
                    break;
                case 'rule4_today':
                    icon = '📅';
                    break;
                case 'rule5_tomorrow':
                    icon = '📆';
                    break;
                case 'rule6_weekly':
                    icon = '📊';
                    break;
            }
            
            item.innerHTML = `
                <div class="flex items-start gap-3 p-3">
                    <div class="text-xl">${icon}</div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2">
                            <div class="font-medium text-zinc-200 text-sm truncate">${escapeHtml(notif.title)}</div>
                            <div class="text-xs text-zinc-500 shrink-0">${timeStr}</div>
                        </div>
                        <div class="text-xs text-zinc-400 mt-1 line-clamp-2">${escapeHtml(notif.body)}</div>
                        ${notif.data?.event_desc ? `
                            <div class="text-[10px] text-zinc-500 mt-1 bg-zinc-800/50 px-2 py-1 rounded">
                                Event: ${escapeHtml(notif.data.event_desc)}
                            </div>
                        ` : ''}
                    </div>
                    <button onclick="deleteNotification('${notif.id}')" 
                            class="text-zinc-500 hover:text-red-400 transition-colors text-sm p-1"
                            title="Delete notification">
                        &times;
                    </button>
                </div>
            `;
            
            // Click to mark as read and optionally navigate to event
            item.onclick = (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    markNotificationAsRead(notif.id);
                    item.classList.add('opacity-60');
                    
                    // If there's an event ID, offer to navigate
                    if (notif.eventId && window.switchScreen) {
                        if (confirm('View this event in planner?')) {
                            window.switchScreen('screen-planner');
                            // Could scroll to specific event here
                        }
                    }
                }
            };
            
            container.appendChild(item);
        });
    });
    
    // Add clear all button if there are notifications
    if (state.notificationHistory.length > 0) {
        const clearBtn = document.createElement('button');
        clearBtn.className = 'w-full text-center text-xs text-red-400 hover:text-red-300 py-3 mt-2 border-t border-zinc-800';
        clearBtn.textContent = 'Clear all history';
        clearBtn.onclick = clearNotificationHistory;
        container.appendChild(clearBtn);
    }
}

/**
 * Load notification history and render (called from notifications screen)
 */
export async function loadNotificationHistory() {
    loadNotificationHistory();
    renderNotificationHistory();
    
    // Update status button
    const btn = document.getElementById('notif-enable-btn');
    if (btn && window.getNotificationSettings) {
        const settings = window.getNotificationSettings();
        if (settings.enabled) {
            btn.textContent = 'Enabled ✓';
            btn.classList.add('bg-emerald-600');
            btn.classList.remove('bg-zinc-800');
        } else if (settings.permission === 'denied') {
            btn.textContent = 'Denied ✗';
            btn.classList.add('bg-red-600');
            btn.classList.remove('bg-zinc-800');
        } else {
            btn.textContent = 'Enable';
            btn.classList.add('bg-zinc-800');
            btn.classList.remove('bg-emerald-600', 'bg-red-600');
        }
    }
}

/**
 * Get unread notification count
 * @returns {number}
 */
export function getUnreadNotificationCount() {
    return state.notificationHistory.filter(n => !n.read).length;
}

/**
 * Get notifications for a specific event
 * @param {string} eventId - Event ID
 * @returns {Array<Object>}
 */
export function getNotificationsForEvent(eventId) {
    return state.notificationHistory.filter(n => n.eventId === eventId);
}

/**
 * Get notifications by rule type
 * @param {string} rule - Rule identifier
 * @returns {Array<Object>}
 */
export function getNotificationsByRule(rule) {
    return state.notificationHistory.filter(n => n.rule === rule);
}

/**
 * Get notification statistics
 * @returns {Object}
 */
export function getNotificationStats() {
    const total = state.notificationHistory.length;
    const unread = getUnreadNotificationCount();
    const read = total - unread;
    
    // Count by rule type
    const byRule = {};
    state.notificationHistory.forEach(n => {
        byRule[n.rule] = (byRule[n.rule] || 0) + 1;
    });
    
    return {
        total,
        unread,
        read,
        byRule
    };
}

/**
 * Export notification history as JSON
 * @returns {string}
 */
export function exportNotificationHistory() {
    return JSON.stringify(state.notificationHistory, null, 2);
}

/**
 * Import notification history from JSON
 * @param {string} json - JSON string
 */
export function importNotificationHistory(json) {
    try {
        const history = JSON.parse(json);
        if (Array.isArray(history)) {
            state.notificationHistory = history;
            saveNotificationHistory();
            renderNotificationHistory();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Import notification history failed:', error);
        return false;
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
 * Show notification history modal
 */
export function showNotificationHistoryModal() {
    const modal = document.getElementById('modal-notif-history');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        loadNotificationHistory();
    }
}

/**
 * Hide notification history modal
 */
export function hideNotificationHistoryModal() {
    const modal = document.getElementById('modal-notif-history');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// ✅ PATCH: Expose functions to window for inline HTML onclick handlers
Object.assign(window, {
    loadNotificationHistory,
    clearNotificationHistory,
    deleteNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    showNotificationHistoryModal,
    hideNotificationHistoryModal,
    renderNotificationHistory,
    getUnreadNotificationCount,
    getNotificationStats,
    exportNotificationHistory,
    importNotificationHistory
});

// Export default for module imports
export default {
    loadNotificationHistory,
    saveNotificationHistory,
    addNotificationToHistory,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    clearNotificationHistory,
    renderNotificationHistory,
    getUnreadNotificationCount,
    getNotificationsForEvent,
    getNotificationsByRule,
    getNotificationStats,
    exportNotificationHistory,
    importNotificationHistory,
    showNotificationHistoryModal,
    hideNotificationHistoryModal
};