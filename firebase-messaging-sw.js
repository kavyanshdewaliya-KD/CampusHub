importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBURkftN68dMpRFrnWBdca0qs1QmpQlzQ0",
  projectId: "ietcse-bb0c9",
  messagingSenderId: "39297300181",
  appId: "1:39297300181:web:08b6d3e5bae40b9c19145c"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title || "Campusmate Notice";
  const notificationOptions = {
    body: payload.notification.body || "New update posted for IET DAVV CSE-B",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "campushub-notify"
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
