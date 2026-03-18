import { state, setState, pushToState } from './state.js';
import { addExpense, loadExpenses } from './expenses.js';
import { switchScreen, hideModal } from './utils.js';

// Boot / initialization
async function bootApp() {
    await loadExpenses();
    renderExpensesList();
    renderExpenseQuickButtons(); // patch: show tool/category quick buttons

    switchScreen('screen-dashboard');
}

window.bootApp = bootApp;
window.onload = bootApp;

// =========================
// EXPENSE MODAL LOGIC
// =========================

const expenseModal = document.getElementById('modal-expense');
const btnAddExpense = document.querySelector("button[onclick='showAddExpenseModal()']");
const expListContainer = document.getElementById('expenses-list');

// -------------------------
// Render expenses list
// -------------------------
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

// -------------------------
// Show modal
// -------------------------
function showAddExpenseModal() {
    if (!expenseModal) return;

    // Set default date to today
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('exp-date').value = today;

    expenseModal.classList.remove('hidden');
    expenseModal.classList.add('flex');
}

// -------------------------
// Quick buttons for tools/categories
// -------------------------
const TOOL_OPTIONS = ['Cash', 'Card', 'Transfer'];
const CATEGORY_OPTIONS = ['Food', 'Transport', 'Gift', 'Shopping', 'Other'];

function renderExpenseQuickButtons() {
    const toolContainer = document.getElementById('exp-tool-buttons');
    const categoryContainer = document.getElementById('exp-category-buttons');

    if (toolContainer) {
        toolContainer.innerHTML = '';
        TOOL_OPTIONS.forEach(tool => {
            const btn = document.createElement('button');
            btn.textContent = tool;
            btn.className = 'py-2 px-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-sm';
            btn.onclick = () => document.getElementById('exp-tool-other').value = tool;
            toolContainer.appendChild(btn);
        });
    }

    if (categoryContainer) {
        categoryContainer.innerHTML = '';
        CATEGORY_OPTIONS.forEach(cat => {
            const btn = document.createElement('button');
            btn.textContent = cat;
            btn.className = 'py-2 px-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-sm';
            btn.onclick = () => document.getElementById('exp-category-buttons').dataset.selected = cat;
            categoryContainer.appendChild(btn);
        });
    }
}

// -------------------------
// Save expense
// -------------------------
async function saveExpense() {
    const date = document.getElementById('exp-date').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const category = document.getElementById('exp-category-buttons').dataset.selected || '';
    const desc = document.getElementById('exp-desc').value || '';
    const tool = document.getElementById('exp-tool-other').value || '';

    if (!date || !amount) {
        alert('Date and amount are required');
        return;
    }

    const newExpense = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        date, amount, category, desc, tool
    };

    await addExpense(newExpense);
    pushToState('expenses', newExpense);
    renderExpensesList();
    hideModal('modal-expense');

    // Reset modal inputs
    document.getElementById('exp-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-desc').value = '';
    document.getElementById('exp-tool-other').value = '';
    document.getElementById('exp-category-buttons').dataset.selected = '';
}

// -------------------------
// Hook button
// -------------------------
if (btnAddExpense) btnAddExpense.addEventListener('click', showAddExpenseModal);

// Make saveExpense globally accessible for modal button
Object.assign(window, {
    saveExpense,
    showAddExpenseModal
});