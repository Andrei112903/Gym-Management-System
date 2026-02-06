/**
 * Winners Fit Camp - Attendance Client (V3 - Enhanced PWA & Fingerprinting)
 * Handles automatic verification via deviceId and hardware fingerprinting.
 * Provides a seamless PWA experience even if cache is cleared.
 */

const AttendanceClient = {
    token: '',
    deviceId: '',
    staffId: '',

    // --- Hardware Fingerprinting ---
    // Generates a unique signature based on device specs that survives cache clears.
    getFingerprint: function () {
        const specs = [
            navigator.userAgent,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency || 'unknown',
            navigator.deviceMemory || 'unknown',
            (screen.colorDepth || 'unknown')
        ];
        return btoa(specs.join('|')).substring(0, 32);
    },

    init: async function () {
        const debug = (msg) => {
            const el = document.getElementById('debug-status');
            if (el) el.textContent = msg;
            console.log(msg);
        };

        try {
            debug("Reading URL...");
            const urlParams = new URLSearchParams(window.location.search);
            this.token = urlParams.get('token');
            const action = urlParams.get('action');

            // CLEANUP: Strip parameters from URL for a cleaner PWA experience if added to Home Screen
            if (window.history.replaceState && (this.token || action)) {
                const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
            }

            // --- INSTANT REGISTRATION ---
            if (action === 'register') {
                await this.handleInstantRegistration(urlParams);
                return;
            }

            // --- AUTO ATTENDANCE ---
            if (!this.token) {
                // If opened as a PWA (no token), show the Hub
                await this.showPwaHub();
                return;
            }

            this.deviceId = localStorage.getItem('wfc_device_id');
            if (!this.deviceId) {
                // SECURITY FIX: Never auto-recover via fingerprint alone. 
                // iPhones are identical; same-model phones would impersonate each other.

                // If scanning QR with unrecognized device, record the token and show recovery
                if (this.token) {
                    this.pendingAttendanceToken = this.token; // Save for after PIN verify
                    this.showRelinkModal();
                    return;
                }

                this.showError('Unregistered Device', 'This phone is not recognized. If you cleared your browser cache, please use "Repair Device Link" below.');
                return;
            }

            // Validate Token and Expiry from QR scan
            const tokenSnap = await db.collection('system').doc('attendance_token').get();
            const tokenData = tokenSnap.data();

            if (!tokenData || tokenData.token !== this.token || Date.now() > tokenData.expires) {
                this.showError('Expired Token', 'The QR code has expired. Please scan the new code on the screen.');
                return;
            }

            // If token is valid, immediately attempt attendance
            await this.submitInstantAttendance();

        } catch (err) {
            console.error("Attendance Error:", err);
            this.showError('Connection Error', 'Please check your internet and try again.');
        }
    },

    showPwaHub: async function () {
        let deviceId = localStorage.getItem('wfc_device_id');
        const fingerprint = this.getFingerprint();

        if (!deviceId) {
            this.showError('Link Expired', 'Session cleared or device unrecognized. Please use "Repair Device Link" with your account password to reconnect.');
            return;
        }

        try {
            const snap = await db.collection('users').where('deviceId', '==', deviceId).get();
            if (snap.empty) {
                this.showError('Device Unrecognized', 'This device has been unlinked.');
                return;
            }

            const staffDoc = snap.docs[0];
            const staff = staffDoc.data();
            this.staffId = staffDoc.id;
            this.deviceId = deviceId;

            // Re-sync fingerprint if it changed or was missing
            if (staff.deviceFingerprint !== fingerprint) {
                await db.collection('users').doc(this.staffId).update({ deviceFingerprint: fingerprint });
            }

            // Check if finished for today (1 Clock In + 1 Clock Out)
            const today = new Date().toLocaleDateString('en-US');
            const logsSnap = await db.collection('attendance_logs')
                .where('staffId', '==', this.staffId)
                .where('date', '==', today)
                .get();

            const logs = logsSnap.docs.map(d => d.data());
            const hasClockOut = logs.some(l => l.action === 'Clock Out');
            const hasClockIn = logs.some(l => l.action === 'Clock In');

            document.getElementById('loading').style.display = 'none';
            document.getElementById('pwa-hub').style.display = 'block';
            document.getElementById('hub-welcome').textContent = `Hello ${staff.firstName}!`;

            const statusEl = document.querySelector('#pwa-hub p');
            const actionBtn = document.querySelector('#hub-actions .cta-button:first-child');

            if (hasClockOut) {
                statusEl.innerHTML = `You have <strong style="color:var(--gold)">COMPLETED</strong> your shift for today. See you tomorrow!`;
                actionBtn.textContent = 'DONE FOR TODAY';
                actionBtn.style.opacity = '0.5';
                actionBtn.onclick = null;
            } else {
                const isIn = staff.lastAction === 'Clock In';
                statusEl.innerHTML = `You are currently <strong style="color:${isIn ? '#00ff88' : '#ff4444'}">${isIn ? 'CLOCKED IN' : 'CLOCKED OUT'}</strong>`;

                // FORCE QR SCAN FOR CLOCK OUT (User request: default back to scanning qr)
                actionBtn.textContent = 'SCAN KIOSK QR';
                actionBtn.style.opacity = '1';
                actionBtn.onclick = () => this.startScanner();
            }

            // Store staff info for Account View
            this.staffData = staff;

        } catch (e) {
            this.showError('Offline', 'Cannot reach database. Check your connection.');
        }
    },

    showAccount: async function () {
        if (!this.staffData) return;

        const views = ['loading', 'pwa-hub', 'error-view', 'success-view'];
        views.forEach(v => document.getElementById(v).style.display = 'none');

        document.getElementById('account-view').style.display = 'block';

        // Fill Profile
        const s = this.staffData;
        document.getElementById('acc-name').textContent = `${s.firstName} ${s.lastName}`;
        document.getElementById('acc-username').textContent = `@${s.username}`;
        document.getElementById('acc-avatar').textContent = s.firstName[0].toUpperCase();
        document.getElementById('acc-phone').textContent = s.phone || 'No phone';

        const isIn = s.lastAction === 'Clock In';
        const stEl = document.getElementById('acc-status');
        stEl.textContent = isIn ? 'CLOCKED IN' : 'CLOCKED OUT';
        stEl.style.color = isIn ? '#00ff88' : '#ff4444';

        // Add Edit Profile Button if not already there
        const profileHeader = document.querySelector('#account-view h2');
        if (profileHeader && !document.getElementById('edit-profile-btn')) {
            const btn = document.createElement('button');
            btn.id = 'edit-profile-btn';
            btn.innerHTML = '✎ Edit';
            btn.style = 'margin-left:10px; font-size:0.7rem; background:rgba(255,255,255,0.05); border:1px solid var(--glass-border); color:var(--gold); padding:2px 8px; border-radius:10px; cursor:pointer; vertical-align:middle;';
            btn.onclick = () => this.showEditProfile();
            profileHeader.appendChild(btn);
        }

        this.loadHistory();
    },

    showEditProfile: function () {
        document.getElementById('edit-name').value = this.staffData.firstName + ' ' + this.staffData.lastName;
        document.getElementById('edit-username').value = this.staffData.username;
        document.getElementById('edit-profile-modal').style.display = 'flex';
    },

    saveProfile: async function () {
        const fullName = document.getElementById('edit-name').value.trim();
        const username = document.getElementById('edit-username').value.trim().toLowerCase();

        if (!fullName || !username) return alert("Fields cannot be empty.");

        const names = fullName.split(' ');
        const firstName = names[0];
        const lastName = names.slice(1).join(' ') || '';

        const btn = document.querySelector('#edit-profile-modal .cta-button:last-child');
        btn.textContent = "Saving...";
        btn.disabled = true;

        try {
            // 1. Update Staff Record
            await db.collection('users').doc(this.staffId).update({
                firstName,
                lastName,
                username
            });

            // 2. Update User Record (for login)
            // Note: We search by email or use the staffId if we assume they are synced (they are in our saveStaff logic)
            await db.collection('users').doc(this.staffId).update({
                name: fullName,
                username: username
            });

            alert("Profile Updated!");
            window.location.reload();
        } catch (e) {
            alert("Error: " + e.message);
            btn.textContent = "Save Changes";
            btn.disabled = false;
        }
    },

    showHub: function () {
        document.getElementById('account-view').style.display = 'none';
        document.getElementById('pwa-hub').style.display = 'block';
    },

    loadHistory: async function () {
        const historyContainer = document.getElementById('acc-history');
        try {
            // Fetch without orderBy to avoid index requirement
            const snap = await db.collection('attendance_logs')
                .where('staffId', '==', this.staffId)
                .limit(30)
                .get();

            if (snap.empty) {
                historyContainer.innerHTML = '<p style="padding:2rem; opacity:0.3; text-align:center;">No history found.</p>';
                return;
            }

            // Sort in JS (Descending: newest first)
            const logs = snap.docs.map(doc => doc.data())
                .sort((a, b) => {
                    const timeA = a.timestamp?.toMillis() || 0;
                    const timeB = b.timestamp?.toMillis() || 0;
                    return timeB - timeA;
                });

            historyContainer.innerHTML = logs.map(log => {
                const isIn = log.action === 'Clock In';
                return `
                    <div class="log-item">
                        <div>
                            <div class="log-action ${isIn ? 'action-in' : 'action-out'}">${log.action.toUpperCase()}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${log.date}</div>
                        </div>
                        <div style="font-weight:700;">${log.time}</div>
                    </div>
                `;
            }).join('');

        } catch (e) {
            console.error("History fail:", e);
            historyContainer.innerHTML = '<p style="padding:1rem; color:red; font-size:0.8rem; text-align:center;">Could not load logs.</p>';
        }
    },

    // --- In-App Scanner ---
    html5QrScanner: null,

    startScanner: function () {
        document.getElementById('hub-actions').style.display = 'none';
        document.getElementById('scanner-view').style.display = 'block';

        this.html5QrScanner = new Html5Qrcode("reader");
        const qrCodeSuccessCallback = (decodedText, decodedResult) => {
            const url = new URL(decodedText);
            const token = url.searchParams.get('token');
            if (token) {
                this.stopScanner();
                this.token = token;
                this.submitInstantAttendance();
            }
        };

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        this.html5QrScanner.start({ facingMode: "environment" }, config, qrCodeSuccessCallback);
    },

    stopScanner: function () {
        if (this.html5QrScanner) {
            this.html5QrScanner.stop().then(() => {
                document.getElementById('scanner-view').style.display = 'none';
                document.getElementById('hub-actions').style.display = 'block';
            }).catch(e => {
                document.getElementById('scanner-view').style.display = 'none';
                document.getElementById('hub-actions').style.display = 'block';
            });
        }
    },

    // --- Repair Link Logic ---
    showRelinkModal: function () {
        document.getElementById('relink-modal').style.display = 'flex';
        document.getElementById('error-view').style.display = 'none';
    },

    submitRelink: async function () {
        const input = document.getElementById('relink-user').value.trim();
        const pass = document.getElementById('relink-pin').value.trim(); // No toLowerCase() here

        if (!input || !pass) {
            alert("Please enter both Username/Email and Password.");
            return;
        }

        const btn = document.querySelector('#relink-modal .cta-button:last-child');
        const originalText = btn.textContent;
        btn.textContent = "Verifying...";
        btn.disabled = true;

        try {
            let email = input;

            // 1. Resolve Username to Email if needed (Might fail if not logged in)
            if (!input.includes('@')) {
                try {
                    const snap = await db.collection('users').where('username', '==', input).limit(1).get();
                    if (!snap.empty) email = snap.docs[0].data().email;
                } catch (e) { console.warn("Username lookup restricted. Using input as-is."); }
            }

            // 2. AUTHENTICATE (Proves identity + grants Firestore permissions)
            const userCredential = await auth.signInWithEmailAndPassword(email, pass);
            const uid = userCredential.user.uid;

            // 3. Generate New Device ID
            let deviceId = localStorage.getItem('wfc_device_id');
            if (!deviceId) {
                deviceId = 'wfc_dev_' + Math.random().toString(36).substring(2, 15) + Date.now();
                localStorage.setItem('wfc_device_id', deviceId);
            }

            // 4. Update Database (Success means they are linked)
            await db.collection('users').doc(uid).update({
                deviceId: deviceId,
                deviceFingerprint: this.getFingerprint(),
                lastRelinkAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'active'
            });

            this.deviceId = deviceId; // Set in current session
            this.staffId = uid;

            // If scanned QR before entering PIN, log attendance immediately
            if (this.pendingAttendanceToken) {
                await this.submitInstantAttendance();
            } else {
                this.showSuccess("Phone Linked! ✓", "Your phone has been successfully connected to your account.");
            }

        } catch (e) {
            console.error(e);
            alert("Verification failed: " + e.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    },

    handleInstantRegistration: async function (params) {
        const staffId = params.get('staffId');
        const email = params.get('email');
        if (!staffId) {
            this.showError('Invalid Link', 'This registration link is broken.');
            return;
        }

        // Pre-fill the relink modal for them
        if (email) {
            document.getElementById('relink-user').value = email;
        }

        // Show the modal but change title to "Link Device"
        this.showRelinkModal();
        const titleEl = document.querySelector('#relink-modal h2');
        if (titleEl) titleEl.textContent = "Complete Registration";
        const descEl = document.querySelector('#relink-modal p');
        if (descEl) descEl.textContent = "Please enter your account password to pair this phone with your staff profile.";
    },

    submitInstantAttendance: async function () {
        try {
            const snap = await db.collection('users').where('deviceId', '==', this.deviceId).get();
            if (snap.empty) throw new Error("Device Unrecognized. Please contact Admin.");

            const staffDoc = snap.docs[0];
            const staff = staffDoc.data();
            const staffId = staffDoc.id;

            let nextAction = staff.lastAction === 'Clock In' ? 'Clock Out' : 'Clock In';
            const today = new Date().toLocaleDateString('en-US');

            // Final safety check: Check logs directly for today
            const logsSnap = await db.collection('attendance_logs')
                .where('staffId', '==', staffId)
                .where('date', '==', today)
                .where('action', '==', nextAction)
                .get();

            if (!logsSnap.empty) {
                throw new Error(`You already recorded a ${nextAction} for today.`);
            }

            await db.collection('attendance_logs').add({
                staffId: staffId,
                staffName: `${staff.firstName} ${staff.lastName}`,
                action: nextAction,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                date: today,
                type: 'staff',
                deviceId: this.deviceId
            });

            await db.collection('users').doc(staffId).update({ lastAction: nextAction });

            this.showSuccess(`Success! ✓`, `${nextAction} recorded for ${staff.firstName}.`);
            if (navigator.vibrate) navigator.vibrate(200);

        } catch (error) {
            this.showError('Verification Failed', error.message);
        }
    },

    toggleManualAttendance: async function () {
        const actionBtn = document.querySelector('#hub-actions .cta-button:first-child');
        const originalText = actionBtn.textContent;
        actionBtn.textContent = "Processing...";
        actionBtn.disabled = true;

        try {
            await this.submitInstantAttendance();
        } catch (e) {
            alert("Attendance Toggle Failed.");
        } finally {
            actionBtn.textContent = originalText;
            actionBtn.disabled = false;
        }
    },

    showError: function (title, msg) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('success-view').style.display = 'none';
        document.getElementById('pwa-hub').style.display = 'none';
        document.getElementById('error-view').style.display = 'block';
        document.getElementById('error-title').textContent = title;
        document.getElementById('error-msg').textContent = msg;
    },

    showSuccess: function (title, msg) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error-view').style.display = 'none';
        document.getElementById('pwa-hub').style.display = 'none';
        document.getElementById('account-view').style.display = 'none';
        document.getElementById('success-view').style.display = 'block';
        document.getElementById('success-title').textContent = title;
        document.getElementById('success-msg').textContent = msg;
    },

    resetStatus: async function () {
        if (!this.staffId) return;
        const confirmReset = confirm("Are you stuck? This will toggle your status between Clocked In/Out in the system. Continue?");
        if (!confirmReset) return;

        try {
            const nextStatus = this.staffData.lastAction === 'Clock In' ? 'Clock Out' : 'Clock In';
            await db.collection('users').doc(this.staffId).update({ lastAction: nextStatus });
            alert("Status toggled! The page will now refresh.");
            window.location.reload();
        } catch (e) {
            alert("Reset failed: " + e.message);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AttendanceClient.init();
});
