// js/guestbook-render.js
// RENDERING LOGIC FOR GUESTBOOK MODULE
// Handles multi-guestbook chips, infinite scroll chat display, and date grouping
// UPDATED: UTC+10 time display; delete-guestbook button on non-general chips (admin only)

import { state } from './state.js';
import { isGuest } from './lockscreen.js';

let currentPage = 1;
const MESSAGES_PER_PAGE = 30;

const UTC_OFFSET_MS = 10 * 60 * 60 * 1000;

/**
 * Convert a stored UTC datetime string to a UTC+10 Date object
 */
function toUTC10(dt) {
  // dt stored as 'YYYY-MM-DD HH:MM:SS' (server local) or ISO string
  const base = new Date(dt.includes('T') ? dt : dt.replace(' ', 'T') + 'Z');
  return new Date(base.getTime() + UTC_OFFSET_MS);
}

/**
 * Render the top chips for switching between guestbooks.
 * Non-general chips get a small × delete button for admins.
 */
export function renderGuestbookChips() {
  const container = document.getElementById('guestbook-chips');
  if (!container) return;

  let html = '';

  Object.keys(state.guestbooksData).forEach(key => {
    const isActive = key === state.currentGuestbookKey;
    const displayName = key === 'general' ? 'General' :
                       key.charAt(0).toUpperCase() + key.slice(1);
    const canDelete = !isGuest() && key !== 'general';

    html += `
      <div class="guestbook-chip ${isActive ? 'active' : ''} flex items-center gap-1"
           style="display:inline-flex">
        <span onclick="window.switchGuestbook('${key}')" style="cursor:pointer">${displayName}</span>
        ${canDelete ? `<span onclick="window.deleteCurrentGuestbook('${key}')"
              style="cursor:pointer;opacity:0.6;font-size:0.75rem;line-height:1;padding-left:2px"
              title="Delete this guestbook">×</span>` : ''}
      </div>`;
  });

  // Add "New" button as a chip
  html += `
    <div class="guestbook-chip" onclick="window.createNewGuestbook()">
      + New
    </div>`;

  container.innerHTML = html;
}

/**
 * Render messages with date grouping (newest on top)
 */
export function renderGuestbookMessages(messages = null) {
  const container = document.getElementById('guestbook-chat-container');
  if (!container) return;

  const data = messages || state.guestbooksData[state.currentGuestbookKey] || [];

  // Sort newest first
  const sorted = [...data].sort((a, b) => new Date(b.dt) - new Date(a.dt));

  let html = '';
  let currentDate = '';

  sorted.forEach(msg => {
    const msgDate = toUTC10(msg.dt).toISOString().split('T')[0];

    if (msgDate !== currentDate) {
      currentDate = msgDate;
      const dateLabel = getDateLabel(msg.dt);
      html += `
        <div class="text-xs text-zinc-500 text-center my-6 font-medium">
          ${dateLabel}
        </div>`;
    }

    const isMine = msg.username === state.guestbookUsername;
    const canDelete = !isGuest();

    html += `
      <div class="message ${isMine ? 'mine' : ''}">
        <div class="bubble">
          ${msg.emoji ? `<span class="mr-2">${msg.emoji}</span>` : ''}
          ${msg.text}
        </div>
        <div class="meta">
          <span>${msg.username}</span>
          <span>${formatTime(msg.dt)}</span>
          ${canDelete ? `<span onclick="window.deleteMessage('${msg.id}')"
                style="cursor:pointer;opacity:0.5;margin-left:4px" title="Delete message">🗑</span>` : ''}
        </div>
      </div>`;
  });

  if (sorted.length === 0) {
    html = `<div class="text-center text-zinc-500 py-12">No messages yet.<br>Be the first to write something!</div>`;
  }

  container.innerHTML = html;

  // Scroll to bottom (newest messages)
  container.scrollTop = container.scrollHeight;
}

/**
 * Simple helper to format relative date labels using UTC+10
 */
function getDateLabel(dt) {
  const date = toUTC10(dt);
  const nowLocal = new Date(Date.now() + UTC_OFFSET_MS);

  const dateStr      = date.toISOString().split('T')[0];
  const todayStr     = nowLocal.toISOString().split('T')[0];
  const yesterday    = new Date(nowLocal.getTime() - 86400000);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (dateStr === todayStr)     return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';

  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/**
 * Format message time as UTC+10
 */
function formatTime(dt) {
  const date = toUTC10(dt);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Infinite scroll handler (load older messages when scrolling up)
 */
export function setupInfiniteScroll() {
  const container = document.getElementById('guestbook-chat-container');
  if (!container) return;

  container.addEventListener('scroll', () => {
    if (container.scrollTop < 100) {
      // Load more logic can be added later (for now we load all messages)
      console.log('[guestbook] Reached top — infinite scroll ready for future pagination');
    }
  });
}

// Expose functions to window for inline onclick handlers
Object.assign(window, {
  renderGuestbookChips,
  renderGuestbookMessages,
  setupInfiniteScroll
});
