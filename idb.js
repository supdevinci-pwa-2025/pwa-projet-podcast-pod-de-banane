export function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('participantDB', 1);
  
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.createObjectStore('participants', { keyPath: 'id', autoIncrement: true });
      };
  
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  export async function addParticipant(participant) {
    return openDB().then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction('participants', 'readwrite');
        tx.objectStore('participants').add(participant);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    });
  }
  
  export async function getAllParticipants() {
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