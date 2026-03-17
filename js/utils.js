// js/utils.js

import { state } from './state.js';
import { api } from './api.js';
import { loadPlanner } from './planner-crud.js';
import { loadExpenses } from './expenses.js';
import { loadIncome } from './income.js';
import { loadDashboard } from './dashboard.js';
import { updateNotifStatus } from './fcm-client.js';
import { loadNotifications } from './notification-history.js';
import { saveEvent } from './planner-crud.js';

export function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const idx = ['dashboard','planner','expenses','income','notifications','more']
        .indexOf(screenId.split('-')[1]);
    if (idx >= 0) document.querySelectorAll('.nav-item')[idx].classList.add('active');
    state.currentScreen = screenId;

    if (screenId === 'screen-planner') loadPlanner();
    if (screenId === 'screen-expenses') loadExpenses();
    if (screenId === 'screen-income') loadIncome();
    if (screenId === 'screen-dashboard') loadDashboard();
    if (screenId === 'screen-more') updateNotifStatus();
    if (screenId === 'screen-notifications') loadNotifications(1);
}

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
