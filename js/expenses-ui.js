// js/expenses-ui.js
// UI MANIPULATION FOR EXPENSES
// Handles modal visibility, button rendering, and form data gathering
// UPDATED: Added populateExpenseForm to pre-fill modal for editing

import { state } from './state.js';
import { hideModal } from './utils.js';

// ── CONSTANTS ──
export const EXPENSE_TOOLS = [
    {code: "gp", name: "GP"},
    {code: "hal", name: "Hal"},
    {code: "sb", name: "SB"},
    {code: "ren", name: "Ren"},
    {code: "oz", name: "OZON"},
    {code: "ya", name: "Yandex"},
    {code: "cert", name: "Certificate"},
    {code: "cash", name: "Cash"},
    {code: "transfer", name: "Transfer"},
    {code: "other", name: "Other…"}
];

export const EXPENSE_CATEGORIES = [
    {emoji: "🍔", name: "food"},
    {emoji: "🚗", name: "transport"},
    {emoji: "✈️", name: "travel"},
    {emoji: "🏠", name: "housing"},
    {emoji: "💊", name: "health"},
    {emoji: "🚫", name: "notmy"},
    {emoji: "🎮", name: "fun"},
    {emoji: "🛒", name: "shop"},
    {emoji: "➡️", name: "transfer"},
    {emoji: "🎓", name: "education"},
    {emoji: "🧾", name: "bills"},
    {emoji: "🎁", name: "gifts"},
    {emoji: "📲", name: "sbp"},
    {emoji: "📦", name: "other"},
    {emoji: "🏋️", name: "gym"},
    {emoji: "💳", name: "loans"},
];

// ── MODAL CONTROL ──

/**
 * Show the expense modal
 */
export function showExpenseModal() {
    const modal = document.getElementById('modal-expense');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

/**
 * Hide the expense modal
 */
export function closeExpenseModal() {
    hideModal('modal-expense');
}

// ── RENDERING ──

/**
 * Render tool buttons
 * @param {Array} tools - Array of {code, name} (defaults to EXPENSE_TOOLS)
 */
export function renderExpenseTools(tools = EXPENSE_TOOLS) {
    const container = document.getElementById('exp-tool-buttons');
    if (!container) return;

    container.innerHTML = tools.map(t => {
        const isActive = state.selectedExpenseTool === t.code;
        return `
        <div class="tool-btn ${isActive ? 'active' : ''}"
             data-code="${t.code}"
             onclick="window.selectExpenseTool('${t.code}')">
            ${t.name}
        </div>
    `;
    }).join('');

    // Handle 'Other' visibility
    const otherGroup = document.getElementById('exp-tool-other-group');
    if (otherGroup) {
        if (state.selectedExpenseTool === 'other') {
            otherGroup.classList.remove('hidden');
        } else {
            otherGroup.classList.add('hidden');
            const otherInput = document.getElementById('exp-tool-other');
            if (otherInput) otherInput.value = '';
        }
    }
}

/**
 * Render category buttons
 * @param {Array} categories - Array of {emoji, name} (defaults to EXPENSE_CATEGORIES)
 */
export function renderExpenseCategories(categories = EXPENSE_CATEGORIES) {
    const container = document.getElementById('exp-category-buttons');
    if (!container) return;

    container.innerHTML = categories.map(c => {
        const isActive = state.selectedExpenseCategory === c.name;
        return `
        <div class="category-btn ${isActive ? 'active' : ''}"
             title="${c.name}"
             onclick="window.selectExpenseCategory('${c.name}')">
            ${c.emoji}
        </div>
    `;
    }).join('');
}

// ── SELECTION HANDLERS ──

/**
 * Update UI and State when tool is selected
 * @param {string} code - Tool code
 */
export function handleToolSelect(code) {
    state.selectedExpenseTool = code;
    renderExpenseTools();
}

/**
 * Update UI and State when category is selected
 * @param {string} name - Category name
 */
export function handleCategorySelect(name) {
    state.selectedExpenseCategory = name;
    renderExpenseCategories();
}

// ── FORM DATA ──

/**
 * Gather form data from modal inputs
 * @returns {Object|null} Form data object or null if invalid
 */
export function getExpenseFormData() {
    const dateEl   = document.getElementById('exp-date');
    const amountEl = document.getElementById('exp-amount');
    const descEl   = document.getElementById('exp-desc');
    const otherEl  = document.getElementById('exp-tool-other');

    if (!dateEl || !amountEl) return null;

    const date      = dateEl.value;
    const amountStr = amountEl.value.trim();
    const amount    = parseFloat(amountStr);
    const desc      = descEl ? descEl.value.trim() : '';

    if (!date) {
        alert("Please select a date");
        return null;
    }
    if (!amountStr || isNaN(amount) || amount <= 0) {
        alert("Please enter a valid positive amount");
        return null;
    }
    if (!state.selectedExpenseTool) {
        alert("Please select a tool");
        return null;
    }
    if (!state.selectedExpenseCategory) {
        alert("Please select a category");
        return null;
    }

    let toolValue = state.selectedExpenseTool;
    if (state.selectedExpenseTool === 'other') {
        const custom = otherEl ? otherEl.value.trim() : '';
        if (!custom) {
            alert("Please specify the other tool");
            return null;
        }
        toolValue = custom;
    }

    return {
        date,
        amount,
        tool: toolValue,
        category: state.selectedExpenseCategory,
        desc
    };
}

/**
 * Pre-populate the expense modal with an existing expense's values.
 * Call this before showExpenseModal() when editing.
 * @param {Object} expense - Existing expense object { id, date, amount, tool, category, desc }
 */
export function populateExpenseForm(expense) {
    const dateEl   = document.getElementById('exp-date');
    const amountEl = document.getElementById('exp-amount');
    const descEl   = document.getElementById('exp-desc');
    const otherEl  = document.getElementById('exp-tool-other');

    if (dateEl)   dateEl.value   = expense.date   || '';
    if (amountEl) amountEl.value = expense.amount != null ? expense.amount : '';
    if (descEl)   descEl.value   = expense.desc   || '';

    // Resolve tool — check if it matches a known code, otherwise treat as "other"
    const knownTool = EXPENSE_TOOLS.find(t => t.code === expense.tool);
    if (knownTool) {
        state.selectedExpenseTool = knownTool.code;
        const otherGroup = document.getElementById('exp-tool-other-group');
        if (otherGroup) otherGroup.classList.add('hidden');
        if (otherEl) otherEl.value = '';
    } else if (expense.tool) {
        // Custom tool value — select "other" and fill in the text input
        state.selectedExpenseTool = 'other';
        const otherGroup = document.getElementById('exp-tool-other-group');
        if (otherGroup) otherGroup.classList.remove('hidden');
        if (otherEl) otherEl.value = expense.tool;
    } else {
        state.selectedExpenseTool = null;
    }

    // Resolve category
    const knownCategory = EXPENSE_CATEGORIES.find(c => c.name === expense.category);
    state.selectedExpenseCategory = knownCategory ? knownCategory.name : null;

    // Re-render buttons to reflect pre-selected state
    renderExpenseTools();
    renderExpenseCategories();
}

/**
 * Reset form fields to default state
 */
export function resetExpenseForm() {
    const dateEl   = document.getElementById('exp-date');
    const amountEl = document.getElementById('exp-amount');
    const descEl   = document.getElementById('exp-desc');
    const otherEl  = document.getElementById('exp-tool-other');

    if (dateEl)   dateEl.value   = '';
    if (amountEl) amountEl.value = '';
    if (descEl)   descEl.value   = '';
    if (otherEl)  otherEl.value  = '';

    state.selectedExpenseTool     = null;
    state.selectedExpenseCategory = null;

    document.querySelectorAll('.tool-btn, .category-btn').forEach(b => b.classList.remove('active'));
    const otherGroup = document.getElementById('exp-tool-other-group');
    if (otherGroup) otherGroup.classList.add('hidden');
}

// ── INITIALIZATION ──

/**
 * Initialize UI event listeners and state
 */
export function initExpenseUI() {
    console.log('[expenses-ui] Initialized');
}
