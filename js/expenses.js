// js/expenses.js
// ORCHESTRATOR MODULE FOR EXPENSES
// Coordinates UI, CRUD, Rendering, Stats, and Housekeeping
// UPDATED: Added editExpense and handleUpdateExpense for inline editing
// UPDATED: Exposed toggleStatsCategoryDrilldown to window

import { state } from './state.js';
import { api } from './api.js';
import { hideModal } from './utils.js';
import { loadDashboard } from './dashboard.js';
import { todayString } from './date-utils.js';

import {
    initExpenseUI,
    showExpenseModal,
    closeExpenseModal,
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

/**
 * Initialize all expense-related modules
 * Called once when app boots or when switching to expenses screen
 */
export function initExpenses() {
    console.log('[expenses.js] Initializing modules...');
    initExpenseUI();
    initExpenseStats();
    initAdvancedFilter('expenses-filter-controls');
    initHousekeepingUI();
    console.log('[expenses.js] Initialization complete');
}

// ── LOAD & RENDER ──

/**
 * Load expenses from backend and render list
 */
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

// ── ADD EXPENSE FLOW ──

/**
 * Open the modal in Add mode (blank form)
 */
function showAddExpenseModal() {
    _editingExpenseId = null;

    // Reset all fields
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

    // Set modal title and button label to Add mode
    _setModalMode('add');
}

// ── EDIT EXPENSE FLOW ──

/**
 * Open the modal pre-populated with an existing expense's values.
 * @param {string} id - Expense ID to edit
 */
function editExpense(id) {
    const expense = (state.expensesData || []).find(e => String(e.id) === String(id));
    if (!expense) {
        console.error('[expenses.js] editExpense: expense not found', id);
        return;
    }

    _editingExpenseId = id;

    // Pre-fill the form (renders tool + category buttons in correct active state)
    populateExpenseForm(expense);

    showExpenseModal();

    // Set modal title and button label to Edit mode
    _setModalMode('edit');
}

/**
 * Handle Save button — routes to add or update depending on _editingExpenseId
 */
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
            closeExpenseModal();
            resetExpenseForm();
            _editingExpenseId = null;
        } else {
            alert('Could not save expense' + (res?.error ? `: ${res.error}` : ''));
        }
    } catch (err) {
        console.error('[expenses.js] Save/update error:', err);
        alert('Network/server error while saving expense');
    }
}

// ── DELETE EXPENSE FLOW ──

/**
 * Handle Delete Expense
 * @param {string} id - Expense ID
 */
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

// ── HELPERS ──

/**
 * Switch the modal title and save-button label between Add and Edit modes.
 * @param {'add'|'edit'} mode
 */
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

/**
 * Selector wrappers (keep the window API clean)
 */
function selectExpenseTool(code)     { handleToolSelect(code); }
function selectExpenseCategory(name) { handleCategorySelect(name); }

/**
 * Stats refresh — called by toggle handlers in expenses-render.js
 */
function refreshExpenseStats() {
    renderStatsContainer();
}

// ── GLOBAL EXPOSURE ──
Object.assign(window, {
    // Core actions
    showAddExpenseModal,
    saveExpense:    handleSaveExpense,
    deleteExpense:  handleDeleteExpense,
    editExpense,
    loadExpenses,

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
