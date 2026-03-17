// js/expenses.js

import { state } from './state.js';
import { api } from './api.js';
import { hideModal } from './utils.js';
import { loadDashboard } from './dashboard.js';
import { todayString } from './date-utils.js';

// ================== EXPENSE TOOLS & CATEGORIES =================================

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
    if (other) {
        if (code === 'other') {
            other.classList.remove('hidden');
        } else {
            other.classList.add('hidden');
            document.getElementById('exp-tool-other').value = '';
        }
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

// ================== EXPENSES RENDER & CRUD =====================================

function renderExpenses(list) {
    const container = document.getElementById('expenses-list');
    if (!container) return;

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

function showAddExpenseModal() {
    document.getElementById('exp-date').value = todayString();
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-desc').value = '';
    selectedExpenseTool = null;
    selectedExpenseCategory = null;
    document.getElementById('modal-expense').classList.remove('hidden');
    document.getElementById('modal-expense').classList.add('flex');
    renderExpenseTools();
    renderExpenseCategories();
    document.getElementById('exp-tool-other-group')?.classList.add('hidden');
}

async function saveExpense() {
    if (!selectedExpenseTool) { alert("Please select a tool"); return; }
    if (!selectedExpenseCategory) { alert("Please select a category"); return; }

    let toolValue = selectedExpenseTool;
    if (selectedExpenseTool === 'other') {
        const custom = document.getElementById('exp-tool-other')?.value.trim();
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
        date: document.getElementById('exp-date').value,
        amount,
        tool: toolValue,
        category: selectedExpenseCategory,
        desc: document.getElementById('exp-desc').value.trim()
    };

    try {
        const res = await api('add_expense', payload);
        if (res?.success) {
            hideModal('modal-expense');
            await loadExpenses();
            await loadDashboard();
        } else {
            alert("Could not save expense" + (res?.error ? `: ${res.error}` : ""));
        }
    } catch (err) {
        console.error('Error saving expense:', err);
        alert("Network/server error while saving expense");
    }
}

async function deleteExpense(id) {
    if (!confirm('Delete expense?')) return;
    try {
        await api('delete_expense', {id});
        await loadExpenses();
        await loadDashboard();
    } catch (err) {
        console.error('Error deleting expense:', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global exposure for HTML onclick / modal buttons
Object.assign(window, {
    selectExpenseTool,
    selectExpenseCategory,
    renderExpenseTools,
    renderExpenseCategories,
    showAddExpenseModal,
    saveExpense,
    deleteExpense,
    loadExpenses
});

export { loadExpenses };