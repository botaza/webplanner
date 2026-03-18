// js/app.js
// UPDATED: Initialize expense modules at boot

import { state } from './state.js';
import { isUnlocked, showLockScreen } from './lockscreen.js';
import { api } from './api.js';
import { switchScreen } from './utils.js';
import { loadPlanner } from './planner-crud.js';
import { loadExpenses, initExpenses } from './expenses.js'; // Added initExpenses
import { loadIncome } from './income.js';
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
    
    // Initialize Modules
    // loadDashboard loads initial stats
    loadDashboard();
    
    // initExpenses sets up UI controls, stats containers, housekeeping card
    // This runs once at boot so elements are ready when switching screens
    initExpenses();
    
    console.log('[app.js] Boot complete');
}

// Expose bootApp to window for manual reloads if needed
window.bootApp = bootApp;

// Main Entry Point
window.onload = async () => {
    // Check lockscreen first
    if (!isUnlocked()) {
        showLockScreen();
        return;
    }
    
    // Boot the app
    await bootApp();
};