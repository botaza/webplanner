// js/fcm-client.js
// UPDATED: Full support for chatOnly token preference
// PATCHED: Added updateTokenActiveBook(); registerFcmToken sends activeBook: 'general' on first registration
import { state } from './state.js';
const VAPID_KEY = 'BMlwBTFnXAZuDBkyK8UENXQz-kUTTzZGy1HEoNXbV6l-MmUyTilUJmXbVNs-vetYYHUvjLfAfk24hTHU4lJMxYY';

async function registerFcmToken(token) {
    const storageKey = 'fcm_registered_token';
    const savedKey = 'fcm_token_saved';
    try {
        const res = await fetch('php/save-subscription.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                username: state.guestbookUsername || '',
                // ✅ PATCH: Send initial activeBook so new tokens don't start with undefined
                prefs: { activeBook: 'general' }
            })
        });
        if (res.ok) {
            localStorage.setItem(storageKey, token);
            localStorage.setItem(savedKey, '1');
            console.log('FCM token saved to server.');
            updateNotifStatus();
        } else {
            localStorage.removeItem(savedKey);
            console.error('Failed to save FCM token — will retry next launch.');
        }
    } catch (err) {
        localStorage.removeItem(savedKey);
        console.error('Error saving FCM token — will retry next launch:', err);
    }
}

async function enableNotifications() {
    if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK not loaded.');
        return;
    }
    try {
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn('Notification permission denied.');
                return;
            }
        }
        if (Notification.permission !== 'granted') return;
        
        const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
        const token = await state.messaging.getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration
        });
        
        if (token) {
            await registerFcmToken(token);
        } else {
            console.warn('No FCM token received — will retry next launch.');
        }
    } catch (err) {
        console.error('enableNotifications failed — will retry next launch:', err);
    }
}

function initForegroundMessaging() {
    if (!state.messaging) return;
    state.messaging.onMessage(payload => {
        const { title, body } = payload.notification || {};
        if (title) {
            const toast = document.createElement('div');
            toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-lg z-[200] text-sm font-medium';
            toast.textContent = `🔔 ${title}: ${body}`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        }
    });
}

function updateNotifStatus() {
    const el = document.getElementById('notif-status');
    const retryBtn = document.getElementById('notif-retry-btn');
    if (!el) return;
    const permission = Notification.permission;
    const tokenSaved = localStorage.getItem('fcm_token_saved') === '1';
    const token = localStorage.getItem('fcm_registered_token');
    
    if (permission === 'denied') {
        el.innerHTML = '<span style="color:#f87171">🚫 Blocked — enable in browser settings</span>';
        if (retryBtn) retryBtn.classList.add('hidden');
    } else if (permission === 'default') {
        el.innerHTML = '<span style="color:#facc15">⚠️ Permission not granted yet</span>';
        if (retryBtn) {
            retryBtn.classList.remove('hidden');
            retryBtn.textContent = 'Enable notifications';
        }
    } else if (!tokenSaved) {
        el.innerHTML = '<span style="color:#facc15">⚠️ Token not yet saved to server</span>';
        if (retryBtn) {
            retryBtn.classList.remove('hidden');
            retryBtn.textContent = 'Retry';
        }
    } else {
        const short = token ? ('…' + token.slice(-12)) : '';
        el.innerHTML = '<span style="color:#4ade80">✅ Active</span>'
            + (short ? `<span style="color:#52525b;font-size:11px;margin-left:8px;">${short}</span>` : '');
        if (retryBtn) retryBtn.classList.add('hidden');
    }
}

async function retryNotifications() {
    const el = document.getElementById('notif-status');
    if (el) el.innerHTML = '<span style="color:#a1a1aa">⏳ Trying...</span>';
    await enableNotifications();
    updateNotifStatus();
}

// ── Token Preference: chatOnly toggle ───────────────────────────────────────
async function updateTokenChatOnly(token, chatOnly) {
    if (!token) return false;
    try {
        const form = new FormData();
        form.append('action', 'update_token_prefs');
        form.append('token', token);
        form.append('prefs', JSON.stringify({ chatOnly: chatOnly }));
        const res = await fetch('php/api.php', { method: 'POST', body: form });
        const data = await res.json();
        return data.success === true;
    } catch (err) {
        console.error('Failed to update chatOnly preference:', err);
        return false;
    }
}

// ── Token Preference: activeBook update ─────────────────────────────────────
// ✅ PATCH: Called whenever the user switches guestbook tabs
export async function updateTokenActiveBook(bookKey) {
    const token = localStorage.getItem('fcm_registered_token');
    if (!token) return;
    try {
        const form = new FormData();
        form.append('action', 'update_token_prefs');
        form.append('token', token);
        form.append('prefs', JSON.stringify({ activeBook: bookKey }));
        await fetch('php/api.php', { method: 'POST', body: form });
        console.log('[fcm] activeBook updated to:', bookKey);
    } catch (err) {
        console.warn('[fcm] Failed to update activeBook:', err);
    }
}

// ── Token Manager with Chat Only Toggle ─────────────────────────────────────
async function loadTokenManager() {
    const container = document.getElementById('token-manager-list');
    if (!container) return;
    container.innerHTML = '<div class="text-zinc-500 text-sm text-center py-4">Loading tokens...</div>';
    try {
        const res = await fetch('php/api.php', {
            method: 'POST',
            body: (() => {
                const f = new FormData();
                f.append('action', 'get_tokens');
                return f;
            })()
        });
        const tokens = await res.json();
        if (!tokens || tokens.length === 0) {
            container.innerHTML = '<div class="text-zinc-500 text-sm text-center py-4">No tokens registered yet</div>';
            return;
        }
        const myToken = localStorage.getItem('fcm_registered_token') || '';
        let html = '';
        tokens.forEach(t => {
            const isMe = t.token === myToken;
            const chatOnly = t.prefs && t.prefs.chatOnly === true;
            const activeBook = t.prefs && t.prefs.activeBook ? t.prefs.activeBook : 'general';
            const browser = t.browser || 'Unknown Device';
            const user = t.username || '—';
            const seen = t.last_seen ? t.last_seen.slice(0, 16) : '—';
            const short = '…' + t.token.slice(-12);
            html += `
<div class="bg-zinc-800 rounded-2xl p-4 mb-3">
    <div class="flex justify-between items-start">
        <div class="flex-1 min-w-0">
            <div class="text-sm font-medium flex items-center gap-2">
                ${browser}
                ${isMe ? '<span class="text-[10px] bg-emerald-900 text-emerald-400 px-2 py-0.5 rounded-full">this device</span>' : ''}
            </div>
            <div class="text-xs text-zinc-500 mt-1">
                👤 ${user} &nbsp;·&nbsp; <span class="font-mono">${short}</span>
            </div>
            <div class="text-xs text-zinc-600 mt-0.5">last seen ${seen} &nbsp;·&nbsp; 📖 ${activeBook}</div>
        </div>
        <div class="flex flex-col items-end gap-2">
            <label class="flex items-center gap-2 text-xs cursor-pointer">
                <span class="text-zinc-400">Chat only</span>
                <input type="checkbox"
                    ${chatOnly ? 'checked' : ''}
                    onchange="window.toggleChatOnly('${t.token}', this.checked)"
                    class="w-4 h-4 accent-emerald-500">
            </label>
            <button onclick="window.deleteToken('${t.token}')"
                class="text-red-400 text-xs px-3 py-1 bg-red-950 hover:bg-red-900 rounded-xl">
                Delete
            </button>
        </div>
    </div>
</div>`;
        });
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = '<div class="text-red-400 text-sm text-center py-4">Failed to load tokens</div>';
        console.error('[token-manager] Failed to load tokens:', err);
    }
}

async function deleteToken(token) {
    if (!confirm('Delete this device token? It will stop receiving notifications until it re-registers.')) return;
    const form = new FormData();
    form.append('action', 'delete_token');
    form.append('token', token);
    const res = await fetch('php/api.php', { method: 'POST', body: form });
    const data = await res.json();
    if (data.success) {
        if (token === localStorage.getItem('fcm_registered_token')) {
            localStorage.removeItem('fcm_registered_token');
            localStorage.removeItem('fcm_token_saved');
            updateNotifStatus();
        }
        await loadTokenManager();
    } else {
        alert('Failed to delete token.');
    }
}

async function deleteAllTokens() {
    if (!confirm('Delete ALL device tokens? Everyone will stop receiving notifications until they re-register.')) return;
    const form = new FormData();
    form.append('action', 'delete_all_tokens');
    const res = await fetch('php/api.php', { method: 'POST', body: form });
    const data = await res.json();
    if (data.success) {
        localStorage.removeItem('fcm_registered_token');
        localStorage.removeItem('fcm_token_saved');
        updateNotifStatus();
        await loadTokenManager();
    } else {
        alert('Failed to delete all tokens.');
    }
}

// Global exposure for onclick handlers in HTML
window.toggleChatOnly = async function(token, enabled) {
    const success = await updateTokenChatOnly(token, enabled);
    if (success) {
        await loadTokenManager();
    } else {
        alert('Failed to update chat-only preference');
    }
};

Object.assign(window, {
    retryNotifications,
    updateNotifStatus,
    loadTokenManager,
    deleteToken,
    deleteAllTokens
});

export {
    enableNotifications,
    updateNotifStatus,
    updateTokenChatOnly,
    updateTokenActiveBook
};
