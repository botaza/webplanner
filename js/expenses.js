// js/expenses.js
// ORCHESTRATOR MODULE FOR EXPENSES
// Coordinates UI, CRUD, Rendering, Stats, and Housekeeping
// UPDATED: Added editExpense and handleUpdateExpense for inline editing
// UPDATED: Exposed toggleStatsCategoryDrilldown to window
// FIXED: closeExpenseModal defined locally so Cancel/× always resets modal mode to Add

import { state } from './state.js';
import { api } from './api.js';
import { hideModal } from './utils.js';
import { loadDashboard } from './dashboard.js';
import { todayString } from './date-utils.js';

import {
    initExpenseUI,
    showExpenseModal,
    // NOTE: closeExpenseModal intentionally NOT imported from expenses-ui.js —
    // we define it locally below so it also resets the modal mode on every close.
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
    hideModal('modal-expense');
}

// ── ADD EXPENSE FLOW ──

function showAddExpenseModal() {
    _editingExpenseId = null;

    const dateEl   = document.getElementById('exp-date');
    const amountEl = document.getElementById('exp-amount');
    const descEl   = document.getElementById('exp-desc');
    const otherEl  = document.getElementById('exp-tool-other');
    if (dateEl)   dateEl.value   = todayString();
    if (amountEl) amountEl.value = '';
    if (descEl)   descEl.value   = '';
    if (otherEl)  otherEl.value  = '';

    state.selectedExpenseTool     = null;
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
            await loadExpenses();
            await loadDashboard();
            resetExpenseForm();
            closeExpenseModal(); // resets _editingExpenseId and mode internally
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
    const title   = document.getElementById('exp-modal-title');
    const saveBtn = document.getElementById('exp-save-btn');

    if (mode === 'edit') {
        if (title)   title.textContent   = 'Edit Expense';
        if (saveBtn) saveBtn.textContent = 'Update Expense';
    } else {
        if (title)   title.textContent   = 'New Expense';
        if (saveBtn) saveBtn.textContent = 'Save Expense';
    }
}

function selectExpenseTool(code)     { handleToolSelect(code); }
function selectExpenseCategory(name) { handleCategorySelect(name); }
function refreshExpenseStats()       { renderStatsContainer(); }

// ── GLOBAL EXPOSURE ──
Object.assign(window, {
    // Core actions
    showAddExpenseModal,
    saveExpense:       handleSaveExpense,
    deleteExpense:     handleDeleteExpense,
    editExpense,
    loadExpenses,

    // Expose local closeExpenseModal so any button in index.html can call it
    // and always get the mode-reset behaviour
    closeExpenseModal,

    // UI selections
    selectExpenseTool,
    selectExpenseCategory,

    // Stats functions
    setStatsView,
    setStatsMonth,
    showStatsMonthPicker,
    refreshExpenseStats,

    // Category drilldown toggle (called from renderCategoryDrilldown HTML)
    toggleStatsCategoryDrilldown,

    // Expandable list toggles
    toggleExpenseMonth,
    toggleExpenseDay,

    // Rendering helpers
    renderExpenseTools:      (tools) => renderExpenseTools(tools || EXPENSE_TOOLS),
    renderExpenseCategories: (cats)  => renderExpenseCategories(cats || EXPENSE_CATEGORIES)
});
