// js/date-utils.js - WebPlanner Date & Time Utilities
// PATCHED: Ensures consistent date formatting for notification logic and event sorting

/**
 * Get current datetime as string formatted for API (YYYY-MM-DD HH:mm:ss)
 * @returns {string}
 */
export function nowAsDatetimeString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Get current datetime as string formatted for input[type="datetime-local"]
 * @returns {string} - YYYY-MM-DDTHH:mm
 */
export function nowDatetimeLocal() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Get current date as string formatted for input[type="date"]
 * @returns {string} - YYYY-MM-DD
 */
export function nowDateLocal() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parse API datetime string to Date object
 * @param {string} dtStr - YYYY-MM-DD HH:mm:ss
 * @returns {Date}
 */
export function parseDatetimeString(dtStr) {
    if (!dtStr) return new Date();
    // Replace space with T for ISO compatibility
    const isoStr = dtStr.replace(' ', 'T');
    return new Date(isoStr);
}

/**
 * Format Date object to display string (e.g., "Mon 15")
 * @param {Date} date
 * @param {string} locale - Default 'ru-RU'
 * @returns {string}
 */
export function formatDisplayDate(date, locale = 'ru-RU') {
    if (!date) return '';
    const weekday = date.toLocaleDateString(locale, { weekday: 'short' });
    const day = date.getDate();
    return `${weekday} ${day}`;
}

/**
 * Format Date object to time string (e.g., "14:30")
 * @param {Date} date
 * @param {string} locale - Default 'ru-RU'
 * @returns {string}
 */
export function formatDisplayTime(date, locale = 'ru-RU') {
    if (!date) return '';
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Check if a datetime string is in the past
 * @param {string} dtStr - YYYY-MM-DD HH:mm:ss
 * @returns {boolean}
 */
export function isPast(dtStr) {
    if (!dtStr) return false;
    const now = new Date();
    const eventDate = parseDatetimeString(dtStr);
    return eventDate < now;
}

/**
 * Check if a datetime string is today
 * @param {string} dtStr - YYYY-MM-DD HH:mm:ss
 * @returns {boolean}
 */
export function isToday(dtStr) {
    if (!dtStr) return false;
    const today = nowDateLocal();
    return dtStr.startsWith(today);
}

/**
 * Check if a datetime string is tomorrow
 * @param {string} dtStr - YYYY-MM-DD HH:mm:ss
 * @returns {boolean}
 */
export function isTomorrow(dtStr) {
    if (!dtStr) return false;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    return dtStr.startsWith(tomorrowStr);
}

/**
 * Get month key from datetime string (YYYY-MM)
 * @param {string} dtStr
 * @returns {string}
 */
export function getMonthKey(dtStr) {
    if (!dtStr) return '';
    return dtStr.slice(0, 7);
}

/**
 * Get day key from datetime string (YYYY-MM-DD)
 * @param {string} dtStr
 * @returns {string}
 */
export function getDayKey(dtStr) {
    if (!dtStr) return '';
    return dtStr.slice(0, 10);
}

/**
 * Calculate difference in minutes between now and event time
 * @param {string} dtStr - YYYY-MM-DD HH:mm:ss
 * @returns {number} - Positive if future, negative if past
 */
export function getMinutesDifference(dtStr) {
    if (!dtStr) return 0;
    const now = new Date();
    const eventDate = parseDatetimeString(dtStr);
    const diffMs = eventDate - now;
    return Math.round(diffMs / 60000);
}

/**
 * Format duration in minutes to human readable string
 * @param {number} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
    if (!minutes || minutes <= 0) return '';
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
}

/**
 * Add days to a date string
 * @param {string} dateStr - YYYY-MM-DD
 * @param {number} days
 * @returns {string} - YYYY-MM-DD
 */
export function addDaysToDate(dateStr, days) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Add months to a date string
 * @param {string} dateStr - YYYY-MM-DD
 * @param {number} months
 * @returns {string} - YYYY-MM-DD
 */
export function addMonthsToDate(dateStr, months) {
    const date = new Date(dateStr);
    date.setMonth(date.getMonth() + months);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Add years to a date string
 * @param {string} dateStr - YYYY-MM-DD
 * @param {number} years
 * @returns {string} - YYYY-MM-DD
 */
export function addYearsToDate(dateStr, years) {
    const date = new Date(dateStr);
    date.setFullYear(date.getFullYear() + years);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get week number from date
 * @param {Date} date
 * @returns {number}
 */
export function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Compare two datetime strings
 * @param {string} a
 * @param {string} b
 * @returns {number} - -1 if a<b, 0 if a==b, 1 if a>b
 */
export function compareDatetimeStrings(a, b) {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

/**
 * Sort events by datetime
 * @param {Array<Object>} events
 * @returns {Array<Object>}
 */
export function sortEventsByDate(events) {
    return [...events].sort((a, b) => compareDatetimeStrings(a.dt, b.dt));
}

/**
 * Group events by month and day
 * @param {Array<Object>} events
 * @returns {Object} - { 'YYYY-MM': { 'YYYY-MM-DD': [events] } }
 */
export function groupEventsByMonthDay(events) {
    const groups = {};
    events.forEach(ev => {
        const monthKey = getMonthKey(ev.dt);
        const dayKey = getDayKey(ev.dt);
        if (!groups[monthKey]) groups[monthKey] = {};
        if (!groups[monthKey][dayKey]) groups[monthKey][dayKey] = [];
        groups[monthKey][dayKey].push(ev);
    });
    return groups;
}

/**
 * Get relative time description (e.g., "in 5 minutes", "2 hours ago")
 * @param {string} dtStr
 * @returns {string}
 */
export function getRelativeTime(dtStr) {
    if (!dtStr) return '';
    const mins = getMinutesDifference(dtStr);
    if (mins < -1440) {
        const days = Math.abs(Math.floor(mins / 1440));
        return `${days} day${days !== 1 ? 's' : ''} ago`;
    } else if (mins < 0) {
        const hours = Math.abs(Math.floor(mins / 60));
        if (hours > 0) {
            return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        }
        return `${Math.abs(mins)} minutes ago`;
    } else if (mins < 1) {
        return 'now';
    } else if (mins < 60) {
        return `in ${mins} minutes`;
    } else {
        const hours = Math.floor(mins / 60);
        return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
    }
}

// Export all functions
export default {
    nowAsDatetimeString,
    nowDatetimeLocal,
    nowDateLocal,
    parseDatetimeString,
    formatDisplayDate,
    formatDisplayTime,
    isPast,
    isToday,
    isTomorrow,
    getMonthKey,
    getDayKey,
    getMinutesDifference,
    formatDuration,
    addDaysToDate,
    addMonthsToDate,
    addYearsToDate,
    getWeekNumber,
    compareDatetimeStrings,
    sortEventsByDate,
    groupEventsByMonthDay,
    getRelativeTime
};