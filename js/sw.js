const CACHE = 'planner-v1';

// Install & cache basics
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(['.', 'index.html']);
    })
  );
});

// Fetch from cache or network
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// Push notification received
self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    data = event.data.json();
  }

  const title = data.title || 'Planner Reminder';
  const options = {
    body: data.body || 'You have a new event or update!',
    icon: 'https://via.placeholder.com/192x192/22c55e/ffffff?text=P', // change to your real icon
    badge: '/icon-96.png', // optional
    vibrate: [200, 100, 200],
    tag: 'planner-notification',
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Click on notification → open app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});