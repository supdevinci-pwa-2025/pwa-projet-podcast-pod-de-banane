const staticCacheName = "pod-banane-v1";

  const assets = [
    "./",
    "./index.html",
    "./open.html",
    "./index.html",
    "./share.html",
    "./Dashboard.html",
    "./public/404.html",
    "./public/index.html",
    "./app.js",
    "./style.css",
    "./manifest.json",
    "./assets/manifest-icon-192.maskable.png",
    "./assets/manifest-icon-512.maskable.png"
  ];

  // <!-- INSTALLATION -->
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

    self.clients.claim( ); // indice: prendre le contrôle des pages ouvertes
  });

  

