// js/planner-filter.js
import { state } from './state.js';
import { renderPlannerHashtagFilter, applyPlannerFilter } from './planner-render.js'; // we'll define render in next file

const GROUPS_KEY = 'planner_open_groups';

function getOpenGroups() { /* paste */ }
function setGroupOpen(key, open) { /* paste */ }

function renderPlannerHashtagFilter() { /* paste */ }
function setPlannerHashtagFilter(tag) { /* paste */ }
function applyPlannerFilter() { /* paste */ }

// Global exposure (only what HTML calls)
Object.assign(window, { setPlannerHashtagFilter, applyPlannerFilter });