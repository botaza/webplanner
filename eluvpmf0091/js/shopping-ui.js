// js/shopping-ui.js
// UI HELPERS FOR SHOPPING MODULE
// UPDATED: Added wishlist checkbox, optional date field, and two separate comment fields
// UPDATED: Quantity slider uses step="1" for integers, quick buttons for decimals (0.1, 0.25, 0.5, 0.75)
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
  
  // Populate form fields
  const nameEl = document.getElementById('shop-name');
  const qtySlider = document.getElementById('shop-quantity');
  const qtyVal = document.getElementById('shop-quantity-value');
  const prioSlider = document.getElementById('shop-priority');
  const prioVal = document.getElementById('shop-priority-value');
  const wishlistCheckbox = document.getElementById('shop-wishlist');
  const hasDateCheckbox = document.getElementById('shop-has-date');
  const dateContainer = document.getElementById('shop-date-container');
  const dateEl = document.getElementById('shop-date');
  const placeEl = document.getElementById('shop-place');
  const comment1El = document.getElementById('shop-comment1');
  const comment2El = document.getElementById('shop-comment2');
  
  if (mode === 'edit' && item) {
    if (nameEl) nameEl.value = item.name ?? '';
    if (qtySlider) { 
      qtySlider.value = item.quantity ?? 0; 
      if (qtyVal) qtyVal.textContent = formatQuantity(item.quantity ?? 0); 
    }
    if (prioSlider) { prioSlider.value = item.priority ?? 5; if (prioVal) prioVal.textContent = item.priority ?? 5; }
    if (wishlistCheckbox) wishlistCheckbox.checked = !!item.is_wishlist;
    if (hasDateCheckbox) {
      hasDateCheckbox.checked = !!(item.date_purchase && item.date_purchase !== '');
      if (hasDateCheckbox.checked) {
        if (dateContainer) dateContainer.classList.remove('hidden');
        if (dateEl) dateEl.value = item.date_purchase ?? todayString();
      } else {
        if (dateContainer) dateContainer.classList.add('hidden');
        if (dateEl) dateEl.value = '';
      }
    }
    if (placeEl) placeEl.value = item.place ?? '';
    if (comment1El) comment1El.value = item.comment1 ?? '';
    if (comment2El) comment2El.value = item.comment2 ?? '';
  } else {
    if (nameEl) nameEl.value = '';
    if (qtySlider) { 
      qtySlider.value = 1; 
      if (qtyVal) qtyVal.textContent = '1'; 
    }
    if (prioSlider) { prioSlider.value = 5; if (prioVal) prioVal.textContent = '5'; }
    if (wishlistCheckbox) wishlistCheckbox.checked = false;
    if (hasDateCheckbox) {
      hasDateCheckbox.checked = false;
      if (dateContainer) dateContainer.classList.add('hidden');
      if (dateEl) dateEl.value = '';
    }
    if (placeEl) placeEl.value = '';
    if (comment1El) comment1El.value = '';
    if (comment2El) comment2El.value = '';
  }
  
  // Show modal
  const modal = document.getElementById(MODAL_ID);
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  
  // Attach slider listeners
  attachSliderListeners();
  
  // Focus name field for quick entry
  if (nameEl && mode === 'add') {
    setTimeout(() => nameEl.focus(), 100);
  }
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
    qtySlider.oninput = () => { 
      qtyVal.textContent = formatQuantity(qtySlider.value); 
    };
  }
  if (prioSlider && prioVal) {
    prioSlider.oninput = () => { prioVal.textContent = prioSlider.value; };
  }
}

// Format quantity for display (remove unnecessary decimals)
function formatQuantity(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return '0';
  // Show up to 2 decimal places, but trim trailing zeros
  return num.toFixed(2).replace(/\.00$/, '').replace(/\.0$/, '').replace(/\.(\d)0$/, '.$1');
}

export function getShoppingFormData() {
  const name = document.getElementById('shop-name')?.value.trim() || '';
  const qty = parseFloat(document.getElementById('shop-quantity')?.value) || 0;
  const prio = parseInt(document.getElementById('shop-priority')?.value) || 5;
  const isWishlist = document.getElementById('shop-wishlist')?.checked || false;
  const hasDate = document.getElementById('shop-has-date')?.checked || false;
  const date = hasDate ? (document.getElementById('shop-date')?.value || '') : '';
  const place = document.getElementById('shop-place')?.value.trim() || '';
  const comment1 = document.getElementById('shop-comment1')?.value.trim() || '';
  const comment2 = document.getElementById('shop-comment2')?.value.trim() || '';
  
  // Name is required
  if (!name) {
    alert('Please enter an item name');
    return null;
  }
  
  // If hasDate is checked, date is required
  if (hasDate && !date) {
    alert('Please select a date');
    return null;
  }
  
  return { 
    name, 
    quantity: qty, 
    priority: prio, 
    is_wishlist: isWishlist,
    date_purchase: date, 
    place, 
    comment1,
    comment2
  };
}

export function initShoppingUI() {
  console.log('[shopping-ui] Initialized');
}