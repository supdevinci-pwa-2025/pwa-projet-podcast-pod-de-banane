const staticCacheName = "pod-banane-v1";

  const assets = [
    "./",
    "./index.html",
    "./open.html",
    "./offline.html",
    "./share.html",
    "./Dashboard.html",
    "./app.js",
    "./style.css",
    "./manifest.json",
    "./assets/manifest-icon-192.maskable.png",
    "./assets/manifest-icon-512.maskable.png"
  ];

// <!-- INSTALL -->
self.addEventListener('install', event => { // indice: quand le SW est installé
    console.log(' Service Worker installé');
    
    event.waitUntil(
        caches.open(staticCacheName)
        .then(cache => cache.addAll(assets))
        .catch((err) => console.error("Erreur cache install", err))
    );

    self.skipWaiting( ); // indice: forcer à prendre le contrôle immédiatement
});
   
// <!-- ACTIVATE -->
self.addEventListener('activate', event => { // indice: quand le SW devient actif
    console.log(' Service Worker activé');

    event.waitUntil(
        caches.keys().then(keys => 
            Promise.all(
                keys.filter(k => k !== staticCacheName).map(k => caches.delete(k))
            )
        )
    );

    self.clients.claim() // indice: prendre le contrôle des pages ouvertes
});


// <!-- FETCH -->
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    console.log('allo Interception fetch:', request.method, url.pathname);

    if(request.method === "POST" && url.pathname.includes('/pod-banane')) {
        event.respondWith(handlePodcastSubmission(request));
        return;
    }

    console.log("URL Origin:", url.origin);
    console.log("Location Origin:", location.origin);
    console.log("Request Method:", request.method);

    if(request.method !== "GET" || url.origin !== location.origin) return;

    if(url.pathname === "/" || url.pathname === "/index.html") {
        event.respondWith(
        caches.match("./index.html").then(res => res || fetch(request).catch(() => caches.match("./offline.html")))
        );
        return;
    }

    if(url.pathname === "/" || url.pathname === "./Dashboard.html") {
        event.respondWith(
        caches.match("./Dashboard.html").then(res => res || fetch(request).catch(() => caches.match("./offline.html")))
        );
        return;
    }
 
    event.respondWith(
        caches.match(request)
        .then(res => res || fetch(request)
            .then(fetchRes => {
            if (fetchRes.ok) {
                const resClone = fetchRes.clone();
                caches.open(staticCacheName).then(cache => cache.put(request, resClone));
            }
            return fetchRes;
            })
            .catch(() => caches.match('./offline.html'))
        )
    );
});

  

