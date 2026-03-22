// js/app.js
// UPDATED: Initialize income module at boot

import { state } from './state.js';
import { isUnlocked, showLockScreen } from './lockscreen.js';
import { api } from './api.js';
import { switchScreen } from './utils.js';
import { loadPlanner } from './planner-crud.js';
import { loadExpenses, initExpenses } from './expenses.js';
import { initIncome, loadIncome } from './income.js';
import { loadDashboard } from './dashboard.js';
import { enableNotifications, updateNotifStatus } from './fcm-client.js';
import { loadNotifications } from './notification-history.js';

async function bootApp() {
    // Initialize backend files if missing
    await api('init');

    // Default to planner screen
    switchScreen('screen-planner');

    // Initialize Firebase Messaging if available
    if (typeof firebase !== 'undefined') {
        state.messaging = firebase.messaging();
        await enableNotifications();
        updateNotifStatus();
    }

    // Initialize modules
    loadDashboard();
    initExpenses();
    initIncome();

    console.log('[app.js] Boot complete');
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
