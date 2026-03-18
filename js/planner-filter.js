// js/planner-filter.js
import { state } from './state.js';
import { loadPlanner } from './planner-crud.js';

export function setHashtagFilter(tag) {
    state.hashtagFilter = tag;
    loadPlanner();
}