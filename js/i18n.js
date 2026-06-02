import en from './i18n/en.js';
import pt from './i18n/pt.js';

const LANGS = { en, pt };

let currentLang = localStorage.getItem('fz_lang') || 'en';

export function setLang(lang) {
  if (!LANGS[lang]) return;
  currentLang = lang;
  localStorage.setItem('fz_lang', lang);
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

export function getLang() {
  return currentLang;
}

// t('dashboard.title') -> translated string
// t('car.badge_clone', { gamertag: 'x' }) -> interpolation
export function t(key, vars = {}) {
  const keys = key.split('.');
  let val = LANGS[currentLang];
  for (const k of keys) {
    val = val?.[k];
    if (val === undefined) break;
  }
  
  // Fallback to English
  if (val === undefined) {
    val = LANGS['en'];
    for (const k of keys) {
      val = val?.[k];
      if (val === undefined) break;
    }
  }
  
  if (typeof val !== 'string') return key;
  return val.replace(/\{\{(\w+)\}\}/g, (_, v) => vars[v] ?? '');
}

/**
 * Apply translations to all elements with [data-i18n]
 */
export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    // We can also support variables if stored in data-i18n-vars JSON or simply interpolating on specific attributes
    let vars = {};
    if (el.dataset.i18nVars) {
      try {
        vars = JSON.parse(el.dataset.i18nVars);
      } catch (e) {
        console.error('Error parsing i18n vars:', e);
      }
    }
    
    const translation = t(key, vars);
    
    // Support placeholder translation for input elements
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (el.hasAttribute('placeholder')) {
        el.setAttribute('placeholder', translation);
      } else {
        el.value = translation;
      }
    } else {
      el.innerHTML = translation;
    }
  });
}

// Automatically listen for langchange event
document.addEventListener('langchange', applyTranslations);
