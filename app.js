/* 
 * Winners Fit Camp - PWA Logic
 * Handles Service Worker, Desktop/Laptop optimizations, and the Install Banner.
 */

// 1. Desktop & Screen Optimization
// 1. Desktop & Screen Optimization
function applyScreenOptimizations() {
    /* 
    const width = window.innerWidth;
    const isAttendance = document.body.classList.contains('attendance-page');

    // Only block mobile if NOT on the attendance page
    if (width < 1024 && !isAttendance) {
        if (!document.getElementById('mobile-blocker')) {
            const blocker = document.createElement('div');
            blocker.id = 'mobile-blocker';
            blocker.style = `
                position: fixed; inset: 0; background: #000; z-index: 100000;
                display: flex; flex-direction: column; justify-content: center; align-items: center;
                text-align: center; color: white; padding: 30px; font-family: 'Outfit', sans-serif;
            `;
            blocker.innerHTML = `
                <img src="icon.png" style="width: 80px; margin-bottom: 20px; border-radius: 50%;">
                <h2 style="color: #E50914; margin-bottom: 15px;">DESKTOP ONLY PORTAL</h2>
                <p style="opacity: 0.8; line-height: 1.6;">
                    Please use a <strong>Laptop or Desktop</strong> (14" - 22" screen) for administrative tasks.
                </p>
                <p style="margin-top: 20px; font-size: 0.85rem; color: #aaa;">
                    The Attendance system remains accessible on mobile.
                </p>
            `;
            document.body.appendChild(blocker);
        }
    } else {
        const blocker = document.getElementById('mobile-blocker');
        if (blocker) blocker.remove();
    }
    */
    // Logic Disabled for Mobile Access
}

// 2. Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('PWA SW Registered'))
            .catch(err => console.log('SW Registration Failed', err));
    });
}

// 3. PWA Install Banner Logic
let deferredPrompt;

const PWAInstaller = {
    init: function () {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;

            // Don't show if they dismissed it recently (24hr cooldown)
            const lastDismissed = localStorage.getItem('pwa_dismissed');
            if (lastDismissed && Date.now() - parseInt(lastDismissed) < 86400000) return;

            this.showBanner();
        });
    },

    showBanner: function () {
        if (document.getElementById('pwa-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'pwa-banner';
        banner.className = 'glass-card pwa-install-banner';
        banner.style = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            z-index: 9999; width: 90%; max-width: 450px; padding: 20px;
            display: flex; align-items: center; gap: 20px;
            animation: slideUpBanner 0.6s ease-out;
            border: 1px solid rgba(229, 9, 20, 0.3);
            background: rgba(15, 15, 15, 0.95);
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        `;

        banner.innerHTML = `
            <img src="icon.png" style="width: 50px; height: 50px; border-radius: 12px; border: 1px solid #E50914;">
            <div style="flex: 1;">
                <h4 style="margin: 0; color: white; font-size: 1rem;">Winners Fit Camp</h4>
                <p style="margin: 4px 0 0 0; color: rgba(255,255,255,0.6); font-size: 0.75rem;">Install official app for best experience</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button id="pwa-install-btn" style="background: #E50914; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.85rem;">Install</button>
                <button id="pwa-close-btn" style="background: transparent; color: rgba(255,255,255,0.4); border: none; font-size: 0.7rem; cursor: pointer;">Not now</button>
            </div>
        `;

        document.body.appendChild(banner);

        // Install Action
        document.getElementById('pwa-install-btn').onclick = async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') banner.remove();
                deferredPrompt = null;
            }
        };

        // Close Action
        document.getElementById('pwa-close-btn').onclick = () => {
            localStorage.setItem('pwa_dismissed', Date.now().toString());
            banner.style.animation = 'slideDownBanner 0.4s ease-in forwards';
            setTimeout(() => banner.remove(), 400);
        };
    }
};

// Add required animations to head
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUpBanner { from { bottom: -100px; opacity: 0; } to { bottom: 30px; opacity: 1; } }
    @keyframes slideDownBanner { from { bottom: 30px; opacity: 1; } to { bottom: -100px; opacity: 0; } }
`;
document.head.appendChild(style);

// Run on Load
document.addEventListener('DOMContentLoaded', () => {
    applyScreenOptimizations();
    PWAInstaller.init();
});

// Run on Resize
window.addEventListener('resize', applyScreenOptimizations);
