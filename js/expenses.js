// js/expenses.js
// ORCHESTRATOR MODULE FOR EXPENSES
// Coordinates UI, CRUD, Rendering, Stats, and Housekeeping

import { state } from './state.js';
import { api } from './api.js';
import { hideModal } from './utils.js';
import { loadDashboard } from './dashboard.js';
import { todayString } from './date-utils.js';

// Import New Modular Components
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
    EXPENSE_TOOLS,
    EXPENSE_CATEGORIES
} from './expenses-ui.js';

import { 
    loadExpensesData, 
    saveExpenseData, 
    deleteExpenseData 
} from './expenses-crud.js';

import { 
    renderExpensesList 
} from './expenses-render.js';

import { 
    initExpenseStats,
    renderStatsContainer
} from './expenses-stats.js';

import { 
    initAdvancedFilter 
} from './expenses-advanced-filter.js';

import { 
    initHousekeepingUI 
} from './expenses-housekeeping.js';

// ── INITIALIZATION ──

/**
 * Initialize all expense-related modules
 * Called once when app boots or when switching to expenses screen
 */
export function initExpenses() {
    console.log('[expenses.js] Initializing modules...');
    
    // 1. Init UI (Buttons, Modal logic)
    initExpenseUI();
    
    // 2. Init Stats (View switching, charts)
    initExpenseStats();
    
    // 3. Init Advanced Filter (Limit input)
    // Only if container exists (will be added in HTML update)
    initAdvancedFilter('expenses-filter-controls');
    
    // 4. Init Housekeeping (Data management card)
    // Only if screen-more exists
    initHousekeepingUI();
    
    console.log('[expenses.js] Initialization complete');
}

// ── COORDINATION LOGIC ──

/**
 * Load expenses from backend and render list
 * Called by app.js/utils.js when switching to expenses screen
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

/**
 * Handle Save Expense Flow
 * 1. Get Data from UI
 * 2. Save to Backend
 * 3. Refresh List & Dashboard
 * 4. Close Modal
 */
async function handleSaveExpense() {
    // 1. Gather Data
    const formData = getExpenseFormData();
    if (!formData) return; // Validation failed inside UI module

    // 2. Save to Backend
    try {
        const res = await saveExpenseData(formData);
        if (res?.success) {
            // 3. Refresh Views
            await loadExpenses();
            await loadDashboard();
            
            // 4. Close Modal & Reset
            closeExpenseModal();
            resetExpenseForm();
        } else {
            alert("Could not save expense" + (res?.error ? `: ${res.error}` : ""));
        }
    } catch (err) {
        console.error('[expenses.js] Save error:', err);
        alert("Network/server error while saving expense");
    }
}

/**
 * Handle Delete Expense Flow
 * 1. Confirm
 * 2. Delete from Backend
 * 3. Refresh List & Dashboard
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

// ── UI WRAPPERS (For Window Exposure) ──

/**
 * Show Add Expense Modal
 * Resets form and opens modal
 */
function showAddExpenseModal() {
    // Reset Form Fields
    const dateEl = document.getElementById('exp-date');
    const amountEl = document.getElementById('exp-amount');
    const descEl = document.getElementById('exp-desc');
    const otherEl = document.getElementById('exp-tool-other');

    if (dateEl) dateEl.value = todayString();
    if (amountEl) amountEl.value = '';
    if (descEl) descEl.value = '';
    if (otherEl) otherEl.value = '';

    // Reset State
    state.selectedExpenseTool = null;
    state.selectedExpenseCategory = null;
    
    // Show Modal
    showExpenseModal();
    
    // Render Buttons
    renderExpenseTools(EXPENSE_TOOLS);
    renderExpenseCategories(EXPENSE_CATEGORIES);
    
    // Hide Other Input by default
    const otherGroup = document.getElementById('exp-tool-other-group');
    if (otherGroup) otherGroup.classList.add('hidden');
}

/**
 * Wrapper for Tool Selection
 * Updates state and UI via expenses-ui.js
 */
function selectExpenseTool(code) {
    handleToolSelect(code);
}

/**
 * Wrapper for Category Selection
 * Updates state and UI via expenses-ui.js
 */
function selectExpenseCategory(name) {
    handleCategorySelect(name);
}

/**
 * Refresh Stats View
 * Called when month/filter changes
 */
function refreshExpenseStats() {
    renderStatsContainer();
}

// ── GLOBAL EXPOSURE (For index.html onclick handlers) ──
Object.assign(window, {
    // Core Actions
    showAddExpenseModal,
    saveExpense: handleSaveExpense,
    deleteExpense: handleDeleteExpense,
    loadExpenses,
    
    // UI Selections
    selectExpenseTool,
    selectExpenseCategory,
    
    // Stats & Filters (Delegated to modules but exposed here for consistency)
    refreshExpenseStats,
    
    // Rendering Helpers (Used by init flows)
    renderExpenseTools: (tools) => renderExpenseTools(tools || EXPENSE_TOOLS),
    renderExpenseCategories: (cats) => renderExpenseCategories(cats || EXPENSE_CATEGORIES)
});

// Note: 
// - toggleExpenseMonth is exposed by expenses-list-view.js
// - applyExpenseFilter, setExpenseLimit are exposed by expenses-advanced-filter.js
// - showHousekeepingModal, etc. are exposed by expenses-housekeeping.js
// - This keeps window assignments distributed but coordinated.