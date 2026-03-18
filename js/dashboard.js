// js/dashboard.js
// DASHBOARD LOGIC
// Loads and displays dashboard totals for expenses, income, and upcoming events

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
        // Load expenses and calculate monthly total
        const exps = await api('get_expenses') || [];
        const expTotal = exps
            .filter(e => e.date && e.date.startsWith(monthKey))
            .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

        // Load income and calculate monthly total
        const incs = await api('get_income') || [];
        const incTotal = incs
            .filter(i => i.date && i.date.startsWith(monthKey))
            .reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);

        // Update dashboard totals
        const expEl = document.getElementById('dash-exp-total');
        const incEl = document.getElementById('dash-inc-total');
        
        if (expEl) expEl.textContent = `−${expTotal.toLocaleString('ru-RU')}`;
        if (incEl) incEl.textContent = `+${incTotal.toLocaleString('ru-RU')}`;

        // Load upcoming events
        const evs = await api('get_events') || [];
        const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
        const upcoming = evs
            .filter(e => (e.dt || '') > nowStr && !e.completed)
            .sort((a, b) => (a.dt > b.dt ? 1 : -1))
            .slice(0, 5);

        // Render upcoming events list
        const upcomingEl = document.getElementById('upcoming-list');
        if (upcomingEl) {
            upcomingEl.innerHTML = upcoming.length
                ? upcoming.map(e => {
                    const dt = new Date(e.dt.replace(' ', 'T'));
                    const timeStr = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                    const dateStr = dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                    return `
                        <div class="bg-zinc-900 rounded-3xl p-4 text-sm flex justify-between items-center">
                            <div class="flex-1 min-w-0">
                                <div class="font-medium">${e.desc}</div>
                                <div class="text-xs text-zinc-500 mt-0.5 flex flex-wrap gap-1 items-center">
                                    <span class="text-emerald-400 font-medium">🕐 ${timeStr}</span>
                                    ${e.hashtag ? `<span class="bg-zinc-800 px-2 py-0.5 rounded-xl">${e.hashtag}</span>` : ''}
                                    ${e.place ? `<span>📍 ${e.place}</span>` : ''}
                                    ${e.duration ? `<span>⏱ ${e.duration} min</span>` : ''}
                                </div>
                            </div>
                            <div class="text-zinc-400 text-right shrink-0 ml-3 text-xs">
                                <div class="font-medium text-sm text-zinc-300">${dateStr}</div>
                            </div>
                        </div>
                    `;
                }).join('')
                : `<div class="text-zinc-500 text-sm text-center py-4">No upcoming events</div>`;
        }
    } catch (err) {
        console.error('[dashboard.js] Failed to load dashboard:', err);
    }
}