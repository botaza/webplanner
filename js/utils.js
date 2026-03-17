// js/utils.js
import { state } from './state.js';
import { api } from './api.js';

export function switchScreen(screenId) {
    // paste the entire switchScreen function
    // (it already calls loadPlanner etc. via window. — we expose them below)
}

function hideModal(id) { /* paste */ }
async function clearAllData() { /* paste */ }
async function exportData() { /* paste */ }
async function takeSnapshot() { /* paste */ }
function showMonthPicker(type) { /* paste */ }
function filterPlanner() { /* paste */ }

// Global exposure
Object.assign(window, {
    switchScreen, hideModal, clearAllData, exportData,
    takeSnapshot, showMonthPicker, filterPlanner
});