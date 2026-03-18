// js/expenses.js - WebPlanner Expense Management
// PATCHED: Consistent with completed event architecture, proper state management

import { state } from './state.js';
import { api, getExpenses, addExpense, updateExpense, deleteExpense } from './api.js';
import { hideModal } from './utils.js';
import { nowDateLocal } from './date-utils.js';
import { loadDashboard } from './dashboard.js';

// Predefined expense categories
const EXPENSE_CATEGORIES = [
    'Food',
    'Transport',
    'Shopping',
    'Entertainment',
    'Bills',
    'Health',
    'Education',
    'Travel',
    'Other'
];

// Predefined payment tools
const EXPENSE_TOOLS = [
    'Cash',
    'Card',
    'Bank Transfer',
    'Crypto',
    'Other'
];

/**
 * Initialize expense screen with default values
 */
function initExpenseModal() {
    document.getElementById('exp-date').value = nowDateLocal();
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-desc').value = '';
    
    // Clear any previous selections
    document.querySelectorAll('#exp-category-buttons .category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('#exp-tool-buttons .tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
}

/**
 * Render category selection buttons
 */
function renderCategoryButtons() {
    const container = document.getElementById('exp-category-buttons');
    if (!container) return;
    
    container.innerHTML = '';
    
    EXPENSE_CATEGORIES.forEach(cat => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'category-btn';
        btn.textContent = cat;
        btn.onclick = () => selectCategory(cat, btn);
        container.appendChild(btn);
    });
}

/**
 * Render tool/payment method buttons
 */
function renderToolButtons() {
    const container = document.getElementById('exp-tool-buttons');
    if (!container) return;
    
    container.innerHTML = '';
    
    EXPENSE_TOOLS.forEach(tool => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tool-btn';
        btn.textContent = tool;
        btn.onclick = () => selectTool(tool, btn);
        container.appendChild(btn);
    });
}

/**
 * Select a category
 * @param {string} category - Selected category
 * @param {HTMLElement} btn - Button element
 */
function selectCategory(category, btn) {
    // Clear previous selections
    document.querySelectorAll('#exp-category-buttons .category-btn').forEach(b => {
        b.classList.remove('active');
    });
    
    // Set new selection
    btn.classList.add('active');
    state.ui.selectedCategory = category;
}

/**
 * Select a payment tool
 * @param {string} tool - Selected tool
 * @param {HTMLElement} btn - Button element
 */
function selectTool(tool, btn) {
    // Clear previous selections
    document.querySelectorAll('#exp-tool-buttons .tool-btn').forEach(b => {
        b.classList.remove('active');
    });
    
    // Set new selection
    btn.classList.add('active');
    state.ui.selectedTool = tool;
}

/**
 * Show add expense modal
 */
export function showAddExpenseModal() {
    initExpenseModal();
    renderCategoryButtons();
    renderToolButtons();
    
    // Reset save button
    const saveBtn = document.querySelector('#modal-expense .flex.gap-3 button:last-child');
    if (saveBtn) {
        saveBtn.textContent = 'Save Expense';
        saveBtn.onclick = saveExpense;
    }
    
    // Update modal title
    const modalTitle = document.querySelector('#modal-expense .text-lg.font-semibold');
    if (modalTitle) modalTitle.textContent = 'New Expense';
    
    document.getElementById('modal-expense').classList.remove('hidden');
    document.getElementById('modal-expense').classList.add('flex');
}

/**
 * Save new expense
 */
export async function saveExpense() {
    const dt = document.getElementById('exp-date').value;
    const amount = document.getElementById('exp-amount').value;
    
    if (!dt) {
        alert('Please select a date');
        return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    const expense = {
        dt: dt,
        amount: parseFloat(amount),
        tool: state.ui.selectedTool || '',
        category: state.ui.selectedCategory || '',
        desc: document.getElementById('exp-desc').value.trim()
    };
    
    try {
        const res = await addExpense(expense);
        if (res.success) {
            hideModal('modal-expense');
            await loadExpenses();
            await loadDashboard();
        } else {
            alert('Save failed: ' + (res.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Save expense error:', error);
        alert('Error saving expense: ' + error.message);
    }
}

/**
 * Edit existing expense
 * @param {string} id - Expense ID
 */
export async function editExpense(id) {
    const expense = state.expensesData.find(e => e.id == id);
    if (!expense) {
        console.error('Expense not found:', id);
        return;
    }
    
    // Populate form
    document.getElementById('exp-date').value = expense.dt || nowDateLocal();
    document.getElementById('exp-amount').value = expense.amount || '';
    document.getElementById('exp-desc').value = expense.desc || '';
    
    // Select category
    if (expense.category) {
        document.querySelectorAll('#exp-category-buttons .category-btn').forEach(btn => {
            if (btn.textContent === expense.category) {
                btn.classList.add('active');
                state.ui.selectedCategory = expense.category;
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    // Select tool
    if (expense.tool) {
        document.querySelectorAll('#exp-tool-buttons .tool-btn').forEach(btn => {
            if (btn.textContent === expense.tool) {
                btn.classList.add('active');
                state.ui.selectedTool = expense.tool;
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    // Update save button
    const saveBtn = document.querySelector('#modal-expense .flex.gap-3 button:last-child');
    if (saveBtn) {
        saveBtn.textContent = 'Update Expense';
        saveBtn.onclick = () => updateExpenseById(id);
    }
    
    // Update modal title
    const modalTitle = document.querySelector('#modal-expense .text-lg.font-semibold');
    if (modalTitle) modalTitle.textContent = 'Edit Expense';
    
    // Render buttons if not already rendered
    renderCategoryButtons();
    renderToolButtons();
    
    document.getElementById('modal-expense').classList.remove('hidden');
    document.getElementById('modal-expense').classList.add('flex');
}

/**
 * Update existing expense
 * @param {string} id - Expense ID
 */
export async function updateExpenseById(id) {
    const dt = document.getElementById('exp-date').value;
    const amount = document.getElementById('exp-amount').value;
    
    if (!dt) {
        alert('Please select a date');
        return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    const expense = {
        dt: dt,
        amount: parseFloat(amount),
        tool: state.ui.selectedTool || '',
        category: state.ui.selectedCategory || '',
        desc: document.getElementById('exp-desc').value.trim()
    };
    
    try {
        const res = await updateExpense(id, expense);
        if (res.success) {
            hideModal('modal-expense');
            await loadExpenses();
            await loadDashboard();
        } else {
            alert('Update failed: ' + (res.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Update expense error:', error);
        alert('Error updating expense: ' + error.message);
    }
}

/**
 * Delete expense
 * @param {string} id - Expense ID
 */
export async function deleteExpenseById(id) {
    if (!confirm('Delete this expense? This cannot be undone.')) {
        return;
    }
    
    try {
        await deleteExpense(id);
        await loadExpenses();
        await loadDashboard();
    } catch (error) {
        console.error('Delete expense error:', error);
        alert('Error deleting expense: ' + error.message);
    }
}

/**
 * Load and render expenses list
 */
export async function loadExpenses() {
    try {
        const data = await getExpenses();
        state.expensesData = data || [];
        renderExpensesList();
    } catch (error) {
        console.error('Load expenses error:', error);
        document.getElementById('expenses-list').innerHTML = `
            <div class="text-center text-red-400 py-8">Failed to load expenses</div>
        `;
    }
}

/**
 * Render expenses list grouped by month
 */
function renderExpensesList() {
    const container = document.getElementById('expenses-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!state.expensesData || !state.expensesData.length) {
        container.innerHTML = `
            <div class="text-center text-zinc-500 py-12">
                <div class="text-5xl mb-4">💸</div>
                <h3 class="text-lg font-medium text-zinc-300 mb-2">No expenses yet</h3>
                <p class="text-sm mb-4">Track your spending by adding your first expense</p>
                <button onclick="showAddExpenseModal()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl font-medium transition-colors">
                    + Add Expense
                </button>
            </div>
        `;
        return;
    }
    
    // Group by month
    const months = {};
    state.expensesData.forEach(exp => {
        const monthKey = (exp.dt || '').slice(0, 7);
        if (!months[monthKey]) months[monthKey] = [];
        months[monthKey].push(exp);
    });
    
    // Sort months descending (newest first)
    Object.keys(months).sort().reverse().forEach(monthKey => {
        const expenses = months[monthKey];
        const monthTotal = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
        
        const [year, month] = monthKey.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthLabel = monthNames[parseInt(month) - 1] + ' ' + year;
        
        // Month header
        const monthHeader = document.createElement('div');
        monthHeader.className = 'flex items-center justify-between px-2 py-2 mt-3 mb-1';
        monthHeader.innerHTML = `
            <span class="font-medium text-zinc-300">${monthLabel}</span>
            <span class="text-sm text-red-400">−${formatCurrency(monthTotal)}</span>
        `;
        container.appendChild(monthHeader);
        
        // Expenses list
        expenses.sort((a, b) => b.dt.localeCompare(a.dt)).forEach(exp => {
            const item = document.createElement('div');
            item.className = 'bg-zinc-900 rounded-xl px-3 py-2.5 flex items-center justify-between border border-zinc-800 hover:border-zinc-700 transition-colors';
            
            const dateObj = new Date(exp.dt + 'T00:00:00');
            const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            
            item.innerHTML = `
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-medium text-zinc-200">${exp.desc || 'Expense'}</span>
                        ${exp.category ? `<span class="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">${exp.category}</span>` : ''}
                    </div>
                    <div class="text-xs text-zinc-500 mt-0.5">${dateStr} • ${exp.tool || 'Cash'}</div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-sm font-semibold text-red-400">−${formatCurrency(exp.amount)}</span>
                    <button onclick="editExpense('${exp.id}')" class="text-zinc-400 hover:text-blue-400 transition-colors" title="Edit">✏️</button>
                    <button onclick="deleteExpenseById('${exp.id}')" class="text-zinc-400 hover:text-red-400 transition-colors" title="Delete">🗑</button>
                </div>
            `;
            
            container.appendChild(item);
        });
    });
}

/**
 * Format number as currency
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Get expense total for a specific category
 * @param {string} category
 * @returns {number}
 */
export function getCategoryTotal(category) {
    return state.expensesData
        .filter(exp => exp.category === category)
        .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
}

/**
 * Get expense total for a specific tool
 * @param {string} tool
 * @returns {number}
 */
export function getToolTotal(tool) {
    return state.expensesData
        .filter(exp => exp.tool === tool)
        .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
}

/**
 * Refresh expenses (called after CRUD operations)
 */
export async function refreshExpenses() {
    await loadExpenses();
}

// ✅ PATCH: Expose functions to window for inline HTML onclick handlers
Object.assign(window, {
    showAddExpenseModal,
    saveExpense,
    editExpense,
    updateExpenseById,
    deleteExpenseById,
    loadExpenses,
    refreshExpenses,
    selectCategory,
    selectTool
});

// Export default for module imports
export default {
    showAddExpenseModal,
    saveExpense,
    editExpense,
    updateExpenseById,
    deleteExpenseById,
    loadExpenses,
    refreshExpenses,
    getCategoryTotal,
    getToolTotal
};