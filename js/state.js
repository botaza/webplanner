// js/state.js - WebPlanner Global State Management
// PATCHED: Structure supports 'completed' flag on events

/**
 * Global application state container
 * This object holds all reactive data used across the application.
 * Modules import this state to read/write data without passing props everywhere.
 */
export const state = {
    /**
     * @type {Array<Object>} - All events (active + completed)
     * Each event object structure:
     * {
     *   id: string,
     *   dt: string (YYYY-MM-DD HH:mm:ss),
     *   desc: string,
     *   hashtag: string,
     *   place: string,
     *   duration: string,
     *   recurrence: string,
     *   recurrence_group: string,
     *   completed: boolean  // ✅ NEW: Tracks completion status
     * }
     */
    eventsData: [],

    /**
     * @type {Array<Object>} - All expense entries
     * Each expense object structure:
     * {
     *   id: string,
     *   dt: string (YYYY-MM-DD),
     *   amount: number,
     *   tool: string,
     *   category: string,
     *   desc: string
     * }
     */
    expensesData: [],

    /**
     * @type {Array<Object>} - All income entries
     * Each income object structure:
     * {
     *   id: string,
     *   dt: string (YYYY-MM-DD),
     *   amount: number,
     *   desc: string
     * }
     */
    incomeData: [],

    /**
     * @type {Array<Object>} - Notification history (client-side cache)
     */
    notificationHistory: [],

    /**
     * @type {Object} - UI Filter State
     */
    filters: {
        hashtag: null,      // Currently selected hashtag filter
        place: null,        // Currently selected place filter
        duration: null,     // Currently selected duration filter
        showCompleted: true // ✅ NEW: Whether to show completed events (default true)
    },

    /**
     * @type {Object} - UI Modal State
     */
    ui: {
        isModalOpen: false,
        activeModalId: null,
        editingEventId: null // ID of event currently being edited
    },

    /**
     * @type {Object} - FCM / Notification State
     */
    notifications: {
        enabled: false,
        token: null,
        permission: 'default' // 'default', 'granted', 'denied'
    },

    /**
     * @type {Object} - Lockscreen State
     */
    lockscreen: {
        enabled: false,
        unlocked: false
    }
};

/**
 * Reset state to initial values (used for testing or hard reset)
 */
export function resetState() {
    state.eventsData = [];
    state.expensesData = [];
    state.incomeData = [];
    state.notificationHistory = [];
    state.filters = {
        hashtag: null,
        place: null,
        duration: null,
        showCompleted: true
    };
    state.ui = {
        isModalOpen: false,
        activeModalId: null,
        editingEventId: null
    };
    state.notifications = {
        enabled: false,
        token: null,
        permission: 'default'
    };
    state.lockscreen = {
        enabled: false,
        unlocked: false
    };
    console.log('State reset to initial values');
}

/**
 * Helper to update state and trigger re-renders if needed
 * Note: In this vanilla JS version, re-renders are manual (called after state changes)
 * @param {string} key - State key to update
 * @param {any} value - New value
 */
export function updateState(key, value) {
    if (key in state) {
        state[key] = value;
        console.log(`State updated: ${key}`, value);
    } else {
        console.warn(`Attempted to update unknown state key: ${key}`);
    }
}

/**
 * Helper to update nested state properties
 * @param {string} category - Top-level category (e.g., 'filters', 'ui')
 * @param {string} key - Property key within category
 * @param {any} value - New value
 */
export function updateNestedState(category, key, value) {
    if (state[category] && typeof state[category] === 'object') {
        state[category][key] = value;
        console.log(`State updated: ${category}.${key}`, value);
    } else {
        console.warn(`Attempted to update unknown nested state: ${category}.${key}`);
    }
}

/**
 * Get event by ID from state
 * @param {string} id - Event ID
 * @returns {Object|undefined}
 */
export function getEventById(id) {
    return state.eventsData.find(e => e.id == id);
}

/**
 * Get expense by ID from state
 * @param {string} id - Expense ID
 * @returns {Object|undefined}
 */
export function getExpenseById(id) {
    return state.expensesData.find(e => e.id == id);
}

/**
 * Get income by ID from state
 * @param {string} id - Income ID
 * @returns {Object|undefined}
 */
export function getIncomeById(id) {
    return state.incomeData.find(e => e.id == id);
}

/**
 * Check if user is filtering by a specific hashtag
 * @returns {boolean}
 */
export function isHashtagFiltered() {
    return state.filters.hashtag !== null && state.filters.hashtag !== '';
}

/**
 * Check if completed events should be shown
 * @returns {boolean}
 */
export function shouldShowCompleted() {
    return state.filters.showCompleted === true;
}

// Export default for convenience
export default {
    state,
    resetState,
    updateState,
    updateNestedState,
    getEventById,
    getExpenseById,
    getIncomeById,
    isHashtagFiltered,
    shouldShowCompleted
};