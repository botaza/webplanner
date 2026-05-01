// >> - js/expenses-list-view.js
// js/expenses-list-view.js
// EXPANDABLE MONTHLY LIST VIEW
// Groups expenses by month and allows collapsing/expanding sections

// ── LOCAL STATE ──
// Tracks which months are currently expanded
const expandedMonths = new Set();

/**
 * Render expenses grouped by month with expand/collapse functionality
 * @param {string} containerId - Target DOM ID (e.g., 'expenses-stats-container')
 * @param {Array} expenses - Array of expense objects
 */
export function renderExpandableMonthlyList(containerId, expenses) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!expenses || expenses.length === 0) {
        container.innerHTML = `
            <div class="text-center text-zinc-500 py-10">
                <div class="text-4xl mb-2">🍃</div>
                <div>No expenses found for this period.</div>
            </div>
        `;
        return;
    }

    // Group by Month (YYYY-MM)
    const grouped = {};
    expenses.forEach(exp => {
        const month = exp.date ? exp.date.substring(0, 7) : 'unknown';
        if (!grouped[month]) grouped[month] = [];
        grouped[month].push(exp);
    });

    // Sort months descending
    const months = Object.keys(grouped).sort().reverse();

    // Calculate totals for each month
    const totals = {};
    months.forEach(m => {
        totals[m] = grouped[m].reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    });

    // Render
    const html = months.map(month => {
        const isExpanded = expandedMonths.has(month);
        const monthTotal = totals[month].toLocaleString('ru-RU');
        const count = grouped[month].length;
        
        // Month Header
        const header = `
            <div class="bg-zinc-900 rounded-3xl p-4 mb-3 cursor-pointer hover:bg-zinc-800 transition"
                 onclick="window.toggleExpenseMonth('${month}')">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="text-emerald-500 text-lg">
                            ${isExpanded ? '▾' : '▸'}
                        </div>
                        <div>
                            <div class="font-semibold text-zinc-200">${formatMonthLabel(month)}</div>
                            <div class="text-xs text-zinc-500">${count} expense${count !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                    <div class="text-emerald-400 font-semibold">
                        −${monthTotal}
                    </div>
                </div>
            </div>
        `;

        // Month Content (List)
        const content = `
            <div class="ml-4 pl-4 border-l-2 border-zinc-800 mb-6 space-y-2 ${isExpanded ? '' : 'hidden'}"
                 id="month-content-${month}">
                ${grouped[month].sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(exp => {
                    const amount = parseFloat(exp.amount || 0).toLocaleString('ru-RU');
                    const date = exp.date ? exp.date.substring(8) : ''; // DD only
                    const tool = exp.tool || '?';
                    const category = exp.category ? ` • ${exp.category}` : '';
                    const desc = exp.desc ? ` • ${exp.desc}` : '';
                    
                    return `
                    <div class="bg-zinc-900/50 rounded-2xl p-3 flex justify-between items-center text-sm">
                        <div>
                            <div class="text-xs text-zinc-500 mb-0.5">${date} • ${tool}</div>
                            <div class="text-zinc-300">${desc || category || 'Expense'}</div>
                        </div>
                        <div class="font-medium text-emerald-400">−${amount}</div>
                    </div>
                `;
                }).join('')}
            </div>
        `;

        return header + content;
    }).join('');

    container.innerHTML = `<div class="pb-20">${html}</div>`;
}

/**
 * Toggle expanded state for a month
 * @param {string} month - YYYY-MM
 */
export function toggleExpenseMonth(month) {
    if (expandedMonths.has(month)) {
        expandedMonths.delete(month);
    } else {
        expandedMonths.add(month);
    }
    
    // Re-render the container that holds this view
    // We assume it's called from stats view, so we trigger stats refresh
    // Or we can just toggle the DOM element directly for performance
    const contentEl = document.getElementById(`month-content-${month}`);
    if (contentEl) {
        contentEl.classList.toggle('hidden');
        
        // Update icon
        const headerEl = contentEl.previousElementSibling;
        if (headerEl) {
            const iconEl = headerEl.querySelector('.text-emerald-500');
            if (iconEl) {
                iconEl.textContent = expandedMonths.has(month) ? '▾' : '▸';
            }
        }
    }
}

/**
 * Format month label (YYYY-MM → Month YYYY)
 * @param {string} month - YYYY-MM
 * @returns {string}
 */
function formatMonthLabel(month) {
    const [year, m] = month.split('-');
    const date = new Date(year, m - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Expand all months
 */
export function expandAllMonths() {
    const containers = document.querySelectorAll('[id^="month-content-"]');
    containers.forEach(el => el.classList.remove('hidden'));
    // Update icons
    document.querySelectorAll('.text-emerald-500').forEach(icon => {
        if (icon.textContent === '▸') icon.textContent = '▾';
    });
    // Clear state set (optional, keeps state in sync)
    // expandedMonths.clear(); 
}

/**
 * Collapse all months
 */
export function collapseAllMonths() {
    const containers = document.querySelectorAll('[id^="month-content-"]');
    containers.forEach(el => el.classList.add('hidden'));
    // Update icons
    document.querySelectorAll('.text-emerald-500').forEach(icon => {
        if (icon.textContent === '▾') icon.textContent = '▸';
    });
}
// << - js/expenses-list-view.js
