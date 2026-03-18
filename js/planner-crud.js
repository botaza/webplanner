// js/planner-crud.js - WebPlanner Event CRUD Operations
// PATCHED: Added markIncomplete, updated updateEvent for date change handling, exposed functions to window

import { state } from './state.js';
import { api, addEvent, updateEvent, deleteEvent, markComplete, markIncomplete } from './api.js';
import { hideModal } from './utils.js';
import { renderPlanner } from './planner-render.js';
import { loadDashboard } from './dashboard.js';
import { nowDatetimeLocal } from './date-utils.js';
import { renderHashtagSuggestions, renderPlaceSuggestions, renderDurationSuggestions } from './suggestions.js';
import { renderPlannerHashtagFilter, applyPlannerFilter } from './planner-filter.js';

// Default recurrence occurrence counts
const RECURRENCE_DEFAULTS = {
    weekly: 10,
    biweekly: 6,
    monthly: 6,
    yearly: 3
};

/**
 * Handle recurrence dropdown change
 * Shows/hides occurrence input based on selection
 */
export function onRecurrenceChange() {
    const recurrence = document.getElementById('event-recurrence').value;
    const section = document.getElementById('recurrence-occurrences-section');
    const occurrencesInput = document.getElementById('event-occurrences');
    
    if (recurrence === 'none') {
        section.classList.add('hidden');
    } else {
        section.classList.remove('hidden');
        // Set default count for selected recurrence type
        if (RECURRENCE_DEFAULTS[recurrence]) {
            occurrencesInput.value = RECURRENCE_DEFAULTS[recurrence];
        }
        updateOccurrencePreview();
    }
}

/**
 * Calculate recurrence dates based on start date and pattern
 * @param {string} startDate - YYYY-MM-DD HH:mm:ss
 * @param {string} pattern - weekly, biweekly, monthly, yearly
 * @param {number} count - Number of occurrences
 * @returns {Array<string>} - Array of datetime strings
 */
export function getRecurrenceDates(startDate, pattern, count) {
    const dates = [startDate];
    let currentDate = new Date(startDate.replace(' ', 'T'));
    
    for (let i = 1; i < count; i++) {
        switch (pattern) {
            case 'weekly':
                currentDate.setDate(currentDate.getDate() + 7);
                break;
            case 'biweekly':
                currentDate.setDate(currentDate.getDate() + 14);
                break;
            case 'monthly':
                currentDate.setMonth(currentDate.getMonth() + 1);
                break;
            case 'yearly':
                currentDate.setFullYear(currentDate.getFullYear() + 1);
                break;
        }
        
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const hours = String(currentDate.getHours()).padStart(2, '0');
        const minutes = String(currentDate.getMinutes()).padStart(2, '0');
        
        dates.push(`${year}-${month}-${day} ${hours}:${minutes}:00`);
    }
    
    return dates;
}

/**
 * Update the preview text for recurring events
 */
export function updateOccurrencePreview() {
    const recurrence = document.getElementById('event-recurrence').value;
    const count = parseInt(document.getElementById('event-occurrences').value) || 1;
    const startDate = document.getElementById('event-dt').value;
    const preview = document.getElementById('occurrence-preview');
    
    if (recurrence === 'none' || !startDate) {
        preview.innerHTML = '';
        return;
    }
    
    const dates = getRecurrenceDates(startDate.replace('T', ' ') + ':00', recurrence, count);
    const lastDate = dates[dates.length - 1];
    const lastDateObj = new Date(lastDate.replace(' ', 'T'));
    const formattedLast = lastDateObj.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
    
    preview.innerHTML = `Will create ${count} events. Last one: ${formattedLast}`;
}

/**
 * Reset event modal to create mode (clear fields)
 */
function resetEventModalToCreateMode() {
    document.getElementById('event-form').reset();
    document.getElementById('event-dt').value = nowDatetimeLocal();
    document.getElementById('event-recurrence').value = 'none';
    
    // Update modal title
    const modalTitle = document.querySelector('#modal-event .text-lg.font-semibold');
    if (modalTitle) modalTitle.textContent = 'New Event';
    
    // Update save button
    const saveBtn = document.querySelector('#modal-event .flex.gap-3 button:last-child');
    if (saveBtn) {
        saveBtn.textContent = 'Save Event';
        saveBtn.onclick = saveEvent;
    }
    
    // Show recurrence section
    document.getElementById('recurrence-occurrences-section').classList.add('hidden');
    document.getElementById('occurrence-preview').innerHTML = '';
    
    // Reset state
    state.ui.editingEventId = null;
    
    onRecurrenceChange();
}

/**
 * Show the add event modal
 */
export function showAddEventModal() {
    resetEventModalToCreateMode();
    document.getElementById('modal-event').classList.remove('hidden');
    document.getElementById('modal-event').classList.add('flex');
    
    // Render suggestions for autocomplete
    renderHashtagSuggestions();
    renderPlaceSuggestions();
    renderDurationSuggestions();
}

/**
 * Save new event (handles recurrence)
 */
export async function saveEvent() {
    const dt = document.getElementById('event-dt').value;
    if (!dt) {
        alert("Please select date and time");
        return;
    }
    
    const recurrence = document.getElementById('event-recurrence').value;
    const base = {
        desc: document.getElementById('event-desc').value.trim() || '(no description)',
        hashtag: document.getElementById('event-hashtag').value.trim(),
        place: document.getElementById('event-place').value.trim(),
        duration: document.getElementById('event-duration').value.trim(),
        recurrence
    };
    
    let datetimes = [dt.replace('T', ' ') + ':00'];
    
    // Handle recurrence
    if (recurrence !== 'none') {
        const count = parseInt(document.getElementById('event-occurrences').value) || 1;
        datetimes = getRecurrenceDates(dt.replace('T', ' ') + ':00', recurrence, count);
    }
    
    // Generate group ID for recurring events
    const groupId = recurrence !== 'none' ? ('grp_' + Date.now()) : '';
    
    try {
        for (const dtStr of datetimes) {
            const payload = {
                ...base,
                dt: dtStr,
                recurrence_group: groupId
            };
            const res = await addEvent(payload);
            if (!res.success) {
                alert("Save failed at " + dtStr + ": " + (res.error || "unknown"));
                return;
            }
        }
        
        hideModal('modal-event');
        await loadPlanner();
        await loadDashboard();
    } catch (err) {
        console.error(err);
        alert("Error saving event: " + err.message);
    }
}

/**
 * Edit existing event
 * @param {string} id - Event ID
 */
export async function editEvent(id) {
    // Find event in state
    const ev = state.eventsData.find(e => e.id == id);
    if (!ev) {
        console.error('Event not found:', id);
        return;
    }
    
    // Populate form
    document.getElementById('event-dt').value = ev.dt.replace(' ', 'T');
    document.getElementById('event-desc').value = ev.desc || '';
    document.getElementById('event-hashtag').value = ev.hashtag || '';
    document.getElementById('event-place').value = ev.place || '';
    document.getElementById('event-duration').value = ev.duration || '';
    document.getElementById('event-recurrence').value = ev.recurrence || 'none';
    
    // Update modal title
    const modalTitle = document.querySelector('#modal-event .text-lg.font-semibold');
    if (modalTitle) modalTitle.textContent = 'Edit Event';
    
    // Update save button to update mode
    const saveBtn = document.querySelector('#modal-event .flex.gap-3 button:last-child');
    if (saveBtn) {
        saveBtn.onclick = () => updateEvent(id);
        saveBtn.textContent = "Update Event";
    }
    
    // Show modal
    document.getElementById('modal-event').classList.remove('hidden');
    document.getElementById('modal-event').classList.add('flex');
    
    // Render suggestions
    renderHashtagSuggestions();
    renderPlaceSuggestions();
    renderDurationSuggestions();
    
    // Pre-select suggestions if present
    if (ev.hashtag) selectHashtag(ev.hashtag);
    if (ev.place) selectPlace(ev.place);
    if (ev.duration) selectDuration(ev.duration);
    
    // Hide recurrence section for edits (simplification: editing recurrence is complex)
    document.getElementById('recurrence-occurrences-section').classList.add('hidden');
    document.getElementById('occurrence-preview').innerHTML = '';
    
    // Store editing ID
    state.ui.editingEventId = id;
}

/**
 * Update existing event
 * @param {string} id - Event ID
 */
export async function updateEvent(id) {
    const dt = document.getElementById('event-dt').value;
    if (!dt) {
        alert("Date & time required");
        return;
    }
    
    // ✅ PATCH: Get old date for potential cache invalidation tracking
    // (Backend handles actual cache clearing, but good to know locally)
    const oldEv = state.eventsData.find(e => e.id == id);
    const oldDt = oldEv?.dt || null;
    const newDt = dt.replace('T', ' ');
    
    const payload = {
        id: id,
        dt: newDt,
        desc: document.getElementById('event-desc').value.trim(),
        hashtag: document.getElementById('event-hashtag').value.trim(),
        place: document.getElementById('event-place').value.trim(),
        duration: document.getElementById('event-duration').value.trim(),
        recurrence: document.getElementById('event-recurrence').value
    };
    
    try {
        const res = await updateEvent(id, payload);
        if (res.success) {
            // ✅ PATCH: If date changed, backend clears notification cache
            // We just need to refresh UI to reflect changes
            hideModal('modal-event');
            await loadPlanner();
            await loadDashboard();
            
            // Optional: Inform user if date changed significantly
            if (oldDt && oldDt !== newDt) {
                console.log('Event date updated. Notification cache cleared on server.');
            }
        } else {
            alert("Update failed: " + (res.error || "Unknown error"));
        }
    } catch (err) {
        console.error(err);
        alert("Error updating event: " + err.message);
    }
}

/**
 * Delete event
 * @param {string} id - Event ID
 */
export async function deleteEvent(id) {
    if (!confirm('Delete this event? This cannot be undone.')) {
        return;
    }
    
    try {
        await deleteEvent(id);
        await loadPlanner();
        await loadDashboard();
    } catch (err) {
        console.error(err);
        alert("Error deleting event: " + err.message);
    }
}

/**
 * Mark event as complete (move to done.json)
 * @param {string} id - Event ID
 */
export async function markComplete(id) {
    if (!confirm('Mark as done? The event will stay visible but be marked as completed.')) {
        return;
    }
    
    try {
        await markComplete(id);
        await loadPlanner();
        await loadDashboard();
    } catch (err) {
        console.error(err);
        alert("Error marking event complete: " + err.message);
    }
}

/**
 * ✅ PATCH: Mark event as incomplete (reset to active, clear notification cache)
 * @param {string} id - Event ID
 */
export async function markIncomplete(id) {
    if (!confirm('Mark as not done? This will allow the event to receive notifications again if rules match.')) {
        return;
    }
    
    try {
        // ✅ Pass false to toggleComplete which sends completed: 0 to backend
        await markIncomplete(id);
        await loadPlanner();
        await loadDashboard();
    } catch (err) {
        console.error(err);
        alert("Error marking event incomplete: " + err.message);
    }
}

/**
 * Load planner data from API and render
 */
export async function loadPlanner() {
    try {
        // ✅ PATCH: getEvents now returns both active and completed events
        const data = await api('get_events');
        state.eventsData = data || [];
        
        // Render filters and list
        renderPlannerHashtagFilter();
        applyPlannerFilter();
    } catch (err) {
        console.error('Failed to load planner:', err);
        document.getElementById('planner-list').innerHTML = 
            '<div class="text-center text-red-400 py-8">Failed to load events</div>';
    }
}

// ✅ PATCH: Expose functions to window for inline HTML onclick handlers
// This is necessary because modules are scoped
Object.assign(window, {
    onRecurrenceChange,
    updateOccurrencePreview,
    showAddEventModal,
    saveEvent,
    editEvent,
    updateEvent,
    deleteEvent,
    markComplete,
    markIncomplete,  // ✅ NEW: Exposed for "Undo Complete" button
    loadPlanner
});

// Also export for module imports
export { loadPlanner, saveEvent, markIncomplete };