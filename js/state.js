// js/state.js

const state = {
    events: [],
    expenses: [],
    income: [],

    // optional UI state (future-proofing)
    filters: {},
};

// Get full state
export function getState() {
    return state;
}

// Merge new values into state
export function setState(patch) {
    Object.assign(state, patch);
}

// Replace a specific key safely
export function setStateKey(key, value) {
    state[key] = value;
}

// Optional helper: push into array safely
export function pushToState(key, item) {
    if (!Array.isArray(state[key])) state[key] = [];
    state[key].push(item);
}

// Optional helper: remove by id
export function removeFromState(key, id) {
    if (!Array.isArray(state[key])) return;
    state[key] = state[key].filter(item => item.id !== id);
}