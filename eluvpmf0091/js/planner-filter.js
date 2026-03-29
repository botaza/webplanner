// js/planner-filter.js
// PATCHED: Added #completed to hashtag chips
// PATCHED: applyPlannerFilter hides completed events unless #completed filter is active

import { state } from './state.js';
import { renderPlanner } from './planner-render.js';

const COMMON_HASHTAGS = ['#pers', '#cons', '#job', '#event', '#control', '#class', '#completed'];
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
        // Give #completed chip a distinct style hint
        const completedClass = tag === '#completed' ? 'opacity-60' : '';
        return `<div class="hashtag-chip ${isActive ? 'active' : ''} ${completedClass}"
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
    const showingCompleted = state.activePlannerHashtag === '#completed';

    let filtered = state.eventsData;

    // Unless explicitly viewing #completed, hide all completed events
    if (!showingCompleted) {
        filtered = filtered.filter(e => !e.completed);
    } else {
        // When #completed is active, only show completed events
        filtered = filtered.filter(e => e.completed);
    }

    // Apply hashtag filter (skip for 'all' and '#completed' since we already filtered above)
    if (state.activePlannerHashtag && state.activePlannerHashtag !== '#completed') {
        filtered = filtered.filter(e => e.hashtag === state.activePlannerHashtag);
    }

    // Apply text search
    if (term) {
        filtered = filtered.filter(e =>
            (e.desc?.toLowerCase().includes(term)) ||
            (e.hashtag?.toLowerCase().includes(term)) ||
            (e.original_hashtag?.toLowerCase().includes(term))
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
