// units.js - Unit conversions module

// Conversions base: each unit has:
// to: function to convert unit value to canonical unit
// from: function to convert canonical unit value to this unit
// label: display name
const CONVERSIONS = {
  // Power (canonical: hp)
  'hp':  { to: v => v,             from: v => v,             label: 'hp'   },
  'cv':  { to: v => v * 0.98632,   from: v => v / 0.98632,   label: 'cv'   },
  'kW':  { to: v => v * 1.34102,   from: v => v / 1.34102,   label: 'kW'   },

  // Torque (canonical: lb-ft)
  'lb-ft': { to: v => v,           from: v => v,           label: 'lb-ft' },
  'N·m':   { to: v => v * 0.73756, from: v => v / 0.73756,   label: 'N·m'  },

  // Weight (canonical: kg)
  'kg': { to: v => v,              from: v => v,              label: 'kg'   },
  'lb': { to: v => v * 0.453592,   from: v => v / 0.453592,   label: 'lb'   },

  // Tire Pressure (canonical: psi)
  'psi': { to: v => v,             from: v => v,             label: 'psi'  },
  'bar': { to: v => v * 14.5038,   from: v => v / 14.5038,   label: 'bar'  },
  'kPa': { to: v => v * 0.145038,  from: v => v / 0.145038,  label: 'kPa'  },

  // Spring Rate (canonical: lb/in)
  'lb/in': { to: v => v,           from: v => v,           label: 'lb/in' },
  'N/mm':  { to: v => v * 5.71015, from: v => v / 5.71015,   label: 'N/mm' },
  'kgf/mm': { to: v => v * 55.99754, from: v => v / 55.99754, label: 'kgf/mm' },

  // Ride Height (canonical: in)
  'in': { to: v => v,              from: v => v,              label: 'in'   },
  'cm': { to: v => v * 0.393701,   from: v => v / 0.393701,   label: 'cm'   },

  // Downforce (canonical: lb)
  'lb_df': { to: v => v,           from: v => v,           label: 'lb'   }, // rename to avoid collision if necessary, but we can map appropriately
  'kg_df': { to: v => v * 2.20462, from: v => v / 2.20462, label: 'kg'   },
  'kgf_df': { to: v => v * 2.20462, from: v => v / 2.20462, label: 'kgf'  }
};

// Map each field to its canonical unit
export const FIELD_CANONICAL = {
  power:              'hp',
  torque:             'lb-ft',
  weight:             'kg',
  tire_pressure_front: 'psi',
  tire_pressure_rear:  'psi',
  spring_front:       'lb/in',
  spring_rear:        'lb/in',
  ride_height_front:  'in',
  ride_height_rear:   'in',
  downforce_front:    'lb_df',
  downforce_rear:     'lb_df',
};

// Available unit options per group/dimension
export const UNIT_OPTIONS = {
  power:    ['hp', 'cv', 'kW'],
  torque:   ['lb-ft', 'N·m'],
  weight:   ['kg', 'lb'],
  pressure: ['psi', 'bar', 'kPa'],
  spring:   ['lb/in', 'N/mm', 'kgf/mm'],
  height:   ['in', 'cm'],
  force:    ['lb_df', 'kg_df', 'kgf_df'],
};

// Maps field name to its unit group/dimension
export const FIELD_TO_GROUP = {
  power: 'power',
  torque: 'torque',
  weight: 'weight',
  tire_pressure_front: 'pressure',
  tire_pressure_rear: 'pressure',
  spring_front: 'spring',
  spring_rear: 'spring',
  ride_height_front: 'height',
  ride_height_rear: 'height',
  downforce_front: 'force',
  downforce_rear: 'force'
};

/**
 * Convert value from one unit to another
 */
export function convert(value, fromUnit, toUnit) {
  if (value === null || value === undefined || isNaN(value)) return null;
  if (fromUnit === toUnit) return value;
  
  // Normalize names
  let fUnit = fromUnit === 'lb' && (toUnit === 'kg_df' || toUnit === 'lb_df' || toUnit === 'kgf_df') ? 'lb_df' : fromUnit;
  let tUnit = toUnit === 'lb' && (fromUnit === 'kg_df' || fromUnit === 'lb_df' || fromUnit === 'kgf_df') ? 'lb_df' : toUnit;
  
  // Downforce mapping fallback
  if (fUnit === 'kg' && (tUnit === 'lb_df' || tUnit === 'kg_df' || tUnit === 'kgf_df')) fUnit = 'kg_df';
  if (tUnit === 'kg' && (fUnit === 'lb_df' || fUnit === 'kg_df' || fUnit === 'kgf_df')) tUnit = 'kg_df';
  if (fUnit === 'kgf' && (tUnit === 'lb_df' || tUnit === 'kg_df' || tUnit === 'kgf_df')) fUnit = 'kgf_df';
  if (tUnit === 'kgf' && (fUnit === 'lb_df' || fUnit === 'kg_df' || fUnit === 'kgf_df')) tUnit = 'kgf_df';

  const from = CONVERSIONS[fUnit];
  const to = CONVERSIONS[tUnit];
  if (!from || !to) return value;

  // Convert to canonical first, then to target
  const canonicalVal = from.to(value);
  const targetVal = to.from(canonicalVal);
  
  // Determine standard decimal points based on unit
  let decimals = 2;
  if (tUnit === 'bar') decimals = 2;
  else if (tUnit === 'psi') decimals = 1;
  else if (tUnit === 'kPa') decimals = 0;
  else if (tUnit === 'N/mm') decimals = 1;
  else if (tUnit === 'kgf/mm') decimals = 2;
  else if (tUnit === 'in') decimals = 1;
  else if (tUnit === 'cm') decimals = 1;
  else if (tUnit === 'hp' || tUnit === 'cv' || tUnit === 'kW') decimals = 0;
  else if (tUnit === 'kg' || tUnit === 'lb' || tUnit === 'lb_df' || tUnit === 'kg_df' || tUnit === 'kgf_df') decimals = 0;
  else if (tUnit === 'N·m' || tUnit === 'lb-ft') decimals = 0;

  return roundTo(targetVal, decimals);
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Format field value with its unit label
 */
export function display(field, displayUnit = null) {
  if (!field || field.value === null || field.value === undefined) return '—';
  
  const unit = displayUnit || field.unit;
  if (!unit) return String(field.value);
  
  const converted = displayUnit ? convert(field.value, field.unit, displayUnit) : field.value;
  
  let label = CONVERSIONS[unit]?.label || unit;
  if (unit === 'lb_df') label = 'lb';
  if (unit === 'kg_df') label = 'kg';
  if (unit === 'kgf_df') label = 'kgf';
  
  return `${converted} ${label}`;
}
