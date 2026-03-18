// js/expenses-crud.js

import { getState, setState } from "./state.js";
import { apiGet, apiPost } from "./api.js";

// Load expenses from backend
export async function loadExpenses() {
  try {
    const data = await apiGet("get_expenses");
    setState({ expenses: data || [] });
  } catch (e) {
    console.error("Failed to load expenses:", e);
    setState({ expenses: [] });
  }
}

// Save full expenses list
export async function saveExpenses(expenses) {
  try {
    await apiPost("save_expenses", { expenses });
    setState({ expenses });
  } catch (e) {
    console.error("Failed to save expenses:", e);
  }
}

// Add new expense
export async function addExpense(expense) {
  const state = getState();

  const newExpense = {
    ...expense,
    id: generateId(),
    created_at: new Date().toISOString()
  };

  const updated = [...state.expenses, newExpense];
  await saveExpenses(updated);
}

// Delete expense
export async function deleteExpense(id) {
  const state = getState();

  const updated = state.expenses.filter(e => e.id !== id);
  await saveExpenses(updated);
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}