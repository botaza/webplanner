// js/expenses-filter.js  [PATCHED – multi-date support]
// Allows adding the same expense across multiple dates via a date-chip toggle.

import { state } from './state.js';
import { api } from './api.js';
import { hideModal } from './utils.js';
import { loadDashboard } from './dashboard.js';
import { todayString } from './date-utils.js';

const EXPENSE_TOOLS = [
    {code: "gp",       name: "GP"},
    {code: "hal",      name: "Hal"},
    {code: "sb",       name: "SB"},
    {code: "ren",      name: "Ren"},
    {code: "oz",       name: "OZON"},
    {code: "ya",       name: "Yandex"},
    {code: "cert",     name: "Certificate"},
    {code: "cash",     name: "Cash"},
    {code: "transfer", name: "Transfer"},
    {code: "other",    name: "Other…"}
];

const EXPENSE_CATEGORIES = [
    {emoji: "🍔", name: "food"},
    {emoji: "🚗", name: "transport"},
    {emoji: "✈️", name: "travel"},
    {emoji: "🏠", name: "housing"},
    {emoji: "💊", name: "health"},
    {emoji: "🚫", name: "notmy"},
    {emoji: "🎮", name: "fun"},
    {emoji: "🛒", name: "shop"},
    {emoji: "➡️", name: "transfer"},
    {emoji: "🎓", name: "education"},
    {emoji: "🧾", name: "bills"},
    {emoji: "🎁", name: "gifts"},
    {emoji: "📲", name: "sbp"},
    {emoji: "📦", name: "other"},
    {emoji: "🏋️", name: "gym"},
    {emoji: "💳", name: "loans"},
];

let selectedExpenseTool     = null;
let selectedExpenseCategory = null;

// ── MULTI-DATE STATE ──────────────────────────────────────────────
// When multiDateMode is true the user builds a list of dates;
// otherwise the single #exp-date input is used (original behaviour).
let multiDateMode   = false;
let selectedDates   = []; // Array<string>  YYYY-MM-DD

/** Toggle multi-date mode on/off */
function toggleMultiDateMode() {
    multiDateMode = !multiDateMode;

    const btn       = document.getElementById('exp-multi-date-btn');
    const panel     = document.getElementById('exp-multi-date-panel');
    const singleRow = document.getElementById('exp-single-date-row');

    if (multiDateMode) {
        // Seed with whatever single date is currently set
        const current = document.getElementById('exp-date').value;
        selectedDates = current ? [current] : [];

        if (btn)       { btn.textContent = '📅 Single date'; btn.classList.add('active'); }
        if (panel)     panel.classList.remove('hidden');
        if (singleRow) singleRow.classList.add('hidden');

        _renderDateChips();
    } else {
        // Revert: put first selected date back into single input
        const fallback = selectedDates[0] || todayString();
        document.getElementById('exp-date').value = fallback;
        selectedDates = [];

        if (btn)       { btn.textContent = '📅 Multi-date'; btn.classList.remove('active'); }
        if (panel)     panel.classList.add('hidden');
        if (singleRow) singleRow.classList.remove('hidden');
    }
}

/** Add a date from the multi-date picker to the chip list */
function addMultiDate() {
    const picker = document.getElementById('exp-multi-date-picker');
    if (!picker || !picker.value) return;

    const val = picker.value;
    if (!selectedDates.includes(val)) {
        selectedDates.push(val);
        selectedDates.sort(); // keep chronological order
        _renderDateChips();
    }
    picker.value = '';
}

/** Remove a date chip */
function removeMultiDate(dateStr) {
    selectedDates = selectedDates.filter(d => d !== dateStr);
    _renderDateChips();
}

/** Render the current selectedDates as dismissible chips */
function _renderDateChips() {
    const container = document.getElementById('exp-date-chips');
    if (!container) return;

    const countEl = document.getElementById('exp-multi-date-count');
    if (countEl) {
        countEl.textContent = selectedDates.length
            ? `${selectedDates.length} date${selectedDates.length > 1 ? 's' : ''} selected`
            : 'No dates selected';
    }

    if (selectedDates.length === 0) {
        container.innerHTML = '<span class="text-xs text-zinc-500 italic">Add dates below</span>';
        return;
    }

    container.innerHTML = selectedDates.map(d => {
        const label = new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
        return `
            <div class="flex items-center gap-1 bg-zinc-800 border border-zinc-700
                        rounded-2xl px-3 py-1.5 text-sm text-zinc-200">
                <span>${label}</span>
                <button onclick="removeMultiDate('${d}')"
                        class="ml-1 text-zinc-500 hover:text-red-400 leading-none text-lg"
                        title="Remove">×</button>
            </div>`;
    }).join('');
}

// ── TOOL / CATEGORY RENDERERS ─────────────────────────────────────

function renderExpenseTools() {
    const container = document.getElementById('exp-tool-buttons');
    if (!container) return;
    container.innerHTML = EXPENSE_TOOLS.map(t => `
        <div class="tool-btn ${t.code === selectedExpenseTool ? 'active' : ''}"
             data-code="${t.code}"
             onclick="selectExpenseTool('${t.code}')">
            ${t.name}
        </div>
    `).join('');
}

function selectExpenseTool(code) {
    selectedExpenseTool = code;
    document.querySelectorAll('#exp-tool-buttons .tool-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.code === code);
    });
    const other = document.getElementById('exp-tool-other-group');
    if (code === 'other') {
        other.classList.remove('hidden');
    } else {
        other.classList.add('hidden');
        document.getElementById('exp-tool-other').value = '';
    }
}

function renderExpenseCategories() {
    const container = document.getElementById('exp-category-buttons');
    if (!container) return;
    container.innerHTML = EXPENSE_CATEGORIES.map(c => `
        <div class="category-btn ${c.name === selectedExpenseCategory ? 'active' : ''}"
             title="${c.name}"
             onclick="selectExpenseCategory('${c.name}')">
            ${c.emoji}
        </div>
    `).join('');
}

function selectExpenseCategory(name) {
    selectedExpenseCategory = name;
    document.querySelectorAll('#exp-category-buttons .category-btn').forEach(b => {
        b.classList.toggle('active', b.title === name);
    });
}

// ── LIST RENDER ───────────────────────────────────────────────────

function renderExpenses(list) {
    const container = document.getElementById('expenses-list');
    container.innerHTML = list.map(exp => `
        <div class="bg-zinc-900 rounded-3xl p-5 flex justify-between items-center card">
            <div>
                <div class="text-xs text-zinc-500">${exp.date || '—'}</div>
                <div class="font-semibold text-xl">−${parseFloat(exp.amount || 0).toLocaleString('ru-RU')}</div>
                <div class="text-sm text-zinc-400 mt-1">
                    ${exp.tool || '?'}
                    ${exp.category ? ` • ${exp.category}` : ''}
                    ${exp.desc    ? ` • ${exp.desc}`    : ''}
                </div>
            </div>
            <div onclick="deleteExpense('${exp.id}'); event.stopPropagation()"
                 class="text-red-400 text-2xl cursor-pointer">🗑</div>
        </div>
    `).join('');
}

async function loadExpenses() {
    const data = await api('get_expenses');
    state.expensesData = data || [];
    renderExpenses(state.expensesData);
}

// ── MODAL OPEN ────────────────────────────────────────────────────

function showAddExpenseModal() {
    // Reset state
    multiDateMode           = false;
    selectedDates           = [];
    selectedExpenseTool     = null;
    selectedExpenseCategory = null;

    document.getElementById('exp-date').value = todayString();

    // Reset multi-date UI
    const btn       = document.getElementById('exp-multi-date-btn');
    const panel     = document.getElementById('exp-multi-date-panel');
    const singleRow = document.getElementById('exp-single-date-row');

    if (btn)       { btn.textContent = '📅 Multi-date'; btn.classList.remove('active'); }
    if (panel)     panel.classList.add('hidden');
    if (singleRow) singleRow.classList.remove('hidden');
    _renderDateChips();

    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-desc').value   = '';
    document.getElementById('modal-expense').classList.remove('hidden');
    document.getElementById('modal-expense').classList.add('flex');
    document.getElementById('exp-modal-title').textContent = 'New Expense';
    document.getElementById('exp-save-btn').onclick = saveExpense;

    renderExpenseTools();
    renderExpenseCategories();
    document.getElementById('exp-tool-other-group').classList.add('hidden');
}

function closeExpenseModal() {
    hideModal('modal-expense');
}

// ── SAVE (supports multi-date) ────────────────────────────────────

async function saveExpense() {
    if (!selectedExpenseTool)     { alert("Please select a tool");     return; }
    if (!selectedExpenseCategory) { alert("Please select a category"); return; }

    let toolValue = selectedExpenseTool;
    if (selectedExpenseTool === 'other') {
        const custom = document.getElementById('exp-tool-other').value.trim();
        if (!custom) { alert("Please specify the other tool"); return; }
        toolValue = custom;
    }

    const amountStr = document.getElementById('exp-amount').value.trim();
    const amount    = parseFloat(amountStr);
    if (!amountStr || isNaN(amount) || amount <= 0) {
        alert("Please enter a valid positive amount");
        return;
    }

    // Determine which dates to save
    let datesToSave;
    if (multiDateMode) {
        if (selectedDates.length === 0) {
            alert("Please add at least one date in multi-date mode");
            return;
        }
        datesToSave = [...selectedDates];
    } else {
        const singleDate = document.getElementById('exp-date').value;
        if (!singleDate) { alert("Please select a date"); return; }
        datesToSave = [singleDate];
    }

    const basePayload = {
        amount,
        tool:     toolValue,
        category: selectedExpenseCategory,
        desc:     document.getElementById('exp-desc').value.trim()
    };

    try {
        // Save one expense record per selected date (sequentially)
        let allOk = true;
        for (const date of datesToSave) {
            const res = await api('add_expense', { ...basePayload, date });
            if (!res?.success) {
                allOk = false;
                console.error('[expenses-filter] Failed to save for date', date, res);
            }
        }

        if (allOk) {
            hideModal('modal-expense');
            loadExpenses();
            loadDashboard();
            if (datesToSave.length > 1) {
                // Brief toast-style confirmation (no extra deps needed)
                _showToast(`✅ ${datesToSave.length} expenses saved`);
            }
        } else {
            alert("One or more expenses could not be saved — check the console for details.");
            loadExpenses();
            loadDashboard();
        }
    } catch (err) {
        console.error(err);
        alert("Network/server error while saving expense");
    }
}

/** Tiny transient toast (self-contained, no library needed) */
function _showToast(msg) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = [
        'position:fixed',
        'bottom:90px',
        'left:50%',
        'transform:translateX(-50%)',
        'background:#22c55e',
        'color:#fff',
        'padding:10px 20px',
        'border-radius:999px',
        'font-size:14px',
        'font-weight:500',
        'z-index:9999',
        'pointer-events:none',
        'transition:opacity 0.4s'
    ].join(';');
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 1800);
    setTimeout(() => el.remove(), 2300);
}

// ── DELETE ────────────────────────────────────────────────────────

async function deleteExpense(id) {
    if (!confirm('Delete expense?')) return;
    await api('delete_expense', {id});
    loadExpenses();
    loadDashboard();
}

// ── GLOBAL EXPOSURE ───────────────────────────────────────────────

Object.assign(window, {
    selectExpenseTool,
    selectExpenseCategory,
    renderExpenseTools,
    renderExpenseCategories,
    showAddExpenseModal,
    closeExpenseModal,
    saveExpense,
    deleteExpense,
    loadExpenses,
    // Multi-date
    toggleMultiDateMode,
    addMultiDate,
    removeMultiDate,
});

export { loadExpenses };
