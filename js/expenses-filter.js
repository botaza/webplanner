// js/expenses-filter.js

export function filterByMonth(expenses, year, month) {
  return expenses.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function filterAboveLimit(expenses, limit) {
  return expenses.filter(e => e.amount >= limit);
}