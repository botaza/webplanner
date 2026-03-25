// js/expenses-stats.js
// STATS ORCHESTRATION
// Manages view switching and data aggregation for stats screens
// UPDATED: pie-categories view now renders collapsible entry drilldown per category
// UPDATED: all views pass future-category sum to renderStatsTotal for adjusted display

import { state } from './state.js';
import {
    getExpensesByCategory,
    getExpensesByTool,
    getExpensesByLimit,
    getExpensesForMonth,
    getExpenseMonths
} from './expenses-crud.js';
import { renderPieChart } from './expenses-charts.js';
import {
    renderStatsList,
    renderStatsTotal,
    renderCategoryDrilldown
} from './expenses-render.js';

// ── LOCAL STATE ──
let currentStatsView      = 'pie-categories';
let currentStatsMonth     = new Date().toISOString().slice(0, 7); // YYYY-MM
let currentStatsStartDate = '';   // YYYY-MM-DD
let currentStatsEndDate   = '';   // YYYY-MM-DD
let currentLimit          = 1000; // Default limit for filtered view

// ── INITIALIZATION ──

/**
 * Initialize Stats UI listeners and render initial view
 */
export function initExpenseStats() {
    const container = document.getElementById('expenses-stats-container');
    const controls  = document.getElementById('expenses-stats-controls');

    if (!container || !controls) {
        console.warn('[expenses-stats] Stats containers not found in HTML');
        return;
    }

    // Set default date range (current month)
    const today    = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay  = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

    currentStatsStartDate = firstDay;
    currentStatsEndDate   = lastDay;

    // Update date inputs in HTML
    const startInput = document.getElementById('stats-date-start');
    const endInput   = document.getElementById('stats-date-end');
    if (startInput) startInput.value = currentStatsStartDate;
    if (endInput)   endInput.value   = currentStatsEndDate;

    renderStatsControls();
    renderStatsContainer();

    console.log('[expenses-stats] Initialized');
}

// ── VIEW MANAGEMENT ──

/**
 * Switch stats view mode
 * @param {string} view - pie-categories | pie-tools | list-monthly | filtered-limit
 */
export function setStatsView(view) {
    currentStatsView = view;
    renderStatsControls();
    renderStatsContainer();
}

/**
 * Set selected month for stats (legacy support)
 * @param {string} month - YYYY-MM
 */
export function setStatsMonth(month) {
    currentStatsMonth = month;

    const [year, m] = month.split('-');
    const firstDay  = new Date(parseInt(year), parseInt(m) - 1, 1).toISOString().slice(0, 10);
    const lastDay   = new Date(parseInt(year), parseInt(m), 0).toISOString().slice(0, 10);

    currentStatsStartDate = firstDay;
    currentStatsEndDate   = lastDay;

    const startInput = document.getElementById('stats-date-start');
    const endInput   = document.getElementById('stats-date-end');
    if (startInput) startInput.value = currentStatsStartDate;
    if (endInput)   endInput.value   = currentStatsEndDate;

    renderStatsControls();
    renderStatsContainer();
}

/**
 * Set date range for stats — called from HTML onchange handlers
 */
export function setStatsDateRange() {
    const startInput = document.getElementById('stats-date-start');
    const endInput   = document.getElementById('stats-date-end');

    if (startInput && startInput.value) currentStatsStartDate = startInput.value;
    if (endInput   && endInput.value)   currentStatsEndDate   = endInput.value;

    const monthDisplay = document.getElementById('stats-month-display');
    if (monthDisplay) {
        monthDisplay.textContent = `${currentStatsStartDate} → ${currentStatsEndDate}`;
    }

    renderStatsContainer();
}

/**
 * Reset date range to current month
 */
export function resetStatsDateRange() {
    const today    = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay  = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

    currentStatsStartDate = firstDay;
    currentStatsEndDate   = lastDay;
    currentStatsMonth     = today.toISOString().slice(0, 7);

    const startInput = document.getElementById('stats-date-start');
    const endInput   = document.getElementById('stats-date-end');
    if (startInput) startInput.value = currentStatsStartDate;
    if (endInput)   endInput.value   = currentStatsEndDate;

    const monthDisplay = document.getElementById('stats-month-display');
    if (monthDisplay) monthDisplay.textContent = currentStatsMonth;

    renderStatsControls();
    renderStatsContainer();
}

/**
 * Set limit for filtered view
 * @param {number} limit - Minimum amount
 */
export function setStatsLimit(limit) {
    currentLimit = parseFloat(limit) || 0;
    if (currentStatsView === 'filtered-limit') {
        renderStatsContainer();
    }
}

// ── RENDERING LOGIC ──

/**
 * Render the stats control buttons
 */
function renderStatsControls() {
    document.querySelectorAll('.stats-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === currentStatsView);
    });

    const monthDisplay = document.getElementById('stats-month-display');
    if (monthDisplay) {
        if (currentStatsView === 'filtered-limit' || currentStatsView === 'list-monthly') {
            monthDisplay.textContent = currentStatsMonth;
        } else {
            monthDisplay.textContent = `${currentStatsStartDate} → ${currentStatsEndDate}`;
        }
    }

    const filterControls = document.getElementById('expenses-filter-controls');
    if (filterControls) {
        if (currentStatsView === 'filtered-limit') {
            filterControls.classList.remove('hidden');
        } else {
            filterControls.classList.add('hidden');
        }
    }
}

// ── PRIVATE HELPERS ──

/**
 * Calculate the future-category sum from a groups object
 * (used after fetching aggregated data from the backend)
 * @param {Object} groups - { category: { label, amount, count } }
 * @returns {number}
 */
function _futureFromGroups(groups) {
    return parseFloat(groups?.future?.amount || 0);
}

/**
 * Calculate the future-category sum from a flat expense array
 * (used when working with raw lists)
 * @param {Array} list
 * @returns {number}
 */
function _futureFromList(list) {
    return (list || [])
        .filter(e => e.category === 'future')
        .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
}

// ── MAIN RENDER ──

/**
 * Main render function for stats container
 */
export async function renderStatsContainer() {
    const container = document.getElementById('expenses-stats-container');
    if (!container) return;

    // Reset category drilldown expanded state when re-rendering
    state.expandedStatsCategories = new Set();

    // Show loading spinner
    container.innerHTML = `
        <div class="text-center text-zinc-500 py-10">
            <div class="animate-spin inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mb-2"></div>
            <div>Loading stats...</div>
        </div>`;

    try {
        if (currentStatsView === 'pie-categories') {
            await _renderCategoriesView(container);

        } else if (currentStatsView === 'pie-tools') {
            await _renderToolsView(container);

        } else if (currentStatsView === 'list-monthly') {
            const data   = getExpensesForMonth(currentStatsMonth);
            const future = _futureFromList(data);
            const total  = data.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
            container.innerHTML = `
                <div id="expenses-stats-total"></div>
                <div class="bg-zinc-900 rounded-3xl p-5">
                    <div id="expenses-stats-list"></div>
                </div>
            `;
            renderStatsTotal(total, 'expenses-stats-total', future);
            renderStatsList(data, 'expenses-stats-list');

        } else if (currentStatsView === 'filtered-limit') {
            const data   = await getExpensesByLimit(currentStatsStartDate, currentStatsEndDate, currentLimit);
            const future = _futureFromList(data);
            const total  = data.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
            container.innerHTML = `
                <div id="expenses-stats-total"></div>
                <div class="bg-zinc-900 rounded-3xl p-5">
                    <div id="expenses-stats-list"></div>
                </div>
            `;
            renderStatsTotal(total, 'expenses-stats-total', future);
            renderStatsList(data, 'expenses-stats-list');
        }

    } catch (err) {
        console.error('[expenses-stats] Failed to load stats:', err);
        container.innerHTML = `
            <div class="text-red-400 text-center py-10">
                <div class="text-2xl mb-2">⚠️</div>
                <div>Failed to load stats</div>
            </div>`;
    }
}

// ── PRIVATE: CATEGORIES VIEW ──

/**
 * Render pie chart for categories THEN append collapsible drilldown list.
 * @param {HTMLElement} container
 */
async function _renderCategoriesView(container) {
    const data   = await getExpensesByCategory(currentStatsStartDate, currentStatsEndDate);
    const future = _futureFromGroups(data.groups);

    // Render the pie chart (replaces loading spinner)
    renderPieChart(container, data, 'category');
    renderStatsTotal(data.total, 'expenses-stats-total', future);

    // Get flat list for drilldown
    const periodExpenses = (state.expensesData || []).filter(exp => {
        if (!exp.date) return false;
        if (currentStatsStartDate && exp.date < currentStatsStartDate) return false;
        if (currentStatsEndDate   && exp.date > currentStatsEndDate)   return false;
        return true;
    });

    renderCategoryDrilldown(container, data, periodExpenses);
}

// ── PRIVATE: TOOLS VIEW ──

/**
 * Render pie chart for tools with total + adjusted banner.
 * Future amount is pulled from the period's expense list since
 * tool-grouped data doesn't carry category info.
 * @param {HTMLElement} container
 */
async function _renderToolsView(container) {
    const data = await getExpensesByTool(currentStatsStartDate, currentStatsEndDate);

    // Derive future sum from in-memory state filtered to the same period
    const periodExpenses = (state.expensesData || []).filter(exp => {
        if (!exp.date) return false;
        if (currentStatsStartDate && exp.date < currentStatsStartDate) return false;
        if (currentStatsEndDate   && exp.date > currentStatsEndDate)   return false;
        return true;
    });
    const future = _futureFromList(periodExpenses);

    renderPieChart(container, data, 'tool');
    renderStatsTotal(data.total, 'expenses-stats-total', future);
}

// ── MONTH PICKER ──

/**
 * Open month picker (simple prompt)
 */
export function showStatsMonthPicker() {
    const months  = getExpenseMonths();
    const hint    = months.length ? '\nAvailable: ' + months.join(', ') : '';
    const selected = prompt(`Select month (YYYY-MM):${hint}`, currentStatsMonth);
    if (selected && /^\d{4}-\d{2}$/.test(selected)) {
        setStatsMonth(selected);
    }
}

// ── GLOBAL EXPOSURE ──
Object.assign(window, {
    setStatsDateRange,
    resetStatsDateRange
});
