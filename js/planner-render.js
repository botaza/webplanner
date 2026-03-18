import { state } from './state.js';
import { setHashtagFilter } from './planner-filter.js';

function renderPlanner(events = state.eventsData) {
    const container = document.getElementById('planner-list');
    if (!container) return;
    container.innerHTML = events.map(ev => {
        const completedClass = ev.completed ? 'line-through text-zinc-400' : '';
        return `
        <div class="planner-item p-2 border-b flex justify-between items-center">
            <div class="flex flex-col">
                <span class="${completedClass}">${ev.desc}</span>
                <small class="text-zinc-500">${ev.dt}</small>
                ${ev.hashtag ? `<small class="text-blue-500">#${ev.hashtag}</small>` : ''}
            </div>
            <div class="flex gap-2">
                <button onclick="window.editEvent(${ev.id})">Edit</button>
                <button onclick="window.deleteEvent(${ev.id})">Delete</button>
                <button onclick="window.markComplete(${ev.id})">
                    ${ev.completed ? 'Mark Incomplete' : 'Complete'}
                </button>
            </div>
        </div>
        `;
    }).join('');
}

function renderPlannerHashtagFilter() {
    const container = document.getElementById('planner-hashtag-filter');
    if (!container) return;
    const hashtags = [...new Set(state.eventsData.map(e => e.hashtag).filter(Boolean))];
    container.innerHTML = hashtags.map(tag => `<button onclick="setHashtagFilter('${tag}')">#${tag}</button>`).join(' ');
}

export { renderPlanner, renderPlannerHashtagFilter, renderPlanner as applyPlannerFilter };