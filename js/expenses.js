// js/expenses.js

import { loadExpenses, addExpense } from "./expenses-crud.js";
import { renderExpensesList } from "./expenses-render.js";
import { getState } from "./state.js";

const container = document.getElementById("expenses-list");
const addBtn = document.getElementById("add-expense-btn");

export async function initExpenses() {
  await loadExpenses();
  render();
}

function render() {
  const state = getState();
  renderExpensesList(container, state.expenses);
}

// Add button handler
if (addBtn) {
  addBtn.onclick = async () => {
    const amount = parseFloat(prompt("Amount:"));
    const category = prompt("Category:");
    const date = prompt("Date (YYYY-MM-DD):", new Date().toISOString().slice(0, 10));

    if (!amount || !date) return;

    await addExpense({ amount, category, date });
    render();
  };
}