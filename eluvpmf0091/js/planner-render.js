// js/planner-render.js
// PATCHED: Split action icons to left/right edges for better tap targets
// Left side: 🔄 (repeat), ✓/↺ (toggle complete)
// Right side: ✏️ (edit), 🗑 (delete)
// NEW: When expanding a month, all days inside it are automatically collapsed
// NEW: Added "Collapse all days" button at the top of the Planner screen

import { state } from './state.js';
import { isGuest } from './lockscreen.js';
import { nowAsDatetimeString, currentMonthKey } from './date-utils.js';
import { getOpenGroups, setGroupOpen } from './planner-filter.js';

function renderPlanner(list) {
    const container = document.getElementById('planner-list');
    container.innerHTML = '';
    if (!list.length) {
        container.innerHTML = '<div class="text-center text-zinc-500 py-8">No events</div>';
        return;
    }

    const nowStr = nowAsDatetimeString();
    const currentMonth = nowStr.slice(0, 7);
    const todayStr = nowStr.slice(0, 10);
    const openGroups = getOpenGroups();
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

            // NEW: When opening a month, collapse all days inside it
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

        // NEW: Collapse All button (shown only when month is expanded)
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

        // Show/hide Collapse All button when month expands/collapses
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

                const card = document.createElement('div');
                card.className = `bg-zinc-900 rounded-2xl px-3 py-2.5 card flex items-center ${completedClass}`;
                card.innerHTML = `
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="font-mono text-sm">${timeStr}</span>
                            ${ev.hashtag ? `<span class="text-xs bg-zinc-800 px-2 py-0.5 rounded-full">${ev.hashtag}</span>` : ''}
                            ${completedBadge}
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