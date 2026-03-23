// js/expenses-render.js
// RENDERING LOGIC FOR EXPENSES LIST
// Handles drawing the expense cards in the main view and stats views
// PATCHED: Stats view now supports grouping; Toggles are context-aware
// UPDATED: Edit button added to main list expense cards
// UPDATED: renderCategoryDrilldown added for stats categories view
// FIXED: Edit button click handling on touch devices - improved event delegation

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
  const allMonths    = Object.keys(groupedByMonth).sort().reverse();
  const currentMonth = new Date().toISOString().slice(0, 7);

  const months = [];
  if (groupedByMonth[currentMonth]) months.push(currentMonth);
  allMonths.forEach(m => { if (m !== currentMonth) months.push(m); });

  // Calculate totals for each month
  const monthTotals = {};
  months.forEach(m => {
    monthTotals[m] = groupedByMonth[m].reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
  });

  if (!state.expandedExpenseMonths) state.expandedExpenseMonths = new Set();
  if (!state.expandedExpenseDays)   state.expandedExpenseDays   = new Set();

  const html = months.map(month => {
    const isMonthExpanded = state.expandedExpenseMonths.has(month);
    const monthTotal      = monthTotals[month].toLocaleString('ru-RU');
    const count           = groupedByMonth[month].length;
    const monthLabel      = formatMonthLabel(month);
    const isCurrentMonth  = month === currentMonth;

    // Group by Day within month
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

    const monthContent = `
      <div class="ml-2 space-y-3 mb-6 ${isMonthExpanded ? '' : 'hidden'}"
           id="month-content-${month}">
        ${days.map(day => {
          const isDayExpanded = state.expandedExpenseDays.has(day);
          const dayTotal      = dayTotals[day].toLocaleString('ru-RU');
          const dayCount      = groupedByDay[day].length;
          const dayLabel      = formatDayLabel(day);

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

          const dayContent = `
            <div class="ml-8 space-y-2 ${isDayExpanded ? '' : 'hidden'}"
                 id="day-content-${day}">
              ${groupedByDay[day].map(exp => {
                const amount   = parseFloat(exp.amount || 0).toLocaleString('ru-RU');
                const tool     = exp.tool     || '?';
                const category = exp.category ? ` • ${exp.category}` : '';
                const desc     = exp.desc     ? ` • ${exp.desc}`     : '';
                return `
                  <div class="bg-zinc-900/30 rounded-xl p-3 flex justify-between items-center text-sm expense-item">
                    <div class="flex-1 pointer-events-none">
                      <div class="text-zinc-300">${tool}${category}${desc}</div>
                    </div>
                    <div class="flex items-center gap-2">
                      <div class="font-medium text-emerald-400 pointer-events-none">−${amount}</div>
                      <button data-action="edit" data-id="${exp.id}"
                              class="edit-expense-btn text-zinc-400 hover:text-white text-base transition px-1"
                              title="Edit">✏️</button>
                      <button data-action="delete" data-id="${exp.id}"
                              class="delete-expense-btn text-red-400 hover:text-red-300 text-base transition px-1"
                              title="Delete">🗑</button>
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

  // IMPROVED: Event delegation for edit/delete buttons with proper touch handling
  // Remove existing listener if present to avoid duplicates
  if (container._expDelegated) {
    if (container._expClickHandler) {
      container.removeEventListener('click', container._expClickHandler);
    }
    if (container._expTouchHandler) {
      container.removeEventListener('touchstart', container._expTouchHandler);
    }
  }
  
  // Create and store the click handler
  const clickHandler = function(e) {
    // Check if click was on edit button
    const editBtn = e.target.closest('[data-action="edit"]');
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = editBtn.dataset.id;
      if (id && window.editExpense) {
        window.editExpense(id);
      }
      return;
    }
    
    // Check if click was on delete button
    const deleteBtn = e.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = deleteBtn.dataset.id;
      if (id && window.deleteExpense) {
        window.deleteExpense(id);
      }
      return;
    }
  };
  
  // Touch handler for better mobile response
  const touchHandler = function(e) {
    const editBtn = e.target.closest('[data-action="edit"]');
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = editBtn.dataset.id;
      if (id && window.editExpense) {
        // Add haptic feedback if available
        if (navigator.vibrate) navigator.vibrate(50);
        window.editExpense(id);
      }
      return;
    }
    
    const deleteBtn = e.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = deleteBtn.dataset.id;
      if (id && window.deleteExpense) {
        if (navigator.vibrate) navigator.vibrate(50);
        window.deleteExpense(id);
      }
      return;
    }
  };
  
  // Store handlers for cleanup
  container._expClickHandler = clickHandler;
  container._expTouchHandler = touchHandler;
  container.addEventListener('click', clickHandler);
  container.addEventListener('touchstart', touchHandler, { passive: false });
  container._expDelegated = true;
}

/**
 * Render a specific stats list (e.g. for monthly view or filtered view)
 * @param {Array} list - Array of expense objects
 * @param {string} containerId - Target DOM ID (e.g., 'expenses-stats-list')
 */
export function renderStatsList(list, containerId = 'expenses-stats-list') {
  const container = document.getElementById(containerId);
  if (!container) return;

  state.lastStatsData      = list;
  state.lastStatsContainer = containerId;

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="text-center text-zinc-500 py-4">
        <div class="text-2xl mb-1">🔍</div>
        <div class="text-sm">No data found for this view.</div>
      </div>`;
    return;
  }

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

  if (!state.expandedExpenseMonths) state.expandedExpenseMonths = new Set();
  if (!state.expandedExpenseDays)   state.expandedExpenseDays   = new Set();

  const html = months.map(month => {
    const isMonthExpanded = state.expandedExpenseMonths.has(month);
    const monthTotal      = monthTotals[month].toLocaleString('ru-RU');
    const count           = groupedByMonth[month].length;
    const monthLabel      = formatMonthLabel(month);

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

    const monthContent = `
      <div class="ml-2 space-y-3 mb-6 ${isMonthExpanded ? '' : 'hidden'}"
           id="month-content-${month}">
        ${days.map(day => {
          const isDayExpanded = state.expandedExpenseDays.has(day);
          const dayTotal      = dayTotals[day].toLocaleString('ru-RU');
          const dayCount      = groupedByDay[day].length;
          const dayLabel      = formatDayLabel(day);

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
                const amount   = parseFloat(exp.amount || 0).toLocaleString('ru-RU');
                const tool     = exp.tool     || '?';
                const category = exp.category ? ` • ${exp.category}` : '';
                const desc     = exp.desc     ? ` • ${exp.desc}`     : '';
                return `
                  <div class="bg-zinc-900/30 rounded-xl p-3 flex justify-between items-center text-sm">
                    <div class="flex-1">
                      <div class="text-zinc-300">${tool}${category}${desc}</div>
                    </div>
                    <div class="font-medium text-emerald-400">−${amount}</div>
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
 * Render collapsible per-category entry lists below the pie chart.
 * Each category accordion shows all matching expenses for the selected time frame.
 * @param {HTMLElement} container  - DOM element to append into (after the chart)
 * @param {Object}      groupsData - { groups: { key: { label, amount, count } }, total }
 * @param {Array}       allExpenses - Full flat array of expense objects for the period
 */
export function renderCategoryDrilldown(container, groupsData, allExpenses) {
  if (!container) return;

  const groups  = groupsData?.groups || {};
  const keys    = Object.keys(groups);

  if (keys.length === 0 || !allExpenses || allExpenses.length === 0) return;

  // Build a lookup: category → sorted expenses
  const byCategory = {};
  allExpenses.forEach(exp => {
    const key = exp.category || 'unknown';
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(exp);
  });

  // Sort categories by total amount descending (mirrors pie chart order)
  const sortedKeys = keys.sort((a, b) => (groups[b]?.amount || 0) - (groups[a]?.amount || 0));

  // Track open state — keyed by safeKey (consistent with toggleStatsCategoryDrilldown)
  if (!state.expandedStatsCategories) state.expandedStatsCategories = new Set();

  const blocksHTML = sortedKeys.map(key => {
    const group    = groups[key];
    const entries  = (byCategory[key] || []).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const label    = group.label || key;
    const total    = parseFloat(group.amount || 0).toLocaleString('ru-RU');
    const count    = entries.length;
    const safeKey  = key.replace(/[^a-z0-9_-]/gi, '_');
    const isOpen   = state.expandedStatsCategories.has(safeKey);

    const rows = entries.map(exp => {
      const amount = parseFloat(exp.amount || 0).toLocaleString('ru-RU');
      const tool   = exp.tool || '?';
      const desc   = exp.desc ? ` • ${exp.desc}` : '';
      return `
        <div class="flex justify-between items-center text-sm py-2 border-b border-zinc-800/60 last:border-0">
          <div class="flex-1 min-w-0 pointer-events-none">
            <span class="text-zinc-400 text-xs">${exp.date || '—'}</span>
            <span class="text-zinc-300 ml-2">${tool}${desc}</span>
          </div>
          <div class="font-medium text-emerald-400 shrink-0 ml-3 pointer-events-none">−${amount}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="mb-2">
        <button type="button"
                data-safekey="${safeKey}"
                class="w-full bg-zinc-900 rounded-2xl px-4 py-3 hover:bg-zinc-800 transition flex justify-between items-center text-left">
          <div class="flex items-center gap-2 pointer-events-none">
            <span class="text-base">${isOpen ? '📂' : '📁'}</span>
            <span class="font-medium text-zinc-200">${label}</span>
            <span class="text-xs text-zinc-500">${count} entr${count !== 1 ? 'ies' : 'y'}</span>
          </div>
          <span class="text-emerald-400 font-semibold pointer-events-none">−${total}</span>
        </button>
        <div id="stats-cat-${safeKey}" class="px-4 pt-1 pb-2 ${isOpen ? '' : 'hidden'}">
          ${rows}
        </div>
      </div>
    `;
  }).join('');

  // Append a titled section below the chart
  const section = document.createElement('div');
  section.className = 'mt-6';
  section.innerHTML = `
    <div class="text-xs text-zinc-500 uppercase font-medium tracking-wide mb-3">
      Entries by Category
    </div>
    ${blocksHTML}
  `;

  section.addEventListener('click', function(e) {
    const btn = e.target.closest('button[data-safekey]');
    if (!btn) return;
    e.stopPropagation();
    toggleStatsCategoryDrilldown(btn.dataset.safekey);
  });

  container.appendChild(section);
}

/**
 * Toggle a single category drilldown accordion in the stats view.
 * Called via event delegation from renderCategoryDrilldown.
 * @param {string} safeKey - Sanitised category key
 */
export function toggleStatsCategoryDrilldown(safeKey) {
  if (!state.expandedStatsCategories) state.expandedStatsCategories = new Set();

  const panel  = document.getElementById(`stats-cat-${safeKey}`);
  const isOpen = !panel?.classList.contains('hidden');

  if (isOpen) {
    state.expandedStatsCategories.delete(safeKey);
    if (panel) panel.classList.add('hidden');
  } else {
    state.expandedStatsCategories.add(safeKey);
    if (panel) panel.classList.remove('hidden');
  }

  // Flip folder icon on the header button
  const header = panel?.previousElementSibling;
  if (header) {
    const icon = header.querySelector('span.text-base');
    if (icon) icon.textContent = isOpen ? '📁' : '📂';
  }
}

/**
 * Toggle expanded state for a month
 * @param {string} month       - YYYY-MM
 * @param {string} containerId - Optional (default: 'expenses-list')
 */
export function toggleExpenseMonth(month, containerId = 'expenses-list') {
  if (!state.expandedExpenseMonths) state.expandedExpenseMonths = new Set();

  if (state.expandedExpenseMonths.has(month)) {
    state.expandedExpenseMonths.delete(month);
  } else {
    state.expandedExpenseMonths.add(month);
  }

  if (containerId === 'expenses-stats-list') {
    if (window.refreshExpenseStats) window.refreshExpenseStats();
  } else {
    const container = document.getElementById('expenses-list');
    if (container && state.expensesData) renderExpensesList(state.expensesData);
  }
}

/**
 * Toggle expanded state for a day
 * @param {string} day         - YYYY-MM-DD
 * @param {string} containerId - Optional (default: 'expenses-list')
 */
export function toggleExpenseDay(day, containerId = 'expenses-list') {
  if (!state.expandedExpenseDays) state.expandedExpenseDays = new Set();

  if (state.expandedExpenseDays.has(day)) {
    state.expandedExpenseDays.delete(day);
  } else {
    state.expandedExpenseDays.add(day);
  }

  if (containerId === 'expenses-stats-list') {
    if (window.refreshExpenseStats) window.refreshExpenseStats();
  } else {
    const container = document.getElementById('expenses-list');
    if (container && state.expensesData) renderExpensesList(state.expensesData);
  }
}

/**
 * Render a summary total card
 * @param {number} total       - Total amount
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