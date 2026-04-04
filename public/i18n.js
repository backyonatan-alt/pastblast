// PastBlast i18n — lightweight translation system
let currentLang = localStorage.getItem('pb_lang') || 'en';
let strings = {};

async function initI18n() {
    const lang = localStorage.getItem('pb_lang') || 'en';
    await setLanguage(lang);
}

async function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('pb_lang', lang);

    try {
        const res = await fetch(`/lang/${lang}.json`);
        strings = await res.json();
    } catch (e) {
        console.warn('Failed to load language:', lang);
        if (lang !== 'en') {
            const res = await fetch('/lang/en.json');
            strings = await res.json();
        }
    }

    // Set RTL
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;

    // Apply translations to any elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (strings[key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = strings[key];
            } else {
                el.textContent = strings[key];
            }
        }
    });
}

function t(key, fallback) {
    return strings[key] || fallback || key;
}

function getLang() {
    return currentLang;
}

function isRTL() {
    return currentLang === 'he';
}

// Auto-init on load
initI18n();
