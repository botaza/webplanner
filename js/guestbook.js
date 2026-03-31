// js/guestbook.js
// GUESTBOOK MODULE ORCHESTRATOR
// Username prompt only on first send + token association updated
// FIXED: updateTokenWithUsername no longer overwrites chatOnly preference
import { state } from './state.js';
import { api } from './api.js';
import {
renderGuestbookMessages,
appendGuestbookMessage,
scrollGuestbookToBottom
} from './guestbook-render.js';

function ensureUsername() {
if (state.guestbookUsername && state.guestbookUsername !== 'Guest') {
return state.guestbookUsername;
}
let username = localStorage.getItem('guestbook_username');
if (!username || username === 'Guest' || username.trim() === '') {
username = prompt('What is your name for the guestbook chat?', 'Guest');
if (!username || username.trim() === '') {
username = 'Guest';
} else {
username = username.trim();
}
localStorage.setItem('guestbook_username', username);
state.guestbookUsername = username;
// Update token with username (critical for chat-only + sender skip)
updateTokenWithUsername(username);
} else {
state.guestbookUsername = username;
}
return username;
}

async function updateTokenWithUsername(username) {
const token = localStorage.getItem('fcm_registered_token');
if (!token) return;
try {
const form = new FormData();
form.append('action', 'update_token_prefs');
form.append('token', token);
form.append('username', username);
// ✅ FIX: Do NOT send prefs here. Let backend preserve existing prefs.
// Previously this sent { chatOnly: false } which reset the preference on every username update.
await fetch('php/api.php', { method: 'POST', body: form });
console.log('[guestbook] Token username updated to:', username);
} catch (err) {
console.warn('[guestbook] Failed to update token username:', err);
}
}

export async function loadGuestbook(specificBookKey = null) {
if (specificBookKey) {
state.currentGuestbookKey = specificBookKey;
}
try {
const data = await api('get_guestbooks');
state.guestbooksData = data || { general: [] };
renderGuestbookChips();
const currentMessages = state.guestbooksData[state.currentGuestbookKey] || [];
renderGuestbookMessages(currentMessages);
setTimeout(scrollGuestbookToBottom, 150);
} catch (err) {
console.error('[guestbook.js] Failed to load:', err);
const container = document.getElementById('guestbook-chat-container');
if (container) container.innerHTML = `<div class="text-red-400 text-center py-10">Failed to load messages</div>`;
}
}

export function renderGuestbookChips() {
const container = document.getElementById('guestbook-chips');
if (!container) return;
let html = '';
Object.keys(state.guestbooksData).forEach(key => {
const isActive = key === state.currentGuestbookKey;
const displayName = key === 'general' ? 'General' : key.charAt(0).toUpperCase() + key.slice(1);
html += `
<div onclick="switchGuestbook('${key}')"
class="guestbook-chip ${isActive ? 'active' : ''}">
${displayName}
</div>`;
});
container.innerHTML = html;
}

export async function sendGuestbookMessage() {
const input = document.getElementById('guestbook-input');
if (!input || !input.value.trim()) return;
const text = input.value.trim();
const username = ensureUsername();   // prompt only on first send
const optimisticMsg = {
id: 'temp-' + Date.now(),
username: username,
text: text,
emoji: '',
dt: new Date().toISOString().replace('T', ' ').slice(0, 19)
};
appendGuestbookMessage(optimisticMsg);
input.value = '';
try {
await api('add_guestbook_message', {
book: state.currentGuestbookKey,
username: username,
text: text,
emoji: ''
});
setTimeout(() => loadGuestbook(), 200);
} catch (err) {
console.error('[guestbook] Send failed:', err);
}
}

export function switchGuestbook(bookKey) {
if (bookKey === state.currentGuestbookKey) return;
state.currentGuestbookKey = bookKey;
loadGuestbook();
}

export function initGuestbook() {
console.log('[guestbook.js] Initialized');
Object.assign(window, {
sendGuestbookMessage,
switchGuestbook,
createNewGuestbook: async () => {
const name = prompt('Enter new guestbook name:');
if (!name || !name.trim()) return;
try {
const res = await api('create_guestbook', { name: name.trim() });
if (res.success) loadGuestbook(res.key);
} catch (err) {
alert('Error creating guestbook');
}
},
clearGuestbook: async () => {
if (!confirm(`Clear ALL messages in "${state.currentGuestbookKey}"?`)) return;
try {
await api('clear_guestbook', { book: state.currentGuestbookKey });
loadGuestbook();
} catch (err) {
alert('Failed to clear guestbook');
}
}
});
const inputField = document.getElementById('guestbook-input');
if (inputField) {
inputField.addEventListener('keypress', (e) => {
if (e.key === 'Enter') sendGuestbookMessage();
});
}
}