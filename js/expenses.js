// js/expenses.js
import { state, setState, pushToState, removeFromState } from './state.js';
import { apiPost, apiPostJSON, apiGet } from './api.js';

/* ── Core CRUD ─────────────────────────────────────────────────────────── */

// Load all expenses from backend
export async function loadExpenses() {
    const data = await apiGet('get_expenses');
    setState({ expenses: data || [] });
    return state.expenses;
}

// Add a single expense
export async function addExpense(expense) {
    // Ensure unique id
    const newExpense = {
        id: Date.now() + Math.floor(Math.random() * 10000),
        ...expense,
        created_at: new Date().toISOString()
    };
    await apiPost('add_expense', newExpense);
    pushToState('expenses', newExpense);
    return newExpense;
}

// Delete an expense by id
export async function deleteExpense(id) {
    await apiPost('delete_expense', { id });
    removeFromState('expenses', id);
}

// Save bulk expenses (JSON)
export async function saveExpensesBulk(expensesArray) {
    await apiPostJSON('save_expenses', { expenses: expensesArray });
    setState({ expenses: expensesArray });
}

/* ── Filtering Utilities ───────────────────────────────────────────────── */
export function filterExpenses({ month, category, minAmount } = {}) {
    let items = state.expenses;
    if (month) items = items.filter(e => new Date(e.date).getMonth() === month - 1);
    if (category) items = items.filter(e => e.category === category);
    if (minAmount) items = items.filter(e => e.amount >= minAmount);
    return items;
}

// Extra filters (from expenses-filter.js)
export function filterByMonth(expenses, year, month) {
    return expenses.filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month;
    });
}

export function filterAboveLimit(expenses, limit) {
    return expenses.filter(e => e.amount >= limit);
}