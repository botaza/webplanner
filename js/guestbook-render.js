// js/guestbook-render.js
// RENDERING LOGIC FOR GUESTBOOK MODULE
// Handles multi-guestbook chips, infinite scroll chat display, and date grouping
// UPDATED: Times parsed as UTC+10 local (api.php now saves with Asia/Vladivostok set)
// UPDATED: Delete message button available in all books including general (admin only)

import { state } from './state.js';
import { isGuest } from './lockscreen.js';

let currentPage = 1;
const MESSAGES_PER_PAGE = 30;

/**
 * Parse a stored datetime string as UTC+10 local time.
 * api.php saves with date_default_timezone_set('Asia/Vladivostok'),
 * so 'YYYY-MM-DD HH:MM:SS' is already UTC+10 — no offset adjustment needed.
 * We just normalize the separator so all JS engines parse it correctly.
 */
function parseStoredDt(dt) {
  return new Date(dt.includes('T') ? dt : dt.replace(' ', 'T'));
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
  const sorted = [...data].sort((a, b) => parseStoredDt(b.dt) - parseStoredDt(a.dt));

  let html = '';
  let currentDate = '';

  sorted.forEach(msg => {
    const msgDate = parseStoredDt(msg.dt).toLocaleDateString('en-CA'); // YYYY-MM-DD

    if (msgDate !== currentDate) {
      currentDate = msgDate;
      const dateLabel = getDateLabel(msg.dt);
      html += `
        <div class="text-xs text-zinc-500 text-center my-6 font-medium">
          ${dateLabel}
        </div>`;
    }

    const isMine = msg.username === state.guestbookUsername;
    // Admins can delete messages in any book, including general
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
 * Format relative date label using the stored UTC+10 time directly
 */
function getDateLabel(dt) {
  const date = parseStoredDt(dt);
  const today = new Date();

  const dateStr      = date.toLocaleDateString('en-CA');
  const todayStr     = today.toLocaleDateString('en-CA');
  const yesterday    = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA');

  if (dateStr === todayStr)     return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';

  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/**
 * Format message time from stored UTC+10 value
 */
function formatTime(dt) {
  return parseStoredDt(dt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Infinite scroll handler (load older messages when scrolling up)
 */
export function setupInfiniteScroll() {
  const container = document.getElementById('guestbook-chat-container');
  if (!container) return;

  container.addEventListener('scroll', () => {
    if (container.scrollTop < 100) {
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
