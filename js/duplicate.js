import { supabase } from './supabase.js';

/**
 * Duplicates a build by creating a new record owned by the current user.
 * @param {string} carId - The ID of the car to duplicate
 * @param {string} currentUserId - The ID of the user duplicating the car
 * @returns {Promise<string>} - The ID of the newly created duplicate car
 */
export async function duplicateCar(carId, currentUserId) {
  if (!supabase) throw new Error('Supabase não inicializado.');

  // 1. Fetch all fields of the car
  const { data: car, error: fetchErr } = await supabase
    .from('cars')
    .select('*')
    .eq('id', carId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!car) throw new Error('Build original não encontrada.');

  // 2. Clone fields, ignoring keys and timestamps
  const fieldsToIgnore = ['id', 'user_id', 'original_owner_id', 'cloned_from', 'created_at', 'updated_at'];
  const newPayload = {};
  
  for (const key in car) {
    if (!fieldsToIgnore.includes(key)) {
      newPayload[key] = car[key];
    }
  }

  // 3. Set relationship keys
  newPayload.user_id = currentUserId;
  newPayload.original_owner_id = car.original_owner_id; // Keep original creator reference
  
  if (car.user_id === currentUserId) {
    // If duplicating own car, don't set cloned_from (clean duplicate)
    newPayload.cloned_from = null;
  } else {
    // If duplicating someone else's shared car (cloning)
    newPayload.cloned_from = carId;
  }

  // 4. Insert new copy
  const { data: newCar, error: insertErr } = await supabase
    .from('cars')
    .insert(newPayload)
    .select('id')
    .single();

  if (insertErr) throw insertErr;
  if (!newCar) throw new Error('Falha ao gerar cópia da build.');

  return newCar.id;
}
