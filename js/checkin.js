/**
 * checkin.js
 * Handles Member Check-In Logic
 */

const CheckInController = {
    init: function () {
        console.log("CheckIn Controller Init");
        this.bindEvents();
        this.loadRecent();
        this.initScanner();
    },

    openTodayModal: async function () {
        const modal = document.getElementById('checkin-modal');
        const list = document.getElementById('checkin-list');
        if (!modal || !list) return;

        modal.style.display = 'flex';
        list.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Loading records...</div>';

        const today = new Date().toISOString().split('T')[0];
        const records = await Store.getCheckIns(today);

        if (!records || records.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">No check-ins found for today.</div>';
            return;
        }

        list.innerHTML = records.map(r => {
            const time = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const statusColor = r.status === 'valid' ? '#00ff88' : '#ff3333';
            return `
                <div style="display:flex; align-items:center; padding:15px; background:rgba(255,255,255,0.05); border-radius:10px; border-left:4px solid ${statusColor};">
                    <div style="flex:1;">
                        <div style="color:white; font-weight:bold; font-size:1.1rem;">${r.memberName || 'Unknown'}</div>
                        <div style="color:var(--text-muted); font-size:0.85rem;">ID: ${r.memberId}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="color:white; font-weight:600;">${time}</div>
                        <div style="color:${statusColor}; font-size:0.8rem; text-transform:uppercase;">${r.statusText || 'Checked In'}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    closeModal: function () {
        const modal = document.getElementById('checkin-modal');
        if (modal) modal.style.display = 'none';
    },

    bindEvents: function () {
        const input = document.getElementById('checkinInput');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.handleCheckIn(input.value);
                    input.value = ''; // Clear after enter
                }
            });
        }
    },

    html5QrcodeScanner: null,
    isScanning: false,
    lastScanTime: 0, // Debounce timestamp

    initScanner: function () {
        // Toggle Button Logic
        const toggleBtn = document.getElementById('btn-toggle-camera');
        if (toggleBtn) {
            toggleBtn.onclick = () => {
                if (this.isScanning) {
                    this.stopScanner();
                    toggleBtn.textContent = "📷 Start Camera";
                } else {
                    this.startScanner();
                    toggleBtn.textContent = "⏹ Stop Camera";
                }
            };
        }
    },

    startScanner: function () {
        // 1. Pre-check: Are there any cameras?
        Html5Qrcode.getCameras().then(devices => {
            if (devices && devices.length) {
                // Camera found, proceed!
                this.launchScanner();
            } else {
                // No camera found
                alert("No camera detected on this device. You can verify check-in by typing the ID manually.");
                document.getElementById('btn-toggle-camera').textContent = "📷 Start Camera";
                this.isScanning = false;
            }
        }).catch(err => {
            // Permission denied or unsecure context (http)
            console.warn("Camera check failed", err);

            // UX Improvement: Don't alert() widely. Just show in the UI.
            const reader = document.getElementById('reader');
            if (reader) {
                reader.innerHTML = `<div style="padding:2rem; color:red; border:1px dashed red;">
                    <p>Camera access denied or no camera found.</p>
                    <p style="font-size:0.8rem; color:var(--text-muted);">Error: ${err.message || err}</p>
                    <p style="margin-top:10px; color:white;">👉 Use the search bar below to check in manually.</p>
                </div>`;
            }

            document.getElementById('btn-toggle-camera').textContent = "📷 Start Camera";
            this.isScanning = false;
        });
    },

    launchScanner: async function () {
        const reader = document.getElementById('reader');
        if (!reader) return;

        // CRITICAL FIX: Ensure previous scanner is gone before starting new one
        if (this.html5QrcodeScanner) {
            try {
                await this.html5QrcodeScanner.clear();
            } catch (e) {
                console.warn("Cleanup error:", e);
            }
            this.html5QrcodeScanner = null;
        }

        // Reset debounce
        this.lastScanTime = 0;

        this.html5QrcodeScanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 15, // Smooth but not overloading
                qrbox: { width: 300, height: 300 }, // Larger target
                aspectRatio: 1.0,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true // Native Chip = INSTANT
                },
                videoConstraints: {
                    facingMode: "environment",
                    width: { ideal: 1280 }, // HD for clarity
                }
            },
            /* verbose= */ false
        );

        this.html5QrcodeScanner.render(
            (decodedText, decodedResult) => {
                // Success Callback
                const now = Date.now();
                // 3 Second Cooldown to prevent spamming
                if (now - this.lastScanTime < 3000) {
                    return;
                }
                this.lastScanTime = now;

                console.log(`Scan result: ${decodedText}`);

                // 1. Play Sound
                this.playBeep();

                // 2. Process Check-in
                this.handleCheckIn(decodedText);

                // NOTE: We do NOT stop the scanner anymore.
                // It stays open for the next person.
            },
            (errorMessage) => {
                // Parse error, ignore common ones like "no QR found"
                if (errorMessage.includes("NotFound")) {
                    // Only log real errors, not "scanning..." noise
                    // console.warn("Scanner Error:", errorMessage);
                }
            }
        );
        this.isScanning = true;
    },

    playBeep: function () {
        try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(context.destination);

            oscillator.type = "sine";
            oscillator.frequency.value = 880; // High beep
            gainNode.gain.value = 0.1; // Volume

            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                context.close(); // Clean up
            }, 200); // 200ms beep
        } catch (e) {
            console.error("Audio beep failed", e);
        }
    },

    stopScanner: function () {
        if (this.html5QrcodeScanner) {
            this.html5QrcodeScanner.clear().then(() => {
                this.isScanning = false;
                console.log("Scanner stopped");
                // Remove the "Stop Scanning" button generated by lib if needed
            }).catch(error => {
                console.error("Failed to clear scanner", error);
            });
        }
    },

    handleCheckIn: async function (query) {
        // 1. Find Member
        const resultDiv = document.getElementById('statusResult');
        resultDiv.style.display = 'none'; // Reset

        if (!query) return;

        try {
            const members = await Store.getMembers();
            // Search Logic (Exact ID match OR Name includes)
            // Prioritize Exact ID for barcode scanners
            let member = members.find(m => m.id === query);

            if (!member) {
                // Fallback to name search
                const lowerQ = query.toLowerCase();
                member = members.find(m => m.name.toLowerCase().includes(lowerQ));
            }

            if (!member) {
                this.showStatus('error', 'Member Not Found', `No record for "${query}"`);
                return;
            }

            // 2. Validate Membership
            const today = new Date().toISOString().split('T')[0];
            const isExpired = member.expiryDate < today;

            // Re-render status with member ID context for button
            if (isExpired) {
                this.showStatus('expired', 'Membership Expired', `${member.name}<br>${member.package} expired on ${member.expiryDate}`, member.id);
                // Optional: Play Error Sound

                // Also log failed attempts? Yes, for security/records
                Store.addCheckIn({
                    memberId: member.id,
                    memberName: member.name,
                    status: 'expired',
                    statusText: 'Membership Expired'
                });
            } else {
                this.showStatus('valid', 'Access Granted', `${member.name}<br>${member.package} valid until ${member.expiryDate}`);

                // Log Visit in DB
                const checkInData = {
                    memberId: member.id,
                    memberName: member.name,
                    status: 'valid',
                    statusText: 'Access Granted'
                };

                Store.addCheckIn(checkInData);
                this.addToRecent(member.name, 'Success');
            }

        } catch (e) {
            console.error(e);
            alert("Error checking in: " + e.message);
        }
    },

    showStatus: function (type, title, message, memberId = null) {
        const div = document.getElementById('statusResult');
        div.className = 'status-display'; // Reset classes
        div.innerHTML = ''; // Clear

        let icon = '';
        let colorClass = '';

        if (type === 'valid') {
            icon = '✅';
            colorClass = 'status-valid';
        } else if (type === 'expired') {
            icon = '⛔';
            colorClass = 'status-expired';
        } else {
            icon = '❓';
            colorClass = 'status-error'; // Fallback class
        }

        if (colorClass) div.classList.add(colorClass);
        div.innerHTML = `
            <div class="status-icon">${icon}</div>
            <h2>${title}</h2>
            <h3 class="member-name-large">${message.split('<br>')[0]}</h3>
            <p class="member-details-large">${message.split('<br>')[1] || ''}</p>
            <p style="margin-top:2rem; font-size:0.9rem; color:var(--text-muted);">
                ${new Date().toLocaleTimeString()}
            </p>
        `;

        // ADDED: Quick Renew Button
        if (type === 'expired' && memberId) {
            div.innerHTML += `
                <div style="margin-top:20px;">
                    <a href="members.html?action=renew&id=${memberId}" class="cta-button" style="text-decoration:none; background:white; color:red; border:none; padding:10px 20px; font-weight:bold; border-radius:30px;">
                        Renew Membership
                    </a>
                </div>
            `;
        }

        div.style.display = 'block';
    },

    loadRecent: function () {
        // Load recent checkins from local session for now
    },

    addToRecent: function (name, status) {
        const list = document.getElementById('recentList');
        const recentDiv = document.getElementById('recentLog');
        recentDiv.style.display = 'block';

        const row = document.createElement('div');
        row.style.padding = '10px';
        row.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        row.innerHTML = `<span style="color:var(--gold)">${new Date().toLocaleTimeString()}</span> - <strong>${name}</strong>`;

        list.prepend(row);
    }
};

document.addEventListener('DOMContentLoaded', () => CheckInController.init());
