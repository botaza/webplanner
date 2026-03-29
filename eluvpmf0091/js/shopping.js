// js/shopping.js
// ORCHESTRATOR FOR SHOPPING MODULE
// UPDATED: Guests CAN create and edit shopping items, but CANNOT delete
// UPDATED: Supports is_wishlist field, optional date_purchase, comment1, and comment2 fields
// UPDATED: Quantity uses step="1" for slider, quick buttons for decimals (0.1, 0.25, 0.5, 0.75)
// UPDATED: Added filterShoppingList to global exposure for search bar
import { requireAdmin } from './readonly-guard.js';
import { state } from './state.js';
import { loadDashboard } from './dashboard.js';
import {
  initShoppingUI,
  showShoppingModal,
  closeShoppingModal,
  getShoppingFormData
} from './shopping-ui.js';
import {
  loadShoppingData,
  saveShoppingData,
  updateShoppingData,
  deleteShoppingData
} from './shopping-crud.js';
import {
  renderShoppingList,
  toggleShoppingPriority,
  expandAllPriorities,
  collapseAllPriorities,
  filterShoppingList
} from './shopping-render.js';

let _editingId = null;

export function initShopping() {
  console.log('[shopping.js] Initializing...');
  initShoppingUI();
  console.log('[shopping.js] Initialized');
}

export async function loadShopping() {
  try {
    const data = await loadShoppingData();
    state.shoppingData = data || [];
    renderShoppingList(state.shoppingData);
  } catch (err) {
    console.error('[shopping.js] Failed to load:', err);
    const container = document.getElementById('shopping-list');
    if (container) {
      container.innerHTML = `<div class="text-red-400 text-center py-10">Failed to load shopping list</div>`;
    }
  }
}

export function showAddShoppingItem() {
  _editingId = null;
  showShoppingModal('add');
}

export function editShoppingItem(id) {
  const item = (state.shoppingData || []).find(i => String(i.id) === String(id));
  if (!item) { console.error('Item not found', id); return; }
  _editingId = id;
  showShoppingModal('edit', item);
}

// ── SAVE / UPDATE ──
// UPDATED: Guests CAN save shopping items (create and edit)
export async function handleSaveShopping() {
  // REMOVED: requireAdmin() check - guests can now save shopping items
  const formData = getShoppingFormData();
  if (!formData) return;
  
  try {
    let res;
    if (_editingId) {
      res = await updateShoppingData(_editingId, formData);
    } else {
      res = await saveShoppingData(formData);
    }
    if (res?.success) {
      closeShoppingModal();
      await loadShopping();
      await loadDashboard();
    } else {
      alert('Could not save' + (res?.error ? `: ${res.error}` : ''));
    }
  } catch (err) {
    console.error('[shopping.js] Save error:', err);
    alert('Network error while saving');
  }
}

// ── DELETE ──
// KEPT: Guests CANNOT delete shopping items
export async function handleDeleteShopping(id) {
  if (!requireAdmin()) return; // Guests blocked from deleting
  if (!confirm('Delete this shopping item?')) return;
  try {
    await deleteShoppingData(id);
    await loadShopping();
    await loadDashboard();
  } catch (err) {
    console.error('[shopping.js] Delete error:', err);
    alert('Failed to delete');
  }
}

// ── EXPAND/COLLAPSE WRAPPERS ──
export function handleExpandAllPriorities() {
  if (!state.expandedShoppingPriority) state.expandedShoppingPriority = new Set();
  [1,2,3,4,5,6,7,8,9,10].forEach(p => state.expandedShoppingPriority.add(String(p)));
  renderShoppingList(state.shoppingData);
}

export function handleCollapseAllPriorities() {
  if (!state.expandedShoppingPriority) state.expandedShoppingPriority = new Set();
  state.expandedShoppingPriority.clear();
  renderShoppingList(state.shoppingData);
}

export function handleTogglePriority(priority) {
  if (!state.expandedShoppingPriority) state.expandedShoppingPriority = new Set();
  if (state.expandedShoppingPriority.has(priority)) {
    state.expandedShoppingPriority.delete(priority);
  } else {
    state.expandedShoppingPriority.add(priority);
  }
  renderShoppingList(state.shoppingData);
}

// ── GLOBAL EXPOSURE ──
Object.assign(window, {
  showAddShoppingItem,
  editShoppingItem,
  saveShoppingItem: handleSaveShopping,
  deleteShoppingItem: handleDeleteShopping,
  loadShopping,
  closeShoppingModal,
  toggleShoppingPriority: handleTogglePriority,
  expandAllShoppingPriorities: handleExpandAllPriorities,
  collapseAllShoppingPriorities: handleCollapseAllPriorities,
  refreshShoppingList: loadShopping,
  filterShoppingList  // NEW: Expose filter function for search bar
});