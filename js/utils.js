// js/utils.js
// UPDATED: Added guestbook support to switchScreen + new guestbook functions
// UPDATED: More screen now also calls loadTokenManager()

import { state } from './state.js';
import { api } from './api.js';
import { loadPlanner } from './planner-crud.js';
import { loadExpenses } from './expenses.js';
import { loadIncome } from './income.js';
import { loadShopping } from './shopping.js';
import { loadDashboard } from './dashboard.js';
import { updateNotifStatus } from './fcm-client.js';
import { loadNotifications } from './notification-history.js';
import { loadGuestbook } from './guestbook.js';

export function switchScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));

  const screenName = screenId.replace('screen-', '');
  const navItems   = document.querySelectorAll('.nav-item');
  const idxMap = {
    'dashboard':     0,
    'planner':       1,
    'expenses':      2,
    'income':        3,
    'shopping':      4,
    'notifications': 5,
    'more':          6,
    'guestbook':     7
  };

  const idx = idxMap[screenName];
  if (idx !== undefined && navItems[idx]) {
    navItems[idx].classList.add('active');
  }

  state.currentScreen = screenId;

  // Load data for the screen
  if (screenId === 'screen-planner')       loadPlanner();
  if (screenId === 'screen-expenses')      loadExpenses();
  if (screenId === 'screen-income')        loadIncome();
  if (screenId === 'screen-shopping')      loadShopping();
  if (screenId === 'screen-dashboard')     loadDashboard();
  if (screenId === 'screen-more') {
    updateNotifStatus();
    if (typeof window.loadTokenManager === 'function') window.loadTokenManager();
  }
  if (screenId === 'screen-notifications') loadNotifications(1);
  if (screenId === 'screen-guestbook')     loadGuestbook();
}

export function hideModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  // Reset event modal title and button if closing event modal
  if (id === 'modal-event') {
    const saveBtn = document.querySelector('#modal-event .flex.gap-3 button:last-child');
    if (saveBtn) {
      saveBtn.onclick = saveEvent;
      saveBtn.textContent = 'Save Event';
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
  const evs  = await api('get_events');
  const blob = new Blob(
    [JSON.stringify({ events: evs, expenses: exps, income: incs }, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url;
  a.download = 'planner-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

Object.assign(window, {
  switchScreen,
  hideModal,
  takeSnapshot,
  clearAllData,
  exportData
});
