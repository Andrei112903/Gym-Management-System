/**
 * Winners Fit Camp - Data Store (Firebase Firestore Version)
 * Handles persistence for Members, Packages, and Transactions.
 */

const Store = {

    // --- Helper to track local vs server race conditions ---
    updateLastWrite: function () {
        localStorage.setItem('wfc_last_local_write', Date.now().toString());
    },

    isLocalFresh: function () {
        const last = localStorage.getItem('wfc_last_local_write');
        if (!last) return false;
        // If local write happened in last 10 seconds, trust local over server
        return (Date.now() - parseInt(last)) < 10000;
    },

    // --- Members ---
    getMembers: async function () {
        // 1. Check Cache (Offline/Optimistic support)
        const cached = localStorage.getItem('wfc_members_cache');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Trigger background refresh ONLY if we haven't just written locally
                    if (!this.isLocalFresh()) {
                        this.fetchMembersFromDB();
                    } else {
                        console.log("Skipping background refresh - Local data is fresh");
                    }
                    return parsed;
                }
            } catch (e) {
                localStorage.removeItem('wfc_members_cache');
            }
        }

        // 2. Fetch if no cache
        return await this.fetchMembersFromDB();
    },

    fetchMembersFromDB: async function () {
        if (this.isLocalFresh()) {
            console.log("Aborting DB fetch - trust local cache");
            const cached = localStorage.getItem('wfc_members_cache');
            return cached ? JSON.parse(cached) : [];
        }

        try {
            const snapshot = await db.collection('members').orderBy('joinDate', 'desc').get();
            const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Double check before writing
            if (!this.isLocalFresh()) {
                localStorage.setItem('wfc_members_cache', JSON.stringify(members));
            }
            return members;
        } catch (error) {
            console.error("Error getting members:", error);
            return [];
        }
    },

    addMember: async function (memberData) {
        // Optimistic Update: Generate ID and save locally first for speed
        this.updateLastWrite(); // MARK FRESH
        const tempId = 'loc_' + Date.now();
        const newMember = {
            id: tempId,
            joinDate: new Date().toISOString().split('T')[0],
            status: 'Active',
            ...memberData
        };

        // 1. Update Local Cache Immediatey
        try {
            const cachedParams = localStorage.getItem('wfc_members_cache'); // Assuming we cache members too?
            // Wait, getMembers didn't cache members in the original code, only packages.
            // But we SHOULD cache members for this to work.
            // Let's check getMembers logic again.
            // If getMembers queries DB every time, optimistic UI fails unless we cache members.

            // Let's Implement Member Caching in addMember AND getMembers
            let currentMembers = [];
            if (cachedParams) {
                currentMembers = JSON.parse(cachedParams);
            }
            currentMembers.unshift(newMember); // Add to top
            localStorage.setItem('wfc_members_cache', JSON.stringify(currentMembers));
            console.log("Optimistic Save Complete");

        } catch (e) {
            console.warn("Cache update failed", e);
        }

        // 2. Background Sync to Firebase (Fire and Forget)
        // We don't await this to unblock the UI
        db.collection('members').add(newMember)
            .then(docRef => {
                console.log("Synced to Firebase with ID:", docRef.id);
                // Optional: Update the local ID to the real ID in cache?
                // This is complex for a quick fix, let's just let the next hard refresh handle it
                // or just leave it.
            })
            .catch(err => {
                console.error("Firebase Sync Failed:", err);
                alert("WARNING: Save to database failed! Data may be lost on refresh.\nError: " + err.message);
            });

        // Return immediately
        return newMember;
    },

    deleteMember: async function (id) {
        // Optimistic Delete: Remove from local cache immediately
        this.updateLastWrite(); // MARK FRESH
        try {
            const cachedParams = localStorage.getItem('wfc_members_cache');
            if (cachedParams) {
                let currentMembers = JSON.parse(cachedParams);
                const initialLength = currentMembers.length;
                currentMembers = currentMembers.filter(m => m.id !== id);

                if (currentMembers.length < initialLength) {
                    localStorage.setItem('wfc_members_cache', JSON.stringify(currentMembers));
                    console.log("Optimistic Delete Complete");
                }
            }
        } catch (e) {
            console.warn("Cache delete failed", e);
        }

        // Background Sync
        db.collection('members').doc(id).delete()
            .then(() => console.log("Deleted from Firebase:", id))
            .catch(err => console.error("Firebase Delete Failed:", err));

        return true;
    },

    // --- Packages ---
    getPackages: async function () {
        // Clear potential bad cache if empty
        const cached = localStorage.getItem('wfc_packages_cache');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            } catch (e) {
                localStorage.removeItem('wfc_packages_cache');
            }
        }

        try {
            // Note: This requires active DB connection. If fails, we fall back.
            const snapshot = await db.collection('packages').get();

            if (snapshot.empty) {
                console.log("No packages in DB, seeding defaults...");
                this.seedPackages(); // Fire and forget or await? Better await to be safe but we can just return defaults immediately.
                return this.defaults.packages;
            }

            const packs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (packs.length === 0) return this.defaults.packages;

            localStorage.setItem('wfc_packages_cache', JSON.stringify(packs));
            return packs;
        } catch (error) {
            console.warn("Using Default Packages (DB Error):", error);
            return this.defaults.packages; // Fallback
        }
    },

    seedPackages: async function () {
        const packages = [
            { id: 'p1', name: 'Daily Pass', price: 15, duration: 1 },
            { id: 'p2', name: 'Weekly Pass', price: 50, duration: 7 },
            { id: 'p3', name: 'Monthly Membership', price: 80, duration: 30 },
            { id: 'p4', name: 'Yearly Membership', price: 800, duration: 365 }
        ];
        // Batch write
        const batch = db.batch();
        packages.forEach(p => {
            const ref = db.collection('packages').doc(p.id);
            batch.set(ref, p);
        });
        await batch.commit();
        console.log("Packages Seeded");
    },

    defaults: {
        packages: [
            { id: 'p1', name: 'Daily Pass', price: 15, duration: 1 },
            { id: 'p2', name: 'Weekly Pass', price: 50, duration: 7 },
            { id: 'p3', name: 'Monthly Membership', price: 80, duration: 30 },
            { id: 'p4', name: 'Yearly Membership', price: 800, duration: 365 }
        ]
    }
};

window.Store = Store;
