// app.js - Version finale avec import idb.js
import {addParticipant, getAllParticipants } from './idb.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/serviceWorker.js')
    .then(reg => console.log('✅ SW enregistré', reg))
    .catch(err => console.error('❌ SW non enregistré:', err));
}

// Variables globales
const participantList = document.querySelector('#participant-list');
let participants = [];

// Charger les participants au démarrage
document.addEventListener('DOMContentLoaded', async () => {
  await loadParticipant();
  setupForm();
  setupServiceWorkerListener();
});

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

    console.log('📝 Envoi du participant:', { name, role });
    
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('role', role);
      
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
          loadParticipant();
          break;
      }
    });
  }
}

// ============ CHARGEMENT DES PARTICIPANTS (FONCTION CORRIGÉE) ============
async function loadParticipant() {
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
    console.log('💾 Participatns depuis localStorage:', backupParticipants.length);
    
    // 3. Essayer l'API (si en ligne)
    let apiParticipants = [];
    try {
      const response = await fetch('https://pod-de-banane.web.app/functions/get-members');
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
        p.role === participant.role
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
    participants.forEach(participant => addParticipantToUI(participant.name, participant.mood));
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