import { supabase } from './supabase.js';

export const SYSTEM_PRESETS = {
  mixed: {
    power: 'kW',
    torque: 'N·m',
    weight: 'kg',
    pressure: 'bar',
    spring: 'kgf/mm',
    height: 'cm',
    force: 'kgf_df'
  },
  metric: {
    power: 'cv',
    torque: 'N·m',
    weight: 'kg',
    pressure: 'bar',
    spring: 'N/mm',
    height: 'cm',
    force: 'kg_df'
  },
  imperial: {
    power: 'hp',
    torque: 'lb-ft',
    weight: 'lb',
    pressure: 'psi',
    spring: 'lb/in',
    height: 'in',
    force: 'lb_df'
  }
};

let currentSystem = localStorage.getItem('fz_unit_system') || 'mixed';
let prefs = JSON.parse(localStorage.getItem('fz_unit_prefs') || '{}');

// Initialize defaults if empty
if (Object.keys(prefs).length === 0) {
  prefs = { ...SYSTEM_PRESETS[currentSystem === 'custom' ? 'mixed' : currentSystem] };
}

export function getUnitSystem() {
  return currentSystem;
}

export function setUnitSystem(system) {
  if (!SYSTEM_PRESETS[system] && system !== 'custom') return;
  currentSystem = system;
  localStorage.setItem('fz_unit_system', system);
  
  if (system !== 'custom') {
    // Apply preset to preferences
    prefs = { ...SYSTEM_PRESETS[system] };
    localStorage.setItem('fz_unit_prefs', JSON.stringify(prefs));
  }
  
  document.dispatchEvent(new CustomEvent('systemchange', { detail: { system, prefs } }));
  
  // Also dispatch individual unitchange events for reactivity
  Object.entries(prefs).forEach(([group, unit]) => {
    document.dispatchEvent(new CustomEvent('unitchange', { detail: { group, unit } }));
  });
}

export function getUnitPref(group) {
  // Normalize downforce/force names
  const grp = group === 'force' ? 'force' : group;
  return prefs[grp] || SYSTEM_PRESETS[currentSystem === 'custom' ? 'mixed' : currentSystem][grp];
}

export function setUnitPref(group, unit) {
  prefs[group] = unit;
  localStorage.setItem('fz_unit_prefs', JSON.stringify(prefs));
  
  // If individual unit change breaks the preset system alignment, mark system as custom (or keep system as is)
  // To keep it simple, we just save and notify
  document.dispatchEvent(new CustomEvent('unitchange', { detail: { group, unit } }));
}

export async function syncPrefsFromProfile(userId) {
  if (!supabase) return;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('preferred_unit_system, unit_preferences')
      .eq('id', userId)
      .maybeSingle();
      
    if (error) throw error;
    
    if (data) {
      if (data.preferred_unit_system) {
        currentSystem = data.preferred_unit_system;
        localStorage.setItem('fz_unit_system', currentSystem);
      }
      if (data.unit_preferences && Object.keys(data.unit_preferences).length > 0) {
        prefs = data.unit_preferences;
        localStorage.setItem('fz_unit_prefs', JSON.stringify(prefs));
      } else {
        prefs = { ...SYSTEM_PRESETS[currentSystem === 'custom' ? 'mixed' : currentSystem] };
      }
      
      // Dispatch changes to notify application
      document.dispatchEvent(new CustomEvent('systemchange', { detail: { system: currentSystem, prefs } }));
      Object.entries(prefs).forEach(([group, unit]) => {
        document.dispatchEvent(new CustomEvent('unitchange', { detail: { group, unit } }));
      });
    }
  } catch (e) {
    console.error('Error syncing unit preferences from profile:', e);
  }
}

export async function savePrefsToProfile(userId) {
  if (!supabase) return;
  
  try {
    await supabase
      .from('profiles')
      .update({
        preferred_unit_system: currentSystem,
        unit_preferences: prefs
      })
      .eq('id', userId);
  } catch (e) {
    console.error('Error saving unit preferences to profile:', e);
  }
}
