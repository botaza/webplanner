// js/expenses-charts.js
// CHART RENDERING LOGIC
// Handles drawing pie charts using vanilla SVG (offline-friendly)
// UPDATED: Handles negative/zero totals for income adjusted view

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
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
        hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CHART_COLORS[Math.abs(hash) % CHART_COLORS.length];
}

/**
 * Render a Pie Chart using CSS conic-gradient
 * @param {HTMLElement} container - Target DOM element
 * @param {Object} data - Aggregated data { groups: {...}, total: ... }
 * @param {string} groupBy - 'category' or 'tool'
 */
export function renderPieChart(container, data, groupBy) {
    if (!container) return;

    const groups = data?.groups || {};
    const keys   = Object.keys(groups);
    const total  = data?.total ?? 0;

    // ── No data ──
    if (keys.length === 0) {
        container.innerHTML = `
            <div class="text-center text-zinc-500 py-10">
                <div class="text-4xl mb-2">📉</div>
                <div>No data for this period</div>
            </div>`;
        return;
    }

    // ── All values are zero or cancel out ──
    // Use absolute amounts for chart sizing; show legend with signed values
    const absTotal = keys.reduce((s, k) => s + Math.abs(groups[k].amount || 0), 0);

    if (absTotal === 0) {
        container.innerHTML = `
            <div class="text-center text-zinc-500 py-10">
                <div class="text-4xl mb-2">⚖️</div>
                <div>Income and compensation cancel out</div>
            </div>`;
        return;
    }

    // ── Format the center label — signed, works for both expenses and adjusted ──
    const centerSign   = total >= 0 ? '+' : '−';
    const centerAmount = Math.abs(total).toLocaleString('ru-RU');
    const centerColor  = total >= 0 ? 'text-emerald-400' : 'text-red-400';

    // ── Single item ──
    if (keys.length === 1) {
        const key   = keys[0];
        const item  = groups[key];
        const color = getColor(key, 0);
        const sign  = item.amount >= 0 ? '+' : '−';
        const amt   = Math.abs(parseFloat(item.amount)).toLocaleString('ru-RU');

        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10">
                <div class="relative w-48 h-48">
                    <svg viewBox="0 0 100 100" class="w-full h-full transform -rotate-90">
                        <circle cx="50" cy="50" r="40" fill="transparent"
                                stroke="${color}" stroke-width="20" />
                    </svg>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="text-center">
                            <div class="text-xs text-zinc-500 uppercase">Total</div>
                            <div class="text-lg font-bold ${centerColor}">${centerSign}${centerAmount}</div>
                        </div>
                    </div>
                </div>
                <div class="mt-6 text-center">
                    <div class="text-xl font-bold text-zinc-200">${item.label}</div>
                    <div class="${item.amount >= 0 ? 'text-emerald-400' : 'text-red-400'} font-semibold">
                        ${sign}${amt}
                    </div>
                    <div class="text-xs text-zinc-500 mt-1">100%</div>
                </div>
            </div>`;
        return;
    }

    // ── Multiple items — use absolute amounts for slice sizing ──
    let cumulativePercent = 0;
    const slices = keys.map((key, index) => {
        const item    = groups[key];
        const absAmt  = Math.abs(item.amount || 0);
        const percent = absAmt / absTotal;           // always 0–1, never NaN
        const start   = cumulativePercent;
        cumulativePercent += percent;

        return {
            label:   item.label,
            amount:  item.amount,         // signed, for legend display
            absAmt,
            percent,
            color:   getColor(key, index),
            start,
            end: cumulativePercent
        };
    });

    // Build conic-gradient
    const gradientParts = slices.map((slice, i) => {
        const start = i === 0 ? 0 : slices[i - 1].end * 100;
        const end   = slice.end * 100;
        return `${slice.color} ${start}% ${end}%`;
    }).join(', ');

    // Legend rows
    const legendHTML = slices.map(slice => {
        const pctStr  = (slice.percent * 100).toFixed(1);
        const sign    = slice.amount >= 0 ? '+' : '−';
        const amtStr  = Math.abs(parseFloat(slice.amount)).toLocaleString('ru-RU');
        const amtColor = slice.amount >= 0 ? 'text-emerald-400' : 'text-red-400';

        return `
            <div class="flex items-center justify-between w-full gap-3 text-sm">
                <div class="flex items-center gap-2 min-w-0">
                    <div class="w-3 h-3 rounded-full shrink-0" style="background:${slice.color}"></div>
                    <span class="text-zinc-300 truncate">${slice.label}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0 text-zinc-400">
                    <span class="text-zinc-500">${pctStr}%</span>
                    <span class="${amtColor} font-medium">${sign}${amtStr}</span>
                </div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-6">
            <!-- Donut chart -->
            <div class="relative w-48 h-48 mb-6">
                <div class="w-full h-full rounded-full"
                     style="background: conic-gradient(${gradientParts});"></div>
                <!-- Center hole -->
                <div class="absolute inset-0 m-auto w-32 h-32 bg-zinc-900 rounded-full flex items-center justify-center">
                    <div class="text-center">
                        <div class="text-xs text-zinc-500 uppercase">Total</div>
                        <div class="text-lg font-bold ${centerColor}">${centerSign}${centerAmount}</div>
                    </div>
                </div>
            </div>
            <!-- Legend -->
            <div class="w-full space-y-2">
                ${legendHTML}
            </div>
        </div>`;
}
