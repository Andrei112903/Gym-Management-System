const AttendanceClient = {
    token: '',
    currentUser: null,
    staffData: null,

    init: async function () {
        // 1. Capture Token from URL
        const urlParams = new URLSearchParams(window.location.search);
        const scanToken = urlParams.get('token');

        // DESTROY LINK IMMEDIATELY: Wipe token from URL bar so they can't bookmark or share it
        if (window.history.replaceState && scanToken) {
            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
        }

        // If NO token is provided, the user probably wants the standard Staff Portal
        if (!scanToken) {
            window.location.replace('profile.html');
            return;
        }

        this.token = scanToken;

        // 2. Auth State Listener
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadStaffProfile();
                this.showDecisionHub();
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
            userGroup.style.display = 'none';
            document.getElementById('login-user').value = remembered;
            loginTitle.textContent = "Welcome Back!";
            loginWelcome.textContent = `Staff ID: ${remembered}. Enter password to confirm attendance.`;
            document.getElementById('login-pass').focus();
            document.getElementById('switch-acc-btn').style.display = 'block';
        } else {
            userGroup.style.display = 'block';
            loginTitle.textContent = "Attendance Login";
            loginWelcome.textContent = "Enter your 6-digit ID and password to proceed.";
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
            if (!input.includes('@')) {
                let snap = await db.collection('users').where('username', '==', input).limit(1).get();

                if (snap.empty && !isNaN(input)) {
                    snap = await db.collection('users').where('username', '==', parseInt(input)).limit(1).get();
                }

                if (snap.empty) {
                    snap = await db.collection('users').where('staffId', '==', input).limit(1).get();
                }

                if (snap.empty) throw new Error(`Staff ID "${input}" not matched.`);
                email = snap.docs[0].data().email;
            }
            await auth.signInWithEmailAndPassword(email.trim(), pass);
        } catch (err) {
            alert("Verification Error: " + err.message);
            btn.disabled = false;
            btn.textContent = "Sign In & Record";
        }
    },

    showDecisionHub: function () {
        this.hideAllViews();
        document.getElementById('decision-hub').style.display = 'block';

        const today = new Date().toLocaleDateString('en-US');
        const hasActionToday = this.staffData.lastActionDate === today;

        let statusText = 'NO ENTRY TODAY';
        let statusColor = '#ffb800';
        let nextAction = 'Clock In';
        let allowAction = true;
        let mainMsg = "Identity confirmed. Choose your next step:";

        if (hasActionToday) {
            if (this.staffData.lastAction === 'Clock In') {
                statusText = 'CLOCKED IN';
                statusColor = '#00ff88';
                nextAction = 'Clock Out';
            } else if (this.staffData.lastAction === 'Clock Out') {
                // STRICT MODE: One Shift Per Day
                statusText = 'SHIFT COMPLETED';
                statusColor = '#94a3b8'; // Slate grey
                allowAction = false;
                mainMsg = "You have already completed your shift for today.";
            }
        }

        document.getElementById('decision-action-text').textContent = allowAction ? `Record ${nextAction}` : 'No Actions Available';
        document.querySelector('#decision-hub p').textContent = mainMsg;

        const actionBtn = document.querySelector('#decision-hub .cta-button');
        if (actionBtn) {
            actionBtn.style.display = allowAction ? 'block' : 'none';
        }

        const statusEl = document.getElementById('decision-current-status');
        if (statusEl) {
            statusEl.textContent = statusText;
            statusEl.style.color = statusColor;
        }
    },

    confirmAttendanceAction: async function () {
        if (!this.token) {
            this.showError('Link Expired', 'This session has already been used. Please scan a new QR code.');
            return;
        }

        this.hideAllViews();
        document.getElementById('loading').style.display = 'block';

        try {
            const tokenSnap = await db.collection('system').doc('attendance_token').get();
            const tokenData = tokenSnap.data();

            if (!tokenData || tokenData.token !== this.token || Date.now() > tokenData.expires) {
                this.showError('Expired QR', 'That QR code is too old. Please scan the newest one.');
                return;
            }

            const today = new Date().toLocaleDateString('en-US');
            const hasActionToday = this.staffData.lastActionDate === today;
            let nextAction = 'Clock In';
            if (hasActionToday && this.staffData.lastAction === 'Clock In') {
                nextAction = 'Clock Out';
            }

            await db.collection('attendance_logs').add({
                staffId: this.currentUser.uid,
                staffName: `${this.staffData.firstName} ${this.staffData.lastName}`,
                action: nextAction,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                date: today,
                type: 'staff'
            });

            await db.collection('users').doc(this.currentUser.uid).update({
                lastAction: nextAction,
                lastActionDate: today
            });

            this.token = '';
            this.showSuccess(`${nextAction} Recorded!`, `Confirmed for ${this.staffData.firstName}. Redirecting to portal...`);

            setTimeout(() => {
                window.location.replace('profile.html');
            }, 3000);

            if (navigator.vibrate) navigator.vibrate(200);

        } catch (error) {
            this.showError('Action Failed', error.message);
        }
    },

    hideAllViews: function () {
        ['loading', 'error-view', 'success-view', 'login-view', 'decision-hub'].forEach(id => {
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

    redirectToPortal: function () {
        window.location.href = 'profile.html';
    }
};

document.addEventListener('DOMContentLoaded', () => AttendanceClient.init());
