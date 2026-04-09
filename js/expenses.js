// js/expenses.js
// ORCHESTRATOR MODULE FOR EXPENSES

import { requireAdmin } from './readonly-guard.js';
import { state } from './state.js';
import { hideModal } from './utils.js';
import { loadDashboard } from './dashboard.js';
import { todayString } from './date-utils.js';

import {
    initExpenseUI,
    showExpenseModal,
    renderExpenseTools,
    renderExpenseCategories,
    handleToolSelect,
    handleCategorySelect,
    getExpenseFormData,
    resetExpenseForm,
    populateExpenseForm,
    EXPENSE_TOOLS,
    EXPENSE_CATEGORIES
} from './expenses-ui.js';

import {
    loadExpensesData,
    saveExpenseData,
    updateExpenseData,
    deleteExpenseData
} from './expenses-crud.js';

import {
    renderExpensesList,
    toggleExpenseMonth,
    toggleExpenseDay,
    toggleStatsCategoryDrilldown
} from './expenses-render.js';

import {
    initExpenseStats,
    setStatsView,
    setStatsMonth,
    showStatsMonthPicker,
    renderStatsContainer
} from './expenses-stats.js';

import { initAdvancedFilter } from './expenses-advanced-filter.js';
import { initHousekeepingUI } from './expenses-housekeeping.js';

// ── EDIT STATE ──
let _editingExpenseId = null;

// ── MULTI-DATE STATE ──
let _extraExpenseDates = [];

export function initExpenses() {
    console.log('[expenses.js] Initializing...');
    initExpenseUI();
    initExpenseStats();
    initAdvancedFilter('expenses-filter-controls');
    initHousekeepingUI();
    console.log('[expenses.js] Initialization complete');
}

export async function loadExpenses() {
    try {
        const data = await loadExpensesData();
        state.expensesData = data || [];
        renderExpensesList(state.expensesData);
    } catch (err) {
        console.error('[expenses.js] Failed to load expenses:', err);
        const container = document.getElementById('expenses-list');
        if (container) container.innerHTML = `<div class="text-red-400 text-center py-10">Failed to load expenses</div>`;
    }
}

// ── MODAL CLOSE (always reset) ──
function closeExpenseModal() {
    _editingExpenseId = null;
    _extraExpenseDates = [];
    _setModalMode('add');
    _resetMultiDateUI();
    hideModal('modal-expense');
}

// ── ADD FLOW ──
function showAddExpenseModal() {
    _editingExpenseId = null;
    _extraExpenseDates = [];

    document.getElementById('exp-date').value = todayString();
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-desc').value = '';
    document.getElementById('exp-tool-other').value = '';

    state.selectedExpenseTool = null;
    state.selectedExpenseCategory = null;

    showExpenseModal();
    renderExpenseTools(EXPENSE_TOOLS);
    renderExpenseCategories(EXPENSE_CATEGORIES);
    document.getElementById('exp-tool-other-group')?.classList.add('hidden');

    _setModalMode('add');
    _resetMultiDateUI();
}

// ── EDIT FLOW ──
function editExpense(id) {
    const expense = state.expensesData.find(e => String(e.id) === String(id));
    if (!expense) return;

    _editingExpenseId = id;
    _extraExpenseDates = [];
    populateExpenseForm(expense);
    showExpenseModal();
    _setModalMode('edit');
    _resetMultiDateUI();
}

// ── SAVE ──
async function handleSaveExpense() {
    if (!requireAdmin()) return;
    const formData = getExpenseFormData();
    if (!formData) return;

    try {
        let res;
        if (_editingExpenseId) {
            res = await updateExpenseData(_editingExpenseId, formData);
        } else {
            res = await saveExpenseData(formData);

            // Save extra dates
            for (const extraDate of _extraExpenseDates) {
                if (extraDate !== formData.date) {
                    try {
                        await saveExpenseData({ ...formData, date: extraDate });
                    } catch (e) {
                        console.error('Extra date save failed:', e);
                    }
                }
            }
        }

        if (res?.success) {
            await loadExpenses();
            await loadDashboard();
            resetExpenseForm();
            closeExpenseModal();
        } else {
            alert('Could not save expense');
        }
    } catch (err) {
        console.error('[expenses.js] Save error:', err);
        alert('Network/server error');
    }
}

// ── DELETE ──
async function handleDeleteExpense(id) {
    if (!requireAdmin()) return;
    if (!confirm('Delete this expense?')) return;

    try {
        await deleteExpenseData(id);
        await loadExpenses();
        await loadDashboard();
    } catch (err) {
        console.error(err);
        alert('Failed to delete');
    }
}

// ── PRIVATE ──
function _setModalMode(mode) {
    const title = document.getElementById('exp-modal-title');
    const btn = document.getElementById('exp-save-btn');
    if (mode === 'edit') {
        title.textContent = 'Edit Expense';
        btn.textContent = 'Update Expense';
    } else {
        title.textContent = 'New Expense';
        btn.textContent = 'Save Expense';
    }
}

function _resetMultiDateUI() {
    _extraExpenseDates = [];
    const toggle = document.getElementById('exp-multi-date-toggle');
    const container = document.getElementById('exp-multi-date-container');
    const list = document.getElementById('exp-extra-dates-list');
    const preview = document.getElementById('exp-multi-date-preview');

    if (toggle) toggle.checked = false;
    if (container) container.classList.add('hidden');
    if (list) list.innerHTML = '';
    if (preview) preview.classList.add('hidden');
}

function toggleExpenseMultiDate() {
    const toggle = document.getElementById('exp-multi-date-toggle');
    const container = document.getElementById('exp-multi-date-container');
    if (toggle.checked) {
        container.classList.remove('hidden');
    } else {
        _resetMultiDateUI();
    }
}

function addExpenseExtraDate() {
    const input = document.getElementById('exp-extra-date-input');
    if (!input?.value) return;

    const date = input.value;
    const primary = document.getElementById('exp-date').value;

    if (date === primary) {
        alert('Same as primary date');
        return;
    }
    if (_extraExpenseDates.includes(date)) {
        alert('Already added');
        return;
    }

    _extraExpenseDates.push(date);
    _renderExtraDatesList();
    _updateMultiDatePreview();
}

function _removeExtraDate(date) {
    _extraExpenseDates = _extraExpenseDates.filter(d => d !== date);
    _renderExtraDatesList();
    _updateMultiDatePreview();
}

function _renderExtraDatesList() {
    const list = document.getElementById('exp-extra-dates-list');
    if (!list) return;

    list.innerHTML = _extraExpenseDates.map(date => {
        const formatted = new Date(date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
        return `
            <div class="flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-2">
                <span>📅 ${formatted}</span>
                <button onclick="window._removeExpenseExtraDate('${date}')" class="text-red-400 hover:text-red-300 text-xl">×</button>
            </div>`;
    }).join('');
}

function _updateMultiDatePreview() {
    const preview = document.getElementById('exp-multi-date-preview');
    const count = document.getElementById('exp-multi-date-count');
    if (!preview || !count) return;

    const total = 1 + _extraExpenseDates.length;
    if (_extraExpenseDates.length > 0) {
        count.textContent = total;
        preview.classList.remove('hidden');
    } else {
        preview.classList.add('hidden');
    }
}

function _getExtraExpenseDates() {
    return [..._extraExpenseDates];
}

// ── GLOBAL EXPOSURE ──
Object.assign(window, {
    showAddExpenseModal,
    saveExpense: handleSaveExpense,
    deleteExpense: handleDeleteExpense,
    editExpense,
    loadExpenses,
    closeExpenseModal,

    selectExpenseTool: (code) => handleToolSelect(code),
    selectExpenseCategory: (name) => handleCategorySelect(name),

    setStatsView,
    setStatsMonth,
    showStatsMonthPicker,
    refreshExpenseStats: renderStatsContainer,

    toggleStatsCategoryDrilldown,
    toggleExpenseMonth,
    toggleExpenseDay,

    renderExpenseTools: (t) => renderExpenseTools(t || EXPENSE_TOOLS),
    renderExpenseCategories: (c) => renderExpenseCategories(c || EXPENSE_CATEGORIES),

    toggleExpenseMultiDate,
    addExpenseExtraDate,
    _removeExpenseExtraDate: _removeExtraDate,
});