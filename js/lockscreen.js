// js/lockscreen.js - WebPlanner Lockscreen Security Feature
// PATCHED: Proper session management, localStorage persistence, and UI handling

import { state } from './state.js';

// Local storage keys
const LOCKSCREEN_ENABLED_KEY = 'webplanner_lockscreen_enabled';
const LOCKSCREEN_PIN_KEY = 'webplanner_lockscreen_pin';
const LOCKSCREEN_UNLOCKED_KEY = 'webplanner_lockscreen_unlocked';
const LOCKSCREEN_TIMEOUT_KEY = 'webplanner_lockscreen_timeout';

// Default timeout in minutes (auto-lock after inactivity)
const DEFAULT_LOCK_TIMEOUT = 15;

/**
 * Initialize lockscreen feature
 * Checks if lockscreen is enabled and handles auto-lock
 */
export async function initLockscreen() {
    try {
        // Load lockscreen settings from localStorage
        const enabled = localStorage.getItem(LOCKSCREEN_ENABLED_KEY) === 'true';
        const pin = localStorage.getItem(LOCKSCREEN_PIN_KEY);
        const timeout = parseInt(localStorage.getItem(LOCKSCREEN_TIMEOUT_KEY)) || DEFAULT_LOCK_TIMEOUT;
        
        state.lockscreen.enabled = enabled;
        state.lockscreen.timeout = timeout;
        
        // Check if already unlocked this session
        const unlocked = sessionStorage.getItem(LOCKSCREEN_UNLOCKED_KEY) === 'true';
        state.lockscreen.unlocked = unlocked;
        
        console.log('Lockscreen initialized:', {
            enabled,
            hasPin: !!pin,
            timeout,
            unlocked
        });
        
        // If enabled and not unlocked, show lockscreen
        if (enabled && !unlocked) {
            showLockscreen();
        }
        
        // Set up auto-lock timer
        if (enabled) {
            setupAutoLock(timeout);
        }
        
        return { enabled, hasPin: !!pin, timeout, unlocked };
    } catch (error) {
        console.error('Lockscreen initialization failed:', error);
        return { enabled: false, hasPin: false, timeout: DEFAULT_LOCK_TIMEOUT, unlocked: true };
    }
}

/**
 * Show the lockscreen overlay
 */
function showLockscreen() {
    // Check if lockscreen overlay already exists
    let overlay = document.getElementById('lockscreen-overlay');
    
    if (!overlay) {
        // Create lockscreen overlay
        overlay = document.createElement('div');
        overlay.id = 'lockscreen-overlay';
        overlay.className = 'fixed inset-0 bg-zinc-950/95 backdrop-blur-sm z-[100] flex items-center justify-center';
        overlay.innerHTML = `
            <div class="bg-zinc-900 rounded-3xl p-8 max-w-sm w-full mx-4 border border-zinc-800 shadow-2xl">
                <div class="text-center mb-6">
                    <div class="text-4xl mb-3">🔒</div>
                    <h2 class="text-xl font-semibold text-zinc-200">WebPlanner Locked</h2>
                    <p class="text-sm text-zinc-500 mt-1">Enter your PIN to continue</p>
                </div>
                
                <form id="lockscreen-form" class="space-y-4">
                    <div>
                        <input 
                            type="password" 
                            id="lockscreen-pin-input" 
                            class="w-full bg-zinc-800 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="••••"
                            maxlength="6"
                            autocomplete="off"
                            inputmode="numeric"
                            pattern="[0-9]*"
                        />
                    </div>
                    
                    <div id="lockscreen-error" class="text-center text-red-400 text-sm hidden">
                        Incorrect PIN. Please try again.
                    </div>
                    
                    <button 
                        type="submit" 
                        class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-medium transition-colors"
                    >
                        Unlock
                    </button>
                </form>
                
                <div class="mt-6 text-center">
                    <button 
                        onclick="forgotPin()" 
                        class="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        Forgot PIN?
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }
    
    // Show overlay
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    
    // Focus on PIN input
    const input = document.getElementById('lockscreen-pin-input');
    if (input) {
        input.value = '';
        input.focus();
    }
    
    // Hide error message
    const error = document.getElementById('lockscreen-error');
    if (error) {
        error.classList.add('hidden');
    }
    
    // Set up form submission
    const form = document.getElementById('lockscreen-form');
    if (form) {
        form.onsubmit = handlePinSubmit;
    }
    
    // Block background interaction
    document.body.style.overflow = 'hidden';
    
    console.log('Lockscreen displayed');
}

/**
 * Hide the lockscreen overlay
 */
function hideLockscreen() {
    const overlay = document.getElementById('lockscreen-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
    }
    
    // Restore background interaction
    document.body.style.overflow = '';
    
    // Mark as unlocked for this session
    sessionStorage.setItem(LOCKSCREEN_UNLOCKED_KEY, 'true');
    state.lockscreen.unlocked = true;
    
    console.log('Lockscreen hidden, session unlocked');
}

/**
 * Handle PIN submission
 * @param {Event} e - Form submit event
 */
async function handlePinSubmit(e) {
    e.preventDefault();
    
    const input = document.getElementById('lockscreen-pin-input');
    const error = document.getElementById('lockscreen-error');
    
    if (!input || !error) return;
    
    const enteredPin = input.value.trim();
    const storedPin = localStorage.getItem(LOCKSCREEN_PIN_KEY);
    
    if (!storedPin) {
        error.textContent = 'No PIN set. Please contact administrator.';
        error.classList.remove('hidden');
        return;
    }
    
    if (enteredPin === storedPin) {
        // Correct PIN
        hideLockscreen();
        
        // Reset auto-lock timer
        const timeout = parseInt(localStorage.getItem(LOCKSCREEN_TIMEOUT_KEY)) || DEFAULT_LOCK_TIMEOUT;
        setupAutoLock(timeout);
    } else {
        // Incorrect PIN
        error.textContent = 'Incorrect PIN. Please try again.';
        error.classList.remove('hidden');
        input.value = '';
        input.focus();
        
        // Shake animation for visual feedback
        const form = document.getElementById('lockscreen-form');
        if (form) {
            form.classList.add('animate-shake');
            setTimeout(() => form.classList.remove('animate-shake'), 500);
        }
        
        console.warn('Incorrect PIN attempt');
    }
}

/**
 * Set up auto-lock timer (locks after period of inactivity)
 * @param {number} timeoutMinutes - Timeout in minutes
 */
function setupAutoLock(timeoutMinutes) {
    // Clear any existing timer
    if (state.lockscreen.timerId) {
        clearTimeout(state.lockscreen.timerId);
    }
    
    // Set new timer
    state.lockscreen.timerId = setTimeout(() => {
        if (state.lockscreen.enabled && state.lockscreen.unlocked) {
            console.log('Auto-lock triggered after inactivity');
            lockApp();
        }
    }, timeoutMinutes * 60 * 1000);
    
    console.log(`Auto-lock timer set for ${timeoutMinutes} minutes`);
}

/**
 * Reset auto-lock timer (called on user activity)
 */
export function resetAutoLockTimer() {
    if (!state.lockscreen.enabled || !state.lockscreen.unlocked) {
        return;
    }
    
    const timeout = parseInt(localStorage.getItem(LOCKSCREEN_TIMEOUT_KEY)) || DEFAULT_LOCK_TIMEOUT;
    setupAutoLock(timeout);
}

/**
 * Lock the app (show lockscreen)
 */
export function lockApp() {
    state.lockscreen.unlocked = false;
    sessionStorage.removeItem(LOCKSCREEN_UNLOCKED_KEY);
    showLockscreen();
    console.log('App locked');
}

/**
 * Enable lockscreen with a new PIN
 * @param {string} pin - New PIN (4-6 digits)
 */
export function enableLockscreen(pin) {
    if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
        throw new Error('PIN must be 4-6 digits');
    }
    
    localStorage.setItem(LOCKSCREEN_ENABLED_KEY, 'true');
    localStorage.setItem(LOCKSCREEN_PIN_KEY, pin);
    
    state.lockscreen.enabled = true;
    state.lockscreen.unlocked = true;
    
    // Set up auto-lock
    const timeout = parseInt(localStorage.getItem(LOCKSCREEN_TIMEOUT_KEY)) || DEFAULT_LOCK_TIMEOUT;
    setupAutoLock(timeout);
    
    console.log('Lockscreen enabled');
    return true;
}

/**
 * Disable lockscreen
 */
export function disableLockscreen() {
    localStorage.removeItem(LOCKSCREEN_ENABLED_KEY);
    localStorage.removeItem(LOCKSCREEN_PIN_KEY);
    localStorage.removeItem(LOCKSCREEN_UNLOCKED_KEY);
    
    state.lockscreen.enabled = false;
    state.lockscreen.unlocked = true;
    
    // Clear auto-lock timer
    if (state.lockscreen.timerId) {
        clearTimeout(state.lockscreen.timerId);
        state.lockscreen.timerId = null;
    }
    
    // Hide lockscreen if shown
    hideLockscreen();
    
    console.log('Lockscreen disabled');
    return true;
}

/**
 * Change lockscreen PIN
 * @param {string} oldPin - Current PIN
 * @param {string} newPin - New PIN (4-6 digits)
 */
export function changePin(oldPin, newPin) {
    const storedPin = localStorage.getItem(LOCKSCREEN_PIN_KEY);
    
    if (!storedPin) {
        throw new Error('No PIN currently set');
    }
    
    if (oldPin !== storedPin) {
        throw new Error('Current PIN is incorrect');
    }
    
    if (!newPin || newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
        throw new Error('New PIN must be 4-6 digits');
    }
    
    localStorage.setItem(LOCKSCREEN_PIN_KEY, newPin);
    console.log('PIN changed successfully');
    return true;
}

/**
 * Reset/forgot PIN (clears lockscreen)
 * Warning: This removes security, should require additional verification in production
 */
export function forgotPin() {
    if (!confirm('⚠️ Reset PIN? This will disable the lockscreen. Continue?')) {
        return;
    }
    
    disableLockscreen();
    alert('Lockscreen disabled. You can set a new PIN in Settings.');
}

/**
 * Set auto-lock timeout
 * @param {number} minutes - Timeout in minutes
 */
export function setLockTimeout(minutes) {
    if (minutes < 1 || minutes > 120) {
        throw new Error('Timeout must be between 1 and 120 minutes');
    }
    
    localStorage.setItem(LOCKSCREEN_TIMEOUT_KEY, minutes.toString());
    state.lockscreen.timeout = minutes;
    
    // Reset timer with new timeout
    if (state.lockscreen.enabled && state.lockscreen.unlocked) {
        setupAutoLock(minutes);
    }
    
    console.log(`Lock timeout set to ${minutes} minutes`);
    return true;
}

/**
 * Get lockscreen status
 * @returns {Object}
 */
export function getLockscreenStatus() {
    return {
        enabled: state.lockscreen.enabled,
        unlocked: state.lockscreen.unlocked,
        hasPin: !!localStorage.getItem(LOCKSCREEN_PIN_KEY),
        timeout: state.lockscreen.timeout || DEFAULT_LOCK_TIMEOUT
    };
}

/**
 * Check if app is currently locked
 * @returns {boolean}
 */
export function isAppLocked() {
    return state.lockscreen.enabled && !state.lockscreen.unlocked;
}

/**
 * Add activity listeners to reset auto-lock timer
 */
function setupActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
        document.addEventListener(event, () => {
            resetAutoLockTimer();
        }, { passive: true, capture: true });
    });
}

/**
 * Show lockscreen settings modal
 */
export function showLockscreenSettings() {
    const status = getLockscreenStatus();
    
    const modal = document.createElement('div');
    modal.id = 'modal-lockscreen-settings';
    modal.className = 'modal-sheet hidden';
    modal.innerHTML = `
        <div class="bg-zinc-900 rounded-t-3xl p-4 max-h-[90vh] flex flex-col">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold">🔒 Lockscreen Settings</h3>
                <button onclick="hideLockscreenSettings()" class="text-2xl text-zinc-400 hover:text-white">&times;</button>
            </div>
            
            <div class="modal-body overflow-y-auto space-y-4">
                <div class="bg-zinc-800/50 rounded-xl p-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="font-medium text-zinc-200">Lockscreen</div>
                            <div class="text-xs text-zinc-500">Require PIN to access app</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="lockscreen-toggle" class="sr-only peer" ${status.enabled ? 'checked' : ''}>
                            <div class="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>
                </div>
                
                ${status.enabled ? `
                <div class="bg-zinc-800/50 rounded-xl p-4">
                    <div class="font-medium text-zinc-200 mb-2">Auto-lock Timeout</div>
                    <select id="lockscreen-timeout" class="w-full bg-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="5" ${status.timeout === 5 ? 'selected' : ''}>5 minutes</option>
                        <option value="10" ${status.timeout === 10 ? 'selected' : ''}>10 minutes</option>
                        <option value="15" ${status.timeout === 15 ? 'selected' : ''}>15 minutes</option>
                        <option value="30" ${status.timeout === 30 ? 'selected' : ''}>30 minutes</option>
                        <option value="60" ${status.timeout === 60 ? 'selected' : ''}>1 hour</option>
                    </select>
                </div>
                
                <div class="bg-zinc-800/50 rounded-xl p-4">
                    <button onclick="showChangePinForm()" class="w-full text-left font-medium text-zinc-200 hover:text-emerald-400 transition-colors">
                        Change PIN
                    </button>
                </div>
                ` : ''}
                
                <div class="bg-zinc-800/50 rounded-xl p-4">
                    <div class="text-xs text-zinc-500">
                        ${status.enabled ? 'Lockscreen is active. Your app will require PIN after period of inactivity.' : 'Lockscreen is disabled. Enable to add PIN protection.'}
                    </div>
                </div>
            </div>
            
            <div class="flex gap-3 mt-4 pt-4 border-t border-zinc-800">
                <button onclick="hideLockscreenSettings()" class="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition-colors">Done</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Set up toggle handler
    const toggle = document.getElementById('lockscreen-toggle');
    if (toggle) {
        toggle.onchange = (e) => {
            if (e.target.checked) {
                showSetPinForm();
            } else {
                disableLockscreen();
            }
        };
    }
    
    // Set up timeout handler
    const timeoutSelect = document.getElementById('lockscreen-timeout');
    if (timeoutSelect) {
        timeoutSelect.onchange = (e) => {
            setLockTimeout(parseInt(e.target.value));
        };
    }
}

/**
 * Hide lockscreen settings modal
 */
export function hideLockscreenSettings() {
    const modal = document.getElementById('modal-lockscreen-settings');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        setTimeout(() => modal.remove(), 200);
    }
}

/**
 * Show set PIN form (for enabling lockscreen)
 */
function showSetPinForm() {
    const modal = document.createElement('div');
    modal.id = 'modal-set-pin';
    modal.className = 'modal-sheet hidden';
    modal.innerHTML = `
        <div class="bg-zinc-900 rounded-t-3xl p-4">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold">Set PIN</h3>
                <button onclick="hideSetPinForm()" class="text-2xl text-zinc-400 hover:text-white">&times;</button>
            </div>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm text-zinc-400 mb-1">Enter 4-6 digit PIN</label>
                    <input 
                        type="password" 
                        id="set-pin-input" 
                        class="w-full bg-zinc-800 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="••••"
                        maxlength="6"
                        inputmode="numeric"
                    />
                </div>
                
                <div>
                    <label class="block text-sm text-zinc-400 mb-1">Confirm PIN</label>
                    <input 
                        type="password" 
                        id="confirm-pin-input" 
                        class="w-full bg-zinc-800 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="••••"
                        maxlength="6"
                        inputmode="numeric"
                    />
                </div>
                
                <div id="set-pin-error" class="text-center text-red-400 text-sm hidden"></div>
                
                <button onclick="confirmSetPin()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-medium transition-colors">
                    Set PIN
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

/**
 * Hide set PIN form
 */
function hideSetPinForm() {
    const modal = document.getElementById('modal-set-pin');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        setTimeout(() => modal.remove(), 200);
    }
}

/**
 * Confirm and save new PIN
 */
function confirmSetPin() {
    const pinInput = document.getElementById('set-pin-input');
    const confirmInput = document.getElementById('confirm-pin-input');
    const error = document.getElementById('set-pin-error');
    
    if (!pinInput || !confirmInput || !error) return;
    
    const pin = pinInput.value.trim();
    const confirm = confirmInput.value.trim();
    
    if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
        error.textContent = 'PIN must be 4-6 digits';
        error.classList.remove('hidden');
        return;
    }
    
    if (pin !== confirm) {
        error.textContent = 'PINs do not match';
        error.classList.remove('hidden');
        return;
    }
    
    try {
        enableLockscreen(pin);
        hideSetPinForm();
        hideLockscreenSettings();
        alert('Lockscreen enabled successfully!');
    } catch (e) {
        error.textContent = e.message;
        error.classList.remove('hidden');
    }
}

/**
 * Show change PIN form
 */
function showChangePinForm() {
    const modal = document.createElement('div');
    modal.id = 'modal-change-pin';
    modal.className = 'modal-sheet hidden';
    modal.innerHTML = `
        <div class="bg-zinc-900 rounded-t-3xl p-4">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold">Change PIN</h3>
                <button onclick="hideChangePinForm()" class="text-2xl text-zinc-400 hover:text-white">&times;</button>
            </div>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm text-zinc-400 mb-1">Current PIN</label>
                    <input 
                        type="password" 
                        id="change-old-pin" 
                        class="w-full bg-zinc-800 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="••••"
                        maxlength="6"
                        inputmode="numeric"
                    />
                </div>
                
                <div>
                    <label class="block text-sm text-zinc-400 mb-1">New PIN</label>
                    <input 
                        type="password" 
                        id="change-new-pin" 
                        class="w-full bg-zinc-800 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="••••"
                        maxlength="6"
                        inputmode="numeric"
                    />
                </div>
                
                <div>
                    <label class="block text-sm text-zinc-400 mb-1">Confirm New PIN</label>
                    <input 
                        type="password" 
                        id="change-confirm-pin" 
                        class="w-full bg-zinc-800 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="••••"
                        maxlength="6"
                        inputmode="numeric"
                    />
                </div>
                
                <div id="change-pin-error" class="text-center text-red-400 text-sm hidden"></div>
                
                <button onclick="confirmChangePin()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-medium transition-colors">
                    Change PIN
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

/**
 * Hide change PIN form
 */
function hideChangePinForm() {
    const modal = document.getElementById('modal-change-pin');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        setTimeout(() => modal.remove(), 200);
    }
}

/**
 * Confirm and change PIN
 */
function confirmChangePin() {
    const oldPinInput = document.getElementById('change-old-pin');
    const newPinInput = document.getElementById('change-new-pin');
    const confirmInput = document.getElementById('change-confirm-pin');
    const error = document.getElementById('change-pin-error');
    
    if (!oldPinInput || !newPinInput || !confirmInput || !error) return;
    
    const oldPin = oldPinInput.value.trim();
    const newPin = newPinInput.value.trim();
    const confirm = confirmInput.value.trim();
    
    if (!newPin || newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
        error.textContent = 'New PIN must be 4-6 digits';
        error.classList.remove('hidden');
        return;
    }
    
    if (newPin !== confirm) {
        error.textContent = 'New PINs do not match';
        error.classList.remove('hidden');
        return;
    }
    
    try {
        changePin(oldPin, newPin);
        hideChangePinForm();
        hideLockscreenSettings();
        alert('PIN changed successfully!');
    } catch (e) {
        error.textContent = e.message;
        error.classList.remove('hidden');
    }
}

// ✅ PATCH: Expose functions to window for inline HTML onclick handlers
Object.assign(window, {
    initLockscreen,
    lockApp,
    enableLockscreen,
    disableLockscreen,
    changePin,
    forgotPin,
    setLockTimeout,
    getLockscreenStatus,
    isAppLocked,
    showLockscreenSettings,
    hideLockscreenSettings,
    showSetPinForm,
    hideSetPinForm,
    confirmSetPin,
    showChangePinForm,
    hideChangePinForm,
    confirmChangePin,
    resetAutoLockTimer
});

// Set up activity listeners on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupActivityListeners);
} else {
    setupActivityListeners();
}

// Export default for module imports
export default {
    initLockscreen,
    lockApp,
    enableLockscreen,
    disableLockscreen,
    changePin,
    forgotPin,
    setLockTimeout,
    getLockscreenStatus,
    isAppLocked,
    showLockscreenSettings,
    hideLockscreenSettings,
    resetAutoLockTimer
};