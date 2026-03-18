// js/state.js

// ── Core state object ──────────────────────────────────────────────────────
export const state = {
    events: [],
    expenses: [],
    income: [],
    filters: {},      // optional for future filtering UI
};

// ── Get full state safely ─────────────────────────────────────────────────
export function getState() {
    return state;
}

// ── Merge new values into state ───────────────────────────────────────────
export function setState(patch) {
    Object.assign(state, patch);
}

// ── Replace a specific key safely ─────────────────────────────────────────
export function setStateKey(key, value) {
    state[key] = value;
}

// ── Push an item into a state array safely ────────────────────────────────
export function pushToState(key, item) {
    if (!Array.isArray(state[key])) state[key] = [];
    state[key].push(item);
}

// ── Remove an item by ID from a state array safely ────────────────────────
export function removeFromState(key, id) {
    if (!Array.isArray(state[key])) return;
    state[key] = state[key].filter(item => item.id !== id);
}

// ── Example usage (for reference only) ───────────────────────────────────
// pushToState('expenses', { id: 123, amount: 50 });
// removeFromState('expenses', 123);
// setState({ filters: { category: 'food' } });