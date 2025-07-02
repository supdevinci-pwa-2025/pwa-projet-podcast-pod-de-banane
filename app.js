let members = JSON.parse(localStorage.getItem("podcastMembers")) || [];

if ('serviceWorker' in navigator) {
  register('/serviceWorker.js')
  .then((reg) => {
    // registration worked
    console.log('Enregistrement réussi');
  }).catch((error) => {
    // registration failed
    console.log('Erreur : ' + error);
  });
}

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
  const form = document.querySelector('#participants-form');
  
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.querySelector('#participant-name').value.trim();
    const mood = document.querySelector('#participant-role').value.trim();
    
    if (!name || !role) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    console.log('📝 Envoi du snack:', { name, role });
    
    try {
      // Créer FormData pour l'envoi
      const formData = new FormData();
      formData.append('name', name);
      formData.append('role', role);
      
      // Envoyer vers l'API (intercepté par le SW si hors ligne)
      const response = await fetch('/api/pod-banane', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      console.log('✅ Réponse:', result);
      
      if (result.offline) {
        showMessage('📱 Podcast sauvegardé hors ligne !', 'warning');
      } else {
        showMessage('✅ Podcast ajouté avec succès !', 'success');
        // Ajouter à la liste locale immédiatement
        addSnackToUI(name, role);
      }
      
      form.reset();
      
    } catch (error) {
      console.error('❌ Erreur soumission:', error);
      showMessage('❌ Erreur lors de l\'ajout', 'error');
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
          addSnackToUI(data.name, data.role);
          showMessage(`📱 ${data.name} sauvegardé hors ligne`, 'warning');
          break;
          
        case 'participant-synced':
          console.log('🔄 Participant synchronisé:', data);
          showMessage(`🔄 ${data.name} synchronisé !`, 'success');
          break;
      }
    });
  }
}

// ============ CHARGEMENT DES PODCASTS ============
async function loadPodcasts() {
  try {
    // Essayer de charger depuis l'API
    const response = await fetch('https://pod-de-banane.web.app/functions/members');
    
    if (response.ok) {
      const data = await response.json();
      members = data.members || [];
      console.log('✅ Participants chargés depuis l\'API:', members.length);
    } else {
      throw new Error('API non disponible');
    }
  } catch (error) {
    console.log('📱 API non disponible, chargement depuis localStorage');
    // Fallback sur localStorage
    members = JSON.parse(localStorage.getItem('members')) || [];
  }
  
  // Afficher les snacks
  members.forEach(member => addSnackToUI(member.name, member.role));
}

// ============ AFFICHAGE UI ============
function addSnackToUI(name, role) {
  const li = document.createElement('li');
  li.textContent = `🍪 ${name} (${role})`;
  li.className = 'member-item';
  memberList.appendChild(li);
}

function showMessage(message, type = 'info') {
  // Créer un élément de notification
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Styles basiques
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
  
  // Supprimer après 3 secondes
  setTimeout(() => {
    notification.remove();
  }, 3000);
}