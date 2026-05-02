// js/expenses-stats.js
// STATS ORCHESTRATION
// Manages view switching and data aggregation for stats screens
// FIXED: Monthly view now correctly respects the selected date range
// FIXED: Monthly view now shows Total + Adjusted banner (when future expenses exist)
// UPDATED: Cashback support — 3-number display (expenses / cashback / adjusted)
// UPDATED: −1m / +1m quick navigation buttons for month navigation

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
    const year  = today.getFullYear();
    const month = today.getMonth() + 1; // JS months are 0-indexed; convert to 1–12
    const mm    = String(month).padStart(2, '0');
    const firstDay = `${year}-${mm}-01`;
    const lastDayNum = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
    const lastDay = `${year}-${mm}-${String(lastDayNum).padStart(2, '0')}`;

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
    const y    = parseInt(year);
    const mNum = parseInt(m); // human month 1–12
    const mm   = String(mNum).padStart(2, '0');
    const firstDay = `${y}-${mm}-01`;
    const lastDayNum = new Date(y, mNum, 0).getDate(); // day 0 of next month = last day of this month
    const lastDay = `${y}-${mm}-${String(lastDayNum).padStart(2, '0')}`;

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
 * Navigate months by delta (-1 = previous month, +1 = next month)
 * Always snaps to 1st→last of the target month.
 */
export function shiftStatsMonth(delta) {
    const [year, m] = currentStatsMonth.split('-').map(Number);
    let newYear  = year;
    let newMonth = m + delta;

    if (newMonth < 1)  { newMonth += 12; newYear -= 1; }
    if (newMonth > 12) { newMonth -= 12; newYear += 1; }

    const monthStr = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    setStatsMonth(monthStr);
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
    const year  = today.getFullYear();
    const month = today.getMonth() + 1; // JS months are 0-indexed; convert to 1–12
    const mm    = String(month).padStart(2, '0');
    const firstDay = `${year}-${mm}-01`;
    const lastDayNum = new Date(year, month, 0).getDate(); // day 0 of next month = last day of this month
    const lastDay = `${year}-${mm}-${String(lastDayNum).padStart(2, '0')}`;

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

    // Update −1m / +1m button display label
    const monthNavLabel = document.getElementById('stats-month-nav-label');
    if (monthNavLabel) {
        const [year, m] = currentStatsMonth.split('-').map(Number);
        const label = new Date(year, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
        monthNavLabel.textContent = label;
    }
}

// ── PRIVATE HELPERS ──
function _cashbackFromList(list) {
    return (list || [])
        .filter(e => e.cashback === true || e.cashback === 1)
        .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
}

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
            await _renderMonthlyView(container);
        } else if (currentStatsView === 'filtered-limit') {
            const data     = await getExpensesByLimit(currentStatsStartDate, currentStatsEndDate, currentLimit);
            const future   = _futureFromList(data);
            const cashback = _cashbackFromList(data);
            const total    = data.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

            container.innerHTML = `
                <div id="expenses-stats-total"></div>
                <div class="bg-zinc-900 rounded-3xl p-5">
                    <div id="expenses-stats-list"></div>
                </div>
            `;
            renderStatsTotal(total, 'expenses-stats-total', future, cashback);
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

    const periodExpenses = (state.expensesData || []).filter(exp => {
        if (!exp.date) return false;
        if (currentStatsStartDate && exp.date < currentStatsStartDate) return false;
        if (currentStatsEndDate   && exp.date > currentStatsEndDate)   return false;
        return true;
    });

    const cashback = _cashbackFromList(periodExpenses);

    renderPieChart(container, data, 'category');
    renderStatsTotal(data.total, 'expenses-stats-total', future, cashback);

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
    const future   = _futureFromList(periodExpenses);
    const cashback = _cashbackFromList(periodExpenses);

    renderPieChart(container, data, 'tool');
    renderStatsTotal(data.total, 'expenses-stats-total', future, cashback);
}

// ── PRIVATE: MONTHLY VIEW (WITH CASHBACK + TOTAL + ADJUSTED BANNER) ──
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

    const periodTotal    = filteredExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const periodFuture   = _futureFromList(filteredExpenses);
    const periodCashback = _cashbackFromList(filteredExpenses);

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

        const total    = entries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const future   = _futureFromList(entries);
        const cashback = _cashbackFromList(entries);
        const adjTotal = total - future;
        const netTotal = total - cashback;

        const [year, m] = month.split('-');
        const label     = new Date(+year, +m - 1, 1)
            .toLocaleString('en-US', { month: 'long', year: 'numeric' });

        const sorted = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const entryRows = sorted.map(exp => {
            const amount     = parseFloat(exp.amount || 0).toLocaleString('ru-RU');
            const isFuture   = exp.category === 'future';
            const isCashback = exp.cashback === true || exp.cashback === 1;
            return `
                <div class="bg-zinc-900/50 rounded-2xl p-3 flex justify-between items-center text-sm ${isFuture ? 'opacity-75' : ''}">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span class="text-zinc-500 text-xs">${exp.date || '—'}</span>
                            ${exp.tool ? `<span class="text-xs bg-zinc-800 px-2 py-0.5 rounded-full">${exp.tool}</span>` : ''}
                            ${exp.category ? `<span class="text-xs bg-zinc-800 px-2 py-0.5 rounded-full">${exp.category}</span>` : ''}
                            ${isCashback ? '<span class="text-sky-400 text-xs">🔙 cashback</span>' : ''}
                        </div>
                        ${exp.desc ? `<div class="text-zinc-400 text-xs mt-0.5">${exp.desc}</div>` : ''}
                    </div>
                    <div class="font-medium ${isFuture ? 'text-zinc-500' : isCashback ? 'text-sky-400' : 'text-emerald-400'}">
                        −${amount}
                    </div>
                </div>`;
        }).join('');

        // Build compact month header amount block
        let amountBlock;
        if (future > 0) {
            amountBlock = `
                <div class="text-right">
                    <div class="text-emerald-400 font-semibold">−${adjTotal.toLocaleString('ru-RU')}</div>
                    <div class="text-xs text-zinc-500">total −${total.toLocaleString('ru-RU')} (excl. 🔮 ${future.toLocaleString('ru-RU')})</div>
                </div>`;
        } else if (cashback > 0) {
            amountBlock = `
                <div class="text-right">
                    <div class="text-emerald-400 font-semibold">−${netTotal.toLocaleString('ru-RU')}</div>
                    <div class="text-xs text-zinc-500">−${total.toLocaleString('ru-RU')} − 🔙${cashback.toLocaleString('ru-RU')}</div>
                </div>`;
        } else {
            amountBlock = `<div class="text-emerald-400 font-semibold">−${total.toLocaleString('ru-RU')}</div>`;
        }

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
                    ${amountBlock}
                </div>
            </div>
            <div id="stats-month-${month}" class="ml-2 space-y-2 mb-5 ${isOpen ? '' : 'hidden'}">
                ${entryRows || '<div class="text-zinc-600 text-sm text-center py-2">No entries</div>'}
            </div>`;
    }).join('');

    // Build the 3-number banner for the period
    let bannerHTML;
    if (periodCashback > 0) {
        const netTotal = periodTotal - periodCashback;
        bannerHTML = `
            <div class="grid grid-cols-3 gap-2 mb-4">
                <div class="bg-zinc-900 rounded-3xl p-3 text-center">
                    <div class="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Expenses</div>
                    <div class="text-lg font-semibold text-emerald-400">−${periodTotal.toLocaleString('ru-RU')}</div>
                </div>
                <div class="bg-zinc-900 rounded-3xl p-3 text-center">
                    <div class="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Cashback</div>
                    <div class="text-lg font-semibold text-sky-400">+${periodCashback.toLocaleString('ru-RU')}</div>
                </div>
                <div class="bg-zinc-900 rounded-3xl p-3 text-center">
                    <div class="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Adjusted</div>
                    <div class="text-lg font-semibold text-zinc-200">−${netTotal.toLocaleString('ru-RU')}</div>
                </div>
            </div>`;
    } else if (periodFuture > 0) {
        const adjTotal = periodTotal - periodFuture;
        bannerHTML = `
            <div class="grid grid-cols-2 gap-3 mb-4">
                <div class="bg-zinc-900 rounded-3xl p-4 text-center">
                    <div class="text-xs text-zinc-500 uppercase tracking-wide mb-1">Total</div>
                    <div class="text-2xl font-semibold text-emerald-400">−${periodTotal.toLocaleString('ru-RU')}</div>
                </div>
                <div class="bg-zinc-900 rounded-3xl p-4 text-center">
                    <div class="text-xs text-zinc-500 uppercase tracking-wide mb-1">Adjusted</div>
                    <div class="text-2xl font-semibold text-zinc-200">−${adjTotal.toLocaleString('ru-RU')}</div>
                    <div class="text-xs text-zinc-600 mt-0.5">excl. 🔮 ${periodFuture.toLocaleString('ru-RU')}</div>
                </div>
            </div>`;
    } else {
        bannerHTML = `
            <div class="bg-zinc-900 rounded-3xl p-5 mb-4 text-center">
                <div class="text-xs text-zinc-500 uppercase tracking-wide">Total</div>
                <div class="text-3xl font-semibold text-emerald-400 mt-1">−${periodTotal.toLocaleString('ru-RU')}</div>
            </div>`;
    }

    container.innerHTML = `
        ${bannerHTML}
        <div class="bg-zinc-900 rounded-3xl p-5">
            ${monthBlocks}
        </div>
    `;
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
    shiftStatsMonth,
    toggleStatsMonth: (month) => {
        if (expandedMonths.has(month)) {
            expandedMonths.delete(month);
        } else {
            expandedMonths.add(month);
        }
        renderStatsContainer();
    }
});
