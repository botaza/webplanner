// js/planner-crud.js
import { state } from './state.js';
import { renderPlanner, renderPlannerHashtagFilter } from './planner-render.js';

window.editEvent = function(id) {
    const ev = state.eventsData.find(e => e.id === id);
    if (!ev) return;
    const newDesc = prompt("Edit event description:", ev.desc);
    if (newDesc !== null) {
        ev.desc = newDesc;
        saveEvent(ev);
        renderPlanner(state.eventsData);
        renderPlannerHashtagFilter();
    }
};

window.deleteEvent = function(id) {
    const idx = state.eventsData.findIndex(e => e.id === id);
    if (idx !== -1) {
        state.eventsData.splice(idx, 1);
        renderPlanner(state.eventsData);
        renderPlannerHashtagFilter();
    }
};

window.markComplete = function(id) {
    const ev = state.eventsData.find(e => e.id === id);
    if (!ev) return;
    ev.completed = !ev.completed; // toggle completion
    saveEvent(ev);
    renderPlanner(state.eventsData);
    renderPlannerHashtagFilter();
};

// Explicitly export saveEvent so other modules can import it
export function saveEvent(event) {
    const idx = state.eventsData.findIndex(e => e.id === event.id);
    if (idx !== -1) {
        state.eventsData[idx] = event;
    } else {
        state.eventsData.push(event);
    }
    // Optionally persist to localStorage or backend
    localStorage.setItem('eventsData', JSON.stringify(state.eventsData));
}

export { window.editEvent, window.deleteEvent, window.markComplete };