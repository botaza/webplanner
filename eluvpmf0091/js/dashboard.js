// js/dashboard.js
// DASHBOARD LOGIC
// Loads and displays dashboard totals for expenses, income, and upcoming events
// UPDATED: Income card now shows adjusted total (income − compensation)
// UPDATED: Expense card now shows total and adjusted (total − future) when future > 0

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

        // Monthly expense totals
        const monthExps   = (exps || []).filter(e => e.date && e.date.startsWith(monthKey));
        const expTotal    = monthExps.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        const expFuture   = monthExps
            .filter(e => e.category === 'future')
            .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        const expAdjusted = expTotal - expFuture;

        // Monthly income total
        const incTotal = (incs || [])
            .filter(i => i.date && i.date.startsWith(monthKey))
            .reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);

        // Monthly compensation total
        const compTotal = (comps || [])
            .filter(c => c.date && c.date.startsWith(monthKey))
            .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

        // Adjusted income = income − compensation
        const adjIncTotal = incTotal - compTotal;

        // ── Expense card ──
        const expEl    = document.getElementById('dash-exp-total');
        const expAdjEl = document.getElementById('dash-exp-adjusted');
        const expAdjLabelEl = document.getElementById('dash-exp-adj-label');

        function _dashFontClass(str) {
            const len = str.replace(/[^0-9]/g, '').length;
            if (len <= 5) return 'text-3xl';
            if (len <= 7) return 'text-2xl';
            return 'text-xl';
        }

        const expStr    = `−${expTotal.toLocaleString('ru-RU')}`;
        const expAdjStr = `−${expAdjusted.toLocaleString('ru-RU')}`;

        if (expEl) {
            expEl.textContent = expStr;
            expEl.className   = `${_dashFontClass(expStr)} font-semibold mt-2 leading-tight`;
        }

        if (expFuture > 0) {
            // Show adjusted row below the main number
            if (expAdjEl) {
                expAdjEl.textContent = expAdjStr;
                expAdjEl.className   = `text-sm font-medium text-zinc-400 mt-0.5 leading-tight`;
                expAdjEl.classList.remove('hidden');
            }
            if (expAdjLabelEl) {
                expAdjLabelEl.textContent = `adj excl. 🔮 ${expFuture.toLocaleString('ru-RU')}`;
                expAdjLabelEl.classList.remove('hidden');
            }
        } else {
            if (expAdjEl)      expAdjEl.classList.add('hidden');
            if (expAdjLabelEl) expAdjLabelEl.classList.add('hidden');
        }

        // ── Income card ──
        const incEl    = document.getElementById('dash-inc-total');
        const adjEl    = document.getElementById('dash-adj-label');

        const incStr  = (() => {
            const sign = adjIncTotal >= 0 ? '+' : '−';
            return `${sign}${Math.abs(adjIncTotal).toLocaleString('ru-RU')}`;
        })();

        if (incEl) {
            incEl.textContent = incStr;
            const incColor    = adjIncTotal >= 0 ? 'text-zinc-200' : 'text-red-400';
            incEl.className   = `${_dashFontClass(incStr)} font-semibold mt-2 leading-tight ${incColor}`;
        }

        if (adjEl) {
            adjEl.textContent = compTotal > 0 ? 'adjusted this month' : 'this month';
        }

        // Re-apply visibility mask if numbers are currently hidden
        if (localStorage.getItem('dash_numbers_hidden') === '1') {
            if (typeof _applyDashVisibility === 'function') _applyDashVisibility(true);
        }

        // ── Upcoming events ──
        const evs      = await api('get_events') || [];
        const nowStr   = new Date().toISOString().slice(0, 16).replace('T', ' ');
        const upcoming = evs
            .filter(e => (e.dt || '') > nowStr && !e.completed)
            .sort((a, b) => (a.dt > b.dt ? 1 : -1))
            .slice(0, 5);

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
                                    ${e.hashtag  ? `<span class="bg-zinc-800 px-2 py-0.5 rounded-xl">${e.hashtag}</span>` : ''}
                                    ${e.place    ? `<span>📍 ${e.place}</span>`                                            : ''}
                                    ${e.duration ? `<span>⏱ ${e.duration} min</span>`                                     : ''}
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
