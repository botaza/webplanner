// js/planner-filter.js

import { state } from './state.js';
import { renderPlanner } from './planner-render.js';

const COMMON_HASHTAGS = ['#pers', '#cons', '#job', '#event', '#control', '#class'];
const GROUPS_KEY = 'planner_open_groups';

function getOpenGroups() {
    try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}'); } catch { return {}; }
}

function setGroupOpen(key, open) {
    const groups = getOpenGroups();
    groups[key] = open;
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

function renderPlannerHashtagFilter() {
    const container = document.getElementById('planner-hashtag-filter');
    if (!container) return;
    const chips = ['all', ...COMMON_HASHTAGS];
    container.innerHTML = chips.map(tag => {
        const isAll = tag === 'all';
        const isActive = isAll ? !state.activePlannerHashtag : state.activePlannerHashtag === tag;
        return `<div class="hashtag-chip ${isActive ? 'active' : ''}"
                     data-tag="${tag}"
                     onclick="setPlannerHashtagFilter('${tag}')">
                    ${isAll ? 'All' : tag}
                </div>`;
    }).join('');
}

function setPlannerHashtagFilter(tag) {
    state.activePlannerHashtag = tag === 'all' ? null : tag;
    renderPlannerHashtagFilter();
    applyPlannerFilter();
}

function applyPlannerFilter() {
    const term = (document.getElementById('planner-filter')?.value || '').toLowerCase();
    let filtered = state.eventsData;

    // include all events, but visually handle completed
    if (state.activePlannerHashtag) {
        filtered = filtered.filter(e => e.hashtag === state.activePlannerHashtag);
    }
    if (term) {
        filtered = filtered.filter(e =>
            (e.desc?.toLowerCase().includes(term)) ||
            (e.hashtag?.toLowerCase().includes(term))
        );
    }

    renderPlanner(filtered);
}

function filterPlanner() {
    applyPlannerFilter();
}

Object.assign(window, {
    setPlannerHashtagFilter,
    applyPlannerFilter,
    filterPlanner
});

export {
    getOpenGroups,
    setGroupOpen,
    renderPlannerHashtagFilter,
    setPlannerHashtagFilter,
    applyPlannerFilter
};