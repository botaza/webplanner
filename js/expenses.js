// js/expenses.js
// ORCHESTRATOR MODULE FOR EXPENSES
// Coordinates UI, CRUD, Rendering, Stats, and Housekeeping
// UPDATED: Added editExpense and handleUpdateExpense for inline editing
// UPDATED: Exposed toggleStatsCategoryDrilldown to window
// FIXED: closeExpenseModal defined locally so Cancel/× always resets modal mode to Add

import { requireAdmin } from './readonly-guard.js';
import { state } from './state.js';
import { api } from './api.js';
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

import {
    initAdvancedFilter
} from './expenses-advanced-filter.js';

import {
    initHousekeepingUI
} from './expenses-housekeeping.js';

// ── EDIT STATE ──
// Holds the ID of the expense currently being edited, or null if adding new
let _editingExpenseId = null;

// ── INITIALIZATION ──
export function initExpenses() {
    console.log('[expenses.js] Initializing modules...');
    initExpenseUI();
    initExpenseStats();
    initAdvancedFilter('expenses-filter-controls');
    initHousekeepingUI();
    console.log('[expenses.js] Initialization complete');
}

// ── LOAD & RENDER ──
export async function loadExpenses() {
    try {
        const data = await loadExpensesData();
        state.expensesData = data || [];
        renderExpensesList(state.expensesData);
    } catch (err) {
        console.error('[expenses.js] Failed to load expenses:', err);
        const container = document.getElementById('expenses-list');
        if (container) {
            container.innerHTML = `<div class="text-red-400 text-center py-10">Failed to load expenses</div>`;
        }
    }
}

// ── MODAL OPEN / CLOSE ──
/**
 * Close the expense modal and always reset to Add mode.
 * Defined here (not imported from expenses-ui.js) so we can also clear
 * _editingExpenseId and restore the title/button on every close path
 * — including Cancel button, × button, and post-save.
 */
function closeExpenseModal() {
    _editingExpenseId = null;
    _setModalMode('add');
    _resetMultiDateUI();
    hideModal('modal-expense');
}

// ── ADD EXPENSE FLOW ──
function showAddExpenseModal() {
    _editingExpenseId = null;
    const dateEl = document.getElementById('exp-date');
    const amountEl = document.getElementById('exp-amount');
    const descEl = document.getElementById('exp-desc');
    const otherEl = document.getElementById('exp-tool-other');
    
    if (dateEl) dateEl.value = todayString();
    if (amountEl) amountEl.value = '';
    if (descEl) descEl.value = '';
    if (otherEl) otherEl.value = '';

    state.selectedExpenseTool = null;
    state.selectedExpenseCategory = null;

    showExpenseModal();
    renderExpenseTools(EXPENSE_TOOLS);
    renderExpenseCategories(EXPENSE_CATEGORIES);

    const otherGroup = document.getElementById('exp-tool-other-group');
    if (otherGroup) otherGroup.classList.add('hidden');

    _setModalMode('add');
}

// ── EDIT EXPENSE FLOW ──
function editExpense(id) {
    const expense = (state.expensesData || []).find(e => String(e.id) === String(id));
    if (!expense) {
        console.error('[expenses.js] editExpense: expense not found', id);
        return;
    }
    _editingExpenseId = id;
    populateExpenseForm(expense);
    showExpenseModal();
    _setModalMode('edit');
}

// ── SAVE / UPDATE ──
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
        }

        if (res?.success) {
            // Save extra-date copies (only when adding new, not editing)
            if (!_editingExpenseId) {
                const extraDates = _getExtraExpenseDates();
                for (const extraDate of extraDates) {
                    try {
                        await saveExpenseData({ ...formData, date: extraDate });
                    } catch (e) {
                        console.error('[expenses.js] Failed to save extra-date expense:', e);
                    }
                }
            }

            await loadExpenses();
            await loadDashboard();
            resetExpenseForm();
            closeExpenseModal();
        } else {
            alert('Could not save expense' + (res?.error ? `: ${res.error}` : ''));
        }
    } catch (err) {
        console.error('[expenses.js] Save/update error:', err);
        alert('Network/server error while saving expense');
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
        console.error('[expenses.js] Delete error:', err);
        alert('Failed to delete expense');
    }
}

// ── PRIVATE HELPERS ──
function _setModalMode(mode) {
    const title = document.getElementById('exp-modal-title');
    const saveBtn = document.getElementById('exp-save-btn');
    
    if (mode === 'edit') {
        if (title) title.textContent = 'Edit Expense';
        if (saveBtn) saveBtn.textContent = 'Update Expense';
    } else {
        if (title) title.textContent = 'New Expense';
        if (saveBtn) saveBtn.textContent = 'Save Expense';
    }
}

function selectExpenseTool(code) { handleToolSelect(code); }
function selectExpenseCategory(name) { handleCategorySelect(name); }
function refreshExpenseStats() { renderStatsContainer(); }

// ── MULTI-DATE HELPERS ──
let _extraExpenseDates = [];

function _resetMultiDateUI() {
    _extraExpenseDates = [];
    const toggle = document.getElementById('exp-multi-date-toggle');
    const container = document.getElementById('exp-multi-date-container');
    const input = document.getElementById('exp-extra-date-input');
    const list = document.getElementById('exp-extra-dates-list');
    const preview = document.getElementById('exp-multi-date-preview');

    if (toggle) toggle.checked = false;
    if (container) container.classList.add('hidden');
    if (input) input.value = '';
    if (list) list.innerHTML = '';
    if (preview) preview.classList.add('hidden');
}

function toggleExpenseMultiDate() {
    const toggle = document.getElementById('exp-multi-date-toggle');
    const container = document.getElementById('exp-multi-date-container');
    if (!toggle || !container) return;

    if (toggle.checked) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
        _extraExpenseDates = [];
        const list = document.getElementById('exp-extra-dates-list');
        if (list) list.innerHTML = '';
        _updateMultiDatePreview();
    }
}

function addExpenseExtraDate() {
    const input = document.getElementById('exp-extra-date-input');
    if (!input || !input.value) return;

    const date = input.value;
    const primaryDate = document.getElementById('exp-date')?.value;

    if (date === primaryDate) {
        alert('This is the same as the primary date. It will already be saved there.');
        return;
    }
    if (_extraExpenseDates.includes(date)) {
        alert('This date is already in the list.');
        return;
    }

    _extraExpenseDates.push(date);
    input.value = '';
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
        const formatted = new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
        });
        return `<div class="flex items-center justify-between bg-zinc-800 rounded-xl px-4 py-2">
            <span class="text-sm text-zinc-200">📅 ${formatted}</span>
            <button type="button" onclick="window._removeExpenseExtraDate('${date}')" class="text-zinc-500 hover:text-red-400 text-lg leading-none ml-3">×</button>
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
    // Core actions
    showAddExpenseModal,
    saveExpense: handleSaveExpense,
    deleteExpense: handleDeleteExpense,
    editExpense,
    loadExpenses,
    closeExpenseModal,

    // UI selections
    selectExpenseTool,
    selectExpenseCategory,

    // Stats functions
    setStatsView,
    setStatsMonth,
    showStatsMonthPicker,
    refreshExpenseStats,

    // Category drilldown toggle
    toggleStatsCategoryDrilldown,

    // Expandable list toggles
    toggleExpenseMonth,
    toggleExpenseDay,

    // Rendering helpers
    renderExpenseTools: (tools) => renderExpenseTools(tools || EXPENSE_TOOLS),
    renderExpenseCategories: (cats) => renderExpenseCategories(cats || EXPENSE_CATEGORIES),

    // Multi-date helpers
    toggleExpenseMultiDate,
    addExpenseExtraDate,
    _removeExpenseExtraDate: _removeExtraDate,
});