import { supabase } from './supabase.js';
import { getCurrentUser, requireAuth, logout } from './auth.js';
import { t, setLang, getLang, applyTranslations } from './i18n.js';
import { setUnitSystem, getUnitSystem, SYSTEM_PRESETS, syncPrefsFromProfile, savePrefsToProfile } from './unit-prefs.js';

let currentUser = null;
let currentProfile = null;

/**
 * Compatibility Stubs - Redirects legacy modal triggers to the new profile page
 */
export async function initProfileModal() {
  const elGamertagHeader = document.getElementById('userGamertag');
  const elLinkEditProfile = document.getElementById('linkEditProfile');

  const redirectToProfile = (e) => {
    if (e) e.preventDefault();
    
    // Close drawer menu if open
    const drawerMenu = document.getElementById('drawerMenu');
    if (drawerMenu) drawerMenu.classList.remove('open');
    
    window.location.href = 'profile.html';
  };

  if (elGamertagHeader) {
    elGamertagHeader.style.cursor = 'pointer';
    elGamertagHeader.title = t('profile.title');
    elGamertagHeader.addEventListener('click', redirectToProfile);
  }

  if (elLinkEditProfile) {
    elLinkEditProfile.addEventListener('click', redirectToProfile);
  }
}

export async function openProfileModal() {
  window.location.href = 'profile.html';
}

/**
 * Profile Page Initialization
 */
async function initProfilePage() {
  // 1. Enforce auth
  const authInfo = await requireAuth();
  if (!authInfo) return; // redirected
  
  currentUser = authInfo.user;
  currentProfile = authInfo.profile;

  // 2. Sync unit preferences
  await syncPrefsFromProfile(currentUser.id);

  // 3. Bind UI Form Elements
  const elForm = document.getElementById('profileForm');
  const elStatus = document.getElementById('profileStatus');
  const elGamertag = document.getElementById('profileGamertag');
  const elUsername = document.getElementById('profileUsername');
  const elLang = document.getElementById('profileLang');
  const elUnit = document.getElementById('profileUnit');
  const elPassword = document.getElementById('profilePassword');

  // Custom unit elements
  const elCustomSection = document.getElementById('profileCustomUnits');
  const elPrefPower = document.getElementById('prefPower');
  const elPrefTorque = document.getElementById('prefTorque');
  const elPrefWeight = document.getElementById('prefWeight');
  const elPrefPressure = document.getElementById('prefPressure');
  const elPrefSpring = document.getElementById('prefSpring');
  const elPrefHeight = document.getElementById('prefHeight');
  const elPrefForce = document.getElementById('prefForce');

  // Populate data
  if (elGamertag) elGamertag.value = currentProfile.gamertag;
  if (elUsername) elUsername.value = currentProfile.username || '';
  if (elLang) elLang.value = currentProfile.preferred_language || getLang();
  
  const activeSystem = currentProfile.preferred_unit_system || getUnitSystem();
  if (elUnit) {
    elUnit.value = activeSystem;
    
    if (activeSystem === 'custom') {
      elCustomSection.style.display = 'flex';
    } else {
      elCustomSection.style.display = 'none';
    }

    // Toggle custom units area
    elUnit.addEventListener('change', () => {
      if (elUnit.value === 'custom') {
        elCustomSection.style.display = 'flex';
      } else {
        elCustomSection.style.display = 'none';
        
        // Auto-fill preset values to custom selects
        const preset = elUnit.value;
        const presetPrefs = SYSTEM_PRESETS[preset];
        if (presetPrefs) {
          elPrefPower.value = presetPrefs.power;
          elPrefTorque.value = presetPrefs.torque;
          elPrefWeight.value = presetPrefs.weight;
          elPrefPressure.value = presetPrefs.pressure;
          elPrefSpring.value = presetPrefs.spring;
          elPrefHeight.value = presetPrefs.height;
          elPrefForce.value = presetPrefs.force;
        }
      }
    });
  }

  // Populate custom units
  const uPrefs = currentProfile.unit_preferences && Object.keys(currentProfile.unit_preferences).length > 0
    ? currentProfile.unit_preferences
    : (SYSTEM_PRESETS[activeSystem] || SYSTEM_PRESETS['mixed']);

  if (elPrefPower) elPrefPower.value = uPrefs.power || 'hp';
  if (elPrefTorque) elPrefTorque.value = uPrefs.torque || 'lb-ft';
  if (elPrefWeight) elPrefWeight.value = uPrefs.weight || 'kg';
  if (elPrefPressure) elPrefPressure.value = uPrefs.pressure || 'psi';
  if (elPrefSpring) elPrefSpring.value = uPrefs.spring || 'lb/in';
  if (elPrefHeight) elPrefHeight.value = uPrefs.height || 'in';
  if (elPrefForce) elPrefForce.value = uPrefs.force || 'lb_df';

  // Form Submit Action
  if (elForm) {
    elForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (elStatus) {
        elStatus.textContent = t('profile.messages.saving');
        elStatus.className = 'status-text success';
      }

      const usernameVal = elUsername.value.trim();
      const langVal = elLang.value;
      const unitVal = elUnit.value;
      const passwordVal = elPassword.value;

      const customPrefs = {
        power: elPrefPower.value,
        torque: elPrefTorque.value,
        weight: elPrefWeight.value,
        pressure: elPrefPressure.value,
        spring: elPrefSpring.value,
        height: elPrefHeight.value,
        force: elPrefForce.value
      };

      try {
        // Update auth password if requested
        if (passwordVal) {
          if (passwordVal.length < 6) {
            throw new Error(t('auth.messages.password_min'));
          }
          const { error: authError } = await supabase.auth.updateUser({ password: passwordVal });
          if (authError) throw authError;
        }

        // Prepare profile payload
        const updateData = {
          username: usernameVal || null,
          preferred_language: langVal,
          preferred_unit_system: unitVal
        };

        if (unitVal === 'custom') {
          updateData.unit_preferences = customPrefs;
        } else {
          updateData.unit_preferences = SYSTEM_PRESETS[unitVal] || {};
        }

        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', currentUser.id);

        if (error) throw error;

        // Apply changes locally to sync UI instantly
        setLang(langVal);

        if (unitVal === 'custom') {
          localStorage.setItem('fz_unit_system', 'custom');
          localStorage.setItem('fz_unit_prefs', JSON.stringify(customPrefs));
          document.dispatchEvent(new CustomEvent('systemchange', { detail: { system: 'custom', prefs: customPrefs } }));
          Object.entries(customPrefs).forEach(([group, unit]) => {
            document.dispatchEvent(new CustomEvent('unitchange', { detail: { group, unit } }));
          });
        } else {
          setUnitSystem(unitVal);
        }

        if (elStatus) {
          elStatus.textContent = t('profile.messages.saved');
          elStatus.className = 'status-text success';
        }

        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1200);
      } catch (err) {
        console.error('Error saving profile page:', err);
        if (elStatus) {
          elStatus.textContent = t('profile.messages.save_error') + err.message;
          elStatus.className = 'status-text error';
        }
      }
    });
  }

  // 4. Initialize Drawer Menu and Header Elements for profile.html itself
  initializeHeaderAndDrawer(currentProfile);
}

/**
 * Populates header/drawer logic for instructions.html / profile.html consistency
 */
function initializeHeaderAndDrawer(profile) {
  const elGamertag = document.getElementById('userGamertag');
  const elUnitSystem = document.getElementById('headerUnitSystem');
  const elAdminLink = document.getElementById('adminLink');
  const elBtnLogout = document.getElementById('btnLogout');

  // Set Gamertag in drawer
  if (elGamertag) {
    elGamertag.innerHTML = `GAMERTAG: <span>${profile.gamertag}</span>`;
  }

  // Setup header unit preset selector (sync changes to Supabase)
  if (elUnitSystem) {
    elUnitSystem.value = getUnitSystem();
    elUnitSystem.addEventListener('change', async (e) => {
      const val = e.target.value;
      setUnitSystem(val);
      if (currentUser) {
        savePrefsToProfile(currentUser.id);
      }
      if (val === 'custom') {
        window.location.href = 'profile.html';
      }
    });
  }

  // Monitor dynamic unit change updates
  document.addEventListener('systemchange', (e) => {
    if (elUnitSystem) elUnitSystem.value = e.detail.system;
  });

  // Display admin dashboard link if admin
  if (profile.is_admin && elAdminLink) {
    elAdminLink.style.display = 'inline-block';
  }

  // i18n toggles in drawer
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

  // Bind logout button
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

  // Hook compatibility stub redirect for current page header/drawer clicks
  initProfileModal();

  // Apply translations
  applyTranslations();
}

// Start page initialization
document.addEventListener('DOMContentLoaded', () => {
  const isProfilePage = document.getElementById('profileForm');
  if (isProfilePage) {
    initProfilePage();
  }
});
