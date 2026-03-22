// js/income-ui.js
// UI FOR INCOME & COMPENSATION MODALS
// Handles modal visibility, tool button rendering, and form data gathering

import { state } from './state.js';
import { hideModal } from './utils.js';
import { todayString } from './date-utils.js';

// ── CONSTANTS ──
// Same quick-tool buttons as expenses
export const INCOME_TOOLS = [
    { code: 'gp',       name: 'GP' },
    { code: 'hal',      name: 'Hal' },
    { code: 'sb',       name: 'SB' },
    { code: 'ren',      name: 'Ren' },
    { code: 'oz',       name: 'OZON' },
    { code: 'ya',       name: 'Yandex' },
    { code: 'cert',     name: 'Certificate' },
    { code: 'cash',     name: 'Cash' },
    { code: 'transfer', name: 'Transfer' },
    { code: 'other',    name: 'Other…' }
];

// ── MODAL IDS ──
const MODAL_INCOME = 'modal-income';
const MODAL_COMP   = 'modal-compensation';

// ── STATE KEYS (stored on window.state) ──
// state.selectedIncomeTool        — active tool for +Income modal
// state.selectedCompensationTool  — active tool for +Compensation modal

// ── INCOME MODAL ──

/**
 * Open the +Income modal with defaults
 */
export function showIncomeModal() {
    _resetForm('inc');
    const modal = document.getElementById(MODAL_INCOME);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    renderIncomeTools();
}

/**
 * Close the +Income modal
 */
export function closeIncomeModal() {
    hideModal(MODAL_INCOME);
}

/**
 * Render tool buttons inside the income modal
 */
export function renderIncomeTools() {
    _renderTools('inc-tool-buttons', state.selectedIncomeTool, 'selectIncomeTool');
    _syncOtherInput('inc-tool-other-group', state.selectedIncomeTool);
}

/**
 * Handle tool selection in income modal
 * @param {string} code
 */
export function handleIncomeToolSelect(code) {
    state.selectedIncomeTool = code;
    renderIncomeTools();
}

/**
 * Gather and validate income form data
 * @returns {Object|null}
 */
export function getIncomeFormData() {
    return _gatherForm('inc', state.selectedIncomeTool);
}

/**
 * Reset income form
 */
export function resetIncomeForm() {
    state.selectedIncomeTool = null;
    _resetForm('inc');
}

// ── COMPENSATION MODAL ──

/**
 * Open the +Compensation modal with defaults
 */
export function showCompensationModal() {
    _resetForm('comp');
    const modal = document.getElementById(MODAL_COMP);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    renderCompensationTools();
}

/**
 * Close the +Compensation modal
 */
export function closeCompensationModal() {
    hideModal(MODAL_COMP);
}

/**
 * Render tool buttons inside the compensation modal
 */
export function renderCompensationTools() {
    _renderTools('comp-tool-buttons', state.selectedCompensationTool, 'selectCompensationTool');
    _syncOtherInput('comp-tool-other-group', state.selectedCompensationTool);
}

/**
 * Handle tool selection in compensation modal
 * @param {string} code
 */
export function handleCompensationToolSelect(code) {
    state.selectedCompensationTool = code;
    renderCompensationTools();
}

/**
 * Gather and validate compensation form data
 * @returns {Object|null}
 */
export function getCompensationFormData() {
    return _gatherForm('comp', state.selectedCompensationTool);
}

/**
 * Reset compensation form
 */
export function resetCompensationForm() {
    state.selectedCompensationTool = null;
    _resetForm('comp');
}

// ── INITIALIZATION ──

/**
 * Initialize UI — extend state with income-specific keys
 */
export function initIncomeUI() {
    if (!('selectedIncomeTool' in state))       state.selectedIncomeTool = null;
    if (!('selectedCompensationTool' in state)) state.selectedCompensationTool = null;
    if (!('compensationsData' in state))        state.compensationsData = [];
    console.log('[income-ui] Initialized');
}

// ── PRIVATE HELPERS ──

/**
 * Render a set of tool buttons into a container
 * @param {string} containerId
 * @param {string|null} activeCode
 * @param {string} clickHandler  - global window function name
 */
function _renderTools(containerId, activeCode, clickHandler) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = INCOME_TOOLS.map(t => `
        <div class="tool-btn ${activeCode === t.code ? 'active' : ''}"
             data-code="${t.code}"
             onclick="window.${clickHandler}('${t.code}')">
            ${t.name}
        </div>
    `).join('');
}

/**
 * Show/hide the "Other" text input group
 * @param {string} groupId
 * @param {string|null} activeCode
 */
function _syncOtherInput(groupId, activeCode) {
    const group = document.getElementById(groupId);
    if (!group) return;
    if (activeCode === 'other') {
        group.classList.remove('hidden');
    } else {
        group.classList.add('hidden');
        const input = group.querySelector('input');
        if (input) input.value = '';
    }
}

/**
 * Reset a modal form to blank defaults
 * @param {'inc'|'comp'} prefix
 */
function _resetForm(prefix) {
    const dateEl   = document.getElementById(`${prefix}-date`);
    const amountEl = document.getElementById(`${prefix}-amount`);
    const descEl   = document.getElementById(`${prefix}-desc`);
    const otherEl  = document.getElementById(`${prefix}-tool-other`);

    if (dateEl)   dateEl.value   = todayString();
    if (amountEl) amountEl.value = '';
    if (descEl)   descEl.value   = '';
    if (otherEl)  otherEl.value  = '';

    // Clear active classes on tool buttons
    const btnContainer = document.getElementById(`${prefix}-tool-buttons`);
    if (btnContainer) {
        btnContainer.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    }

    // Hide other group
    const otherGroup = document.getElementById(`${prefix}-tool-other-group`);
    if (otherGroup) otherGroup.classList.add('hidden');
}

/**
 * Gather and validate form data for either modal
 * @param {'inc'|'comp'} prefix
 * @param {string|null} selectedTool
 * @returns {Object|null}
 */
function _gatherForm(prefix, selectedTool) {
    const dateEl   = document.getElementById(`${prefix}-date`);
    const amountEl = document.getElementById(`${prefix}-amount`);
    const descEl   = document.getElementById(`${prefix}-desc`);
    const otherEl  = document.getElementById(`${prefix}-tool-other`);

    const date      = dateEl   ? dateEl.value.trim()   : '';
    const amountStr = amountEl ? amountEl.value.trim()  : '';
    const desc      = descEl   ? descEl.value.trim()    : '';
    const amount    = parseFloat(amountStr);

    if (!date) {
        alert('Please select a date');
        return null;
    }
    if (!amountStr || isNaN(amount) || amount <= 0) {
        alert('Please enter a valid positive amount');
        return null;
    }
    if (!selectedTool) {
        alert('Please select a tool');
        return null;
    }

    let toolValue = selectedTool;
    if (selectedTool === 'other') {
        const custom = otherEl ? otherEl.value.trim() : '';
        if (!custom) {
            alert('Please specify the other tool');
            return null;
        }
        toolValue = custom;
    }

    return { date, amount, tool: toolValue, desc };
}
