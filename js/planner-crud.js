// js/planner-crud.js
// PATCHED: Fixed editEvent to properly populate all fields
// PATCHED: Added support for toggling completion status and date updates
// PATCHED 2: Added repeatEvent function to create recurring series from a single event
// PATCHED 3: Added daily recurrence defaults
// PATCHED 4: Changed minimum occurrences from 2 to 1
// PATCHED 5: Fixed recurrence date calculation to start AFTER original date
// PATCHED 6: markComplete sets hashtag to #completed and saves original_hashtag; markIncomplete restores it

import { state } from './state.js';
import { api } from './api.js';
import { hideModal } from './utils.js';
import { renderPlanner } from './planner-render.js';
import { loadDashboard } from './dashboard.js';
import { nowDatetimeLocal } from './date-utils.js';
import { renderHashtagSuggestions, renderPlaceSuggestions, renderDurationSuggestions } from './suggestions.js';
import { renderPlannerHashtagFilter, applyPlannerFilter } from './planner-filter.js';

const RECURRENCE_DEFAULTS = { 
 daily: 30,
 weekly: 10, 
 biweekly: 6, 
 monthly: 6, 
 yearly: 3 
};

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
 for (let i = 1; i <= count; i++) {
  const d = new Date(base);
  if (recurrence === 'daily') d.setDate(base.getDate() + i);
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
  recurrence,
  original_hashtag: ''
 };
 let datetimes = [dt.replace('T', ' ') + ':00'];
 if (recurrence !== 'none') {
  const count = parseInt(document.getElementById('event-occurrences').value) || 1;
  const allDates = [];
  const baseDate = new Date(dt.replace('T', ' ') + ':00');
  for (let i = 0; i < count; i++) {
   const d = new Date(baseDate);
   if (recurrence === 'daily') d.setDate(baseDate.getDate() + i);
   if (recurrence === 'weekly') d.setDate(baseDate.getDate() + i * 7);
   if (recurrence === 'biweekly') d.setDate(baseDate.getDate() + i * 14);
   if (recurrence === 'monthly') d.setMonth(baseDate.getMonth() + i);
   if (recurrence === 'yearly') d.setFullYear(baseDate.getFullYear() + i);
   const pad = n => String(n).padStart(2, '0');
   const formatted = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
    + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':00';
   allDates.push(formatted);
  }
  datetimes = allDates;
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
    
    const saveBtn = document.querySelector('#modal-event .flex.gap-3 button:last-child');
    if (saveBtn) {
        saveBtn.onclick = () => updateEvent(id);
        saveBtn.textContent = "Update Event";
    }
    
    const modalTitle = document.querySelector('#modal-event .text-xl.font-semibold');
    if (modalTitle) modalTitle.textContent = 'Edit Event';
    
    document.getElementById('event-dt').value = ev.dt.replace(' ', 'T');
    document.getElementById('event-desc').value = ev.desc || '';
    // Show original hashtag in edit mode if event is completed
    document.getElementById('event-hashtag').value = ev.original_hashtag || ev.hashtag || '';
    document.getElementById('event-place').value = ev.place || '';
    document.getElementById('event-duration').value = ev.duration || '';
    
    const recurrenceSelect = document.getElementById('event-recurrence');
    if (recurrenceSelect) {
        recurrenceSelect.value = ev.recurrence || 'none';
    }
    
    const recurrenceSection = document.getElementById('recurrence-occurrences-section');
    if (ev.recurrence && ev.recurrence !== 'none') {
        recurrenceSection.classList.remove('hidden');
        document.getElementById('event-occurrences').value = '10';
        updateOccurrencePreview();
    } else {
        recurrenceSection.classList.add('hidden');
        document.getElementById('occurrence-preview').innerHTML = '';
    }
    
    document.querySelectorAll('#hashtag-suggestions .hashtag-chip').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('#place-suggestions .hashtag-chip').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('#duration-suggestions .hashtag-chip').forEach(c => c.classList.remove('active'));
    
    document.getElementById('modal-event').classList.remove('hidden');
    document.getElementById('modal-event').classList.add('flex');
    
    renderHashtagSuggestions();
    renderPlaceSuggestions();
    renderDurationSuggestions();
    
    // The displayed hashtag (original or current)
    const displayHashtag = ev.original_hashtag || ev.hashtag || '';

    setTimeout(() => {
        if (displayHashtag) {
            document.querySelectorAll('#hashtag-suggestions .hashtag-chip').forEach(chip => {
                if (chip.dataset.tag === displayHashtag) chip.classList.add('active');
            });
        }
        if (ev.place) {
            document.querySelectorAll('#place-suggestions .hashtag-chip').forEach(chip => {
                if (chip.dataset.place === ev.place) chip.classList.add('active');
            });
        }
        if (ev.duration) {
            document.querySelectorAll('#duration-suggestions .hashtag-chip').forEach(chip => {
                if (chip.dataset.dur === ev.duration) chip.classList.add('active');
            });
        }
    }, 100);
}

async function updateEvent(id) {
 const dt = document.getElementById('event-dt').value;
 if (!dt) return alert("Date & time required");

 // Find the existing event so we can preserve original_hashtag if already completed
 const ev = state.eventsData.find(e => e.id == id);
 const newHashtag = document.getElementById('event-hashtag').value.trim();

 // If the event was completed and user is manually editing the hashtag away from #completed,
 // clear original_hashtag so it doesn't get restored on markIncomplete
 const wasCompleted = ev && ev.completed;
 const originalHashtag = wasCompleted && newHashtag !== '#completed'
  ? ''           // user is overriding — clear the saved original
  : (ev && ev.original_hashtag) || '';

 const payload = {
  id,
  dt: dt.replace('T', ' '),
  desc: document.getElementById('event-desc').value.trim(),
  hashtag: newHashtag,
  place: document.getElementById('event-place').value.trim(),
  duration: document.getElementById('event-duration').value.trim(),
  recurrence: document.getElementById('event-recurrence').value,
  original_hashtag: originalHashtag
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

// PATCHED 6: markComplete sets hashtag to #completed and saves original_hashtag
async function markComplete(id, completed = true) {
 const ev = state.eventsData.find(e => e.id == id);
 if (!ev) return;

 if (completed) {
  // Save original hashtag before overwriting, but don't double-save if already completed
  const originalHashtag = ev.hashtag !== '#completed' ? (ev.hashtag || '') : (ev.original_hashtag || '');
  await api('update_event', {
   id,
   dt: ev.dt,
   desc: ev.desc,
   hashtag: '#completed',
   place: ev.place || '',
   duration: ev.duration || '',
   recurrence: ev.recurrence || 'none',
   original_hashtag: originalHashtag,
   completed: 1
  });
 } else {
  // Restore original hashtag
  const restoredHashtag = ev.original_hashtag || '';
  await api('update_event', {
   id,
   dt: ev.dt,
   desc: ev.desc,
   hashtag: restoredHashtag,
   place: ev.place || '',
   duration: ev.duration || '',
   recurrence: ev.recurrence || 'none',
   original_hashtag: '',
   completed: 0
  });
 }

 loadPlanner();
 loadDashboard();
}

// markIncomplete is just markComplete with completed=false
async function markIncomplete(id) {
 await markComplete(id, false);
}

function showRepeatEventModal(id) {
 const ev = state.eventsData.find(e => e.id == id);
 if (!ev) return;
 
 const modal = document.getElementById('modal-repeat-event');
 modal.dataset.eventId = id;
 
 document.getElementById('repeat-frequency').value = 'weekly';
 document.getElementById('repeat-occurrences').value = '10';
 
 updateRepeatPreview(ev);
 
 modal.classList.remove('hidden');
 modal.classList.add('flex');
}

function updateRepeatPreview(ev) {
 const freq = document.getElementById('repeat-frequency').value;
 const count = parseInt(document.getElementById('repeat-occurrences').value) || 10;
 const preview = document.getElementById('repeat-preview');
 
 if (!ev || !ev.dt) {
  preview.innerHTML = 'No date available';
  return;
 }
 
 const dates = getRecurrenceDates(ev.dt, freq, count);
 preview.innerHTML = dates.map((d, i) => {
  const dateObj = new Date(d.replace(' ', 'T'));
  const label = dateObj.toLocaleDateString('ru-RU', {day:'numeric', month:'short', year:'numeric'});
  return `<div>${i+1}. ${label}</div>`;
 }).join('');
}

async function confirmRepeatEvent() {
 const modal = document.getElementById('modal-repeat-event');
 const eventId = modal.dataset.eventId;
 const ev = state.eventsData.find(e => e.id == eventId);
 
 if (!ev) {
  alert('Event not found');
  hideModal('modal-repeat-event');
  return;
 }
 
 const freq = document.getElementById('repeat-frequency').value;
 const count = parseInt(document.getElementById('repeat-occurrences').value);
 
 if (count < 1 || count > 100) {
  alert('Please enter a number between 1 and 100');
  return;
 }
 
 if (count === 1) {
  if (!confirm('This will create 1 future occurrence and delete the original. Continue?')) return;
 } else {
  if (!confirm(`Create ${count} future occurrences (${freq}) and delete the original?`)) return;
 }
 
 try {
  const dates = getRecurrenceDates(ev.dt, freq, count);
  
  const base = {
   desc: ev.desc || '',
   hashtag: ev.hashtag || '',
   place: ev.place || '',
   duration: ev.duration || '',
   recurrence: freq,
   original_hashtag: ev.original_hashtag || ''
  };
  
  const groupId = 'grp_' + Date.now();
  
  for (const dtStr of dates) {
   const payload = { ...base, dt: dtStr, recurrence_group: groupId };
   const res = await api('add_event', payload);
   if (!res.success) {
    alert("Failed to create recurring series");
    return;
   }
  }
  
  await api('delete_event', {id: eventId});
  
  hideModal('modal-repeat-event');
  loadPlanner();
  loadDashboard();
  
 } catch (err) {
  console.error('Error creating recurring series:', err);
  alert('Failed to create recurring series');
 }
}

async function loadPlanner() {
 const data = await api('get_events');
 state.eventsData = data || [];
 renderPlannerHashtagFilter();
 applyPlannerFilter();
}

document.addEventListener('DOMContentLoaded', () => {
 const freqSelect = document.getElementById('repeat-frequency');
 const countInput = document.getElementById('repeat-occurrences');
 
 if (freqSelect) {
  freqSelect.addEventListener('change', () => {
   const modal = document.getElementById('modal-repeat-event');
   const eventId = modal?.dataset.eventId;
   if (eventId) {
    const ev = state.eventsData.find(e => e.id == eventId);
    if (ev) updateRepeatPreview(ev);
   }
  });
 }
 
 if (countInput) {
  countInput.addEventListener('input', () => {
   const modal = document.getElementById('modal-repeat-event');
   const eventId = modal?.dataset.eventId;
   if (eventId) {
    const ev = state.eventsData.find(e => e.id == eventId);
    if (ev) updateRepeatPreview(ev);
   }
  });
 }
});

Object.assign(window, {
 onRecurrenceChange,
 updateOccurrencePreview,
 showAddEventModal,
 saveEvent,
 editEvent,
 updateEvent,
 deleteEvent,
 markComplete,
 markIncomplete,
 showRepeatEventModal,
 confirmRepeatEvent,
 loadPlanner
});

export { loadPlanner, saveEvent, markIncomplete };
