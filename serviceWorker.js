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

// ============ IndexedDB ==============
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('participantDB', 3);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('participants')) {
        const store = db.createObjectStore('participants', { keyPath: 'id' });
        // Index optionnel pour rechercher par timestamp
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllPending() {
  try {
    const db = await openDB();
    const transaction = db.transaction(['participants'], 'readonly');
    const store = transaction.objectStore('participants');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        // Filtre seulement les participants non synchronisés, qui resteront en cache
        const pendingParticipants = request.result.filter(participant => !participant.synced);
        resolve(pendingParticipants);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('❌ Erreur getAllPending:', error);
    return [];
  }
}

async function savePendingParticipant(participantData) {
  try {
    const db = await openDB();
    const transaction = db.transaction(['participants'], 'readwrite');
    const store = transaction.objectStore('participants');
    
    return new Promise((resolve, reject) => {
      const request = store.add(participantData);
      request.onsuccess = () => {
        console.log('✅ Participant sauvegardé hors ligne:', participantData.name);
        resolve(request.result);
      };
      request.onerror = () => {
        console.error('❌ Erreur sauvegarde:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('❌ Erreur savePendingParticipant:', error);
    throw error;
  }
}

async function deletePendingParticipant(id) {
  try {
    const db = await openDB();
    const transaction = db.transaction(['participants'], 'readwrite');
    const store = transaction.objectStore('participants');
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => {
        console.log('✅ Participant supprimé après sync:', id);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('❌ Erreur deletePendingParticipant:', error);
    throw error;
  }
}

async function notifyClients(type, data) {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type, data });
    });
  } catch (error) {
    console.error('❌ Erreur notification clients:', error);
  }
}

// <!-- INSTALL -->
self.addEventListener('install', event => { // indice: quand le SW est installé
    console.log(' Service Worker installé');

    event.waitUntil(
        caches.open(staticCacheName)
            .then(cache => cache.addAll(assets))
            .catch((err) => console.error("Erreur cache install", err))
    );

    self.skipWaiting(); // indice: forcer à prendre le contrôle immédiatement
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

    if (request.method === "POST" && url.pathname.includes('/api/pod-banane')) {
        event.respondWith(handlePodcastSubmission(request));
        return;
    }

    console.log("URL Origin:", url.origin);
    console.log("Location Origin:", location.origin);
    console.log("Request Method:", request.method);

    if (request.method !== "GET" || url.origin !== location.origin) return;

    if (url.pathname === "/" || url.pathname === "/index.html") {
        event.respondWith(
            caches.match("./index.html").then(res => res || fetch(request).catch(() => caches.match("./offline.html")))
        );
        return;
    }

    if (url.pathname === "/" || url.pathname === "./Dashboard.html") {
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

// ============ HANDLE PARTICIPANT SUBMISSION ==============
async function handleParticipantSubmission(request) {
  console.log('🔥 handleParticipantSubmission appelée');
  
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      console.log('✅ Requête en ligne réussie');
      return response;
    }
    throw new Error(`Erreur ${response.status}`);
  } catch (error) {
    console.log('📱 Mode hors ligne détecté, sauvegarde locale...');
    
    try {
      const formData = await request.formData();
      console.log('📝 FormData récupérée:', {
        name: formData.get('name'),
        role: formData.get('role')
      });
      
      const participantData = {
        id: Date.now().toString(),
        name: formData.get('name') || formData.get('participant'),
        role: formData.get('role') || formData.get('role'),
        timestamp: new Date().toISOString(),
        synced: false
      };
      
      console.log('💾 Données à sauvegarder:', snackData);
      
      await savePendingParticipant(participantData);
      console.log('✅ savePendingParticipant terminé');
      
      if ('sync' in self.registration) {
        await self.registration.sync.register('sync-participant');
        console.log('🔄 Background sync enregistré');
      }
      
      await notifyClients('participant-saved-offline', participantData);
      console.log('📱 Clients notifiés');
      
      return new Response(JSON.stringify({
        success: true,
        offline: true,
        message: 'Participant sauvegardé hors ligne'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (saveError) {
      console.error('❌ Erreur lors de la sauvegarde:', saveError);
      throw saveError;
    }
  }
}

// <!-- SYNCHRONISATION -->
self.addEventListener('sync', (event) => {
    console.log('📡 Sync déclenchée pour:', event.tag);
    if (event.tag === 'sync-participant') { // indice: le même tag que plus haut
        event.waitUntil(syncParticipants()); // indice: dire "attends la fin de cette promesse"
    }
});

async function syncParticipants() {
  const pending = await getAllPending();
  console.log(`🔄 Tentative de sync de ${pending.length} participants`);
  
  for (const participant of pending) {
    try {
      const response = await fetch('https://pod-de-banane.web.app/functions/members', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Accept': 'application/json' 
        },
        body: JSON.stringify({
          name: participant.name,
          role: participant.role,
          timestamp: participant.timestamp
        })
      });
      
      if (response.ok) {
        await deletePendingParticpant(participant.id);
        await notifyClients('participant-synced', participant);
        console.log('✅ Participant synchronisé:', participant.name);
      } else {
        console.error(`❌ Erreur sync ${participant.name}: ${response.status}`);
      }
    } catch (err) {
      console.error(`❌ Sync failed for ${participant.name}:`, err);
    }
  }
}

// ============ PUSH ==============
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || "Pod de Banane";
  const options = {
    body: data.body || "Nouvelle notification",
    icon: "./assets/manifest-icon-192.maskable.png",
    badge: "./assets/manifest-icon-192.maskable.png"
  };
  event.waitUntil(self.registration.showNotification(title, options));
});