// js/guestbook-ui.js
// UI HELPERS FOR GUESTBOOK MODULE
// Handles username prompt, emoji picker, modal interactions, and input handling

import { state } from './state.js';
import { hideModal } from './utils.js';
import { addGuestbookMessage, createGuestbook } from './guestbook-crud.js';
import { renderGuestbookChips, renderGuestbookMessages } from './guestbook-render.js';

const EMOJI_LIST = ['👍', '❤️', '😂', '🎉', '😮', '🙏', '🔥', '👏', '😢', '😍', '🚀', '🍀'];

/**
 * Show username setup if not set
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
    // Reload and render
    await loadGuestbook();   // This will be defined in guestbook.js
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
 * Switch to another guestbook
 */
export function switchGuestbook(key) {
  state.currentGuestbookKey = key;
  renderGuestbookChips();
  renderGuestbookMessages();
}

/**
 * Initialize UI elements for guestbook
 */
export function initGuestbookUI() {
  ensureUsername();
  renderEmojiPicker();

  // Show emoji picker when input is focused
  const input = document.getElementById('guestbook-input');
  const picker = document.getElementById('guestbook-emoji-picker');
  
  if (input && picker) {
    input.addEventListener('focus', () => {
      picker.classList.remove('hidden');
    });
    
    // Hide picker when clicking outside (simple version)
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
  switchGuestbook,
  insertEmoji,
  initGuestbookUI
});