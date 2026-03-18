// js/app.js

import { state } from './state.js';
import { isUnlocked, showLockScreen } from './lockscreen.js';
import { api } from './api.js';
import { switchScreen } from './utils.js';
import { loadPlanner } from './planner-crud.js';
import { loadExpenses } from './expenses.js';
import { loadIncome } from './income.js';
import { loadDashboard } from './dashboard.js';
import { enableNotifications, updateNotifStatus } from './fcm-client.js';
import { loadNotifications } from './notification-history.js';

async function bootApp() {
    await api('init');
    switchScreen('screen-planner');

    if (typeof firebase !== 'undefined') {
        state.messaging = firebase.messaging();
        await enableNotifications();
        updateNotifStatus();
    }

    // Optional initial loads
    loadDashboard();
}

window.bootApp = bootApp;

window.onload = async () => {
    if (!isUnlocked()) {
        showLockScreen();
        return;
    }
    await bootApp();
};
