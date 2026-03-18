// js/planner-crud.js

import { state } from './state.js';
import { renderPlanner, renderPlannerHashtagFilter } from './planner-render.js';

// expose functions globally for inline buttons
window.editEvent = editEvent;
window.deleteEvent = deleteEvent;
window.markComplete = markComplete;

let nextId = 1;

export function addEvent(desc, dt, hashtag = '') {
    const event = {
        id: nextId++,
        desc,
        dt,
        hashtag,
        completed: false
    };
    state.eventsData.push(event);
    renderPlanner();
    renderPlannerHashtagFilter();
    return event;
}

export function editEvent(id) {
    const event = state.eventsData.find(e => e.id === id);
    if (!event) return;
    const newDesc = prompt('Edit event description:', event.desc);
    if (newDesc !== null) event.desc = newDesc;
    renderPlanner();
}

export function deleteEvent(id) {
    state.eventsData = state.eventsData.filter(e => e.id !== id);
    renderPlanner();
    renderPlannerHashtagFilter();
}

// PATCH: markComplete now toggles the completion flag
export function markComplete(id) {
    const event = state.eventsData.find(e => e.id === id);
    if (!event) return;

    // toggle completed
    event.completed = !event.completed;

    // re-render planner so it remains visible even if completed
    renderPlanner();
    renderPlannerHashtagFilter();
}

// loadPlanner can be called to refresh UI
export function loadPlanner() {
    renderPlanner();
    renderPlannerHashtagFilter();
}

// initialize nextId based on existing events
export function initNextId() {
    if (state.eventsData.length > 0) {
        nextId = Math.max(...state.eventsData.map(e => e.id)) + 1;
    }
}

// bootstrapping
initNextId();
loadPlanner();