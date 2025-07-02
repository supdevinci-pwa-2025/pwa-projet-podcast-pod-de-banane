// import {addParticipant, getAllParticipants } from './idb.js';

let members = JSON.parse(localStorage.getItem("podcastMembers")) || [];


// Charger les snacks au démarrage
document.addEventListener('DOMContentLoaded', async () => {
  await loadPodcasts();
  setupForm();
  setupServiceWorkerListener();
  askNotificationPermission();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/serviceWorker.js')
    .then(reg => console.log('✅ SW enregistré', reg))
    .catch(err => console.error('❌ SW non enregistré:', err));
}

const participantList = document.querySelector('#participant-list');
let participants = [];

function addMember() {
    const nameInput = document.getElementById("memberName");
    const roleInput = document.getElementById("memberRole");
    const name = nameInput.value.trim();
    const role = roleInput.value;

    if (name === "") {
        alert("Veuillez entrer un nom.");
        return;
    }

    const newMember = { name, role };
    members.push(newMember);
    localStorage.setItem("podcastMembers", JSON.stringify(members));
    nameInput.value = "";
    displayMembers();


    showNotification('Nouveau membre ajouté !', `${name} (${role}) a été ajouté au podcast.`);
}

// Charger les snacks au démarrage
document.addEventListener('DOMContentLoaded', async () => {
  await loadPodcasts();
  setupForm();
  setupServiceWorkerListener();
});

function displayMembers() {
    const list = document.getElementById("teamList");
    list.innerHTML = "";

    let count = { total: 0, Voix: 0, Script: 0, Montage: 0 };

    members.forEach(({ name, role }, index) => {
        const div = document.createElement("div");
        div.className = "member";
        div.innerHTML = `
      <span>${name} – ${role}</span>
      <button onclick="removeMember(${index})">❌</button>
    `;
        list.appendChild(div);
        count.total++;
        count[role]++;
    });

    document.getElementById("total").textContent = count.total;
    document.getElementById("voice").textContent = count["Voix"];
    document.getElementById("script").textContent = count["Script"];
    document.getElementById("montage").textContent = count["Montage"];
}

function removeMember(index) {
    members.splice(index, 1);
    localStorage.setItem("podcastMembers", JSON.stringify(members));
    displayMembers();
}

displayMembers();

// SYNCHRONISATION
navigator.serviceWorker.ready.then(reg => {
  reg.sync.register('sync-participant') // indice: méthode pour enregistrer une sync
    .then(() => console.log('📡 Sync enregistrée'))
    .catch(err => console.error('❌ Erreur sync:', err));
});

async function syncPodcasts() {
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
    const failedParticipant = [];
 
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
 
/**
* Fonction utilitaire pour déterminer dynamiquement l'URL de l'API en fonction de l'environnement
* ----------------------------------------------------------------------------------------------
* Utilise l'objet URL et self.location.href pour récupérer l'URL complète de la page courante
* Puis analyse le hostname pour retourner :
* - une URL locale pour localhost/127.0.0.1,
* - une URL adaptée pour Netlify (fonctions serverless),
* - une URL de production par défaut.
*/
function getApiUrl() {
  // Création d'un objet URL pour analyser proprement l'URL courante
  const currentUrl = new URL(self.location.href);
  // Si on est en local (dev sur machine locale)
  if (currentUrl.hostname === 'localhost' || currentUrl.hostname === '127.0.0.1') {
    // Retourne l'URL locale pour l'API, sur le même port que le front-end
    return `${currentUrl.origin}/api/members`;
  }
  // Si on est déployé sur Firebase
  if (currentUrl.hostname.includes('app')) {
    // Retourne l'URL de la fonction serverless hébergée sur Netlify
    return `${currentUrl.origin}/functions/members`;
  }
  // Sinon on retourne une URL de production fixe (exemple : site Netlify principal)
  return 'https://pod-de-banane.web.app/functions/members';
}
// ============ GESTION DU FORMULAIRE ============
function setupForm() {
  const form = document.querySelector('#participant-form');
  
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.querySelector('#participant-name').value.trim();
    const role = document.querySelector('#participant-role').value.trim();
    
    if (!name || !role) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    console.log('📝 Envoi du participants:', { name, role });
    
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('mood', role);
      
      const response = await fetch('/functions/members', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      console.log('✅ Réponse:', result);
      
      if (result.offline) {
        showMessage('📱 Participant sauvegardé hors ligne !', 'warning');
      } else {
        showMessage('✅ Participant ajouté avec succès !', 'success');
        addParticipantToUI(name, role);
      }
      
      form.reset();
      
    } catch (error) {
      console.error('❌ Erreur soumission:', error);
      console.error('❌ Détails:', error.message);
      showMessage(`❌ Erreur: ${error.message}`, 'error');
    }
  });
}

// ============ ÉCOUTER LES MESSAGES DU SERVICE WORKER ============
function setupServiceWorkerListener() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, data } = event.data;
      
      console.log('📱 Message du SW:', type, data);
      
      switch (type) {
        case 'participant-saved-offline':
          console.log('📱 Participant sauvegardé hors ligne:', data);
          addParticipantToUI(data.name, data.role);
          showMessage(`📱 ${data.name} sauvegardé hors ligne`, 'warning');
          break;
          
        case 'participant-synced':
          console.log('🔄 Participant synchronisé:', data);
          showMessage(`🔄 ${data.name} synchronisé !`, 'success');
          // Recharger la liste après sync
          loadParticipants();
          break;
      }
    });
  }
}

// ============ CHARGEMENT DES PARTICIPANTS (FONCTION CORRIGÉE) ============
async function loadParticipants() {
  try {
    console.log('📱 Chargement des participants...');
    
    // 1. Charger depuis IndexedDB (via idb.js)
    let localParticipants = [];
    try {
      localParticipants = await getAllParticipants();
      console.log('📦 Participants depuis IndexedDB:', localParticipants.length, localParticipants);
    } catch (error) {
      console.error('❌ Erreur IndexedDB:', error);
    }
    
    // 2. Charger depuis localStorage (backup)
    const backupParticipants = JSON.parse(localStorage.getItem('participants')) || [];
    console.log('💾 Participants depuis localStorage:', backupParticipants.length);
    
    // 3. Essayer l'API (si en ligne)
    let apiParticipants = [];
    try {
      const response = await fetch('https://pod-de-banane.web.app/functions/get-participants');
      if (response.ok) {
        const data = await response.json();
        apiParticipants = data.participants || [];
        console.log('✅ Participants depuis API:', apiParticipants.length);
      }
    } catch (error) {
      console.log('📱 API non disponible');
    }
    
    // 4. Fusionner les sources (éviter doublons)
    const getAllParticipants = [...apiParticipants, ...localParticipants, ...backupParticipants];
    
    // Déduplication simple par nom + mood
    const uniqueParticipants = allParticipants.filter((participant, index, self) => 
      index === self.findIndex(p => 
        p.name === participant.name && 
        p.mood === participant.role
      )
    );
    
    participants = uniqueParticipants;
    console.log('🍪 Total participants uniques:', participants.length);
    
    // 5. Afficher dans l'UI
    participantList.innerHTML = '';
    participants.forEach(participant => addParticipantToUI(participant.name, participant.role));
    
    // 6. Sauvegarder dans localStorage comme backup
    localStorage.setItem('participants', JSON.stringify(participants));
    
  } catch (error) {
    console.error('❌ Erreur loadParticipants:', error);
    // Fallback localStorage uniquement
    participants = JSON.parse(localStorage.getItem('participants')) || [];
    participantList.innerHTML = '';
    participant.forEach(participant => addParticipantToUI(participant.name, participant.role));
  }
}

// ============ AFFICHAGE UI ============
function addParticipantToUI(name, role) {
  const li = document.createElement('li');
  li.textContent = `🍪 ${name} (${role})`;
  li.className = 'participant-item';
  participantList.appendChild(li);
}

function showMessage(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 6px;
    color: white;
    font-weight: bold;
    z-index: 1000;
    ${type === 'success' ? 'background: #4CAF50;' : ''}
    ${type === 'warning' ? 'background: #FF9800;' : ''}
    ${type === 'error' ? 'background: #f44336;' : ''}
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// ============ BOUTON TEST SYNC ============
document.addEventListener('DOMContentLoaded', () => {
  const syncButton = document.querySelector('[data-action="sync"]');
  
  syncButton?.addEventListener('click', async () => {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-participants');
        console.log('🔄 Background sync déclenché manuellement');
        showMessage('🔄 Synchronisation déclenchée', 'info');
      } catch (error) {
        console.error('❌ Erreur sync:', error);
        showMessage('❌ Erreur de synchronisation', 'error');
      }
    } else {
      showMessage('❌ Background Sync non supporté', 'error');
    }
  });
});

// ============ SAUVEGARDE PÉRIODIQUE ============
setInterval(() => {
  if (participants.length > 0) {
    localStorage.setItem('participants', JSON.stringify(participants));
    console.log('💾 Backup localStorage effectué');
  }
}, 30000);

function askNotificationPermission() {
  if (!('Notification' in window)) return;

  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      console.log("🔔 Notifications autorisées !");
    } else {
      console.warn("❌ Notifications refusées.");
    }
  });
}

function showNotification(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: "./assets/manifest-icon-192.maskable.png",
      badge: "./assets/manifest-icon-192.maskable.png"
    });
  }
}