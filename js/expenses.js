// js/expenses.js

import { state } from './state.js';
import { api } from './api.js';
import { hideModal } from './utils.js';
import { loadDashboard } from './dashboard.js';
import { todayString } from './date-utils.js';

const EXPENSE_TOOLS = [
    {code: "gp", name: "GP"},
    {code: "hal", name: "Hal"},
    {code: "sb", name: "SB"},
    {code: "ren", name: "Ren"},
    {code: "oz", name: "OZON"},
    {code: "ya", name: "Yandex"},
    {code: "cert", name: "Certificate"},
    {code: "cash", name: "Cash"},
    {code: "transfer", name: "Transfer"},
    {code: "other", name: "Other…"}
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

let selectedExpenseTool = null;
let selectedExpenseCategory = null;
let editingExpenseId = null;

// ── RENDER ──

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

// ── ✨ UPDATED LIST RENDER (EDIT FIX HERE) ──

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
                    ${exp.desc ? ` • ${exp.desc}` : ''}
                </div>
            </div>

            <div class="flex gap-3 text-2xl">
                <!-- ✏️ EDIT BUTTON -->
                <div onclick="editExpense('${exp.id}', event)"
                     class="cursor-pointer select-none active:scale-90">
                    ✏️
                </div>

                <!-- 🗑 DELETE BUTTON -->
                <div onclick="deleteExpense('${exp.id}'); event.stopPropagation()"
                     class="text-red-400 cursor-pointer select-none active:scale-90">
                    🗑
                </div>
            </div>
        </div>
    `).join('');
}

// ── EDIT HANDLER ──

function editExpense(id, event) {
    if (event) event.stopPropagation();

    const exp = state.expensesData.find(e => e.id == id);
    if (!exp) return;

    editingExpenseId = id;

    document.getElementById('exp-date').value = exp.date || '';
    document.getElementById('exp-amount').value = exp.amount || '';
    document.getElementById('exp-desc').value = exp.desc || '';

    // Tool
    const knownTool = EXPENSE_TOOLS.find(t => t.code === exp.tool);
    if (knownTool) {
        selectedExpenseTool = knownTool.code;
        document.getElementById('exp-tool-other-group').classList.add('hidden');
    } else {
        selectedExpenseTool = 'other';
        document.getElementById('exp-tool-other-group').classList.remove('hidden');
        document.getElementById('exp-tool-other').value = exp.tool;
    }

    // Category
    selectedExpenseCategory = exp.category;

    renderExpenseTools();
    renderExpenseCategories();

    document.getElementById('modal-expense').classList.remove('hidden');
    document.getElementById('modal-expense').classList.add('flex');
}

// ── LOAD ──

async function loadExpenses() {
    const data = await api('get_expenses');
    state.expensesData = data || [];
    renderExpenses(state.expensesData);
}

// ── ADD / SAVE ──

function showAddExpenseModal() {
    editingExpenseId = null;

    document.getElementById('exp-date').value = todayString();
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-desc').value = '';

    selectedExpenseTool = null;
    selectedExpenseCategory = null;

    renderExpenseTools();
    renderExpenseCategories();

    document.getElementById('exp-tool-other-group').classList.add('hidden');

    document.getElementById('modal-expense').classList.remove('hidden');
    document.getElementById('modal-expense').classList.add('flex');
}

async function saveExpense() {
    if (!selectedExpenseTool) { alert("Please select a tool"); return; }
    if (!selectedExpenseCategory) { alert("Please select a category"); return; }

    let toolValue = selectedExpenseTool;

    if (selectedExpenseTool === 'other') {
        const custom = document.getElementById('exp-tool-other').value.trim();
        if (!custom) { alert("Please specify the other tool"); return; }
        toolValue = custom;
    }

    const amountStr = document.getElementById('exp-amount').value.trim();
    const amount = parseFloat(amountStr);

    if (!amountStr || isNaN(amount) || amount <= 0) {
        alert("Please enter a valid positive amount");
        return;
    }

    const payload = {
        id: editingExpenseId, // 👈 IMPORTANT
        date: document.getElementById('exp-date').value,
        amount,
        tool: toolValue,
        category: selectedExpenseCategory,
        desc: document.getElementById('exp-desc').value.trim()
    };

    try {
        const action = editingExpenseId ? 'update_expense' : 'add_expense';
        const res = await api(action, payload);

        if (res?.success) {
            hideModal('modal-expense');
            loadExpenses();
            loadDashboard();
        } else {
            alert("Could not save expense");
        }
    } catch (err) {
        console.error(err);
        alert("Network/server error");
    }
}

// ── DELETE ──

async function deleteExpense(id) {
    if (!confirm('Delete expense?')) return;
    await api('delete_expense', {id});
    loadExpenses();
    loadDashboard();
}

// ── GLOBAL ──

Object.assign(window, {
    selectExpenseTool,
    selectExpenseCategory,
    renderExpenseTools,
    renderExpenseCategories,
    showAddExpenseModal,
    saveExpense,
    deleteExpense,
    loadExpenses,
    editExpense
});

export { loadExpenses };