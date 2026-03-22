// js/expenses-advanced-filter.js
// ADVANCED FILTERING LOGIC
// Handles limit input UI and triggers stats refresh

import { setStatsLimit, renderStatsContainer } from './expenses-stats.js';

// ── LOCAL STATE ──
let currentLimit = 1000;
let debounceTimer = null;

/**
 * Initialize the advanced filter UI controls
 * @param {string} containerId - Target DOM ID for filter controls
 */
export function initAdvancedFilter(containerId = 'expenses-filter-controls') {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Render Filter Controls
    container.innerHTML = `
        <div class="bg-zinc-900 rounded-3xl p-4 mb-4">
            <div class="flex justify-between items-center mb-3">
                <div class="text-sm font-medium text-zinc-300">Minimum Amount</div>
                <div class="text-xs text-zinc-500">Filter expenses above</div>
            </div>
            <div class="flex gap-3">
                <div class="relative flex-1">
                    <span class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">₽</span>
                    <input type="number" 
                           id="filter-limit-input" 
                           value="${currentLimit}" 
                           min="0" 
                           step="100"
                           class="w-full bg-zinc-800 border border-zinc-700 focus:border-emerald-500 rounded-2xl pl-8 pr-4 py-3 text-base text-zinc-200"
                           placeholder="Min amount">
                </div>
                <button onclick="window.applyExpenseFilter()"
                        class="bg-emerald-600 hover:bg-emerald-500 text-white px-6 rounded-2xl font-medium transition">
                    Apply
                </button>
            </div>

            <div class="mt-3 flex gap-2">
                <button onclick="window.setExpenseLimit(2000)" class="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-full text-zinc-400">>2000</button>
                <button onclick="window.setExpenseLimit(3000)" class="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-full text-zinc-400">>3000</button>
                <button onclick="window.setExpenseLimit(5000)" class="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-full text-zinc-400">>5000</button>
                <button onclick="window.setExpenseLimit(0)" class="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-full text-zinc-400">All</button>
            </div>
        </div>
    `;

    // Add input listener for real-time updates (debounced)
    const input = document.getElementById('filter-limit-input');
    if (input) {
        input.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const val = parseFloat(e.target.value) || 0;
                updateLimit(val);
            }, 500);
        });
    }

    console.log('[expenses-advanced-filter] Initialized');
}

/**
 * Update the limit value and trigger stats refresh
 * @param {number} limit - Minimum amount
 */
export function updateLimit(limit) {
    currentLimit = parseFloat(limit) || 0;
    
    // Update input display if exists
    const input = document.getElementById('filter-limit-input');
    if (input && input.value != currentLimit) {
        input.value = currentLimit;
    }

    // Notify stats module
    setStatsLimit(currentLimit);
}

/**
 * Apply filter immediately (called from button)
 */
export function applyFilter() {
    const input = document.getElementById('filter-limit-input');
    if (input) {
        const val = parseFloat(input.value) || 0;
        updateLimit(val);
        renderStatsContainer();
    }
}

/**
 * Set limit via preset button
 * @param {number} val 
 */
export function setLimitPreset(val) {
    updateLimit(val);
    renderStatsContainer();
}

// ── GLOBAL EXPOSURE ──
// Expose functions for inline onclick handlers in HTML
Object.assign(window, {
    applyExpenseFilter: applyFilter,
    setExpenseLimit: setLimitPreset
});