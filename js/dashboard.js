// js/dashboard.js - WebPlanner Dashboard & Statistics
// PATCHED: Includes completed events in stats, shows completion rate

import { state } from './state.js';
import { api, getEvents, getExpenses, getIncome } from './api.js';
import { nowAsDatetimeString, nowDateLocal, isToday, isTomorrow, isPast } from './date-utils.js';
import { getCompletedEventCount, getActiveEventCount } from './planner-filter.js';

/**
 * Load and render dashboard data
 */
export async function loadDashboard() {
    try {
        // Load fresh data from API
        const [events, expenses, income] = await Promise.all([
            getEvents(),
            getExpenses(),
            getIncome()
        ]);
        
        // Update state
        state.eventsData = events || [];
        state.expensesData = expenses || [];
        state.incomeData = income || [];
        
        // Render all dashboard sections
        renderExpenseSummary();
        renderIncomeSummary();
        renderUpcomingEvents();
        renderCompletionStats();
        
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        document.getElementById('dash-exp-total').textContent = '−';
        document.getElementById('dash-inc-total').textContent = '+';
        document.getElementById('upcoming-list').innerHTML = `
            <div class="text-center text-red-400 py-4">Failed to load data</div>
        `;
    }
}

/**
 * Render monthly expense summary
 */
function renderExpenseSummary() {
    const container = document.getElementById('dash-exp-total');
    if (!container) return;
    
    const currentMonth = nowDateLocal().slice(0, 7); // YYYY-MM
    const monthlyExpenses = state.expensesData.filter(exp => {
        return (exp.dt || '').startsWith(currentMonth);
    });
    
    const total = monthlyExpenses.reduce((sum, exp) => {
        return sum + (parseFloat(exp.amount) || 0);
    }, 0);
    
    container.textContent = `−${formatCurrency(total)}`;
}

/**
 * Render monthly income summary
 */
function renderIncomeSummary() {
    const container = document.getElementById('dash-inc-total');
    if (!container) return;
    
    const currentMonth = nowDateLocal().slice(0, 7); // YYYY-MM
    const monthlyIncome = state.incomeData.filter(inc => {
        return (inc.dt || '').startsWith(currentMonth);
    });
    
    const total = monthlyIncome.reduce((sum, inc) => {
        return sum + (parseFloat(inc.amount) || 0);
    }, 0);
    
    container.textContent = `+${formatCurrency(total)}`;
}

/**
 * Render upcoming events preview (next 5 events, including completed for context)
 * ✅ PATCH: Shows completed events that are in the future
 */
function renderUpcomingEvents() {
    const container = document.getElementById('upcoming-list');
    if (!container) return;
    
    const nowStr = nowAsDatetimeString();
    
    // ✅ PATCH: Filter future events (both active and completed)
    // This shows what's coming up regardless of completion status
    const futureEvents = state.eventsData
        .filter(ev => {
            if (!ev.dt) return false;
            // Include events that are in the future
            return ev.dt >= nowStr;
        })
        .sort((a, b) => {
            if (!a.dt) return 1;
            if (!b.dt) return -1;
            return a.dt.localeCompare(b.dt);
        })
        .slice(0, 5); // Show next 5 events
    
    if (!futureEvents.length) {
        container.innerHTML = `
            <div class="text-center text-zinc-500 py-4">
                <div class="text-2xl mb-2">🎉</div>
                <p class="text-sm">No upcoming events</p>
                <p class="text-xs mt-1">Enjoy your free time!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    futureEvents.forEach(ev => {
        const dt = new Date(ev.dt.replace(' ', 'T'));
        const timeStr = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const dateStr = dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        
        // ✅ PATCH: Show completion status indicator
        const isCompleted = ev.completed === true;
        const completedIcon = isCompleted ? '✓ ' : '';
        const completedClass = isCompleted ? 'text-emerald-400' : 'text-zinc-400';
        const descClass = isCompleted ? 'line-through text-zinc-500' : 'text-zinc-200';
        
        const item = document.createElement('div');
        item.className = 'flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-zinc-800/50 transition-colors';
        item.innerHTML = `
            <div class="flex flex-col items-center min-w-[3rem]">
                <span class="text-xs ${completedClass}">${completedIcon}${timeStr}</span>
                <span class="text-[10px] text-zinc-500">${dateStr}</span>
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm ${descClass} truncate">${ev.desc || '(no description)'}</div>
                ${ev.hashtag ? `<span class="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">${ev.hashtag}</span>` : ''}
            </div>
            ${isCompleted ? '<span class="text-xs text-emerald-500">✓</span>' : ''}
        `;
        
        // Click to scroll to planner and highlight this event
        item.style.cursor = 'pointer';
        item.onclick = () => {
            if (window.switchScreen) {
                window.switchScreen('screen-planner');
            }
        };
        
        container.appendChild(item);
    });
}

/**
 * ✅ PATCH: Render completion statistics
 * Shows how many events are completed vs active
 */
function renderCompletionStats() {
    const container = document.getElementById('completion-stats');
    if (!container) return;
    
    const total = state.eventsData.length;
    const completed = getCompletedEventCount();
    const active = getActiveEventCount();
    
    if (total === 0) {
        container.innerHTML = `
            <div class="text-center text-zinc-500 py-4">
                <p class="text-sm">No events to track</p>
            </div>
        `;
        return;
    }
    
    const completionRate = Math.round((completed / total) * 100);
    
    container.innerHTML = `
        <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-zinc-800/50 rounded-xl p-3">
                <div class="text-2xl font-bold text-zinc-200">${total}</div>
                <div class="text-[10px] text-zinc-500 uppercase">Total</div>
            </div>
            <div class="bg-emerald-900/20 rounded-xl p-3 border border-emerald-700/30">
                <div class="text-2xl font-bold text-emerald-400">${completed}</div>
                <div class="text-[10px] text-emerald-500 uppercase">Done</div>
            </div>
            <div class="bg-zinc-800/50 rounded-xl p-3">
                <div class="text-2xl font-bold text-zinc-400">${active}</div>
                <div class="text-[10px] text-zinc-500 uppercase">Active</div>
            </div>
        </div>
        <div class="mt-3">
            <div class="flex items-center justify-between text-xs text-zinc-400 mb-1">
                <span>Completion Rate</span>
                <span>${completionRate}%</span>
            </div>
            <div class="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div class="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                     style="width: ${completionRate}%"></div>
            </div>
        </div>
    `;
}

/**
 * Format number as currency
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Get events for specific date range
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {boolean} includeCompleted - Whether to include completed events
 * @returns {Array<Object>}
 */
export function getEventsByDateRange(startDate, endDate, includeCompleted = true) {
    return state.eventsData.filter(ev => {
        if (!ev.dt) return false;
        const eventDate = ev.dt.slice(0, 10);
        const inRange = eventDate >= startDate && eventDate <= endDate;
        // ✅ PATCH: Respect includeCompleted flag
        if (!includeCompleted && ev.completed === true) {
            return false;
        }
        return inRange;
    });
}

/**
 * Get expense total for date range
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {number}
 */
export function getExpenseTotalByRange(startDate, endDate) {
    return state.expensesData
        .filter(exp => {
            if (!exp.dt) return false;
            return exp.dt >= startDate && exp.dt <= endDate;
        })
        .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
}

/**
 * Get income total for date range
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {number}
 */
export function getIncomeTotalByRange(startDate, endDate) {
    return state.incomeData
        .filter(inc => {
            if (!inc.dt) return false;
            return inc.dt >= startDate && inc.dt <= endDate;
        })
        .reduce((sum, inc) => sum + (parseFloat(inc.amount) || 0), 0);
}

/**
 * Get balance (income - expenses) for current month
 * @returns {number}
 */
export function getCurrentMonthBalance() {
    const currentMonth = nowDateLocal().slice(0, 7);
    const income = getIncomeTotalByRange(currentMonth + '-01', currentMonth + '-31');
    const expenses = getExpenseTotalByRange(currentMonth + '-01', currentMonth + '-31');
    return income - expenses;
}

/**
 * Refresh dashboard data (called after CRUD operations)
 */
export async function refreshDashboard() {
    await loadDashboard();
}

// ✅ PATCH: Expose functions to window for potential inline handlers
Object.assign(window, {
    loadDashboard,
    refreshDashboard,
    getEventsByDateRange,
    getCurrentMonthBalance
});

// Export default for module imports
export default {
    loadDashboard,
    refreshDashboard,
    getEventsByDateRange,
    getExpenseTotalByRange,
    getIncomeTotalByRange,
    getCurrentMonthBalance
};