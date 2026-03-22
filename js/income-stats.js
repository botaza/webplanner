// js/income-stats.js
// STATS FOR INCOME & COMPENSATIONS
// Two tabs: Tools | Monthly
// UPDATED: Monthly tab uses collapsible month groups matching expenses style

import { state } from './state.js';
import {
    getIncomeAggregated,
    getCompensationsAggregated,
    getEntriesForMonth,
    getMonthsFromData
} from './income-crud.js';
import { renderPieChart } from './expenses-charts.js';

// ── LOCAL STATE ──
let currentView      = 'tools';
let currentStartDate = '';
let currentEndDate   = '';
const expandedMonths = new Set(); // for Monthly tab collapse state

// ── INITIALIZATION ──

export function initIncomeStats() {
    const today     = new Date();
    const firstDay  = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay   = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

    currentStartDate = firstDay;
    currentEndDate   = lastDay;

    _syncDateInputs();
    renderStatsViewButtons();
    console.log('[income-stats] Initialized');
}

// ── VIEW SWITCHING ──

export function setIncomeStatsView(view) {
    currentView = view;
    renderStatsViewButtons();
    renderIncomeStats();
}

export function setIncomeStatsDateRange() {
    const s = document.getElementById('income-stats-date-start');
    const e = document.getElementById('income-stats-date-end');
    if (s && s.value) currentStartDate = s.value;
    if (e && e.value) currentEndDate   = e.value;
    renderIncomeStats();
}

export function resetIncomeStatsDateRange() {
    const today      = new Date();
    currentStartDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    currentEndDate   = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    _syncDateInputs();
    renderIncomeStats();
}

export function showIncomeMonthPicker() {
    const allMonths = getMonthsFromData([
        ...(state.incomeData        || []),
        ...(state.compensationsData || [])
    ]);
    const hint     = allMonths.length ? '\nAvailable: ' + allMonths.join(', ') : '';
    const selected = prompt(`Select month (YYYY-MM):${hint}`, new Date().toISOString().slice(0, 7));
    if (selected && /^\d{4}-\d{2}$/.test(selected)) {
        const [y, m]     = selected.split('-');
        currentStartDate = new Date(+y, +m - 1, 1).toISOString().slice(0, 10);
        currentEndDate   = new Date(+y, +m, 0).toISOString().slice(0, 10);
        _syncDateInputs();
        renderIncomeStats();
    }
}

// ── CONTROLS ──

export function renderStatsViewButtons() {
    document.querySelectorAll('.income-stats-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === currentView);
    });
}

// ── MAIN RENDER ──

export async function renderIncomeStats() {
    const container = document.getElementById('income-stats-container');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center text-zinc-500 py-10">
            <div class="animate-spin inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mb-2"></div>
            <div>Loading stats...</div>
        </div>`;

    try {
        if (currentView === 'tools') {
            await _renderToolsView(container);
        } else {
            _renderMonthlyView(container);
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

// ── MONTHLY TOGGLE ──

export function toggleStatsMonth(month) {
    if (expandedMonths.has(month)) {
        expandedMonths.delete(month);
    } else {
        expandedMonths.add(month);
    }

    const content = document.getElementById(`stats-month-${month}`);
    if (content) content.classList.toggle('hidden');

    const header = document.querySelector(`[onclick="window.toggleStatsMonth('${month}')"]`);
    if (header) {
        const icon = header.querySelector('.stats-month-icon');
        if (icon) icon.textContent = expandedMonths.has(month) ? '📂' : '📁';
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
    const adjGroups = _buildAdjustedGroups(incData.groups || {}, compData.groups || {});

    container.innerHTML = `
        <div class="grid grid-cols-3 gap-3 mb-5">
            ${_summaryCard('Income',       incTotal,  'text-emerald-400')}
            ${_summaryCard('Compensation', compTotal, 'text-amber-400', true)}
            ${_summaryCard('Adjusted',     adjTotal,  adjTotal >= 0 ? 'text-emerald-400' : 'text-red-400')}
        </div>

        ${_dateRangeRow()}

        <div class="mb-2">
            <div class="text-xs text-zinc-500 uppercase font-medium mb-3">Income by Tool</div>
            <div id="income-tools-chart"></div>
        </div>

        <div class="mt-6">
            <div class="text-xs text-zinc-500 uppercase font-medium mb-3">
                Adjusted by Tool
                <span class="text-zinc-600 normal-case">(income − compensation)</span>
            </div>
            <div id="income-adj-chart"></div>
        </div>

        ${compTotal > 0 ? `
        <div class="mt-6">
            <div class="text-xs text-zinc-500 uppercase font-medium mb-3">Compensation by Tool</div>
            <div id="income-comp-chart"></div>
        </div>` : ''}
    `;

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

function _renderMonthlyView(container) {
    const allMonths = getMonthsFromData([
        ...(state.incomeData        || []),
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

    const currentMonth = new Date().toISOString().slice(0, 7);

    // Auto-expand current month on first render
    if (expandedMonths.size === 0 && allMonths.includes(currentMonth)) {
        expandedMonths.add(currentMonth);
    }

    const monthBlocks = allMonths.map(month => {
        const incEntries  = getEntriesForMonth(state.incomeData        || [], month);
        const compEntries = getEntriesForMonth(state.compensationsData || [], month);

        const incTotal  = incEntries.reduce((s, e)  => s + (parseFloat(e.amount) || 0), 0);
        const compTotal = compEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const adjTotal  = incTotal - compTotal;

        const [year, m] = month.split('-');
        const label     = new Date(+year, +m - 1, 1)
            .toLocaleString('en-US', { month: 'long', year: 'numeric' });

        const isCurrent = month === currentMonth;
        const isOpen    = expandedMonths.has(month);
        const adjColor  = adjTotal >= 0 ? 'text-emerald-400' : 'text-red-400';
        const adjSign   = adjTotal >= 0 ? '+' : '';
        const entryCount = incEntries.length + compEntries.length;

        // Build entry rows — income first then compensations, newest first within each
        const incRows = [...incEntries]
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            .map(e => _entryRow(e, 'income'));

        const compRows = [...compEntries]
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            .map(e => _entryRow(e, 'compensation'));

        const allRows = [...incRows, ...compRows].join('');

        return `
            <!-- Month header -->
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
                            <div class="text-xs text-zinc-500">${entryCount} entr${entryCount !== 1 ? 'ies' : 'y'}</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="${adjColor} font-semibold">${adjSign}${adjTotal.toLocaleString('ru-RU')}</div>
                        ${compTotal > 0
                            ? `<div class="text-xs text-zinc-500">+${incTotal.toLocaleString('ru-RU')} − ${compTotal.toLocaleString('ru-RU')}</div>`
                            : `<div class="text-xs text-zinc-500">+${incTotal.toLocaleString('ru-RU')}</div>`}
                    </div>
                </div>
            </div>
            <!-- Month content -->
            <div id="stats-month-${month}" class="ml-2 space-y-2 mb-5 ${isOpen ? '' : 'hidden'}">
                ${allRows || '<div class="text-zinc-600 text-sm text-center py-2">No entries</div>'}
            </div>`;
    }).join('');

    container.innerHTML = monthBlocks;
}

// ── SHARED ENTRY ROW ──

function _entryRow(e, type) {
    const isComp = type === 'compensation';
    const sign   = isComp ? '−' : '+';
    const color  = isComp ? 'text-amber-400' : 'text-emerald-400';
    const badge  = isComp
        ? `<span class="text-xs bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded-full">comp</span>`
        : '';
    const delFn  = isComp
        ? `deleteCompensation('${e.id}')`
        : `deleteIncome('${e.id}')`;

    return `
        <div class="bg-zinc-900/50 rounded-2xl p-3 flex justify-between items-center text-sm">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span class="text-zinc-500 text-xs">${e.date || '—'}</span>
                    ${e.tool ? `<span class="text-xs bg-zinc-800 px-2 py-0.5 rounded-full">${e.tool}</span>` : ''}
                    ${badge}
                </div>
                ${e.desc ? `<div class="text-zinc-400 text-xs mt-0.5">${e.desc}</div>` : ''}
            </div>
            <div class="flex items-center gap-3 shrink-0 ml-3">
                <span class="${color} font-semibold">${sign}${parseFloat(e.amount).toLocaleString('ru-RU')}</span>
                <button onclick="window.${delFn}"
                        class="text-zinc-600 hover:text-red-400 text-lg transition">🗑</button>
            </div>
        </div>`;
}

// ── PRIVATE HELPERS ──

function _buildAdjustedGroups(incGroups, compGroups) {
    const result = {};
    Object.entries(incGroups).forEach(([key, val]) => {
        const compAmt = compGroups[key]?.amount || 0;
        result[key]   = { label: val.label, amount: val.amount - compAmt, count: val.count };
    });
    Object.entries(compGroups).forEach(([key, val]) => {
        if (!result[key]) {
            result[key] = { label: val.label, amount: -val.amount, count: val.count };
        }
    });
    return result;
}

function _summaryCard(label, amount, colorClass, negative = false) {
    const sign   = negative ? '−' : (amount >= 0 ? '+' : '');
    const absAmt = Math.abs(amount).toLocaleString('ru-RU');
    return `
        <div class="bg-zinc-900 rounded-2xl p-3 text-center">
            <div class="text-xs text-zinc-500 mb-1">${label}</div>
            <div class="text-sm font-semibold ${colorClass}">${sign}${absAmt}</div>
        </div>`;
}

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
        </div>`;
}

function _syncDateInputs() {
    const s = document.getElementById('income-stats-date-start');
    const e = document.getElementById('income-stats-date-end');
    if (s) s.value = currentStartDate;
    if (e) e.value = currentEndDate;
}

// ── GLOBAL EXPOSURE ──
Object.assign(window, {
    setIncomeStatsView,
    setIncomeStatsDateRange,
    resetIncomeStatsDateRange,
    showIncomeMonthPicker,
    toggleStatsMonth
});
