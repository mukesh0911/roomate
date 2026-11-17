// NestMate Service Worker for Background Push Notifications & Offline Support
const CACHE_NAME = 'nestmate-v1';

// Service Worker Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Service Worker Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle Background Push Event
self.addEventListener('push', (event) => {
  let data = { title: 'NestMate Notification', body: 'You have a new update on NestMate!' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/messages',
    },
    actions: [
      { action: 'open', title: 'Open NestMate' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
