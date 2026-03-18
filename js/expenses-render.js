// js/expenses-render.js
import { deleteExpense } from "./expenses.js";

export function renderExpensesList(container, expenses) {
    container.innerHTML = "";

    if (!expenses.length) {
        container.innerHTML = "<p>No expenses found</p>";
        return;
    }

    expenses.forEach(exp => {
        const item = document.createElement("div");
        item.className = "expense-item";

        item.innerHTML = `
          <div class="expense-main">
            <div>
              <strong>${exp.amount}</strong> — ${exp.category || "No category"}
            </div>
            <div class="expense-date">${exp.date}</div>
          </div>

          <div class="expense-actions">
            <button class="delete-btn">Delete</button>
          </div>
        `;

        item.querySelector(".delete-btn").onclick = async () => {
            if (confirm("Delete this expense?")) {
                await deleteExpense(exp.id);
                item.remove();
            }
        };

        container.appendChild(item);
    });
}