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
            this.bindSearch(); // Ensure search is bound
            this.bindEvents(); // Bind form events

            // Check for URL Params (Deep Linking)
            await this.handleUrlParams();

            // Check auth state for debugging
            console.log("Current User:", window.AuthService ? AuthService.getCurrentUser() : "AuthService missing");
        } catch (e) {
            console.error('MemberController Init Error:', e);
            alert("Error loading members: " + e.message);
        }
    },

    bindSearch: function () {
        const searchInput = document.getElementById('memberSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.renderTable(e.target.value);
            });

            // Add Enter Key Shortcut
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const firstViewBtn = document.querySelector('#membersTableBody button');
                    if (firstViewBtn) {
                        firstViewBtn.click();
                        searchInput.blur(); // Remove focus from search
                    }
                }
            });
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
    renderTable: async function (filterText = '') {
        const tbody = document.getElementById('membersTableBody');
        if (!tbody) {
            console.error('CRITICAL: membersTableBody not found in DOM');
            return;
        }

        try {
            // Show Loading State only if not filtering (filtering should be instant-ish)
            if (!filterText) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--gold);">Loading members from database...</td></tr>';

            // ASYNC Call to Store (Firebase)
            const members = await Store.getMembers();

            // FILTER LOGIC
            let displayMembers = members;
            if (filterText) {
                const term = filterText.toLowerCase();
                displayMembers = members.filter(m =>
                    (m.name && m.name.toLowerCase().includes(term)) ||
                    (m.id && m.id.toLowerCase().includes(term))
                );
            }

            console.log('Rendering members count:', displayMembers.length);

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
        console.log("Viewing Member ID:", id); // DEBUG
        try {
            const members = await Store.getMembers();
            // console.log("Available IDs:", members.map(m => m.id)); // DEBUG - Uncomment if needed, lots of spam

            // Try strict match first
            let member = members.find(m => m.id === id);

            // Fallback: Try loose match (in case of string/int mismatch)
            if (!member) {
                console.warn("Strict match failed for ID:", id);
                member = members.find(m => m.id == id);
            }

            if (!member) {
                console.error("Member not found in store!", id);
                alert("Member not found! ID: " + id);
                return;
            }

            this.currentMemberId = id;

            // Populate Modal View
            document.getElementById('modal-name').textContent = member.name;
            document.getElementById('modal-package').textContent = member.package;
            document.getElementById('modal-expiry').textContent = member.expiryDate;
            document.getElementById('modal-phone').textContent = member.phone || 'N/A';

            // Populate Modal Edit Inputs
            document.getElementById('edit-name').value = member.name;
            document.getElementById('edit-expiry').value = member.expiryDate;
            document.getElementById('edit-phone').value = member.phone || '';

            // Populate Edit Package Select
            const packSelect = document.getElementById('edit-package');
            packSelect.innerHTML = document.getElementById('packageSelect').innerHTML; // Clone options
            // Try to set value by text match since we stored Package Name, not ID (Legacy choice)
            // Ideally we should fix DB to store ID, but for now loop options
            for (let i = 0; i < packSelect.options.length; i++) {
                if (packSelect.options[i].text.includes(member.package)) {
                    packSelect.selectedIndex = i;
                    break;
                }
            }

            // Re-calc Status
            const today = new Date().toISOString().split('T')[0];
            let status = member.status;
            if (member.expiryDate < today) status = 'Expired';

            const statusEl = document.getElementById('modal-status');
            statusEl.textContent = status;
            statusEl.className = status === 'Active' ? 'status-badge status-active' : 'status-badge status-expired';

            // Reset UI to View Mode
            this.disableEditMode();

            // Show first (required for QR rendering in some browsers)
            document.getElementById('member-details-modal').style.display = 'block';

            // GENERATE QR CODE
            // Small timeout to ensure DOM render
            setTimeout(() => this.generateQR(member.id), 200);

            // Bind Delete
            const delBtn = document.getElementById('btn-delete-member');
            delBtn.onclick = () => this.deleteMember(id);

        } catch (e) {
            console.error(e);
            alert("Error viewing member");
        }
    },

    generateQR: function (text) {
        const container = document.getElementById('qrcode');
        if (!container) return;

        container.innerHTML = ''; // Clear previous

        if (typeof QRCode === 'undefined') {
            container.innerHTML = '<span style="color:red; font-size:0.8rem;">Library not loaded</span>';
            console.error("QRCode library missing");
            return;
        }

        try {
            // Create QR
            new QRCode(container, {
                text: text,
                width: 128,
                height: 128,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        } catch (e) {
            console.error("QR Generation failed:", e);
            container.innerText = "Error generating QR";
        }
    },

    enableEditMode: function () {
        document.getElementById('modal-view-mode').style.display = 'none';
        document.getElementById('modal-edit-mode').style.display = 'block';
        document.getElementById('modal-actions-view').style.display = 'none';
        document.getElementById('modal-actions-edit').style.display = 'block';
    },

    disableEditMode: function () {
        document.getElementById('modal-view-mode').style.display = 'block';
        document.getElementById('modal-edit-mode').style.display = 'none';
        document.getElementById('modal-actions-view').style.display = 'block';
        document.getElementById('modal-actions-edit').style.display = 'none';
    },

    saveEdit: async function () {
        const id = this.currentMemberId;
        const btn = document.getElementById('btn-save-edit');
        if (!id) return;

        // 1. UI Loading State
        const originalText = btn ? btn.innerText : 'Save Changes';
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Saving...";
        }

        const updates = {
            name: document.getElementById('edit-name').value,
            phone: document.getElementById('edit-phone').value,
            expiryDate: document.getElementById('edit-expiry').value
        };

        // Package Special Logic
        const packSelect = document.getElementById('edit-package');
        if (packSelect.selectedIndex >= 0) {
            const text = packSelect.options[packSelect.selectedIndex].text;
            updates.package = text.split(' - ')[0].trim();
        }

        try {
            await Store.updateMember(id, updates);

            // Success Feedback
            alert("Member updated successfully!");
            this.disableEditMode();
            this.closeModal();
            this.renderTable();
        } catch (e) {
            alert("Update failed: " + e.message);
        } finally {
            // Restore Button
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalText;
            }
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
                throw new Error("Invalid Package Selected. Please refresh page and try again.");
            }

            console.log("Selected Package:", selectedPackage);

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
            const result = await withTimeout(Store.addMember(newMember), 15000);
            console.log("Add Member Result:", result);

            // 4. Send Email with QR Code (Async - don't block UI)
            this.sendWelcomeEmail(newMember, result.id);

            alert(`Success! Member registered and email sending...`);

            // Reset and show list
            document.getElementById('addMemberForm').reset();
            this.showList();
        } catch (e) {
            console.error("Registration Error:", e);
            alert('Registration Failed: ' + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = "Confirm Registration"; }
        }
    },

    sendWelcomeEmail: function (member, memberId) {
        console.log("Preparing Welcome Email for:", member.name);

        // 1. Generate QR Data URI
        // We use a temporary hidden container to generate the image
        const tempContainer = document.createElement('div');

        try {
            const qr = new QRCode(tempContainer, {
                text: memberId,
                width: 256,
                height: 256,
                correctLevel: QRCode.CorrectLevel.H
            });

            // Wait briefly for canvas/img to be generated
            setTimeout(() => {
                const img = tempContainer.querySelector('img');
                if (img && img.src) {
                    const qrDataUri = img.src;

                    // 2. Send via EmailJS
                    // NOTE: Keys are in js/config.js
                    const serviceID = Config.emailjs.serviceId;
                    const templateID = Config.emailjs.templateId;

                    if (serviceID.includes("YOUR_")) {
                        console.warn("EmailJS not configured. Check js/config.js");
                        alert("Note: Email not sent. Please configure keys in js/config.js");
                        return;
                    }

                    const templateParams = {
                        to_name: member.name,
                        to_email: member.email,
                        member_package: member.package,
                        expiry_date: member.expiryDate,
                        qr_code: qrDataUri
                    };

                    emailjs.send(serviceID, templateID, templateParams)
                        .then(() => {
                            console.log('EMAIL SUCCESS!');
                            alert("Welcome Email Sent Successfully!");
                        }, (err) => {
                            console.error('EMAIL FAILED...', err);
                            alert("Email Failed to Send: " + JSON.stringify(err));
                        });
                } else {
                    console.error("Failed to generate QR Image for email");
                }
            }, 100);

        } catch (e) {
            console.error("Email preparation failed:", e);
        }
    },

    handleUrlParams: async function () {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const id = urlParams.get('id');

        if (action === 'renew' && id) {
            console.log("Auto-opening renewal for:", id);
            // Wait a tick for table render? Already awaited in init.
            // But we need to make sure the modal opens.

            // Open View
            await this.viewMember(id);

            // Switch to Edit
            if (this.currentMemberId === id) { // verify it opened
                this.enableEditMode();

                // Optional: Scroll edit date into view or focus?
                setTimeout(() => {
                    const dateInput = document.getElementById('edit-expiry');
                    if (dateInput) dateInput.focus();
                }, 500);
            }

            // Clean URL so refresh doesn't keep opening it
            window.history.replaceState({}, document.title, "members.html");
        }
    }
};

// Auto-init when loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => MemberController.init(), 500); // Give Firebase a moment
});

// Expose for onClick handlers in HTML
window.MemberController = MemberController;
