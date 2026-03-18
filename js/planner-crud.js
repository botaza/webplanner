// js/planner-crud.js

import { state } from './state.js';
import { renderPlanner } from './planner-render.js';
import { updateOccurrencePreview, hideModal, showModal } from './utils.js';
import { scheduleNotification } from './fcm-client.js';

export function loadPlanner() {
    state.loadEvents();
    renderPlanner();
}

export function saveEvent() {
    const id = state.currentEditId || Date.now().toString();
    const datetime = document.getElementById('event-dt').value;
    const desc = document.getElementById('event-desc').value;
    const hashtag = document.getElementById('event-hashtag').value;
    const place = document.getElementById('event-place').value;
    const duration = document.getElementById('event-duration').value;
    const recurrence = document.getElementById('event-recurrence').value;
    const occurrences = document.getElementById('event-occurrences')?.value;
    
    if (!datetime || !desc) {
        alert('Date and description are required');
        return;
    }
    
    const event = {
        id,
        datetime,
        desc,
        hashtag,
        place,
        duration: duration ? parseInt(duration) : null,
        recurrence,
        occurrences: occurrences ? parseInt(occurrences) : null,
        completed: false,
        occurrenceCount: 0,
        createdAt: new Date().toISOString()
    };
    
    // Check if editing existing event
    const existingIndex = state.events.findIndex(e => e.id === id);
    if (existingIndex >= 0) {
        // Preserve completion status if not explicitly reset
        const wasCompleted = state.events[existingIndex].completed;
        const dateChanged = state.events[existingIndex].datetime !== datetime;
        
        event.completed = dateChanged ? false : wasCompleted;
        event.occurrenceCount = state.events[existingIndex].occurrenceCount || 0;
        
        state.events[existingIndex] = event;
    } else {
        state.events.push(event);
    }
    
    state.saveEvents();
    
    // Schedule notification if applicable
    if (state.shouldNotifyEvent(event)) {
        scheduleNotification(event);
    }
    
    hideModal('modal-event');
    state.currentEditId = null;
    renderPlanner();
}

export function showAddEventModal() {
    // Reset form
    document.getElementById('event-dt').value = '';
    document.getElementById('event-desc').value = '';
    document.getElementById('event-hashtag').value = '';
    document.getElementById('event-place').value = '';
    document.getElementById('event-duration').value = '';
    document.getElementById('event-recurrence').value = 'none';
    
    const occurrencesSection = document.getElementById('recurrence-occurrences-section');
    if (occurrencesSection) occurrencesSection.classList.add('hidden');
    
    document.getElementById('event-occurrences').value = '';
    
    state.currentEditId = null;
    showModal('modal-event');
}

export function showEditEventModal(id) {
    const event = state.events.find(e => e.id === id);
    if (!event) return;
    
    // Populate form
    document.getElementById('event-dt').value = event.datetime;
    document.getElementById('event-desc').value = event.desc;
    document.getElementById('event-hashtag').value = event.hashtag || '';
    document.getElementById('event-place').value = event.place || '';
    document.getElementById('event-duration').value = event.duration || '';
    document.getElementById('event-recurrence').value = event.recurrence || 'none';
    
    if (event.occurrences) {
        document.getElementById('event-occurrences').value = event.occurrences;
        document.getElementById('recurrence-occurrences-section')?.classList.remove('hidden');
    } else {
        document.getElementById('recurrence-occurrences-section')?.classList.add('hidden');
    }
    
    state.currentEditId = id;
    showModal('modal-event');
}

export function deleteEvent(id) {
    state.events = state.events.filter(e => e.id !== id);
    state.saveEvents();
}

export function toggleEventCompletion(id) {
    const event = state.events.find(e => e.id === id);
    if (event) {
        event.completed = !event.completed;
        
        // If resetting to incomplete, ensure notifications are re-enabled
        if (!event.completed) {
            // Check if it should be notified now
            if (state.shouldNotifyEvent(event)) {
                scheduleNotification(event);
            }
        }
        
        state.saveEvents();
    }
}

// NEW: Explicit reset function
export function resetEvent(id) {
    if (state.resetEvent(id)) {
        const event = state.events.find(e => e.id === id);
        if (event && state.shouldNotifyEvent(event)) {
            scheduleNotification(event);
        }
        return true;
    }
    return false;
}

// NEW: Update event date
export function updateEventDate(id, newDatetime) {
    if (state.updateEventDate(id, newDatetime)) {
        const event = state.events.find(e => e.id === id);
        if (event && state.shouldNotifyEvent(event)) {
            scheduleNotification(event);
        }
        return true;
    }
    return false;
}