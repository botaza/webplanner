// js/guestbook-crud.js
// GUESTBOOK CRUD OPERATIONS
// Handles all API calls for the multi-guestbook module

import { api } from './api.js';
import { state } from './state.js';

/**
 * Load all guestbooks from the server
 */
export async function loadGuestbooksData() {
  try {
    const data = await api('get_guestbooks');
    state.guestbooksData = data || { general: [] };
    return state.guestbooksData;
  } catch (err) {
    console.error('[guestbook-crud] Failed to load guestbooks:', err);
    state.guestbooksData = { general: [] };
    return state.guestbooksData;
  }
}

/**
 * Add a new message to the current guestbook
 */
export async function addGuestbookMessage(text, emoji = '') {
  try {
    const payload = {
      book: state.currentGuestbookKey,
      username: state.guestbookUsername,
      text: text.trim(),
      emoji: emoji
    };

    const res = await api('add_guestbook_message', payload);
    return res.success === true;
  } catch (err) {
    console.error('[guestbook-crud] Failed to add message:', err);
    return false;
  }
}

/**
 * Create a new guestbook
 */
export async function createGuestbook(name) {
  try {
    const res = await api('create_guestbook', { name });
    if (res.success) {
      // Reload all guestbooks after creation
      await loadGuestbooksData();
      // Switch to the new book
      state.currentGuestbookKey = res.key;
      return true;
    }
    return false;
  } catch (err) {
    console.error('[guestbook-crud] Failed to create guestbook:', err);
    return false;
  }
}

/**
 * Delete a message (only for admin)
 */
export async function deleteGuestbookMessage(id) {
  try {
    const res = await api('delete_guestbook_message', {
      book: state.currentGuestbookKey,
      id: id
    });
    return res.success === true;
  } catch (err) {
    console.error('[guestbook-crud] Failed to delete message:', err);
    return false;
  }
}