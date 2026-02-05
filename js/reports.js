/**
 * Winners Fit Camp - Reports Controller (Live Command Center Version)
 * Handles real-time financial tracking and live updates via Firestore listeners.
 */

const ReportsController = {
    revenueChart: null,
    packageChart: null,
    packages: [],

    init: async function () {
        console.log("Reports Controller Init - Live Mode");
        this.packages = await Store.getPackages();
        this.currentMembers = [];

        // 1. Initial Static Render for Charts (to show background)
        this.renderRevenueChart();

        // 2. Attach Real-Time Member Listener
        this.startMemberListener();

        // 3. Attach Real-Time Attendance Listener
        this.startAttendanceListener();

        // 4. Attach Range Listener
        const rangeEl = document.getElementById('timeRange');
        if (rangeEl) {
            rangeEl.addEventListener('change', () => {
                if (this.currentMembers.length > 0) {
                    this.updateRevenueStats(this.currentMembers);
                }
            });
        }
    },

    startMemberListener: function () {
        db.collection('members').orderBy('joinDate', 'desc').onSnapshot(snapshot => {
            this.currentMembers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            this.updateRevenueStats(this.currentMembers);
            this.renderPackageChart(this.currentMembers);
            this.renderTransactions(this.currentMembers);
        }, err => console.error("Live Revenue Sync Error:", err));
    },

    startAttendanceListener: function () {
        const today = new Date().toLocaleDateString('en-US');

        // Listen for today's activity to track live footfall
        db.collection('attendance_logs')
            .where('date', '==', today)
            .where('type', '==', 'member')
            .onSnapshot(snapshot => {
                const count = snapshot.size;
                this.animateValue('footfall', count);
            });
    },

    updateRevenueStats: function (members) {
        // Calculate Monthly Revenue (Current value of active subscriptions)
        let totalMonthly = 0;
        let totalRevenueSum = 0;
        let newSubsInPeriod = 0;

        const range = parseInt(document.getElementById('timeRange')?.value || '30');
        const now = new Date();
        const periodStart = new Date(now.getTime() - (range * 24 * 60 * 60 * 1000));

        members.forEach(m => {
            const pack = this.packages.find(p => p.name === m.package);
            if (pack) {
                totalMonthly += pack.price;
                // Simple LTV estimation: current package price (actual history would be better)
                totalRevenueSum += pack.price;
            }

            // Check if joined in selected range
            const joinDate = new Date(m.joinDate);
            if (joinDate >= periodStart) newSubsInPeriod++;
        });

        const avgLTV = members.length > 0 ? Math.floor(totalRevenueSum / members.length) : 0;

        // Update with animation
        this.animateValue('rev-monthly', totalMonthly, '₱');
        this.animateValue('sub-new', newSubsInPeriod);
        this.animateValue('ltv-avg', avgLTV, '₱');

        // Dynamic Trend Label
        const subTrend = document.querySelector('#sub-new + .trend');
        if (subTrend) {
            subTrend.textContent = `↑ ${newSubsInPeriod} in last ${range} days`;
        }

        // Refresh chart with period awareness
        this.renderRevenueChart(members, range);
    },

    animateValue: function (id, target, prefix = '') {
        const el = document.getElementById(id);
        if (!el) return;

        const currentText = el.textContent.replace(/[₱,]/g, '');
        const current = parseInt(currentText) || 0;

        if (current === target) return;

        const duration = 1000; // 1 second
        const start = Date.now();

        const step = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out expo
            const value = Math.floor(current + (target - current) * (1 - Math.pow(2, -10 * progress)));

            el.textContent = prefix + value.toLocaleString();

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = prefix + target.toLocaleString();
            }
        };

        requestAnimationFrame(step);
    },

    renderRevenueChart: function (members = [], range = 30) {
        const canvas = document.getElementById('revenueChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Dynamic historical data based on join dates
        const labels = [];
        const data = [];
        const now = new Date();

        // Determine granularity based on range
        let steps;
        let unit;

        if (range === 7) {
            steps = 7;
            unit = 'day';
        } else if (range === 30) {
            steps = 30;
            unit = 'day';
        } else if (range === 90) {
            steps = 3;
            unit = 'month';
        } else {
            steps = 6;
            unit = 'month';
        }

        for (let i = steps - 1; i >= 0; i--) {
            let d;
            let label;
            let periodEnd;

            if (unit === 'day') {
                d = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
                label = d.toLocaleDateString('en-US', { weekday: 'short' });
                periodEnd = d;
            } else {
                d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                label = d.toLocaleString('en-US', { month: 'short' });
                periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            }

            labels.push(label);

            // Calculate revenue for members who were active during this period
            let periodRev = 0;
            members.forEach(m => {
                const joinDate = new Date(m.joinDate);
                if (joinDate <= periodEnd) {
                    const pack = this.packages.find(p => p.name === m.package);
                    if (pack) periodRev += pack.price;
                }
            });
            data.push(periodRev);
        }

        if (this.revenueChart) this.revenueChart.destroy();

        this.revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue Growth',
                    data: data,
                    borderColor: '#E50914',
                    backgroundColor: 'rgba(229, 9, 20, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#E50914',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#888' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#888' }
                    }
                }
            }
        });
    },

    renderPackageChart: function (members) {
        const canvas = document.getElementById('packageChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const statsContainer = document.getElementById('packageStats');

        const packageCounts = {};
        this.packages.forEach(p => packageCounts[p.name] = 0);
        members.forEach(m => {
            if (packageCounts[m.package] !== undefined) packageCounts[m.package]++;
        });

        const labels = Object.keys(packageCounts);
        const data = Object.values(packageCounts);
        const colors = ['#E50914', '#FFD700', '#00ff88', '#00d2ff', '#9c27b0', '#ff9800'];

        if (this.packageChart) this.packageChart.destroy();

        this.packageChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                cutout: '75%'
            }
        });

        statsContainer.innerHTML = labels.map((label, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:5px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:10px; height:10px; border-radius:50%; background:${colors[i]}"></div>
                    <span style="font-size:0.85rem; opacity:0.75;">${label}</span>
                </div>
                <strong style="color:white; font-size:0.9rem;">${data[i]}</strong>
            </div>
        `).join('');
    },

    renderTransactions: function (members) {
        const container = document.getElementById('transactionBody');
        if (!container) return;

        const recent = members.slice(0, 8);

        if (recent.length === 0) {
            container.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem;">Waiting for transactions...</td></tr>';
            return;
        }

        container.innerHTML = recent.map(m => {
            const pack = this.packages.find(p => p.name === m.package);
            const price = pack ? pack.price : 0;

            return `
                <tr style="animation: fadeIn 0.5s ease forwards;">
                    <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:30px; height:30px; border-radius:50%; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:0.75rem; border:1px solid rgba(255,255,255,0.1);">
                                ${m.name[0].toUpperCase()}
                            </div>
                            <strong>${m.name}</strong>
                        </div>
                    </td>
                    <td style="font-size:0.85rem; color:var(--text-muted);">${m.package}</td>
                    <td style="font-weight:700; color:#00ff88;">₱${price.toLocaleString()}</td>
                    <td style="font-size:0.8rem; opacity:0.6;">${m.joinDate}</td>
                    <td><span class="status-badge status-active" style="font-size:0.65rem;">SUCCESS</span></td>
                </tr>
            `;
        }).join('');
    }
};
