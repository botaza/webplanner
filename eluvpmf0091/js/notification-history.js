// js/notification-history.js

import { state } from './state.js';
import { api } from './api.js';

let notifPage = 1;

async function loadNotifications(page = 1) {
    notifPage = page;
    const data = await api('get_notifications', { page });
    const items = data.items || [];
    const container = document.getElementById('notifications-list');
    const pagination = document.getElementById('notifications-pagination');

    if (!container) return;

    if (!items.length) {
        container.innerHTML = '<div class="text-zinc-500 text-sm text-center py-8">No notifications sent yet</div>';
        if (pagination) pagination.innerHTML = '';
        return;
    }

    const ruleLabels = {
        'rule1_1hour': '⏰ 1h before',
        'rule2_event_hashtag': '📅 #event daily',
        'rule3_control_hashtag': '🎛 #control daily',
        'rule4_pers_hashtag': '👤 #pers daily',
        'rule5_tomorrow': '📋 Tomorrow',
        'rule6_horizon_3d': '📆 3-day horizon',
        'rule6_horizon_7d': '📆 7-day horizon',
        'rule6_horizon_14d': '📆 14-day horizon',
    };

    container.innerHTML = items.map(n => {
        const statusColor = n.status === 'sent' ? 'text-emerald-400' : 'text-yellow-400';
        const statusIcon = n.status === 'sent' ? '✅' : '⚠️';
        const ruleLabel = ruleLabels[n.rule] || n.rule || '';
        const bodyLines = (n.body || '').split('\n');
        const bodyHtml = bodyLines.map(l => `<div>${l}</div>`).join('');

        return `
            <div class="bg-zinc-900 rounded-2xl px-4 py-3">
                <div class="flex justify-between items-start gap-2">
                    <div class="flex-1 min-w-0">
                        <div class="text-xs text-emerald-500 font-medium mb-1">${ruleLabel}</div>
                        <div class="text-sm font-medium">${n.title || ''}</div>
                        <div class="text-xs text-zinc-400 mt-0.5">${bodyHtml}</div>
                        <div class="text-xs text-zinc-600 mt-1">${n.dt} · ${n.tokens_count} device${n.tokens_count !== 1 ? 's' : ''}</div>
                    </div>
                    <span class="text-sm shrink-0 ml-2">${statusIcon}</span>
                </div>
            </div>
        `;
    }).join('');

    if (pagination) {
        const pages = data.pages || 1;
        if (pages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        let btns = '';
        if (page > 1) btns += `<button onclick="loadNotifications(${page-1})" class="px-4 py-2 bg-zinc-800 rounded-2xl text-sm">← Prev</button>`;
        btns += `<span class="text-xs text-zinc-500 self-center">${page} / ${pages}</span>`;
        if (page < pages) btns += `<button onclick="loadNotifications(${page+1})" class="px-4 py-2 bg-zinc-800 rounded-2xl text-sm">Next →</button>`;
        pagination.innerHTML = btns;
    }
}

async function clearNotifications() {
    if (!confirm('Clear all notification history?')) return;
    await api('clear_notifications');
    loadNotifications(1);
}

Object.assign(window, {
    loadNotifications,
    clearNotifications
});

export { loadNotifications };
