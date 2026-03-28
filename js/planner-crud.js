// js/planner-crud.js
// PATCHED: Fixed recurring event creation - preview and actual saved events now match
// PATCHED: Single source of truth with improved getRecurrenceDates()
// PATCHED: Safer date arithmetic to prevent month overflow bugs
// PATCHED: Recurrence from existing event now excludes original date from count
// PATCHED: All recurrence defaults set to 1 occurrence
import { requireAdmin } from './readonly-guard.js';
import { state } from './state.js';
import { api } from './api.js';
import { hideModal } from './utils.js';
import { renderPlanner } from './planner-render.js';
import { loadDashboard } from './dashboard.js';
import { nowDatetimeLocal } from './date-utils.js';
import { renderHashtagSuggestions, renderPlaceSuggestions, renderDurationSuggestions } from './suggestions.js';
import { renderPlannerHashtagFilter, applyPlannerFilter } from './planner-filter.js';

// ==================== DOW POLLING ====================
let _dowPollInterval = null;

function startDowPolling() {
    stopDowPolling();
    _dowPollInterval = setInterval(updateOccurrencePreview, 300);

    // Auto-stop when the modal is hidden (covers Cancel, × and save paths)
    const modal = document.getElementById('modal-event');
    if (modal && !modal._dowObserver) {
        const observer = new MutationObserver(() => {
            if (modal.classList.contains('hidden')) stopDowPolling();
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
        modal._dowObserver = observer; // attach once, reuse across opens
    }
}

function stopDowPolling() {
    if (_dowPollInterval) {
        clearInterval(_dowPollInterval);
        _dowPollInterval = null;
    }
}

// ==================== CONFIG ====================
// PATCHED: All defaults set to 1
const RECURRENCE_DEFAULTS = {
    daily: 1,
    weekly: 1,
    biweekly: 1,
    monthly: 1,
    yearly: 1
};

function onRecurrenceChange() {
    const rec = document.getElementById('event-recurrence').value;
    const section = document.getElementById('recurrence-occurrences-section');
    if (rec === 'none') {
        section.classList.add('hidden');
        document.getElementById('occurrence-preview').innerHTML = '';
    } else {
        section.classList.remove('hidden');
        // Uses updated RECURRENCE_DEFAULTS (all 1)
        document.getElementById('event-occurrences').value = RECURRENCE_DEFAULTS[rec] || 1;
        updateOccurrencePreview();
    }
}

// ==================== FIXED RECURRENCE LOGIC ====================
/**
 * Generate recurrence dates from a base datetime
 * @param {string} startDt - Base datetime (YYYY-MM-DD HH:MM:SS)
 * @param {string} recurrence - daily|weekly|biweekly|monthly|yearly
 * @param {number} count - Number of occurrences to generate
 * @param {boolean} skipFirst - If true, skip the base date (for repeating existing events)
 * @returns {string[]} Array of formatted datetime strings
 */
function getRecurrenceDates(startDt, recurrence, count, skipFirst = false) {
    const dates = [];
    
    // Parse the starting datetime safely
    let base = new Date(startDt.replace(' ', 'T'));
    if (isNaN(base.getTime())) return dates;
    
    // If skipping first, start from i=1, otherwise i=0
    const startIndex = skipFirst ? 1 : 0;
    const totalIterations = skipFirst ? count + 1 : count;
    
    for (let i = startIndex; i < totalIterations; i++) {
        const d = new Date(base);   // fresh copy every iteration
        
        if (recurrence === 'daily') {
            d.setDate(base.getDate() + i);
        } else if (recurrence === 'weekly') {
            d.setDate(base.getDate() + i * 7);
        } else if (recurrence === 'biweekly') {
            d.setDate(base.getDate() + i * 14);
        } else if (recurrence === 'monthly') {
            d.setMonth(base.getMonth() + i);
        } else if (recurrence === 'yearly') {
            d.setFullYear(base.getFullYear() + i);
        }
        
        const pad = n => String(n).padStart(2, '0');
        const formatted = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} `
                        + `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
        dates.push(formatted);
    }
    
    return dates;
}

function updateOccurrencePreview() {
    const rec = document.getElementById('event-recurrence').value;
    const count = parseInt(document.getElementById('event-occurrences').value) || 0;
    const dt = document.getElementById('event-dt').value;
    const preview = document.getElementById('occurrence-preview');

    // ── Day-of-week indicator ────────────────────────────────────────────────
    const dowEl = document.getElementById('event-dow-display');
    if (dowEl) {
        if (dt) {
            const dateObj = new Date(dt);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            dowEl.className = 'mt-2 px-1';
            dowEl.innerHTML = `<span class="event-dow-chip">${dayName}<span class="event-dow-date">${dateStr}</span></span>`;
        } else {
            dowEl.className = 'hidden mt-2 px-1';
            dowEl.innerHTML = '';
        }
    }
    // ────────────────────────────────────────────────────────────────────────

    if (!preview) return;

    if (!dt || rec === 'none' || count < 1) {
        preview.innerHTML = '';
        return;
    }
    
    // For NEW event creation, include the base date (skipFirst=false)
    const dates = getRecurrenceDates(dt.replace('T', ' ') + ':00', rec, count, false);
    
    preview.innerHTML = dates.map((d, i) => {
        const dateObj = new Date(d.replace(' ', 'T'));
        const label = dateObj.toLocaleDateString('ru-RU', {weekday:'short', day:'numeric', month:'short', year:'numeric'});
        return `<div class="text-xs text-zinc-400">${i+1}. ${label}</div>`;
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
    updateOccurrencePreview(); // refresh DOW chip for pre-filled date
}

function showAddEventModal() {
    resetEventModalToCreateMode();
    document.getElementById('modal-event').classList.remove('hidden');
    document.getElementById('modal-event').classList.add('flex');
    renderHashtagSuggestions();
    renderPlaceSuggestions();
    renderDurationSuggestions();
    startDowPolling();
}

async function saveEvent() {
    if (!requireAdmin()) return;
    
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
    
    // Use the unified recurrence function (skipFirst=false for NEW events)
    let datetimes = [dt.replace('T', ' ') + ':00'];
    if (recurrence !== 'none') {
        const count = parseInt(document.getElementById('event-occurrences').value) || 1;
        datetimes = getRecurrenceDates(dt.replace('T', ' ') + ':00', recurrence, count, false);
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
    document.getElementById('event-hashtag').value = ev.original_hashtag || ev.hashtag || '';
    document.getElementById('event-place').value = ev.place || '';
    document.getElementById('event-duration').value = ev.duration || '';
    updateOccurrencePreview(); // refresh DOW chip for loaded date
    
    const recurrenceSelect = document.getElementById('event-recurrence');
    if (recurrenceSelect) {
        recurrenceSelect.value = ev.recurrence || 'none';
    }
    
    const recurrenceSection = document.getElementById('recurrence-occurrences-section');
    if (ev.recurrence && ev.recurrence !== 'none') {
        recurrenceSection.classList.remove('hidden');
        document.getElementById('event-occurrences').value = '1'; // Updated default
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
    startDowPolling();
    
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
    if (!requireAdmin()) return;
    
    const dt = document.getElementById('event-dt').value;
    if (!dt) return alert("Date & time required");
    
    const ev = state.eventsData.find(e => e.id == id);
    const newHashtag = document.getElementById('event-hashtag').value.trim();
    const wasCompleted = ev && ev.completed;
    const originalHashtag = wasCompleted && newHashtag !== '#completed'
        ? ''
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
    if (!requireAdmin()) return;
    if (!confirm('Delete this event?')) return;
    await api('delete_event', {id});
    loadPlanner();
    loadDashboard();
}

async function markComplete(id, completed = true) {
    if (!requireAdmin()) return;
    
    const ev = state.eventsData.find(e => e.id == id);
    if (!ev) return;
    
    if (completed) {
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

async function markIncomplete(id) {
    await markComplete(id, false);
}

function showRepeatEventModal(id) {
    const ev = state.eventsData.find(e => e.id == id);
    if (!ev) return;
    
    const modal = document.getElementById('modal-repeat-event');
    modal.dataset.eventId = id;
    document.getElementById('repeat-frequency').value = 'weekly';
    // PATCHED: Default occurrences set to 1
    document.getElementById('repeat-occurrences').value = '1';
    updateRepeatPreview(ev);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

/**
 * Update the repeat event preview
 * @param {Object} ev - Event object
 */
function updateRepeatPreview(ev) {
    const freq = document.getElementById('repeat-frequency').value;
    const count = parseInt(document.getElementById('repeat-occurrences').value) || 1;
    const preview = document.getElementById('repeat-preview');
    
    if (!ev || !ev.dt) {
        preview.innerHTML = 'No date available';
        return;
    }
    
    // KEY FIX: skipFirst=true for repeat modal (excludes original date)
    const dates = getRecurrenceDates(ev.dt, freq, count, true);
    
    preview.innerHTML = dates.map((d, i) => {
        const dateObj = new Date(d.replace(' ', 'T'));
        const label = dateObj.toLocaleDateString('ru-RU', {day:'numeric', month:'short', year:'numeric'});
        return `<div>${i+1}. ${label}</div>`;
    }).join('');
}

async function confirmRepeatEvent() {
    if (!requireAdmin()) return;
    
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
        // KEY FIX: skipFirst=true to exclude original date from the series
        const dates = getRecurrenceDates(ev.dt, freq, count, true);
        
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
        
        // Delete the original event
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
