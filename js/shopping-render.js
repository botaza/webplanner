// js/shopping-render.js
// RENDERING LOGIC FOR SHOPPING LIST
// UPDATED: Added wishlist tag display, fixed expand/collapse, fixed edit button onclick
// UPDATED: Added comment1 and comment2 display
// UPDATED: Added search/filter functionality
// UPDATED: Quantity display now supports decimal values (0.1, 0.25, 0.5, etc.)
import { state } from './state.js';
import { isGuest } from './lockscreen.js';
import { getPriorityGroups } from './shopping-crud.js';

// Format quantity for display (remove unnecessary decimals)
function formatQuantity(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return '0';
  // Show up to 2 decimal places, but trim trailing zeros
  return num.toFixed(2).replace(/\.00$/, '').replace(/\.0$/, '').replace(/\.(\d)0$/, '.$1');
}

export function renderShoppingList(list, containerId = 'shopping-list') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="text-center text-zinc-500 py-10">
        <div class="text-4xl mb-2">🛒</div>
        <div>No shopping items yet.</div>
        <div class="text-sm mt-2">Tap + to add your first item</div>
      </div>`;
    return;
  }

  const groups = getPriorityGroups(list);
  const priorityLabels = {
    10: '🔥 Critical', 9: '🔥 Critical', 8: '🔥 Critical',
    7: '⚡ High', 6: '⚡ High', 5: '📋 Normal', 4: '📋 Normal',
    3: '🌙 Low', 2: '🌙 Low', 1: '🌙 Low'
  };
  const priorityColors = {
    10: 'border-red-500', 9: 'border-red-500', 8: 'border-red-500',
    7: 'border-amber-500', 6: 'border-amber-500',
    5: 'border-emerald-500', 4: 'border-emerald-500',
    3: 'border-zinc-500', 2: 'border-zinc-500', 1: 'border-zinc-500'
  };

  // ✅ FIX: Only initialize Set once - do NOT auto-expand on every render
  if (!state.expandedShoppingPriority) {
    state.expandedShoppingPriority = new Set();
    // Auto-expand all on FIRST load only
    [1,2,3,4,5,6,7,8,9,10].forEach(p => state.expandedShoppingPriority.add(String(p)));
  }

  // Sort groups by priority DESCENDING (P10 at top, P1 at bottom)
  const sortedPriorities = Object.keys(groups).sort((a, b) => parseInt(b) - parseInt(a));

  const html = sortedPriorities.map((priority) => {
    const items = groups[priority];
    const pNum = parseInt(priority);
    const isOpen = state.expandedShoppingPriority.has(priority);
    const label = priorityLabels[pNum] || `Priority ${pNum}`;
    const color = priorityColors[pNum] || 'border-zinc-500';
    
    return `
      <div class="mb-4">
        <button onclick="window.toggleShoppingPriority('${priority}')"
          class="w-full flex items-center justify-between bg-zinc-900 rounded-2xl px-4 py-3 hover:bg-zinc-800 transition">
          <div class="flex items-center gap-3">
            <span class="text-emerald-500">${isOpen ? '📂' : '📁'}</span>
            <span class="font-medium text-zinc-200">${label}</span>
            <span class="text-xs text-zinc-500">(${items.length})</span>
          </div>
          <span class="text-sm font-bold ${color.replace('border','text')}">P${pNum}</span>
        </button>
        <div id="shopping-priority-${priority}" class="ml-2 mt-2 space-y-2 ${isOpen ? '' : 'hidden'}">
          ${items.map(item => renderShoppingItem(item, color)).join('')}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `<div class="pb-24">${html}</div>`;
}

function renderShoppingItem(item, borderColor) {
  const qty = formatQuantity(item.quantity ?? 0);
  const prio = item.priority ?? 5;
  const date = item.date_purchase ? new Date(item.date_purchase).toLocaleDateString('ru-RU') : '—';
  const isWishlist = !!item.is_wishlist;
  const comment1 = item.comment1 ?? '';
  const comment2 = item.comment2 ?? '';
  
  return `
    <div class="bg-zinc-900 rounded-2xl p-4 border-l-4 ${borderColor} card">
      <div class="flex justify-between items-start gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="text-xs text-zinc-500">#${item.id.slice(-4)}</span>
            <span class="text-xs bg-zinc-800 px-2 py-0.5 rounded-full">P${prio}</span>
            ${isWishlist ? `<span class="text-xs bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded-full">🎁 Wishlist</span>` : ''}
          </div>
          <div class="text-sm text-zinc-300 mb-2">
            <span class="font-medium">${qty}×</span>
            ${item.name ? `<span class="text-zinc-200 font-medium">${item.name}</span>` : '<span class="text-zinc-500 italic">No name</span>'}
            ${item.place ? `<span class="text-zinc-400"> @ ${item.place}</span>` : ''}
          </div>
          ${comment1 ? `<div class="text-xs text-zinc-500 mb-1">📝 ${comment1}</div>` : ''}
          ${comment2 ? `<div class="text-xs text-zinc-600 mb-1">ℹ️ ${comment2}</div>` : ''}
          <div class="text-xs text-zinc-600 mt-2">📅 ${date}</div>
        </div>
        <div class="flex flex-col items-end gap-2 shrink-0">
          ${!isGuest() ? `
            <button onclick="window.editShoppingItem('${item.id}'); event.stopPropagation()"
              class="text-zinc-400 hover:text-white text-lg transition px-1 touch-manipulation min-w-[32px] min-h-[32px]"
              title="Edit">✏️</button>
            <button onclick="window.deleteShoppingItem('${item.id}'); event.stopPropagation()"
              class="text-red-400 hover:text-red-300 text-lg transition px-1 touch-manipulation min-w-[32px] min-h-[32px]"
              title="Delete">🗑</button>
          ` : `
            <button onclick="window.editShoppingItem('${item.id}'); event.stopPropagation()"
              class="text-zinc-400 hover:text-white text-lg transition px-1 touch-manipulation min-w-[32px] min-h-[32px]"
              title="Edit">✏️</button>
          `}
        </div>
      </div>
    </div>
  `;
}

// ── EXPAND/COLLAPSE FUNCTIONS ──
export function toggleShoppingPriority(priority) {
  if (!state.expandedShoppingPriority) state.expandedShoppingPriority = new Set();
  if (state.expandedShoppingPriority.has(priority)) {
    state.expandedShoppingPriority.delete(priority);
  } else {
    state.expandedShoppingPriority.add(priority);
  }
  // Re-render immediately
  if (window.refreshShoppingList) {
    window.refreshShoppingList();
  }
}

export function expandAllPriorities() {
  if (!state.expandedShoppingPriority) state.expandedShoppingPriority = new Set();
  [1,2,3,4,5,6,7,8,9,10].forEach(p => state.expandedShoppingPriority.add(String(p)));
  if (window.refreshShoppingList) {
    window.refreshShoppingList();
  }
}

export function collapseAllPriorities() {
  if (!state.expandedShoppingPriority) state.expandedShoppingPriority = new Set();
  state.expandedShoppingPriority.clear();
  if (window.refreshShoppingList) {
    window.refreshShoppingList();
  }
}

// ── SEARCH/FILTER FUNCTIONALITY ──
export function filterShoppingList() {
  const searchTerm = document.getElementById('shop-search')?.value.toLowerCase().trim() || '';
  const countEl = document.getElementById('shop-search-count');
  
  if (!searchTerm) {
    // Show all items
    renderShoppingList(state.shoppingData);
    if (countEl) countEl.classList.add('hidden');
    return;
  }
  
  // Filter items by name, place, comment1, comment2
  const filtered = state.shoppingData.filter(item => {
    const name = (item.name || '').toLowerCase();
    const place = (item.place || '').toLowerCase();
    const comment1 = (item.comment1 || '').toLowerCase();
    const comment2 = (item.comment2 || '').toLowerCase();
    
    return name.includes(searchTerm) || 
           place.includes(searchTerm) || 
           comment1.includes(searchTerm) || 
           comment2.includes(searchTerm);
  });
  
  // Show count
  if (countEl) {
    countEl.textContent = `Found ${filtered.length} of ${state.shoppingData.length} items`;
    countEl.classList.remove('hidden');
  }
  
  // Render filtered list
  renderShoppingList(filtered);
}

// ── EXPOSE TO WINDOW FOR HTML onclick HANDLERS ──
Object.assign(window, {
  toggleShoppingPriority,
  expandAllPriorities,
  collapseAllPriorities,
  filterShoppingList  // NEW: Expose filter function
});