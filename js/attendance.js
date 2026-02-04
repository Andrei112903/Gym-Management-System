/**
 * Winners Fit Camp - Attendance Client
 * Handles the logic for the Staff Scan -> PIN -> Check-In flow.
 */

const AttendanceClient = {
    pin: '',
    token: '',
    deviceId: '',
    staffId: '',

    init: async function () {
        const debug = (msg) => {
            const el = document.getElementById('debug-status');
            if (el) el.textContent = msg;
            console.log(msg);
        };

        try {
            debug("Step 1: Reading URL...");
            const urlParams = new URLSearchParams(window.location.search);
            this.token = urlParams.get('token');
            const action = urlParams.get('action');

            // --- HANDLE REGISTRATION ---
            if (action === 'register') {
                debug("Step 2: Starting Registration...");
                await this.handleRegistration(urlParams);
                return;
            }

            // --- NORMAL ATTENDANCE FLOW ---
            if (!this.token) {
                this.showError('No Access Token Found', 'Please scan the QR code at the Kiosk.');
                return;
            }

            debug("Step 2: Checking Device ID...");
            this.deviceId = localStorage.getItem('wfc_device_id');
            if (!this.deviceId) {
                this.showError('Unregistered Device', 'This phone is not linked to any staff account. Please ask your Admin to register it.');
                return;
            }

            debug("Step 3: Connecting to Database...");
            const tokenSnap = await db.collection('system').doc('attendance_token').get();
            const data = tokenSnap.data();

            debug("Step 4: Validating Token...");
            if (!data || data.token !== this.token || Date.now() > data.expires) {
                this.showError('Expired Token', 'The QR code has expired. Please scan the newly generated code on the screen.');
                return;
            }

            // If all good, show PIN pad
            debug("Step 5: Success! Ready.");
            document.getElementById('loading').style.display = 'none';
            document.getElementById('pin-view').style.display = 'block';

        } catch (err) {
            console.error("Attendance Init Error:", err);
            debug("Error: " + err.message);
            this.showError('Connection Error', 'Check your internet or scan again.');
        }
    },

    handleRegistration: async function (params) {
        const staffId = params.get('staffId');
        if (!staffId) {
            this.showError('Registration Error', 'Invalid registration link.');
            return;
        }

        try {
            const snap = await db.collection('staff').doc(staffId).get();
            if (!snap.exists) {
                this.showError('User Not Found', 'This registration link is invalid.');
                return;
            }

            const data = snap.data();
            // SECURITY: If profileSetupAt OR deviceId exists, the link is EXPIRED
            if (data.profileSetupAt || data.deviceId) {
                this.showError('Link Expired', 'This account has already been set up. Contact Admin if you need to reset your device.');
                return;
            }

            // 2. Clear loading and show setup
            document.getElementById('loading').style.display = 'none';
            document.getElementById('setup-view').style.display = 'block';
            this.staffId = staffId;

            document.getElementById('setup-username').value = data.username || '';

            // Generate/Grab Device ID
            let deviceId = localStorage.getItem('wfc_device_id');
            if (!deviceId) {
                deviceId = 'wfc_dev_' + Math.random().toString(36).substring(2, 15) + Date.now();
                localStorage.setItem('wfc_device_id', deviceId);
            }

        } catch (error) {
            console.error("Registration failed:", error);
            this.showError('Linking Failed', 'Connectivity error. Please scan again.');
        }
    },

    saveProfile: async function () {
        const newUsername = document.getElementById('setup-username').value.trim();
        const newPin = document.getElementById('setup-pin').value.trim();
        const deviceId = localStorage.getItem('wfc_device_id');

        if (newUsername.length < 3) { alert("Username too short"); return; }
        if (newPin.length !== 4) { alert("PIN must be 4 digits"); return; }
        if (!deviceId) { alert("Device ID missing. Please restart registration."); return; }

        try {
            this.setStatus("Finalizing Security...", false);

            await db.collection('staff').doc(this.staffId).update({
                username: newUsername,
                pin: newPin,
                deviceId: deviceId, // SAVING THE DEVICE ID HERE
                profileSetupAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.showSuccess('Setup Complete!', 'Your phone is now authorized. You can now use the gym Kiosk to clock in.');

            setTimeout(() => { window.location.href = "attendance.html"; }, 3000);

        } catch (err) {
            console.error(err);
            alert("Failed to save changes. Check internet.");
        }
    },

    press: function (num) {
        if (this.pin.length < 4) {
            this.pin += num;
            this.updateDots();
            if (this.pin.length === 4) this.submitAttendance();
        }
    },

    clear: function () {
        this.pin = '';
        this.updateDots();
        this.setStatus('');
    },

    updateDots: function () {
        const dots = document.querySelectorAll('.pin-dot');
        dots.forEach((dot, index) => {
            index < this.pin.length ? dot.classList.add('filled') : dot.classList.remove('filled');
        });
    },

    setStatus: function (msg, isError = false) {
        const el = document.getElementById('status-msg');
        if (el) {
            el.textContent = msg;
            el.style.color = isError ? '#ff3333' : '#00ff88';
        }
    },

    showError: function (title, msg) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('pin-view').style.display = 'none';
        document.getElementById('setup-view').style.display = 'none';
        document.getElementById('error-view').style.display = 'block';
        document.getElementById('error-title').textContent = title;
        document.getElementById('error-msg').textContent = msg;
    },

    showSuccess: function (title, msg) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('pin-view').style.display = 'none';
        document.getElementById('setup-view').style.display = 'none';
        document.getElementById('error-view').style.display = 'block';
        document.getElementById('error-title').textContent = title;
        document.getElementById('error-title').style.color = '#00ff88';
        document.getElementById('error-msg').textContent = msg;
    },

    submitAttendance: async function () {
        this.setStatus("Verifying...", false);
        const deviceId = localStorage.getItem('wfc_device_id');

        try {
            // Find staff with this Device ID and PIN in the STAFF collection
            const staffSnap = await db.collection('staff')
                .where('deviceId', '==', deviceId)
                .where('pin', '==', this.pin)
                .get();

            if (staffSnap.empty) {
                throw new Error("Invalid PIN or Device Unrecognized.");
            }

            const staffDoc = staffSnap.docs[0];
            const staff = staffDoc.data();

            // Log the attendance
            await db.collection('attendance_logs').add({
                staffId: staffDoc.id,
                staffName: `${staff.firstName} ${staff.lastName}`,
                action: 'Clock In',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                date: new Date().toLocaleDateString('en-US'),
                deviceId: deviceId // Log the device used for the clock-in as well
            });

            this.setStatus("Success! Clocked In.", false);
            if (navigator.vibrate) navigator.vibrate(200);

            setTimeout(() => {
                window.location.href = "attendance.html?status=success";
            }, 1000);

        } catch (error) {
            console.error(error);
            this.setStatus("Verification Failed.", true);
            const dots = document.querySelector('.pin-display');
            if (dots) {
                dots.classList.add('shake');
                setTimeout(() => {
                    dots.classList.remove('shake');
                    this.clear();
                }, 1000);
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AttendanceClient.init();
});
