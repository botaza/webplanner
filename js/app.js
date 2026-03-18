// js/app.js

import { state } from './state.js';
import { isUnlocked, showLockScreen } from './lockscreen.js';
import { api } from './api.js';
import { switchScreen } from './utils.js';
import { loadPlanner, saveEvent } from './planner-crud.js';
import { loadExpenses, addExpense } from './expenses.js';
import { loadIncome } from './income.js';
import { loadDashboard } from './dashboard.js';
import { enableNotifications, updateNotifStatus } from './fcm-client.js';
import { loadNotifications } from './notification-history.js';
import { renderExpensesList } from './expenses-render.js';

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
    loadExpenses().then(expenses => {
        const container = document.getElementById('expenses-container');
        if (container) renderExpensesList(container, expenses);
    });
}

window.bootApp = bootApp;

window.onload = async () => {
    if (!isUnlocked()) {
        showLockScreen();
        return;
    }
    await bootApp();
};

// ── Hook Add Expense Button ───────────────────────────────────────────────
const addBtn = document.getElementById('btn-add-expense');
if (addBtn) {
    addBtn.addEventListener('click', async () => {
        const newExpense = {
            date: document.getElementById('expense-date')?.value || '',
            amount: parseFloat(document.getElementById('expense-amount')?.value || 0),
            category: document.getElementById('expense-category')?.value || '',
            tool: document.getElementById('expense-tool')?.value || '',
            desc: document.getElementById('expense-desc')?.value || ''
        };

        const expense = await addExpense(newExpense);

        // Re-render expenses list
        const container = document.getElementById('expenses-container');
        if (container) {
            const expenses = await loadExpenses();
            renderExpensesList(container, expenses);
        }

        // Clear modal / inputs if desired
        ['expense-date','expense-amount','expense-category','expense-tool','expense-desc'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    });
};

// ── Utilities ───────────────────────────────────────────────────────────
export function hideModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (id === 'modal-event') {
        // Reset to create mode when hiding
        const saveBtn = document.querySelector('#modal-event .flex.gap-3 button:last-child');
        if (saveBtn) {
            saveBtn.onclick = saveEvent;
            saveBtn.textContent = "Save Event";
        }
        const modalTitle = document.querySelector('#modal-event .text-xl.font-semibold');
        if (modalTitle) modalTitle.textContent = 'New Event';
    }
}

async function takeSnapshot() {
    const res = await api('snapshot');
    if (res.success) alert('Snapshot created!');
}

async function clearAllData() {
    if (!confirm('Clear ALL data permanently?')) return;
    await api('clear_all');
    location.reload();
}

async function exportData() {
    const exps = await api('get_expenses');
    const incs = await api('get_income');
    const evs = await api('get_events');
    const blob = new Blob(
        [JSON.stringify({events: evs, expenses: exps, income: incs}, null, 2)],
        {type: 'application/json'}
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'planner-backup.json';
    a.click();
    URL.revokeObjectURL(url);
}

function showMonthPicker(type) {
    alert("Month stats coming soon...");
}

Object.assign(window, {
    switchScreen,
    hideModal,
    takeSnapshot,
    clearAllData,
    exportData,
    showMonthPicker
});