// js/planner-crud.js
// PATCHED: Added support for toggling completion status and date updates
// PATCHED: Added Recurrence Conversion functionality
import { state } from './state.js';
import { api } from './api.js';
import { hideModal } from './utils.js';
import { renderPlanner } from './planner-render.js';
import { loadDashboard } from './dashboard.js';
import { nowDatetimeLocal } from './date-utils.js';
import { renderHashtagSuggestions, renderPlaceSuggestions, renderDurationSuggestions } from './suggestions.js';
import { renderPlannerHashtagFilter, applyPlannerFilter } from './planner-filter.js';

const RECURRENCE_DEFAULTS = { weekly: 10, biweekly: 6, monthly: 6, yearly: 3 };
let currentRecurEventId = null;

function onRecurrenceChange() {
const rec = document.getElementById('event-recurrence').value;
const section = document.getElementById('recurrence-occurrences-section');
if (rec === 'none') {
section.classList.add('hidden');
document.getElementById('occurrence-preview').innerHTML = '';
} else {
section.classList.remove('hidden');
document.getElementById('event-occurrences').value = RECURRENCE_DEFAULTS[rec] || 6;
updateOccurrencePreview();
}
}

function getRecurrenceDates(startDt, recurrence, count) {
const dates = [];
const base = new Date(startDt.replace(' ', 'T'));
for (let i = 0; i < count; i++) {
const d = new Date(base);
if (recurrence === 'weekly') d.setDate(base.getDate() + i * 7);
if (recurrence === 'biweekly') d.setDate(base.getDate() + i * 14);
if (recurrence === 'monthly') d.setMonth(base.getMonth() + i);
if (recurrence === 'yearly') d.setFullYear(base.getFullYear() + i);
const pad = n => String(n).padStart(2, '0');
const formatted = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
+ ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':00';
dates.push(formatted);
}
return dates;
}

function updateOccurrencePreview() {
const rec = document.getElementById('event-recurrence').value;
const count = parseInt(document.getElementById('event-occurrences').value) || 0;
const dt = document.getElementById('event-dt').value;
const preview = document.getElementById('occurrence-preview');
if (!preview) return;
if (!dt || rec === 'none' || count < 1) { preview.innerHTML = ''; return; }
const dates = getRecurrenceDates(dt.replace('T', ' ') + ':00', rec, count);
preview.innerHTML = dates.map((d, i) => {
const dateObj = new Date(d.replace(' ', 'T'));
const label = dateObj.toLocaleDateString('ru-RU', {weekday:'short', day:'numeric', month:'short', year:'numeric'});
return `<div class="text-xs text-zinc-400">${i+1}.${label}</div>`;
}).join('');
}

function resetEventModalToCreateMode() {
const saveBtn = document.querySelector('#modal-event .flex.gap-3 button:last-child');
if (saveBtn) {
saveBtn.onclick = saveEvent;
saveBtn.textContent = "Save Event";
}
document.getElementById('event-dt').value = nowDatetimeLocal();
document.getElementById('event-desc').value = '';
document.getElementById('event-hashtag').value = '';
document.getElementById('event-place').value = '';
document.getElementById('event-duration').value = '';
document.getElementById('event-recurrence').value = 'none';
document.getElementById('recurrence-occurrences-section').classList.add('hidden');
document.getElementById('occurrence-preview').innerHTML = '';
document.querySelectorAll('#hashtag-suggestions .hashtag-chip').forEach(c => c.classList.remove('active'));
document.querySelectorAll('#place-suggestions .hashtag-chip').forEach(c => c.classList.remove('active'));
document.querySelectorAll('#duration-suggestions .hashtag-chip').forEach(c => c.classList.remove('active'));
const modalTitle = document.querySelector('#modal-event .text-xl.font-semibold');
if (modalTitle) modalTitle.textContent = 'New Event';
}

function showAddEventModal() {
resetEventModalToCreateMode();
document.getElementById('modal-event').classList.remove('hidden');
document.getElementById('modal-event').classList.add('flex');
renderHashtagSuggestions();
renderPlaceSuggestions();
renderDurationSuggestions();
}

async function saveEvent() {
const dt = document.getElementById('event-dt').value;
if (!dt) { alert("Please select date and time"); return; }
const recurrence = document.getElementById('event-recurrence').value;
const base = {
desc: document.getElementById('event-desc').value.trim() || '(no description)',
hashtag: document.getElementById('event-hashtag').value.trim(),
place: document.getElementById('event-place').value.trim(),
duration: document.getElementById('event-duration').value.trim(),
recurrence
};
let datetimes = [dt.replace('T', ' ') + ':00'];
if (recurrence !== 'none') {
const count = parseInt(document.getElementById('event-occurrences').value) || 1;
datetimes = getRecurrenceDates(dt.replace('T', ' ') + ':00', recurrence, count);
}
const groupId = recurrence !== 'none' ? ('grp_' + Date.now()) : '';
try {
for (const dtStr of datetimes) {
const payload = { ...base, dt: dtStr, recurrence_group: groupId };
const res = await api('add_event', payload);
if (!res.success) {
alert("Save failed at " + dtStr + ": " + (res.error || "unknown"));
return;
}
}
hideModal('modal-event');
loadPlanner();
loadDashboard();
} catch (err) {
console.error(err);
alert("Error saving event: " + err.message);
}
}

async function editEvent(id) {
const ev = state.eventsData.find(e => e.id == id);
if (!ev) return;
document.getElementById('event-dt').value = ev.dt.replace(' ', 'T');
document.getElementById('event-desc').value = ev.desc || '';
document.getElementById('event-hashtag').value = ev.hashtag || '';
document.getElementById('event-place').value = ev.place || '';
document.getElementById('event-duration').value = ev.duration || '';
document.getElementById('event-recurrence').value = ev.recurrence || 'none';
const saveBtn = document.querySelector('#modal-event .flex.gap-3 button:last-child');
if (saveBtn) {
saveBtn.onclick = () => updateEvent(id);
saveBtn.textContent = "Update Event";
}
const modalTitle = document.querySelector('#modal-event .text-xl.font-semibold');
if (modalTitle) modalTitle.textContent = 'Edit Event';
document.getElementById('modal-event').classList.remove('hidden');
document.getElementById('modal-event').classList.add('flex');
renderHashtagSuggestions();
renderPlaceSuggestions();
renderDurationSuggestions();
if (ev.hashtag) selectHashtag(ev.hashtag);
if (ev.place) selectPlace(ev.place);
if (ev.duration) selectDuration(ev.duration);
document.getElementById('recurrence-occurrences-section').classList.add('hidden');
document.getElementById('occurrence-preview').innerHTML = '';
}

async function updateEvent(id) {
const dt = document.getElementById('event-dt').value;
if (!dt) return alert("Date & time required");
const payload = {
id,
dt: dt.replace('T', ' '),
desc: document.getElementById('event-desc').value.trim(),
hashtag: document.getElementById('event-hashtag').value.trim(),
place: document.getElementById('event-place').value.trim(),
duration: document.getElementById('event-duration').value.trim(),
recurrence: document.getElementById('event-recurrence').value
};
try {
const res = await api('update_event', payload);
if (res.success) {
hideModal('modal-event');
loadPlanner();
loadDashboard();
} else {
alert("Update failed");
}
} catch (err) {
console.error(err);
alert("Error updating event");
}
}

async function deleteEvent(id) {
if (!confirm('Delete this event?')) return;
await api('delete_event', {id});
loadPlanner();
loadDashboard();
}

// PATCH: markComplete now toggles the completed flag
async function markComplete(id, completed = true) {
// PATCH: No confirmation for quick toggle, but you can add if needed
// if (!confirm(completed ? 'Mark as done?' : 'Mark as not done?')) return;
await api('complete_event', {id, completed: completed ? 1 : 0});
loadPlanner();
loadDashboard();
}

// PATCH: New function to reset completed event to incomplete
async function markIncomplete(id) {
await markComplete(id, false); // Reuse markComplete with completed=false
}

// NEW: Recurrence Conversion Functions
function ensureRecurModal() {
if (document.getElementById('modal-recur')) return;
const modal = document.createElement('div');
modal.id = 'modal-recur';
modal.className = 'modal-sheet hidden';
modal.innerHTML = `
<div class="bg-zinc-900 rounded-t-3xl p-6 w-full max-w-md">
    <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-semibold">Make Recurring</h3>
        <button onclick="closeRecurModal()" class="text-zinc-400 hover:text-white">✕</button>
    </div>
    <div class="space-y-4">
        <div>
            <label class="block text-sm text-zinc-400 mb-1">Frequency</label>
            <select id="recur-type" class="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white">
                <option value="daily">Daily</option>
                <option value="weekly" selected>Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
            </select>
        </div>
        <div>
            <label class="block text-sm text-zinc-400 mb-1">Occurrences</label>
            <input type="number" id="recur-count" value="10" min="2" max="100" class="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white">
            <p class="text-xs text-zinc-500 mt-1">Includes the original event date.</p>
        </div>
        <div class="flex gap-3 mt-6">
            <button onclick="closeRecurModal()" class="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl">Cancel</button>
            <button onclick="confirmRecur()" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl">Convert</button>
        </div>
    </div>
</div>
`;
document.body.appendChild(modal);
}

function showRecurModal(id) {
currentRecurEventId = id;
ensureRecurModal();
const modal = document.getElementById('modal-recur');
modal.classList.remove('hidden');
modal.classList.add('flex');
}

function closeRecurModal() {
const modal = document.getElementById('modal-recur');
if (modal) {
modal.classList.add('hidden');
modal.classList.remove('flex');
}
currentRecurEventId = null;
}

async function confirmRecur() {
if (!currentRecurEventId) return;
const type = document.getElementById('recur-type').value;
const count = parseInt(document.getElementById('recur-count').value) || 10;

if (!confirm(`Convert this event into ${count} ${type} occurrences? The original event will be replaced.`)) return;

try {
const res = await api('recur_event', {
id: currentRecurEventId,
type: type,
count: count
});
if (res.success) {
closeRecurModal();
loadPlanner();
loadDashboard();
} else {
alert("Conversion failed: " + (res.error || "unknown"));
}
} catch (err) {
console.error(err);
alert("Error converting event: " + err.message);
}
}

async function loadPlanner() {
const data = await api('get_events');
state.eventsData = data || [];
renderPlannerHashtagFilter();
applyPlannerFilter();
}

Object.assign(window, {
onRecurrenceChange,
updateOccurrencePreview,
showAddEventModal,
saveEvent,
editEvent,
updateEvent,
deleteEvent,
markComplete,    // Now accepts optional 'completed' parameter
markIncomplete,  // New exported function
loadPlanner,
showRecurModal,  // NEW
closeRecurModal  // NEW
});
export { loadPlanner, saveEvent, markIncomplete };