// js/expenses-stats.js
// STATS ORCHESTRATION
// Manages view switching and data aggregation for stats screens
// UPDATED: pie-categories view now renders collapsible entry drilldown per category

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

/**
 * Main render function for stats container
 */
export async function renderStatsContainer() {
    const container = document.getElementById('expenses-stats-container');
    if (!container) return;

    // Reset category drilldown expanded state when re-rendering
    // so accordion state is fresh for the new date range
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
            const data = await getExpensesByTool(currentStatsStartDate, currentStatsEndDate);
            renderPieChart(container, data, 'tool');
            renderStatsTotal(data.total, 'expenses-stats-total');

        } else if (currentStatsView === 'list-monthly') {
            const data  = getExpensesForMonth(currentStatsMonth);
            container.innerHTML = `
                <div id="expenses-stats-total"></div>
                <div class="bg-zinc-900 rounded-3xl p-5">
                    <div id="expenses-stats-list"></div>
                </div>
            `;
            const total = data.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
            renderStatsTotal(total, 'expenses-stats-total');
            renderStatsList(data, 'expenses-stats-list');

        } else if (currentStatsView === 'filtered-limit') {
            const data  = await getExpensesByLimit(currentStatsStartDate, currentStatsEndDate, currentLimit);
            container.innerHTML = `
                <div id="expenses-stats-total"></div>
                <div class="bg-zinc-900 rounded-3xl p-5">
                    <div id="expenses-stats-list"></div>
                </div>
            `;
            const total = data.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
            renderStatsTotal(total, 'expenses-stats-total');
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
    // 1. Fetch aggregated data
    const data = await getExpensesByCategory(currentStatsStartDate, currentStatsEndDate);

    // 2. Render the pie chart into the container (replaces loading spinner)
    renderPieChart(container, data, 'category');
    renderStatsTotal(data.total, 'expenses-stats-total');

    // 3. Get the flat list of expenses for the same period so the drilldown
    //    can show individual entries — filter from in-memory state for speed.
    const periodExpenses = (state.expensesData || []).filter(exp => {
        if (!exp.date) return false;
        if (currentStatsStartDate && exp.date < currentStatsStartDate) return false;
        if (currentStatsEndDate   && exp.date > currentStatsEndDate)   return false;
        return true;
    });

    // 4. Append drilldown section below the chart
    renderCategoryDrilldown(container, data, periodExpenses);
}

// ── MONTH PICKER ──

/**
 * Open month picker (simple prompt)
 */
export function showStatsMonthPicker() {
    const months = getExpenseMonths();
    const hint   = months.length ? '\nAvailable: ' + months.join(', ') : '';
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
