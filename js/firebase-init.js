// Import Firebase SDKs (Compat version for simple usage)
// These rely on the CDN scripts being loaded in HTML

const firebaseConfig = {
    apiKey: "AIzaSyCGGO9XDoniTMwN7tmqifzTxG8mTWQmizQ",
    authDomain: "gym-management-system-93da3.firebaseapp.com",
    projectId: "gym-management-system-93da3",
    storageBucket: "gym-management-system-93da3.firebasestorage.app",
    messagingSenderId: "732088002656",
    appId: "1:732088002656:web:82ea2d2450c168388cfb05",
    measurementId: "G-P150FRWBZM"
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
