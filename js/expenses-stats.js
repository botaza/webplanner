// js/expenses-stats.js
// STATS ORCHESTRATION
// Manages view switching and data aggregation for stats screens
// FIXED: Monthly view now correctly respects the selected date range
// FIXED: Monthly view now shows Total + Adjusted banner (when future expenses exist)

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

const expandedMonths = new Set(); // for Monthly tab

// ── INITIALIZATION ──
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

    const startInput = document.getElementById('stats-date-start');
    const endInput   = document.getElementById('stats-date-end');
    if (startInput) startInput.value = currentStatsStartDate;
    if (endInput)   endInput.value   = currentStatsEndDate;

    renderStatsControls();
    renderStatsContainer();

    console.log('[expenses-stats] Initialized');
}

// ── VIEW MANAGEMENT ──
export function setStatsView(view) {
    currentStatsView = view;
    renderStatsControls();
    renderStatsContainer();
}

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

export function setStatsLimit(limit) {
    currentLimit = parseFloat(limit) || 0;
    if (currentStatsView === 'filtered-limit') {
        renderStatsContainer();
    }
}

// ── RENDERING LOGIC ──
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
function _futureFromGroups(groups) {
    return parseFloat(groups?.future?.amount || 0);
}

function _futureFromList(list) {
    return (list || [])
        .filter(e => e.category === 'future')
        .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
}

// ── MAIN RENDER ──
export async function renderStatsContainer() {
    const container = document.getElementById('expenses-stats-container');
    if (!container) return;

    state.expandedStatsCategories = new Set();

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
            await _renderMonthlyView(container);   // ← Fixed version with banner
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
async function _renderCategoriesView(container) {
    const data   = await getExpensesByCategory(currentStatsStartDate, currentStatsEndDate);
    const future = _futureFromGroups(data.groups);

    renderPieChart(container, data, 'category');
    renderStatsTotal(data.total, 'expenses-stats-total', future);

    const periodExpenses = (state.expensesData || []).filter(exp => {
        if (!exp.date) return false;
        if (currentStatsStartDate && exp.date < currentStatsStartDate) return false;
        if (currentStatsEndDate   && exp.date > currentStatsEndDate)   return false;
        return true;
    });

    renderCategoryDrilldown(container, data, periodExpenses);
}

// ── PRIVATE: TOOLS VIEW ──
async function _renderToolsView(container) {
    const data = await getExpensesByTool(currentStatsStartDate, currentStatsEndDate);

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

// ── PRIVATE: MONTHLY VIEW (NOW WITH TOTAL + ADJUSTED BANNER) ──
async function _renderMonthlyView(container) {
    const filteredExpenses = (state.expensesData || []).filter(exp => {
        if (!exp.date) return false;
        if (currentStatsStartDate && exp.date < currentStatsStartDate) return false;
        if (currentStatsEndDate   && exp.date > currentStatsEndDate)   return false;
        return true;
    });

    if (filteredExpenses.length === 0) {
        container.innerHTML = `
            <div class="text-center text-zinc-500 py-10">
                <div class="text-4xl mb-2">🍃</div>
                <div>No expenses in the selected period</div>
            </div>`;
        return;
    }

    // Overall banner for the selected period
    const periodTotal   = filteredExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const periodFuture  = filteredExpenses.filter(e => e.category === 'future')
                                          .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

    const grouped = {};
    filteredExpenses.forEach(exp => {
        const month = exp.date.substring(0, 7);
        if (!grouped[month]) grouped[month] = [];
        grouped[month].push(exp);
    });

    const months = Object.keys(grouped).sort().reverse();

    if (expandedMonths.size === 0 && months.length > 0) {
        expandedMonths.add(months[0]);
    }

    const monthBlocks = months.map(month => {
        const entries   = grouped[month];
        const isOpen    = expandedMonths.has(month);
        const isCurrent = month === new Date().toISOString().slice(0, 7);

        const total     = entries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const future    = entries.filter(e => e.category === 'future')
                                 .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const adjTotal  = total - future;

        const [year, m] = month.split('-');
        const label     = new Date(+year, +m - 1, 1)
            .toLocaleString('en-US', { month: 'long', year: 'numeric' });

        const adjColor = adjTotal >= 0 ? 'text-emerald-400' : 'text-red-400';
        const adjSign  = adjTotal >= 0 ? '+' : '';

        const sorted = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const entryRows = sorted.map(exp => {
            const amount = parseFloat(exp.amount || 0).toLocaleString('ru-RU');
            const isFuture = exp.category === 'future';
            return `
                <div class="bg-zinc-900/50 rounded-2xl p-3 flex justify-between items-center text-sm ${isFuture ? 'opacity-75' : ''}">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span class="text-zinc-500 text-xs">${exp.date || '—'}</span>
                            ${exp.tool ? `<span class="text-xs bg-zinc-800 px-2 py-0.5 rounded-full">${exp.tool}</span>` : ''}
                            ${exp.category ? `<span class="text-xs bg-zinc-800 px-2 py-0.5 rounded-full">${exp.category}</span>` : ''}
                        </div>
                        ${exp.desc ? `<div class="text-zinc-400 text-xs mt-0.5">${exp.desc}</div>` : ''}
                    </div>
                    <div class="font-medium ${isFuture ? 'text-zinc-500' : 'text-emerald-400'}">
                        −${amount}
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="bg-zinc-900 rounded-3xl p-4 mb-3 cursor-pointer hover:bg-zinc-800 transition"
                 onclick="window.toggleStatsMonth('${month}')">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="stats-month-icon text-emerald-500 text-lg">${isOpen ? '📂' : '📁'}</div>
                        <div>
                            <div class="font-semibold text-zinc-200">
                                ${label}
                                ${isCurrent ? '<span class="text-emerald-400 text-xs ml-1">now</span>' : ''}
                            </div>
                            <div class="text-xs text-zinc-500">${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'}</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="${adjColor} font-semibold">${adjSign}${adjTotal.toLocaleString('ru-RU')}</div>
                        ${future > 0 
                            ? `<div class="text-xs text-zinc-500">total −${total.toLocaleString('ru-RU')} (excl. 🔮 ${future.toLocaleString('ru-RU')})</div>`
                            : `<div class="text-xs text-zinc-500">−${total.toLocaleString('ru-RU')}</div>`}
                    </div>
                </div>
            </div>
            <div id="stats-month-${month}" class="ml-2 space-y-2 mb-5 ${isOpen ? '' : 'hidden'}">
                ${entryRows || '<div class="text-zinc-600 text-sm text-center py-2">No entries</div>'}
            </div>`;
    }).join('');

    // Final HTML: banner first, then months
    container.innerHTML = `
        <div id="expenses-stats-total"></div>
        <div class="bg-zinc-900 rounded-3xl p-5">
            ${monthBlocks}
        </div>
    `;

    // Render the overall Total + Adjusted banner
    renderStatsTotal(periodTotal, 'expenses-stats-total', periodFuture);
}

// ── MONTH PICKER ──
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
    resetStatsDateRange,
    toggleStatsMonth: (month) => {
        if (expandedMonths.has(month)) {
            expandedMonths.delete(month);
        } else {
            expandedMonths.add(month);
        }
        renderStatsContainer();
    }
});