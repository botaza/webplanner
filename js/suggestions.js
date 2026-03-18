// js/suggestions.js - WebPlanner Autocomplete Suggestions
// PATCHED: Proper suggestion rendering, selection handling, and localStorage persistence

import { state } from './state.js';

// Local storage keys for suggestion history
const HASHTAG_SUGGESTIONS_KEY = 'webplanner_hashtag_suggestions';
const PLACE_SUGGESTIONS_KEY = 'webplanner_place_suggestions';
const DURATION_SUGGESTIONS_KEY = 'webplanner_duration_suggestions';

// Maximum number of suggestions to store per category
const MAX_SUGGESTIONS = 50;

/**
 * Load suggestions from localStorage
 * @param {string} key - Storage key
 * @returns {Array<string>}
 */
function loadSuggestions(key) {
    try {
        const stored = localStorage.getItem(key);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Failed to load suggestions:', error);
    }
    return [];
}

/**
 * Save suggestions to localStorage
 * @param {string} key - Storage key
 * @param {Array<string>} suggestions - Suggestions array
 */
function saveSuggestions(key, suggestions) {
    try {
        // Keep only last MAX_SUGGESTIONS
        while (suggestions.length > MAX_SUGGESTIONS) {
            suggestions.pop();
        }
        localStorage.setItem(key, JSON.stringify(suggestions));
    } catch (error) {
        console.error('Failed to save suggestions:', error);
    }
}

/**
 * Add a suggestion to the list (if not already present)
 * @param {string} key - Storage key
 * @param {string} value - New suggestion value
 */
function addSuggestion(key, value) {
    if (!value || !value.trim()) return;
    
    const trimmed = value.trim();
    const suggestions = loadSuggestions(key);
    
    // Remove if already exists (to move to top)
    const index = suggestions.indexOf(trimmed);
    if (index !== -1) {
        suggestions.splice(index, 1);
    }
    
    // Add to beginning (most recent first)
    suggestions.unshift(trimmed);
    
    saveSuggestions(key, suggestions);
}

/**
 * Remove a suggestion from the list
 * @param {string} key - Storage key
 * @param {string} value - Value to remove
 */
function removeSuggestion(key, value) {
    if (!value || !value.trim()) return;
    
    const trimmed = value.trim();
    const suggestions = loadSuggestions(key);
    const index = suggestions.indexOf(trimmed);
    
    if (index !== -1) {
        suggestions.splice(index, 1);
        saveSuggestions(key, suggestions);
    }
}

/**
 * Get all hashtag suggestions
 * @returns {Array<string>}
 */
export function getHashtagSuggestions() {
    return loadSuggestions(HASHTAG_SUGGESTIONS_KEY);
}

/**
 * Get all place suggestions
 * @returns {Array<string>}
 */
export function getPlaceSuggestions() {
    return loadSuggestions(PLACE_SUGGESTIONS_KEY);
}

/**
 * Get all duration suggestions
 * @returns {Array<string>}
 */
export function getDurationSuggestions() {
    return loadSuggestions(DURATION_SUGGESTIONS_KEY);
}

/**
 * Render hashtag suggestion chips below the input
 */
export function renderHashtagSuggestions() {
    const container = document.getElementById('hashtag-suggestions');
    if (!container) return;
    
    container.innerHTML = '';
    
    const suggestions = getHashtagSuggestions();
    
    if (!suggestions.length) {
        container.innerHTML = '<div class="text-xs text-zinc-500 py-2">No recent hashtags</div>';
        return;
    }
    
    // Show top 10 suggestions
    suggestions.slice(0, 10).forEach(tag => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-full transition-colors mr-2 mb-2';
        chip.textContent = tag;
        chip.onclick = () => selectHashtag(tag);
        container.appendChild(chip);
    });
}

/**
 * Render place suggestion chips below the input
 */
export function renderPlaceSuggestions() {
    const container = document.getElementById('place-suggestions');
    if (!container) return;
    
    container.innerHTML = '';
    
    const suggestions = getPlaceSuggestions();
    
    if (!suggestions.length) {
        container.innerHTML = '<div class="text-xs text-zinc-500 py-2">No recent places</div>';
        return;
    }
    
    // Show top 10 suggestions
    suggestions.slice(0, 10).forEach(place => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-full transition-colors mr-2 mb-2';
        chip.textContent = place;
        chip.onclick = () => selectPlace(place);
        container.appendChild(chip);
    });
}

/**
 * Render duration suggestion chips below the input
 */
export function renderDurationSuggestions() {
    const container = document.getElementById('duration-suggestions');
    if (!container) return;
    
    container.innerHTML = '';
    
    const suggestions = getDurationSuggestions();
    
    if (!suggestions.length) {
        container.innerHTML = '<div class="text-xs text-zinc-500 py-2">No recent durations</div>';
        return;
    }
    
    // Show top 10 suggestions
    suggestions.slice(0, 10).forEach(duration => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-full transition-colors mr-2 mb-2';
        chip.textContent = duration + ' min';
        chip.onclick = () => selectDuration(duration);
        container.appendChild(chip);
    });
}

/**
 * Select a hashtag from suggestions
 * @param {string} hashtag - Hashtag to select
 */
export function selectHashtag(hashtag) {
    const input = document.getElementById('event-hashtag');
    if (input) {
        input.value = hashtag;
        input.focus();
    }
    
    // Save to suggestions
    addSuggestion(HASHTAG_SUGGESTIONS_KEY, hashtag);
    
    // Re-render suggestions
    renderHashtagSuggestions();
}

/**
 * Select a place from suggestions
 * @param {string} place - Place to select
 */
export function selectPlace(place) {
    const input = document.getElementById('event-place');
    if (input) {
        input.value = place;
        input.focus();
    }
    
    // Save to suggestions
    addSuggestion(PLACE_SUGGESTIONS_KEY, place);
    
    // Re-render suggestions
    renderPlaceSuggestions();
}

/**
 * Select a duration from suggestions
 * @param {string} duration - Duration in minutes
 */
export function selectDuration(duration) {
    const input = document.getElementById('event-duration');
    if (input) {
        input.value = duration;
        input.focus();
    }
    
    // Save to suggestions
    addSuggestion(DURATION_SUGGESTIONS_KEY, duration);
    
    // Re-render suggestions
    renderDurationSuggestions();
}

/**
 * Save hashtag from input when form is submitted or blurred
 * @param {string} hashtag - Hashtag value
 */
export function saveHashtagSuggestion(hashtag) {
    if (hashtag && hashtag.trim()) {
        addSuggestion(HASHTAG_SUGGESTIONS_KEY, hashtag.trim());
    }
}

/**
 * Save place from input when form is submitted or blurred
 * @param {string} place - Place value
 */
export function savePlaceSuggestion(place) {
    if (place && place.trim()) {
        addSuggestion(PLACE_SUGGESTIONS_KEY, place.trim());
    }
}

/**
 * Save duration from input when form is submitted or blurred
 * @param {string} duration - Duration value
 */
export function saveDurationSuggestion(duration) {
    if (duration && duration.trim()) {
        addSuggestion(DURATION_SUGGESTIONS_KEY, duration.trim());
    }
}

/**
 * Clear all hashtag suggestions
 */
export function clearHashtagSuggestions() {
    if (!confirm('Clear all hashtag suggestions?')) return;
    localStorage.removeItem(HASHTAG_SUGGESTIONS_KEY);
    renderHashtagSuggestions();
}

/**
 * Clear all place suggestions
 */
export function clearPlaceSuggestions() {
    if (!confirm('Clear all place suggestions?')) return;
    localStorage.removeItem(PLACE_SUGGESTIONS_KEY);
    renderPlaceSuggestions();
}

/**
 * Clear all duration suggestions
 */
export function clearDurationSuggestions() {
    if (!confirm('Clear all duration suggestions?')) return;
    localStorage.removeItem(DURATION_SUGGESTIONS_KEY);
    renderDurationSuggestions();
}

/**
 * Clear all suggestions (all categories)
 */
export function clearAllSuggestions() {
    if (!confirm('Clear all suggestions? This cannot be undone.')) return;
    localStorage.removeItem(HASHTAG_SUGGESTIONS_KEY);
    localStorage.removeItem(PLACE_SUGGESTIONS_KEY);
    localStorage.removeItem(DURATION_SUGGESTIONS_KEY);
    renderHashtagSuggestions();
    renderPlaceSuggestions();
    renderDurationSuggestions();
}

/**
 * Get suggestion count for each category
 * @returns {Object}
 */
export function getSuggestionCounts() {
    return {
        hashtags: getHashtagSuggestions().length,
        places: getPlaceSuggestions().length,
        durations: getDurationSuggestions().length
    };
}

/**
 * Export suggestions as JSON
 * @returns {string}
 */
export function exportSuggestions() {
    return JSON.stringify({
        hashtags: getHashtagSuggestions(),
        places: getPlaceSuggestions(),
        durations: getDurationSuggestions(),
        exportedAt: new Date().toISOString()
    }, null, 2);
}

/**
 * Import suggestions from JSON
 * @param {string} json - JSON string
 * @returns {boolean}
 */
export function importSuggestions(json) {
    try {
        const data = JSON.parse(json);
        if (data.hashtags && Array.isArray(data.hashtags)) {
            saveSuggestions(HASHTAG_SUGGESTIONS_KEY, data.hashtags);
        }
        if (data.places && Array.isArray(data.places)) {
            saveSuggestions(PLACE_SUGGESTIONS_KEY, data.places);
        }
        if (data.durations && Array.isArray(data.durations)) {
            saveSuggestions(DURATION_SUGGESTIONS_KEY, data.durations);
        }
        
        // Re-render all
        renderHashtagSuggestions();
        renderPlaceSuggestions();
        renderDurationSuggestions();
        
        return true;
    } catch (error) {
        console.error('Import suggestions failed:', error);
        return false;
    }
}

/**
 * Set up input listeners to save suggestions on blur
 */
export function setupSuggestionListeners() {
    // Hashtag input
    const hashtagInput = document.getElementById('event-hashtag');
    if (hashtagInput) {
        hashtagInput.addEventListener('blur', () => {
            saveHashtagSuggestion(hashtagInput.value);
        });
    }
    
    // Place input
    const placeInput = document.getElementById('event-place');
    if (placeInput) {
        placeInput.addEventListener('blur', () => {
            savePlaceSuggestion(placeInput.value);
        });
    }
    
    // Duration input
    const durationInput = document.getElementById('event-duration');
    if (durationInput) {
        durationInput.addEventListener('blur', () => {
            saveDurationSuggestion(durationInput.value);
        });
    }
}

/**
 * Show suggestions modal for management
 */
export function showSuggestionsModal() {
    const counts = getSuggestionCounts();
    
    const modal = document.createElement('div');
    modal.id = 'modal-suggestions';
    modal.className = 'modal-sheet hidden';
    modal.innerHTML = `
        <div class="bg-zinc-900 rounded-t-3xl p-4 max-h-[90vh] flex flex-col">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold">💡 Suggestions</h3>
                <button onclick="hideSuggestionsModal()" class="text-2xl text-zinc-400 hover:text-white">&times;</button>
            </div>
            
            <div class="modal-body overflow-y-auto space-y-4">
                <div class="grid grid-cols-3 gap-3 text-center">
                    <div class="bg-zinc-800/50 rounded-xl p-3">
                        <div class="text-2xl font-bold text-zinc-200">${counts.hashtags}</div>
                        <div class="text-[10px] text-zinc-500 uppercase">Hashtags</div>
                    </div>
                    <div class="bg-zinc-800/50 rounded-xl p-3">
                        <div class="text-2xl font-bold text-zinc-200">${counts.places}</div>
                        <div class="text-[10px] text-zinc-500 uppercase">Places</div>
                    </div>
                    <div class="bg-zinc-800/50 rounded-xl p-3">
                        <div class="text-2xl font-bold text-zinc-200">${counts.durations}</div>
                        <div class="text-[10px] text-zinc-500 uppercase">Durations</div>
                    </div>
                </div>
                
                <div class="bg-zinc-800/50 rounded-xl p-4">
                    <h4 class="font-medium text-zinc-200 mb-2">Recent Hashtags</h4>
                    <div id="suggestions-hashtag-list" class="flex flex-wrap gap-2"></div>
                </div>
                
                <div class="bg-zinc-800/50 rounded-xl p-4">
                    <h4 class="font-medium text-zinc-200 mb-2">Recent Places</h4>
                    <div id="suggestions-place-list" class="flex flex-wrap gap-2"></div>
                </div>
                
                <div class="bg-zinc-800/50 rounded-xl p-4">
                    <h4 class="font-medium text-zinc-200 mb-2">Recent Durations</h4>
                    <div id="suggestions-duration-list" class="flex flex-wrap gap-2"></div>
                </div>
                
                <div class="bg-zinc-800/50 rounded-xl p-4">
                    <button onclick="clearAllSuggestions()" class="w-full text-left text-red-400 hover:text-red-300 transition-colors">
                        🗑 Clear all suggestions
                    </button>
                </div>
            </div>
            
            <div class="flex gap-3 mt-4 pt-4 border-t border-zinc-800">
                <button onclick="hideSuggestionsModal()" class="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition-colors">Done</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Populate lists
    populateSuggestionLists();
}

/**
 * Hide suggestions modal
 */
export function hideSuggestionsModal() {
    const modal = document.getElementById('modal-suggestions');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        setTimeout(() => modal.remove(), 200);
    }
}

/**
 * Populate suggestion lists in modal
 */
function populateSuggestionLists() {
    // Hashtags
    const hashtagList = document.getElementById('suggestions-hashtag-list');
    if (hashtagList) {
        hashtagList.innerHTML = '';
        getHashtagSuggestions().slice(0, 20).forEach(tag => {
            const chip = document.createElement('span');
            chip.className = 'text-xs bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-full';
            chip.textContent = tag;
            hashtagList.appendChild(chip);
        });
    }
    
    // Places
    const placeList = document.getElementById('suggestions-place-list');
    if (placeList) {
        placeList.innerHTML = '';
        getPlaceSuggestions().slice(0, 20).forEach(place => {
            const chip = document.createElement('span');
            chip.className = 'text-xs bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-full';
            chip.textContent = place;
            placeList.appendChild(chip);
        });
    }
    
    // Durations
    const durationList = document.getElementById('suggestions-duration-list');
    if (durationList) {
        durationList.innerHTML = '';
        getDurationSuggestions().slice(0, 20).forEach(duration => {
            const chip = document.createElement('span');
            chip.className = 'text-xs bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-full';
            chip.textContent = duration + ' min';
            durationList.appendChild(chip);
        });
    }
}

/**
 * Initialize suggestions system
 */
export function initSuggestions() {
    setupSuggestionListeners();
    console.log('Suggestions system initialized');
}

// ✅ PATCH: Expose functions to window for inline HTML onclick handlers
Object.assign(window, {
    selectHashtag,
    selectPlace,
    selectDuration,
    renderHashtagSuggestions,
    renderPlaceSuggestions,
    renderDurationSuggestions,
    clearHashtagSuggestions,
    clearPlaceSuggestions,
    clearDurationSuggestions,
    clearAllSuggestions,
    showSuggestionsModal,
    hideSuggestionsModal,
    exportSuggestions,
    importSuggestions,
    getSuggestionCounts,
    initSuggestions
});

// Export default for module imports
export default {
    getHashtagSuggestions,
    getPlaceSuggestions,
    getDurationSuggestions,
    renderHashtagSuggestions,
    renderPlaceSuggestions,
    renderDurationSuggestions,
    selectHashtag,
    selectPlace,
    selectDuration,
    saveHashtagSuggestion,
    savePlaceSuggestion,
    saveDurationSuggestion,
    clearHashtagSuggestions,
    clearPlaceSuggestions,
    clearDurationSuggestions,
    clearAllSuggestions,
    getSuggestionCounts,
    exportSuggestions,
    importSuggestions,
    setupSuggestionListeners,
    showSuggestionsModal,
    hideSuggestionsModal,
    initSuggestions
};