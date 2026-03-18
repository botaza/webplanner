// js/date-utils.js

/**
 * Format a date object to a readable string
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string (e.g., "Jan 15, 2024 14:30")
 */
export function formatDate(date) {
    if (!date || !(date instanceof Date) || isNaN(date)) {
        return 'Invalid date';
    }
    
    const options = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    return date.toLocaleDateString('en-US', options);
}

/**
 * Format a date to YYYY-MM-DD for input fields
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string (YYYY-MM-DD)
 */
export function formatDateInput(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Format a date to YYYY-MM-DDTHH:MM for datetime-local input
 * @param {Date} date - The date to format
 * @returns {string} Formatted datetime string
 */
export function formatDateTimeInput(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Get the start of a month
 * @param {number} year - The year
 * @param {number} month - The month (0-11)
 * @returns {Date} Date object set to the first day of the month at 00:00:00
 */
export function getMonthStart(year, month) {
    return new Date(year, month, 1, 0, 0, 0, 0);
}

/**
 * Get the end of a month
 * @param {number} year - The year
 * @param {number} month - The month (0-11)
 * @returns {Date} Date object set to the last day of the month at 23:59:59
 */
export function getMonthEnd(year, month) {
    return new Date(year, month + 1, 0, 23, 59, 59, 999);
}

/**
 * Check if a date is within a specific month
 * @param {Date} date - The date to check
 * @param {number} year - The year
 * @param {number} month - The month (0-11)
 * @returns {boolean} True if the date is in the specified month
 */
export function isInMonth(date, year, month) {
    if (!date) return false;
    const d = new Date(date);
    return d.getFullYear() === year && d.getMonth() === month;
}

/**
 * Get the current month and year as an object
 * @returns {Object} Object with year and month properties
 */
export function getCurrentMonth() {
    const now = new Date();
    return {
        year: now.getFullYear(),
        month: now.getMonth()
    };
}

/**
 * Format a month and year for display
 * @param {number} year - The year
 * @param {number} month - The month (0-11)
 * @returns {string} Formatted month string (e.g., "January 2024")
 */
export function formatMonthYear(year, month) {
    const date = new Date(year, month, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Parse a date string to a Date object safely
 * @param {string} dateString - The date string to parse
 * @returns {Date|null} Date object or null if invalid
 */
export function parseDate(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Get the time remaining until an event in a human-readable format
 * @param {Date} eventDate - The event date
 * @returns {string} Human-readable time remaining
 */
export function getTimeRemaining(eventDate) {
    if (!eventDate) return '';
    
    const now = new Date();
    const diffMs = eventDate - now;
    
    if (diffMs < 0) return 'Past';
    
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    } else {
        return `${diffMins} minute${diffMins > 1 ? 's' : ''}`;
    }
}

/**
 * Check if a date is today
 * @param {Date} date - The date to check
 * @returns {boolean} True if the date is today
 */
export function isToday(date) {
    if (!date) return false;
    const today = new Date();
    const d = new Date(date);
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
}

/**
 * Check if a date is tomorrow
 * @param {Date} date - The date to check
 * @returns {boolean} True if the date is tomorrow
 */
export function isTomorrow(date) {
    if (!date) return false;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const d = new Date(date);
    return d.getDate() === tomorrow.getDate() &&
           d.getMonth() === tomorrow.getMonth() &&
           d.getFullYear() === tomorrow.getFullYear();
}

/**
 * Sort dates in ascending order (oldest first)
 * @param {Array} items - Array of items with date properties
 * @param {string} dateField - The field name containing the date
 * @returns {Array} Sorted array
 */
export function sortByDateAsc(items, dateField = 'datetime') {
    return [...items].sort((a, b) => new Date(a[dateField]) - new Date(b[dateField]));
}

/**
 * Sort dates in descending order (newest first)
 * @param {Array} items - Array of items with date properties
 * @param {string} dateField - The field name containing the date
 * @returns {Array} Sorted array
 */
export function sortByDateDesc(items, dateField = 'datetime') {
    return [...items].sort((a, b) => new Date(b[dateField]) - new Date(a[dateField]));
}