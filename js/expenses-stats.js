// js/expenses-stats.js
// STATS ORCHESTRATION
// Manages view switching and data aggregation for stats screens

import { state } from './state.js';
import { 
    getExpensesByCategory, 
    getExpensesByTool, 
    getExpensesByLimit, 
    getExpensesForMonth, 
    getExpenseMonths 
} from './expenses-crud.js';
import { renderPieChart } from './expenses-charts.js';
import { renderStatsList, renderStatsTotal } from './expenses-render.js';

// ── LOCAL STATE ──
let currentStatsView = 'pie-categories'; // pie-categories, pie-tools, list-monthly, filtered-limit
let currentStatsMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
let currentStatsStartDate = ''; // YYYY-MM-DD (for date range)
let currentStatsEndDate = ''; // YYYY-MM-DD (for date range)
let currentLimit = 1000; // Default limit for filtered view

// ── INITIALIZATION ──

/**
 * Initialize Stats UI listeners and render initial view
 */
export function initExpenseStats() {
    const container = document.getElementById('expenses-stats-container');
    const controls = document.getElementById('expenses-stats-controls');
    
    if (!container || !controls) {
        console.warn('[expenses-stats] Stats containers not found in HTML');
        return;
    }

    // Set default date range (current month)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    
    currentStatsStartDate = firstDay;
    currentStatsEndDate = lastDay;
    
    // Update date inputs in HTML
    const startInput = document.getElementById('stats-date-start');
    const endInput = document.getElementById('stats-date-end');
    if (startInput) startInput.value = currentStatsStartDate;
    if (endInput) endInput.value = currentStatsEndDate;

    // Render controls
    renderStatsControls();
    
    // Load initial data
    renderStatsContainer();
    
    console.log('[expenses-stats] Initialized');
}

// ── VIEW MANAGEMENT ──

/**
 * Switch stats view mode
 * @param {string} view - View identifier (pie-categories, pie-tools, list-monthly, filtered-limit)
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
    
    // Also update date range to match the month
    const [year, m] = month.split('-');
    const firstDay = new Date(parseInt(year), parseInt(m) - 1, 1).toISOString().slice(0, 10);
    const lastDay = new Date(parseInt(year), parseInt(m), 0).toISOString().slice(0, 10);
    
    currentStatsStartDate = firstDay;
    currentStatsEndDate = lastDay;
    
    // Update date inputs
    const startInput = document.getElementById('stats-date-start');
    const endInput = document.getElementById('stats-date-end');
    if (startInput) startInput.value = currentStatsStartDate;
    if (endInput) endInput.value = currentStatsEndDate;
    
    renderStatsControls();
    renderStatsContainer();
}

/**
 * Set date range for stats (new feature)
 * Called from HTML onchange handlers
 */
export function setStatsDateRange() {
    const startInput = document.getElementById('stats-date-start');
    const endInput = document.getElementById('stats-date-end');
    
    if (startInput && startInput.value) {
        currentStatsStartDate = startInput.value;
    }
    if (endInput && endInput.value) {
        currentStatsEndDate = endInput.value;
    }
    
    // Update month display to show range
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
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    
    currentStatsStartDate = firstDay;
    currentStatsEndDate = lastDay;
    currentStatsMonth = today.toISOString().slice(0, 7);
    
    // Update date inputs
    const startInput = document.getElementById('stats-date-start');
    const endInput = document.getElementById('stats-date-end');
    if (startInput) startInput.value = currentStatsStartDate;
    if (endInput) endInput.value = currentStatsEndDate;
    
    // Update month display
    const monthDisplay = document.getElementById('stats-month-display');
    if (monthDisplay) {
        monthDisplay.textContent = currentStatsMonth;
    }
    
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
    const controls = document.getElementById('expenses-stats-controls');
    if (!controls) return;

    // Update view button active states
    document.querySelectorAll('.stats-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === currentStatsView);
    });

    // Update month/date range display
    const monthDisplay = document.getElementById('stats-month-display');
    if (monthDisplay) {
        if (currentStatsView === 'filtered-limit' || currentStatsView === 'list-monthly') {
            monthDisplay.textContent = currentStatsMonth;
        } else {
            monthDisplay.textContent = `${currentStatsStartDate} → ${currentStatsEndDate}`;
        }
    }

    // Show/hide filter controls based on view
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

    // Show Loading
    container.innerHTML = `
        <div class="text-center text-zinc-500 py-10">
            <div class="animate-spin inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mb-2"></div>
            <div>Loading stats...</div>
        </div>`;

    try {
        if (currentStatsView === 'pie-categories') {
            // Use date range for pie charts
            const data = await getExpensesByCategory(currentStatsStartDate, currentStatsEndDate);
            renderPieChart(container, data, 'category');
            renderStatsTotal(data.total, 'expenses-stats-total');
        } else if (currentStatsView === 'pie-tools') {
            // Use date range for pie charts
            const data = await getExpensesByTool(currentStatsStartDate, currentStatsEndDate);
            renderPieChart(container, data, 'tool');
            renderStatsTotal(data.total, 'expenses-stats-total');
        } else if (currentStatsView === 'list-monthly') {
            // Use month for list view
            const data = getExpensesForMonth(currentStatsMonth);
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
            // Use date range + limit for filtered view
            const data = await getExpensesByLimit(currentStatsStartDate, currentStatsEndDate, currentLimit);
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

// ── MONTH PICKER ──

/**
 * Open month picker (simple prompt for now)
 */
export function showStatsMonthPicker() {
    const months = getExpenseMonths();
    if (months.length === 0) {
        const selected = prompt("Select month (YYYY-MM):", currentStatsMonth);
        if (selected && /^\d{4}-\d{2}$/.test(selected)) {
            setStatsMonth(selected);
        }
        return;
    }
    
    const selected = prompt("Select month (YYYY-MM):\nAvailable: " + months.join(', '), currentStatsMonth);
    if (selected && /^\d{4}-\d{2}$/.test(selected)) {
        setStatsMonth(selected);
    }
}

// ── GLOBAL EXPOSURE ──
// Expose date range functions for HTML onclick/onchange handlers
Object.assign(window, {
    setStatsDateRange,
    resetStatsDateRange
});