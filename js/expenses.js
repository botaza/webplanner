// js/expenses.js

import { state, setState, pushToState, removeFromState } from './state.js';
import { apiPost, apiPostJSON, apiGet } from './api.js';

// ── Load all expenses from backend into state ─────────────────────────────
export async function loadExpenses() {
    const data = await apiGet('get_expenses');
    setState({ expenses: data || [] });
    return state.expenses;
}

// ── Add a single expense ───────────────────────────────────────────────────
export async function addExpense(expense) {
    await apiPost('add_expense', expense);
    pushToState('expenses', expense);
    return expense;
}

// ── Delete an expense by id ───────────────────────────────────────────────
export async function deleteExpense(id) {
    await apiPost('delete_expense', { id });
    removeFromState('expenses', id);
}

// ── Optional: Save bulk expenses (JSON mode) ──────────────────────────────
export async function saveExpensesBulk(expensesArray) {
    await apiPostJSON('save_expenses', { expenses: expensesArray });
    setState({ expenses: expensesArray });
}

// ── Utility: filter expenses by month or category ─────────────────────────
export function filterExpenses({ month, category, minAmount } = {}) {
    let items = state.expenses;
    if (month) items = items.filter(e => new Date(e.date).getMonth() === month - 1);
    if (category) items = items.filter(e => e.category === category);
    if (minAmount) items = items.filter(e => e.amount >= minAmount);
    return items;
}