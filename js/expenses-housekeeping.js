// js/expenses-housekeeping.js
// HOUSEKEEPING & DATA MANAGEMENT
// Handles archival, cleanup, and size monitoring for expenses

import { api } from './api.js';
import { getExpensesMetadata, archiveExpenses } from './expenses-crud.js';

// ── LOCAL STATE ──
let metaCache = null;
let metaCacheTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

// ── INITIALIZATION ──

/**
 * Initialize housekeeping UI in the More screen
 */
export function initHousekeepingUI() {
    const container = document.getElementById('housekeeping-container');
    if (!container) {
        // Fallback: Append to screen-more if specific container doesn't exist
        const moreScreen = document.getElementById('screen-more');
        if (moreScreen) {
            const div = document.createElement('div');
            div.id = 'housekeeping-container';
            div.className = 'space-y-4 mt-6';
            moreScreen.appendChild(div);
        }
    }
    
    renderHousekeepingCard();
    console.log('[expenses-housekeeping] UI Initialized');
}

/**
 * Render the housekeeping summary card
 */
export async function renderHousekeepingCard() {
    const container = document.getElementById('housekeeping-container');
    if (!container) return;

    try {
        const meta = await getExpensesMetadata();
        metaCache = meta;
        metaCacheTime = Date.now();
        
        const size = meta.file_size_kb || 0;
        const count = meta.record_count || 0;
        const minDate = meta.min_date || 'N/A';
        const maxDate = meta.max_date || 'N/A';

        const sizeColor = size > 500 ? 'text-orange-400' : 'text-zinc-400';
        const sizeWarning = size > 500 ? '⚠️ Large file' : '✅ Healthy';
        const sizeLimit = size > 1000 ? '🔴 Critical' : sizeWarning;

        container.innerHTML = `
            <div class="bg-zinc-900 rounded-3xl p-5">
                <div class="flex justify-between items-center mb-4">
                    <div class="flex items-center gap-3">
                        <div class="text-3xl">🧹</div>
                        <div>
                            <div class="font-medium text-zinc-200">Expense Data Management</div>
                            <div class="text-xs ${sizeColor} mt-1">${sizeLimit} • ${size} KB</div>
                        </div>
                    </div>
                    <button onclick="window.showHousekeepingModal()"
                            class="text-emerald-500 text-sm font-medium hover:text-emerald-400">
                        Manage ›
                    </button>
                </div>
                <div class="grid grid-cols-3 gap-3 text-center">
                    <div class="bg-zinc-950 rounded-2xl p-3">
                        <div class="text-xs text-zinc-500">Records</div>
                        <div class="text-lg font-semibold text-zinc-200">${count}</div>
                    </div>
                    <div class="bg-zinc-950 rounded-2xl p-3">
                        <div class="text-xs text-zinc-500">From</div>
                        <div class="text-sm font-semibold text-zinc-200">${minDate !== 'N/A' ? minDate.substring(0,7) : '—'}</div>
                    </div>
                    <div class="bg-zinc-950 rounded-2xl p-3">
                        <div class="text-xs text-zinc-500">To</div>
                        <div class="text-sm font-semibold text-zinc-200">${maxDate !== 'N/A' ? maxDate.substring(0,7) : '—'}</div>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('[expenses-housekeeping] Failed to load meta:', err);
        container.innerHTML = `
            <div class="bg-zinc-900 rounded-3xl p-5">
                <div class="flex items-center gap-3">
                    <div class="text-3xl">🧹</div>
                    <div class="flex-1">
                        <div class="font-medium text-zinc-200">Expense Data Management</div>
                        <div class="text-xs text-red-400 mt-1">Unable to load stats</div>
                    </div>
                </div>
            </div>
        `;
    }
}

// ── MODAL LOGIC ──

/**
 * Show the housekeeping actions modal
 */
export function showHousekeepingModal() {
    let modal = document.getElementById('modal-housekeeping');
    if (!modal) {
        createHousekeepingModal();
        modal = document.getElementById('modal-housekeeping');
    }
    
    // Refresh stats before showing
    updateModalStats();

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

/**
 * Hide the housekeeping modal
 */
export function hideHousekeepingModal() {
    const modal = document.getElementById('modal-housekeeping');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

/**
 * Create the modal DOM if it doesn't exist
 */
function createHousekeepingModal() {
    const body = document.body;
    const modalHTML = `
        <div id="modal-housekeeping" class="hidden fixed inset-0 bg-black/80 items-end z-[100]">
            <div class="bg-zinc-900 rounded-t-3xl w-full max-w-xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
                <div class="flex justify-between items-center px-6 pt-5 pb-3 border-b border-zinc-800 shrink-0">
                    <div class="text-xl font-semibold">Data Management</div>
                    <button onclick="window.hideHousekeepingModal()"
                            class="text-3xl leading-none text-zinc-400 hover:text-white">×</button>
                </div>
                <div class="p-6 overflow-y-auto flex-1 space-y-6">
                    
                    <!-- Stats Summary -->
                    <div class="bg-zinc-950 rounded-2xl p-4 text-center">
                        <div class="text-xs text-zinc-500 uppercase tracking-wide">Current File Size</div>
                        <div id="hk-file-size" class="text-2xl font-bold text-zinc-200 mt-1">Loading...</div>
                        <div id="hk-record-count" class="text-xs text-zinc-500 mt-1">0 records</div>
                        <div id="hk-date-range" class="text-xs text-zinc-500 mt-1">—</div>
                    </div>

                    <!-- Actions -->
                    <div class="space-y-3">
                        <div class="text-xs text-zinc-500 font-medium uppercase">Actions</div>
                        
                        <button onclick="window.archiveExpensesBefore()"
                                class="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-4 rounded-2xl text-left px-5 flex justify-between items-center transition">
                            <div>
                                <div class="font-medium">Archive Old Records</div>
                                <div class="text-xs text-zinc-500">Move records older than X months to archive</div>
                            </div>
                            <div class="text-emerald-500">📦</div>
                        </button>

                        <button onclick="window.clearExpensesBefore()"
                                class="w-full bg-zinc-800 hover:bg-red-900/30 text-zinc-200 hover:text-red-400 py-4 rounded-2xl text-left px-5 flex justify-between items-center transition">
                            <div>
                                <div class="font-medium">Delete Old Records</div>
                                <div class="text-xs text-zinc-500">Permanently delete records before a date</div>
                            </div>
                            <div class="text-red-500">🗑</div>
                        </button>

                        <button onclick="window.exportExpensesOnly()"
                                class="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-4 rounded-2xl text-left px-5 flex justify-between items-center transition">
                            <div>
                                <div class="font-medium">Export Expenses</div>
                                <div class="text-xs text-zinc-500">Download JSON backup of expenses only</div>
                            </div>
                            <div class="text-blue-500">📥</div>
                        </button>
                    </div>

                    <!-- Warning -->
                    <div class="bg-orange-900/20 border border-orange-900/50 rounded-2xl p-4">
                        <div class="flex gap-3">
                            <div class="text-xl">⚠️</div>
                            <div class="text-xs text-orange-300">
                                <strong>Warning:</strong> Destructive actions will create a snapshot first. 
                                Once deleted, data cannot be recovered unless you restore from snapshot.
                            </div>
                        </div>
                    </div>
                </div>
                <div class="px-6 py-4 border-t border-zinc-800 flex gap-3 shrink-0">
                    <button onclick="window.hideHousekeepingModal()"
                            class="flex-1 py-4 bg-zinc-800 rounded-3xl text-lg font-medium">Close</button>
                </div>
            </div>
        </div>
    `;
    
    body.insertAdjacentHTML('beforeend', modalHTML);
}

// ── MODAL UPDATES ──

/**
 * Update modal stats display
 */
export async function updateModalStats() {
    const sizeEl = document.getElementById('hk-file-size');
    const countEl = document.getElementById('hk-record-count');
    const rangeEl = document.getElementById('hk-date-range');
    
    try {
        // Use cache if fresh
        let meta = metaCache;
        if (!meta || Date.now() - metaCacheTime > CACHE_DURATION) {
            meta = await getExpensesMetadata();
            metaCache = meta;
            metaCacheTime = Date.now();
        }
        
        if (sizeEl) sizeEl.textContent = `${meta.file_size_kb || 0} KB`;
        if (countEl) countEl.textContent = `${meta.record_count || 0} records`;
        if (rangeEl) {
            const minD = meta.min_date ? meta.min_date.substring(0, 7) : '—';
            const maxD = meta.max_date ? meta.max_date.substring(0, 7) : '—';
            rangeEl.textContent = `${minD} to ${maxD}`;
        }
    } catch (err) {
        if (sizeEl) sizeEl.textContent = 'Error';
        console.error('[expenses-housekeeping] Failed to update modal stats:', err);
    }
}

// ── ACTIONS ──

/**
 * Archive expenses older than a specified date
 */
export async function archiveExpensesBefore() {
    const defaultDate = new Date(Date.now() - 180*24*60*60*1000).toISOString().slice(0,10);
    const date = prompt("Archive records before this date (YYYY-MM-DD):", defaultDate);
    if (!date) return;
    
    if (!confirm(`Create snapshot and archive expenses before ${date}?`)) return;
    
    try {
        // 1. Snapshot first
        await api('snapshot');
        // 2. Archive
        const res = await archiveExpenses(date);
        if (res.success) {
            alert(`Success! Archived ${res.archived_count || 0} records.`);
            hideHousekeepingModal();
            renderHousekeepingCard(); // Refresh main card
        } else {
            alert('Archive failed: ' + (res.error || 'Unknown error'));
        }
    } catch (err) {
        console.error('[expenses-housekeeping] Archive error:', err);
        alert('Error during archival process');
    }
}

/**
 * Delete expenses older than a date (Permanent)
 */
export async function clearExpensesBefore() {
    const date = prompt("PERMANENTLY delete records before this date (YYYY-MM-DD):", "");
    if (!date) return;
    
    if (!confirm(`WARNING: This will PERMANENTLY delete expenses before ${date}. A snapshot will be created first.`)) return;
    if (!confirm("Are you absolutely sure? This cannot be undone.")) return;
    
    try {
        // 1. Snapshot
        await api('snapshot');
        
        // 2. Get all expenses
        const allExpenses = await api('get_expenses');
        const kept = allExpenses.filter(e => e.date >= date);
        const deletedCount = allExpenses.length - kept.length;
        
        if (deletedCount === 0) {
            alert('No records found before that date.');
            return;
        }

        // 3. Write back kept data (bulk replace via archive then clear archive)
        // Since we don't have bulk replace, we archive old then delete archive file
        const res = await archiveExpenses(date);
        
        // 4. Delete the archive file to make it permanent
        if (res.success) {
            await api('delete_archive_file'); // Requires backend support
            alert(`Done. ${deletedCount} records permanently deleted.`);
            hideHousekeepingModal();
            renderHousekeepingCard();
        }
    } catch (err) {
        console.error('[expenses-housekeeping] Clear error:', err);
        alert('Error during cleanup');
    }
}

/**
 * Export expenses only to JSON file
 */
export async function exportExpensesOnly() {
    try {
        const data = await api('get_expenses');
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expenses-backup-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert('Expenses exported successfully!');
    } catch (err) {
        console.error('[expenses-housekeeping] Export error:', err);
        alert('Failed to export expenses');
    }
}

// ── GLOBAL EXPOSURE ──
Object.assign(window, {
    showHousekeepingModal,
    hideHousekeepingModal,
    archiveExpensesBefore,
    clearExpensesBefore,
    exportExpensesOnly
});