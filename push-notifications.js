const publicKey = "BMVpeCrg0wFJ17wUhdW5MYAkleL1wRRKPnyETpmHWQU7Ji2-N5aLVhzTQwpKfT5PfQ7Wzfoq5B_SvS4HzwrVKxE"; 

// Request notification permission on load
if ('Notification' in window && Notification.permission !== 'granted') {
  Notification.requestPermission();
}

if ('serviceWorker' in navigator && 'PushManager' in window) {
  navigator.serviceWorker.ready.then(registration => {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        }).then(subscription => {
          console.log("📬 Abonné aux push :", JSON.stringify(subscription));

        });
      }
    });
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

