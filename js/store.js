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

            // FIX 1: Map Correctly. doc.data() first, then overwrite id with real doc.id
            // Also capture the hidden 'id' field from data as '_originalLocalId' to track sync status
            const serverMembers = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    _originalLocalId: (data.id && data.id.toString().startsWith('loc_')) ? data.id : null
                };
            });

            // FIX 2: Identify which local IDs have effectively been "synced"
            const syncedIds = new Set(serverMembers.map(m => m._originalLocalId).filter(Boolean));

            // MERGE STRATEGY:
            let finalMembers = serverMembers;

            try {
                const cachedRaw = localStorage.getItem('wfc_members_cache');
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);

                    // Filter: Keep ONLY local items that are NOT in the server set
                    const unsyncedLocals = cached.filter(m => {
                        const isLocal = m.id && m.id.toString().startsWith('loc_');
                        const isAlreadySynced = syncedIds.has(m.id);
                        return isLocal && !isAlreadySynced;
                    });

                    if (unsyncedLocals.length > 0) {
                        console.log(`Merging ${unsyncedLocals.length} unsynced items.`);
                        // Deduplicate unsyncedLocals itself (fix for existing corrupted cache)
                        const uniqueLocals = Array.from(new Map(unsyncedLocals.map(item => [item.id, item])).values());

                        finalMembers = [...uniqueLocals, ...serverMembers];
                    }
                }
            } catch (e) { console.warn("Merge error", e); }

            // Final safety dedup by ID just in case
            finalMembers = Array.from(new Map(finalMembers.map(item => [item.id, item])).values());

            // Save the clean, merged list
            localStorage.setItem('wfc_members_cache', JSON.stringify(finalMembers));
            return finalMembers;
        } catch (error) {
            console.error("Error getting members:", error);
            const cached = localStorage.getItem('wfc_members_cache');
            return cached ? JSON.parse(cached) : [];
        }
    },

    retryPendingSync: function (localItems) {
        // Simple retry trigger
        localItems.forEach(item => {
            // Check if already sending? No easy way. Just fire add again?
            // Danger of duplicate. For now, rely on Firestore internal queue.
            // This function just exists to mark intention.
        });
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

        // 2. Dual-Strategy Sync: Race Network vs Time
        const serverPromise = db.collection('members').add(newMember);

        // Timeout Promise: If server takes > 2500ms, we assume "Offline Success" 
        // because we enabled persistence in firebase-init.js
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 2500));

        try {
            const result = await Promise.race([serverPromise, timeoutPromise]);

            if (result === 'TIMEOUT') {
                console.warn("Network slow - assuming Offline Persistence saved it.");
                // We let the background process handle the actual sync
                // Do NOT throw error, just proceed.
            } else {
                console.log("Synced to Firebase instantly with ID:", result.id);
            }
        } catch (err) {
            console.error("Firebase Sync Failed:", err);
            // Only revert if it's a REAL error (permission, logic), not network timeout
            this.revertOptimisticAdd(newMember.id);
            throw new Error("Save failed: " + err.message);
        }

        return newMember;
    },

    revertOptimisticAdd: function (tempId) {
        try {
            const cachedParams = localStorage.getItem('wfc_members_cache');
            if (cachedParams) {
                let currentMembers = JSON.parse(cachedParams);
                currentMembers = currentMembers.filter(m => m.id !== tempId);
                localStorage.setItem('wfc_members_cache', JSON.stringify(currentMembers));
            }
        } catch (e) { console.error(e); }
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
