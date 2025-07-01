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


// <!-- SYNCHRONISATION -->
self.addEventListener('sync', (event) => {
    console.log('📡 Sync déclenchée pour:', event.tag);
    if (event.tag === 'sync-podcasts') { // indice: le même tag que plus haut
        event.waitUntil(syncPodcasts()); // indice: dire "attends la fin de cette promesse"
    }
});


async function syncPodcasts() {
    console.log('📡 Début de la synchronisation...');

    // 1️⃣ Lire la liste des participants en attente
    const pending = await readAllData("podcastMembers"); // indice: fonction qui lit IndexedDB
    console.log(`📊 ${pending.length} participant(s) à synchroniser`);

    let success = 0;
    let fail = 0;

    // 2️⃣ Boucle principale
    for (const participant of pending) {
        try {
            console.log(`🚀 Envoi de ${participant.name}`); // indice: propriété du participant à afficher

            const response = await fetch("/api/pod-banane", { // indice: URL de votre API
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: participant.name,     // indice: nom du participant
                    role: participant.role // indice: date ou identifiant temporel
                })
            });

            if (response.ok) {
                console.log(`✅ Participant synchronisé : ${participant.name}`);

                await removeMember(participant.id); // indice: supprime de IndexedDB
                await notifyClients('participant-synced', { participant }); // indice: notifie les clients
                success++;
            } else {
                console.error(`❌ Erreur serveur ${response.status} pour ${participant.name}`);
                fail++;
            }

        } catch (err) {
            console.error(`❌ Erreur réseau pour ${participant.name}: ${err.message}`);
            fail++;
        }
    }

    // 3️⃣ Bilan final
    console.log(`✅ ${success} participants synchronisés, ❌ ${fail} échecs`);
}
