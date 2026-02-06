// Import Firebase SDKs (Compat version for simple usage)
// These rely on the CDN scripts being loaded in HTML

const firebaseConfig = {
    apiKey: "AIzaSyB_eKorcHjDKm3zSyUPja-Fbhoohu2l9JE",
    authDomain: "winner-fit-camp.firebaseapp.com",
    projectId: "winner-fit-camp",
    storageBucket: "winner-fit-camp.firebasestorage.app",
    messagingSenderId: "623190915908",
    appId: "1:623190915908:web:de8f316888b53a97367511"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
window.db = db;
window.auth = auth;

// ENABLE OFFLINE PERSISTENCE
// This is the "Hard Fix" for slow/flaky connections.
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn("Persistence failed: Multiple tabs open");
        } else if (err.code == 'unimplemented') {
            console.warn("Persistence not supported by browser");
        }
    });

// FIX: Remove Force Long Polling to see if it unblocks connection
// db.settings({ experimentalForceLongPolling: true, merge: true });

console.log("Firebase Initialized");
