// js/app.js - WebPlanner Main Entry Point
// PATCHED: Expose markIncomplete and other CRUD functions to window for inline HTML handlers

import { state } from './state.js';
import { initAPI, getEvents, getExpenses, getIncome } from './api.js';
import { loadPlanner, showAddEventModal, editEvent, deleteEvent, markComplete, markIncomplete } from './planner-crud.js';
import { loadDashboard } from './dashboard.js';
import { loadExpenses } from './expenses.js';
import { loadIncome } from './income.js';
import { initFCM, enableNotifications } from './fcm-client.js';
import { loadNotificationHistory, clearNotificationHistory } from './notification-history.js';
import { initLockscreen } from './lockscreen.js';
import { nowAsDatetimeString } from './date-utils.js';

/**
 * Switch visible screen
 * @param {string} screenId - ID of the screen to show
 */
function switchScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
    }
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.target === screenId) {
            btn.classList.add('active');
        }
    });
    
    // Reload data based on screen
    if (screenId === 'screen-planner') {
        loadPlanner();
    } else if (screenId === 'screen-dashboard') {
        loadDashboard();
    } else if (screenId === 'screen-expenses') {
        loadExpenses();
    } else if (screenId === 'screen-income') {
        loadIncome();
    } else if (screenId === 'screen-notifications') {
        loadNotificationHistory();
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
}

/**
 * Initialize the application
 */
async function initApp() {
    console.log('WebPlanner initializing...');
    
    try {
        // Initialize API (create data files if missing)
        await initAPI();
        console.log('API initialized');
        
        // Initialize Lockscreen (if enabled)
        await initLockscreen();
        
        // Initialize FCM (Push Notifications)
        await initFCM();
        
        // Load initial data
        await loadPlanner();
        await loadDashboard();
        await loadExpenses();
        await loadIncome();
        
        console.log('WebPlanner ready');
    } catch (error) {
        console.error('Initialization failed:', error);
        alert('Failed to initialize app. Check console for details.');
    }
}

/**
 * Backup all data (triggered from Settings)
 */
async function backupAllData() {
    try {
        const data = {
            events: state.eventsData,
            expenses: state.expensesData,
            income: state.incomeData,
            backupDate: nowAsDatetimeString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `webplanner-backup-${nowAsDatetimeString().replace(/[: ]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('Backup downloaded successfully!');
    } catch (error) {
        console.error('Backup failed:', error);
        alert('Backup failed: ' + error.message);
    }
}

/**
 * Export data as JSON (alias for backup)
 */
async function exportJSON() {
    await backupAllData();
}

/**
 * Create snapshot (server-side)
 */
async function createSnapshot() {
    try {
        const formData = new FormData();
        formData.append('action', 'create_snapshot');
        
        const response = await fetch('php/api.php', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        if (result.success) {
            alert('Snapshot created successfully on server!');
        } else {
            alert('Snapshot failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Snapshot failed:', error);
        alert('Snapshot failed: ' + error.message);
    }
}

/**
 * Clear all data (Dangerous!)
 */
async function clearAllData() {
    if (!confirm('⚠️ WARNING: This will delete ALL events, expenses, and income data permanently. Continue?')) {
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('action', 'clear_all');
        
        const response = await fetch('php/api.php', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        if (result.success) {
            alert('All data cleared. Reloading...');
            location.reload();
        } else {
            alert('Clear failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Clear failed:', error);
        alert('Clear failed: ' + error.message);
    }
}

// ✅ PATCH: Expose functions to window for inline HTML onclick handlers
// This is necessary because modules are scoped and cannot be called from inline HTML directly
Object.assign(window, {
    switchScreen,
    showAddEventModal,
    editEvent,
    deleteEvent,
    markComplete,
    markIncomplete,  // ✅ NEW: Exposed for "Undo Complete" button
    enableNotifications,
    clearNotificationHistory,
    backupAllData,
    exportJSON,
    createSnapshot,
    clearAllData
});

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Export for potential use in other modules
export { initApp, switchScreen };