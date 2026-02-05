/**
 * Winners Fit Camp - Configuration
 * Central place for API keys and Service IDs.
 */

const Config = {
    emailjs: {
        publicKey: "h26QAfrxpzvCBoroa",     // Updated from screenshot
        serviceId: "service_ub2lg2u",       // Updated from screenshot
        templateId: "template_buokkcb"      // Updated from screenshot
    }
};

// Initialize EmailJS if loaded
if (typeof emailjs !== 'undefined' && Config.emailjs.publicKey !== "YOUR_PUBLIC_KEY_HERE") {
    emailjs.init(Config.emailjs.publicKey);
    console.log("EmailJS Initialized");
} else if (typeof emailjs !== 'undefined') {
    console.warn("EmailJS not initialized: Missing Public Key in js/config.js");
}
