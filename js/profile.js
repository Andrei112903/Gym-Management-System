/**
 * js/profile.js
 * Handles the shared Admin Profile Edit logic across all pages.
 */

const ProfileModule = {
    init: function () {
        if (document.getElementById('admin-edit-modal')) return;

        const modalHtml = `
            <div id="admin-edit-modal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(5px);">
                <div class="glass-card animate-in" style="width:100%; max-width:500px; padding:2rem; position:relative; background: #111; border: 1px solid var(--glass-border); border-radius: 20px; color: white; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
                    <button onclick="ProfileModule.closeModal()" style="position:absolute; top:20px; right:20px; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.2rem;">✕</button>
                    <h2 style="color:var(--gold); margin-bottom: 1.5rem; font-weight: 700;">Edit Admin Profile</h2>
                    <form id="admin-edit-form">
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom: 1rem;">
                            <div class="input-group" style="text-align: left;">
                                <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:5px;">First Name</label>
                                <input type="text" id="admin-edit-fname" class="styled-input" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; padding:10px; border-radius:8px;" required>
                            </div>
                            <div class="input-group" style="text-align: left;">
                                <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:5px;">Last Name</label>
                                <input type="text" id="admin-edit-lname" class="styled-input" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; padding:10px; border-radius:8px;" required>
                            </div>
                        </div>
                        <div class="input-group" style="margin-bottom: 1rem; text-align: left;">
                            <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:5px;">Email / Login</label>
                            <input type="email" id="admin-edit-email" class="styled-input" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; padding:10px; border-radius:8px;" required>
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom: 1rem;">
                            <div class="input-group" style="text-align: left;">
                                <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:5px;">Phone Number</label>
                                <input type="text" id="admin-edit-phone" class="styled-input" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; padding:10px; border-radius:8px;" required>
                            </div>
                            <div class="input-group" style="text-align: left;">
                                <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:5px;">Address</label>
                                <input type="text" id="admin-edit-address" class="styled-input" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; padding:10px; border-radius:8px;" placeholder="123 Gym St, City">
                            </div>
                        </div>

                        <div style="margin: 1.5rem 0; padding: 1rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; background: rgba(255,255,255,0.02);">
                            <h4 style="color:var(--gold); margin-top:0; font-size: 0.9rem;">Change Password</h4>
                            <div class="input-group" style="margin-bottom: 1rem; text-align: left; position: relative;">
                                <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:5px;">New Password</label>
                                <input type="password" id="admin-edit-pass" class="styled-input" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; padding:10px; border-radius:8px;" placeholder="Leave blank to keep current">
                                <span onclick="ProfileModule.togglePass('admin-edit-pass')" style="position:absolute; right:15px; top:35px; cursor:pointer; opacity:0.6;">👁️</span>
                            </div>
                            <div class="input-group" style="text-align: left; position: relative;">
                                <label style="display:block; font-size:0.8rem; color:var(--text-muted); margin-bottom:5px;">Confirm Password</label>
                                <input type="password" id="admin-edit-pass-confirm" class="styled-input" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; padding:10px; border-radius:8px;" placeholder="Re-type new password">
                                <span onclick="ProfileModule.togglePass('admin-edit-pass-confirm')" style="position:absolute; right:15px; top:35px; cursor:pointer; opacity:0.6;">👁️</span>
                            </div>
                        </div>

                        <div style="display:flex; gap:10px;">
                            <button type="button" class="cta-button" onclick="ProfileModule.closeModal()" style="background:transparent; border:1px solid var(--glass-border); flex:1; color: white; padding: 12px; border-radius: 12px; cursor: pointer;">Cancel</button>
                            <button type="submit" class="cta-button" style="flex:1; background: var(--gold); border: none; color: black; font-weight: 700; padding: 12px; border-radius: 12px; cursor: pointer;">Update Profile</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const form = document.getElementById('admin-edit-form');
        if (form) {
            form.onsubmit = (e) => this.handleSubmit(e);
        }

        // Add onclick to profile indicators
        const prof = document.querySelector('.user-profile');
        if (prof) {
            prof.style.cursor = 'pointer';
            prof.title = 'Edit Profile';

            // Delegate click to non-button areas
            prof.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) {
                    this.openModal();
                }
            });
        }
    },

    togglePass: function (id) {
        const el = document.getElementById(id);
        el.type = el.type === 'password' ? 'text' : 'password';
    },

    openModal: function () {
        // Load combined user data
        const session = AuthService.getCurrentUser() || {};
        const localUser = JSON.parse(localStorage.getItem('wfc_user') || '{}');
        const user = { ...localUser, ...session };

        if (user) {
            const nameParts = (user.username || user.name || "").split(" ");
            document.getElementById('admin-edit-fname').value = user.firstName || nameParts[0] || '';
            document.getElementById('admin-edit-lname').value = user.lastName || nameParts[1] || '';
            document.getElementById('admin-edit-email').value = user.email || '';
            document.getElementById('admin-edit-phone').value = user.phone || '';
            document.getElementById('admin-edit-address').value = user.address || '';
            document.getElementById('admin-edit-pass').value = '';
            document.getElementById('admin-edit-pass-confirm').value = '';
            document.getElementById('admin-edit-modal').style.display = 'flex';
        }
    },

    closeModal: function () {
        const modal = document.getElementById('admin-edit-modal');
        if (modal) modal.style.display = 'none';
    },

    handleSubmit: async function (e) {
        e.preventDefault();
        const fn = document.getElementById('admin-edit-fname').value.trim();
        const ln = document.getElementById('admin-edit-lname').value.trim();
        const email = document.getElementById('admin-edit-email').value.trim();
        const phone = document.getElementById('admin-edit-phone').value.trim();
        const addr = document.getElementById('admin-edit-address').value.trim();
        const newPass = document.getElementById('admin-edit-pass').value.trim();
        const confirmPass = document.getElementById('admin-edit-pass-confirm').value.trim();

        try {
            const session = AuthService.getCurrentUser();
            const localUser = JSON.parse(localStorage.getItem('wfc_user') || '{}');

            if (newPass) {
                if (newPass !== confirmPass) { alert("Passwords do not match!"); return; }
                // Password update would require re-auth in Firebase, usually handled separately
                alert("Password update requested. This usually requires a fresh login for security.");
            }

            const updatedUser = {
                ...localUser,
                firstName: fn,
                lastName: ln,
                username: `${fn} ${ln}`,
                email: email,
                phone: phone,
                address: addr
            };

            const updatedSession = {
                ...session,
                email: email,
                username: `${fn} ${ln}`
            };

            localStorage.setItem('wfc_user', JSON.stringify(updatedUser));
            localStorage.setItem('currentUser', JSON.stringify(updatedSession));

            // Sync UI across open pages
            const nameEl = document.getElementById('userName');
            const avatarEl = document.getElementById('userAvatar');
            if (nameEl) nameEl.textContent = updatedUser.username;
            if (avatarEl) avatarEl.textContent = fn[0].toUpperCase();

            // Sync to Firestore if authenticated
            if (session && session.uid) {
                await db.collection('users').doc(session.uid).update(updatedUser).catch(e => console.warn("Firestore sync failed:", e));
            }

            alert("Profile Updated Successfully!");
            this.closeModal();

            // Proactive: Update other UI elements if they exist
            if (typeof loadDashboardData === 'function') loadDashboardData();

        } catch (err) {
            console.error(err);
            alert("Update failed: " + err.message);
        }
    }
};
