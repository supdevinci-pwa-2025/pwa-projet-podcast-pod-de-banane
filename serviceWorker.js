self.addEventListener('install', event => { // indice: quand le SW est installé
    console.log(' Service Worker installé');
    self.skipWaiting( ); // indice: forcer à prendre le contrôle immédiatement
  });
   
  // <!-- Écouter l'activation du SW -->
  self.addEventListener('activate', event => { // indice: quand le SW devient actif
    console.log(' Service Worker activé');
    self.clients.claim( ); // indice: prendre le contrôle des pages ouvertes
  });

  const staticCacheName = "pod-banane-cache";
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
    "./serviceWorker.js",
    "./functions/share.js",
    "./style.css",
  ];