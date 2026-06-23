import { supabase } from './supabase.js';
import { requireAuth, logout } from './auth.js';
import { getLang, setLang, applyTranslations } from './i18n.js';
import { syncPrefsFromProfile, getUnitSystem, setUnitSystem, savePrefsToProfile } from './unit-prefs.js';
import { initProfileModal } from './profile.js';

let currentUser = null;
let currentProfile = null;

// DOM elements
const elGamertag = document.getElementById('userGamertag');
const elUnitSystem = document.getElementById('headerUnitSystem');
const elAdminLink = document.getElementById('adminLink');
const elBtnLogout = document.getElementById('btnLogout');

/**
 * Initialize instructions page
 */
async function init() {
  // 1. Enforce auth
  const authInfo = await requireAuth();
  if (!authInfo) return; // redirected
  
  currentUser = authInfo.user;
  currentProfile = authInfo.profile;

  // 2. Initialize unit preferences
  await syncPrefsFromProfile(currentUser.id);

  // 3. Initialize i18n toggles
  const currentLang = getLang();
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
      document.querySelectorAll('.lang-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.lang === btn.dataset.lang)
      );
    });
  });
  
  // 4. Initialize Profile Settings Modal
  await initProfileModal();

  // 5. Initialize header unit preset selector
  if (elUnitSystem) {
    elUnitSystem.value = getUnitSystem();
    elUnitSystem.addEventListener('change', async (e) => {
      const val = e.target.value;
      setUnitSystem(val);
      if (currentUser) {
        savePrefsToProfile(currentUser.id);
      }
      if (val === 'custom') {
        const drawerMenu = document.getElementById('drawerMenu');
        if (drawerMenu) drawerMenu.classList.remove('open');
        const { openProfileModal } = await import('./profile.js');
        await openProfileModal();
      }
    });
  }

  // Listen to unit changes or preset system updates to keep header select in sync
  document.addEventListener('systemchange', (e) => {
    if (elUnitSystem) elUnitSystem.value = e.detail.system;
  });

  // 6. Update header UI with user information
  if (elGamertag) {
    elGamertag.innerHTML = `GAMERTAG: <span>${currentProfile.gamertag}</span>`;
  }

  // Show admin panel link if user is admin
  if (currentProfile.is_admin && elAdminLink) {
    elAdminLink.style.display = 'inline-block';
  }

  // 7. Bind logout button
  if (elBtnLogout) {
    elBtnLogout.addEventListener('click', async () => {
      try {
        await logout();
        window.location.href = 'index.html';
      } catch (err) {
        alert('Erro ao sair: ' + err.message);
      }
    });
  }

  // 8. Apply initial translations
  applyTranslations();
}

// Start page initialization
document.addEventListener('DOMContentLoaded', init);
