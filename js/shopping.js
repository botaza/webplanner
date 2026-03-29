// js/shopping.js
// ORCHESTRATOR FOR SHOPPING MODULE
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
  collapseAllPriorities
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

export async function handleSaveShopping() {
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

export async function handleDeleteShopping(id) {
  if (!requireAdmin()) return; // Guests cannot delete
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

// Global exposure
Object.assign(window, {
  showAddShoppingItem,
  editShoppingItem,
  saveShoppingItem: handleSaveShopping,
  deleteShoppingItem: handleDeleteShopping,
  loadShopping,
  closeShoppingModal,
  toggleShoppingPriority,
  expandAllShoppingPriorities: expandAllPriorities,
  collapseAllShoppingPriorities: collapseAllPriorities,
  refreshShoppingList: loadShopping
});