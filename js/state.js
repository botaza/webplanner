// js/state.js
export const state = {
    currentScreen: 'screen-dashboard',
    eventsData: [],
    expensesData: [],
    incomeData: [],
    messaging: null,
    selectedExpenseTool: null,
    selectedExpenseCategory: null,
    activePlannerHashtag: null,
    notifPage: 1,
    // NEW: Track expanded state for expenses list (Month → Day hierarchy)
    expandedExpenseMonths: new Set(),
    expandedExpenseDays: new Set()
};