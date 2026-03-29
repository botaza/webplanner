// js/shopping-crud.js
// CRUD OPERATIONS FOR SHOPPING LIST
import { api } from './api.js';
import { state } from './state.js';

export async function loadShoppingData() {
  try {
    const data = await api('get_shopping');
    return data || [];
  } catch (err) {
    console.error('[shopping-crud] Failed to load shopping:', err);
    throw err;
  }
}

export async function saveShoppingData(item) {
  try {
    const res = await api('add_shopping', item);
    return res;
  } catch (err) {
    console.error('[shopping-crud] Failed to save shopping item:', err);
    throw err;
  }
}

export async function updateShoppingData(id, item) {
  try {
    const res = await api('update_shopping', { id, ...item });
    return res;
  } catch (err) {
    console.error('[shopping-crud] Failed to update shopping item:', err);
    throw err;
  }
}

export async function deleteShoppingData(id) {
  try {
    const res = await api('delete_shopping', { id });
    return res;
  } catch (err) {
    console.error('[shopping-crud] Failed to delete shopping item:', err);
    throw err;
  }
}

export function getShoppingByPriority(data, priority) {
  return (data || []).filter(item => (item.priority ?? 5) === priority);
}

export function getPriorityGroups(data) {
  const groups = {};
  (data || []).forEach(item => {
    const p = item.priority ?? 5;
    if (!groups[p]) groups[p] = [];
    groups[p].push(item);
  });
  // Return sorted by priority desc
  return Object.keys(groups).sort((a, b) => b - a).reduce((acc, key) => {
    acc[key] = groups[key];
    return acc;
  }, {});
}