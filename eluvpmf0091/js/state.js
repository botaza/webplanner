// js/state.js
// GLOBAL APPLICATION STATE
// Single source of truth for all reactive data in the Planner PWA
// UPDATED: Added shopping module state fields

export const state = {
  // Navigation
  currentScreen: 'screen-dashboard',
  
  // Data Collections
  eventsData: [],
  expensesData: [],
  incomeData: [],
  compensationsData: [],
  shoppingData: [],  // Shopping list items
  
  // Firebase / Notifications
  messaging: null,
  
  // Expense Module State
  selectedExpenseTool: null,
  selectedExpenseCategory: null,
  
  // Planner Module State
  activePlannerHashtag: null,
  
  // Notification History Pagination
  notifPage: 1,
  
  // Expandable List State - Expenses
  expandedExpenseMonths: new Set(),
  expandedExpenseDays: new Set(),
  
  // Expandable List State - Stats Category Drilldown
  expandedStatsCategories: new Set(),
  
  // Expandable List State - Shopping Priority Groups
  expandedShoppingPriority: new Set(),
  
  // Shopping Module State
  shoppingModalMode: 'add',  // 'add' or 'edit'
  editingShoppingId: null,
  
  // Income Module State
  selectedIncomeTool: null,
  selectedCompensationTool: null,
  
  // User Role (set by lockscreen.js)
  role: null  // 'admin' | 'guest' | null
};