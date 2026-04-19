// js/guestbook-ui.js
// UI HELPERS FOR GUESTBOOK MODULE
// Handles username prompt, emoji picker, modal interactions, and input handling
// UPDATED: Username prompt fires when Chat tab is opened (not on first boot)
// UPDATED: deleteCurrentGuestbook() added for chip × button
// PATCHED: switchGuestbook now calls updateTokenActiveBook to track active tab per device

import { state } from './state.js';
import { hideModal } from './utils.js';
import { addGuestbookMessage, createGuestbook, deleteGuestbook } from './guestbook-crud.js';
import { renderGuestbookChips, renderGuestbookMessages } from './guestbook-render.js';
import { api } from './api.js';
import { updateTokenActiveBook } from './fcm-client.js';

const EMOJI_LIST = ['👍', '❤️', '😂', '🎉', '😮', '🙏', '🔥', '👏', '😢', '😍', '🚀', '🍀'];

/**
 * Prompt for a username if one is not yet set.
 * Called lazily when the Chat tab is opened — NOT during app boot.
 */
export function ensureUsername() {
  if (!state.guestbookUsername || state.guestbookUsername === 'Guest') {
    const name = prompt('Choose your display name for the guestbook:', 'Artem');
    if (name && name.trim()) {
      state.guestbookUsername = name.trim();
      localStorage.setItem('guestbook_username', state.guestbookUsername);
    }
  }
}

/**
 * Render emoji picker
 */
export function renderEmojiPicker() {
  const container = document.getElementById('guestbook-emoji-picker');
  if (!container) return;

  let html = '';
  EMOJI_LIST.forEach(emoji => {
    html += `<div class="emoji-btn" onclick="window.insertEmoji('${emoji}')">${emoji}</div>`;
  });
  container.innerHTML = html;
}

/**
 * Insert emoji into input field
 */
export function insertEmoji(emoji) {
  const input = document.getElementById('guestbook-input');
  if (input) {
    input.value += emoji + ' ';
    input.focus();
  }
}

/**
 * Send message from input
 */
export async function sendGuestbookMessage() {
  const input = document.getElementById('guestbook-input');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  ensureUsername();

  const success = await addGuestbookMessage(text);
  if (success) {
    input.value = '';
    await loadGuestbook();
  } else {
    alert('Failed to send message. Please try again.');
  }
}

/**
 * Show prompt to create a new guestbook
 */
export async function createNewGuestbook() {
  const name = prompt('Enter new guestbook name (e.g. Family, Work, Trip):');
  if (!name || !name.trim()) return;

  const success = await createGuestbook(name.trim());
  if (success) {
    renderGuestbookChips();
    renderGuestbookMessages();
  } else {
    alert('Failed to create guestbook. Name may already exist.');
  }
}

/**
 * Delete the currently active guestbook (admin only; 'general' is protected).
 * @param {string} key - The guestbook key to delete
 */
export async function deleteCurrentGuestbook(key) {
  if (key === 'general') {
    alert('The General guestbook cannot be deleted.');
    return;
  }
  if (!confirm(`Delete the "${key}" guestbook and all its messages? This cannot be undone.`)) return;

  const success = await deleteGuestbook(key);
  if (success) {
    renderGuestbookChips();
    renderGuestbookMessages();
  } else {
    alert('Failed to delete guestbook.');
  }
}

/**
 * Delete a single message (admin only)
 * @param {string} id - Message ID
 */
export async function deleteMessage(id) {
  if (!confirm('Delete this message?')) return;
  const { deleteGuestbookMessage } = await import('./guestbook-crud.js');
  const success = await deleteGuestbookMessage(id);
  if (success) {
    await loadGuestbook();
  } else {
    alert('Failed to delete message.');
  }
}

/**
 * Clear all messages from the current guestbook (admin only).
 * The book itself is kept — only its messages are wiped.
 */
export async function clearGuestbook() {
  const key = state.currentGuestbookKey;
  const label = key === 'general' ? 'General' : key.charAt(0).toUpperCase() + key.slice(1);
  if (!confirm(`Clear ALL messages from "${label}"? This cannot be undone.`)) return;

  const res = await api('clear_guestbook', { book: key });
  if (res && res.success) {
    await loadGuestbook();
  } else {
    alert('Failed to clear chat.');
  }
}

/**
 * Switch to another guestbook tab.
 * ✅ PATCH: Also updates the server so this device only receives
 * push notifications for the book it's currently viewing.
 */
export function switchGuestbook(key) {
  if (key === state.currentGuestbookKey) return;
  state.currentGuestbookKey = key;
  updateTokenActiveBook(key);
  renderGuestbookChips();
  renderGuestbookMessages();
}

/**
 * Initialize UI elements for guestbook.
 * NOTE: ensureUsername() is intentionally NOT called here —
 * it fires in loadGuestbook() so the prompt appears when the
 * Chat tab is first opened, not during app boot.
 */
export function initGuestbookUI() {
  renderEmojiPicker();

  const input = document.getElementById('guestbook-input');
  const picker = document.getElementById('guestbook-emoji-picker');

  if (input && picker) {
    input.addEventListener('focus', () => {
      picker.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !picker.contains(e.target)) {
        picker.classList.add('hidden');
      }
    });
  }

  console.log('[guestbook-ui] UI initialized');
}

// Expose functions to window for onclick handlers in HTML
Object.assign(window, {
  sendGuestbookMessage,
  createNewGuestbook,
  deleteCurrentGuestbook,
  clearGuestbook,
  deleteMessage,
  switchGuestbook,
  insertEmoji,
  initGuestbookUI
});
