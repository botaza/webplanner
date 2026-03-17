// js/planner-crud.js
import { state } from './state.js';
import { api } from './api.js';
import { hideModal } from './utils.js';
import { renderPlanner } from './planner-render.js';
import { loadDashboard } from './dashboard.js';
import { nowDatetimeLocal } from './date-utils.js';
import { renderHashtagSuggestions, renderPlaceSuggestions, renderDurationSuggestions } from './suggestions.js';

const RECURRENCE_DEFAULTS = { weekly: 10, biweekly: 6, monthly: 6, yearly: 3 };

function onRecurrenceChange() { /* paste */ }
function getRecurrenceDates() { /* paste */ }
function updateOccurrencePreview() { /* paste */ }
function resetEventModalToCreateMode() { /* paste */ }
function showAddEventModal() { /* paste */ }
async function saveEvent() { /* paste */ }
async function editEvent(id) { /* paste */ }
async function updateEvent(id) { /* paste */ }
async function deleteEvent(id) { /* paste */ }
async function markComplete(id) { /* paste */ }
async function loadPlanner() {
    const data = await api('get_events');
    state.eventsData = data || [];
    // the rest of loadPlanner exactly
}

// Global exposure for all modal/CRUD buttons
Object.assign(window, {
    onRecurrenceChange, updateOccurrencePreview,
    showAddEventModal, saveEvent, editEvent, updateEvent,
    deleteEvent, markComplete, loadPlanner
});
export { loadPlanner };