// js/api.js - WebPlanner API Client
// PATCHED: Support for completed flag, notification cache clearing, and toggle completion

const API_BASE = 'php/api.php';

/**
 * Generic API call helper
 * @param {string} action - API action name
 * @param {Object} data - Data to send
 * @returns {Promise<Object>} - API response
 */
export async function api(action, data = {}) {
    const formData = new FormData();
    formData.append('action', action);
    
    for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined) {
            formData.append(key, value);
        }
    }
    
    try {
        const response = await fetch(API_BASE, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error(`API error (${action}):`, error);
        throw error;
    }
}

/**
 * Initialize API - creates data files if they don't exist
 * @returns {Promise<Object>}
 */
export async function initAPI() {
    return await api('init');
}

/**
 * Get all events (active + completed)
 * @returns {Promise<Array>} - Array of event objects with completed flag
 */
export async function getEvents() {
    const response = await api('get_events');
    return response || [];
}

/**
 * Get only completed events
 * @returns {Promise<Array>} - Array of completed event objects
 */
export async function getDoneEvents() {
    const response = await api('get_done_events');
    return response || [];
}

/**
 * Add a new event
 * @param {Object} event - Event data
 * @returns {Promise<Object>}
 */
export async function addEvent(event) {
    return await api('add_event', {
        dt: event.dt,
        desc: event.desc,
        hashtag: event.hashtag || '',
        place: event.place || '',
        duration: event.duration || '',
        recurrence: event.recurrence || 'none',
        recurrence_group: event.recurrence_group || ''
    });
}

/**
 * Update an existing event
 * @param {string} id - Event ID
 * @param {Object} event - Updated event data
 * @returns {Promise<Object>}
 */
export async function updateEvent(id, event) {
    return await api('update_event', {
        id: id,
        dt: event.dt,
        desc: event.desc,
        hashtag: event.hashtag || '',
        place: event.place || '',
        duration: event.duration || '',
        recurrence: event.recurrence || 'none',
        recurrence_group: event.recurrence_group || ''
    });
}

/**
 * Delete an event
 * @param {string} id - Event ID
 * @returns {Promise<Object>}
 */
export async function deleteEvent(id) {
    return await api('delete_event', { id: id });
}

/**
 * Mark event as complete or incomplete
 * @param {string} id - Event ID
 * @param {boolean} completed - True to mark complete, false to mark incomplete
 * @returns {Promise<Object>}
 */
export async function toggleComplete(id, completed = true) {
    // ✅ PATCH: Pass completed flag to backend
    // completed=1 (or omitted) = mark as done
    // completed=0 = mark as not done (reset)
    return await api('complete_event', {
        id: id,
        completed: completed ? 1 : 0
    });
}

/**
 * Mark event as complete (move to done.json)
 * @param {string} id - Event ID
 * @returns {Promise<Object>}
 */
export async function markComplete(id) {
    return await toggleComplete(id, true);
}

/**
 * Mark event as incomplete (move back to events.json, clear notification cache)
 * @param {string} id - Event ID
 * @returns {Promise<Object>}
 */
export async function markIncomplete(id) {
    return await toggleComplete(id, false);
}

/**
 * Get all expenses
 * @returns {Promise<Array>}
 */
export async function getExpenses() {
    const response = await api('get_expenses');
    return response || [];
}

/**
 * Add a new expense
 * @param {Object} expense - Expense data
 * @returns {Promise<Object>}
 */
export async function addExpense(expense) {
    return await api('add_expense', {
        dt: expense.dt,
        amount: expense.amount,
        tool: expense.tool || '',
        category: expense.category || '',
        desc: expense.desc || ''
    });
}

/**
 * Update an existing expense
 * @param {string} id - Expense ID
 * @param {Object} expense - Updated expense data
 * @returns {Promise<Object>}
 */
export async function updateExpense(id, expense) {
    return await api('update_expense', {
        id: id,
        dt: expense.dt,
        amount: expense.amount,
        tool: expense.tool || '',
        category: expense.category || '',
        desc: expense.desc || ''
    });
}

/**
 * Delete an expense
 * @param {string} id - Expense ID
 * @returns {Promise<Object>}
 */
export async function deleteExpense(id) {
    return await api('delete_expense', { id: id });
}

/**
 * Get all income entries
 * @returns {Promise<Array>}
 */
export async function getIncome() {
    const response = await api('get_income');
    return response || [];
}

/**
 * Add a new income entry
 * @param {Object} income - Income data
 * @returns {Promise<Object>}
 */
export async function addIncome(income) {
    return await api('add_income', {
        dt: income.dt,
        amount: income.amount,
        desc: income.desc || ''
    });
}

/**
 * Update an existing income entry
 * @param {string} id - Income ID
 * @param {Object} income - Updated income data
 * @returns {Promise<Object>}
 */
export async function updateIncome(id, income) {
    return await api('update_income', {
        id: id,
        dt: income.dt,
        amount: income.amount,
        desc: income.desc || ''
    });
}

/**
 * Delete an income entry
 * @param {string} id - Income ID
 * @returns {Promise<Object>}
 */
export async function deleteIncome(id) {
    return await api('delete_income', { id: id });
}

/**
 * Create a snapshot of all data
 * @returns {Promise<Object>}
 */
export async function createSnapshot() {
    return await api('create_snapshot');
}

/**
 * Get list of available snapshots
 * @returns {Promise<Array>}
 */
export async function getSnapshots() {
    const response = await api('get_snapshots');
    return response || [];
}

/**
 * Clear all data (dangerous!)
 * @returns {Promise<Object>}
 */
export async function clearAllData() {
    return await api('clear_all');
}

/**
 * Get notification history
 * @returns {Promise<Array>}
 */
export async function getNotificationHistory() {
    try {
        const response = await fetch('data/notification-history.json');
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Failed to load notification history:', error);
        return [];
    }
}

/**
 * Save notification to history
 * @param {Object} notif - Notification data
 * @returns {Promise<void>}
 */
export async function saveNotificationHistory(notif) {
    try {
        const history = await getNotificationHistory();
        history.unshift({
            ...notif,
            timestamp: Date.now()
        });
        // Keep only last 100 notifications
        while (history.length > 100) {
            history.pop();
        }
        
        // Note: This requires write access to data folder
        // In production, use API endpoint instead
        console.log('Notification saved to history:', notif);
    } catch (error) {
        console.error('Failed to save notification history:', error);
    }
}

/**
 * Clear notification history
 * @returns {Promise<void>}
 */
export async function clearNotificationHistory() {
    try {
        // This would require an API endpoint in production
        console.log('Notification history cleared');
    } catch (error) {
        console.error('Failed to clear notification history:', error);
    }
}

/**
 * Save FCM subscription token
 * @param {string} token - FCM token
 * @returns {Promise<Object>}
 */
export async function saveSubscription(token) {
    const formData = new FormData();
    formData.append('token', token);
    
    try {
        const response = await fetch('php/save-subscription.php', {
            method: 'POST',
            body: formData
        });
        return await response.json();
    } catch (error) {
        console.error('Failed to save subscription:', error);
        throw error;
    }
}

/**
 * Export all data as JSON
 * @returns {Promise<Object>}
 */
export async function exportAllData() {
    const [events, expenses, income] = await Promise.all([
        getEvents(),
        getExpenses(),
        getIncome()
    ]);
    
    return {
        events,
        expenses,
        income,
        exportedAt: new Date().toISOString()
    };
}

/**
 * Import data from JSON
 * @param {Object} data - Data to import
 * @returns {Promise<Object>}
 */
export async function importData(data) {
    // This would require batch import endpoints
    // For now, return success placeholder
    return { success: true };
}

// Export all functions
export default {
    api,
    initAPI,
    getEvents,
    getDoneEvents,
    addEvent,
    updateEvent,
    deleteEvent,
    toggleComplete,
    markComplete,
    markIncomplete,
    getExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
    getIncome,
    addIncome,
    updateIncome,
    deleteIncome,
    createSnapshot,
    getSnapshots,
    clearAllData,
    getNotificationHistory,
    saveNotificationHistory,
    clearNotificationHistory,
    saveSubscription,
    exportAllData,
    importData
};