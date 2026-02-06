/**
 * Winners Fit Camp - Attendance Client (Pro V3)
 * Simplified Flow: Scan QR -> (Login/Decision) -> Password -> Record.
 * Resilient to Cache Clearing.
 */

const AttendanceClient = {
    token: '',
    currentUser: null,
    pendingToken: '',
    staffData: null,

    init: async function () {
        // 1. Capture Token from URL
        const urlParams = new URLSearchParams(window.location.search);
        const scanToken = urlParams.get('token');
        if (scanToken) this.token = scanToken;

        // Clean URL to keep it pretty as a PWA
        if (window.history.replaceState && scanToken) {
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        }

        // 2. Auth State Listener (Industry Standard Resilience)
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadStaffProfile();

                // If we arrived via a scan
                if (this.token) {
                    // Show Decision Hub: Do you want to record attendance or just see profile?
                    this.showDecisionHub();
                } else {
                    this.showPwaHub();
                }
            } else {
                this.currentUser = null;
                this.showLogin();
            }
        });
    },

    loadStaffProfile: async function () {
        try {
            const snap = await db.collection('users').doc(this.currentUser.uid).get();
            if (snap.exists) {
                this.staffData = snap.data();
                // Remember the numeric username for next time (Password-Only mode)
                localStorage.setItem('wfc_remembered_username', this.staffData.username);
            }
        } catch (e) {
            console.error("Profile load fail:", e);
        }
    },

    showLogin: function () {
        this.hideAllViews();
        document.getElementById('login-view').style.display = 'block';

        const remembered = localStorage.getItem('wfc_remembered_username');
        const userGroup = document.getElementById('username-group');
        const loginTitle = document.getElementById('login-title');
        const loginWelcome = document.getElementById('login-welcome');

        if (remembered) {
            // "PASSWORD ONLY" MODE
            userGroup.style.display = 'none';
            document.getElementById('login-user').value = remembered;
            loginTitle.textContent = "Welcome Back!";
            loginWelcome.textContent = `Staff ID: ${remembered}. Enter password to proceed.`;
            document.getElementById('login-pass').focus();

            const switchBtn = document.getElementById('switch-acc-btn');
            if (switchBtn) switchBtn.style.display = 'block';
        } else {
            // FULL LOGIN MODE
            userGroup.style.display = 'block';
            loginTitle.textContent = "Staff Sign In";
            loginWelcome.textContent = "Enter your 6-digit ID (122...) and password.";
        }
    },

    handleLogin: async function (e) {
        if (e) e.preventDefault();
        const input = document.getElementById('login-user').value.trim();
        const pass = document.getElementById('login-pass').value.trim();
        const btn = document.querySelector('#login-view .cta-button');

        if (!input || !pass) return alert("Please enter credentials.");

        btn.disabled = true;
        btn.textContent = "Verifying...";

        try {
            let email = input;
            // Support numeric username (122...) login
            if (!input.includes('@')) {
                const snap = await db.collection('users').where('username', '==', input).limit(1).get();
                if (snap.empty) throw new Error("Staff ID not found.");
                email = snap.docs[0].data().email;
            }

            await auth.signInWithEmailAndPassword(email, pass);
            // Auth listener will handle the rest
        } catch (err) {
            alert("Login Failed: " + err.message);
            btn.disabled = false;
            btn.textContent = "Sign In & Record";
        }
    },

    showDecisionHub: function () {
        this.hideAllViews();
        document.getElementById('decision-hub').style.display = 'block';

        const isIn = this.staffData.lastAction === 'Clock In';
        const nextAction = isIn ? 'Clock Out' : 'Clock In';

        document.getElementById('decision-action-text').textContent = `Record ${nextAction}`;

        // Add Status Display to Decision Hub
        const statusEl = document.getElementById('decision-current-status');
        if (statusEl) {
            statusEl.textContent = isIn ? 'CLOCKED IN' : 'CLOCKED OUT';
            statusEl.style.color = isIn ? '#00ff88' : '#ff4444';
        }
    },

    confirmAttendanceAction: async function () {
        this.hideAllViews();
        document.getElementById('loading').style.display = 'block';

        try {
            // 1. Double check Token Expiry
            const tokenSnap = await db.collection('system').doc('attendance_token').get();
            const tokenData = tokenSnap.data();

            if (!tokenData || tokenData.token !== this.token || Date.now() > tokenData.expires) {
                this.showError('Expired QR', 'That QR code is too old. Please scan the one currently on the screen.');
                return;
            }

            // 2. Log Action
            const nextAction = this.staffData.lastAction === 'Clock In' ? 'Clock Out' : 'Clock In';
            const today = new Date().toLocaleDateString('en-US');

            await db.collection('attendance_logs').add({
                staffId: this.currentUser.uid,
                staffName: `${this.staffData.firstName} ${this.staffData.lastName}`,
                action: nextAction,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                date: today,
                type: 'staff'
            });

            await db.collection('users').doc(this.currentUser.uid).update({ lastAction: nextAction });

            this.token = ''; // Clear token after use
            this.showSuccess(`${nextAction} Recorded!`, `Thank you, ${this.staffData.firstName}. Have a great day!`);
            if (navigator.vibrate) navigator.vibrate(200);

        } catch (error) {
            this.showError('Action Failed', error.message);
        }
    },

    showPwaHub: function () {
        this.hideAllViews();
        document.getElementById('pwa-hub').style.display = 'block';
        document.getElementById('hub-welcome').textContent = `Hello ${this.staffData.firstName}!`;

        const isIn = this.staffData.lastAction === 'Clock In';
        document.querySelector('#pwa-hub p').innerHTML = `Current Status: <strong style="color:${isIn ? '#00ff88' : '#ff4444'}">${isIn ? 'CLOCKED IN' : 'CLOCKED OUT'}</strong>`;
    },

    showAccount: function () {
        this.hideAllViews();
        document.getElementById('account-view').style.display = 'block';

        document.getElementById('acc-name').textContent = `${this.staffData.firstName} ${this.staffData.lastName}`;
        document.getElementById('acc-username').textContent = `@${this.staffData.username}`;
        document.getElementById('acc-avatar').textContent = this.staffData.firstName[0].toUpperCase();

        const isIn = this.staffData.lastAction === 'Clock In';
        const stEl = document.getElementById('acc-status');
        stEl.textContent = isIn ? 'CLOCKED IN' : 'CLOCKED OUT';
        stEl.style.color = isIn ? '#00ff88' : '#ff4444';

        this.loadHistory();
    },

    loadHistory: async function () {
        const container = document.getElementById('acc-history');
        try {
            const snap = await db.collection('attendance_logs')
                .where('staffId', '==', this.currentUser.uid)
                .limit(10)
                .get();

            const logs = snap.docs.map(doc => doc.data())
                .sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

            container.innerHTML = logs.map(l => `
                <div class="log-item">
                    <div>
                        <div class="log-action ${l.action === 'Clock In' ? 'action-in' : 'action-out'}">${l.action.toUpperCase()}</div>
                        <div style="font-size:0.7rem; opacity:0.5;">${l.date}</div>
                    </div>
                    <strong>${l.time}</strong>
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = '<p>History unavailable.</p>';
        }
    },

    startScanner: function () {
        this.hideAllViews();
        document.getElementById('scanner-view').style.display = 'block';
        this.html5QrScanner = new Html5Qrcode("reader");
        this.html5QrScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
                const url = new URL(decodedText);
                const t = url.searchParams.get('token');
                if (t) {
                    this.stopScanner();
                    this.token = t;
                    this.processDirectScan();
                }
            }
        ).catch(err => alert("Scanner error: " + err));
    },

    processDirectScan: async function () {
        // When scanning while already logged in
        this.showDecisionHub();
    },

    stopScanner: function () {
        if (this.html5QrScanner) {
            this.html5QrScanner.stop().then(() => this.showPwaHub());
        }
    },

    hideAllViews: function () {
        ['loading', 'pwa-hub', 'error-view', 'success-view', 'account-view', 'login-view', 'scanner-view', 'decision-hub'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    },

    showError: function (title, msg) {
        this.hideAllViews();
        document.getElementById('error-view').style.display = 'block';
        document.getElementById('error-title').textContent = title;
        document.getElementById('error-msg').textContent = msg;
    },

    showSuccess: function (title, msg) {
        this.hideAllViews();
        document.getElementById('success-view').style.display = 'block';
        document.getElementById('success-title').textContent = title;
        document.getElementById('success-msg').textContent = msg;
    },

    clearRememberedUser: function () {
        localStorage.removeItem('wfc_remembered_username');
        this.showLogin();
    },

    logout: async function () {
        if (confirm("Log out of Gym App?")) {
            await auth.signOut();
            window.location.reload();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => AttendanceClient.init());
