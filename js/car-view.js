import { supabase } from './supabase.js';
import { requireAuth } from './auth.js';
import { duplicateCar } from './duplicate.js';
import { getLang, setLang, applyTranslations, t } from './i18n.js';
import { getUnitPref, getUnitSystem, setUnitSystem, syncPrefsFromProfile, savePrefsToProfile } from './unit-prefs.js';
import { display, FIELD_TO_GROUP } from './units.js';
import { CAR_FIELDS } from './car-fields.js';
import { initProfileModal } from './profile.js';

let currentUser = null;
let currentProfile = null;
let carId = null;
let currentCarData = null;

// DOM Elements
const elUserGamertag = document.getElementById('userGamertag');
const elBtnLogout = document.getElementById('btnLogout');
const elFormTitle = document.getElementById('formTitle');
const elBuildBadge = document.getElementById('buildBadge');
const elBtnDuplicate = document.getElementById('btnDuplicate');
const elViewStatus = document.getElementById('viewStatus');
const elUnitSystem = document.getElementById('headerUnitSystem');
const elAccordionContainer = document.getElementById('accordionContainer');

// Car Image DOM Elements
let elCarImageContainer = null;
let elCarImage = null;
let elCarImagePlaceholder = null;

function getCarImageUrl(make, carModel, year) {
  const makePart = String(make || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
  const modelPart = String(carModel || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
  const yearPart = year ? String(year) : '';
  const path = [yearPart, makePart, modelPart].filter(Boolean).join('-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return `https://www.forzafire.com/images/base/cars/${path}.png`;
}

function updateViewCarImage(make, carModel, year) {
  if (!elCarImageContainer || !elCarImage) return;

  if (make && carModel) {
    elCarImageContainer.style.display = 'flex';
    elCarImage.style.display = 'none';
    if (elCarImagePlaceholder) {
      elCarImagePlaceholder.textContent = t('car.image_loading');
      elCarImagePlaceholder.style.display = 'block';
    }
    elCarImage.src = getCarImageUrl(make, carModel, year);
  } else {
    elCarImageContainer.style.display = 'flex';
    elCarImage.style.display = 'none';
    if (elCarImagePlaceholder) {
      elCarImagePlaceholder.textContent = t('car.image_select');
      elCarImagePlaceholder.style.display = 'block';
    }
    elCarImage.removeAttribute('src');
  }
}

// Dynamically generate FIELD_GROUPS and allFieldNames from CAR_FIELDS config
const FIELD_GROUPS = {
  make: 'root',
  car: 'root',
  year: 'root',
  class: 'root'
};
const allFieldNames = ['make', 'car', 'year', 'class'];

CAR_FIELDS.sections.forEach(section => {
  section.fields.forEach(field => {
    // Skip already defined root fields
    if (['make', 'car', 'year', 'class'].includes(field.id)) {
      return;
    }
    FIELD_GROUPS[field.id] = section.id;
    allFieldNames.push(field.id);
  });
});

/**
 * Dynamically construct HTML elements in the view page
 */
function renderViewHTML() {
  if (!elAccordionContainer) return;
  elAccordionContainer.innerHTML = '';

  const sectionsToRender = [];

  // 1. Details section (normal accordion)
  const detailsSec = CAR_FIELDS.sections.find(s => s.id === 'details');
  if (detailsSec) sectionsToRender.push(detailsSec);

  // 2. Upgrades virtual section combining several sub-sections
  const upgradeSubSectionsIds = ['conversion', 'engine', 'platform', 'drivetrain', 'tires', 'aero', 'motor_battery'];
  const upgradeSubSections = [];
  upgradeSubSectionsIds.forEach(subId => {
    const subSec = CAR_FIELDS.sections.find(s => s.id === subId);
    if (subSec) upgradeSubSections.push(subSec);
  });

  if (upgradeSubSections.length > 0) {
    sectionsToRender.push({
      id: 'upgrades',
      title_key: 'car.upgrades',
      isVirtualUpgrades: true,
      subSections: upgradeSubSections
    });
  }

  // 3. Tuning section (custom tabs)
  const tuningSec = CAR_FIELDS.sections.find(s => s.id === 'tuning');
  if (tuningSec) sectionsToRender.push(tuningSec);

  sectionsToRender.forEach((section, sIndex) => {
    const acc = document.createElement('div');
    acc.className = 'accordion';
    if (sIndex === 0) {
      acc.classList.add('open');
    }
    acc.dataset.section = section.id;

    // Header
    const accHeader = document.createElement('div');
    accHeader.className = 'accordion-header';
    
    const accTitle = document.createElement('span');
    accTitle.className = 'accordion-title';
    accTitle.dataset.i18n = section.title_key;
    accTitle.textContent = t(section.title_key);
    
    const accChevron = document.createElement('span');
    accChevron.className = 'accordion-chevron';
    accChevron.textContent = '▼';

    accHeader.appendChild(accTitle);
    accHeader.appendChild(accChevron);

    // Body
    const accBody = document.createElement('div');
    accBody.className = 'accordion-body';

    if (section.isVirtualUpgrades) {
      const tabsWrapper = document.createElement('div');
      tabsWrapper.className = 'tuning-tabs-wrapper';

      const btnLeft = document.createElement('button');
      btnLeft.type = 'button';
      btnLeft.className = 'tuning-scroll-btn left-btn';
      btnLeft.textContent = '◀';

      const tabsScroll = document.createElement('div');
      tabsScroll.className = 'tuning-tabs-scroll';

      const tabsList = document.createElement('div');
      tabsList.className = 'tuning-tabs-list';

      const btnRight = document.createElement('button');
      btnRight.type = 'button';
      btnRight.className = 'tuning-scroll-btn right-btn';
      btnRight.textContent = '▶';

      tabsScroll.appendChild(tabsList);
      tabsWrapper.appendChild(btnLeft);
      tabsWrapper.appendChild(tabsScroll);
      tabsWrapper.appendChild(btnRight);

      accBody.appendChild(tabsWrapper);

      const panelsContainer = document.createElement('div');
      panelsContainer.className = 'tuning-panels-container';

      section.subSections.forEach((subSec, tIndex) => {
        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = 'tuning-tab-btn';
        tabBtn.dataset.tabTarget = subSec.id;
        tabBtn.dataset.i18n = subSec.title_key;
        tabBtn.textContent = t(subSec.title_key);
        if (tIndex === 0) {
          tabBtn.classList.add('active');
        }
        tabsList.appendChild(tabBtn);

        const tabPanel = document.createElement('div');
        tabPanel.className = 'accordion-content tuning-tab-panel';
        tabPanel.dataset.tabId = subSec.id;
        if (tIndex === 0) {
          tabPanel.classList.add('active');
        }

        subSec.fields.forEach(field => {
          const fieldGroup = document.createElement('div');
          fieldGroup.className = 'field-group';

          const label = document.createElement('span');
          label.className = 'field-label';
          
          label.dataset.i18n = `car.fields.${field.id}`;
          label.textContent = t(`car.fields.${field.id}`);

          const displayDiv = document.createElement('div');
          displayDiv.id = `val-${field.id}`;
          displayDiv.className = 'field-input-readonly';
          displayDiv.textContent = '—';

          fieldGroup.appendChild(label);
          fieldGroup.appendChild(displayDiv);
          tabPanel.appendChild(fieldGroup);
        });

        panelsContainer.appendChild(tabPanel);

        tabBtn.addEventListener('click', () => {
          tabsList.querySelectorAll('.tuning-tab-btn').forEach(btn => btn.classList.remove('active'));
          panelsContainer.querySelectorAll('.tuning-tab-panel').forEach(panel => panel.classList.remove('active'));

          tabBtn.classList.add('active');
          tabPanel.classList.add('active');
        });
      });

      btnLeft.addEventListener('click', () => {
        tabsScroll.scrollBy({ left: -150, behavior: 'smooth' });
      });
      btnRight.addEventListener('click', () => {
        tabsScroll.scrollBy({ left: 150, behavior: 'smooth' });
      });

      accBody.appendChild(panelsContainer);
    } else if (section.id === 'tuning') {
      const tabsWrapper = document.createElement('div');
      tabsWrapper.className = 'tuning-tabs-wrapper';

      const btnLeft = document.createElement('button');
      btnLeft.type = 'button';
      btnLeft.className = 'tuning-scroll-btn left-btn';
      btnLeft.textContent = '◀';

      const tabsScroll = document.createElement('div');
      tabsScroll.className = 'tuning-tabs-scroll';

      const tabsList = document.createElement('div');
      tabsList.className = 'tuning-tabs-list';

      const btnRight = document.createElement('button');
      btnRight.type = 'button';
      btnRight.className = 'tuning-scroll-btn right-btn';
      btnRight.textContent = '▶';

      tabsScroll.appendChild(tabsList);
      tabsWrapper.appendChild(btnLeft);
      tabsWrapper.appendChild(tabsScroll);
      tabsWrapper.appendChild(btnRight);

      accBody.appendChild(tabsWrapper);

      const tabsData = [];
      let currentTab = null;

      section.fields.forEach(field => {
        if (field.group_header_key) {
          currentTab = {
            id: field.group_header_key,
            title_key: field.group_header_key,
            fields: []
          };
          tabsData.push(currentTab);
        }
        if (currentTab) {
          currentTab.fields.push(field);
        }
      });

      const panelsContainer = document.createElement('div');
      panelsContainer.className = 'tuning-panels-container';

      tabsData.forEach((tab, tIndex) => {
        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = 'tuning-tab-btn';
        tabBtn.dataset.tabTarget = tab.id;
        tabBtn.dataset.i18n = tab.title_key;
        tabBtn.textContent = t(tab.title_key);
        if (tIndex === 0) {
          tabBtn.classList.add('active');
        }
        tabsList.appendChild(tabBtn);

        const tabPanel = document.createElement('div');
        tabPanel.className = 'accordion-content tuning-tab-panel';
        tabPanel.dataset.tabId = tab.id;
        if (tIndex === 0) {
          tabPanel.classList.add('active');
        }

        tab.fields.forEach(field => {
          const fieldGroup = document.createElement('div');
          fieldGroup.className = 'field-group';

          const label = document.createElement('span');
          label.className = 'field-label';
          
          if (field.is_gear) {
            label.dataset.i18nN = 'car.fields.gearing_n';
            label.dataset.i18nNVal = field.gear_num;
            label.textContent = t('car.fields.gearing_n', { n: field.gear_num });
          } else {
            label.dataset.i18n = `car.fields.${field.id}`;
            label.textContent = t(`car.fields.${field.id}`);
          }

          const displayDiv = document.createElement('div');
          displayDiv.id = `val-${field.id}`;
          displayDiv.className = 'field-input-readonly';
          displayDiv.textContent = '—';

          fieldGroup.appendChild(label);
          fieldGroup.appendChild(displayDiv);
          tabPanel.appendChild(fieldGroup);
        });

        panelsContainer.appendChild(tabPanel);

        tabBtn.addEventListener('click', () => {
          tabsList.querySelectorAll('.tuning-tab-btn').forEach(btn => btn.classList.remove('active'));
          panelsContainer.querySelectorAll('.tuning-tab-panel').forEach(panel => panel.classList.remove('active'));

          tabBtn.classList.add('active');
          tabPanel.classList.add('active');
        });
      });

      btnLeft.addEventListener('click', () => {
        tabsScroll.scrollBy({ left: -150, behavior: 'smooth' });
      });
      btnRight.addEventListener('click', () => {
        tabsScroll.scrollBy({ left: 150, behavior: 'smooth' });
      });

      accBody.appendChild(panelsContainer);
    } else if (section.id === 'details') {
      const detailsLayout = document.createElement('div');
      detailsLayout.className = 'details-layout';

      const imgContainer = document.createElement('div');
      imgContainer.id = 'carImageContainer';
      imgContainer.className = 'car-form-image-container';
      imgContainer.style.display = 'flex';
      imgContainer.style.justifyContent = 'center';
      imgContainer.style.alignItems = 'center';
      imgContainer.style.background = 'rgba(0, 0, 0, 0.25)';
      imgContainer.style.border = '1px solid var(--border)';
      imgContainer.style.borderRadius = '4px';
      imgContainer.style.padding = '12px';
      imgContainer.style.flex = '1 1 300px';
      imgContainer.style.minHeight = '180px';
      imgContainer.style.maxHeight = '240px';
      imgContainer.style.position = 'relative';

      const imgEl = document.createElement('img');
      imgEl.id = 'carImage';
      imgEl.alt = 'Car Image';
      imgEl.style.maxWidth = '100%';
      imgEl.style.maxHeight = '220px';
      imgEl.style.objectFit = 'contain';
      imgEl.style.display = 'none';

      const placeholderEl = document.createElement('div');
      placeholderEl.id = 'carImagePlaceholder';
      placeholderEl.style.fontFamily = 'var(--cond)';
      placeholderEl.style.fontSize = '0.8rem';
      placeholderEl.style.color = 'var(--muted)';
      placeholderEl.style.textTransform = 'uppercase';
      placeholderEl.style.textAlign = 'center';
      placeholderEl.textContent = t('car.image_select');

      imgContainer.appendChild(imgEl);
      imgContainer.appendChild(placeholderEl);
      detailsLayout.appendChild(imgContainer);

      const accContent = document.createElement('div');
      accContent.className = 'accordion-content';
      accContent.style.flex = '2 1 400px';
      accContent.style.padding = '0';

      section.fields.forEach(field => {
        const fieldGroup = document.createElement('div');
        fieldGroup.className = 'field-group';

        const label = document.createElement('span');
        label.className = 'field-label';
        label.dataset.i18n = `car.fields.${field.id}`;
        label.textContent = t(`car.fields.${field.id}`);

        const displayDiv = document.createElement('div');
        displayDiv.id = `val-${field.id}`;
        displayDiv.className = 'field-input-readonly';
        displayDiv.textContent = '—';

        fieldGroup.appendChild(label);
        fieldGroup.appendChild(displayDiv);
        accContent.appendChild(fieldGroup);
      });

      detailsLayout.appendChild(accContent);
      accBody.appendChild(detailsLayout);

      elCarImageContainer = imgContainer;
      elCarImage = imgEl;
      elCarImagePlaceholder = placeholderEl;
    } else {
      const accContent = document.createElement('div');
      accContent.className = 'accordion-content';

      section.fields.forEach(field => {
        // Add optional group header (primarily for Tuning)
        if (field.group_header_key) {
          const gh = document.createElement('div');
          gh.className = 'grid-span-full';
          gh.dataset.i18n = field.group_header_key;
          gh.textContent = t(field.group_header_key);
          accContent.appendChild(gh);
        }

        const fieldGroup = document.createElement('div');
        fieldGroup.className = 'field-group';

        const label = document.createElement('span');
        label.className = 'field-label';
        
        if (field.is_gear) {
          label.dataset.i18nN = 'car.fields.gearing_n';
          label.dataset.i18nNVal = field.gear_num;
          label.textContent = t('car.fields.gearing_n', { n: field.gear_num });
        } else {
          label.dataset.i18n = `car.fields.${field.id}`;
          label.textContent = t(`car.fields.${field.id}`);
        }

        const displayDiv = document.createElement('div');
        displayDiv.id = `val-${field.id}`;
        displayDiv.className = 'field-input-readonly';
        displayDiv.textContent = '—';

        fieldGroup.appendChild(label);
        fieldGroup.appendChild(displayDiv);
        accContent.appendChild(fieldGroup);
      });

      accBody.appendChild(accContent);
    }
    acc.appendChild(accHeader);
    acc.appendChild(accBody);

    elAccordionContainer.appendChild(acc);
  });
}

/**
 * Initialize page
 */
async function init() {
  const authInfo = await requireAuth();
  if (!authInfo) return;

  currentUser = authInfo.user;
  currentProfile = authInfo.profile;

  // Sync unit preferences
  await syncPrefsFromProfile(currentUser.id);

  // Render view fields HTML dynamically
  renderViewHTML();

  if (elCarImage) {
    elCarImage.addEventListener('load', () => {
      elCarImage.style.display = 'block';
      if (elCarImagePlaceholder) elCarImagePlaceholder.style.display = 'none';
    });
    elCarImage.addEventListener('error', () => {
      elCarImage.style.display = 'none';
      if (elCarImagePlaceholder) {
        elCarImagePlaceholder.textContent = t('car.image_not_found');
        elCarImagePlaceholder.style.display = 'block';
      }
    });
  }

  // Initialize lang toggle buttons
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

  // Initialize header unit selector
  if (elUnitSystem) {
    elUnitSystem.value = getUnitSystem();
    elUnitSystem.addEventListener('change', (e) => {
      setUnitSystem(e.target.value);
      if (currentUser) {
        savePrefsToProfile(currentUser.id);
      }
    });
  }

  // Listen for preference/lang events
  document.addEventListener('langchange', renderAllFields);
  document.addEventListener('unitchange', renderAllFields);
  document.addEventListener('systemchange', (e) => {
    if (elUnitSystem) elUnitSystem.value = e.detail.system;
    renderAllFields();
  });

  // Header display
  if (elUserGamertag) {
    elUserGamertag.innerHTML = `GAMERTAG: <span>${currentProfile.gamertag}</span>`;
  }

  // Initialize Profile Settings Modal
  await initProfileModal();

  // Bind logout
  if (elBtnLogout) {
    elBtnLogout.addEventListener('click', async () => {
      const { logout } = await import('./auth.js');
      await logout();
      window.location.href = 'index.html';
    });
  }

  // Setup Accordion collapse/expand logic
  const accordions = document.querySelectorAll('.accordion');
  accordions.forEach(acc => {
    const header = acc.querySelector('.accordion-header');
    header.addEventListener('click', () => {
      acc.classList.toggle('open');
    });
  });

  // Get Car ID
  const urlParams = new URLSearchParams(window.location.search);
  carId = urlParams.get('id');

  if (!carId) {
    alert('Nenhuma build especificada.');
    window.location.href = 'dashboard.html';
    return;
  }

  if (elCarImage) {
    elCarImage.addEventListener('load', () => {
      elCarImage.style.display = 'block';
      if (elCarImagePlaceholder) elCarImagePlaceholder.style.display = 'none';
    });
    elCarImage.addEventListener('error', () => {
      elCarImage.style.display = 'none';
      if (elCarImagePlaceholder) {
        elCarImagePlaceholder.textContent = 'Imagem não encontrada';
        elCarImagePlaceholder.style.display = 'block';
      }
    });
  }

  await loadCarDetails();
}

/**
 * Fetch and load details of a car
 */
async function loadCarDetails() {
  if (!supabase) return;

  try {
    const { data: car, error } = await supabase
      .from('cars')
      .select('*')
      .eq('id', carId)
      .maybeSingle();

    if (error) throw error;
    if (!car) {
      alert('Build não encontrada ou você não possui acesso a ela.');
      window.location.href = 'dashboard.html';
      return;
    }

    currentCarData = car;

    // Fetch original creator profile
    const { data: originalOwner, error: ownErr } = await supabase
      .from('profiles')
      .select('gamertag')
      .eq('id', car.original_owner_id)
      .single();

    if (ownErr) throw ownErr;

    // Configure Badges & Duplication
    const isOwner = car.user_id === currentUser.id;
    if (isOwner) {
      elBuildBadge.textContent = t('dashboard.badge_mine');
      elBuildBadge.className = 'badge own';
      elViewStatus.innerHTML = `Esta build é sua. <a href="car-form.html?id=${car.id}" style="color: var(--cyan); text-decoration: underline;">Clique aqui para editar</a>.`;
    } else {
      elBuildBadge.textContent = t('dashboard.badge_shared', { gamertag: originalOwner.gamertag });
      elBuildBadge.className = 'badge shared';
      
      if (elBtnDuplicate) {
        elBtnDuplicate.style.display = 'inline-block';
        elBtnDuplicate.addEventListener('click', handleDuplicateClick);
      }
    }

    renderAllFields();
    updateViewCarImage(car.make, car.car, car.year);

  } catch (err) {
    console.error('Error loading car details:', err);
    alert('Erro ao carregar os detalhes do carro: ' + err.message);
    window.location.href = 'dashboard.html';
  }
}

function getFieldDisplayValue(car, name) {
  const group = FIELD_GROUPS[name];
  if (!group) return '—';
  
  // If it's a native root field (make, car, year, class)
  if (group === 'root') {
    return car[name] !== null && car[name] !== undefined ? String(car[name]) : '—';
  }
  
  // JSONB properties
  const fieldObj = car[group]?.[name];
  if (fieldObj === null || fieldObj === undefined) return '—';
  
  // If it's a numeric field with unit
  if (typeof fieldObj === 'object' && 'value' in fieldObj && 'unit' in fieldObj) {
    if (fieldObj.value === null || fieldObj.value === undefined || fieldObj.value === '') return '—';
    const groupKey = FIELD_TO_GROUP[name];
    const userPrefUnit = getUnitPref(groupKey);
    return display(fieldObj, userPrefUnit);
  }
  
  // Boolean
  if (typeof fieldObj === 'boolean') {
    return fieldObj ? '✓' : '✗';
  }
  
  // String
  if (typeof fieldObj === 'string' && fieldObj.trim() !== '') {
    if (name === 'notes') {
      return fieldObj;
    }
    const key = fieldObj.toLowerCase().replace(/[\s/-]/g, '_');
    const translated = t(`car.upgrades.${key}`);
    if (translated && !translated.startsWith('car.upgrades.')) {
      return translated;
    }
    return fieldObj;
  }
  
  return String(fieldObj);
}

function renderAllFields() {
  if (!currentCarData) return;

  elFormTitle.textContent = `${currentCarData.make} ${currentCarData.car}`.toUpperCase();
  elFormTitle.removeAttribute('data-i18n');

  // Translate all dynamic section headers
  CAR_FIELDS.sections.forEach(section => {
    const acc = document.querySelector(`.accordion[data-section="${section.id}"] .accordion-title`);
    if (acc) {
      acc.textContent = t(section.title_key);
    }
  });

  // Translate and populate all fields dynamically
  CAR_FIELDS.sections.forEach(section => {
    section.fields.forEach(field => {
      const displayDiv = document.getElementById(`val-${field.id}`);
      if (displayDiv) {
        const label = displayDiv.parentElement.querySelector('.field-label');
        if (label) {
          let labelText = '';
          if (field.is_gear) {
            labelText = t('car.fields.gearing_n', { n: field.gear_num });
          } else {
            labelText = t(`car.fields.${field.id}`);
          }
          if (labelText && !labelText.startsWith('car.fields.')) {
            label.textContent = labelText;
          }
        }
        displayDiv.textContent = getFieldDisplayValue(currentCarData, field.id);
      }
    });
  });

  // Re-translate static labels
  applyTranslations();
  if (currentCarData) {
    updateViewCarImage(currentCarData.make, currentCarData.car, currentCarData.year);
  }
}

/**
 * Handle duplication action
 */
async function handleDuplicateClick() {
  if (!supabase || !carId || !currentUser) return;

  elBtnDuplicate.disabled = true;
  elViewStatus.textContent = 'Duplicando build para sua garagem...';
  elViewStatus.className = 'status-text success';

  try {
    const newCarId = await duplicateCar(carId, currentUser.id);
    elViewStatus.textContent = 'Build duplicada! Redirecionando...';
    
    setTimeout(() => {
      window.location.href = `car-form.html?id=${newCarId}`;
    }, 1000);

  } catch (err) {
    console.error('Error duplicating build:', err);
    elViewStatus.textContent = 'Erro ao duplicar build: ' + err.message;
    elViewStatus.className = 'status-text error';
    elBtnDuplicate.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', init);
