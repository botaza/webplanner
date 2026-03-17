// js/suggestions.js

import { state } from './state.js';

const COMMON_HASHTAGS = ['#pers', '#cons', '#job', '#event', '#control', '#class'];

function renderHashtagSuggestions() {
    const container = document.getElementById('hashtag-suggestions');
    if (!container) return;
    container.innerHTML = COMMON_HASHTAGS.map(tag => `
        <div class="hashtag-chip"
             onclick="selectHashtag('${tag}')"
             data-tag="${tag}">
            ${tag}
        </div>
    `).join('');
}

function selectHashtag(tag) {
    const input = document.getElementById('event-hashtag');
    if (input.value === tag) {
        input.value = '';
        document.querySelectorAll('#hashtag-suggestions .hashtag-chip').forEach(c => c.classList.remove('active'));
        return;
    }
    input.value = tag;
    document.querySelectorAll('#hashtag-suggestions .hashtag-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.tag === tag);
    });
}

const PLACE_SUGGESTIONS = ['?', 'Office', 'Home', 'Online'];

function renderPlaceSuggestions() {
    const container = document.getElementById('place-suggestions');
    if (!container) return;
    container.innerHTML = PLACE_SUGGESTIONS.map(p => `
        <div class="hashtag-chip"
             onclick="selectPlace('${p}')"
             data-place="${p}">
            ${p}
        </div>
    `).join('');
}

function selectPlace(val) {
    const input = document.getElementById('event-place');
    if (input.value === val) {
        input.value = '';
        document.querySelectorAll('#place-suggestions .hashtag-chip').forEach(c => c.classList.remove('active'));
        return;
    }
    input.value = val;
    document.querySelectorAll('#place-suggestions .hashtag-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.place === val);
    });
}

const DURATION_SUGGESTIONS = ['?', '15', '30', '45', '60', '90', '120'];

function renderDurationSuggestions() {
    const container = document.getElementById('duration-suggestions');
    if (!container) return;
    container.innerHTML = DURATION_SUGGESTIONS.map(d => `
        <div class="hashtag-chip"
             onclick="selectDuration('${d}')"
             data-dur="${d}">
            ${d === '?' ? '?' : d + ' min'}
        </div>
    `).join('');
}

function selectDuration(val) {
    const input = document.getElementById('event-duration');
    if (input.value === val) {
        input.value = '';
        document.querySelectorAll('#duration-suggestions .hashtag-chip').forEach(c => c.classList.remove('active'));
        return;
    }
    input.value = val;
    document.querySelectorAll('#duration-suggestions .hashtag-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.dur === val);
    });
}

// ✅ KEEP global access (for inline onclick)
Object.assign(window, {
    selectHashtag,
    selectPlace,
    selectDuration,
    renderHashtagSuggestions,
    renderPlaceSuggestions,
    renderDurationSuggestions
});

// ✅ ADD THIS (CRITICAL FIX)
export {
    renderHashtagSuggestions,
    renderPlaceSuggestions,
    renderDurationSuggestions,
    selectHashtag,
    selectPlace,
    selectDuration
};