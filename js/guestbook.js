// >> - js/guestbook.js
// GUESTBOOK MODULE ORCHESTRATOR
// Fully compatible with the latest guestbook-render.js (bottom-aligned chat + auto-scroll)

import { state } from './state.js';
import { api } from './api.js';
import { 
    renderGuestbookMessages, 
    appendGuestbookMessage, 
    scrollGuestbookToBottom 
} from './guestbook-render.js';
import { hideModal } from './utils.js';

export async function loadGuestbook(specificBookKey = null) {
    if (specificBookKey) {
        state.currentGuestbookKey = specificBookKey;
    }

    try {
        const data = await api('get_guestbooks');
        state.guestbooksData = data || { general: [] };

        // Render the guestbook chips (tabs)
        renderGuestbookChips();

        // Get messages for the currently selected guestbook
        const currentMessages = state.guestbooksData[state.currentGuestbookKey] || [];

        // Render messages with proper bottom alignment and auto-scroll
        renderGuestbookMessages(currentMessages);

        // Extra safety scroll after everything has rendered
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
    const username = state.guestbookUsername || 'Guest';
    const currentBook = state.currentGuestbookKey;

    // Optimistic UI: show message immediately
    const optimisticMsg = {
        id: 'temp-' + Date.now(),
        username: username,
        text: text,
        emoji: '',
        dt: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };

    appendGuestbookMessage(optimisticMsg);

    // Clear input
    input.value = '';

    try {
        const res = await api('add_guestbook_message', {
            book: currentBook,
            username: username,
            text: text,
            emoji: ''
        });

        if (res.success) {
            // Reload full list to stay in sync with server
            setTimeout(() => {
                loadGuestbook();
            }, 200);
        } else {
            console.warn('[guestbook] Server returned error:', res);
        }
    } catch (err) {
        console.error('[guestbook] Failed to send message:', err);
        // Optional: show a small error toast here in the future
    }
}

export function switchGuestbook(bookKey) {
    if (bookKey === state.currentGuestbookKey) return;
    
    state.currentGuestbookKey = bookKey;
    loadGuestbook();
}

export function initGuestbook() {
    console.log('[guestbook.js] Initialized');

    // Make key functions available globally for HTML onclick handlers
    Object.assign(window, {
        sendGuestbookMessage,
        switchGuestbook,
        createNewGuestbook: async () => {
            const name = prompt('Enter new guestbook name:');
            if (!name || !name.trim()) return;

            try {
                const res = await api('create_guestbook', { name: name.trim() });
                if (res.success) {
                    // Switch to the newly created guestbook
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

    // Optional: Add Enter key support for the input field
    const inputField = document.getElementById('guestbook-input');
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendGuestbookMessage();
            }
        });
    }
}

// << - js/guestbook.js