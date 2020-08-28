/* eslint no-restricted-globals: 1 */
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST || [], {
  cleanURLs: false,
});


self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

registerRoute(
  ({ url }) => {
    // 筛选出需要缓存的资源
    return /webapp.*saturnv.*\.(?:mp3|mp4)$/.test(url.href);
  },
  new CacheFirst({
    cacheName: 'meida-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        purgeOnQuotaError: true
      })
    ]
  })
)
