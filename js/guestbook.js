// js/guestbook.js
// MAIN ORCHESTRATOR FOR GUESTBOOK MODULE
// Ties together CRUD, rendering, and UI for the full multi-guestbook feature with infinite scroll support
// UPDATED: ensureUsername() called on loadGuestbook() so prompt fires on Chat tab open, not boot

import { state } from './state.js';
import { loadGuestbooksData } from './guestbook-crud.js';
import { renderGuestbookChips, renderGuestbookMessages, setupInfiniteScroll } from './guestbook-render.js';
import { initGuestbookUI, ensureUsername } from './guestbook-ui.js';

/**
 * Initialize the guestbook module (called once at boot).
 * Does NOT prompt for username here — that happens on first tab open.
 */
export function initGuestbook() {
  console.log('[guestbook.js] Initializing guestbook module...');
  initGuestbookUI();
  setupInfiniteScroll();
  console.log('[guestbook.js] Guestbook initialized');
}

/**
 * Load guestbooks and render the current one.
 * Called every time the Chat tab is switched to.
 * Prompts for username here so it appears on first tab open, not on boot.
 */
export async function loadGuestbook() {
  // Prompt for username the first time the tab is opened
  ensureUsername();

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
