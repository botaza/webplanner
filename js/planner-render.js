// js/planner-render.js

import { state } from './state.js';
import { formatDate } from './date-utils.js';
import { deleteEvent, toggleEventCompletion, resetEvent } from './planner-crud.js';
import { showEditEventModal } from './planner-crud.js';

export function renderPlanner(eventsToRender = null) {
    const container = document.getElementById('planner-list');
    if (!container) return;
    
    const events = eventsToRender || state.events;
    
    if (!events.length) {
        container.innerHTML = '<div class="text-zinc-500 text-center py-8">No events yet. Tap + to add one.</div>';
        return;
    }
    
    // Sort by date (newest first)
    const sorted = [...events].sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    
    let html = '';
    sorted.forEach(event => {
        const date = new Date(event.datetime);
        const isCompleted = event.completed || false;
        
        html += `
        <div class="bg-zinc-900 rounded-3xl p-5 ${isCompleted ? 'opacity-60' : ''}">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <div class="text-xs text-zinc-500 mb-1">${formatDate(date)}</div>
                    <div class="font-medium text-lg mb-2 ${isCompleted ? 'line-through' : ''}">${event.desc}</div>
                    
                    <div class="flex flex-wrap gap-2 text-sm text-zinc-400 mb-3">
                        ${event.hashtag ? `<span class="bg-zinc-800 px-3 py-1 rounded-full">${event.hashtag}</span>` : ''}
                        ${event.place ? `<span class="bg-zinc-800 px-3 py-1 rounded-full">📍 ${event.place}</span>` : ''}
                        ${event.duration ? `<span class="bg-zinc-800 px-3 py-1 rounded-full">⏱️ ${event.duration}min</span>` : ''}
                        ${event.recurrence !== 'none' ? `<span class="bg-zinc-800 px-3 py-1 rounded-full">🔄 ${event.recurrence}</span>` : ''}
                    </div>
                </div>
                
                <div class="flex gap-2">
                    <!-- Reset button (only for completed) -->
                    ${isCompleted ? `
                    <button onclick="window.resetEvent('${event.id}')" 
                            class="w-10 h-10 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 hover:bg-amber-500/30">
                        ↩️
                    </button>
                    ` : ''}
                    
                    <!-- Edit button -->
                    <button onclick="window.editEvent('${event.id}')" 
                            class="w-10 h-10 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 hover:bg-blue-500/30">
                        ✏️
                    </button>
                    
                    <!-- Complete toggle -->
                    <button onclick="window.toggleEvent('${event.id}')" 
                            class="w-10 h-10 ${isCompleted ? 'bg-zinc-700' : 'bg-emerald-500/20'} rounded-2xl flex items-center justify-center ${isCompleted ? 'text-zinc-400' : 'text-emerald-400'} hover:bg-opacity-30">
                        ${isCompleted ? '↩️' : '✓'}
                    </button>
                    
                    <!-- Delete -->
                    <button onclick="if(confirm('Delete this event?')) window.deleteEvent('${event.id}')" 
                            class="w-10 h-10 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-400 hover:bg-red-500/30">
                        ✕
                    </button>
                </div>
            </div>
            
            ${event.recurrence !== 'none' && event.occurrences ? `
            <div class="text-xs text-zinc-600 mt-3 border-t border-zinc-800 pt-3">
                Repeats ${event.recurrence} · ${event.occurrences} total
                ${event.occurrenceCount ? ` · ${event.occurrenceCount} completed` : ''}
            </div>
            ` : ''}
        </div>
        `;
    });
    
    container.innerHTML = html;
}

// Make functions available globally for onclick handlers
window.toggleEvent = (id) => {
    toggleEventCompletion(id);
    renderPlanner();
};

window.deleteEvent = (id) => {
    deleteEvent(id);
    renderPlanner();
};

window.resetEvent = (id) => {
    if (state.resetEvent(id)) {
        renderPlanner();
    }
};

window.editEvent = (id) => {
    showEditEventModal(id);
};