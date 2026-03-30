// >> - js/guestbook-render.js
// GUESTBOOK RENDERING LOGIC
// FIXED: Messages now appear at the BOTTOM (newest at bottom) with proper auto-scroll to bottom

import { state } from './state.js';

/**
 * Render ALL guestbook messages in the chat container
 * Messages are sorted oldest → newest (standard chat behavior)
 * Automatically scrolls to the very bottom after rendering
 */
export function renderGuestbookMessages(messages = []) {
    const container = document.getElementById('guestbook-chat-container');
    if (!container) {
        console.warn('[guestbook-render] Chat container not found');
        return;
    }

    // Clear previous content
    container.innerHTML = '';

    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full py-20 text-zinc-500">
                <div class="text-6xl mb-4 opacity-50">💬</div>
                <div class="text-lg">No messages yet</div>
                <div class="text-sm mt-1">Be the first to write something!</div>
            </div>`;
        return;
    }

    // Sort messages by timestamp (oldest first)
    const sortedMessages = [...messages].sort((a, b) => {
        const timeA = new Date(a.dt || '1970-01-01').getTime();
        const timeB = new Date(b.dt || '1970-01-01').getTime();
        return timeA - timeB;
    });

    let html = '';

    sortedMessages.forEach(msg => {
        const isMine = String(msg.username || '').toLowerCase() === String(state.guestbookUsername || '').toLowerCase();

        const messageTime = new Date(msg.dt || Date.now()).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });

        html += `
            <div class="message ${isMine ? 'mine' : ''}">
                <div class="bubble">
                    ${msg.emoji ? `<span class="mr-1 text-xl">${msg.emoji}</span>` : ''}
                    ${msg.text ? msg.text.replace(/\n/g, '<br>') : ''}
                </div>
                <div class="meta">
                    <span class="font-medium">${msg.username || 'Guest'}</span>
                    <span>${messageTime}</span>
                </div>
            </div>`;
    });

    container.innerHTML = html;

    // IMPORTANT FIX: Scroll to bottom so newest messages are visible
    // We use multiple timeouts because the DOM needs time to layout
    const scrollToBottom = () => {
        container.scrollTop = container.scrollHeight;
    };

    // Immediate scroll
    scrollToBottom();

    // After content is painted
    setTimeout(scrollToBottom, 10);

    // Safety net in case of images, fonts, or complex layout
    setTimeout(scrollToBottom, 100);
    setTimeout(scrollToBottom, 300);
}

/**
 * Append a single new message to the bottom (optimistic update)
 * Used when sending a message for instant feedback
 */
export function appendGuestbookMessage(message) {
    const container = document.getElementById('guestbook-chat-container');
    if (!container) return;

    const isMine = String(message.username || '').toLowerCase() === String(state.guestbookUsername || '').toLowerCase();

    const messageTime = new Date(message.dt || Date.now()).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const messageHTML = `
        <div class="message ${isMine ? 'mine' : ''}">
            <div class="bubble">
                ${message.emoji ? `<span class="mr-1 text-xl">${message.emoji}</span>` : ''}
                ${message.text ? message.text.replace(/\n/g, '<br>') : ''}
            </div>
            <div class="meta">
                <span class="font-medium">${message.username || 'Guest'}</span>
                <span>${messageTime}</span>
            </div>
        </div>`;

    container.insertAdjacentHTML('beforeend', messageHTML);

    // Smooth scroll to the new message
    setTimeout(() => {
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
        });
    }, 10);
}

/**
 * Force scroll to bottom (useful after switching guestbooks or loading)
 */
export function scrollGuestbookToBottom() {
    const container = document.getElementById('guestbook-chat-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// Expose helper for debugging / manual calls if needed
Object.assign(window, {
    scrollGuestbookToBottom
});

// << - js/guestbook-render.js