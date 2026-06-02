// js/car-fields.js - Tuning & Car configuration dynamic fields definition

export const CAR_FIELDS = {
  sections: [
    {
      id: "details",
      title_key: "car.details",
      fields: [
        { id: "make", type: "text", required: true, placeholder: "Ex: Porsche" },
        { id: "car", type: "text", required: true, placeholder: "Ex: 911 GT3 RS" },
        { id: "year", type: "number", required: true, placeholder: "Ex: 2023" },
        { 
          id: "class", 
          type: "select", 
          required: true, 
          options: ["X", "S2", "S1", "A", "B", "C", "D"], 
          allowAll: true 
        },
        { id: "power", type: "number", required: true, placeholder: "Ex: 518", unit_group: "power" },
        { id: "torque", type: "number", required: true, placeholder: "Ex: 465", unit_group: "torque" },
        { id: "weight", type: "number", required: true, placeholder: "Ex: 1450", unit_group: "weight" },
        { id: "notes", type: "textarea", placeholder_key: "car.placeholders.notes" }
      ]
    },
    {
      id: "engine",
      title_key: "car.engine",
      fields: [
        { id: "intake", type: "text", placeholder_key: "car.placeholders.intake" },
        { id: "fuel_system", type: "text" },
        { id: "intake_manifold", type: "text" },
        { id: "ignition", type: "text" },
        { id: "exhaust", type: "text" },
        { id: "carburetor", type: "text" },
        { id: "camshaft", type: "text" },
        { id: "valves", type: "text" },
        { id: "displacement", type: "text" },
        { id: "pistons_compression", type: "text" },
        { id: "oil_cooling", type: "text" },
        { id: "flywheel", type: "text" },
        { id: "intercooler", type: "text" },
        { id: "single_turbo", type: "text" },
        { id: "twin_turbo", type: "text" },
        { id: "positive_displacement_supercharger", type: "text" },
        { id: "centrifugal_supercharger", type: "text" },
        { id: "restrictor_plate", type: "text" },
        { id: "rotors_compression", type: "text" }
      ]
    },
    {
      id: "platform",
      title_key: "car.platform",
      fields: [
        { id: "brakes", type: "text" },
        { id: "springs_dampers", type: "text" },
        { id: "front_antiroll_bars", type: "text" },
        { id: "rear_antiroll_bars", type: "text" },
        { id: "chassis_reinforcement", type: "text" },
        { id: "weight_reduction", type: "text" }
      ]
    },
    {
      id: "drivetrain",
      title_key: "car.drivetrain",
      fields: [
        { id: "clutch", type: "text" },
        { id: "transmission", type: "text" },
        { id: "driveline", type: "text" },
        { id: "differential", type: "text" }
      ]
    },
    {
      id: "tires",
      title_key: "car.tires",
      fields: [
        { id: "tire_compound", type: "text" },
        { id: "front_tire_width", type: "text" },
        { id: "rear_tire_width", type: "text" },
        { id: "rim_style", type: "text" },
        { id: "front_rim_style", type: "text" },
        { id: "rear_rim_style", type: "text" },
        { id: "front_rim_size", type: "text" },
        { id: "rear_rim_size", type: "text" },
        { id: "front_track_width", type: "text" },
        { id: "rear_track_width", type: "text" },
        { id: "wheel_model", type: "text" },
        { id: "front_tire_profile", type: "text" },
        { id: "rear_tire_profile", type: "text" }
      ]
    },
    {
      id: "aero",
      title_key: "car.aero",
      fields: [
        { id: "front_bumper", type: "text" },
        { id: "rear_wing", type: "text" },
        { id: "rear_bumper", type: "text" },
        { id: "side_skirts", type: "text" },
        { id: "hood", type: "text" }
      ]
    },
    {
      id: "conversion",
      title_key: "car.conversion",
      fields: [
        { id: "engine_swap", type: "text" },
        { id: "drivetrain_swap", type: "text" },
        { id: "aspiration", type: "text" },
        { id: "body_kit", type: "text" },
        { id: "motor_battery_swap", type: "text" }
      ]
    },
    {
      id: "motor_battery",
      title_key: "car.motor_battery",
      fields: [
        { id: "motor_and_battery", type: "text" }
      ]
    },
    {
      id: "tuning",
      title_key: "car.tuning",
      fields: [
        // Tires
        { 
          id: "tire_pressure_front", 
          type: "number", 
          step: "0.01", 
          unit_group: "pressure", 
          group_header_key: "car.tuning_groups.tires" 
        },
        { id: "tire_pressure_rear", type: "number", step: "0.01", unit_group: "pressure" },
        
        // Gearing
        { 
          id: "gearing_final", 
          type: "number", 
          step: "0.01", 
          group_header_key: "car.tuning_groups.gearing" 
        },
        { id: "gearing_1", type: "number", step: "0.01", is_gear: true, gear_num: 1 },
        { id: "gearing_2", type: "number", step: "0.01", is_gear: true, gear_num: 2 },
        { id: "gearing_3", type: "number", step: "0.01", is_gear: true, gear_num: 3 },
        { id: "gearing_4", type: "number", step: "0.01", is_gear: true, gear_num: 4 },
        { id: "gearing_5", type: "number", step: "0.01", is_gear: true, gear_num: 5 },
        { id: "gearing_6", type: "number", step: "0.01", is_gear: true, gear_num: 6 },
        { id: "gearing_7", type: "number", step: "0.01", is_gear: true, gear_num: 7 },
        { id: "gearing_8", type: "number", step: "0.01", is_gear: true, gear_num: 8 },
        { id: "gearing_9", type: "number", step: "0.01", is_gear: true, gear_num: 9 },
        { id: "gearing_10", type: "number", step: "0.01", is_gear: true, gear_num: 10 },
        { id: "gearing_11", type: "number", step: "0.01", is_gear: true, gear_num: 11 },
        { id: "gearing_12", type: "number", step: "0.01", is_gear: true, gear_num: 12 },
        
        // Alignment
        { 
          id: "camber_front", 
          type: "number", 
          step: "0.01", 
          group_header_key: "car.tuning_groups.alignment" 
        },
        { id: "camber_rear", type: "number", step: "0.01" },
        { id: "toe_front", type: "number", step: "0.01" },
        { id: "toe_rear", type: "number", step: "0.01" },
        { id: "caster_angle", type: "number", step: "0.01" },
        
        // ARB
        { 
          id: "arb_front", 
          type: "number", 
          step: "0.01", 
          group_header_key: "car.tuning_groups.arb" 
        },
        { id: "arb_rear", type: "number", step: "0.01" },
        
        // Springs
        { 
          id: "spring_front", 
          type: "number", 
          step: "0.01", 
          unit_group: "spring", 
          group_header_key: "car.tuning_groups.springs" 
        },
        { id: "spring_rear", type: "number", step: "0.01", unit_group: "spring" },
        { id: "ride_height_front", type: "number", step: "0.01", unit_group: "height" },
        { id: "ride_height_rear", type: "number", step: "0.01", unit_group: "height" },
        
        // Damping
        { 
          id: "rebound_front", 
          type: "number", 
          step: "0.01", 
          group_header_key: "car.tuning_groups.damping" 
        },
        { id: "rebound_rear", type: "number", step: "0.01" },
        { id: "bump_front", type: "number", step: "0.01" },
        { id: "bump_rear", type: "number", step: "0.01" },
        
        // Aero
        { 
          id: "downforce_front", 
          type: "number", 
          step: "0.01", 
          unit_group: "force", 
          group_header_key: "car.tuning_groups.aero" 
        },
        { id: "downforce_rear", type: "number", step: "0.01", unit_group: "force" },
        
        // Brake
        { 
          id: "brake_balance", 
          type: "number", 
          step: "0.01", 
          group_header_key: "car.tuning_groups.brake" 
        },
        { id: "brake_pressure", type: "number", step: "0.01" },
        
        // Differential
        { 
          id: "diff_front_accel", 
          type: "number", 
          step: "0.01", 
          group_header_key: "car.tuning_groups.diff" 
        },
        { id: "diff_front_decel", type: "number", step: "0.01" },
        { id: "diff_rear_accel", type: "number", step: "0.01" },
        { id: "diff_rear_decel", type: "number", step: "0.01" },
        { id: "diff_center_balance", type: "number", step: "0.01" }
      ]
    }
  ]
};
