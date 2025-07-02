/**
 * Version compatible avec serviceWorker.js
 * Utilise la même version de DB (v3) et la même structure
 */

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('participantDB', 3); // Même version que SW

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Ne pas supprimer - juste créer si n'existe pas
      if (!db.objectStoreNames.contains('participants')) {
        const store = db.createObjectStore('participants', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function addParticipant(participant) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const participantData = {
        id: Date.now().toString(), // Même format que SW
        name: participant.name,
        role: participant.role,
        timestamp: new Date().toISOString(),
        synced: false // Marquer comme non synchronisé
      };
      
      const tx = db.transaction('participants', 'readwrite');
      const request = tx.objectStore('participants').add(participantData);
      
      request.onsuccess = () => resolve(participantData);
      request.onerror = () => reject(request.error);
    });
  });
}

export function getAllParticipants() {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('participants', 'readonly');
      const store = tx.objectStore('participants');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export function deleteParticipant(id) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('participants', 'readwrite');
      const request = tx.objectStore('participants').delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

export function addMember() {
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