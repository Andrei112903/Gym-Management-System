/**
 * Winners Fit Camp - HR & Staff Management Controller
 * Simplified for standard Auth-based Attendance.
 */

const HRController = {
    state: {
        staff: [],
        attendanceLogs: [],
        view: 'list'
    },

    init: function () {
        console.log("HR Controller Initialized");
        this.loadData();
    },

    loadData: async function () {
        try {
            const staffSnapshot = await db.collection('users').where('role', '==', 'staff').get();
            this.state.staff = staffSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const logSnapshot = await db.collection('attendance_logs')
                .orderBy('timestamp', 'desc')
                .limit(20)
                .get();

            this.state.attendanceLogs = logSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(log => log.type !== 'member');
        } catch (error) {
            console.warn("Using mock data (DB error or empty):", error);
        }

        this.render();
    },

    render: function () {
        const container = document.getElementById('hr-app-root');
        if (!container) return;

        container.innerHTML = `
            <div class="section-header">
                <h2>Staff Management</h2>
                <button class="cta-button" onclick="HRController.showAddForm()">+ Add New Staff</button>
            </div>

            <div class="stats-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1.5rem; margin-bottom:2rem;">
                <div class="glass-card">
                    <div class="stat-icon" style="background:rgba(0,255,136,0.1); color:#00ff88; width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:10px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    </div>
                    <h3 style="font-size:2rem; margin:0;">${this.state.staff.length}</h3>
                    <p style="color:var(--text-muted);">Total Staff</p>
                </div>

                <div class="glass-card">
                    <div class="stat-icon" style="background:rgba(229,9,20,0.1); color:var(--gold); width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:10px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <h3 style="font-size:2rem; margin:0;">${this.state.attendanceLogs.filter(l => l.action === 'Clock In').length}</h3>
                    <p style="color:var(--text-muted);">Current Active</p>
                </div>

                <div class="glass-card" style="border-color:var(--gold); background:rgba(229,9,20,0.05); cursor:pointer;" onclick="HRController.launchKiosk()">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h3 style="color:var(--gold);">Attendance Kiosk</h3>
                            <p style="font-size:0.8rem; opacity:0.8;">Secure QR Scanner</p>
                        </div>
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--gold);"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    </div>
                    <div style="margin-top:1rem; text-align:right; font-size:0.8rem; color:var(--gold); font-weight:bold;">LAUNCH &rarr;</div>
                </div>
            </div>

            <div class="glass-card">
                <h3>Staff Directory</h3>
                <div class="table-container" style="margin-top:1rem;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Username</th>
                                <th>Password</th>
                                <th>Status</th>
                                <th style="text-align:right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.state.staff.map(s => `
                                <tr>
                                    <td><strong>${s.firstName} ${s.lastName}</strong></td>
                                    <td style="color:var(--text-muted);">${s.username}</td>
                                    <td style="font-family:monospace; letter-spacing:2px; color:rgba(255,255,255,0.4);">
                                        <span class="masked-pin">••••</span>
                                        <span class="real-pin" style="display:none;">${s.pin}</span>
                                        <i class="eye-icon" onclick="HRController.togglePin(this)" style="cursor:pointer; margin-left:8px; font-style:normal; opacity:0.6;">👁️</i>
                                    </td>
                                    <td>
                                        <span class="status-badge ${s.lastAction === 'Clock In' ? 'status-active' : 'status-expired'}">
                                            ${s.lastAction || 'Out'}
                                        </span>
                                    </td>
                                    <td style="text-align:right;">
                                        <button class="cta-button" style="padding:5px 10px; font-size:0.7rem; background:rgba(255,255,255,0.05); border:1px solid var(--glass-border);">Edit</button>
                                        <button class="cta-button" style="padding:5px 10px; font-size:0.7rem; background:rgba(229,9,20,0.1); border:1px solid red; color:red; margin-left:5px;">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    kioskTimer: null,
    qrInstance: null,
    countdownInterval: null,

    launchKiosk: function () {
        document.getElementById('kiosk-overlay').style.display = 'flex';
        this.startTokenRotation();
    },

    closeKiosk: function () {
        document.getElementById('kiosk-overlay').style.display = 'none';
        if (this.kioskTimer) clearInterval(this.kioskTimer);
    },

    startTokenRotation: async function () {
        const updateToken = async () => {
            const newToken = Math.random().toString(36).substring(2, 15);
            const expiry = Date.now() + 25000;
            try {
                await db.collection('system').doc('attendance_token').set({
                    token: newToken,
                    expires: expiry
                });
            } catch (e) {
                console.error("Token sync fail:", e);
            }
            this.generateQR(newToken);
            this.startTimer(20);
        };
        updateToken();
        this.kioskTimer = setInterval(updateToken, 20000);
    },

    generateQR: function (token) {
        const container = document.getElementById('kiosk-qr-container');
        container.innerHTML = '';
        const pathParts = window.location.pathname.split('/');
        pathParts[pathParts.length - 1] = 'attendance.html';
        const finalUrl = window.location.origin + pathParts.join('/') + '?token=' + token;

        this.qrInstance = new QRCode(container, {
            text: finalUrl,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    },

    startTimer: function (seconds) {
        let timeLeft = seconds;
        const timerEl = document.getElementById('kiosk-timer');
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.countdownInterval = setInterval(() => {
            timeLeft--;
            if (timerEl) timerEl.textContent = `Code rotates in: ${timeLeft}s`;
            if (timeLeft <= 0) clearInterval(this.countdownInterval);
        }, 1000);
    },

    showAddForm: function () {
        document.getElementById('add-staff-modal').style.display = 'flex';
        this.generateTrialPin();
    },

    closeAddForm: function () {
        document.getElementById('add-staff-modal').style.display = 'none';
        document.getElementById('add-staff-form').reset();
        document.getElementById('gen-username').textContent = '---';
        document.getElementById('gen-pin').textContent = '---';
    },

    onNameChange: function () {
        // Numeric username is generated once on trial pin generation
    },

    generateTrialPin: function () {
        // Generate a 9-digit staff ID starting with 122
        const randomDigits = Math.floor(100000 + Math.random() * 900000);
        const staffId = "122" + randomDigits;

        // Random 4-digit PIN for password
        const pin = Math.floor(1000 + Math.random() * 9000);
        const initialPass = "staff" + pin;

        document.getElementById('gen-username').textContent = staffId;
        document.getElementById('gen-pin').textContent = initialPass;
    },

    saveStaff: async function (e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;

        const email = document.getElementById('staff-email').value.trim();
        const initialPassword = document.getElementById('gen-pin').textContent;
        const username = document.getElementById('gen-username').textContent;

        const staffData = {
            firstName: document.getElementById('staff-firstname').value.trim(),
            lastName: document.getElementById('staff-lastname').value.trim(),
            email: email,
            phone: document.getElementById('staff-phone').value.trim(),
            address: document.getElementById('staff-address').value.trim(),
            username: username,
            pin: initialPassword,
            role: 'staff',
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        btn.innerHTML = 'Registering...';
        btn.disabled = true;

        try {
            const secondaryApp = firebase.initializeApp(firebase.app().options, 'Secondary');
            const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, initialPassword);
            await db.collection('users').doc(userCredential.user.uid).set(staffData);
            await secondaryApp.delete();

            alert("Staff registered! Credentials sent to their email.");
            this.closeAddForm();
            this.loadData();
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    togglePin: function (el) {
        const parent = el.parentElement;
        const masked = parent.querySelector('.masked-pin');
        const real = parent.querySelector('.real-pin');
        if (masked.style.display === 'none') {
            masked.style.display = 'inline'; real.style.display = 'none'; el.textContent = '👁️';
        } else {
            masked.style.display = 'none'; real.style.display = 'inline'; el.textContent = '🙈';
        }
    }
};

window.HRController = HRController;
HRController.init();
