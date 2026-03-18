// js/planner-render.js

import { state } from './state.js';
import { nowAsDatetimeString, currentMonthKey } from './date-utils.js';
import { getOpenGroups, setGroupOpen } from './planner-filter.js';

function renderPlanner(list) {
 const container = document.getElementById('planner-list');
 container.innerHTML = '';
 if (!list.length) {
 container.innerHTML = '<p class="text-center text-zinc-500 py-8">No events</p>';
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
  <span class="font-medium text-zinc-200">${mLabel}<span class="text-zinc-500">(${totalEvents})</span></span>
  <span class="text-sm text-zinc-400">${isCurrentM ? 'now' : ''}</span>
  <span id="mchev-${monthKey}" class="text-zinc-400">${mIsOpen ? '▼' : '▶'}</span>
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
  <span class="font-medium text-zinc-200">${dLabel}<span class="text-zinc-500"> ${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}</span></span>
  <span class="text-sm text-zinc-400">${isToday ? 'today' : ''}</span>
  <span id="dchev-${dayKey}" class="text-zinc-400">${dIsOpen ? '▾' : '▸'}</span>
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
 const card = document.createElement('div');
 card.className = `bg-zinc-900 rounded-2xl px-3 py-2.5 card flex gap-3 items-start ${isPastEv ? 'opacity-40' : ''}`;
 
 card.innerHTML = `
  <span class="text-zinc-400 text-sm whitespace-nowrap pt-0.5">${timeStr}</span>
  ${ev.hashtag ? `<span class="hashtag-chip text-xs px-2 py-0.5">${ev.hashtag}</span>` : ''}
  <div class="flex-1 min-w-0">
   <div class="text-zinc-200 break-words">${ev.desc || '(no description)'}</div>
   <div class="flex flex-wrap gap-2 mt-1 text-xs text-zinc-500">
    ${ev.place ? `<span>📍 ${ev.place}</span>` : ''}
    ${ev.duration ? `<span>⏱ ${ev.duration} min</span>` : ''}
   </div>
  </div>
  <span class="edit-btn" title="Edit event">✏️</span>
  <span class="delete-btn" title="Delete event">🗑</span>
 `;
 
 card.onclick = (e) => {
  if (e.target.classList.contains('edit-btn') || e.target.classList.contains('delete-btn')) {
   return;
  }
  markComplete(ev.id);
 };
 
 card.querySelector('.edit-btn').onclick = (e) => {
  e.stopPropagation();
  editEvent(ev.id);
 };
 card.querySelector('.delete-btn').onclick = (e) => {
  e.stopPropagation();
  deleteEvent(ev.id);
 };
 
 dBody.appendChild(card);
 });
 mBody.appendChild(dBody);
 });
 container.appendChild(mBody);
 });
}

export { renderPlanner };