// firebase-messaging-sw.js
// Place this file in your web ROOT (same folder as index.html)
// FCM requires this exact filename and location.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Must match the config in index.html exactly
firebase.initializeApp({
    apiKey:            "AIzaSyAMJaYSMXKgxpkaYfkyLXfR-u6ZuXpKef4",
    authDomain:        "plannernotifications-bd4b1.firebaseapp.com",
    projectId:         "plannernotifications-bd4b1",
    storageBucket:     "plannernotifications-bd4b1.firebasestorage.app",
    messagingSenderId: "531159501999",
    appId:             "1:531159501999:web:2fcf2be70a3fb13f09185a"
});

const messaging = firebase.messaging();

// Handle notifications when the app is in the BACKGROUND or CLOSED
messaging.onBackgroundMessage(function(payload) {
    console.log('[firebase-messaging-sw.js] Background message received:', payload);

    const title   = payload.notification?.title || 'Planner Reminder';
    const options = {
        body:     payload.notification?.body || 'You have an upcoming event.',
        icon:     '/icon-192.png',     // update to your real icon path
        badge:    '/icon-96.png',      // optional small badge icon
        vibrate:  [200, 100, 200],
        tag:      'planner-notification',
        renotify: true,
        data:     payload.data || {}
    };

    return self.registration.showNotification(title, options);
});

// Open / focus the app when user taps a notification
self.addEventListener('notificationclick', function(event) {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // If app is already open, focus it
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new tab
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
