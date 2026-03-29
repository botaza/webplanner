// js/guestbook.js
// MAIN ORCHESTRATOR FOR GUESTBOOK MODULE
// Ties together CRUD, rendering, and UI for the full multi-guestbook feature with infinite scroll support

import { state } from './state.js';
import { loadGuestbooksData } from './guestbook-crud.js';
import { renderGuestbookChips, renderGuestbookMessages, setupInfiniteScroll } from './guestbook-render.js';
import { initGuestbookUI } from './guestbook-ui.js';

/**
 * Initialize the guestbook module
 */
export function initGuestbook() {
  console.log('[guestbook.js] Initializing guestbook module...');
  initGuestbookUI();
  setupInfiniteScroll();
  console.log('[guestbook.js] Guestbook initialized');
}

/**
 * Load guestbooks and render the current one
 */
export async function loadGuestbook() {
  try {
    await loadGuestbooksData();
    
    // Render chips and current messages
    renderGuestbookChips();
    renderGuestbookMessages();
    
    console.log(`[guestbook.js] Loaded guestbook: ${state.currentGuestbookKey}`);
  } catch (err) {
    console.error('[guestbook.js] Failed to load guestbook:', err);
    const container = document.getElementById('guestbook-chat-container');
    if (container) {
      container.innerHTML = `<div class="text-red-400 text-center py-12">Failed to load guestbook</div>`;
    }
  }
}

// Expose main functions to window for HTML onclick handlers
Object.assign(window, {
  loadGuestbook,
  initGuestbook
});