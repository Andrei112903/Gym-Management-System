/**
 * Winners Fit Camp - Authentication Service (Firebase Version)
 * Handles user sessions, login/logout, and RBAC via Firestore.
 */

const AuthService = {
    /**
     * Attempt to log in with Email/Password
     */
    login: async function (input, password) {
        try {
            let email = input;

            // 1. Resolve Username to Email if needed
            if (!input.includes('@')) {
                const userSnapshot = await db.collection('users').where('username', '==', input).limit(1).get();
                if (userSnapshot.empty) {
                    throw new Error("Username not found. Please use your full email or a valid username.");
                }
                email = userSnapshot.docs[0].data().email;
            }

            // 2. Sign in with Firebase
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // 3. Get Role from Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) {
                // This shouldn't happen if user created through our portal
                throw new Error("User record not found in database. Contact Admin.");
            }

            const userData = userDoc.data();
            const role = userData.role || 'staff';

            // 4. Save to Session
            const sessionData = {
                uid: user.uid,
                email: user.email,
                username: userData.username || userData.name || email.split('@')[0],
                role: role,
                loginTime: new Date().toISOString()
            };
            localStorage.setItem('currentUser', JSON.stringify(sessionData));

            // 5. Redirect
            window.location.href = 'dashboard.html';
            return true;

        } catch (error) {
            console.error("Login Failed:", error);
            throw error;
        }
    },

    /**
     * Log out
     */
    logout: function () {
        auth.signOut().then(() => {
            localStorage.removeItem('currentUser');
            // Do NOT clear data caches - this causes data loss if sync pending
            // wfc_members_cache, etc. should persist for "Offline" support

            // SECURITY FIX: Use replace to prevent "Back Button" access
            window.location.replace('login.html');
        });
    },

    /**
     * Get current logged in user from LocalStorage (fast)
     * Firebase auth state is async, so we use LS for UI sync
     */
    getCurrentUser: function () {
        const userStr = localStorage.getItem('currentUser');
        return userStr ? JSON.parse(userStr) : null;
    },

    /**
     * Guard a page
     */
    requireLogin: function (requiredRole = null) {
        const user = this.getCurrentUser();

        if (!user) {
            window.location.replace('login.html');
            return;
        }

        // Role-based guarding
        if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
            alert("Access Denied: You do not have permission to view this page.");
            window.location.replace('dashboard.html');
            return;
        }

        // Firebase Listener for session persistence
        auth.onAuthStateChanged(firebaseUser => {
            if (!firebaseUser) {
                localStorage.removeItem('currentUser');
                window.location.replace('login.html');
            }
        });
    },

    /**
     * Check if any admin exists in the system
     */
    checkInitialSetup: async function () {
        try {
            const adminSnapshot = await db.collection('users').where('role', '==', 'admin').limit(1).get();
            return adminSnapshot.empty;
        } catch (err) {
            console.warn("Initial Setup Check Failed:", err);
            return false; // Fail safe
        }
    },

    /**
     * Create the first admin user
     */
    createFirstAdmin: async function (email, password, username) {
        try {
            // 1. Create in Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // 2. Create in Firestore
            await db.collection('users').doc(user.uid).set({
                email: email,
                username: username,
                role: 'admin',
                name: username,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error("Admin Creation Failed:", error);
            throw error;
        }
    }
};

window.AuthService = AuthService;
