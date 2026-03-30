// js/guestbook.js
// GUESTBOOK MODULE ORCHESTRATOR
// UPDATED: Prompts for username on first visit + updates token association

import { state } from './state.js';
import { api } from './api.js';
import { 
    renderGuestbookMessages, 
    appendGuestbookMessage, 
    scrollGuestbookToBottom 
} from './guestbook-render.js';

function ensureUsername() {
    // If we already have a good username, return it
    if (state.guestbookUsername && state.guestbookUsername !== 'Guest') {
        return state.guestbookUsername;
    }

    // Check localStorage
    let username = localStorage.getItem('guestbook_username');

    if (!username || username === 'Guest' || username.trim() === '') {
        username = prompt('What is your name for the guestbook chat?', 'Guest');
        
        if (!username || username.trim() === '') {
            username = 'Guest';
        } else {
            username = username.trim();
        }

        localStorage.setItem('guestbook_username', username);
    }

    state.guestbookUsername = username;

    // Update the FCM token with the new username (important for chat-only logic)
    const currentToken = localStorage.getItem('fcm_registered_token');
    if (currentToken) {
        // Fire and forget - don't block UI
        fetch('php/api.php', {
            method: 'POST',
            body: (() => {
                const f = new FormData();
                f.append('action', 'update_token_prefs');
                f.append('token', currentToken);
                f.append('username', username);
                f.append('prefs', JSON.stringify({ chatOnly: false })); // preserve existing prefs
                return f;
            })()
        }).catch(err => console.warn('Failed to update token username:', err));
    }

    return username;
}

export async function loadGuestbook(specificBookKey = null) {
    if (specificBookKey) {
        state.currentGuestbookKey = specificBookKey;
    }

    // Ensure username is set before loading anything
    ensureUsername();

    try {
        const data = await api('get_guestbooks');
        state.guestbooksData = data || { general: [] };

        renderGuestbookChips();

        const currentMessages = state.guestbooksData[state.currentGuestbookKey] || [];

        renderGuestbookMessages(currentMessages);

        // Safety scroll to bottom
        setTimeout(scrollGuestbookToBottom, 150);

        console.log(`[guestbook.js] Loaded "${state.currentGuestbookKey}" with ${currentMessages.length} messages`);

    } catch (err) {
        console.error('[guestbook.js] Failed to load guestbook:', err);
        const container = document.getElementById('guestbook-chat-container');
        if (container) {
            container.innerHTML = `<div class="text-red-400 text-center py-10">Failed to load messages</div>`;
        }
    }
}

export function renderGuestbookChips() {
    const container = document.getElementById('guestbook-chips');
    if (!container) return;

    let html = '';

    Object.keys(state.guestbooksData).forEach(key => {
        const isActive = key === state.currentGuestbookKey;
        const displayName = key === 'general' 
            ? 'General' 
            : key.charAt(0).toUpperCase() + key.slice(1);

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
    const username = ensureUsername();        // ensure we have a name
    const currentBook = state.currentGuestbookKey;

    // Optimistic UI
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
        const res = await api('add_guestbook_message', {
            book: currentBook,
            username: username,
            text: text,
            emoji: ''
        });

        if (res.success) {
            setTimeout(() => loadGuestbook(), 200);
        }
    } catch (err) {
        console.error('[guestbook] Failed to send message:', err);
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
                if (res.success) {
                    loadGuestbook(res.key);
                } else {
                    alert(res.error || 'Failed to create guestbook');
                }
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

    // Enter key support
    const inputField = document.getElementById('guestbook-input');
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendGuestbookMessage();
        });
    }
}