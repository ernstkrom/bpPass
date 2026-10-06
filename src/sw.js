import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { SYNC_TAG, checkReminders } from './reminders.js';

// Precache everything so the app works fully offline, and activate updates right away.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.skipWaiting();
clientsClaim();

// Periodic Background Sync (Chromium, installed app) wakes us up now and then while the app is
// closed. The browser decides how often, so reminders may arrive somewhat late.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(checkReminders(self.registration));
});

// Open the app (or focus an open window) straight into adding a measurement.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const [client] = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (!client) return self.clients.openWindow(new URL('./#add', self.registration.scope).href);
      await client.focus();
      client.postMessage({ type: 'add' });
    })(),
  );
});
