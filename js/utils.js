// js/utils.js - WebPlanner General Utility Functions
// PATCHED: Comprehensive utilities for modal handling, formatting, validation, and more

import { state } from './state.js';

/**
 * Hide a modal by ID
 * @param {string} modalId - ID of the modal element
 */
export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        
        // Reset form if present
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
        
        // Clear any error messages
        const errors = modal.querySelectorAll('.text-red-400');
        errors.forEach(err => err.classList.add('hidden'));
        
        console.log('Modal hidden:', modalId);
    }
}

/**
 * Show a modal by ID
 * @param {string} modalId - ID of the modal element
 */
export function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        console.log('Modal shown:', modalId);
    }
}

/**
 * Toggle modal visibility
 * @param {string} modalId - ID of the modal element
 */
export function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        if (modal.classList.contains('hidden')) {
            showModal(modalId);
        } else {
            hideModal(modalId);
        }
    }
}

/**
 * Close all open modals
 */
export function closeAllModals() {
    document.querySelectorAll('.modal-sheet').forEach(modal => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });
    state.ui.isModalOpen = false;
    state.ui.activeModalId = null;
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', 'warning', or 'info'
 * @param {number} duration - Duration in milliseconds
 */
export function showToast(message, type = 'info', duration = 3000) {
    // Remove any existing toasts
    const existingToast = document.getElementById('toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = `fixed bottom-24 left-4 right-4 max-w-xl mx-auto px-4 py-3 rounded-xl shadow-lg z-50 animate-slide-up ${getToastClass(type)}`;
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="text-xl">${getToastIcon(type)}</span>
            <span class="text-sm font-medium text-white flex-1">${escapeHtml(message)}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="text-white/70 hover:text-white text-xl">&times;</button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after duration
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, duration);
}

/**
 * Get toast CSS class based on type
 * @param {string} type
 * @returns {string}
 */
function getToastClass(type) {
    switch (type) {
        case 'success':
            return 'bg-emerald-600';
        case 'error':
            return 'bg-red-600';
        case 'warning':
            return 'bg-amber-600';
        default:
            return 'bg-zinc-700';
    }
}

/**
 * Get toast icon based on type
 * @param {string} type
 * @returns {string}
 */
function getToastIcon(type) {
    switch (type) {
        case 'success':
            return '✓';
        case 'error':
            return '✗';
        case 'warning':
            return '⚠';
        default:
            return 'ℹ';
    }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Sanitize user input (basic)
 * @param {string} input
 * @returns {string}
 */
export function sanitizeInput(input) {
    if (!input) return '';
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .trim();
}

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate phone number format (basic)
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidPhone(phone) {
    if (!phone) return false;
    const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
    return phoneRegex.test(phone);
}

/**
 * Validate PIN format (4-6 digits)
 * @param {string} pin
 * @returns {boolean}
 */
export function isValidPin(pin) {
    if (!pin) return false;
    const pinRegex = /^\d{4,6}$/;
    return pinRegex.test(pin);
}

/**
 * Validate date string format (YYYY-MM-DD)
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isValidDate(dateStr) {
    if (!dateStr) return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) return false;
    
    const date = new Date(dateStr + 'T00:00:00');
    return !isNaN(date.getTime());
}

/**
 * Validate datetime string format (YYYY-MM-DD HH:mm:ss)
 * @param {string} datetimeStr
 * @returns {boolean}
 */
export function isValidDatetime(datetimeStr) {
    if (!datetimeStr) return false;
    const datetimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    if (!datetimeRegex.test(datetimeStr)) return false;
    
    const date = new Date(datetimeStr.replace(' ', 'T'));
    return !isNaN(date.getTime());
}

/**
 * Validate number (positive)
 * @param {string|number} value
 * @param {number} min - Minimum value (optional)
 * @param {number} max - Maximum value (optional)
 * @returns {boolean}
 */
export function isValidNumber(value, min = null, max = null) {
    if (value === null || value === undefined || value === '') return false;
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    if (min !== null && num < min) return false;
    if (max !== null && num > max) return false;
    return true;
}

/**
 * Validate required field
 * @param {string} value
 * @returns {boolean}
 */
export function isRequired(value) {
    return value !== null && value !== undefined && value.trim() !== '';
}

/**
 * Format number with commas
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
    if (num === null || num === undefined) return '';
    return new Intl.NumberFormat('ru-RU').format(num);
}

/**
 * Format currency (Russian Rubles)
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '';
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Format file size (bytes to human readable)
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration (minutes to human readable)
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
 * Format relative time (e.g., "5 minutes ago")
 * @param {string|Date} date
 * @returns {string}
 */
export function formatRelativeTime(date) {
    if (!date) return '';
    
    const now = new Date();
    const then = typeof date === 'string' ? new Date(date) : date;
    const diffMs = now - then;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) {
        return 'just now';
    } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
        return then.toLocaleDateString('ru-RU');
    }
}

/**
 * Generate unique ID
 * @returns {string}
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Generate UUID v4
 * @returns {string}
 */
export function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function}
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in milliseconds
 * @returns {Function}
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Sleep/delay utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Initial delay in milliseconds
 * @returns {Promise}
 */
export async function retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                await sleep(delay * Math.pow(2, i));
            }
        }
    }
    throw lastError;
}

/**
 * Copy text to clipboard
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard', 'success');
        return true;
    } catch (error) {
        console.error('Copy to clipboard failed:', error);
        showToast('Failed to copy', 'error');
        return false;
    }
}

/**
 * Download file from blob
 * @param {Blob} blob - File blob
 * @param {string} filename - Filename
 */
export function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Download JSON data as file
 * @param {Object} data - Data to download
 * @param {string} filename - Filename
 */
export function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadFile(blob, filename);
}

/**
 * Read file as text
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

/**
 * Read file as JSON
 * @param {File} file
 * @returns {Promise<Object>}
 */
export async function readFileAsJson(file) {
    const text = await readFileAsText(file);
    return JSON.parse(text);
}

/**
 * Check if element is in viewport
 * @param {HTMLElement} element
 * @returns {boolean}
 */
export function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

/**
 * Scroll element into view smoothly
 * @param {HTMLElement} element
 */
export function scrollIntoView(element) {
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Get element offset from top of page
 * @param {HTMLElement} element
 * @returns {number}
 */
export function getOffsetTop(element) {
    if (!element) return 0;
    let offset = 0;
    let el = element;
    while (el) {
        offset += el.offsetTop;
        el = el.offsetParent;
    }
    return offset;
}

/**
 * Add CSS class to element
 * @param {HTMLElement} element
 * @param {string} className
 */
export function addClass(element, className) {
    if (element && className) {
        element.classList.add(className);
    }
}

/**
 * Remove CSS class from element
 * @param {HTMLElement} element
 * @param {string} className
 */
export function removeClass(element, className) {
    if (element && className) {
        element.classList.remove(className);
    }
}

/**
 * Toggle CSS class on element
 * @param {HTMLElement} element
 * @param {string} className
 */
export function toggleClass(element, className) {
    if (element && className) {
        element.classList.toggle(className);
    }
}

/**
 * Check if element has CSS class
 * @param {HTMLElement} element
 * @param {string} className
 * @returns {boolean}
 */
export function hasClass(element, className) {
    if (!element || !className) return false;
    return element.classList.contains(className);
}

/**
 * Get computed style of element
 * @param {HTMLElement} element
 * @param {string} property
 * @returns {string}
 */
export function getComputedStyle(element, property) {
    if (!element) return '';
    return window.getComputedStyle(element).getPropertyValue(property);
}

/**
 * Wait for element to exist in DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<HTMLElement>}
 */
export function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }
        
        const observer = new MutationObserver((mutations, obs) => {
            const el = document.querySelector(selector);
            if (el) {
                obs.disconnect();
                resolve(el);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        }, timeout);
    });
}

/**
 * Log with timestamp
 * @param {string} message
 * @param {any} data
 */
export function log(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data !== null) {
        console.log(`[${timestamp}] ${message}:`, data);
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
}

/**
 * Log error with timestamp
 * @param {string} message
 * @param {Error} error
 */
export function logError(message, error = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR: ${message}`, error || '');
}

/**
 * Log warning with timestamp
 * @param {string} message
 */
export function logWarning(message) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] WARNING: ${message}`);
}

/**
 * Check if running in production
 * @returns {boolean}
 */
export function isProduction() {
    return window.location.hostname !== 'localhost' && 
           window.location.hostname !== '127.0.0.1';
}

/**
 * Check if running on mobile device
 * @returns {boolean}
 */
export function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Check if running on iOS
 * @returns {boolean}
 */
export function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

/**
 * Check if running on Android
 * @returns {boolean}
 */
export function isAndroid() {
    return /Android/.test(navigator.userAgent);
}

/**
 * Get browser name
 * @returns {string}
 */
export function getBrowserName() {
    const userAgent = navigator.userAgent;
    if (userAgent.indexOf('Chrome') > -1) return 'Chrome';
    if (userAgent.indexOf('Safari') > -1) return 'Safari';
    if (userAgent.indexOf('Firefox') > -1) return 'Firefox';
    if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident/') > -1) return 'IE';
    if (userAgent.indexOf('Edge') > -1) return 'Edge';
    return 'Unknown';
}

/**
 * Get browser version
 * @returns {string}
 */
export function getBrowserVersion() {
    const userAgent = navigator.userAgent;
    const match = userAgent.match(/(Chrome|Safari|Firefox|MSIE|Edge)\/?(\d+)/);
    return match ? match[2] : 'Unknown';
}

/**
 * Check if PWA is installed
 * @returns {boolean}
 */
export function isPWAInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}

/**
 * Get network status
 * @returns {Object}
 */
export function getNetworkStatus() {
    return {
        online: navigator.onLine,
        connection: navigator.connection ? {
            effectiveType: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink,
            rtt: navigator.connection.rtt,
            saveData: navigator.connection.saveData
        } : null
    };
}

/**
 * Listen for network status changes
 * @param {Function} callback
 */
export function onNetworkChange(callback) {
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
}

/**
 * Get battery status (if available)
 * @returns {Promise<Object>}
 */
export async function getBatteryStatus() {
    if ('getBattery' in navigator) {
        try {
            const battery = await navigator.getBattery();
            return {
                level: battery.level,
                charging: battery.charging,
                chargingTime: battery.chargingTime,
                dischargingTime: battery.dischargingTime
            };
        } catch (error) {
            console.error('Battery status not available:', error);
        }
    }
    return null;
}

/**
 * Get screen orientation
 * @returns {string}
 */
export function getScreenOrientation() {
    if (screen.orientation) {
        return screen.orientation.type;
    }
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
}

/**
 * Listen for orientation changes
 * @param {Function} callback
 */
export function onOrientationChange(callback) {
    window.addEventListener('orientationchange', () => {
        callback(getScreenOrientation());
    });
}

/**
 * Vibrate device (if supported)
 * @param {number|Array} pattern - Vibration pattern
 */
export function vibrate(pattern) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

/**
 * Get current URL without query params
 * @returns {string}
 */
export function getCurrentUrl() {
    return window.location.origin + window.location.pathname;
}

/**
 * Get query parameter from URL
 * @param {string} param - Parameter name
 * @returns {string|null}
 */
export function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

/**
 * Set query parameter in URL
 * @param {string} param - Parameter name
 * @param {string} value - Parameter value
 */
export function setQueryParam(param, value) {
    const url = new URL(window.location);
    url.searchParams.set(param, value);
    window.history.pushState({}, '', url);
}

/**
 * Remove query parameter from URL
 * @param {string} param - Parameter name
 */
export function removeQueryParam(param) {
    const url = new URL(window.location);
    url.searchParams.delete(param);
    window.history.pushState({}, '', url);
}

/**
 * Get all query parameters
 * @returns {Object}
 */
export function getAllQueryParams() {
    const params = {};
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.forEach((value, key) => {
        params[key] = value;
    });
    return params;
}

/**
 * Navigate to URL
 * @param {string} url
 */
export function navigateTo(url) {
    window.location.href = url;
}

/**
 * Reload page
 * @param {boolean} force - Force reload from server
 */
export function reloadPage(force = false) {
    window.location.reload(force);
}

/**
 * Go back in history
 */
export function goBack() {
    window.history.back();
}

/**
 * Go forward in history
 */
export function goForward() {
    window.history.forward();
}

/**
 * Open URL in new tab
 * @param {string} url
 */
export function openInNewTab(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Close current tab (if opened by script)
 */
export function closeTab() {
    window.close();
}

/**
 * Focus on window
 */
export function focusWindow() {
    window.focus();
}

/**
 * Get current timestamp
 * @returns {number}
 */
export function getTimestamp() {
    return Date.now();
}

/**
 * Get current ISO timestamp
 * @returns {string}
 */
export function getIsoTimestamp() {
    return new Date().toISOString();
}

/**
 * Format timestamp to readable date
 * @param {number} timestamp
 * @returns {string}
 */
export function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString('ru-RU');
}

/**
 * Parse timestamp from string
 * @param {string} dateStr
 * @returns {number}
 */
export function parseTimestamp(dateStr) {
    return new Date(dateStr).getTime();
}

/**
 * Get time difference in milliseconds
 * @param {number} timestamp1
 * @param {number} timestamp2
 * @returns {number}
 */
export function getTimeDifference(timestamp1, timestamp2) {
    return Math.abs(timestamp1 - timestamp2);
}

/**
 * Check if timestamp is in the past
 * @param {number} timestamp
 * @returns {boolean}
 */
export function isPastTimestamp(timestamp) {
    return timestamp < Date.now();
}

/**
 * Check if timestamp is in the future
 * @param {number} timestamp
 * @returns {boolean}
 */
export function isFutureTimestamp(timestamp) {
    return timestamp > Date.now();
}

/**
 * Add milliseconds to timestamp
 * @param {number} timestamp
 * @param {number} ms
 * @returns {number}
 */
export function addMilliseconds(timestamp, ms) {
    return timestamp + ms;
}

/**
 * Subtract milliseconds from timestamp
 * @param {number} timestamp
 * @param {number} ms
 * @returns {number}
 */
export function subtractMilliseconds(timestamp, ms) {
    return timestamp - ms;
}

/**
 * Get start of day timestamp
 * @param {number} timestamp
 * @returns {number}
 */
export function getStartOfDay(timestamp) {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

/**
 * Get end of day timestamp
 * @param {number} timestamp
 * @returns {number}
 */
export function getEndOfDay(timestamp) {
    const date = new Date(timestamp);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
}

/**
 * Get start of week timestamp
 * @param {number} timestamp
 * @returns {number}
 */
export function getStartOfWeek(timestamp) {
    const date = new Date(timestamp);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

/**
 * Get start of month timestamp
 * @param {number} timestamp
 * @returns {number}
 */
export function getStartOfMonth(timestamp) {
    const date = new Date(timestamp);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

/**
 * Get start of year timestamp
 * @param {number} timestamp
 * @returns {number}
 */
export function getStartOfYear(timestamp) {
    const date = new Date(timestamp);
    date.setMonth(0, 1);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

/**
 * Clamp number between min and max
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Random number between min and max
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random item from array
 * @param {Array} array
 * @returns {any}
 */
export function randomItem(array) {
    if (!array || !array.length) return null;
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Shuffle array (Fisher-Yates)
 * @param {Array} array
 * @returns {Array}
 */
export function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Deep clone object
 * @param {Object} obj
 * @returns {Object}
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep merge objects
 * @param {Object} target
 * @param {Object} source
 * @returns {Object}
 */
export function deepMerge(target, source) {
    const output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

/**
 * Check if value is object
 * @param {any} value
 * @returns {boolean}
 */
export function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 * @param {any} value
 * @returns {boolean}
 */
export function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (isObject(value)) return Object.keys(value).length === 0;
    return false;
}

/**
 * Get object keys
 * @param {Object} obj
 * @returns {Array}
 */
export function getKeys(obj) {
    return Object.keys(obj);
}

/**
 * Get object values
 * @param {Object} obj
 * @returns {Array}
 */
export function getValues(obj) {
    return Object.values(obj);
}

/**
 * Get object entries
 * @param {Object} obj
 * @returns {Array}
 */
export function getEntries(obj) {
    return Object.entries(obj);
}

/**
 * Invert object (keys become values, values become keys)
 * @param {Object} obj
 * @returns {Object}
 */
export function invertObject(obj) {
    const inverted = {};
    Object.entries(obj).forEach(([key, value]) => {
        inverted[value] = key;
    });
    return inverted;
}

/**
 * Pick specific keys from object
 * @param {Object} obj
 * @param {Array} keys
 * @returns {Object}
 */
export function pickKeys(obj, keys) {
    return keys.reduce((result, key) => {
        if (key in obj) {
            result[key] = obj[key];
        }
        return result;
    }, {});
}

/**
 * Omit specific keys from object
 * @param {Object} obj
 * @param {Array} keys
 * @returns {Object}
 */
export function omitKeys(obj, keys) {
    const result = { ...obj };
    keys.forEach(key => {
        delete result[key];
    });
    return result;
}

/**
 * Group array by key
 * @param {Array} array
 * @param {string|Function} key
 * @returns {Object}
 */
export function groupBy(array, key) {
    return array.reduce((result, item) => {
        const groupKey = typeof key === 'function' ? key(item) : item[key];
        if (!result[groupKey]) {
            result[groupKey] = [];
        }
        result[groupKey].push(item);
        return result;
    }, {});
}

/**
 * Unique values from array
 * @param {Array} array
 * @returns {Array}
 */
export function uniqueArray(array) {
    return [...new Set(array)];
}

/**
 * Flatten nested array
 * @param {Array} array
 * @returns {Array}
 */
export function flattenArray(array) {
    return array.flat(Infinity);
}

/**
 * Chunk array into smaller arrays
 * @param {Array} array
 * @param {number} size
 * @returns {Array}
 */
export function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * Intersection of two arrays
 * @param {Array} array1
 * @param {Array} array2
 * @returns {Array}
 */
export function arrayIntersection(array1, array2) {
    return array1.filter(item => array2.includes(item));
}

/**
 * Difference of two arrays
 * @param {Array} array1
 * @param {Array} array2
 * @returns {Array}
 */
export function arrayDifference(array1, array2) {
    return array1.filter(item => !array2.includes(item));
}

/**
 * Union of two arrays
 * @param {Array} array1
 * @param {Array} array2
 * @returns {Array}
 */
export function arrayUnion(array1, array2) {
    return uniqueArray([...array1, ...array2]);
}

/**
 * Sum of array values
 * @param {Array} array
 * @returns {number}
 */
export function arraySum(array) {
    return array.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
}

/**
 * Average of array values
 * @param {Array} array
 * @returns {number}
 */
export function arrayAverage(array) {
    if (!array.length) return 0;
    return arraySum(array) / array.length;
}

/**
 * Max value in array
 * @param {Array} array
 * @returns {number}
 */
export function arrayMax(array) {
    return Math.max(...array.map(v => parseFloat(v) || 0));
}

/**
 * Min value in array
 * @param {Array} array
 * @returns {number}
 */
export function arrayMin(array) {
    return Math.min(...array.map(v => parseFloat(v) || 0));
}

/**
 * Sort array of objects by key
 * @param {Array} array
 * @param {string} key
 * @param {boolean} ascending
 * @returns {Array}
 */
export function sortByKey(array, key, ascending = true) {
    return [...array].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (aVal < bVal) return ascending ? -1 : 1;
        if (aVal > bVal) return ascending ? 1 : -1;
        return 0;
    });
}

/**
 * Search array of objects
 * @param {Array} array
 * @param {string} query
 * @param {Array} keys - Keys to search in
 * @returns {Array}
 */
export function searchArray(array, query, keys = []) {
    if (!query || !array.length) return array;
    const lowerQuery = query.toLowerCase();
    return array.filter(item => {
        if (keys.length) {
            return keys.some(key => {
                const value = item[key];
                return value && String(value).toLowerCase().includes(lowerQuery);
            });
        } else {
            return Object.values(item).some(value => {
                return value && String(value).toLowerCase().includes(lowerQuery);
            });
        }
    });
}

/**
 * Paginate array
 * @param {Array} array
 * @param {number} page
 * @param {number} pageSize
 * @returns {Object}
 */
export function paginateArray(array, page = 1, pageSize = 10) {
    const total = array.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const data = array.slice(start, end);
    
    return {
        data,
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
    };
}

// ✅ PATCH: Expose functions to window for inline HTML onclick handlers
Object.assign(window, {
    hideModal,
    showModal,
    toggleModal,
    closeAllModals,
    showToast,
    escapeHtml,
    sanitizeInput,
    isValidEmail,
    isValidPhone,
    isValidPin,
    isValidDate,
    isValidDatetime,
    isValidNumber,
    isRequired,
    formatNumber,
    formatCurrency,
    formatFileSize,
    formatDuration,
    formatRelativeTime,
    generateId,
    generateUuid,
    copyToClipboard,
    downloadFile,
    downloadJson,
    isMobile,
    isIOS,
    isAndroid,
    isPWAInstalled,
    getNetworkStatus,
    vibrate,
    getCurrentUrl,
    getQueryParam,
    navigateTo,
    reloadPage,
    goBack,
    goForward,
    openInNewTab,
    getTimestamp,
    getIsoTimestamp,
    formatTimestamp,
    isEmpty,
    deepClone,
    uniqueArray,
    sortByKey,
    searchArray,
    paginateArray
});

// Export default for module imports
export default {
    hideModal,
    showModal,
    toggleModal,
    closeAllModals,
    showToast,
    escapeHtml,
    sanitizeInput,
    isValidEmail,
    isValidPhone,
    isValidPin,
    isValidDate,
    isValidDatetime,
    isValidNumber,
    isRequired,
    formatNumber,
    formatCurrency,
    formatFileSize,
    formatDuration,
    formatRelativeTime,
    generateId,
    generateUuid,
    debounce,
    throttle,
    sleep,
    retryWithBackoff,
    copyToClipboard,
    downloadFile,
    downloadJson,
    readFileAsText,
    readFileAsJson,
    isInViewport,
    scrollIntoView,
    getOffsetTop,
    addClass,
    removeClass,
    toggleClass,
    hasClass,
    getComputedStyle,
    waitForElement,
    log,
    logError,
    logWarning,
    isProduction,
    isMobile,
    isIOS,
    isAndroid,
    getBrowserName,
    getBrowserVersion,
    isPWAInstalled,
    getNetworkStatus,
    onNetworkChange,
    getBatteryStatus,
    getScreenOrientation,
    onOrientationChange,
    vibrate,
    getCurrentUrl,
    getQueryParam,
    setQueryParam,
    removeQueryParam,
    getAllQueryParams,
    navigateTo,
    reloadPage,
    goBack,
    goForward,
    openInNewTab,
    closeTab,
    focusWindow,
    getTimestamp,
    getIsoTimestamp,
    formatTimestamp,
    parseTimestamp,
    getTimeDifference,
    isPastTimestamp,
    isFutureTimestamp,
    addMilliseconds,
    subtractMilliseconds,
    getStartOfDay,
    getEndOfDay,
    getStartOfWeek,
    getStartOfMonth,
    getStartOfYear,
    clamp,
    randomBetween,
    randomItem,
    shuffleArray,
    deepClone,
    deepMerge,
    isObject,
    isEmpty,
    getKeys,
    getValues,
    getEntries,
    invertObject,
    pickKeys,
    omitKeys,
    groupBy,
    uniqueArray,
    flattenArray,
    chunkArray,
    arrayIntersection,
    arrayDifference,
    arrayUnion,
    arraySum,
    arrayAverage,
    arrayMax,
    arrayMin,
    sortByKey,
    searchArray,
    paginateArray
};