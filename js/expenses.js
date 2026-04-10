// js/expenses.js
// ORCHESTRATOR MODULE FOR EXPENSES
// Coordinates UI, CRUD, Rendering, Stats, and Housekeeping
// UPDATED: Added editExpense and handleUpdateExpense for inline editing
// UPDATED: Exposed toggleStatsCategoryDrilldown to window
// FIXED: closeExpenseModal defined locally so Cancel/× always resets modal mode to Add
// PATCHED: Multi-date support for add flow
// PATCHED: Future-expense filter for main list view

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
let _editingExpenseId = null;

// ── MULTI-DATE STATE ──
let _multiDateMode = false;
let _selectedDates = [];

// ── FUTURE FILTER STATE ──
let _futureFilterActive = false;

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

        const listToRender = _futureFilterActive
            ? state.expensesData.filter(e => e.category === 'future')
            : state.expensesData;

        renderExpensesList(listToRender);
        _updateFutureFilterUI();
    } catch (err) {
        console.error('[expenses.js] Failed to load expenses:', err);
        const container = document.getElementById('expenses-list');
        if (container) {
            container.innerHTML = `<div class="text-red-400 text-center py-10">Failed to load expenses</div>`;
        }
    }
}

// ── FUTURE FILTER ──

function toggleFutureFilter() {
    _futureFilterActive = !_futureFilterActive;
    const listToRender = _futureFilterActive
        ? (state.expensesData || []).filter(e => e.category === 'future')
        : (state.expensesData || []);
    renderExpensesList(listToRender);
    _updateFutureFilterUI();
}

function clearFutureFilter() {
    _futureFilterActive = false;
    renderExpensesList(state.expensesData || []);
    _updateFutureFilterUI();
}

function _updateFutureFilterUI() {
    const filterBtn  = document.getElementById('exp-future-filter-btn');
    const activePill = document.getElementById('exp-future-filter-active');

    if (filterBtn) {
        if (_futureFilterActive) {
            filterBtn.classList.add('bg-violet-700', 'text-white');
            filterBtn.classList.remove('bg-zinc-800', 'text-zinc-200');
        } else {
            filterBtn.classList.remove('bg-violet-700', 'text-white');
            filterBtn.classList.add('bg-zinc-800', 'text-zinc-200');
        }
    }

    if (activePill) {
        if (_futureFilterActive) {
            activePill.classList.remove('hidden');
        } else {
            activePill.classList.add('hidden');
        }
    }
}

// ── MODAL OPEN / CLOSE ──

function closeExpenseModal() {
    _editingExpenseId = null;
    _multiDateMode = false;
    _selectedDates = [];
    _setModalMode('add');
    _resetMultiDateUI();
    hideModal('modal-expense');
}

// ── ADD EXPENSE FLOW ──

function showAddExpenseModal() {
    _editingExpenseId = null;
    _multiDateMode = false;
    _selectedDates = [];

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
    _resetMultiDateUI();
}

// ── EDIT EXPENSE FLOW ──

function editExpense(id) {
    const expense = (state.expensesData || []).find(e => String(e.id) === String(id));
    if (!expense) {
        console.error('[expenses.js] editExpense: expense not found', id);
        return;
    }

    _editingExpenseId = id;
    _multiDateMode = false;
    _selectedDates = [];
    _resetMultiDateUI();

    populateExpenseForm(expense);
    showExpenseModal();
    _setModalMode('edit');
}

// ── MULTI-DATE HELPERS ──

function toggleMultiDateMode() {
    if (_editingExpenseId) return;

    _multiDateMode = !_multiDateMode;

    const btn       = document.getElementById('exp-multi-date-btn');
    const panel     = document.getElementById('exp-multi-date-panel');
    const singleRow = document.getElementById('exp-single-date-row');

    if (_multiDateMode) {
        const current = document.getElementById('exp-date')?.value;
        _selectedDates = current ? [current] : [];

        if (btn)       { btn.textContent = '📅 Single date'; btn.classList.add('active'); }
        if (panel)     panel.classList.remove('hidden');
        if (singleRow) singleRow.classList.add('hidden');
        _renderDateChips();
    } else {
        const fallback = _selectedDates[0] || todayString();
        const dateEl = document.getElementById('exp-date');
        if (dateEl) dateEl.value = fallback;
        _selectedDates = [];

        if (btn)       { btn.textContent = '📅 Multi-date'; btn.classList.remove('active'); }
        if (panel)     panel.classList.add('hidden');
        if (singleRow) singleRow.classList.remove('hidden');
    }
}

function addMultiDate() {
    const picker = document.getElementById('exp-multi-date-picker');
    if (!picker || !picker.value) return;
    const val = picker.value;
    if (!_selectedDates.includes(val)) {
        _selectedDates.push(val);
        _selectedDates.sort();
        _renderDateChips();
    }
    picker.value = '';
}

function removeMultiDate(dateStr) {
    _selectedDates = _selectedDates.filter(d => d !== dateStr);
    _renderDateChips();
}

function _renderDateChips() {
    const container = document.getElementById('exp-date-chips');
    const countEl   = document.getElementById('exp-multi-date-count');

    if (countEl) {
        countEl.textContent = _selectedDates.length
            ? `${_selectedDates.length} date${_selectedDates.length > 1 ? 's' : ''} selected`
            : 'No dates selected';
    }

    if (!container) return;

    if (_selectedDates.length === 0) {
        container.innerHTML = '<span class="text-xs text-zinc-500 italic">Add dates below</span>';
        return;
    }

    container.innerHTML = _selectedDates.map(d => {
        const label = new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
        return `
            <div class="flex items-center gap-1 bg-zinc-800 border border-zinc-700
                        rounded-2xl px-3 py-1.5 text-sm text-zinc-200">
                <span>${label}</span>
                <button onclick="window.removeMultiDate('${d}')"
                        class="ml-1 text-zinc-500 hover:text-red-400 leading-none text-lg"
                        title="Remove">×</button>
            </div>`;
    }).join('');
}

function _resetMultiDateUI() {
    const btn       = document.getElementById('exp-multi-date-btn');
    const panel     = document.getElementById('exp-multi-date-panel');
    const singleRow = document.getElementById('exp-single-date-row');

    if (btn)       { btn.textContent = '📅 Multi-date'; btn.classList.remove('active'); }
    if (panel)     panel.classList.add('hidden');
    if (singleRow) singleRow.classList.remove('hidden');

    const countEl = document.getElementById('exp-multi-date-count');
    if (countEl) countEl.textContent = 'No dates selected';

    const chips = document.getElementById('exp-date-chips');
    if (chips) chips.innerHTML = '<span class="text-xs text-zinc-500 italic">Add dates below</span>';
}

// ── SAVE / UPDATE ──

async function handleSaveExpense() {
    if (!requireAdmin()) return;

    if (_editingExpenseId) {
        const formData = getExpenseFormData();
        if (!formData) return;
        try {
            const res = await updateExpenseData(_editingExpenseId, formData);
            if (res?.success) {
                await loadExpenses();
                await loadDashboard();
                resetExpenseForm();
                closeExpenseModal();
            } else {
                alert('Could not update expense' + (res?.error ? `: ${res.error}` : ''));
            }
        } catch (err) {
            console.error('[expenses.js] Update error:', err);
            alert('Network/server error while updating expense');
        }
        return;
    }

    const formData = getExpenseFormData();
    if (!formData) return;

    let datesToSave;
    if (_multiDateMode) {
        if (_selectedDates.length === 0) {
            alert('Please add at least one date in multi-date mode');
            return;
        }
        datesToSave = [..._selectedDates];
    } else {
        datesToSave = [formData.date];
    }

    try {
        let allOk = true;
        for (const date of datesToSave) {
            const res = await saveExpenseData({ ...formData, date });
            if (!res?.success) {
                allOk = false;
                console.error('[expenses.js] Failed to save for date', date, res);
            }
        }

        if (allOk) {
            await loadExpenses();
            await loadDashboard();
            resetExpenseForm();
            closeExpenseModal();
            if (datesToSave.length > 1) {
                _showToast(`✅ ${datesToSave.length} expenses saved`);
            }
        } else {
            alert('One or more expenses could not be saved — check console for details.');
            await loadExpenses();
            await loadDashboard();
        }
    } catch (err) {
        console.error('[expenses.js] Save error:', err);
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
    const title    = document.getElementById('exp-modal-title');
    const saveBtn  = document.getElementById('exp-save-btn');
    const multiBtn = document.getElementById('exp-multi-date-btn');

    if (mode === 'edit') {
        if (title)    title.textContent   = 'Edit Expense';
        if (saveBtn)  saveBtn.textContent = 'Update Expense';
        if (multiBtn) multiBtn.classList.add('hidden');
    } else {
        if (title)    title.textContent   = 'New Expense';
        if (saveBtn)  saveBtn.textContent = 'Save Expense';
        if (multiBtn) multiBtn.classList.remove('hidden');
    }
}

function _showToast(msg) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = [
        'position:fixed',
        'bottom:90px',
        'left:50%',
        'transform:translateX(-50%)',
        'background:#22c55e',
        'color:#fff',
        'padding:10px 20px',
        'border-radius:999px',
        'font-size:14px',
        'font-weight:500',
        'z-index:9999',
        'pointer-events:none',
        'transition:opacity 0.4s'
    ].join(';');
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 1800);
    setTimeout(() => el.remove(), 2300);
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
    closeExpenseModal,

    // UI selections
    selectExpenseTool,
    selectExpenseCategory,

    // Multi-date
    toggleMultiDateMode,
    addMultiDate,
    removeMultiDate,

    // Future filter
    toggleFutureFilter,
    clearFutureFilter,

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
    renderExpenseTools:      (tools) => renderExpenseTools(tools || EXPENSE_TOOLS),
    renderExpenseCategories: (cats)  => renderExpenseCategories(cats || EXPENSE_CATEGORIES)
});
