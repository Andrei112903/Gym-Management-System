/**
 * checkin.js
 * Handles Member Check-In Logic
 */

const CheckInController = {
    init: function () {
        console.log("CheckIn Controller Init");
        this.bindEvents();
        this.loadRecent();
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

            if (isExpired) {
                this.showStatus('expired', 'Membership Expired', `${member.name}<br>${member.package} expired on ${member.expiryDate}`);
                // Optional: Play Error Sound
            } else {
                this.showStatus('valid', 'Access Granted', `${member.name}<br>${member.package} valid until ${member.expiryDate}`);

                // TODO: Log Visit in DB
                this.addToRecent(member.name, 'Success');
            }

        } catch (e) {
            console.error(e);
            alert("Error checking in: " + e.message);
        }
    },

    showStatus: function (type, title, message) {
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
            // Default grey style for error
        }

        div.classList.add(colorClass);
        div.innerHTML = `
            <div class="status-icon">${icon}</div>
            <h2>${title}</h2>
            <h3 class="member-name-large">${message.split('<br>')[0]}</h3>
            <p class="member-details-large">${message.split('<br>')[1] || ''}</p>
            <p style="margin-top:2rem; font-size:0.9rem; color:var(--text-muted);">
                ${new Date().toLocaleTimeString()}
            </p>
        `;

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
