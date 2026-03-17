// js/suggestions.js
import { state } from './state.js';

const COMMON_HASHTAGS = ['#pers', '#cons', '#job', '#event', '#control', '#class'];
const PLACE_SUGGESTIONS = ['?', 'Office', 'Home', 'Online'];
const DURATION_SUGGESTIONS = ['?', '15', '30', '45', '60', '90', '120'];

// paste renderHashtagSuggestions, selectHashtag,
// renderPlaceSuggestions, selectPlace,
// renderDurationSuggestions, selectDuration exactly

// Global exposure
Object.assign(window, {
    selectHashtag, selectPlace, selectDuration,
    renderHashtagSuggestions, renderPlaceSuggestions, renderDurationSuggestions
});