import { supabase } from './supabase.js';
import { getCurrentUser } from './auth.js';
import { t, setLang, getLang, applyTranslations } from './i18n.js';
import { setUnitSystem, getUnitSystem, SYSTEM_PRESETS } from './unit-prefs.js';

let currentUser = null;

/**
 * Dynamically injects CSS styles for the Profile Modal
 */
function injectProfileStyles() {
  if (document.getElementById('profile-modal-styles')) return;

  const style = document.createElement('style');
  style.id = 'profile-modal-styles';
  style.textContent = `
    .profile-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(5, 7, 4, 0.85);
      backdrop-filter: blur(16px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      padding: 16px;
      box-sizing: border-box;
    }
    .profile-modal-overlay.open {
      opacity: 1;
      pointer-events: auto;
    }
    .profile-modal {
      background: var(--panel2);
      border: 2px solid var(--border2);
      border-radius: 4px;
      width: 100%;
      max-width: 440px;
      max-height: 90vh;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 32px;
      position: relative;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      transform: translateY(-20px);
      transition: transform 0.3s ease;
      box-sizing: border-box;
    }
    @media (max-width: 480px) {
      .profile-modal {
        padding: 20px;
        max-height: 95vh;
      }
    }
    .profile-modal-overlay.open .profile-modal {
      transform: translateY(0);
    }
    .profile-modal-title {
      font-family: var(--cond);
      font-weight: 900;
      font-size: 1.8rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 24px;
      border-bottom: 2px solid var(--green);
      padding-bottom: 12px;
      color: var(--text);
    }
    .profile-modal-title em {
      font-style: normal;
      color: var(--pink);
    }
    .profile-field-group {
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .profile-label {
      font-family: var(--cond);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
    }
    .profile-input, .profile-select {
      background: rgba(10, 12, 8, 0.6);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 10px 14px;
      font-family: var(--body);
      font-size: 0.9rem;
      border-radius: 2px;
      transition: all 0.2s ease;
      width: 100%;
      box-sizing: border-box;
    }
    .profile-input:focus, .profile-select:focus {
      outline: none;
      border-color: var(--pink);
      background: rgba(10, 12, 8, 0.9);
      box-shadow: 0 0 10px rgba(255, 0, 127, 0.15);
    }
    .profile-input:disabled {
      background: rgba(20, 24, 16, 0.4);
      color: var(--muted);
      border-color: rgba(179, 211, 53, 0.05);
      cursor: not-allowed;
    }
    .profile-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      margin-top: 28px;
    }
    .profile-status {
      font-family: var(--cond);
      font-size: 0.8rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 16px;
      min-height: 18px;
    }
    .profile-status.error { color: var(--red); }
    .profile-status.success { color: var(--green); }
    .profile-status.info { color: var(--cyan); }
    .custom-units-section {
      border: 1px solid var(--border2);
      background: rgba(10, 12, 8, 0.4);
      padding: 16px;
      border-radius: 4px;
      margin-top: 12px;
      display: none;
      flex-direction: column;
      gap: 12px;
    }
    .custom-units-title {
      font-family: var(--cond);
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--pink);
      border-bottom: 1px solid rgba(255, 0, 127, 0.2);
      padding-bottom: 6px;
      margin-bottom: 4px;
    }
    .custom-units-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .custom-unit-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Dynamically injects the Profile Modal HTML markup
 */
function injectProfileHTML() {
  if (document.getElementById('profileModal')) return;

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'profileModal';
  modalOverlay.className = 'profile-modal-overlay';
  modalOverlay.innerHTML = `
    <div class="profile-modal">
      <h3 class="profile-modal-title" data-i18n="profile.title">Profile <em>Settings</em></h3>
      <div id="profileStatus" class="profile-status"></div>
      
      <div class="profile-field-group">
        <span class="profile-label">Gamertag</span>
        <input type="text" id="profileGamertag" class="profile-input" disabled>
      </div>

      <div class="profile-field-group">
        <label for="profileUsername" class="profile-label" data-i18n="profile.username_label">Display Name</label>
        <input type="text" id="profileUsername" class="profile-input" placeholder="Your name or nickname..." data-i18n="profile.username_placeholder">
      </div>

      <div class="profile-field-group">
        <label for="profileLang" class="profile-label" data-i18n="profile.lang_label">Preferred Language</label>
        <select id="profileLang" class="profile-select">
          <option value="en">English</option>
          <option value="pt">Português</option>
        </select>
      </div>

      <div class="profile-field-group">
        <label for="profileUnit" class="profile-label" data-i18n="profile.unit_label">Unit System</label>
        <select id="profileUnit" class="profile-select">
          <option value="mixed" data-i18n="units.mixed">Forza Style</option>
          <option value="metric" data-i18n="units.metric">Metric</option>
          <option value="imperial" data-i18n="units.imperial">Imperial</option>
          <option value="custom" data-i18n="units.custom">Custom</option>
        </select>
        
        <div id="profileCustomUnits" class="custom-units-section">
          <div class="custom-units-title" data-i18n="profile.custom_units_title">Custom Unit Preferences</div>
          <div class="custom-units-grid">
            <div class="custom-unit-field">
              <label for="prefPower" class="profile-label" data-i18n="units.power">Power</label>
              <select id="prefPower" class="profile-select">
                <option value="hp">hp</option>
                <option value="cv">cv</option>
                <option value="kW">kW</option>
              </select>
            </div>
            <div class="custom-unit-field">
              <label for="prefTorque" class="profile-label" data-i18n="units.torque">Torque</label>
              <select id="prefTorque" class="profile-select">
                <option value="lb-ft">lb-ft</option>
                <option value="N·m">N·m</option>
              </select>
            </div>
            <div class="custom-unit-field">
              <label for="prefWeight" class="profile-label" data-i18n="units.weight">Weight</label>
              <select id="prefWeight" class="profile-select">
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </div>
            <div class="custom-unit-field">
              <label for="prefPressure" class="profile-label" data-i18n="units.pressure">Tire Pressure</label>
              <select id="prefPressure" class="profile-select">
                <option value="psi">psi</option>
                <option value="bar">bar</option>
                <option value="kPa">kPa</option>
              </select>
            </div>
            <div class="custom-unit-field">
              <label for="prefSpring" class="profile-label" data-i18n="units.spring">Springs</label>
              <select id="prefSpring" class="profile-select">
                <option value="lb/in">lb/in</option>
                <option value="N/mm">N/mm</option>
                <option value="kgf/mm">kgf/mm</option>
              </select>
            </div>
            <div class="custom-unit-field">
              <label for="prefHeight" class="profile-label" data-i18n="units.height">Ride Height</label>
              <select id="prefHeight" class="profile-select">
                <option value="in">in</option>
                <option value="cm">cm</option>
              </select>
            </div>
            <div class="custom-unit-field" style="grid-column: span 2;">
              <label for="prefForce" class="profile-label" data-i18n="units.force">Downforce</label>
              <select id="prefForce" class="profile-select">
                <option value="lb_df">lb</option>
                <option value="kg_df">kg</option>
                <option value="kgf_df">kgf</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="profile-field-group">
        <label for="profilePassword" class="profile-label" data-i18n="profile.new_password_label">Nova Senha (Opcional)</label>
        <input type="password" id="profilePassword" class="profile-input" placeholder="Preencha apenas para alterar..." data-i18n="profile.new_password_placeholder">
      </div>

      <div class="profile-modal-footer">
        <button type="button" id="btnCancelProfile" class="btn-clear" data-i18n="common.cancel" style="font-size: 0.8rem;">Cancel</button>
        <button type="button" id="btnSaveProfile" class="btn" data-i18n="common.save" style="font-size: 0.8rem; padding: 10px 24px;">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalOverlay);
}

/**
 * Initializes Profile Modal behavior and binds to Gamertag header element
 */
export async function initProfileModal() {
  currentUser = await getCurrentUser();
  if (!currentUser) return;

  // Inject UI CSS/HTML structure
  injectProfileStyles();
  injectProfileHTML();

  const elGamertagHeader = document.getElementById('userGamertag');
  const elModal = document.getElementById('profileModal');
  const elBtnCancel = document.getElementById('btnCancelProfile');
  const elBtnSave = document.getElementById('btnSaveProfile');
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

  if (!elGamertagHeader || !elModal) return;

  // Toggle visibility and preset copy on unit change
  if (elUnit) {
    elUnit.addEventListener('change', () => {
      if (elUnit.value === 'custom') {
        elCustomSection.style.display = 'flex';
      } else {
        elCustomSection.style.display = 'none';
        // Pre-populate custom dropdowns with the selected preset's values
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

  // Add click handler to Gamertag Header and Link
  const openAction = async (e) => {
    if (e) e.preventDefault();
    const drawerMenu = document.getElementById('drawerMenu');
    if (drawerMenu) drawerMenu.classList.remove('open');
    await openProfileModal();
  };

  if (elGamertagHeader) {
    elGamertagHeader.style.cursor = 'pointer';
    elGamertagHeader.title = t('profile.title');
    elGamertagHeader.addEventListener('click', openAction);
  }

  const elLinkEditProfile = document.getElementById('linkEditProfile');
  if (elLinkEditProfile) {
    elLinkEditProfile.addEventListener('click', openAction);
  }

  // Cancel click
  if (elBtnCancel) {
    elBtnCancel.onclick = () => {
      elModal.classList.remove('open');
    };
  }

  // Close when clicking overlay
  elModal.onclick = (e) => {
    if (e.target === elModal) {
      elModal.classList.remove('open');
    }
  };

  // Save changes click
  if (elBtnSave) {
    elBtnSave.onclick = async () => {
      elStatus.textContent = t('profile.messages.saving');
      elStatus.className = 'profile-status info';

      const usernameVal = elUsername.value.trim();
      const langVal = elLang.value;
      const unitVal = elUnit.value;
      const passwordVal = elPassword.value;

      // Build custom unit preferences object
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
        if (passwordVal) {
          if (passwordVal.length < 6) {
            throw new Error(t('auth.messages.password_min'));
          }
          const { error: authError } = await supabase.auth.updateUser({ password: passwordVal });
          if (authError) throw authError;
        }

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

        elStatus.textContent = t('profile.messages.saved');
        elStatus.className = 'profile-status success';

        setTimeout(() => {
          elModal.classList.remove('open');
          // Reload gamertag on header if username was set or changed
          window.location.reload();
        }, 1000);
      } catch (err) {
        console.error('Error saving profile changes:', err);
        elStatus.textContent = t('profile.messages.save_error') + err.message;
        elStatus.className = 'profile-status error';
      }
    };
  }
}

/**
 * Loads profile data and opens the profile settings modal
 */
export async function openProfileModal() {
  if (!currentUser) currentUser = await getCurrentUser();
  if (!currentUser) return;

  const elModal = document.getElementById('profileModal');
  if (!elModal) return;
  const elStatus = document.getElementById('profileStatus');
  const elGamertag = document.getElementById('profileGamertag');
  const elUsername = document.getElementById('profileUsername');
  const elLang = document.getElementById('profileLang');
  const elUnit = document.getElementById('profileUnit');
  const elCustomSection = document.getElementById('profileCustomUnits');

  const elPrefPower = document.getElementById('prefPower');
  const elPrefTorque = document.getElementById('prefTorque');
  const elPrefWeight = document.getElementById('prefWeight');
  const elPrefPressure = document.getElementById('prefPressure');
  const elPrefSpring = document.getElementById('prefSpring');
  const elPrefHeight = document.getElementById('prefHeight');
  const elPrefForce = document.getElementById('prefForce');

  elStatus.textContent = '';
  elStatus.className = 'profile-status';
  elModal.classList.add('open');

  try {
    elStatus.textContent = t('common.loading');
    elStatus.className = 'profile-status info';

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (error) throw error;

    elGamertag.value = profile.gamertag;
    elUsername.value = profile.username || '';
    elLang.value = profile.preferred_language || getLang();
    
    const activeSystem = profile.preferred_unit_system || getUnitSystem();
    elUnit.value = activeSystem;
    
    if (activeSystem === 'custom') {
      elCustomSection.style.display = 'flex';
    } else {
      elCustomSection.style.display = 'none';
    }

    // Populate custom unit selects
    const uPrefs = profile.unit_preferences && Object.keys(profile.unit_preferences).length > 0
      ? profile.unit_preferences
      : (SYSTEM_PRESETS[activeSystem] || SYSTEM_PRESETS['mixed']);

    elPrefPower.value = uPrefs.power || 'hp';
    elPrefTorque.value = uPrefs.torque || 'lb-ft';
    elPrefWeight.value = uPrefs.weight || 'kg';
    elPrefPressure.value = uPrefs.pressure || 'psi';
    elPrefSpring.value = uPrefs.spring || 'lb/in';
    elPrefHeight.value = uPrefs.height || 'in';
    elPrefForce.value = uPrefs.force || 'lb_df';

    elStatus.textContent = '';
    elStatus.className = 'profile-status';
    
    applyTranslations();
  } catch (err) {
    console.error('Error fetching profile:', err);
    elStatus.textContent = t('profile.messages.save_error') + err.message;
    elStatus.className = 'profile-status error';
  }
}
