// PastBlast Analytics — Google Analytics 4
// Set your GA4 Measurement ID here or via server config
const GA_ID = window.__GA_ID || 'G-XXXXXXXXXX';

// Load gtag.js
(function() {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA_ID, {
        send_page_view: true,
        cookie_flags: 'SameSite=None;Secure',
    });
})();

// Helper: track custom events
function trackEvent(eventName, params = {}) {
    if (typeof gtag === 'function') {
        gtag('event', eventName, params);
    }
}

// Return visit detection
(function() {
    const lastVisit = localStorage.getItem('pb_last_visit');
    const visitCount = parseInt(localStorage.getItem('pb_visit_count') || '0') + 1;
    localStorage.setItem('pb_visit_count', visitCount);

    if (lastVisit) {
        const daysSince = Math.floor((Date.now() - parseInt(lastVisit)) / 86400000);
        trackEvent('return_visit', {
            days_since_last_visit: daysSince,
            total_visits: visitCount,
        });
    }
    localStorage.setItem('pb_last_visit', Date.now());
})();
