// js/planner-render.js

import { state } from './state.js';
import { nowAsDatetimeString } from './date-utils.js';
import { getOpenGroups, setGroupOpen } from './planner-filter.js';

function renderPlanner(list) {
    const container = document.getElementById('planner-list');
    container.innerHTML = '';
    if (!list.length) {
        container.innerHTML = '<div class="text-zinc-500 text-sm text-center py-8">No events</div>';
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
        mHeader.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-sm font-bold ${isPastM ? 'text-zinc-500' : isCurrentM ? 'text-emerald-400' : 'text-zinc-100'}">${mLabel}</span>
                <span class="text-xs ${isPastM ? 'text-zinc-600' : 'text-zinc-500'}">(${totalEvents})</span>
                ${isCurrentM ? '<span class="text-xs text-emerald-700 font-medium">now</span>' : ''}
            </div>
            <span class="text-zinc-500 text-xs" id="mchev-${monthKey}">${mIsOpen ? '▼' : '▶'}</span>
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

        const mDivider = document.createElement('div');
        mDivider.className = 'border-t border-zinc-800';
        container.appendChild(mDivider);

        const mBody = document.createElement('div');
        mBody.id = 'mgroup-' + monthKey;
        mBody.className = 'mb-3';
        mBody.style.display = mIsOpen ? 'block' : 'none';

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
            dHeader.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold w-16 ${isPastD ? 'text-zinc-600' : isToday ? 'text-emerald-400' : 'text-zinc-300'}">${dLabel}</span>
                    <span class="text-xs text-zinc-600">${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}</span>
                    ${isToday ? '<span class="text-xs text-emerald-700 font-medium">today</span>' : ''}
                </div>
                <span class="text-zinc-600 text-xs" id="dchev-${dayKey}">${dIsOpen ? '▾' : '▸'}</span>
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

            const dBody = document.createElement('div');
            dBody.id = 'dgroup-' + dayKey;
            dBody.className = 'space-y-1.5 pl-2 pb-1';
            dBody.style.display = dIsOpen ? 'block' : 'none';

            dayEvents.forEach(ev => {
                const dt = new Date(ev.dt.replace(' ', 'T'));
                const timeStr = dt.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
                const isPastEv = (ev.dt || '') < nowStr;
                const isCompleted = ev.completed; // new flag
                const card = document.createElement('div');
                card.className = `bg-zinc-900 rounded-2xl px-3 py-2.5 card flex gap-3 ${isPastEv || isCompleted ? 'opacity-40' : ''}`;
                card.innerHTML = `
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-semibold ${isPastEv || isCompleted ? 'text-zinc-500' : 'text-emerald-400'}">${timeStr}</span>
                            ${ev.hashtag ? `<span class="text-xs bg-zinc-800 px-2 py-0.5 rounded-xl">${ev.hashtag}</span>` : ''}
                        </div>
                        <div class="font-medium text-sm mt-0.5 ${isPastEv || isCompleted ? 'text-zinc-500' : 'text-zinc-100'}">${ev.desc}</div>
                        <div class="flex gap-3 text-xs mt-0.5 text-zinc-500 flex-wrap">
                            ${ev.place ? `<span>📍 ${ev.place}</span>` : ''}
                            ${ev.duration ? `<span>⏱ ${ev.duration} min</span>` : ''}
                        </div>
                    </div>
                    <div class="flex flex-col items-end justify-between shrink-0 gap-2">
                        <div onclick="editEvent('${ev.id}'); event.stopPropagation()"
                             class="text-emerald-400 text-sm cursor-pointer">✏️</div>
                        <div onclick="deleteEvent('${ev.id}'); event.stopPropagation()"
                             class="text-red-400 text-sm cursor-pointer">🗑</div>
                    </div>
                `;
                card.onclick = () => markComplete(ev.id);
                dBody.appendChild(card);
            });
            mBody.appendChild(dBody);
        });
        container.appendChild(mBody);
    });
}

export { renderPlanner };