import { state } from './state.js';
import { renderPlanner } from './planner-render.js';

let currentHashtagFilter = '';

function setHashtagFilter(hashtag) {
    currentHashtagFilter = hashtag;
    applyPlannerFilter();
}

function clearHashtagFilter() {
    currentHashtagFilter = '';
    applyPlannerFilter();
}

function applyPlannerFilter() {
    let filtered = [...state.eventsData];
    if (currentHashtagFilter) {
        filtered = filtered.filter(ev => ev.hashtag && ev.hashtag.includes(currentHashtagFilter));
    }
    renderPlanner(filtered);
}

export { setHashtagFilter, clearHashtagFilter, applyPlannerFilter };