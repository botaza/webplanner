// js/income-stats.js
// STATS FOR INCOME & COMPENSATIONS
// Two tabs: Tools | Monthly
// Each tab shows: Income Only vs Income Adjusted (income − compensation)

import { state } from './state.js';
import {
    getIncomeAggregated,
    getCompensationsAggregated,
    getEntriesForMonth,
    getMonthsFromData
} from './income-crud.js';
import { renderPieChart } from './expenses-charts.js';

// ── LOCAL STATE ──
let currentView      = 'tools';   // 'tools' | 'monthly'
let currentMonth     = new Date().toISOString().slice(0, 7); // YYYY-MM
let currentStartDate = '';
let currentEndDate   = '';

// ── INITIALIZATION ──

/**
 * Initialize stats panel — set default date range and render
 */
export function initIncomeStats() {
    const today     = new Date();
    const firstDay  = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay   = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

    currentStartDate = firstDay;
    currentEndDate   = lastDay;

    _syncDateInputs();
    renderStatsViewButtons();
    renderIncomeStats();

    console.log('[income-stats] Initialized');
}

// ── VIEW SWITCHING ──

/**
 * Switch between Tools and Monthly views
 * @param {string} view - 'tools' | 'monthly'
 */
export function setIncomeStatsView(view) {
    currentView = view;
    renderStatsViewButtons();
    renderIncomeStats();
}

/**
 * Set active month for Monthly view
 * @param {string} month - YYYY-MM
 */
export function setIncomeStatsMonth(month) {
    currentMonth = month;

    const [y, m]    = month.split('-');
    currentStartDate = new Date(+y, +m - 1, 1).toISOString().slice(0, 10);
    currentEndDate   = new Date(+y, +m, 0).toISOString().slice(0, 10);

    _syncDateInputs();
    renderIncomeStats();
}

/**
 * Apply custom date range from inputs
 */
export function setIncomeStatsDateRange() {
    const s = document.getElementById('income-stats-date-start');
    const e = document.getElementById('income-stats-date-end');
    if (s && s.value) currentStartDate = s.value;
    if (e && e.value) currentEndDate   = e.value;
    renderIncomeStats();
}

/**
 * Reset date range to current month
 */
export function resetIncomeStatsDateRange() {
    const today    = new Date();
    currentStartDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    currentEndDate   = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    currentMonth     = today.toISOString().slice(0, 7);
    _syncDateInputs();
    renderIncomeStats();
}

/**
 * Open a simple month-picker prompt
 */
export function showIncomeMonthPicker() {
    const allMonths = getMonthsFromData([
        ...(state.incomeData || []),
        ...(state.compensationsData || [])
    ]);

    const hint     = allMonths.length ? '\nAvailable: ' + allMonths.join(', ') : '';
    const selected = prompt(`Select month (YYYY-MM):${hint}`, currentMonth);
    if (selected && /^\d{4}-\d{2}$/.test(selected)) {
        setIncomeStatsMonth(selected);
    }
}

// ── RENDER CONTROLS ──

/**
 * Render the Tools / Monthly tab buttons
 */
export function renderStatsViewButtons() {
    document.querySelectorAll('.income-stats-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === currentView);
    });
}

// ── MAIN RENDER ──

/**
 * Fetch data and render the stats container
 */
export async function renderIncomeStats() {
    const container = document.getElementById('income-stats-container');
    if (!container) return;

    // Loading state
    container.innerHTML = `
        <div class="text-center text-zinc-500 py-10">
            <div class="animate-spin inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mb-2"></div>
            <div>Loading stats...</div>
        </div>`;

    try {
        if (currentView === 'tools') {
            await _renderToolsView(container);
        } else {
            await _renderMonthlyView(container);
        }
    } catch (err) {
        console.error('[income-stats] Failed to render stats:', err);
        container.innerHTML = `
            <div class="text-red-400 text-center py-10">
                <div class="text-2xl mb-2">⚠️</div>
                <div>Failed to load stats</div>
            </div>`;
    }
}

// ── PRIVATE: TOOLS VIEW ──

async function _renderToolsView(container) {
    const [incData, compData] = await Promise.all([
        getIncomeAggregated(currentStartDate, currentEndDate),
        getCompensationsAggregated(currentStartDate, currentEndDate)
    ]);

    const incTotal  = incData.total  || 0;
    const compTotal = compData.total || 0;
    const adjTotal  = incTotal - compTotal;

    // Build adjusted groups (income groups minus compensation totals per tool)
    const adjGroups = _buildAdjustedGroups(incData.groups || {}, compData.groups || {});

    container.innerHTML = `
        <!-- Summary Cards -->
        <div class="grid grid-cols-3 gap-3 mb-6">
            ${_summaryCard('Income', incTotal, 'text-emerald-400')}
            ${_summaryCard('Compensation', compTotal, 'text-amber-400', true)}
            ${_summaryCard('Adjusted', adjTotal, adjTotal >= 0 ? 'text-emerald-400' : 'text-red-400')}
        </div>

        <!-- Date Range -->
        ${_dateRangeRow()}

        <!-- Tab: Income Only -->
        <div class="mb-2">
            <div class="text-xs text-zinc-500 uppercase font-medium mb-3">Income by Tool</div>
            <div id="income-tools-chart"></div>
        </div>

        <!-- Tab: Income Adjusted -->
        <div class="mt-6">
            <div class="text-xs text-zinc-500 uppercase font-medium mb-3">Adjusted by Tool
                <span class="text-zinc-600 normal-case">(income − compensation)</span>
            </div>
            <div id="income-adj-chart"></div>
        </div>

        <!-- Compensation breakdown -->
        ${compTotal > 0 ? `
        <div class="mt-6">
            <div class="text-xs text-zinc-500 uppercase font-medium mb-3">Compensation by Tool</div>
            <div id="income-comp-chart"></div>
        </div>` : ''}
    `;

    // Render pie charts
    renderPieChart(document.getElementById('income-tools-chart'), incData, 'tool');

    renderPieChart(
        document.getElementById('income-adj-chart'),
        { groups: adjGroups, total: adjTotal },
        'tool'
    );

    if (compTotal > 0) {
        renderPieChart(document.getElementById('income-comp-chart'), compData, 'tool');
    }
}

// ── PRIVATE: MONTHLY VIEW ──

async function _renderMonthlyView(container) {
    const allMonths = getMonthsFromData([
        ...(state.incomeData || []),
        ...(state.compensationsData || [])
    ]);

    if (allMonths.length === 0) {
        container.innerHTML = `
            <div class="text-center text-zinc-500 py-10">
                <div class="text-4xl mb-2">🍃</div>
                <div>No income records yet</div>
            </div>`;
        return;
    }

    // Build month rows
    const rows = allMonths.map(month => {
        const incEntries  = getEntriesForMonth(state.incomeData        || [], month);
        const compEntries = getEntriesForMonth(state.compensationsData || [], month);

        const incTotal  = incEntries.reduce((s, e)  => s + (parseFloat(e.amount) || 0), 0);
        const compTotal = compEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const adjTotal  = incTotal - compTotal;

        const [year, m] = month.split('-');
        const label = new Date(+year, +m - 1, 1)
            .toLocaleString('en-US', { month: 'long', year: 'numeric' });

        const isCurrentMonth = month === new Date().toISOString().slice(0, 7);

        return `
            <div class="bg-zinc-900 rounded-3xl p-4 mb-3">
                <div class="flex justify-between items-center mb-3">
                    <div class="font-semibold text-zinc-200">
                        ${label}
                        ${isCurrentMonth ? '<span class="text-emerald-400 text-xs ml-2">now</span>' : ''}
                    </div>
                    <div class="text-xs text-zinc-500">${incEntries.length} entr${incEntries.length !== 1 ? 'ies' : 'y'}</div>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center">
                    <div class="bg-zinc-950 rounded-2xl p-3">
                        <div class="text-xs text-zinc-500 mb-1">Income</div>
                        <div class="text-sm font-semibold text-emerald-400">+${incTotal.toLocaleString('ru-RU')}</div>
                    </div>
                    <div class="bg-zinc-950 rounded-2xl p-3">
                        <div class="text-xs text-zinc-500 mb-1">Compensation</div>
                        <div class="text-sm font-semibold text-amber-400">−${compTotal.toLocaleString('ru-RU')}</div>
                    </div>
                    <div class="bg-zinc-950 rounded-2xl p-3">
                        <div class="text-xs text-zinc-500 mb-1">Adjusted</div>
                        <div class="text-sm font-semibold ${adjTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                            ${adjTotal >= 0 ? '+' : ''}${adjTotal.toLocaleString('ru-RU')}
                        </div>
                    </div>
                </div>
                ${_renderEntryList(incEntries, compEntries, month)}
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="mb-4 flex gap-2 items-center justify-between">
            <button onclick="window.showIncomeMonthPicker()"
                    class="text-xs text-emerald-500 hover:text-emerald-400">
                📅 Pick month
            </button>
            <div class="text-xs text-zinc-500">All months</div>
        </div>
        ${rows}
    `;
}

// ── PRIVATE HELPERS ──

/**
 * Build adjusted groups (income per tool minus compensation per tool)
 */
function _buildAdjustedGroups(incGroups, compGroups) {
    const result = {};

    // Start from income groups
    Object.entries(incGroups).forEach(([key, val]) => {
        const compAmt = compGroups[key]?.amount || 0;
        const adj     = val.amount - compAmt;
        result[key]   = { label: val.label, amount: adj, count: val.count };
    });

    // Add any compensation-only tools (results in negative)
    Object.entries(compGroups).forEach(([key, val]) => {
        if (!result[key]) {
            result[key] = { label: val.label, amount: -val.amount, count: val.count };
        }
    });

    return result;
}

/**
 * Render a collapsible entry list for a month row
 */
function _renderEntryList(incEntries, compEntries, month) {
    if (incEntries.length === 0 && compEntries.length === 0) return '';

    const incRows = incEntries
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .map(e => `
            <div class="flex justify-between items-center text-sm py-1.5 border-b border-zinc-800 last:border-0">
                <div>
                    <span class="text-zinc-500 text-xs">${e.date?.slice(8) || ''}</span>
                    ${e.tool ? `<span class="ml-2 text-xs bg-zinc-800 px-2 py-0.5 rounded-full">${e.tool}</span>` : ''}
                    ${e.desc ? `<span class="ml-2 text-zinc-400 text-xs">${e.desc}</span>` : ''}
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-emerald-400 font-medium">+${parseFloat(e.amount).toLocaleString('ru-RU')}</span>
                    <button onclick="window.deleteIncome('${e.id}')"
                            class="text-zinc-600 hover:text-red-400 text-lg leading-none">🗑</button>
                </div>
            </div>
        `).join('');

    const compRows = compEntries
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .map(e => `
            <div class="flex justify-between items-center text-sm py-1.5 border-b border-zinc-800 last:border-0">
                <div>
                    <span class="text-zinc-500 text-xs">${e.date?.slice(8) || ''}</span>
                    ${e.tool ? `<span class="ml-2 text-xs bg-zinc-800 px-2 py-0.5 rounded-full">${e.tool}</span>` : ''}
                    ${e.desc ? `<span class="ml-2 text-zinc-400 text-xs">${e.desc}</span>` : ''}
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-amber-400 font-medium">−${parseFloat(e.amount).toLocaleString('ru-RU')}</span>
                    <button onclick="window.deleteCompensation('${e.id}')"
                            class="text-zinc-600 hover:text-red-400 text-lg leading-none">🗑</button>
                </div>
            </div>
        `).join('');

    return `
        <div class="mt-3 space-y-1">
            ${incRows}
            ${compRows ? `
                <div class="text-xs text-amber-500 font-medium pt-2 pb-1">Compensations</div>
                ${compRows}
            ` : ''}
        </div>
    `;
}

/**
 * Render a summary card
 */
function _summaryCard(label, amount, colorClass, negative = false) {
    const sign   = negative ? '−' : (amount >= 0 ? '+' : '');
    const absAmt = Math.abs(amount).toLocaleString('ru-RU');
    return `
        <div class="bg-zinc-900 rounded-2xl p-3 text-center">
            <div class="text-xs text-zinc-500 mb-1">${label}</div>
            <div class="text-sm font-semibold ${colorClass}">${sign}${absAmt}</div>
        </div>
    `;
}

/**
 * Render date range inputs row
 */
function _dateRangeRow() {
    return `
        <div class="flex gap-2 items-center mb-5">
            <input type="date" id="income-stats-date-start"
                   value="${currentStartDate}"
                   onchange="window.setIncomeStatsDateRange()"
                   class="flex-1 bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2 text-sm text-zinc-200">
            <span class="text-zinc-500 text-xs">→</span>
            <input type="date" id="income-stats-date-end"
                   value="${currentEndDate}"
                   onchange="window.setIncomeStatsDateRange()"
                   class="flex-1 bg-zinc-800 border border-zinc-700 rounded-2xl px-3 py-2 text-sm text-zinc-200">
            <button onclick="window.resetIncomeStatsDateRange()"
                    class="text-xs text-zinc-500 hover:text-zinc-300 px-2">↺</button>
        </div>
    `;
}

/**
 * Sync date inputs to current state values
 */
function _syncDateInputs() {
    const s = document.getElementById('income-stats-date-start');
    const e = document.getElementById('income-stats-date-end');
    if (s) s.value = currentStartDate;
    if (e) e.value = currentEndDate;
}

// ── GLOBAL EXPOSURE ──
Object.assign(window, {
    setIncomeStatsView,
    setIncomeStatsMonth,
    setIncomeStatsDateRange,
    resetIncomeStatsDateRange,
    showIncomeMonthPicker
});


