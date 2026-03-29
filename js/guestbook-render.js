// js/guestbook-render.js
// RENDERING LOGIC FOR GUESTBOOK MODULE
// Handles multi-guestbook chips, infinite scroll chat display, and date grouping

import { state } from './state.js';

let currentPage = 1;
const MESSAGES_PER_PAGE = 30;

/**
 * Render the top chips for switching between guestbooks
 */
export function renderGuestbookChips() {
  const container = document.getElementById('guestbook-chips');
  if (!container) return;

  let html = '';

  Object.keys(state.guestbooksData).forEach(key => {
    const isActive = key === state.currentGuestbookKey;
    const displayName = key === 'general' ? 'General' : 
                       key.charAt(0).toUpperCase() + key.slice(1);
    
    html += `
      <div class="guestbook-chip ${isActive ? 'active' : ''}" 
           onclick="window.switchGuestbook('${key}')">
        ${displayName}
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
    const msgDate = new Date(msg.dt).toISOString().split('T')[0];
    
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      const dateLabel = getDateLabel(msg.dt);
      html += `
        <div class="text-xs text-zinc-500 text-center my-6 font-medium">
          ${dateLabel}
        </div>`;
    }

    const isMine = msg.username === state.guestbookUsername;
    
    html += `
      <div class="message ${isMine ? 'mine' : ''}">
        <div class="bubble">
          ${msg.emoji ? `<span class="mr-2">${msg.emoji}</span>` : ''}
          ${msg.text}
        </div>
        <div class="meta">
          <span>${msg.username}</span>
          <span>${formatTime(msg.dt)}</span>
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
 * Simple helper to format relative date labels
 */
function getDateLabel(dt) {
  const date = new Date(dt);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateStr = date.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatTime(dt) {
  const date = new Date(dt);
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