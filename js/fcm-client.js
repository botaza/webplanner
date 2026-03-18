// js/fcm-client.js

import { state } from './state.js';

export async function enableNotifications() {
    try {
        const permission = await Notification.requestPermission();
        state.notificationPermission = permission === 'granted';
        
        if (state.notificationPermission && state.messaging) {
            const token = await state.messaging.getToken({
                vapidKey: 'YOUR_VAPID_KEY_HERE' // Add your VAPID key
            });
            state.fcmToken = token;
            
            // Save token to server
            await fetch('php/save-subscription.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
        }
    } catch (err) {
        console.error('Failed to enable notifications:', err);
    }
}

export function scheduleNotification(event) {
    if (!state.notificationPermission || !event || event.completed) return;
    
    const eventTime = new Date(event.datetime).getTime();
    const now = Date.now();
    const timeUntilEvent = eventTime - now;
    
    // Schedule if within 15 minutes and not in the past
    if (timeUntilEvent > 0 && timeUntilEvent <= 15 * 60 * 1000) {
        setTimeout(() => {
            // Double-check event still exists and is not completed
            const currentEvent = state.events.find(e => e.id === event.id);
            if (currentEvent && !currentEvent.completed) {
                showNotification(currentEvent);
            }
        }, timeUntilEvent);
    }
}

export function showNotification(event) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    
    const title = `Upcoming: ${event.desc}`;
    const body = `${formatTime(new Date(event.datetime))}${event.place ? ' at ' + event.place : ''}`;
    
    new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: event.id,
        renotify: true,
        data: { eventId: event.id }
    });
    
    // Add to notification history
    addToNotificationHistory({
        id: Date.now().toString(),
        eventId: event.id,
        title,
        body,
        timestamp: new Date().toISOString(),
        read: false
    });
}

function addToNotificationHistory(notification) {
    const history = JSON.parse(localStorage.getItem('notification_history') || '[]');
    history.unshift(notification);
    localStorage.setItem('notification_history', JSON.stringify(history.slice(0, 100))); // Keep last 100
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function updateNotifStatus() {
    const statusEl = document.getElementById('notif-status');
    const retryBtn = document.getElementById('notif-retry-btn');
    
    if (!statusEl) return;
    
    if (state.notificationPermission) {
        statusEl.textContent = '✅ Notifications enabled';
        statusEl.className = 'text-sm text-emerald-400';
        if (retryBtn) retryBtn.classList.add('hidden');
    } else {
        statusEl.textContent = '❌ Notifications disabled. Tap to enable.';
        statusEl.className = 'text-sm text-amber-400 cursor-pointer';
        if (retryBtn) retryBtn.classList.remove('hidden');
    }
}

export async function retryNotifications() {
    await enableNotifications();
    updateNotifStatus();
}