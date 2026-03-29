// js/shopping-ui.js
// UI HELPERS FOR SHOPPING MODULE
import { state } from './state.js';
import { hideModal } from './utils.js';
import { todayString } from './date-utils.js';

const MODAL_ID = 'modal-shopping';

export function showShoppingModal(mode = 'add', item = null) {
  state.shoppingModalMode = mode;
  state.editingShoppingId = mode === 'edit' ? item?.id : null;
  
  // Set modal title
  const titleEl = document.getElementById('shopping-modal-title');
  if (titleEl) titleEl.textContent = mode === 'edit' ? 'Edit Item' : 'New Shopping Item';
  
  // Populate form
  const qtySlider = document.getElementById('shop-quantity');
  const qtyVal = document.getElementById('shop-quantity-value');
  const prioSlider = document.getElementById('shop-priority');
  const prioVal = document.getElementById('shop-priority-value');
  const placeEl = document.getElementById('shop-place');
  const dateEl = document.getElementById('shop-date');
  const commentEl = document.getElementById('shop-comment');
  
  if (mode === 'edit' && item) {
    if (qtySlider) { qtySlider.value = item.quantity ?? 0; if (qtyVal) qtyVal.textContent = item.quantity ?? 0; }
    if (prioSlider) { prioSlider.value = item.priority ?? 5; if (prioVal) prioVal.textContent = item.priority ?? 5; }
    if (placeEl) placeEl.value = item.place ?? '';
    if (dateEl) dateEl.value = item.date_purchase ?? todayString();
    if (commentEl) commentEl.value = item.comment ?? '';
  } else {
    if (qtySlider) { qtySlider.value = 1; if (qtyVal) qtyVal.textContent = '1'; }
    if (prioSlider) { prioSlider.value = 5; if (prioVal) prioVal.textContent = '5'; }
    if (placeEl) placeEl.value = '';
    if (dateEl) dateEl.value = todayString();
    if (commentEl) commentEl.value = '';
  }
  
  // Show modal
  const modal = document.getElementById(MODAL_ID);
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  
  // Attach slider listeners
  attachSliderListeners();
}

export function closeShoppingModal() {
  hideModal(MODAL_ID);
  state.editingShoppingId = null;
  state.shoppingModalMode = 'add';
}

function attachSliderListeners() {
  const qtySlider = document.getElementById('shop-quantity');
  const qtyVal = document.getElementById('shop-quantity-value');
  const prioSlider = document.getElementById('shop-priority');
  const prioVal = document.getElementById('shop-priority-value');
  
  if (qtySlider && qtyVal) {
    qtySlider.oninput = () => { qtyVal.textContent = qtySlider.value; };
  }
  if (prioSlider && prioVal) {
    prioSlider.oninput = () => { prioVal.textContent = prioSlider.value; };
  }
}

export function getShoppingFormData() {
  const qty = parseInt(document.getElementById('shop-quantity')?.value) || 0;
  const prio = parseInt(document.getElementById('shop-priority')?.value) || 5;
  const place = document.getElementById('shop-place')?.value.trim() || '';
  const date = document.getElementById('shop-date')?.value || '';
  const comment = document.getElementById('shop-comment')?.value.trim() || '';
  
  if (!date) {
    alert('Please select a date');
    return null;
  }
  
  return { quantity: qty, priority: prio, place, date_purchase: date, comment };
}

export function initShoppingUI() {
  console.log('[shopping-ui] Initialized');
}