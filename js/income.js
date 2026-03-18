// js/income.js

import { state } from './state.js';
import { api } from './api.js';
import { hideModal } from './utils.js';
import { loadDashboard } from './dashboard.js';
import { todayString } from './date-utils.js';

function renderIncome(list) {
    const container = document.getElementById('income-list');
    if (!container) return;

    container.innerHTML = list.map(inc => `
        <div class="bg-zinc-900 rounded-3xl p-5 flex justify-between items-center card">
            <div>
                <div class="text-xs text-zinc-500">${inc.date || '—'}</div>
                <div class="font-semibold text-xl text-emerald-400">+${parseFloat(inc.amount).toLocaleString('ru-RU')}</div>
                <div class="text-sm text-zinc-400">${inc.desc || ''}</div>
            </div>
            <div onclick="deleteIncome('${inc.id}'); event.stopPropagation()"
                 class="text-red-400 text-2xl cursor-pointer">🗑</div>
        </div>
    `).join('');
}

async function loadIncome() {
    const data = await api('get_income');
    state.incomeData = data || [];
    renderIncome(state.incomeData);
}

function showAddIncomeModal() {
    document.getElementById('inc-date').value = todayString();
    document.getElementById('inc-amount').value = '';
    document.getElementById('inc-desc').value = '';
    document.getElementById('modal-income').classList.remove('hidden');
    document.getElementById('modal-income').classList.add('flex');
}

async function saveIncome() {
    const amountStr = document.getElementById('inc-amount').value.trim();
    const amount = parseFloat(amountStr);

    if (!amountStr || isNaN(amount) || amount <= 0) {
        alert("Please enter a valid positive amount");
        return;
    }

    const payload = {
        date: document.getElementById('inc-date').value,
        amount,
        desc: document.getElementById('inc-desc').value.trim()
    };

    try {
        const res = await api('add_income', payload);
        if (res?.success) {
            hideModal('modal-income');
            await loadIncome();
            await loadDashboard();
        } else {
            alert("Could not save income" + (res?.error ? `: ${res.error}` : ""));
        }
    } catch (err) {
        console.error('Error saving income:', err);
        alert("Network/server error while saving income");
    }
}

async function deleteIncome(id) {
    if (!confirm('Delete this income entry?')) return;

    try {
        await api('delete_income', { id });
        await loadIncome();
        await loadDashboard();
    } catch (err) {
        console.error('Error deleting income:', err);
        alert("Failed to delete income entry");
    }
}

Object.assign(window, {
    showAddIncomeModal,
    saveIncome,
    deleteIncome,
    loadIncome
});

export { loadIncome };
