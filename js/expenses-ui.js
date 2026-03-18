import { addExpense, loadExpenses } from './expenses-crud.js';
import { state, setState } from './state.js';

// Example tools and categories
const TOOLS = ['Cash', 'Card', 'Transfer'];
const CATEGORIES = ['Food', 'Transport', 'Gift', 'Shopping', 'Other'];

// Render quick buttons
export function renderExpenseQuickButtons() {
    const toolContainer = document.getElementById('exp-tool-buttons');
    const categoryContainer = document.getElementById('exp-category-buttons');
    if (!toolContainer || !categoryContainer) return;

    // Tools
    toolContainer.innerHTML = '';
    TOOLS.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'tool-btn';
        btn.textContent = t;
        btn.onclick = () => {
            document.getElementById('exp-tool-other-group').classList.toggle('hidden', t !== 'Other');
            document.getElementById('exp-tool-other').value = '';
            Array.from(toolContainer.children).forEach(b => b.classList.toggle('active', b === btn));
        };
        toolContainer.appendChild(btn);
    });

    // Categories
    categoryContainer.innerHTML = '';
    CATEGORIES.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.textContent = c;
        btn.onclick = () => Array.from(categoryContainer.children).forEach(b => b.classList.toggle('active', b === btn));
        categoryContainer.appendChild(btn);
    });
}

// Show the expense modal
export function showAddExpenseModal() {
    const modal = document.getElementById('modal-expense');
    if (!modal) return;

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('exp-date');
    if (dateInput) dateInput.value = today;

    // Reset fields
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-desc').value = '';
    document.getElementById('exp-tool-other').value = '';
    document.getElementById('exp-tool-other-group').classList.add('hidden');

    Array.from(document.querySelectorAll('#exp-tool-buttons .tool-btn')).forEach(b => b.classList.remove('active'));
    Array.from(document.querySelectorAll('#exp-category-buttons .category-btn')).forEach(b => b.classList.remove('active'));

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// Save expense from modal
export async function saveExpense() {
    const date = document.getElementById('exp-date').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const desc = document.getElementById('exp-desc').value;

    const toolBtns = Array.from(document.querySelectorAll('#exp-tool-buttons .tool-btn'));
    const categoryBtns = Array.from(document.querySelectorAll('#exp-category-buttons .category-btn'));

    const toolActive = toolBtns.find(b => b.classList.contains('active'))?.textContent;
    const categoryActive = categoryBtns.find(b => b.classList.contains('active'))?.textContent;

    if (!date || !amount || !categoryActive) {
        alert('Please fill date, amount, and select a category');
        return;
    }

    const expense = {
        id: Date.now().toString(),
        date,
        amount,
        description: desc,
        tool: toolActive === 'Other' ? document.getElementById('exp-tool-other').value : toolActive,
        category: categoryActive
    };

    await addExpense(expense);

    // Close modal
    document.getElementById('modal-expense').classList.add('hidden');
    document.getElementById('modal-expense').classList.remove('flex');

    // Reload list
    loadExpenses();
}