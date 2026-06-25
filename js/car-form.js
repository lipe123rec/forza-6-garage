import { supabase } from './supabase.js';
import { requireAuth } from './auth.js';
import { initShareModal } from './share.js';
import { getLang, setLang, applyTranslations, t } from './i18n.js';
import { getUnitPref, getUnitSystem, setUnitSystem, syncPrefsFromProfile, savePrefsToProfile } from './unit-prefs.js';
import { convert, display, FIELD_TO_GROUP, UNIT_OPTIONS } from './units.js';
import { CAR_FIELDS } from './car-fields.js';
import { initProfileModal } from './profile.js';
import { CARS_DATABASE } from './cars-data.js';

let currentUser = null;
let currentProfile = null;
let carId = null;
let currentCarData = null;

// DOM Elements
const elUserGamertag = document.getElementById('userGamertag');
const elBtnLogout = document.getElementById('btnLogout');
const elFormTitle = document.getElementById('formTitle');
const elBuildBadge = document.getElementById('buildBadge');
const elParentBuildLink = document.getElementById('parentBuildLink');
const elCarForm = document.getElementById('carForm');
const elFormStatus = document.getElementById('formStatus');
const elBtnSave = document.getElementById('btnSave');
const elBtnShare = document.getElementById('btnShare');
const elBtnDelete = document.getElementById('btnDelete');
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

function updateFormCarImage() {
  const elMake = document.getElementById('make');
  const elCar = document.getElementById('car');
  const elYear = document.getElementById('year');

  if (!elMake || !elCar || !elYear || !elCarImageContainer || !elCarImage) return;

  const makeVal = elMake.value.trim();
  const carVal = elCar.value.trim();
  const yearVal = elYear.value.trim();

  if (makeVal && carVal) {
    elCarImageContainer.style.display = 'flex';
    elCarImage.style.display = 'none';
    if (elCarImagePlaceholder) {
      elCarImagePlaceholder.textContent = t('car.image_loading');
      elCarImagePlaceholder.style.display = 'block';
    }
    elCarImage.src = getCarImageUrl(makeVal, carVal, yearVal);
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
const FIELD_GROUPS = {};
const allFieldNames = [];

CAR_FIELDS.sections.forEach(section => {
  section.fields.forEach(field => {
    // Skip fields that reside directly as table root columns in PostgreSQL
    if (['make', 'car', 'year', 'class'].includes(field.id)) {
      return;
    }
    FIELD_GROUPS[field.id] = section.id;
    allFieldNames.push(field.id);
  });
});

/**
 * Dynamically construct HTML elements in the form
 */
function renderFormHTML() {
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
    // Open the first section by default
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

    // Body wrapper
    const accBody = document.createElement('div');
    accBody.className = 'accordion-body';

    const accBodyInner = document.createElement('div');
    accBodyInner.className = 'accordion-body-inner';

    // Populate Fields
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

      accBodyInner.appendChild(tabsWrapper);

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

          const label = document.createElement('label');
          label.setAttribute('for', field.id);
          label.className = 'field-label';
          
          label.dataset.i18n = `car.fields.${field.id}`;
          label.textContent = t(`car.fields.${field.id}`) + (field.required ? ' *' : '');

          let inputEl;
          if (field.type === 'select') {
            inputEl = document.createElement('select');
            inputEl.id = field.id;
            inputEl.className = 'field-select';
            if (field.required) inputEl.required = true;

            field.options.forEach(opt => {
              const optEl = document.createElement('option');
              optEl.value = opt;
              optEl.textContent = opt;
              inputEl.appendChild(optEl);
            });
          } else if (field.type === 'textarea') {
            inputEl = document.createElement('textarea');
            inputEl.id = field.id;
            inputEl.className = 'field-input';
            inputEl.style.height = '80px';
            inputEl.style.resize = 'vertical';
            if (field.required) inputEl.required = true;
            
            if (field.placeholder_key) {
              inputEl.dataset.i18n = field.placeholder_key;
              inputEl.placeholder = t(field.placeholder_key);
            } else if (field.placeholder) {
              inputEl.placeholder = field.placeholder;
            }
          } else {
            inputEl = document.createElement('input');
            inputEl.type = field.type;
            inputEl.id = field.id;
            inputEl.className = 'field-input';
            if (field.required) inputEl.required = true;
            if (field.step) inputEl.setAttribute('step', field.step);
            
            if (field.placeholder_key) {
              inputEl.dataset.i18n = field.placeholder_key;
              inputEl.placeholder = t(field.placeholder_key);
            } else if (field.placeholder) {
              inputEl.placeholder = field.placeholder;
            }
          }

          fieldGroup.appendChild(label);
          fieldGroup.appendChild(inputEl);
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
        tabsScroll.scrollLeft -= 150;
      });
      btnRight.addEventListener('click', () => {
        tabsScroll.scrollLeft += 150;
      });

      accBodyInner.appendChild(panelsContainer);
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

      accBodyInner.appendChild(tabsWrapper);

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

          const label = document.createElement('label');
          label.setAttribute('for', field.id);
          label.className = 'field-label';
          
          if (field.is_gear) {
            label.dataset.i18nN = 'car.fields.gearing_n';
            label.dataset.i18nNVal = field.gear_num;
            label.textContent = t('car.fields.gearing_n', { n: field.gear_num });
          } else {
            label.dataset.i18n = `car.fields.${field.id}`;
            label.textContent = t(`car.fields.${field.id}`) + (field.required ? ' *' : '');
          }

          let inputEl;
          if (field.type === 'select') {
            inputEl = document.createElement('select');
            inputEl.id = field.id;
            inputEl.className = 'field-select';
            if (field.required) inputEl.required = true;

            field.options.forEach(opt => {
              const optEl = document.createElement('option');
              optEl.value = opt;
              optEl.textContent = opt;
              inputEl.appendChild(optEl);
            });
          } else if (field.type === 'textarea') {
            inputEl = document.createElement('textarea');
            inputEl.id = field.id;
            inputEl.className = 'field-input';
            inputEl.style.height = '80px';
            inputEl.style.resize = 'vertical';
            if (field.required) inputEl.required = true;
            
            if (field.placeholder_key) {
              inputEl.dataset.i18n = field.placeholder_key;
              inputEl.placeholder = t(field.placeholder_key);
            } else if (field.placeholder) {
              inputEl.placeholder = field.placeholder;
            }
          } else {
            inputEl = document.createElement('input');
            inputEl.type = field.type;
            inputEl.id = field.id;
            inputEl.className = 'field-input';
            if (field.required) inputEl.required = true;
            if (field.step) inputEl.setAttribute('step', field.step);
            
            if (field.placeholder_key) {
              inputEl.dataset.i18n = field.placeholder_key;
              inputEl.placeholder = t(field.placeholder_key);
            } else if (field.placeholder) {
              inputEl.placeholder = field.placeholder;
            }
          }

          fieldGroup.appendChild(label);
          fieldGroup.appendChild(inputEl);
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
        tabsScroll.scrollLeft -= 150;
      });
      btnRight.addEventListener('click', () => {
        tabsScroll.scrollLeft += 150;
      });

      accBodyInner.appendChild(panelsContainer);
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

        const label = document.createElement('label');
        label.setAttribute('for', field.id);
        label.className = 'field-label';
        
        label.dataset.i18n = `car.fields.${field.id}`;
        label.textContent = t(`car.fields.${field.id}`) + (field.required ? ' *' : '');

        let inputEl;
        if (field.type === 'select') {
          inputEl = document.createElement('select');
          inputEl.id = field.id;
          inputEl.className = 'field-select';
          if (field.required) inputEl.required = true;

          if (field.id === 'class') {
            const optAll = document.createElement('option');
            optAll.value = '';
            optAll.dataset.i18n = 'dashboard.filter_all';
            optAll.textContent = t('dashboard.filter_all');
            inputEl.appendChild(optAll);
          }

          field.options.forEach(opt => {
            const optEl = document.createElement('option');
            optEl.value = opt;
            optEl.textContent = opt;
            inputEl.appendChild(optEl);
          });
        } else if (field.type === 'textarea') {
          inputEl = document.createElement('textarea');
          inputEl.id = field.id;
          inputEl.className = 'field-input';
          inputEl.style.height = '80px';
          inputEl.style.resize = 'vertical';
          if (field.required) inputEl.required = true;
          
          if (field.placeholder_key) {
            inputEl.dataset.i18n = field.placeholder_key;
            inputEl.placeholder = t(field.placeholder_key);
          } else if (field.placeholder) {
            inputEl.placeholder = field.placeholder;
          }
        } else {
          inputEl = document.createElement('input');
          inputEl.type = field.type;
          inputEl.id = field.id;
          inputEl.className = 'field-input';
          if (field.required) inputEl.required = true;
          if (field.step) inputEl.setAttribute('step', field.step);
          
          if (field.placeholder_key) {
            inputEl.dataset.i18n = field.placeholder_key;
            inputEl.placeholder = t(field.placeholder_key);
          } else if (field.placeholder) {
            inputEl.placeholder = field.placeholder;
          }
        }

        fieldGroup.appendChild(label);
        fieldGroup.appendChild(inputEl);
        accContent.appendChild(fieldGroup);
      });

      detailsLayout.appendChild(accContent);
      accBodyInner.appendChild(detailsLayout);

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

        const label = document.createElement('label');
        label.setAttribute('for', field.id);
        label.className = 'field-label';
        
        if (field.is_gear) {
          label.dataset.i18nN = 'car.fields.gearing_n';
          label.dataset.i18nNVal = field.gear_num;
          label.textContent = t('car.fields.gearing_n', { n: field.gear_num });
        } else {
          label.dataset.i18n = `car.fields.${field.id}`;
          label.textContent = t(`car.fields.${field.id}`) + (field.required ? ' *' : '');
        }

        let inputEl;
        if (field.type === 'select') {
          inputEl = document.createElement('select');
          inputEl.id = field.id;
          inputEl.className = 'field-select';
          if (field.required) inputEl.required = true;

          if (field.id === 'class') {
            const optAll = document.createElement('option');
            optAll.value = '';
            optAll.dataset.i18n = 'dashboard.filter_all';
            optAll.textContent = t('dashboard.filter_all');
            inputEl.appendChild(optAll);
          }

          field.options.forEach(opt => {
            const optEl = document.createElement('option');
            optEl.value = opt;
            optEl.textContent = opt;
            inputEl.appendChild(optEl);
          });
        } else if (field.type === 'textarea') {
          inputEl = document.createElement('textarea');
          inputEl.id = field.id;
          inputEl.className = 'field-input';
          inputEl.style.height = '80px';
          inputEl.style.resize = 'vertical';
          if (field.required) inputEl.required = true;
          
          if (field.placeholder_key) {
            inputEl.dataset.i18n = field.placeholder_key;
            inputEl.placeholder = t(field.placeholder_key);
          } else if (field.placeholder) {
            inputEl.placeholder = field.placeholder;
          }
        } else {
          inputEl = document.createElement('input');
          inputEl.type = field.type;
          inputEl.id = field.id;
          inputEl.className = 'field-input';
          if (field.required) inputEl.required = true;
          if (field.step) inputEl.setAttribute('step', field.step);
          
          if (field.placeholder_key) {
            inputEl.dataset.i18n = field.placeholder_key;
            inputEl.placeholder = t(field.placeholder_key);
          } else if (field.placeholder) {
            inputEl.placeholder = field.placeholder;
          }
        }

        fieldGroup.appendChild(label);
        fieldGroup.appendChild(inputEl);
        accContent.appendChild(fieldGroup);
      });

      accBodyInner.appendChild(accContent);
    }

    accBody.appendChild(accBodyInner);
    
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

  // Render form fields HTML dynamically
  renderFormHTML();

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

  // Initialize header unit preset selector
  if (elUnitSystem) {
    elUnitSystem.value = getUnitSystem();
    elUnitSystem.addEventListener('change', (e) => {
      handleGlobalUnitPresetChange(e.target.value);
    });
  }

  // Inject local unit select elements to unit-based fields
  injectLocalUnitSelectors();

  // Listen for language updates to translate labels and accordions
  document.addEventListener('langchange', translateFormUI);

  // Initialize synchronous autocomplete dropdowns for Make, Model, and Year
  initAutocomplete();

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

  // Determine if editing or creating
  const urlParams = new URLSearchParams(window.location.search);
  carId = urlParams.get('id');

  if (carId) {
    await loadCarData(carId);
  } else {
    elFormTitle.dataset.i18n = 'car.new_car_title';
    elBuildBadge.dataset.i18n = 'dashboard.badge_mine';
    elBuildBadge.className = 'badge own';
    
    // Apply user default unit preset to selectors on clean form
    applyPreferredUnitsToSelectors();
    translateFormUI();
  }

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

  // Monitor input fields to update the car image dynamically
  const elMake = document.getElementById('make');
  const elCar = document.getElementById('car');
  const elYear = document.getElementById('year');

  if (elMake) elMake.addEventListener('input', updateFormCarImage);
  if (elCar) elCar.addEventListener('input', updateFormCarImage);
  if (elYear) elYear.addEventListener('input', updateFormCarImage);

  if (elCarForm) {
    elCarForm.addEventListener('submit', handleFormSubmit);
  }

  if (elBtnDelete) {
    elBtnDelete.addEventListener('click', handleDeleteCar);
  }
}

/**
 * Dynamically inject unit select dropdown next to each unit-enabled input field
 */
function injectLocalUnitSelectors() {
  Object.keys(FIELD_TO_GROUP).forEach(name => {
    const input = document.getElementById(name);
    if (!input) return;

    const group = FIELD_TO_GROUP[name];
    const options = UNIT_OPTIONS[group];

    // Create wrapper container
    const wrapper = document.createElement('div');
    wrapper.className = 'field-with-unit';

    // Insert wrapper before input, then move input inside it
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    // Create select
    const select = document.createElement('select');
    select.id = `${name}_unit`;
    select.className = 'field-select';

    options.forEach(opt => {
      const optEl = document.createElement('option');
      optEl.value = opt;
      // Show clean labels for downforce forces
      let label = opt;
      if (opt === 'lb_df') label = 'lb';
      if (opt === 'kg_df') label = 'kg';
      if (opt === 'kgf_df') label = 'kgf';
      optEl.textContent = label;
      select.appendChild(optEl);
    });

    wrapper.appendChild(select);

    // Store previous unit value to convert on-the-fly when changing unit locally
    select.dataset.prevUnit = select.value;

    select.addEventListener('change', () => {
      const prev = select.dataset.prevUnit;
      const next = select.value;
      const rawVal = parseFloat(input.value);

      if (!isNaN(rawVal)) {
        input.value = convert(rawVal, prev, next);
      }
      select.dataset.prevUnit = next;
    });
  });
}

/**
 * Align all input fields and unit selects with the selected system preset
 */
async function handleGlobalUnitPresetChange(preset) {
  setUnitSystem(preset);
  if (currentUser) {
    savePrefsToProfile(currentUser.id);
  }
  if (preset === 'custom') {
    const drawerMenu = document.getElementById('drawerMenu');
    if (drawerMenu) drawerMenu.classList.remove('open');
    const { openProfileModal } = await import('./profile.js');
    await openProfileModal();
  }

  // For each unit-enabled field, convert active value to the new preferred unit
  Object.keys(FIELD_TO_GROUP).forEach(name => {
    const input = document.getElementById(name);
    const select = document.getElementById(`${name}_unit`);
    if (!input || !select) return;

    const group = FIELD_TO_GROUP[name];
    const targetUnit = getUnitPref(group);
    const prevUnit = select.value;

    if (prevUnit !== targetUnit) {
      const rawVal = parseFloat(input.value);
      if (!isNaN(rawVal)) {
        input.value = convert(rawVal, prevUnit, targetUnit);
      }
      select.value = targetUnit;
      select.dataset.prevUnit = targetUnit;
    }
  });
}

function applyPreferredUnitsToSelectors() {
  Object.keys(FIELD_TO_GROUP).forEach(name => {
    const select = document.getElementById(`${name}_unit`);
    if (select) {
      const group = FIELD_TO_GROUP[name];
      const prefUnit = getUnitPref(group);
      select.value = prefUnit;
      select.dataset.prevUnit = prefUnit;
    }
  });
}

/**
 * Update UI text according to current language
 */
function translateFormUI() {
  // Translate accordion headers
  CAR_FIELDS.sections.forEach(section => {
    const acc = document.querySelector(`.accordion[data-section="${section.id}"] .accordion-title`);
    if (acc) {
      acc.textContent = t(section.title_key);
    }
  });

  // Translate title and badge for loaded car
  if (carId && currentCarData) {
    elFormTitle.textContent = `${currentCarData.make} ${currentCarData.car}`.toUpperCase();
    elFormTitle.removeAttribute('data-i18n');
    
    if (currentCarData.cloned_from) {
      elBuildBadge.textContent = t('dashboard.badge_clone', { gamertag: '' }).replace('@', '').trim();
      elBuildBadge.removeAttribute('data-i18n');
    } else {
      elBuildBadge.textContent = t('dashboard.badge_mine');
      elBuildBadge.removeAttribute('data-i18n');
    }
  }

  // Translate all input/select labels based on ID or custom is_gear attributes
  CAR_FIELDS.sections.forEach(section => {
    section.fields.forEach(field => {
      const label = document.querySelector(`.field-group label[for="${field.id}"]`);
      if (label) {
        let translation = '';
        if (field.is_gear) {
          translation = t('car.fields.gearing_n', { n: field.gear_num });
        } else {
          const transKey = `car.fields.${field.id}`;
          translation = t(transKey);
        }

        if (translation && !translation.startsWith('car.fields.')) {
          label.textContent = translation + (field.required ? ' *' : '');
        }
      }
    });
  });

  applyTranslations();
  updateFormCarImage();
}

/**
 * Load existing car data into inputs
 */
async function loadCarData(id) {
  if (!supabase) return;
  
  try {
    const { data: car, error } = await supabase
      .from('cars')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!car) {
      alert(t('car.messages.not_found'));
      window.location.href = 'dashboard.html';
      return;
    }

    // Route Protection
    if (car.user_id !== currentUser.id) {
      window.location.href = `car-view.html?id=${id}`;
      return;
    }

    currentCarData = car;

    // Set Title
    elFormTitle.textContent = `${car.make} ${car.car}`.toUpperCase();
    elFormTitle.removeAttribute('data-i18n');

    // Configure Badges & Relationships
    if (car.cloned_from) {
      elBuildBadge.textContent = t('dashboard.badge_clone', { gamertag: '' }).replace('@', '').trim();
      elBuildBadge.removeAttribute('data-i18n');
      elBuildBadge.className = 'badge clone';
      elParentBuildLink.href = `car-view.html?id=${car.cloned_from}`;
      elParentBuildLink.style.display = 'inline-block';
    } else {
      elBuildBadge.textContent = t('dashboard.badge_mine');
      elBuildBadge.removeAttribute('data-i18n');
      elBuildBadge.className = 'badge own';
      elParentBuildLink.style.display = 'none';
    }

    // Toggle actions buttons
    if (elBtnDelete) elBtnDelete.style.display = 'inline-block';
    
    // Only allow sharing if this user is the original creator AND the build is not a clone
    if (car.original_owner_id === currentUser.id && !car.cloned_from) {
      if (elBtnShare) {
        elBtnShare.style.display = 'inline-block';
        initShareModal(car.id);
      }
    }

    // Populate Root Fields
    const rootText = ['make', 'car', 'class'];
    rootText.forEach(name => {
      const el = document.getElementById(name);
      if (el) el.value = car[name] !== null ? car[name] : '';
    });
    
    const rootYear = document.getElementById('year');
    if (rootYear) rootYear.value = car.year !== null ? car.year : '';

    // Populate JSONB Group Fields
    applyPreferredUnitsToSelectors();
    allFieldNames.forEach(name => {
      const group = FIELD_GROUPS[name];
      const fieldVal = car[group]?.[name];
      const input = document.getElementById(name);
      if (!input || fieldVal === null || fieldVal === undefined) return;

      // Case 1: Numeric value with unit
      if (FIELD_TO_GROUP[name]) {
        const select = document.getElementById(`${name}_unit`);
        const value = fieldVal.value;
        const unit = fieldVal.unit;
        
        if (select && value !== null && value !== undefined) {
          // Convert the stored value to the user's preferred unit system for display
          const userPrefUnit = getUnitPref(FIELD_TO_GROUP[name]);
          input.value = convert(value, unit, userPrefUnit);
          select.value = userPrefUnit;
          select.dataset.prevUnit = userPrefUnit;
        }
      } 
      // Case 2: Simple values (gearing ratios, camber alignment, upgrade choices, etc.)
      else {
        input.value = fieldVal;
      }
    });

    translateFormUI();

    // Sync autocomplete dropdown lists on load
    const elMake = document.getElementById('make');
    const elCar = document.getElementById('car');
    if (elMake) elMake.dispatchEvent(new Event('input'));
    if (elCar) elCar.dispatchEvent(new Event('input'));
    
    // Update car image on load
    updateFormCarImage();
  } catch (err) {
    console.error('Error loading car data:', err);
    alert(t('car.messages.load_error') + err.message);
    window.location.href = 'dashboard.html';
  }
}

/**
 * Handle form save
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  if (!supabase) return;
  
  elFormStatus.textContent = '';
  elFormStatus.className = 'status-text';

  // Validate required fields
  const required = ['make', 'car', 'year', 'class', 'power', 'torque', 'weight'];
  let invalidField = null;

  for (const field of required) {
    const input = document.getElementById(field);
    if (!input || !input.value.trim()) {
      invalidField = field;
      break;
    }
  }

  if (invalidField) {
    elFormStatus.textContent = t('car.messages.fill_required');
    elFormStatus.className = 'status-text error';
    
    const detailsAcc = document.querySelector('.accordion[data-section="details"]');
    if (detailsAcc && !detailsAcc.classList.contains('open')) {
      detailsAcc.classList.add('open');
    }
    
    document.getElementById(invalidField).focus();
    return;
  }

  // Construct payload with v2 JSONB sub-structures
  const payload = {
    make: document.getElementById('make').value.trim(),
    car: document.getElementById('car').value.trim(),
    year: parseInt(document.getElementById('year').value),
    class: document.getElementById('class').value,
    details: {},
    engine: {},
    platform: {},
    drivetrain: {},
    tires: {},
    aero: {},
    conversion: {},
    motor_battery: {},
    tuning: {}
  };

  // Populate sub-structures
  allFieldNames.forEach(name => {
    const group = FIELD_GROUPS[name];
    const input = document.getElementById(name);
    if (!input) return;

    const rawVal = input.value.trim();

    // Case 1: Numeric value with unit
    if (FIELD_TO_GROUP[name]) {
      const select = document.getElementById(`${name}_unit`);
      const val = parseFloat(rawVal);
      payload[group][name] = {
        value: !isNaN(val) ? val : null,
        unit: select ? select.value : FIELD_TO_GROUP[name] === 'power' ? 'hp' : 'psi'
      };
    } 
    // Case 2: Plain numeric values (e.g. alignment, ratios)
    else if (input.type === 'number') {
      const val = parseFloat(rawVal);
      payload[group][name] = !isNaN(val) ? val : null;
    } 
    // Case 3: Strings/Upgrade choices
    else {
      payload[group][name] = rawVal !== '' ? rawVal : null;
    }
  });

  // Save to database
  elBtnSave.disabled = true;
  elFormStatus.textContent = t('car.messages.saving');
  elFormStatus.className = 'status-text';

  try {
    if (carId) {
      // UPDATE
      const { error } = await supabase
        .from('cars')
        .update(payload)
        .eq('id', carId);

      if (error) throw error;
      elFormStatus.textContent = t('car.messages.updated');
      elFormStatus.className = 'status-text success';
    } else {
      // INSERT
      payload.user_id = currentUser.id;
      payload.original_owner_id = currentUser.id;
      payload.cloned_from = null;

      const { data, error } = await supabase
        .from('cars')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;
      elFormStatus.textContent = t('car.messages.saved');
      elFormStatus.className = 'status-text success';
      if (data) carId = data.id;
    }

    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1000);

  } catch (err) {
    console.error('Error saving car:', err);
    elFormStatus.textContent = t('car.messages.save_error') + err.message;
    elFormStatus.className = 'status-text error';
    elBtnSave.disabled = false;
  }
}

/**
 * Handle delete
 */
async function handleDeleteCar() {
  if (!supabase || !carId) return;

  const confirmed = confirm(t('car.messages.confirm_delete'));
  if (!confirmed) return;

  try {
    elFormStatus.textContent = t('car.messages.deleting');
    elFormStatus.className = 'status-text error';

    const { error } = await supabase
      .from('cars')
      .delete()
      .eq('id', carId);

    if (error) throw error;

    alert(t('car.messages.deleted'));
    window.location.href = 'dashboard.html';
  } catch (err) {
    console.error('Error deleting car:', err);
    elFormStatus.textContent = t('car.messages.delete_error') + err.message;
    elFormStatus.className = 'status-text error';
  }
}

/**
 * Initializes HTML5 datalist autocomplete for make, car model, and year
 */
function initAutocomplete() {
  const elMake = document.getElementById('make');
  const elCar = document.getElementById('car');
  const elYear = document.getElementById('year');

  if (!elMake || !elCar || !elYear) return;

  // 1. Create and inject datalist elements into the DOM
  let dlMake = document.getElementById('makesList');
  if (!dlMake) {
    dlMake = document.createElement('datalist');
    dlMake.id = 'makesList';
    document.body.appendChild(dlMake);
  }

  let dlCar = document.getElementById('modelsList');
  if (!dlCar) {
    dlCar = document.createElement('datalist');
    dlCar.id = 'modelsList';
    document.body.appendChild(dlCar);
  }

  let dlYear = document.getElementById('yearsList');
  if (!dlYear) {
    dlYear = document.createElement('datalist');
    dlYear.id = 'yearsList';
    document.body.appendChild(dlYear);
  }

  // Bind datalists to inputs
  elMake.setAttribute('list', 'makesList');
  elCar.setAttribute('list', 'modelsList');
  elYear.setAttribute('list', 'yearsList');

  // 2. Populate unique Makes alphabetically
  const makes = [...new Set(CARS_DATABASE.map(c => c.make))].sort();
  dlMake.innerHTML = makes.map(m => `<option value="${m}"></option>`).join('');

  // 3. Sychronize models based on selected make
  function syncModels() {
    const makeVal = elMake.value.trim();
    if (!makeVal) {
      dlCar.innerHTML = '';
      dlYear.innerHTML = '';
      return;
    }

    const matchingCars = CARS_DATABASE.filter(c => c.make.toLowerCase() === makeVal.toLowerCase());
    const models = [...new Set(matchingCars.map(c => c.model))].sort();

    dlCar.innerHTML = models.map(m => `<option value="${m}"></option>`).join('');
    syncYears();
  }

  // 4. Synchronize years based on make and model
  function syncYears() {
    const makeVal = elMake.value.trim();
    const modelVal = elCar.value.trim();

    if (!makeVal || !modelVal) {
      dlYear.innerHTML = '';
      return;
    }

    const matchingCars = CARS_DATABASE.filter(c => 
      c.make.toLowerCase() === makeVal.toLowerCase() && 
      c.model.toLowerCase() === modelVal.toLowerCase()
    );
    const years = [...new Set(matchingCars.map(c => c.year))].filter(Boolean).sort((a, b) => b - a);

    dlYear.innerHTML = years.map(y => `<option value="${y}"></option>`).join('');
  }

  // Bind event listeners
  elMake.addEventListener('input', syncModels);
  elCar.addEventListener('input', syncYears);
}

document.addEventListener('DOMContentLoaded', init);
