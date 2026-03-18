// js/planner-render.js - WebPlanner Event List Rendering
// PATCHED: Completed events stay visible with badges, toggle buttons for completion status

import { state } from './state.js';
import { nowAsDatetimeString, isPast, isToday, parseDatetimeString, formatDisplayTime } from './date-utils.js';
import { getOpenGroups, setGroupOpen } from './planner-filter.js';

/**
 * Render the planner event list grouped by month → day
 * @param {Array<Object>} list - Array of event objects (includes completed events)
 */
export function renderPlanner(list) {
    const container = document.getElementById('planner-list');
    if (!container) {
        console.error('Planner list container not found');
        return;
    }
    
    container.innerHTML = '';
    
    if (!list || !list.length) {
        container.innerHTML = `
            <div class="text-center text-zinc-500 py-8">
                <div class="text-4xl mb-2">📅</div>
                <p>No events yet</p>
                <p class="text-sm mt-1">Tap + to add your first event</p>
            </div>
        `;
        return;
    }
    
    const nowStr = nowAsDatetimeString();
    const currentMonth = nowStr.slice(0, 7);
    const todayStr = nowStr.slice(0, 10);
    const openGroups = getOpenGroups();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Group events by month → day
    const months = {};
    list.forEach(ev => {
        // ✅ Use dt even for completed events - they stay in the list
        const mKey = (ev.dt || '').slice(0, 7);
        const dKey = (ev.dt || '').slice(0, 10);
        if (!months[mKey]) months[mKey] = {};
        if (!months[mKey][dKey]) months[mKey][dKey] = [];
        months[mKey][dKey].push(ev);
    });

    // Sort months and render
    Object.keys(months).sort().forEach(monthKey => {
        const days = months[monthKey];
        const isPastM = monthKey < currentMonth;
        const isCurrentM = monthKey === currentMonth;
        const totalEvents = Object.values(days).flat().length;

        const mOpenKey = 'm:' + monthKey;
        const mIsOpen = mOpenKey in openGroups ? openGroups[mOpenKey] : !isPastM;

        const [year, month] = monthKey.split('-');
        const mLabel = monthNames[parseInt(month) - 1] + ' ' + year;

        // Month header
        const mHeader = document.createElement('div');
        mHeader.className = 'flex items-center justify-between px-1 py-2 cursor-pointer select-none mt-1';
        mHeader.innerHTML = `
            <span class="font-medium text-zinc-300">${mLabel}</span>
            <span class="text-xs text-zinc-500">(${totalEvents}) ${isCurrentM ? '• now' : ''}</span>
            <span id="mchev-${monthKey}" class="text-zinc-500">${mIsOpen ? '▼' : '▶'}</span>
        `;
        mHeader.onclick = () => {
            const body = document.getElementById('mgroup-' + monthKey);
            const chev = document.getElementById('mchev-' + monthKey);
            const isNowOpen = body.style.display !== 'none';
            body.style.display = isNowOpen ? 'none' : 'block';
            chev.textContent = isNowOpen ? '▶' : '▼';
            setGroupOpen(mOpenKey, !isNowOpen);
        };
        container.appendChild(mHeader);

        // Month divider
        const mDivider = document.createElement('div');
        mDivider.className = 'border-t border-zinc-800';
        container.appendChild(mDivider);

        // Month body
        const mBody = document.createElement('div');
        mBody.id = 'mgroup-' + monthKey;
        mBody.className = 'mb-3';
        mBody.style.display = mIsOpen ? 'block' : 'none';

        // Render days within month
        Object.keys(days).sort().forEach(dayKey => {
            const dayEvents = days[dayKey];
            const isPastD = dayKey < todayStr;
            const isToday = dayKey === todayStr;
            const dOpenKey = 'd:' + dayKey;
            const dIsOpen = dOpenKey in openGroups ? openGroups[dOpenKey] : !isPastD;
            const dayDate = new Date(dayKey + 'T00:00:00');
            const weekday = dayDate.toLocaleDateString('ru-RU', { weekday: 'short' });
            const dayNum = dayDate.getDate();
            const dLabel = `${weekday} ${dayNum}`;

            // Day header
            const dHeader = document.createElement('div');
            dHeader.className = 'flex items-center justify-between px-2 py-1.5 cursor-pointer select-none';
            dHeader.innerHTML = `
                <span class="text-sm font-medium text-zinc-300">${dLabel}</span>
                <span class="text-xs text-zinc-500">${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}${isToday ? ' • today' : ''}</span>
                <span id="dchev-${dayKey}" class="text-zinc-500">${dIsOpen ? '▾' : '▸'}</span>
            `;
            dHeader.onclick = (e) => {
                e.stopPropagation();
                const body = document.getElementById('dgroup-' + dayKey);
                const chev = document.getElementById('dchev-' + dayKey);
                const isNowOpen = body.style.display !== 'none';
                body.style.display = isNowOpen ? 'none' : 'block';
                chev.textContent = isNowOpen ? '▸' : '▾';
                setGroupOpen(dOpenKey, !isNowOpen);
            };
            mBody.appendChild(dHeader);

            // Day body
            const dBody = document.createElement('div');
            dBody.id = 'dgroup-' + dayKey;
            dBody.className = 'space-y-1.5 pl-2 pb-1';
            dBody.style.display = dIsOpen ? 'block' : 'none';

            // Render individual events
            dayEvents.forEach(ev => {
                const dt = new Date(ev.dt.replace(' ', 'T'));
                const timeStr = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                
                // ✅ PATCH: Check completion status
                const isCompleted = ev.completed === true;
                const isPastEv = (ev.dt || '') < nowStr;
                
                // ✅ PATCH: Opacity only for past+incomplete; completed events stay fully visible
                const opacityClass = isCompleted ? '' : (isPastEv ? 'opacity-40' : '');
                
                // ✅ PATCH: Completed badge
                const completedBadge = isCompleted 
                    ? '<span class="text-xs bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-700/30">✓ done</span>' 
                    : '';
                
                // ✅ PATCH: Card border color based on completion
                const borderClass = isCompleted ? 'border-emerald-700/30' : 'border-transparent';
                
                // ✅ PATCH: Description styling (line-through for completed)
                const descClass = isCompleted ? 'line-through text-zinc-500' : 'text-zinc-200';
                
                // ✅ PATCH: Toggle button text and action
                const toggleBtnText = isCompleted ? '↺ undo' : '✓ done';
                const toggleBtnClass = isCompleted 
                    ? 'border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200' 
                    : 'border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/20 hover:text-emerald-300';
                const toggleBtnAction = isCompleted ? `markIncomplete('${ev.id}')` : `markComplete('${ev.id}')`;
                const toggleBtnTitle = isCompleted ? 'Mark as not done' : 'Mark as done';

                // Event card
                const card = document.createElement('div');
                card.className = `bg-zinc-900 rounded-2xl px-3 py-2.5 card flex gap-3 ${opacityClass} border ${borderClass} transition-all`;
                
                card.innerHTML = `
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-sm font-mono text-zinc-400">${timeStr}</span>
                            ${completedBadge}
                            ${ev.hashtag ? `<span class="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700">${ev.hashtag}</span>` : ''}
                        </div>
                        <div class="mt-1 text-sm ${descClass}">${ev.desc || '(no description)'}</div>
                        ${ev.place ? `<div class="text-xs text-zinc-500 mt-0.5 flex items-center gap-1"><span>📍</span>${ev.place}</div>` : ''}
                        ${ev.duration ? `<div class="text-xs text-zinc-500 flex items-center gap-1"><span>⏱</span>${ev.duration} min</div>` : ''}
                    </div>
                    <div class="flex flex-col gap-1 items-end shrink-0">
                        <!-- Edit button -->
                        <button class="text-xs text-zinc-400 hover:text-blue-400 transition-colors p-1" 
                                onclick="editEvent('${ev.id}')" 
                                title="Edit event"
                                aria-label="Edit">
                            ✏️
                        </button>
                        <!-- Delete button -->
                        <button class="text-xs text-zinc-400 hover:text-red-400 transition-colors p-1" 
                                onclick="deleteEvent('${ev.id}')" 
                                title="Delete event"
                                aria-label="Delete">
                            🗑
                        </button>
                        <!-- ✅ PATCH: Toggle completion button -->
                        <button class="text-xs mt-1 px-2 py-0.5 rounded border ${toggleBtnClass} transition-colors"
                                onclick="${toggleBtnAction}"
                                title="${toggleBtnTitle}">
                            ${toggleBtnText}
                        </button>
                    </div>
                `;
                dBody.appendChild(card);
            });
            mBody.appendChild(dBody);
        });
        container.appendChild(mBody);
    });
}

/**
 * Render empty state for planner
 */
export function renderPlannerEmpty() {
    const container = document.getElementById('planner-list');
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center text-zinc-500 py-12">
            <div class="text-5xl mb-4">📅</div>
            <h3 class="text-lg font-medium text-zinc-300 mb-2">No events yet</h3>
            <p class="text-sm mb-4">Start planning by adding your first event</p>
            <button onclick="showAddEventModal()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl font-medium transition-colors">
                + Add Event
            </button>
        </div>
    `;
}

/**
 * Re-render planner with current state and filters
 */
export function refreshPlanner() {
    const { applyPlannerFilter } = await import('./planner-filter.js');
    applyPlannerFilter();
}

// Export functions
export default {
    renderPlanner,
    renderPlannerEmpty,
    refreshPlanner
};