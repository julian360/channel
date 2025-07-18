const CACHE_NAME = 'channel-app-v2.1'; // <--- ¡IMPORTANTE! Cambia esto con cada nueva implementación principal
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
    console.log('Service Worker: Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Cache abierta, añadiendo URLs.');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: saltando espera (skipWaiting).');
                self.skipWaiting(); // Fuerza la activación del nuevo Service Worker inmediatamente
            })
    );
});

self.addEventListener('fetch', (event) => {
    // Para las peticiones de navegación (que incluyen index.html), intenta ir a la red primero.
    // Esto asegura que siempre se intente obtener la versión más reciente del HTML.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(async (response) => {
                    // Si la respuesta es válida, la clonamos y la añadimos a la caché.
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(event.request, response.clone());
                    return response;
                })
                .catch(async () => {
                    // Si la red falla (ej. offline), servimos desde la caché.
                    const cachedResponse = await caches.match(event.request);
                    return cachedResponse || caches.match('/channel/index.html'); // Fallback a index.html si no se encuentra en caché
                })
        );
    } else {
        // Para otros recursos (CSS, JS, imágenes, etc.), usa una estrategia de caché primero, luego red.
        // O podrías considerar 'stale-while-revalidate' para más frescura.
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    // Cache hit - return response
                    if (response) {
                        return response;
                    }
                    // No hay caché - intentar obtener de la red
                    return fetch(event.request)
                        .then(async (networkResponse) => {
                            // Si la respuesta de red es válida, la añadimos a la caché
                            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                                const cache = await caches.open(CACHE_NAME);
                                cache.put(event.request, networkResponse.clone());
                            }
                            return networkResponse;
                        })
                        .catch((error) => {
                            console.error('Service Worker: Fetch failed:', error);
                            // Podrías devolver una respuesta offline específica para ciertos tipos de archivos si es necesario
                        });
                })
        );
    }
});


self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activando...');
    const cacheWhitelist = [CACHE_NAME]; // Solo mantiene la caché con el nombre actual
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Service Worker: Eliminando caché antigua:', cacheName);
                        return caches.delete(cacheName); // Elimina cachés antiguas
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Tomando el control de los clientes (clients.claim).');
            return self.clients.claim(); // Permite que el nuevo Service Worker tome el control inmediatamente
        })
    );
});
