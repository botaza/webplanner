// js/planner-crud.js
import { state } from './state.js';
import { renderPlanner, renderPlannerHashtagFilter } from './planner-render.js';

let nextId = state.eventsData.length ? Math.max(...state.eventsData.map(e => e.id)) + 1 : 1;

export function loadPlanner() {
    renderPlanner(state.eventsData);
    renderPlannerHashtagFilter();
}

export function saveEvent(desc, dt, hashtag) {
    const ev = { id: nextId++, desc, dt, hashtag, completed: false };
    state.eventsData.push(ev);
    loadPlanner();
}

export function editEvent(id, newDesc, newDt, newHashtag) {
    const ev = state.eventsData.find(e => e.id === id);
    if (!ev) return;
    ev.desc = newDesc;
    ev.dt = newDt;
    ev.hashtag = newHashtag;
    loadPlanner();
}

export function deleteEvent(id) {
    state.eventsData = state.eventsData.filter(e => e.id !== id);
    loadPlanner();
}

export function markComplete(id) {
    const ev = state.eventsData.find(e => e.id === id);
    if (!ev) return;
    ev.completed = !ev.completed;
    loadPlanner();
}

// Make functions accessible from onclick handlers
window.editEvent = editEvent;
window.deleteEvent = deleteEvent;
window.markComplete = markComplete;
window.loadPlanner = loadPlanner;
window.saveEvent = saveEvent;