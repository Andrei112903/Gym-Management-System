/**
 * Winners Fit Camp - Authentication Service (Firebase Version)
 * Handles user sessions, login/logout, and RBAC via Firestore.
 */

const AuthService = {
    /**
     * Attempt to log in with Email/Password
     */
    login: async function (email, password, selectedRole) {
        try {
            // 1. Sign in with Firebase
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // 2. Check Role in Firestore 'users' collection
            // Note: For first run, if user doc doesn't exist, we might proceed or fail.
            // For this demo, we will allow login if Auth succeeds, but warn if role mismatch.

            let role = selectedRole; // Default to what they selected if DB fails

            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    role = userDoc.data().role;
                } else {
                    // Create doc if missing (and we are online)
                    db.collection('users').doc(user.uid).set({
                        email: email,
                        role: selectedRole, // Trust them for first creation
                        name: email.split('@')[0]
                    }).catch(e => console.warn("Could not create user doc:", e));
                }
            } catch (dbError) {
                console.warn("Firestore Check Failed (Offline?):", dbError);
                console.log("Proceeding with selected role:", selectedRole);
                // We allow login because Auth (password) succeeded.
                // This 'Fails Open' for the setup phase.
            }

            if (role !== selectedRole && role !== 'admin') {
                // Admin can login as anyone basically, or we strict check
                if (selectedRole === 'admin' && role !== 'admin') {
                    throw new Error("Access Denied: You are not an Admin.");
                }
            }

            // Session Object (optional, firebase handles persistence mostly)
            const session = {
                uid: user.uid,
                email: user.email,
                role: role,
                loginTime: new Date().toISOString()
            };
            localStorage.setItem('currentUser', JSON.stringify(session));

            // Redirect
            window.location.href = 'dashboard.html';
            return true;

        } catch (error) {
            console.error("Login Failed:", error);
            // Propagate error to UI
            throw error;
        }
    },

    /**
     * Log out
     */
    logout: function () {
        auth.signOut().then(() => {
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
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
    requireLogin: function () {
        // Firebase Listener for robust check
        auth.onAuthStateChanged(user => {
            if (!user) {
                // If firebase says no user, boot them
                // window.location.href = 'login.html';
            }
        });

        if (!this.getCurrentUser()) {
            window.location.href = 'login.html';
        }
    }
};

window.AuthService = AuthService;
