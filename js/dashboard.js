// js/dashboard.js
// DASHBOARD LOGIC
// Loads and displays dashboard totals for expenses, income, and upcoming events
// UPDATED: Income card now shows adjusted total (income − compensation)

import { state } from './state.js';
import { api } from './api.js';
import { currentMonthKey } from './date-utils.js';

/**
 * Load dashboard data and update UI
 * Called when switching to dashboard screen or after adding/deleting expenses
 */
export async function loadDashboard() {
    const monthKey = currentMonthKey();

    try {
        // Load expenses, income, and compensations in parallel
        const [exps, incs, comps] = await Promise.all([
            api('get_expenses'),
            api('get_income'),
            api('get_compensations')
        ]);

        // Monthly expense total
        const expTotal = (exps || [])
            .filter(e => e.date && e.date.startsWith(monthKey))
            .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

        // Monthly income total
        const incTotal = (incs || [])
            .filter(i => i.date && i.date.startsWith(monthKey))
            .reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);

        // Monthly compensation total
        const compTotal = (comps || [])
            .filter(c => c.date && c.date.startsWith(monthKey))
            .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

        // Adjusted income = income − compensation
        const adjTotal = incTotal - compTotal;

        // Update dashboard cards
        const expEl  = document.getElementById('dash-exp-total');
        const incEl  = document.getElementById('dash-inc-total');
        const adjEl  = document.getElementById('dash-adj-label');

        if (expEl) expEl.textContent = `−${expTotal.toLocaleString('ru-RU')}`;

        if (incEl) {
            const sign = adjTotal >= 0 ? '+' : '−';
            incEl.textContent = `${sign}${Math.abs(adjTotal).toLocaleString('ru-RU')}`;
            incEl.className = adjTotal >= 0
                ? 'text-4xl font-semibold mt-2 text-zinc-200'
                : 'text-4xl font-semibold mt-2 text-red-400';
        }

        // Show small label clarifying it's adjusted if there are compensations
        if (adjEl) {
            adjEl.textContent = compTotal > 0 ? 'adjusted this month' : 'this month';
        }

        // Re-apply visibility mask if numbers are currently hidden
        if (localStorage.getItem('dash_numbers_hidden') === '1') {
            if (typeof _applyDashVisibility === 'function') _applyDashVisibility(true);
        }

        // Load upcoming events
        const evs     = await api('get_events') || [];
        const nowStr  = new Date().toISOString().slice(0, 16).replace('T', ' ');
        const upcoming = evs
            .filter(e => (e.dt || '') > nowStr && !e.completed)
            .sort((a, b) => (a.dt > b.dt ? 1 : -1))
            .slice(0, 5);

        // Render upcoming events list
        const upcomingEl = document.getElementById('upcoming-list');
        if (upcomingEl) {
            upcomingEl.innerHTML = upcoming.length
                ? upcoming.map(e => {
                    const dt      = new Date(e.dt.replace(' ', 'T'));
                    const timeStr = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                    const dateStr = dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                    return `
                        <div class="bg-zinc-900 rounded-3xl p-4 text-sm flex justify-between items-center">
                            <div class="flex-1 min-w-0">
                                <div class="font-medium">${e.desc}</div>
                                <div class="text-xs text-zinc-500 mt-0.5 flex flex-wrap gap-1 items-center">
                                    <span class="text-emerald-400 font-medium">🕐 ${timeStr}</span>
                                    ${e.hashtag ? `<span class="bg-zinc-800 px-2 py-0.5 rounded-xl">${e.hashtag}</span>` : ''}
                                    ${e.place   ? `<span>📍 ${e.place}</span>`                                           : ''}
                                    ${e.duration ? `<span>⏱ ${e.duration} min</span>`                                    : ''}
                                </div>
                            </div>
                            <div class="text-zinc-400 text-right shrink-0 ml-3 text-xs">
                                <div class="font-medium text-sm text-zinc-300">${dateStr}</div>
                            </div>
                        </div>`;
                }).join('')
                : `<div class="text-zinc-500 text-sm text-center py-4">No upcoming events</div>`;
        }

    } catch (err) {
        console.error('[dashboard.js] Failed to load dashboard:', err);
    }
}
