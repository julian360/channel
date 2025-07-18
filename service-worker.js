const CACHE_NAME = 'channel-app-v1';
const urlsToCache = [
    '/channel/index.html', // Ruta actualizada
    '/channel/manifest.json', // Ruta actualizada
    '/channel/service-worker.js', // Ruta actualizada
    // Añade aquí las rutas de tus iconos, asumiendo que están en /channel/icons/
    '/channel/icons/icon-72x72.png',
    '/channel/icons/icon-96x96.png',
    '/channel/icons/icon-128x128.png',
    '/channel/icons/icon-144x144.png',
    '/channel/icons/icon-152x152.png',
    '/channel/icons/icon-192x192.png',
    '/channel/icons/icon-384x384.png',
    '/channel/icons/icon-512x512.png',
    // Añade otros activos esenciales que tu aplicación necesita para funcionar sin conexión
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap',
    'https://unpkg.com/react@18/umd/react.production.min.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
    'https://unpkg.com/@daily-co/daily-js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
