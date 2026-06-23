import { supabase } from './supabase.js';
import { requireAuth, logout } from './auth.js';
import { getLang, setLang, applyTranslations, t } from './i18n.js';
import { getUnitPref, syncPrefsFromProfile, getUnitSystem, setUnitSystem, savePrefsToProfile } from './unit-prefs.js';
import { display } from './units.js';
import { initProfileModal } from './profile.js';
import { duplicateCar } from './duplicate.js';

let currentUser = null;
let currentProfile = null;
let allCars = [];
let profileMap = {}; // id -> gamertag

// DOM elements
const elGamertag = document.getElementById('userGamertag');
const elUnitSystem = document.getElementById('headerUnitSystem');
const elAdminLink = document.getElementById('adminLink');
const elBtnLogout = document.getElementById('btnLogout');
const elCarsGrid = document.getElementById('carsGrid');
const elLoading = document.getElementById('loadingState');
const elEmpty = document.getElementById('emptyState');

const elFilterMake = document.getElementById('filterMake');
const elFilterClass = document.getElementById('filterClass');
const elFilterOwner = document.getElementById('filterOwner');
const elBtnClearFilters = document.getElementById('btnClearFilters');
const elFilterCount = document.getElementById('filterCount');

// Debounce timer
let debounceTimer;

/**
 * Initialize dashboard
 */
async function init() {
  // 1. Enforce auth
  const authInfo = await requireAuth();
  if (!authInfo) return; // redirected
  
  currentUser = authInfo.user;
  currentProfile = authInfo.profile;

  // Initialize unit preferences
  await syncPrefsFromProfile(currentUser.id);

  // Initialize i18n toggles
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
  
  // Apply initial translations
  applyTranslations();

  // Initialize Profile Settings Modal
  await initProfileModal();

  // Initialize header unit preset selector
  if (elUnitSystem) {
    elUnitSystem.value = getUnitSystem();
    elUnitSystem.addEventListener('change', (e) => {
      setUnitSystem(e.target.value);
      if (currentUser) {
        savePrefsToProfile(currentUser.id);
      }
    });
  }

  // Listen to i18n or unit changes to redraw the grid
  document.addEventListener('langchange', () => {
    applyFilters();
  });
  document.addEventListener('unitchange', () => {
    applyFilters();
  });
  document.addEventListener('systemchange', (e) => {
    if (elUnitSystem) elUnitSystem.value = e.detail.system;
    applyFilters();
  });

  // Update header UI
  if (elGamertag) {
    elGamertag.innerHTML = `GAMERTAG: <span>${currentProfile.gamertag}</span>`;
  }

  // Show admin panel link if user is admin
  if (currentProfile.is_admin && elAdminLink) {
    elAdminLink.style.display = 'inline-block';
  }

  // Bind logout
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

  // Bind filter events
  if (elFilterMake) elFilterMake.addEventListener('input', handleFilterInput);
  if (elFilterClass) elFilterClass.addEventListener('change', applyFilters);
  if (elFilterOwner) elFilterOwner.addEventListener('input', handleFilterInput);
  if (elBtnClearFilters) elBtnClearFilters.addEventListener('click', clearFilters);

  // Load cars
  await fetchAndRenderCars();
}

/**
 * Fetch cars and cache profiles
 */
async function fetchAndRenderCars() {
  if (!supabase) return;
  
  showLoading(true);
  try {
    // Fetch cars accessible to the user (RLS will automatically filter)
    const { data: cars, error } = await supabase
      .from('cars')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allCars = cars || [];

    // Fetch profiles for user_id and original_owner_id in the result set to display gamertags
    const userIds = [...new Set(allCars.flatMap(c => [c.user_id, c.original_owner_id]))];
    if (userIds.length > 0) {
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, gamertag')
        .in('id', userIds);

      if (profErr) throw profErr;

      // Build mapping map
      profileMap = {};
      profiles.forEach(p => {
        profileMap[p.id] = p.gamertag;
      });
    }

    applyFilters();
  } catch (err) {
    console.error('Error fetching cars:', err);
    alert('Erro ao carregar carros da garagem: ' + err.message);
  } finally {
    showLoading(false);
  }
}

/**
 * Handle input filters with a brief debounce to feel responsive
 */
function handleFilterInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    applyFilters();
  }, 250);
}

/**
 * Filter list of cars and render
 */
function applyFilters() {
  const makeVal = elFilterMake ? elFilterMake.value.toLowerCase().trim() : '';
  const classVal = elFilterClass ? elFilterClass.value : '';
  const ownerVal = elFilterOwner ? elFilterOwner.value.toLowerCase().trim() : '';

  const filtered = allCars.filter(car => {
    // 1. Make filter
    if (makeVal && (!car.make || !car.make.toLowerCase().includes(makeVal))) {
      return false;
    }

    // 2. Class filter
    if (classVal && car.class !== classVal) {
      return false;
    }

    // 3. Original Owner Gamertag filter
    if (ownerVal) {
      const originalOwnerGamertag = profileMap[car.original_owner_id] || '';
      if (!originalOwnerGamertag.toLowerCase().includes(ownerVal)) {
        return false;
      }
    }

    return true;
  });

  // Update counts with correct localization
  if (elFilterCount) {
    elFilterCount.innerHTML = `${t('common.showing', { count: filtered.length })} <span>${filtered.length}</span> ${t('common.of')} ${allCars.length} ${t('common.cars')}`;
    // Fallback if translations aren't fully defined for showing/of/cars
    if (elFilterCount.textContent.includes('common.')) {
      elFilterCount.innerHTML = `Mostrando <span>${filtered.length}</span> de ${allCars.length} carros`;
    }
  }

  renderCarsGrid(filtered);
}

/**
 * Clear all filters
 */
function clearFilters() {
  if (elFilterMake) elFilterMake.value = '';
  if (elFilterClass) elFilterClass.value = '';
  if (elFilterOwner) elFilterOwner.value = '';
  applyFilters();
}

function getCarImageUrl(make, carModel, year) {
  const makePart = String(make || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
  const modelPart = String(carModel || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
  const yearPart = year ? String(year) : '';
  const path = [yearPart, makePart, modelPart].filter(Boolean).join('-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return `https://www.forzafire.com/images/base/cars/${path}.png`;
}

/**
 * Render the list of cards
 */
function renderCarsGrid(cars) {
  if (!elCarsGrid) return;
  elCarsGrid.innerHTML = '';

  if (cars.length === 0) {
    elEmpty.style.display = 'block';
    return;
  }
  elEmpty.style.display = 'none';

  cars.forEach(car => {
    const isOwner = car.user_id === currentUser.id;
    const isCloned = car.cloned_from !== null;
    const originalOwnerGamertag = profileMap[car.original_owner_id] || 'Desconhecido';
    const ownerGamertag = profileMap[car.user_id] || 'Desconhecido';

    // Classify card type and determine badge
    let cardTypeClass = 'own';
    let badgeHtml = '';

    if (isOwner && !isCloned) {
      cardTypeClass = 'own';
      badgeHtml = `<span class="badge own">${t('dashboard.badge_mine')}</span>`;
    } else if (isOwner && isCloned) {
      cardTypeClass = 'clone';
      badgeHtml = `<span class="badge clone">${t('dashboard.badge_clone', { gamertag: originalOwnerGamertag })}</span>`;
    } else {
      cardTypeClass = 'shared';
      badgeHtml = `<span class="badge shared">${t('dashboard.badge_shared', { gamertag: ownerGamertag })}</span>`;
    }

    // Target URL
    const targetUrl = isOwner ? `car-form.html?id=${car.id}` : `car-view.html?id=${car.id}`;

    // Create card element
    const card = document.createElement('div');
    card.className = `car-card ${cardTypeClass}`;
    
    // Performance Index class coloring
    const lowerClass = (car.class || '').toLowerCase();
    const classColorClass = `class-${lowerClass}`;

    // Get unit-converted values for Power, Torque, Weight from details JSONB
    const powerDisplay = display(car.details?.power, getUnitPref('power'));
    const torqueDisplay = display(car.details?.torque, getUnitPref('torque'));
    const weightDisplay = display(car.details?.weight, getUnitPref('weight'));

    // Only allow owner to duplicate their own car directly from dashboard
    const duplicateBtnHtml = isOwner 
      ? `<button class="car-card-duplicate-btn" data-i18n="dashboard.btn_duplicate">${t('dashboard.btn_duplicate')}</button>`
      : '';

    card.innerHTML = `
      ${badgeHtml}
      ${duplicateBtnHtml}
      <div class="car-card-header">
        <div class="car-card-brand">${car.year || '—'} ${car.make || 'MARCA'}</div>
        <div class="car-card-name">${car.car || 'Modelo do Carro'}</div>
      </div>

      <div class="car-card-image-container" style="text-align: center; background: rgba(0, 0, 0, 0.2); border-radius: 4px; padding: 4px; height: 110px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-top: 4px;">
        <img class="car-card-image" src="${getCarImageUrl(car.make, car.car, car.year)}" alt="${car.car}" style="max-width: 100%; max-height: 100%; object-fit: contain; display: none;" onload="this.style.display='block'; const ph=this.nextElementSibling; if(ph) ph.style.display='none';">
        <div class="car-card-image-placeholder" style="font-family: var(--cond); font-size: 0.65rem; color: var(--muted); text-transform: uppercase;">🏎️ No Image</div>
      </div>

      <div class="car-card-specs">
        <div class="spec-item">
          <div class="spec-label" data-i18n="car.fields.power">Potência</div>
          <div class="spec-value">${powerDisplay}</div>
        </div>
        <div class="spec-item">
          <div class="spec-label" data-i18n="car.fields.torque">Torque</div>
          <div class="spec-value">${torqueDisplay}</div>
        </div>
        <div class="spec-item">
          <div class="spec-label" data-i18n="car.fields.weight">Peso</div>
          <div class="spec-value">${weightDisplay}</div>
        </div>
      </div>

      <div class="car-card-class-row">
        <div class="car-card-class ${classColorClass}">${car.class || 'Classe'}</div>
        <div class="car-card-owner">Original: <span>@${originalOwnerGamertag}</span></div>
      </div>
    `;

    // Click handler to redirect
    card.addEventListener('click', () => {
      window.location.href = targetUrl;
    });

    // Attach click listener for duplicate button
    if (isOwner) {
      const btnDup = card.querySelector('.car-card-duplicate-btn');
      if (btnDup) {
        btnDup.addEventListener('click', async (e) => {
          e.stopPropagation(); // Avoid navigating to car-form.html for this build
          
          btnDup.disabled = true;
          const originalText = btnDup.textContent;
          btnDup.textContent = '...';
          
          try {
            const newCarId = await duplicateCar(car.id, currentUser.id);
            // Success: navigate to newly created duplicate so they can start tuning it!
            window.location.href = `car-form.html?id=${newCarId}`;
          } catch (err) {
            console.error('Error duplicating card:', err);
            alert(t('common.error') || 'Erro: ' + err.message);
            btnDup.disabled = false;
            btnDup.textContent = originalText;
          }
        });
      }
    }

    elCarsGrid.appendChild(card);
  });
  
  // Re-apply static translations (like spec labels inside cards)
  applyTranslations();
}

function showLoading(show) {
  if (elLoading) elLoading.style.display = show ? 'flex' : 'none';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
