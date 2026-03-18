// js/planner-crud.js

import { state } from './state.js';
import { api } from './api.js';
import { hideModal } from './utils.js';
import { renderPlanner } from './planner-render.js';
import { loadDashboard } from './dashboard.js';
import { nowDatetimeLocal } from './date-utils.js';
import { renderHashtagSuggestions, renderPlaceSuggestions, renderDurationSuggestions } from './suggestions.js';

// <<‑ FIXED IMPORTS HERE >> 
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
        return `<div class="text-xs text-zinc-400">${i+1}. ${label}</div>`;
    }).join('');
}

function resetEventModalToCreateMode() {
    const saveBtn = document.querySelector('#modal-event .flex.gap-3 button:last-child');
    if (saveBtn) saveBtn.onclick = saveEvent;
    document.getElementById('event-dt').value = nowDatetimeLocal();
    document.getElementById('event-desc').value = '';
    document.getElementById('event-hashtag').value = '';
    document.getElementById('event-place').value = '';
    document.getElementById('event-duration').value = '';
    document.getElementById('event-recurrence').value = 'none';
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
    if (!dt) return alert("Please select date and time");
    const base = {
        desc: document.getElementById('event-desc').value.trim() || '(no description)',
        hashtag: document.getElementById('event-hashtag').value.trim(),
        place: document.getElementById('event-place').value.trim(),
        duration: document.getElementById('event-duration').value.trim(),
        recurrence: document.getElementById('event-recurrence').value
    };
    const payload = { ...base, dt: dt.replace('T', ' ') + ':00' };
    const res = await api('add_event', payload);
    if (!res.success) alert("Save failed");
    hideModal('modal-event');
    loadPlanner();
}

async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    await api('delete_event', { id });
    loadPlanner();
}

async function markComplete(id) {
    const ev = state.eventsData.find(e => e.id === id);
    if (!ev) return;
    const completed = !ev.completed;
    await api('update_event', {id, completed});
    loadPlanner();
}

async function loadPlanner() {
    const result = await api('get_events');
    state.eventsData = result || [];
    renderPlannerHashtagFilter();
    applyPlannerFilter();
}

Object.assign(window, {
    showAddEventModal,
    saveEvent,
    deleteEvent,
    markComplete,
    loadPlanner
});

export { loadPlanner, saveEvent, markComplete };