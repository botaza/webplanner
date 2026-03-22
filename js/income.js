// js/income.js
// ORCHESTRATOR FOR INCOME TAB
// Coordinates UI, CRUD, list rendering, and stats for income & compensations

import { state } from './state.js';
import { loadDashboard } from './dashboard.js';
import { todayString } from './date-utils.js';

import {
    initIncomeUI,
    showIncomeModal,
    closeIncomeModal,
    renderIncomeTools,
    handleIncomeToolSelect,
    getIncomeFormData,
    resetIncomeForm,
    showCompensationModal,
    closeCompensationModal,
    renderCompensationTools,
    handleCompensationToolSelect,
    getCompensationFormData,
    resetCompensationForm
} from './income-ui.js';

import {
    loadIncomeData,
    saveIncomeData,
    deleteIncomeData,
    loadCompensationsData,
    saveCompensationData,
    deleteCompensationData
} from './income-crud.js';

import {
    initIncomeStats,
    renderIncomeStats,
    setIncomeStatsView,
    renderStatsViewButtons
} from './income-stats.js';

// ── STATS PANEL TOGGLE STATE ──
let statsOpen = false;

// ── INITIALIZATION ──

/**
 * Called once at boot from app.js
 */
export function initIncome() {
    initIncomeUI();
    initIncomeStats();
    console.log('[income.js] Initialized');
}

// ── LOAD & RENDER LIST ──

/**
 * Load both income and compensation data, render the combined list
 */
export async function loadIncome() {
    try {
        const [incData, compData] = await Promise.all([
            loadIncomeData(),
            loadCompensationsData()
        ]);

        state.incomeData        = incData  || [];
        state.compensationsData = compData || [];

        _renderList();

        // Refresh stats if panel is open
        if (statsOpen) renderIncomeStats();

    } catch (err) {
        console.error('[income.js] Failed to load income data:', err);
        const container = document.getElementById('income-list');
        if (container) {
            container.innerHTML = `<div class="text-red-400 text-center py-10">Failed to load income data</div>`;
        }
    }
}

/**
 * Render the combined income + compensation list
 */
function _renderList() {
    const container = document.getElementById('income-list');
    if (!container) return;

    const incEntries  = [...(state.incomeData        || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const compEntries = [...(state.compensationsData || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Compute running totals for header banner
    const incTotal  = incEntries.reduce((s, e)  => s + (parseFloat(e.amount) || 0), 0);
    const compTotal = compEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const adjTotal  = incTotal - compTotal;

    if (incEntries.length === 0 && compEntries.length === 0) {
        container.innerHTML = `<div class="text-zinc-500 text-center py-10">No income entries yet</div>`;
        return;
    }

    // Summary banner
    const banner = `
        <div class="grid grid-cols-3 gap-3 mb-5">
            <div class="bg-zinc-900 rounded-2xl p-3 text-center">
                <div class="text-xs text-zinc-500 mb-1">Income</div>
                <div class="text-sm font-semibold text-emerald-400">+${incTotal.toLocaleString('ru-RU')}</div>
            </div>
            <div class="bg-zinc-900 rounded-2xl p-3 text-center">
                <div class="text-xs text-zinc-500 mb-1">Compensation</div>
                <div class="text-sm font-semibold text-amber-400">−${compTotal.toLocaleString('ru-RU')}</div>
            </div>
            <div class="bg-zinc-900 rounded-2xl p-3 text-center">
                <div class="text-xs text-zinc-500 mb-1">Adjusted</div>
                <div class="text-sm font-semibold ${adjTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                    ${adjTotal >= 0 ? '+' : ''}${adjTotal.toLocaleString('ru-RU')}
                </div>
            </div>
        </div>
    `;

    // Income entries
    const incRows = incEntries.map(inc => `
        <div class="bg-zinc-900 rounded-3xl p-4 flex justify-between items-center card">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs text-zinc-500">${inc.date || '—'}</span>
                    ${inc.tool ? `<span class="text-xs bg-zinc-800 px-2 py-0.5 rounded-full">${inc.tool}</span>` : ''}
                </div>
                <div class="font-semibold text-lg text-emerald-400">+${parseFloat(inc.amount).toLocaleString('ru-RU')}</div>
                ${inc.desc ? `<div class="text-sm text-zinc-400 mt-0.5">${inc.desc}</div>` : ''}
            </div>
            <button onclick="window.deleteIncome('${inc.id}')"
                    class="text-zinc-600 hover:text-red-400 text-2xl ml-3 transition">🗑</button>
        </div>
    `).join('');

    // Compensation entries
    const compRows = compEntries.map(comp => `
        <div class="bg-zinc-900 rounded-3xl p-4 flex justify-between items-center card border border-amber-900/30">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs text-zinc-500">${comp.date || '—'}</span>
                    ${comp.tool ? `<span class="text-xs bg-zinc-800 px-2 py-0.5 rounded-full">${comp.tool}</span>` : ''}
                    <span class="text-xs bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded-full">compensation</span>
                </div>
                <div class="font-semibold text-lg text-amber-400">−${parseFloat(comp.amount).toLocaleString('ru-RU')}</div>
                ${comp.desc ? `<div class="text-sm text-zinc-400 mt-0.5">${comp.desc}</div>` : ''}
            </div>
            <button onclick="window.deleteCompensation('${comp.id}')"
                    class="text-zinc-600 hover:text-red-400 text-2xl ml-3 transition">🗑</button>
        </div>
    `).join('');

    const hasBoth    = incEntries.length > 0 && compEntries.length > 0;
    const compSection = compEntries.length > 0 ? `
        ${hasBoth ? `<div class="text-xs text-amber-500 font-medium uppercase mt-5 mb-2 px-1">Compensations</div>` : ''}
        <div class="space-y-3">${compRows}</div>
    ` : '';

    container.innerHTML = `
        ${banner}
        <div class="space-y-3">${incRows}</div>
        ${compSection}
    `;
}

// ── STATS PANEL ──

/**
 * Toggle the stats panel visibility
 */
export function toggleIncomeStats() {
    statsOpen = !statsOpen;
    const panel = document.getElementById('income-stats-panel');
    const btn   = document.getElementById('income-stats-toggle-btn');

    if (!panel) return;

    if (statsOpen) {
        panel.classList.remove('hidden');
        if (btn) btn.classList.add('active');
        renderStatsViewButtons();
        renderIncomeStats();
    } else {
        panel.classList.add('hidden');
        if (btn) btn.classList.remove('active');
    }
}

// ── SAVE HANDLERS ──

/**
 * Save a new income entry
 */
async function handleSaveIncome() {
    const formData = getIncomeFormData();
    if (!formData) return;

    try {
        const res = await saveIncomeData(formData);
        if (res?.success) {
            closeIncomeModal();
            resetIncomeForm();
            await loadIncome();
            await loadDashboard();
        } else {
            alert('Could not save income' + (res?.error ? `: ${res.error}` : ''));
        }
    } catch (err) {
        console.error('[income.js] Save income error:', err);
        alert('Network/server error while saving income');
    }
}

/**
 * Save a new compensation entry
 */
async function handleSaveCompensation() {
    const formData = getCompensationFormData();
    if (!formData) return;

    try {
        const res = await saveCompensationData(formData);
        if (res?.success) {
            closeCompensationModal();
            resetCompensationForm();
            await loadIncome();
            await loadDashboard();
        } else {
            alert('Could not save compensation' + (res?.error ? `: ${res.error}` : ''));
        }
    } catch (err) {
        console.error('[income.js] Save compensation error:', err);
        alert('Network/server error while saving compensation');
    }
}

// ── DELETE HANDLERS ──

/**
 * Delete an income entry
 * @param {string} id
 */
async function handleDeleteIncome(id) {
    if (!confirm('Delete this income entry?')) return;
    try {
        await deleteIncomeData(id);
        await loadIncome();
        await loadDashboard();
    } catch (err) {
        console.error('[income.js] Delete income error:', err);
        alert('Failed to delete income entry');
    }
}

/**
 * Delete a compensation entry
 * @param {string} id
 */
async function handleDeleteCompensation(id) {
    if (!confirm('Delete this compensation entry?')) return;
    try {
        await deleteCompensationData(id);
        await loadIncome();
        await loadDashboard();
    } catch (err) {
        console.error('[income.js] Delete compensation error:', err);
        alert('Failed to delete compensation entry');
    }
}

// ── GLOBAL EXPOSURE ──
Object.assign(window, {
    // Modal openers
    showAddIncomeModal:        showIncomeModal,
    showAddCompensationModal:  showCompensationModal,

    // Modal closers
    closeIncomeModal,
    closeCompensationModal,

    // Tool selectors (called from rendered buttons)
    selectIncomeTool:        handleIncomeToolSelect,
    selectCompensationTool:  handleCompensationToolSelect,

    // Save actions (called from modal Save buttons)
    saveIncome:        handleSaveIncome,
    saveCompensation:  handleSaveCompensation,

    // Delete actions (called from list cards)
    deleteIncome:        handleDeleteIncome,
    deleteCompensation:  handleDeleteCompensation,

    // Stats toggle
    toggleIncomeStats,

    // Reload (used by dashboard refresh etc.)
    loadIncome
});
