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
    event.respondWith(handleParticipantSubmission(request));
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

      console.log('💾 Données à sauvegarder:', participantData);

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
  // Log dans la console pour indiquer le début de la synchronisation
  console.log('🔄 Début de la synchronisation...');
 
  try {
    // 1️⃣ Récupération des participants en attente dans IndexedDB (base locale du navigateur)
    // getAllPending() est une fonction asynchrone qui retourne un tableau de participants non synchronisés
    const pending = await getAllPending();
    console.log(`📊 ${pending.length} participants(s) à synchroniser`);
 
    // Si aucun participant à synchroniser, on sort directement de la fonction (pas besoin de faire plus)
    if (pending.length === 0) {
      console.log('✅ Aucun participant en attente');
      return;  // Fin de la fonction ici
    }
 
    // 2️⃣ Initialisation de compteurs pour suivre succès/échecs
    let success = 0, fail = 0;
    // Tableau pour garder les participants qui n'ont pas pu être synchronisés, avec détail de l'erreur
    const failedParticipants = [];
 
    // 3️⃣ Boucle asynchrone pour traiter chaque participant un par un
    for (const participant of pending) {
      try {
        console.log('🚀 Tentative de synchro pour :', participant.name);

        // Récupération de l'URL de l'API via une fonction dédiée pour gérer différents environnements (local, prod...)
        const apiUrl = getApiUrl();
        console.log('🌐 URL API utilisée:', apiUrl);
 
        // Envoi de la requête HTTP POST vers l'API
        // fetch() est une API JavaScript moderne pour faire des requêtes HTTP asynchrones
        // Ici on envoie les données au format JSON (headers et body)
        const response = await fetch(apiUrl, {
          method: 'POST',               // Méthode HTTP POST pour envoyer des données
          headers: {                   // En-têtes HTTP pour indiquer le type de contenu
            'Content-Type': 'application/json', // Le corps de la requête est en JSON
            'Accept': 'application/json'        // On attend une réponse en JSON
          },
          body: JSON.stringify({       // Conversion des données JavaScript en chaîne JSON
            name: participant.name,          // Propriété 'name' du participant
            role: participant.role,          // Propriété 'role' du participant
          })
        });
 
        // Log du statut HTTP reçu : status est un entier (ex: 200), statusText est une description (ex: OK)
        console.log('📊 Réponse serveur:', response.status, response.statusText);
 
        if (response.ok) {
          // Si le serveur répond avec un code HTTP 2xx (succès), on considère la synchro réussie
          console.log('✅ Participant synchronisé :', participant.name);
 
          // Suppression du participant de IndexedDB pour éviter les doublons à l'avenir
          // deletePendingParticipant() est une fonction asynchrone qui supprime par identifiant
          await deletePendingParticipant(participant.id);
 
          // Notification aux autres onglets/pages que ce participant a été synchronisé
          // Utile pour mettre à jour l'affichage en temps réel dans plusieurs fenêtres
          await notifyClients('participant-synced', { participant });
 
          success++; // Incrémentation du compteur de succès
        } else {
          // Si la réponse HTTP est autre que 2xx (ex: erreur 404, 500)
          // On tente de lire le corps de la réponse pour récupérer un message d'erreur
          const errorText = await response.text().catch(() => 'Erreur inconnue');
 
          // Log détaillé de l'erreur serveur
          console.error(`❌ Erreur serveur ${response.status} pour : ${participant.name}`, errorText);
 
          // On ajoute ce participant à la liste des participants ayant échoué la synchro, avec le message d'erreur
          failedParticipants.push({ participant: participant.name, error: `${response.status}: ${errorText}` });
 
          fail++; // Incrémentation du compteur d'échecs
        }
 
      } catch (err) {
        // Gestion des erreurs liées au réseau (ex: pas d'accès Internet, timeout)
        console.error(`❌ Erreur réseau pour : ${participant.name}`, err.message);
 
        // On garde aussi trace de ces erreurs dans le tableau des échecs
        failedParticipants.push({ participant: participant.name, error: err.message });
 
        fail++; // Incrémentation du compteur d'échecs
      }
    }
 
    // 4️⃣ Après traitement de tous les participants, on affiche un bilan clair
    console.log(`📈 Sync terminée : ${success} succès / ${fail} échecs`);
 
    // Si certains participants n'ont pas pu être synchronisés, on affiche la liste avec erreurs
    if (failedParticipants.length > 0) {
      console.log('❌ Participant échoués:', failedParticipants);
    }
 
    // Notification générale aux autres onglets/pages que la synchronisation est terminée
    // On transmet le nombre de succès, d'erreurs, et les détails des échecs
    await notifyClients('sync-completed', { 
      success, 
      errors: fail, 
      failedParticipants: failedParticipants 
    });
 
  } catch (e) {
    // Gestion d'erreurs globales pouvant survenir dans tout le bloc try (ex: erreur IndexedDB)
    console.error('💥 Erreur globale dans syncParticipants :', e);
 
    // Notification des autres onglets/pages qu'il y a eu une erreur globale
    await notifyClients('sync-error', { error: e.message });
 
    // Relance de l'erreur pour que le code qui a appelé syncParticipants puisse aussi la gérer
    throw e;
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