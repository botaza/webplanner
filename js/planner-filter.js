// js/planner-filter.js
import { state } from './state.js';
import { renderPlanner } from './planner-render.js';

let currentHashtagFilter = null;

export function setHashtagFilter(tag) {
    currentHashtagFilter = tag;
    applyHashtagFilter();
}

function applyHashtagFilter() {
    let filtered = state.eventsData;
    if (currentHashtagFilter) {
        filtered = state.eventsData.filter(e => e.hashtag === currentHashtagFilter);
    }
    renderPlanner(filtered);
}

export { applyHashtagFilter as applyPlannerFilter };