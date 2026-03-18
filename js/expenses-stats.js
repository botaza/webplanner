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

    // Render controls if not already present
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
 * Set selected month for stats
 * @param {string} month - YYYY-MM
 */
export function setStatsMonth(month) {
    currentStatsMonth = month;
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

    // Update active states
    document.querySelectorAll('.stats-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === currentStatsView);
    });

    // Update month display
    const monthDisplay = document.getElementById('stats-month-display');
    if (monthDisplay) monthDisplay.textContent = currentStatsMonth;

    // Update limit input if visible
    const limitInput = document.getElementById('stats-limit-input');
    if (limitInput) limitInput.value = currentLimit;
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
        const startDate = currentStatsMonth + '-01';
        const endDate = currentStatsMonth + '-31';

        if (currentStatsView === 'pie-categories') {
            const data = await getExpensesByCategory(startDate, endDate);
            renderPieChart(container, data, 'category');
            renderStatsTotal(data.total, 'expenses-stats-total');
        } else if (currentStatsView === 'pie-tools') {
            const data = await getExpensesByTool(startDate, endDate);
            renderPieChart(container, data, 'tool');
            renderStatsTotal(data.total, 'expenses-stats-total');
        } else if (currentStatsView === 'list-monthly') {
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
            const data = await getExpensesByLimit(startDate, endDate, currentLimit);
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
        // Default to current if no data
        const selected = prompt("Select month (YYYY-MM):", currentStatsMonth);
        if (selected && /^\d{4}-\d{2}$/.test(selected)) {
            setStatsMonth(selected);
        }
        return;
    }
    
    // Simple selection for now
    const selected = prompt("Select month (YYYY-MM):\nAvailable: " + months.join(', '), currentStatsMonth);
    if (selected && /^\d{4}-\d{2}$/.test(selected)) {
        setStatsMonth(selected);
    }
}