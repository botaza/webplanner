// js/app.js
import { state, setState, pushToState } from './state.js';
import { addExpense, loadExpenses } from './expenses.js';
import { switchScreen, hideModal } from './utils.js';

// Boot / initialization
async function bootApp() {
    await loadExpenses();
    renderExpensesList();

    switchScreen('screen-dashboard');
}

window.bootApp = bootApp;
window.onload = bootApp;

// =========================
// EXPENSE MODAL LOGIC
// =========================

const expenseModal = document.getElementById('modal-expense');
const btnAddExpense = document.getElementById('btn-add-expense');
const expListContainer = document.getElementById('expenses-list');

function renderExpensesList() {
    if (!expListContainer) return;
    expListContainer.innerHTML = '';

    const expenses = state.expenses || [];
    if (!expenses.length) {
        expListContainer.innerHTML = '<p class="text-zinc-400">No expenses yet</p>';
        return;
    }

    expenses.forEach(exp => {
        const item = document.createElement('div');
        item.className = 'expense-item bg-zinc-900 p-3 rounded-2xl flex justify-between items-center';
        item.innerHTML = `
            <div>
                <strong>${exp.amount}</strong> — ${exp.category || 'No category'}<br>
                <small class="text-zinc-500">${exp.date}</small>
            </div>
            <button class="delete-btn bg-red-600 hover:bg-red-500 px-3 py-1 rounded-2xl text-xs">Delete</button>
        `;

        item.querySelector('.delete-btn').onclick = async () => {
            const confirmed = confirm('Delete this expense?');
            if (!confirmed) return;

            const updated = state.expenses.filter(e => e.id !== exp.id);
            setState({ expenses: updated });
            renderExpensesList();
        };

        expListContainer.appendChild(item);
    });
}

// Show modal
function showAddExpenseModal() {
    if (!expenseModal) return;
    expenseModal.classList.remove('hidden');
    expenseModal.classList.add('flex');
}

// Save expense
async function saveExpense() {
    const date = document.getElementById('exp-date').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const category = document.getElementById('exp-category-buttons').value || '';
    const desc = document.getElementById('exp-desc').value || '';

    if (!date || !amount) {
        alert('Date and amount are required');
        return;
    }

    const newExpense = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        date, amount, category, desc
    };

    await addExpense(newExpense);
    pushToState('expenses', newExpense);
    renderExpensesList();
    hideModal('modal-expense');

    // Reset modal inputs
    document.getElementById('exp-date').value = '';
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-desc').value = '';
}

// Hook button
if (btnAddExpense) btnAddExpense.addEventListener('click', showAddExpenseModal);

// Make saveExpense globally accessible for modal button
window.saveExpense = saveExpense;
