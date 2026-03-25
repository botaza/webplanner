// js/app.js
// UPDATED: Initialize income module at boot
// UPDATED: Skip FCM token registration for guest role

import { state } from './state.js';
import { isUnlocked, showLockScreen, getRole, isGuest } from './lockscreen.js';
import { api } from './api.js';
import { switchScreen } from './utils.js';
import { loadPlanner } from './planner-crud.js';
import { loadExpenses, initExpenses } from './expenses.js';
import { initIncome, loadIncome } from './income.js';
import { loadDashboard } from './dashboard.js';
import { enableNotifications, updateNotifStatus } from './fcm-client.js';
import { loadNotifications } from './notification-history.js';

async function bootApp() {
    // Store role in shared state so other modules can read it
    state.role = getRole(); // 'admin' | 'guest'

    // Initialize backend files if missing
    await api('init');

    // Default to planner screen
    switchScreen('screen-planner');

    // FCM: only register / request token for admin users
    if (typeof firebase !== 'undefined') {
        state.messaging = firebase.messaging();
        if (!isGuest()) {
            await enableNotifications();
        }
        updateNotifStatus();
    }

    // Initialize modules
    loadDashboard();
    initExpenses();
    initIncome();

    // Show a subtle guest-mode banner so the user knows they're in view-only mode
    if (isGuest()) {
        _showGuestBanner();
        // Hide write buttons declared in index.html
        if (typeof window._applyGuestUI === "function") window._applyGuestUI();
    }

    console.log(`[app.js] Boot complete — role: ${state.role}`);
}

function _showGuestBanner() {
    const banner = document.createElement('div');
    banner.id = 'guest-banner';
    banner.style.cssText = [
        'position:fixed',
        'top:0',
        'left:0',
        'right:0',
        'background:#78716c',
        'color:#fff',
        'text-align:center',
        'font-size:13px',
        'padding:6px 12px',
        'z-index:500',
        'letter-spacing:0.3px'
    ].join(';');
    banner.textContent = '👁 View-only mode';
    document.body.prepend(banner);
}

// Expose bootApp to window for lockscreen callback
window.bootApp = bootApp;

// Main entry point
window.onload = async () => {
    if (!isUnlocked()) {
        showLockScreen();
        return;
    }
    await bootApp();
};
