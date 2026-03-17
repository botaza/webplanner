// js/fcm-client.js

import { state } from './state.js';

const VAPID_KEY = 'BMlwBTFnXAZuDBkyK8UENXQz-kUTTzZGy1HEoNXbV6l-MmUyTilUJmXbVNs-vetYYHUvjLfAfk24hTHU4lJMxYY';

async function registerFcmToken(token) {
    const storageKey = 'fcm_registered_token';
    const savedKey = 'fcm_token_saved';

    try {
        const res = await fetch('php/save-subscription.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
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

    const alreadySaved = localStorage.getItem('fcm_token_saved') === '1';

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

Object.assign(window, {
    retryNotifications,
    updateNotifStatus
});

export {
    enableNotifications,
    updateNotifStatus
};
