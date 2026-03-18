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
    renderExpensesList,
    toggleExpenseMonth,
    toggleExpenseDay
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
    initAdvancedFilter('expenses-filter-controls');
    
    // 4. Init Housekeeping (Data management card)
    initHousekeepingUI();
    
    console.log('[expenses.js] Initialization complete');
}

// ── COORDINATION LOGIC ──

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

/**
 * Handle Save Expense Flow
 */
async function handleSaveExpense() {
    const formData = getExpenseFormData();
    if (!formData) return;

    try {
        const res = await saveExpenseData(formData);
        if (res?.success) {
            await loadExpenses();
            await loadDashboard();
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

function showAddExpenseModal() {
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
}

function selectExpenseTool(code) {
    handleToolSelect(code);
}

function selectExpenseCategory(name) {
    handleCategorySelect(name);
}

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
    
    // Stats Functions
    setStatsView,
    setStatsMonth,
    showStatsMonthPicker,
    refreshExpenseStats,
    
    // Expandable List Toggle Functions ← NEW FOR PATCH
    toggleExpenseMonth,
    toggleExpenseDay,
    
    // Rendering Helpers
    renderExpenseTools: (tools) => renderExpenseTools(tools || EXPENSE_TOOLS),
    renderExpenseCategories: (cats) => renderExpenseCategories(cats || EXPENSE_CATEGORIES)
});