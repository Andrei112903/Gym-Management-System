/**
 * Winners Fit Camp - Member Controller
 * Handles Member List rendering and Registration.
 * Updated for Async Firebase Calls
 */

const MemberController = {
    init: async function () {
        console.log('MemberController Initializing...');
        if (!window.Store || !window.db) {
            alert("Critical Error: Database not initialized. Please refresh.");
            return;
        }
        try {
            await this.renderTable();
            await this.populatePackages();
            this.bindEvents();
        } catch (e) {
            console.error('MemberController Init Error:', e);
            alert("Error loading members: " + e.message);
        }
    },

    bindEvents: function () {
        const form = document.getElementById('addMemberForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegistration(new FormData(form));
            });
        }
    },

    // --- UI Toggles ---
    showAddForm: function () {
        const listView = document.getElementById('members-list-view');
        const addView = document.getElementById('members-add-view');
        if (listView) listView.style.display = 'none';
        if (addView) addView.style.display = 'block';
    },

    showList: function () {
        const listView = document.getElementById('members-list-view');
        const addView = document.getElementById('members-add-view');
        if (listView) listView.style.display = 'block';
        if (addView) addView.style.display = 'none';
        this.renderTable(); // Refresh on return
    },

    // --- Data Logic ---
    renderTable: async function () {
        const tbody = document.getElementById('membersTableBody');
        if (!tbody) {
            console.error('CRITICAL: membersTableBody not found in DOM');
            return;
        }

        try {
            // Show Loading State
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--gold);">Loading members from database...</td></tr>';

            // ASYNC Call to Store (Firebase)
            // Note: We might want to clear cache here to be safe if we rely on realtime updates,
            // but for now let's trust the store (which might fetch fresh).
            const members = await Store.getMembers();
            console.log('Render Table Data:', members);

            if (!members || members.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No members found. Click "+ New Member" to add one.</td></tr>';
                return;
            }

            const today = new Date().toISOString().split('T')[0];

            const html = members.map(m => {
                // Auto-Expire Logic
                let displayStatus = m.status;
                let statusClass = m.status === 'Active' ? 'status-active' : 'status-expired';

                if (m.expiryDate < today && m.status === 'Active') {
                    displayStatus = 'Expired';
                    statusClass = 'status-expired';
                }

                return `
                <tr>
                    <td>#${m.id ? m.id.substring(0, 6) : '???'}...</td>
                    <td style="font-weight:600; color:white;">${m.name}</td>
                    <td>${m.package}</td>
                    <td>${m.expiryDate}</td>
                    <td><span class="status-badge ${statusClass}">${displayStatus}</span></td>
                    <td>
                        <button class="cta-button" onclick="MemberController.viewMember('${m.id}')" 
                            style="padding:5px 10px; font-size:0.7rem; background:var(--glass-border);">View</button>
                    </td>
                </tr>
            `}).join('');

            tbody.innerHTML = html;

        } catch (err) {
            console.error('Error in renderTable:', err);
            tbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Error: ${err.message}</td></tr>`;
        }
    },

    // --- Modal Logic ---
    currentMemberId: null,

    viewMember: async function (id) {
        try {
            const members = await Store.getMembers();
            const member = members.find(m => m.id === id);
            if (!member) {
                alert("Member not found!");
                return;
            }

            this.currentMemberId = id;

            // Populate Modal
            document.getElementById('modal-name').textContent = member.name;
            document.getElementById('modal-package').textContent = member.package;
            document.getElementById('modal-expiry').textContent = member.expiryDate;
            document.getElementById('modal-phone').textContent = member.phone || 'N/A';

            // Re-calc Status for Modal too
            const today = new Date().toISOString().split('T')[0];
            let status = member.status;
            if (member.expiryDate < today) status = 'Expired';

            const statusEl = document.getElementById('modal-status');
            statusEl.textContent = status;
            statusEl.className = status === 'Active' ? 'status-badge status-active' : 'status-badge status-expired';

            // Show
            document.getElementById('member-details-modal').style.display = 'block';

            // Bind Delete
            const delBtn = document.getElementById('btn-delete-member');
            delBtn.onclick = () => this.deleteMember(id);

        } catch (e) {
            console.error(e);
            alert("Error viewing member");
        }
    },

    closeModal: function () {
        document.getElementById('member-details-modal').style.display = 'none';
        this.currentMemberId = null;
    },

    deleteMember: async function (id) {
        if (!confirm("Are you sure you want to PERMANENTLY delete this member?")) return;

        try {
            // Optimistic call via Store
            await Store.deleteMember(id);

            alert("Member deleted.");
            this.closeModal();
            this.renderTable();
        } catch (e) {
            console.error("Delete failed:", e);
            alert("Delete failed: " + e.message);
        }
    },

    populatePackages: async function () {
        const select = document.getElementById('packageSelect');
        if (!select) return;

        try {
            // ASYNC Call
            const packages = await Store.getPackages();
            console.log("Packages loaded:", packages);

            if (!packages || packages.length === 0) {
                select.innerHTML = '<option value="">No Packages Found</option>';
                return;
            }

            select.innerHTML = '<option value="" disabled selected>Select a Package</option>' +
                packages.map(p => `
                <option value="${p.id}">${p.name} - ₱${p.price}</option>
            `).join('');
        } catch (err) {
            console.error('Error loading packages:', err);
            select.innerHTML = '<option value="">Error loading packages</option>';
        }
    },

    handleRegistration: async function (formData) {
        const btn = document.querySelector('#addMemberForm button[type="submit"]');

        try {
            if (btn) { btn.disabled = true; btn.textContent = "Validating..."; }

            // Timeout Helper
            const withTimeout = (promise, ms = 10000) => {
                return Promise.race([
                    promise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out - Check internet connection")), ms))
                ]);
            };

            // 1. Get Packages (Fast, cached)
            const packages = await withTimeout(Store.getPackages(), 5000);
            const selectedVal = formData.get('package');
            const selectedPackage = packages.find(p => p.id === selectedVal);

            if (!selectedPackage) {
                // Fallback: Try to parse from select option text if DB fetch failed/mismatched? 
                // For now, simple error.
                throw new Error("Invalid Package Selected. Please refresh.");
            }

            if (btn) btn.textContent = "Saving...";

            // 2. Calculate Expiry
            const today = new Date();
            const expiry = new Date();
            expiry.setDate(today.getDate() + selectedPackage.duration);

            const newMember = {
                name: formData.get('name'),
                email: formData.get('email'),
                package: selectedPackage.name,
                expiryDate: expiry.toISOString().split('T')[0],
                phone: formData.get('phone')
            };

            // 3. Add to DB
            console.log("Sending to DB:", newMember);
            await withTimeout(Store.addMember(newMember), 15000);

            alert(`Success! Member registered.`);

            // Reset and show list
            document.getElementById('addMemberForm').reset();
            this.showList();
        } catch (e) {
            console.error("Registration Error:", e);
            alert('Registration Failed: ' + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = "Confirm Registration"; }
        }
    }
};

// Auto-init when loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => MemberController.init(), 500); // Give Firebase a moment
});

// Expose for onClick handlers in HTML
window.MemberController = MemberController;
