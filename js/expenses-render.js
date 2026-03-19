// js/expenses-render.js
// RENDERING LOGIC FOR EXPENSES LIST
// Handles drawing the expense cards in the main view and stats views
// PATCHED: Stats view now supports grouping; Toggles are context-aware

import { state } from './state.js';

/**
 * Render the main expenses list with expandable month/day groups
 * Current month pinned at top, rest sort from most recent to older
 * @param {Array} list - Array of expense objects
 */
export function renderExpensesList(list) {
  const container = document.getElementById('expenses-list');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="text-center text-zinc-500 py-10">
        <div class="text-4xl mb-2">🍃</div>
        <div>No expenses yet.</div>
      </div>`;
    return;
  }

  // Sort by date descending
  const sorted = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Group by Month (YYYY-MM)
  const groupedByMonth = {};
  sorted.forEach(exp => {
    const month = exp.date ? exp.date.substring(0, 7) : 'unknown';
    if (!groupedByMonth[month]) groupedByMonth[month] = [];
    groupedByMonth[month].push(exp);
  });

  // Get all months and separate current month
  const allMonths = Object.keys(groupedByMonth).sort().reverse();
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Pin current month at top, rest sort descending
  const months = [];
  if (groupedByMonth[currentMonth]) {
    months.push(currentMonth);
  }
  allMonths.forEach(m => {
    if (m !== currentMonth) {
      months.push(m);
    }
  });

  // Calculate totals for each month
  const monthTotals = {};
  months.forEach(m => {
    monthTotals[m] = groupedByMonth[m].reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
  });

  // Initialize expanded state for current month/day
  if (!state.expandedExpenseMonths) state.expandedExpenseMonths = new Set();
  if (!state.expandedExpenseDays) state.expandedExpenseDays = new Set();

  if (state.expandedExpenseMonths.size === 0) {
    state.expandedExpenseMonths.add(currentMonth);
  }
  if (state.expandedExpenseDays.size === 0) {
    state.expandedExpenseDays.add(new Date().toISOString().slice(0, 10));
  }

  // Render
  const html = months.map(month => {
    const isMonthExpanded = state.expandedExpenseMonths.has(month);
    const monthTotal = monthTotals[month].toLocaleString('ru-RU');
    const count = groupedByMonth[month].length;
    const monthLabel = formatMonthLabel(month);
    const isCurrentMonth = month === currentMonth;

    // Group by Day within month
    const groupedByDay = {};
    groupedByMonth[month].forEach(exp => {
      const day = exp.date || 'unknown';
      if (!groupedByDay[day]) groupedByDay[day] = [];
      groupedByDay[day].push(exp);
    });

    // Sort days descending
    const days = Object.keys(groupedByDay).sort().reverse();

    // Calculate totals for each day
    const dayTotals = {};
    days.forEach(d => {
      dayTotals[d] = groupedByDay[d].reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    });

    // Month Header
    const monthHeader = `
      <div class="bg-zinc-900 rounded-3xl p-4 mb-3 cursor-pointer hover:bg-zinc-800 transition"
           onclick="window.toggleExpenseMonth('${month}')">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3">
            <div class="text-emerald-500 text-lg">
              ${isMonthExpanded ? '📂' : '📁'}
            </div>
            <div>
              <div class="font-semibold text-zinc-200">
                ${monthLabel}${isCurrentMonth ? ' <span class="text-xs text-emerald-500">(Current)</span>' : ''}
              </div>
              <div class="text-xs text-zinc-500">${count} expense${count !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div class="text-emerald-400 font-semibold">
            −${monthTotal}
          </div>
        </div>
      </div>
    `;

    // Month Content (Days)
    const monthContent = `
      <div class="ml-2 space-y-3 mb-6 ${isMonthExpanded ? '' : 'hidden'}"
           id="month-content-${month}">
        ${days.map(day => {
          const isDayExpanded = state.expandedExpenseDays.has(day);
          const dayTotal = dayTotals[day].toLocaleString('ru-RU');
          const dayCount = groupedByDay[day].length;
          const dayLabel = formatDayLabel(day);

          // Day Header
          const dayHeader = `
            <div class="bg-zinc-900/50 rounded-2xl p-3 ml-4 cursor-pointer hover:bg-zinc-800/50 transition"
                 onclick="window.toggleExpenseDay('${day}')">
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                  <div class="text-emerald-500 text-base">
                    ${isDayExpanded ? '📂' : '📁'}
                  </div>
                  <div class="text-sm text-zinc-300">${dayLabel}</div>
                  <div class="text-xs text-zinc-500">(${dayCount})</div>
                </div>
                <div class="text-emerald-400 text-sm font-medium">
                  −${dayTotal}
                </div>
              </div>
            </div>
          `;

          // Day Content (Expenses)
          const dayContent = `
            <div class="ml-8 space-y-2 ${isDayExpanded ? '' : 'hidden'}"
                 id="day-content-${day}">
              ${groupedByDay[day].map(exp => {
                const amount = parseFloat(exp.amount || 0).toLocaleString('ru-RU');
                const tool = exp.tool || '?';
                const category = exp.category ? ` • ${exp.category}` : '';
                const desc = exp.desc ? ` • ${exp.desc}` : '';
                return `
                  <div class="bg-zinc-900/30 rounded-xl p-3 flex justify-between items-center text-sm">
                    <div class="flex-1">
                      <div class="text-zinc-300">${tool}${category}${desc ? ` • ${desc}` : ''}</div>
                    </div>
                    <div class="flex items-center gap-3">
                      <div class="font-medium text-emerald-400">−${amount}</div>
                      <div onclick="window.deleteExpense('${exp.id}'); event.stopPropagation()"
                           class="text-red-400 text-lg cursor-pointer hover:text-red-300 transition">
                        🗑
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
          return dayHeader + dayContent;
        }).join('')}
      </div>
    `;
    return monthHeader + monthContent;
  }).join('');

  container.innerHTML = `<div class="pb-20">${html}</div>`;
}

/**
 * Render a specific stats list (e.g. for monthly view or filtered view)
 * PATCHED: Now uses grouping logic similar to main view
 * @param {Array} list - Array of expense objects
 * @param {string} containerId - Target DOM ID (e.g., 'expenses-stats-list')
 */
export function renderStatsList(list, containerId = 'expenses-stats-list') {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Store data for toggle refresh
  state.lastStatsData = list;
  state.lastStatsContainer = containerId;

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="text-center text-zinc-500 py-4">
        <div class="text-2xl mb-1">🔍</div>
        <div class="text-sm">No data found for this view.</div>
      </div>`;
    return;
  }

  // --- GROUPING LOGIC (Same as renderExpensesList) ---
  const sorted = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const groupedByMonth = {};
  sorted.forEach(exp => {
    const month = exp.date ? exp.date.substring(0, 7) : 'unknown';
    if (!groupedByMonth[month]) groupedByMonth[month] = [];
    groupedByMonth[month].push(exp);
  });

  const months = Object.keys(groupedByMonth).sort().reverse();
  const monthTotals = {};
  months.forEach(m => {
    monthTotals[m] = groupedByMonth[m].reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
  });

  // Ensure state sets exist
  if (!state.expandedExpenseMonths) state.expandedExpenseMonths = new Set();
  if (!state.expandedExpenseDays) state.expandedExpenseDays = new Set();

  const html = months.map(month => {
    const isMonthExpanded = state.expandedExpenseMonths.has(month);
    const monthTotal = monthTotals[month].toLocaleString('ru-RU');
    const count = groupedByMonth[month].length;
    const monthLabel = formatMonthLabel(month);

    // Group by Day
    const groupedByDay = {};
    groupedByMonth[month].forEach(exp => {
      const day = exp.date || 'unknown';
      if (!groupedByDay[day]) groupedByDay[day] = [];
      groupedByDay[day].push(exp);
    });
    const days = Object.keys(groupedByDay).sort().reverse();
    const dayTotals = {};
    days.forEach(d => {
      dayTotals[d] = groupedByDay[d].reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    });

    // Month Header (Pass containerId to toggle)
    const monthHeader = `
      <div class="bg-zinc-900 rounded-3xl p-4 mb-3 cursor-pointer hover:bg-zinc-800 transition"
           onclick="window.toggleExpenseMonth('${month}', '${containerId}')">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3">
            <div class="text-emerald-500 text-lg">
              ${isMonthExpanded ? '📂' : '📁'}
            </div>
            <div>
              <div class="font-semibold text-zinc-200">${monthLabel}</div>
              <div class="text-xs text-zinc-500">${count} expense${count !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div class="text-emerald-400 font-semibold">
            −${monthTotal}
          </div>
        </div>
      </div>
    `;

    // Month Content
    const monthContent = `
      <div class="ml-2 space-y-3 mb-6 ${isMonthExpanded ? '' : 'hidden'}"
           id="month-content-${month}">
        ${days.map(day => {
          const isDayExpanded = state.expandedExpenseDays.has(day);
          const dayTotal = dayTotals[day].toLocaleString('ru-RU');
          const dayCount = groupedByDay[day].length;
          const dayLabel = formatDayLabel(day);

          const dayHeader = `
            <div class="bg-zinc-900/50 rounded-2xl p-3 ml-4 cursor-pointer hover:bg-zinc-800/50 transition"
                 onclick="window.toggleExpenseDay('${day}', '${containerId}')">
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                  <div class="text-emerald-500 text-base">
                    ${isDayExpanded ? '📂' : '📁'}
                  </div>
                  <div class="text-sm text-zinc-300">${dayLabel}</div>
                  <div class="text-xs text-zinc-500">(${dayCount})</div>
                </div>
                <div class="text-emerald-400 text-sm font-medium">
                  −${dayTotal}
                </div>
              </div>
            </div>
          `;

          const dayContent = `
            <div class="ml-8 space-y-2 ${isDayExpanded ? '' : 'hidden'}"
                 id="day-content-${day}">
              ${groupedByDay[day].map(exp => {
                const amount = parseFloat(exp.amount || 0).toLocaleString('ru-RU');
                const tool = exp.tool || '?';
                const category = exp.category ? ` • ${exp.category}` : '';
                const desc = exp.desc ? ` • ${exp.desc}` : '';
                return `
                  <div class="bg-zinc-900/30 rounded-xl p-3 flex justify-between items-center text-sm">
                    <div class="flex-1">
                      <div class="text-zinc-300">${tool}${category}${desc ? ` • ${desc}` : ''}</div>
                    </div>
                    <div class="flex items-center gap-3">
                      <div class="font-medium text-emerald-400">−${amount}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
          return dayHeader + dayContent;
        }).join('')}
      </div>
    `;
    return monthHeader + monthContent;
  }).join('');

  container.innerHTML = `<div class="pb-20">${html}</div>`;
}

/**
 * Toggle expanded state for a month
 * PATCHED: Accepts optional containerId to support Stats view
 * @param {string} month - YYYY-MM
 * @param {string} containerId - Optional (default: 'expenses-list')
 */
export function toggleExpenseMonth(month, containerId = 'expenses-list') {
  if (!state.expandedExpenseMonths) state.expandedExpenseMonths = new Set();

  if (state.expandedExpenseMonths.has(month)) {
    state.expandedExpenseMonths.delete(month);
  } else {
    state.expandedExpenseMonths.add(month);
  }

  // Context-aware re-render
  if (containerId === 'expenses-stats-list') {
    // Refresh Stats View (uses stored data)
    if (window.refreshExpenseStats) {
      window.refreshExpenseStats();
    }
  } else {
    // Refresh Main View
    const container = document.getElementById('expenses-list');
    if (container && state.expensesData) {
      renderExpensesList(state.expensesData);
    }
  }
}

/**
 * Toggle expanded state for a day
 * PATCHED: Accepts optional containerId to support Stats view
 * @param {string} day - YYYY-MM-DD
 * @param {string} containerId - Optional (default: 'expenses-list')
 */
export function toggleExpenseDay(day, containerId = 'expenses-list') {
  if (!state.expandedExpenseDays) state.expandedExpenseDays = new Set();

  if (state.expandedExpenseDays.has(day)) {
    state.expandedExpenseDays.delete(day);
  } else {
    state.expandedExpenseDays.add(day);
  }

  // Context-aware re-render
  if (containerId === 'expenses-stats-list') {
    if (window.refreshExpenseStats) {
      window.refreshExpenseStats();
    }
  } else {
    const container = document.getElementById('expenses-list');
    if (container && state.expensesData) {
      renderExpensesList(state.expensesData);
    }
  }
}

/**
 * Render a summary total card
 * @param {number} total - Total amount
 * @param {string} containerId - Target DOM ID
 */
export function renderStatsTotal(total, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const formatted = parseFloat(total || 0).toLocaleString('ru-RU');
  container.innerHTML = `
    <div class="bg-zinc-900 rounded-3xl p-5 mb-4 text-center">
      <div class="text-xs text-zinc-500 uppercase tracking-wide">Total</div>
      <div class="text-3xl font-semibold text-emerald-400 mt-1">−${formatted}</div>
    </div>
  `;
}

/**
 * Format month label (YYYY-MM → Month YYYY)
 * @param {string} month - YYYY-MM
 * @returns {string}
 */
function formatMonthLabel(month) {
  const [year, m] = month.split('-');
  const date = new Date(parseInt(year), parseInt(m) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Format day label (YYYY-MM-DD → DD Mon)
 * @param {string} day - YYYY-MM-DD
 * @returns {string}
 */
function formatDayLabel(day) {
  const [year, m, d] = day.split('-');
  const date = new Date(parseInt(year), parseInt(m) - 1, parseInt(d));
  return date.toLocaleString('en-US', { day: 'numeric', month: 'short' });
}