// js/planner-crud.js

import { state } from './state.js';
import { api } from './api.js';
import { hideModal } from './utils.js';
import { renderPlanner } from './planner-render.js';
import { loadDashboard } from './dashboard.js';
import { nowDatetimeLocal } from './date-utils.js';
import { renderHashtagSuggestions, renderPlaceSuggestions, renderDurationSuggestions } from './suggestions.js';
import { renderPlannerHashtagFilter, applyPlannerFilter } from './planner-filter.js';

const RECURRENCE_DEFAULTS = { weekly: 10, biweekly: 6, monthly: 6, yearly: 3 };

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
        return `<div class="text-xs text-zinc-400 flex items-center gap-2">
            <span class="text-emerald-500 shrink-0">${i+1}.</span>
            <span>${label}</span>
        </div>`;
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

// ---------- NEW: markComplete / markIncomplete ----------
async function markComplete(id) {
    const ev = state.eventsData.find(e => e.id == id);
    if (!ev) return;
    const confirmAction = ev.completed ? 'Mark as incomplete?' : 'Mark as done?';
    if (!confirm(confirmAction)) return;
    await api('complete_event', {id, completed: !ev.completed});
    loadPlanner();
    loadDashboard();
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
    markComplete,
    loadPlanner
});

export { loadPlanner, saveEvent }; // <- keep saveEvent exported