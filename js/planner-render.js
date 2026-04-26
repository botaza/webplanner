// >> - js/planner-render.js
// js/planner-render.js
// PATCHED: Split action icons to left/right edges for better tap targets
// Left side: 🔄 (repeat), ✓/↺ (toggle complete)
// Right side: 📌 (pin/unpin), ✏️ (edit), 🗑 (delete)
// NEW: When expanding a month, all days inside it are automatically collapsed
// NEW: Added "Collapse all days" button at the top of the Planner screen
// NEW: Pin button per event — renders pinned section at top of planner

import { state } from './state.js';
import { isGuest } from './lockscreen.js';
import { nowAsDatetimeString, currentMonthKey } from './date-utils.js';
import { getOpenGroups, setGroupOpen } from './planner-filter.js';

// ── Pin helpers (localStorage-backed) ────────────────────────────────────────
const PINNED_KEY = 'planner_pinned_ids';

function getPinnedIds() {
    try { return new Set(JSON.parse(localStorage.getItem(PINNED_KEY) || '[]')); }
    catch { return new Set(); }
}

function setPinnedIds(set) {
    localStorage.setItem(PINNED_KEY, JSON.stringify([...set]));
}

function togglePin(id) {
    const ids = getPinnedIds();
    if (ids.has(String(id))) {
        ids.delete(String(id));
    } else {
        ids.add(String(id));
    }
    setPinnedIds(ids);
    // Re-render using the current filtered list stored on state
    renderPlanner(state._lastRenderedList || []);
}

window.togglePin = togglePin;

// ── Pinned section collapse ───────────────────────────────────────────────────
function togglePinnedCollapse() {
    const body = document.getElementById('planner-pinned-list');
    const btn  = document.getElementById('planner-pinned-toggle');
    if (!body || !btn) return;
    const hidden = body.classList.toggle('hidden');
    btn.textContent = hidden ? '▶ show' : '▼ hide';
    localStorage.setItem('planner_pinned_collapsed', hidden ? '1' : '0');
}
window.togglePinnedCollapse = togglePinnedCollapse;

// ── Render pinned section ─────────────────────────────────────────────────────
function renderPinnedSection(list) {
    const section  = document.getElementById('planner-pinned-section');
    const pinList  = document.getElementById('planner-pinned-list');
    const countEl  = document.getElementById('planner-pinned-count');
    if (!section || !pinList) return;

    const pinnedIds = getPinnedIds();
    // Only pin events that exist in the FULL eventsData (not filtered)
    const allEvents = state.eventsData || [];
    const pinned = allEvents.filter(e => pinnedIds.has(String(e.id)));

    if (!pinned.length) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    if (countEl) countEl.textContent = `(${pinned.length})`;

    // Restore collapsed state
    const isCollapsed = localStorage.getItem('planner_pinned_collapsed') === '1';
    const toggleBtn = document.getElementById('planner-pinned-toggle');
    if (isCollapsed) {
        pinList.classList.add('hidden');
        if (toggleBtn) toggleBtn.textContent = '▶ show';
    } else {
        pinList.classList.remove('hidden');
        if (toggleBtn) toggleBtn.textContent = '▼ hide';
    }

    // Sort pinned events by datetime
    pinned.sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));

    pinList.innerHTML = '';
    pinned.forEach(ev => {
        const dt = new Date((ev.dt || '').replace(' ', 'T'));
        const timeStr = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const dateStr = dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        const completedClass = ev.completed ? 'line-through opacity-50' : '';

        const card = document.createElement('div');
        card.className = 'pinned-event-card flex items-center gap-2';
        card.innerHTML = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-amber-400 text-xs font-mono">${dateStr} ${timeStr}</span>
                    ${ev.hashtag ? `<span class="text-[11px] bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-300">${ev.hashtag}</span>` : ''}
                    ${ev.completed ? '<span class="text-[11px] text-emerald-400">✓</span>' : ''}
                </div>
                <div class="text-sm mt-0.5 truncate ${completedClass}">${ev.desc || ''}</div>
                ${ev.place ? `<div class="text-xs text-zinc-500 mt-0.5">📍 ${ev.place}</div>` : ''}
            </div>
            ${!isGuest() ? `
            <button onclick="event.stopPropagation(); togglePin('${ev.id}')"
                class="shrink-0 w-8 h-8 flex items-center justify-center text-amber-400 hover:text-amber-200 text-base rounded-full hover:bg-amber-400/10 transition"
                title="Unpin">📌</button>
            ` : ''}
        `;
        pinList.appendChild(card);
    });
}

// ── Main renderPlanner ────────────────────────────────────────────────────────
function renderPlanner(list) {
    // Cache for re-renders triggered by pin toggle
    state._lastRenderedList = list;

    const container = document.getElementById('planner-list');
    container.innerHTML = '';

    // Always render pinned section from full data
    renderPinnedSection(list);

    if (!list.length) {
        container.innerHTML = '<div class="text-center text-zinc-500 py-8">No events</div>';
        return;
    }

    const nowStr = nowAsDatetimeString();
    const currentMonth = nowStr.slice(0, 7);
    const todayStr = nowStr.slice(0, 10);
    const openGroups = getOpenGroups();
    const pinnedIds = getPinnedIds();
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const months = {};
    list.forEach(ev => {
        const mKey = (ev.dt || '').slice(0, 7);
        const dKey = (ev.dt || '').slice(0, 10);
        if (!months[mKey]) months[mKey] = {};
        if (!months[mKey][dKey]) months[mKey][dKey] = [];
        months[mKey][dKey].push(ev);
    });

    Object.keys(months).sort().forEach(monthKey => {
        const days = months[monthKey];
        const isPastM = monthKey < currentMonth;
        const isCurrentM = monthKey === currentMonth;
        const totalEvents = Object.values(days).flat().length;

        const mOpenKey = 'm:' + monthKey;
        const mIsOpen = mOpenKey in openGroups ? openGroups[mOpenKey] : !isPastM;

        const [year, month] = monthKey.split('-');
        const mLabel = monthNames[parseInt(month) - 1] + ' ' + year;

        const mHeader = document.createElement('div');
        mHeader.className = 'flex items-center justify-between px-1 py-2 cursor-pointer select-none mt-1';
        mHeader.innerHTML = `<div class="font-semibold">${mLabel} <span class="text-zinc-500">(${totalEvents})</span>${isCurrentM ? '<span class="text-emerald-400 text-xs ml-1">now</span>' : ''}</div><div id="mchev-${monthKey}">${mIsOpen ? '▼' : '▶'}</div>`;

        mHeader.onclick = () => {
            const body = document.getElementById('mgroup-' + monthKey);
            const chev = document.getElementById('mchev-' + monthKey);
            const isNowOpen = body.style.display !== 'none';

            if (!isNowOpen) {
                Object.keys(days).forEach(dayKey => {
                    const dOpenKey = 'd:' + dayKey;
                    setGroupOpen(dOpenKey, false);
                    const dayBody = document.getElementById('dgroup-' + dayKey);
                    if (dayBody) dayBody.style.display = 'none';
                });
            }

            body.style.display = isNowOpen ? 'none' : 'block';
            chev.textContent = isNowOpen ? '▶' : '▼';
            setGroupOpen(mOpenKey, !isNowOpen);
        };

        container.appendChild(mHeader);

        const mDivider = document.createElement('div');
        mDivider.className = 'border-t border-zinc-800';
        container.appendChild(mDivider);

        const mBody = document.createElement('div');
        mBody.id = 'mgroup-' + monthKey;
        mBody.className = 'mb-3';
        mBody.style.display = mIsOpen ? 'block' : 'none';

        // Collapse All button
        const collapseAllBtn = document.createElement('div');
        collapseAllBtn.className = 'text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer py-1 px-2 flex items-center gap-1 mb-2 hidden';
        collapseAllBtn.id = `collapse-all-${monthKey}`;
        collapseAllBtn.innerHTML = '↘️ Collapse all days';
        collapseAllBtn.onclick = (e) => {
            e.stopPropagation();
            Object.keys(days).forEach(dayKey => {
                const dOpenKey = 'd:' + dayKey;
                setGroupOpen(dOpenKey, false);
                const dayBody = document.getElementById('dgroup-' + dayKey);
                if (dayBody) dayBody.style.display = 'none';
            });
        };
        mBody.appendChild(collapseAllBtn);

        const observer = new MutationObserver(() => {
            const isVisible = mBody.style.display !== 'none';
            collapseAllBtn.classList.toggle('hidden', !isVisible);
        });
        observer.observe(mBody, { attributes: true, attributeFilter: ['style'] });

        Object.keys(days).sort().forEach(dayKey => {
            const dayEvents = days[dayKey];
            const isPastD = dayKey < todayStr;
            const isToday = dayKey === todayStr;
            const dOpenKey = 'd:' + dayKey;
            const dIsOpen = dOpenKey in openGroups ? openGroups[dOpenKey] : !isPastD;

            const dayDate = new Date(dayKey + 'T00:00:00');
            const weekday = dayDate.toLocaleDateString('ru-RU', {weekday: 'short'});
            const dayNum = dayDate.getDate();
            const dLabel = weekday + ' ' + dayNum;

            const dHeader = document.createElement('div');
            dHeader.className = 'flex items-center justify-between px-2 py-1.5 cursor-pointer select-none';
            dHeader.innerHTML = `<div class="font-medium">${dLabel} <span class="text-zinc-500 text-sm">${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}</span>${isToday ? '<span class="text-emerald-400 text-xs ml-1">today</span>' : ''}</div><div id="dchev-${dayKey}">${dIsOpen ? '▾' : '▸'}</div>`;

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

            const dBody = document.createElement('div');
            dBody.id = 'dgroup-' + dayKey;
            dBody.className = 'space-y-1.5 pl-2 pb-1';
            dBody.style.display = dIsOpen ? 'block' : 'none';

            dayEvents.forEach(ev => {
                const dt = new Date(ev.dt.replace(' ', 'T'));
                const timeStr = dt.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
                
                const completedClass = ev.completed ? 'line-through opacity-50' : '';
                const completedBadge = ev.completed ? '<span class="text-xs text-emerald-400 ml-2">✓ done</span>' : '';
                const isPinned = pinnedIds.has(String(ev.id));

                const card = document.createElement('div');
                card.className = `bg-zinc-900 rounded-2xl px-3 py-2.5 card flex items-center ${completedClass}`;
                card.innerHTML = `
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="font-mono text-sm">${timeStr}</span>
                            ${ev.hashtag ? `<span class="text-xs bg-zinc-800 px-2 py-0.5 rounded-full">${ev.hashtag}</span>` : ''}
                            ${completedBadge}
                            ${isPinned ? '<span class="text-amber-400 text-xs">📌</span>' : ''}
                        </div>
                        <div class="mt-1 text-sm">${ev.desc}</div>
                        <div class="mt-1 text-xs text-zinc-400">
                            ${ev.place ? `📍 ${ev.place}` : ''}
                            ${ev.duration ? `⏱ ${ev.duration} min` : ''}
                        </div>
                    </div>
                    
                    ${!isGuest() ? `
                    <div class="flex gap-1 items-center mr-2">
                        <button class="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-emerald-400 text-lg" 
                                onclick="event.stopPropagation(); showRepeatEventModal('${ev.id}')" 
                                title="Create recurring series">🔄</button>
                        <button class="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-emerald-400 text-lg" 
                                onclick="event.stopPropagation(); ${ev.completed ? 'markIncomplete' : 'markComplete'}('${ev.id}')" 
                                title="${ev.completed ? 'Mark not done' : 'Mark done'}">
                            ${ev.completed ? '↺' : '✓'}
                        </button>
                    </div>
                    <div class="flex gap-1 items-center">
                        <button class="w-8 h-8 flex items-center justify-center text-base rounded-full transition ${isPinned ? 'text-amber-400 hover:text-amber-200' : 'text-zinc-500 hover:text-amber-400'}"
                                onclick="event.stopPropagation(); togglePin('${ev.id}')"
                                title="${isPinned ? 'Unpin' : 'Pin event'}">📌</button>
                        <button class="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white text-lg" 
                                onclick="event.stopPropagation(); editEvent('${ev.id}')" 
                                title="Edit">✏️</button>
                        <button class="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-red-400 text-lg" 
                                onclick="event.stopPropagation(); deleteEvent('${ev.id}')" 
                                title="Delete">🗑</button>
                    </div>
                    ` : ''}
                `;
                dBody.appendChild(card);
            });
            mBody.appendChild(dBody);
        });

        container.appendChild(mBody);
    });
}

export { renderPlanner };
// << - js/planner-render.js
