// js/planner-filter.js - WebPlanner Filtering & Group State
// PATCHED: Ensures completed events are included in filters and counts

import { state } from './state.js';
import { renderPlanner } from './planner-render.js';

/**
 * Storage key for collapsible group state
 */
const GROUP_STATE_KEY = 'webplanner_group_state';

/**
 * Get stored open/closed state for month/day groups
 * @returns {Object} - { 'm:2024-01': true, 'd:2024-01-15': false }
 */
export function getOpenGroups() {
    try {
        const stored = localStorage.getItem(GROUP_STATE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (error) {
        console.error('Failed to load group state:', error);
        return {};
    }
}

/**
 * Save open/closed state for a specific group
 * @param {string} key - Group key (e.g., 'm:2024-01')
 * @param {boolean} isOpen - Whether the group is expanded
 */
export function setGroupOpen(key, isOpen) {
    try {
        const current = getOpenGroups();
        current[key] = isOpen;
        localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(current));
    } catch (error) {
        console.error('Failed to save group state:', error);
    }
}

/**
 * Extract unique hashtags from all events (including completed)
 * @returns {Array<string>}
 */
function getUniqueHashtags() {
    const hashtags = new Set();
    state.eventsData.forEach(ev => {
        // ✅ PATCH: Include hashtags from completed events too
        if (ev.hashtag && ev.hashtag.trim()) {
            hashtags.add(ev.hashtag.trim());
        }
    });
    return Array.from(hashtags).sort();
}

/**
 * Render hashtag filter chips at the top of the planner
 */
export function renderPlannerHashtagFilter() {
    const container = document.getElementById('hashtag-filters');
    if (!container) return;
    
    container.innerHTML = '';
    
    const hashtags = getUniqueHashtags();
    const activeFilter = state.filters.hashtag;
    
    // "All" chip (clear filter)
    const allChip = document.createElement('div');
    allChip.className = `chip ${activeFilter === null ? 'active' : ''}`;
    allChip.textContent = 'All';
    allChip.onclick = () => clearHashtagFilter();
    container.appendChild(allChip);
    
    // Individual hashtag chips
    hashtags.forEach(tag => {
        const chip = document.createElement('div');
        chip.className = `chip ${activeFilter === tag ? 'active' : ''}`;
        chip.innerHTML = `
            <span>${tag}</span>
            ${activeFilter === tag ? '<span class="chip-remove">&times;</span>' : ''}
        `;
        chip.onclick = () => selectHashtag(tag);
        container.appendChild(chip);
    });
    
    // If there are many hashtags, enable horizontal scroll
    if (hashtags.length > 5) {
        container.style.overflowX = 'auto';
        container.style.whiteSpace = 'nowrap';
        container.style.flexWrap = 'nowrap';
    } else {
        container.style.overflowX = 'visible';
        container.style.whiteSpace = 'normal';
        container.style.flexWrap = 'wrap';
    }
}

/**
 * Select a hashtag filter
 * @param {string} hashtag - Hashtag to filter by
 */
export function selectHashtag(hashtag) {
    state.filters.hashtag = hashtag;
    renderPlannerHashtagFilter();
    applyPlannerFilter();
}

/**
 * Clear hashtag filter (show all)
 */
export function clearHashtagFilter() {
    state.filters.hashtag = null;
    renderPlannerHashtagFilter();
    applyPlannerFilter();
}

/**
 * Apply current filters to event list and render
 * ✅ PATCH: Does not filter out completed events unless they don't match other criteria
 */
export function applyPlannerFilter() {
    const { hashtag } = state.filters;
    
    let filtered = state.eventsData;
    
    // Filter by hashtag if selected
    if (hashtag) {
        filtered = filtered.filter(ev => {
            // ✅ PATCH: Completed events are included in hashtag filtering
            return ev.hashtag === hashtag;
        });
    }
    
    // ✅ PATCH: Do NOT filter out completed events by default
    // state.filters.showCompleted is true by default in state.js
    if (state.filters.showCompleted === false) {
        filtered = filtered.filter(ev => ev.completed !== true);
    }
    
    // Sort by datetime (newest first or oldest first? Usually oldest first for planner)
    filtered.sort((a, b) => {
        if (!a.dt) return 1;
        if (!b.dt) return -1;
        return a.dt.localeCompare(b.dt);
    });
    
    // Render the filtered list
    renderPlanner(filtered);
}

/**
 * Get count of events for a specific hashtag
 * @param {string} hashtag
 * @returns {number}
 */
export function getHashtagCount(hashtag) {
    return state.eventsData.filter(ev => {
        // ✅ PATCH: Count completed events too
        return ev.hashtag === hashtag;
    }).length;
}

/**
 * Get total event count (including completed)
 * @returns {number}
 */
export function getTotalEventCount() {
    return state.eventsData.length;
}

/**
 * Get count of completed events
 * @returns {number}
 */
export function getCompletedEventCount() {
    return state.eventsData.filter(ev => ev.completed === true).length;
}

/**
 * Get count of active (incomplete) events
 * @returns {number}
 */
export function getActiveEventCount() {
    return state.eventsData.filter(ev => ev.completed !== true).length;
}

/**
 * Toggle show completed filter
 * @param {boolean} show - Whether to show completed events
 */
export function toggleShowCompleted(show) {
    state.filters.showCompleted = show;
    applyPlannerFilter();
}

// ✅ PATCH: Expose functions to window for potential inline handlers or debugging
Object.assign(window, {
    selectHashtag,
    clearHashtagFilter,
    applyPlannerFilter,
    toggleShowCompleted,
    getOpenGroups,
    setGroupOpen
});

// Export default for module imports
export default {
    getOpenGroups,
    setGroupOpen,
    renderPlannerHashtagFilter,
    selectHashtag,
    clearHashtagFilter,
    applyPlannerFilter,
    getHashtagCount,
    getTotalEventCount,
    getCompletedEventCount,
    getActiveEventCount,
    toggleShowCompleted
};