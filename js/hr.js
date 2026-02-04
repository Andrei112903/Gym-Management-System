/**
 * Winners Fit Camp - HR & Staff Management Controller
 */

const HRController = {
    state: {
        staff: [],
        attendanceLogs: [],
        view: 'list' // 'list' or 'add'
    },

    init: function () {
        console.log("HR Controller Initialized");
        this.loadData();
    },

    loadData: async function () {
        try {
            // Load Staff
            const staffSnapshot = await db.collection('staff').orderBy('createdAt', 'desc').get();
            this.state.staff = staffSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Load Attendance Logs (last 10)
            const logSnapshot = await db.collection('attendance_logs').orderBy('timestamp', 'desc').limit(10).get();
            this.state.attendanceLogs = logSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
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
                    <p style="color:var(--text-muted);">Recent Activity</p>
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

            <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1.5rem;">
                <div class="glass-card">
                    <h3>Staff Directory</h3>
                    <div class="table-container" style="margin-top:1rem;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Username</th>
                                    <th>PIN</th>
                                    <th>Status</th>
                                    <th style="text-align:right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.state.staff.map(s => `
                                    <tr>
                                        <td><strong>${s.firstName} ${s.lastName}</strong></td>
                                        <td style="color:var(--text-muted);">${s.username}</td>
                                        <td style="font-family:monospace; letter-spacing:2px;">${s.pin}</td>
                                        <td><span class="status-badge status-${s.status}">${s.status}</span></td>
                                        <td style="text-align:right;">
                                            <button class="cta-button" onclick="HRController.showRegisterModal('${s.id}', '${s.firstName} ${s.lastName}')" 
                                                style="padding: 5px 10px; font-size: 0.7rem; background: rgba(0,255,136,0.1); border: 1px solid #00ff88; color: #00ff88;">
                                                Register Device
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                                ${this.state.staff.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">No staff सदस्यों found.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="glass-card">
                    <h3>Recent Logs</h3>
                    <div style="margin-top:1rem; display:flex; flex-direction:column; gap:10px;">
                        ${this.state.attendanceLogs.map(log => `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px;">
                                <div><div style="font-weight:bold; font-size:0.9rem;">${log.staffName}</div><div style="font-size:0.75rem; color:var(--text-muted);">${log.action}</div></div>
                                <div style="text-align:right;"><div style="color:var(--gold); font-weight:bold;">${log.time}</div></div>
                            </div>
                        `).join('')}
                        ${this.state.attendanceLogs.length === 0 ? '<p style="color:var(--text-muted); text-align:center;">No logs today.</p>' : ''}
                    </div>
                </div>
            </div>
        `;
    },

    // --- Kiosk Logic ---
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
                console.error("Failed to sync token:", e);
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
        const baseUrl = window.location.origin + window.location.pathname.replace('hr.html', 'attendance.html');
        const finalUrl = `${baseUrl}?token=${token}`;

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

    // --- Device Registration ---
    showRegisterModal: function (staffId, staffName) {
        const modal = document.getElementById('register-device-modal');
        const container = document.getElementById('register-qr-container');
        const nameEl = document.getElementById('register-staff-name');

        modal.style.display = 'flex';
        nameEl.textContent = staffName;
        container.innerHTML = '';

        const baseUrl = window.location.origin + window.location.pathname.replace('hr.html', 'attendance.html');
        const registrationUrl = `${baseUrl}?action=register&staffId=${staffId}&token=${Math.random().toString(36).substring(2)}`;

        new QRCode(container, {
            text: registrationUrl,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
        });
    },

    closeRegisterModal: function () {
        document.getElementById('register-device-modal').style.display = 'none';
    },

    // --- Staff Management ---
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
        const fn = document.getElementById('staff-firstname').value.trim().toLowerCase();
        const ln = document.getElementById('staff-lastname').value.trim().toLowerCase();
        if (fn || ln) {
            const username = (fn && ln) ? `${fn}.${ln}` : (fn || ln);
            document.getElementById('gen-username').textContent = username;
        }
    },

    generateTrialPin: function () {
        const pin = Math.floor(1000 + Math.random() * 9000);
        document.getElementById('gen-pin').textContent = pin;
    },

    saveStaff: async function (e) {
        e.preventDefault();
        const staffData = {
            firstName: document.getElementById('staff-firstname').value.trim(),
            lastName: document.getElementById('staff-lastname').value.trim(),
            email: document.getElementById('staff-email').value.trim(),
            phone: document.getElementById('staff-phone').value.trim(),
            address: document.getElementById('staff-address').value.trim(),
            username: document.getElementById('gen-username').textContent,
            pin: document.getElementById('gen-pin').textContent,
            role: 'staff',
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!staffData.phone.startsWith('09') || staffData.phone.length !== 11) {
            alert("Contact Number must start with 09 and be exactly 11 digits.");
            return;
        }

        try {
            await db.collection('staff').add(staffData);
            alert("Staff successfully registered!");
            this.closeAddForm();
            this.loadData();
        } catch (err) {
            console.error(err);
            alert("Error saving staff record.");
        }
    }
};

window.HRController = HRController;
