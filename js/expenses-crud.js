// js/expenses-crud.js
// CRUD OPERATIONS FOR EXPENSES
// Handles all API communication for expense data

import { api } from './api.js';
import { state } from './state.js';

/**
 * Load all expenses from backend
 * @returns {Promise<Array>} Array of expense objects
 */
export async function loadExpensesData() {
    try {
        const data = await api('get_expenses');
        return data || [];
    } catch (err) {
        console.error('[expenses-crud] Failed to load expenses:', err);
        throw err;
    }
}

/**
 * Save a new expense to backend
 * @param {Object} expense - Expense object with date, amount, tool, category, desc
 * @returns {Promise<Object>} API response
 */
export async function saveExpenseData(expense) {
    try {
        const res = await api('add_expense', expense);
        return res;
    } catch (err) {
        console.error('[expenses-crud] Failed to save expense:', err);
        throw err;
    }
}

/**
 * Delete an expense by ID
 * @param {string} id - Expense ID to delete
 * @returns {Promise<Object>} API response
 */
export async function deleteExpenseData(id) {
    try {
        const res = await api('delete_expense', { id });
        return res;
    } catch (err) {
        console.error('[expenses-crud] Failed to delete expense:', err);
        throw err;
    }
}

/**
 * Get aggregated expenses by category for a date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Aggregated data by category
 */
export async function getExpensesByCategory(startDate, endDate) {
    try {
        const res = await api('get_expenses_aggregated', {
            start_date: startDate,
            end_date: endDate,
            group_by: 'category'
        });
        return res || {};
    } catch (err) {
        console.error('[expenses-crud] Failed to get category aggregation:', err);
        // Fallback: client-side aggregation
        return aggregateExpensesClientSide(startDate, endDate, 'category');
    }
}

/**
 * Get aggregated expenses by tool for a date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Aggregated data by tool
 */
export async function getExpensesByTool(startDate, endDate) {
    try {
        const res = await api('get_expenses_aggregated', {
            start_date: startDate,
            end_date: endDate,
            group_by: 'tool'
        });
        return res || {};
    } catch (err) {
        console.error('[expenses-crud] Failed to get tool aggregation:', err);
        // Fallback: client-side aggregation
        return aggregateExpensesClientSide(startDate, endDate, 'tool');
    }
}

/**
 * Get expenses filtered by amount limit AND date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {number} minAmount - Minimum amount threshold
 * @returns {Promise<Array>} Filtered expenses
 */
export async function getExpensesByLimit(startDate, endDate, minAmount) {
    try {
        const res = await api('get_expenses_filtered', {
            start_date: startDate,
            end_date: endDate,
            min_amount: minAmount
        });
        return res || [];
    } catch (err) {
        console.error('[expenses-crud] Failed to get filtered expenses:', err);
        // Fallback: client-side filtering
        return filterExpensesClientSide(startDate, endDate, minAmount);
    }
}

/**
 * Get expenses metadata for housekeeping
 * @returns {Promise<Object>} File size, record count, date range
 */
export async function getExpensesMetadata() {
    try {
        const res = await api('get_expenses_metadata');
        return res || {};
    } catch (err) {
        console.error('[expenses-crud] Failed to get meta', err);
        // Fallback: calculate from loaded data
        const data = state.expensesData || [];
        const dates = data.map(e => e.date).filter(d => d).sort();
        return {
            record_count: data.length,
            min_date: dates[0] || null,
            max_date: dates[dates.length - 1] || null,
            file_size_kb: Math.round(JSON.stringify(data).length / 1024)
        };
    }
}

/**
 * Archive old expenses (housekeeping)
 * @param {string} beforeDate - Archive records before this date
 * @returns {Promise<Object>} API response
 */
export async function archiveExpenses(beforeDate) {
    try {
        const res = await api('archive_expenses_old', { before_date: beforeDate });
        return res;
    } catch (err) {
        console.error('[expenses-crud] Failed to archive expenses:', err);
        throw err;
    }
}

/**
 * Client-side aggregation fallback
 */
function aggregateExpensesClientSide(startDate, endDate, groupBy) {
    const data = state.expensesData || [];
    const result = {};
    let total = 0;
    
    data.forEach(exp => {
        if (!exp.date) return;
        if (startDate && exp.date < startDate) return;
        if (endDate && exp.date > endDate) return;
        
        const key = exp[groupBy] || 'unknown';
        const amount = parseFloat(exp.amount) || 0;
        
        if (!result[key]) {
            result[key] = { label: key, amount: 0, count: 0 };
        }
        result[key].amount += amount;
        result[key].count += 1;
        total += amount;
    });
    
    return { groups: result, total };
}

/**
 * Client-side filtering fallback
 */
function filterExpensesClientSide(startDate, endDate, minAmount) {
    const data = state.expensesData || [];
    return data.filter(exp => {
        if (!exp.date) return false;
        if (startDate && exp.date < startDate) return false;
        if (endDate && exp.date > endDate) return false;
        if (minAmount && (parseFloat(exp.amount) || 0) < minAmount) return false;
        return true;
    });
}

/**
 * Get expenses for a specific month
 * @param {string} yearMonth - Format: YYYY-MM
 * @returns {Array} Expenses for that month
 */
export function getExpensesForMonth(yearMonth) {
    const data = state.expensesData || [];
    return data.filter(exp => exp.date && exp.date.startsWith(yearMonth));
}

/**
 * Get unique months from expenses data
 * @returns {Array<string>} Array of YYYY-MM strings
 */
export function getExpenseMonths() {
    const data = state.expensesData || [];
    const months = new Set();
    data.forEach(exp => {
        if (exp.date && exp.date.length >= 7) {
            months.add(exp.date.substring(0, 7));
        }
    });
    return Array.from(months).sort().reverse();
}