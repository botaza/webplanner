// js/planner-crud.js
import { state } from './state.js';
import { renderPlanner, renderPlannerHashtagFilter } from './planner-render.js';

// --- Event handlers for UI ---
function editEvent(id) {
    const ev = state.eventsData.find(e => e.id === id);
    if (!ev) return;
    const newDesc = prompt("Edit event description:", ev.desc);
    if (newDesc !== null) {
        ev.desc = newDesc;
        saveEvent(ev);
        renderPlanner(state.eventsData);
        renderPlannerHashtagFilter();
    }
}

function deleteEvent(id) {
    const idx = state.eventsData.findIndex(e => e.id === id);
    if (idx !== -1) {
        state.eventsData.splice(idx, 1);
        renderPlanner(state.eventsData);
        renderPlannerHashtagFilter();
    }
}

function markComplete(id) {
    const ev = state.eventsData.find(e => e.id === id);
    if (!ev) return;
    ev.completed = !ev.completed; // toggle completion
    saveEvent(ev);
    renderPlanner(state.eventsData);
    renderPlannerHashtagFilter();
}

// Assign to window for onclick handlers
window.editEvent = editEvent;
window.deleteEvent = deleteEvent;
window.markComplete = markComplete;

// --- Save event ---
export function saveEvent(event) {
    const idx = state.eventsData.findIndex(e => e.id === event.id);
    if (idx !== -1) {
        state.eventsData[idx] = event;
    } else {
        state.eventsData.push(event);
    }
    localStorage.setItem('eventsData', JSON.stringify(state.eventsData));
}

// Named exports for module use
export { editEvent, deleteEvent, markComplete };