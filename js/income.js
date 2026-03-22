// js/income.js
// ORCHESTRATOR FOR INCOME TAB
// UPDATED: Main list now uses collapsible month groups

import { state } from './state.js';
import { loadDashboard } from './dashboard.js';

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

// ── LOCAL STATE ──
let statsOpen        = false;
const expandedMonths = new Set();

// ── INITIALIZATION ──

export function initIncome() {
    initIncomeUI();
    initIncomeStats();
    console.log('[income.js] Initialized');
}

// ── LOAD & RENDER ──

export async function loadIncome() {
    try {
        const [incData, compData] = await Promise.all([
            loadIncomeData(),
            loadCompensationsData()
        ]);

        state.incomeData        = incData  || [];
        state.compensationsData = compData || [];

        _renderList();

        if (statsOpen) renderIncomeStats();

    } catch (err) {
        console.error('[income.js] Failed to load income data:', err);
        const container = document.getElementById('income-list');
        if (container) {
            container.innerHTML = `<div class="text-red-400 text-center py-10">Failed to load income data</div>`;
        }
    }
}

// ── COLLAPSIBLE LIST RENDERER ──

function _renderList() {
    const container = document.getElementById('income-list');
    if (!container) return;

    const incEntries  = state.incomeData        || [];
    const compEntries = state.compensationsData || [];

    if (incEntries.length === 0 && compEntries.length === 0) {
        container.innerHTML = `<div class="text-zinc-500 text-center py-10">No income entries yet</div>`;
        return;
    }

    // Merge all entries with a type tag
    const allEntries = [
        ...incEntries.map(e  => ({ ...e, _type: 'income' })),
        ...compEntries.map(e => ({ ...e, _type: 'compensation' }))
    ];

    // Group by month YYYY-MM
    const grouped = {};
    allEntries.forEach(e => {
        const month = (e.date || 'unknown').substring(0, 7);
        if (!grouped[month]) grouped[month] = [];
        grouped[month].push(e);
    });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const months       = Object.keys(grouped).sort().reverse();

    // Auto-expand current month on first load
    if (expandedMonths.size === 0 && grouped[currentMonth]) {
        expandedMonths.add(currentMonth);
    }

    // Global summary banner (all-time totals)
    const totalInc  = incEntries.reduce((s, e)  => s + (parseFloat(e.amount) || 0), 0);
    const totalComp = compEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const totalAdj  = totalInc - totalComp;

    const banner = `
        <div class="grid grid-cols-3 gap-3 mb-5">
            <div class="bg-zinc-900 rounded-2xl p-3 text-center">
                <div class="text-xs text-zinc-500 mb-1">Income</div>
                <div class="text-sm font-semibold text-emerald-400">+${totalInc.toLocaleString('ru-RU')}</div>
            </div>
            <div class="bg-zinc-900 rounded-2xl p-3 text-center">
                <div class="text-xs text-zinc-500 mb-1">Compensation</div>
                <div class="text-sm font-semibold text-amber-400">−${totalComp.toLocaleString('ru-RU')}</div>
            </div>
            <div class="bg-zinc-900 rounded-2xl p-3 text-center">
                <div class="text-xs text-zinc-500 mb-1">Adjusted</div>
                <div class="text-sm font-semibold ${totalAdj >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                    ${totalAdj >= 0 ? '+' : ''}${totalAdj.toLocaleString('ru-RU')}
                </div>
            </div>
        </div>`;

    // Month blocks
    const monthBlocks = months.map(month => {
        const entries   = grouped[month];
        const isOpen    = expandedMonths.has(month);
        const isCurrent = month === currentMonth;

        const monthInc  = entries.filter(e => e._type === 'income')
                                 .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const monthComp = entries.filter(e => e._type === 'compensation')
                                 .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const monthAdj  = monthInc - monthComp;

        const [year, m] = month.split('-');
        const label     = new Date(+year, +m - 1, 1)
            .toLocaleString('en-US', { month: 'long', year: 'numeric' });

        const adjColor = monthAdj >= 0 ? 'text-emerald-400' : 'text-red-400';
        const adjSign  = monthAdj >= 0 ? '+' : '';

        // Sort entries newest first
        const sorted = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const entryRows = sorted.map(e => {
            const isComp = e._type === 'compensation';
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
        }).join('');

        return `
            <div class="bg-zinc-900 rounded-3xl p-4 mb-3 cursor-pointer hover:bg-zinc-800 transition"
                 onclick="window.toggleIncomeMonth('${month}')">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="text-emerald-500 text-lg">${isOpen ? '📂' : '📁'}</div>
                        <div>
                            <div class="font-semibold text-zinc-200">
                                ${label}
                                ${isCurrent ? '<span class="text-emerald-400 text-xs ml-1">now</span>' : ''}
                            </div>
                            <div class="text-xs text-zinc-500">${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'}</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="${adjColor} font-semibold">${adjSign}${monthAdj.toLocaleString('ru-RU')}</div>
                        ${monthComp > 0
                            ? `<div class="text-xs text-zinc-500">+${monthInc.toLocaleString('ru-RU')} − ${monthComp.toLocaleString('ru-RU')}</div>`
                            : ''}
                    </div>
                </div>
            </div>
            <div id="income-month-${month}" class="ml-2 space-y-2 mb-5 ${isOpen ? '' : 'hidden'}">
                ${entryRows}
            </div>`;
    }).join('');

    container.innerHTML = banner + monthBlocks;
}

// ── TOGGLE ──

export function toggleIncomeMonth(month) {
    if (expandedMonths.has(month)) {
        expandedMonths.delete(month);
    } else {
        expandedMonths.add(month);
    }

    const content = document.getElementById(`income-month-${month}`);
    if (content) content.classList.toggle('hidden');

    const header = document.querySelector(`[onclick="window.toggleIncomeMonth('${month}')"]`);
    if (header) {
        const icon = header.querySelector('.text-emerald-500');
        if (icon) icon.textContent = expandedMonths.has(month) ? '📂' : '📁';
    }
}

// ── STATS PANEL ──

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

async function handleDeleteIncome(id) {
    if (!confirm('Delete this income entry?')) return;
    try {
        await deleteIncomeData(id);
        await loadIncome();
        await loadDashboard();
        if (statsOpen) renderIncomeStats();
    } catch (err) {
        console.error('[income.js] Delete income error:', err);
        alert('Failed to delete income entry');
    }
}

async function handleDeleteCompensation(id) {
    if (!confirm('Delete this compensation entry?')) return;
    try {
        await deleteCompensationData(id);
        await loadIncome();
        await loadDashboard();
        if (statsOpen) renderIncomeStats();
    } catch (err) {
        console.error('[income.js] Delete compensation error:', err);
        alert('Failed to delete compensation entry');
    }
}

// ── GLOBAL EXPOSURE ──
Object.assign(window, {
    showAddIncomeModal:       showIncomeModal,
    showAddCompensationModal: showCompensationModal,
    closeIncomeModal,
    closeCompensationModal,
    selectIncomeTool:         handleIncomeToolSelect,
    selectCompensationTool:   handleCompensationToolSelect,
    saveIncome:               handleSaveIncome,
    saveCompensation:         handleSaveCompensation,
    deleteIncome:             handleDeleteIncome,
    deleteCompensation:       handleDeleteCompensation,
    toggleIncomeStats,
    toggleIncomeMonth,
    loadIncome
});
