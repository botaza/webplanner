// js/dashboard.js

import { state } from './state.js';
import { api } from './api.js';
import { currentMonthKey } from './date-utils.js';

async function loadDashboard() {
    const monthKey = currentMonthKey();

    const exps = await api('get_expenses') || [];
    const incs = await api('get_income') || [];

    const expTotal = exps
        .filter(e => e.date.startsWith(monthKey))
        .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    const incTotal = incs
        .filter(i => i.date.startsWith(monthKey))
        .reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);

    document.getElementById('dash-exp-total').textContent = `−${expTotal.toLocaleString('ru-RU')}`;
    document.getElementById('dash-inc-total').textContent = `+${incTotal.toLocaleString('ru-RU')}`;

    const evs = await api('get_events') || [];
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const upcoming = evs
        .filter(e => (e.dt || '') > nowStr)
        .sort((a, b) => (a.dt > b.dt ? 1 : -1))
        .slice(0, 5);

    document.getElementById('upcoming-list').innerHTML = upcoming.length
        ? upcoming.map(e => {
            const dt = new Date(e.dt.replace(' ', 'T'));
            const timeStr = dt.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
            const dateStr = dt.toLocaleDateString('ru-RU', {day: 'numeric', month: 'short'});
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

export { loadDashboard };
