// js/expenses-charts.js
// CHART RENDERING LOGIC
// Handles drawing pie charts using vanilla SVG (offline-friendly)

// ── COLOR PALETTE ──
const CHART_COLORS = [
    '#22c55e', // emerald-500
    '#3b82f6', // blue-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#84cc16', // lime-500
    '#f97316', // orange-500
    '#6366f1', // indigo-500
    '#14b8a6', // teal-500
    '#d946ef', // fuchsia-500
];

/**
 * Get a consistent color for a label
 * @param {string} label - Category or tool name
 * @param {number} index - Optional index override
 * @returns {string} Hex color
 */
function getColor(label, index) {
    if (typeof index === 'number') {
        return CHART_COLORS[index % CHART_COLORS.length];
    }
    // Hash based on label for consistency
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
        hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CHART_COLORS[Math.abs(hash) % CHART_COLORS.length];
}

/**
 * Render a Pie Chart using SVG
 * @param {HTMLElement} container - Target DOM element
 * @param {Object} data - Aggregated data { groups: {...}, total: ... }
 * @param {string} groupBy - 'category' or 'tool'
 */
export function renderPieChart(container, data, groupBy) {
    if (!container) return;

    const groups = data?.groups || {};
    const total = data?.total || 0;
    const keys = Object.keys(groups);

    // Handle No Data
    if (keys.length === 0 || total === 0) {
        container.innerHTML = `
            <div class="text-center text-zinc-500 py-10">
                <div class="text-4xl mb-2">📉</div>
                <div>No data for this period</div>
            </div>
        `;
        return;
    }

    // Handle Single Item (100%)
    if (keys.length === 1) {
        const key = keys[0];
        const item = groups[key];
        const color = getColor(key, 0);
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10">
                <div class="relative w-48 h-48">
                    <svg viewBox="0 0 100 100" class="w-full h-full transform -rotate-90">
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="${color}" stroke-width="20" />
                    </svg>
                </div>
                <div class="mt-6 text-center">
                    <div class="text-2xl font-bold text-zinc-200">${item.label}</div>
                    <div class="text-emerald-400 font-semibold">−${parseFloat(item.amount).toLocaleString('ru-RU')}</div>
                    <div class="text-xs text-zinc-500 mt-1">100% of total</div>
                </div>
            </div>
            <div class="flex flex-wrap justify-center gap-3 mt-6">
                <div class="flex items-center gap-2 text-sm text-zinc-400">
                    <div class="w-3 h-3 rounded-full" style="background:${color}"></div>
                    <span>${item.label}</span>
                </div>
            </div>
        `;
        return;
    }

    // Calculate Slices
    let cumulativePercent = 0;
    const slices = keys.map((key, index) => {
        const item = groups[key];
        const percent = item.amount / total;
        const start = cumulativePercent;
        cumulativePercent += percent;
        
        return {
            label: item.label,
            amount: item.amount,
            percent: percent,
            color: getColor(key, index),
            start: start,
            end: cumulativePercent
        };
    });

    // Generate SVG Circles with stroke-dasharray
    const circumference = 2 * Math.PI * 40; // r=40
    
    const svgSlices = slices.map(slice => {
        const dashArray = slice.percent * circumference;
        const dashOffset = circumference - (slice.percent * circumference); // Not used for multiple slices this way
        
        // For multiple slices, we use conic-gradient via CSS or multiple circles with rotation
        // Simpler SVG approach: Use conic-gradient via CSS on a div for better performance
        // But since we need SVG for export compatibility, let's use the circle rotation method
        
        const rotation = slice.start * 360;
        const arcLength = slice.percent * 360;
        
        // We will use a simpler CSS conic-gradient fallback for complex pies 
        // as pure SVG multi-slice is verbose. 
        // Actually, let's do CSS conic-gradient for simplicity and performance in PWA.
        return null; 
    });

    // Render using CSS Conic Gradient (Cleaner for Web)
    const gradientParts = slices.map((slice, i) => {
        const start = i === 0 ? 0 : slices[i-1].end * 100;
        const end = slice.end * 100;
        return `${slice.color} ${start}% ${end}%`;
    }).join(', ');

    const legendHTML = slices.map(slice => {
        const percentStr = (slice.percent * 100).toFixed(1);
        const amountStr = parseFloat(slice.amount).toLocaleString('ru-RU');
        return `
        <div class="flex items-center justify-between w-full sm:w-auto gap-3 text-sm">
            <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" style="background:${slice.color}"></div>
                <span class="text-zinc-300">${slice.label}</span>
            </div>
            <div class="text-zinc-400">
                <span class="text-zinc-200 font-medium">${percentStr}%</span>
                <span class="ml-2 text-xs">(${amountStr})</span>
            </div>
        </div>
    `;
    }).join('');

    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-6">
            <!-- Chart -->
            <div class="relative w-48 h-48 mb-6">
                <div class="w-full h-full rounded-full" 
                     style="background: conic-gradient(${gradientParts});">
                </div>
                <!-- Center Hole (Donut) -->
                <div class="absolute inset-0 m-auto w-32 h-32 bg-zinc-900 rounded-full flex items-center justify-center">
                    <div class="text-center">
                        <div class="text-xs text-zinc-500 uppercase">Total</div>
                        <div class="text-lg font-bold text-zinc-200">−${total.toLocaleString('ru-RU')}</div>
                    </div>
                </div>
            </div>
            
            <!-- Legend -->
            <div class="w-full space-y-2">
                ${legendHTML}
            </div>
        </div>
    `;
}