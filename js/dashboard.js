/**
 * dashboard.js
 * Handles Dashboard Metrics and Reports
 */

const DashboardController = {
    init: async function () {
        console.log("Dashboard Controller Init");
        await this.updateMetrics();
        // Optional: Set up auto-refresh interval
        // setInterval(() => this.updateMetrics(), 60000); // 1 minute
    },

    updateMetrics: async function () {
        try {
            // 1. Total Members
            const members = await Store.getMembers();
            const totalMembersEl = document.getElementById('stat-total-members');
            if (totalMembersEl) {
                totalMembersEl.textContent = members.length;
            }

            // 2. Checked In Today
            const today = new Date().toISOString().split('T')[0];
            const checkins = await Store.getCheckIns(today);
            const checkinTodayEl = document.getElementById('stat-checkin-today');
            if (checkinTodayEl) {
                checkinTodayEl.textContent = checkins.length;
            }

            // 3. Revenue (Optional/Future) - Using placeholder logic for now
            // const revenueEl = document.getElementById('stat-revenue');
            // if(revenueEl) revenueEl.textContent = "₱0"; 

        } catch (e) {
            console.error("Error updating dashboard metrics:", e);
        }
    }
};

// Initialize when view loads - but since dashboard is SPA-ish, verify logic in dashboard.html
