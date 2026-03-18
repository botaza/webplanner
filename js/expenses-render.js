// js/expenses-render.js
// RENDERING LOGIC FOR EXPENSES LIST
// Handles drawing the expense cards in the main view and stats views

/**
 * Render the main expenses list
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

    container.innerHTML = sorted.map(exp => {
        const amount = parseFloat(exp.amount || 0).toLocaleString('ru-RU');
        const date = exp.date || '—';
        const tool = exp.tool || '?';
        const category = exp.category ? ` • ${exp.category}` : '';
        const desc = exp.desc ? ` • ${exp.desc}` : '';
        
        return `
        <div class="bg-zinc-900 rounded-3xl p-5 flex justify-between items-center card">
            <div>
                <div class="text-xs text-zinc-500">${date}</div>
                <div class="font-semibold text-xl">−${amount}</div>
                <div class="text-sm text-zinc-400 mt-1">
                    ${tool}${category}${desc}
                </div>
            </div>
            <div onclick="window.deleteExpense('${exp.id}'); event.stopPropagation()"
                 class="text-red-400 text-2xl cursor-pointer hover:text-red-300 transition p-2">
                🗑
            </div>
        </div>
    `;
    }).join('');
}

/**
 * Render a specific stats list (e.g. for monthly view or filtered view)
 * @param {Array} list - Array of expense objects
 * @param {string} containerId - Target DOM ID (e.g., 'expenses-stats-list')
 */
export function renderStatsList(list, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="text-center text-zinc-500 py-4">
                <div class="text-2xl mb-1">🔍</div>
                <div class="text-sm">No data found for this view.</div>
            </div>`;
        return;
    }

    // Sort by date descending
    const sorted = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    container.innerHTML = sorted.map(exp => {
        const amount = parseFloat(exp.amount || 0).toLocaleString('ru-RU');
        const date = exp.date || '—';
        const tool = exp.tool || '?';
        const desc = exp.desc || exp.category || 'Expense';
        
        return `
        <div class="flex justify-between items-center py-3 border-b border-zinc-800 last:border-0">
            <div>
                <div class="text-sm font-medium text-zinc-200">${desc}</div>
                <div class="text-xs text-zinc-500">${date} • ${tool}</div>
            </div>
            <div class="font-semibold text-emerald-400">
                −${amount}
            </div>
        </div>
    `;
    }).join('');
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