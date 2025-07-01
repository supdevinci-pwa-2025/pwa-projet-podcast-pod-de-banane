self.addEventListener('install', event => { // indice: quand le SW est installé
    console.log(' Service Worker installé');
    self.skipWaiting( ); // indice: forcer à prendre le contrôle immédiatement
  });
   
  // <!-- Écouter l'activation du SW -->
  self.addEventListener('activate', event => { // indice: quand le SW devient actif
    console.log(' Service Worker activé');
    self.clients.claim( ); // indice: prendre le contrôle des pages ouvertes
  });