// Systemika Studio does not use an offline application cache. Keep this worker
// network-only and activate it immediately so a legacy worker cannot continue
// controlling the WebApp after an upgrade.
self.addEventListener('install', function(event) {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
    // No respondWith(): allow the browser/network stack to handle the request.
});
