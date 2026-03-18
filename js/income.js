// js/income.js - WebPlanner Income Management
// PATCHED: Consistent with expense and event architecture, proper state management

import { state } from './state.js';
import { api, getIncome, addIncome, updateIncome, deleteIncome } from './api.js';
import { hideModal } from './utils.js';
import { nowDateLocal } from './date-utils.js';
import { loadDashboard } from './dashboard.js';

/**
 * Initialize income modal with default values
 */
function initIncomeModal() {
    document.getElementById('inc-date').value = nowDateLocal();
    document.getElementById('inc-amount').value = '';
    document.getElementById('inc-desc').value = '';
}

/**
 * Show add income modal
 */
export function showAddIncomeModal() {
    initIncomeModal();
    
    // Reset save button
    const saveBtn = document.querySelector('#modal-income .flex.gap-3 button:last-child');
    if (saveBtn) {
        saveBtn.textContent = 'Save Income';
        saveBtn.onclick = saveIncome;
    }
    
    // Update modal title
    const modalTitle = document.querySelector('#modal-income .text-lg.font-semibold');
    if (modalTitle) modalTitle.textContent = 'New Income';
    
    document.getElementById('modal-income').classList.remove('hidden');
    document.getElementById('modal-income').classList.add('flex');
}

/**
 * Save new income entry
 */
export async function saveIncome() {
    const dt = document.getElementById('inc-date').value;
    const amount = document.getElementById('inc-amount').value;
    
    if (!dt) {
        alert('Please select a date');
        return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    const income = {
        dt: dt,
        amount: parseFloat(amount),
        desc: document.getElementById('inc-desc').value.trim() || 'Income'
    };
    
    try {
        const res = await addIncome(income);
        if (res.success) {
            hideModal('modal-income');
            await loadIncome();
            await loadDashboard();
        } else {
            alert('Save failed: ' + (res.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Save income error:', error);
        alert('Error saving income: ' + error.message);
    }
}

/**
 * Edit existing income entry
 * @param {string} id - Income ID
 */
export async function editIncome(id) {
    const income = state.incomeData.find(e => e.id == id);
    if (!income) {
        console.error('Income not found:', id);
        return;
    }
    
    // Populate form
    document.getElementById('inc-date').value = income.dt || nowDateLocal();
    document.getElementById('inc-amount').value = income.amount || '';
    document.getElementById('inc-desc').value = income.desc || '';
    
    // Update save button
    const saveBtn = document.querySelector('#modal-income .flex.gap-3 button:last-child');
    if (saveBtn) {
        saveBtn.textContent = 'Update Income';
        saveBtn.onclick = () => updateIncomeById(id);
    }
    
    // Update modal title
    const modalTitle = document.querySelector('#modal-income .text-lg.font-semibold');
    if (modalTitle) modalTitle.textContent = 'Edit Income';
    
    document.getElementById('modal-income').classList.remove('hidden');
    document.getElementById('modal-income').classList.add('flex');
}

/**
 * Update existing income entry
 * @param {string} id - Income ID
 */
export async function updateIncomeById(id) {
    const dt = document.getElementById('inc-date').value;
    const amount = document.getElementById('inc-amount').value;
    
    if (!dt) {
        alert('Please select a date');
        return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    const income = {
        dt: dt,
        amount: parseFloat(amount),
        desc: document.getElementById('inc-desc').value.trim() || 'Income'
    };
    
    try {
        const res = await updateIncome(id, income);
        if (res.success) {
            hideModal('modal-income');
            await loadIncome();
            await loadDashboard();
        } else {
            alert('Update failed: ' + (res.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Update income error:', error);
        alert('Error updating income: ' + error.message);
    }
}

/**
 * Delete income entry
 * @param {string} id - Income ID
 */
export async function deleteIncomeById(id) {
    if (!confirm('Delete this income entry? This cannot be undone.')) {
        return;
    }
    
    try {
        await deleteIncome(id);
        await loadIncome();
        await loadDashboard();
    } catch (error) {
        console.error('Delete income error:', error);
        alert('Error deleting income: ' + error.message);
    }
}

/**
 * Load and render income list
 */
export async function loadIncome() {
    try {
        const data = await getIncome();
        state.incomeData = data || [];
        renderIncomeList();
    } catch (error) {
        console.error('Load income error:', error);
        document.getElementById('income-list').innerHTML = `
            <div class="text-center text-red-400 py-8">Failed to load income</div>
        `;
    }
}

/**
 * Render income list grouped by month
 */
function renderIncomeList() {
    const container = document.getElementById('income-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!state.incomeData || !state.incomeData.length) {
        container.innerHTML = `
            <div class="text-center text-zinc-500 py-12">
                <div class="text-5xl mb-4">💰</div>
                <h3 class="text-lg font-medium text-zinc-300 mb-2">No income yet</h3>
                <p class="text-sm mb-4">Track your earnings by adding your first income</p>
                <button onclick="showAddIncomeModal()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl font-medium transition-colors">
                    + Add Income
                </button>
            </div>
        `;
        return;
    }
    
    // Group by month
    const months = {};
    state.incomeData.forEach(inc => {
        const monthKey = (inc.dt || '').slice(0, 7);
        if (!months[monthKey]) months[monthKey] = [];
        months[monthKey].push(inc);
    });
    
    // Sort months descending (newest first)
    Object.keys(months).sort().reverse().forEach(monthKey => {
        const incomes = months[monthKey];
        const monthTotal = incomes.reduce((sum, inc) => sum + (parseFloat(inc.amount) || 0), 0);
        
        const [year, month] = monthKey.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthLabel = monthNames[parseInt(month) - 1] + ' ' + year;
        
        // Month header
        const monthHeader = document.createElement('div');
        monthHeader.className = 'flex items-center justify-between px-2 py-2 mt-3 mb-1';
        monthHeader.innerHTML = `
            <span class="font-medium text-zinc-300">${monthLabel}</span>
            <span class="text-sm text-emerald-400">+${formatCurrency(monthTotal)}</span>
        `;
        container.appendChild(monthHeader);
        
        // Income list
        incomes.sort((a, b) => b.dt.localeCompare(a.dt)).forEach(inc => {
            const item = document.createElement('div');
            item.className = 'bg-zinc-900 rounded-xl px-3 py-2.5 flex items-center justify-between border border-zinc-800 hover:border-zinc-700 transition-colors';
            
            const dateObj = new Date(inc.dt + 'T00:00:00');
            const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            
            item.innerHTML = `
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-zinc-200">${inc.desc || 'Income'}</div>
                    <div class="text-xs text-zinc-500 mt-0.5">${dateStr}</div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-sm font-semibold text-emerald-400">+${formatCurrency(inc.amount)}</span>
                    <button onclick="editIncome('${inc.id}')" class="text-zinc-400 hover:text-blue-400 transition-colors" title="Edit">✏️</button>
                    <button onclick="deleteIncomeById('${inc.id}')" class="text-zinc-400 hover:text-red-400 transition-colors" title="Delete">🗑</button>
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
 * Get income total for a specific date range
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {number}
 */
export function getIncomeByDateRange(startDate, endDate) {
    return state.incomeData
        .filter(inc => {
            if (!inc.dt) return false;
            return inc.dt >= startDate && inc.dt <= endDate;
        })
        .reduce((sum, inc) => sum + (parseFloat(inc.amount) || 0), 0);
}

/**
 * Get income total for current month
 * @returns {number}
 */
export function getCurrentMonthIncome() {
    const currentMonth = nowDateLocal().slice(0, 7);
    return getIncomeByDateRange(currentMonth + '-01', currentMonth + '-31');
}

/**
 * Get income total for current year
 * @returns {number}
 */
export function getCurrentYearIncome() {
    const currentYear = nowDateLocal().slice(0, 4);
    return getIncomeByDateRange(currentYear + '-01-01', currentYear + '-12-31');
}

/**
 * Get average monthly income
 * @returns {number}
 */
export function getAverageMonthlyIncome() {
    if (!state.incomeData.length) return 0;
    
    const total = state.incomeData.reduce((sum, inc) => sum + (parseFloat(inc.amount) || 0), 0);
    
    // Calculate number of months with data
    const months = new Set();
    state.incomeData.forEach(inc => {
        if (inc.dt) {
            months.add(inc.dt.slice(0, 7));
        }
    });
    
    const monthCount = months.size || 1;
    return total / monthCount;
}

/**
 * Refresh income (called after CRUD operations)
 */
export async function refreshIncome() {
    await loadIncome();
}

// ✅ PATCH: Expose functions to window for inline HTML onclick handlers
Object.assign(window, {
    showAddIncomeModal,
    saveIncome,
    editIncome,
    updateIncomeById,
    deleteIncomeById,
    loadIncome,
    refreshIncome
});

// Export default for module imports
export default {
    showAddIncomeModal,
    saveIncome,
    editIncome,
    updateIncomeById,
    deleteIncomeById,
    loadIncome,
    refreshIncome,
    getIncomeByDateRange,
    getCurrentMonthIncome,
    getCurrentYearIncome,
    getAverageMonthlyIncome
};