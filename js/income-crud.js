// js/income-crud.js
// CRUD OPERATIONS FOR INCOME & COMPENSATIONS
// Handles all API communication for income and compensation data

import { api } from './api.js';
import { state } from './state.js';

// ── INCOME ──

/**
 * Load all income entries from backend
 * @returns {Promise<Array>}
 */
export async function loadIncomeData() {
    try {
        const data = await api('get_income');
        return data || [];
    } catch (err) {
        console.error('[income-crud] Failed to load income:', err);
        throw err;
    }
}

/**
 * Save a new income entry
 * @param {Object} income - { date, amount, tool, desc }
 * @returns {Promise<Object>} API response
 */
export async function saveIncomeData(income) {
    try {
        return await api('add_income', income);
    } catch (err) {
        console.error('[income-crud] Failed to save income:', err);
        throw err;
    }
}

/**
 * Delete an income entry by ID
 * @param {string} id
 * @returns {Promise<Object>} API response
 */
export async function deleteIncomeData(id) {
    try {
        return await api('delete_income', { id });
    } catch (err) {
        console.error('[income-crud] Failed to delete income:', err);
        throw err;
    }
}

/**
 * Get income aggregated by tool for a date range
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 * @returns {Promise<Object>} { groups, total }
 */
export async function getIncomeAggregated(startDate, endDate) {
    try {
        const res = await api('get_income_aggregated', {
            start_date: startDate,
            end_date: endDate
        });
        return res || { groups: {}, total: 0 };
    } catch (err) {
        console.error('[income-crud] Failed to aggregate income:', err);
        return aggregateClientSide(state.incomeData || [], startDate, endDate);
    }
}

// ── COMPENSATIONS ──

/**
 * Load all compensation entries from backend
 * @returns {Promise<Array>}
 */
export async function loadCompensationsData() {
    try {
        const data = await api('get_compensations');
        return data || [];
    } catch (err) {
        console.error('[income-crud] Failed to load compensations:', err);
        throw err;
    }
}

/**
 * Save a new compensation entry
 * @param {Object} comp - { date, amount, tool, desc }
 * @returns {Promise<Object>} API response
 */
export async function saveCompensationData(comp) {
    try {
        return await api('add_compensation', comp);
    } catch (err) {
        console.error('[income-crud] Failed to save compensation:', err);
        throw err;
    }
}

/**
 * Delete a compensation entry by ID
 * @param {string} id
 * @returns {Promise<Object>} API response
 */
export async function deleteCompensationData(id) {
    try {
        return await api('delete_compensation', { id });
    } catch (err) {
        console.error('[income-crud] Failed to delete compensation:', err);
        throw err;
    }
}

/**
 * Get compensations aggregated by tool for a date range
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate   - YYYY-MM-DD
 * @returns {Promise<Object>} { groups, total }
 */
export async function getCompensationsAggregated(startDate, endDate) {
    try {
        const res = await api('get_compensations_aggregated', {
            start_date: startDate,
            end_date: endDate
        });
        return res || { groups: {}, total: 0 };
    } catch (err) {
        console.error('[income-crud] Failed to aggregate compensations:', err);
        return aggregateClientSide(state.compensationsData || [], startDate, endDate);
    }
}

// ── HELPERS ──

/**
 * Client-side aggregation fallback (groups by tool)
 * @param {Array}  data
 * @param {string} startDate
 * @param {string} endDate
 * @returns {{ groups: Object, total: number }}
 */
function aggregateClientSide(data, startDate, endDate) {
    const result = {};
    let total = 0;

    data.forEach(item => {
        if (!item.date) return;
        if (startDate && item.date < startDate) return;
        if (endDate   && item.date > endDate)   return;

        const key = item.tool || 'unknown';
        const amt = parseFloat(item.amount) || 0;

        if (!result[key]) result[key] = { label: key, amount: 0, count: 0 };
        result[key].amount += amt;
        result[key].count  += 1;
        total += amt;
    });

    return { groups: result, total };
}

/**
 * Get all unique months from a list of entries
 * @param {Array} data
 * @returns {string[]} sorted descending YYYY-MM
 */
export function getMonthsFromData(data) {
    const months = new Set();
    (data || []).forEach(item => {
        if (item.date && item.date.length >= 7) {
            months.add(item.date.substring(0, 7));
        }
    });
    return Array.from(months).sort().reverse();
}

/**
 * Filter a list of entries to a specific month
 * @param {Array}  data
 * @param {string} yearMonth - YYYY-MM
 * @returns {Array}
 */
export function getEntriesForMonth(data, yearMonth) {
    return (data || []).filter(item => item.date && item.date.startsWith(yearMonth));
}
