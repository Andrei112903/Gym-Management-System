// Import Firebase SDKs (Compat version for simple usage)
// These rely on the CDN scripts being loaded in HTML

const firebaseConfig = {
    apiKey: "AIzaSyAE1Bik1VmsJWJ3gpVa-QWVIXKinqcqpkg",
    authDomain: "winners-fit-camp.firebaseapp.com",
    projectId: "winners-fit-camp",
    storageBucket: "winners-fit-camp.firebasestorage.app",
    messagingSenderId: "543113978701",
    appId: "1:543113978701:web:dc6768b91344957ff6cd04",
    measurementId: "G-5E875TD6VH"
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
