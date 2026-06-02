import { supabase } from './supabase.js';

/**
 * Validates if an invitation code exists and is unused
 * @param {string} code 
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateCode(code) {
  if (!supabase) return { valid: false, error: 'Supabase não inicializado.' };
  if (!code || !code.trim()) return { valid: false, error: 'Código vazio.' };

  try {
    const { data, error } = await supabase
      .from('invitation_codes')
      .select('id, used_by')
      .eq('code', code.trim())
      .maybeSingle();

    if (error) throw error;
    if (!data) return { valid: false, error: 'Código de convite inválido.' };
    if (data.used_by) return { valid: false, error: 'Este código já foi usado.' };

    return { valid: true };
  } catch (err) {
    console.error('Error validating code:', err);
    return { valid: false, error: 'Erro ao validar código: ' + err.message };
  }
}

/**
 * Consumes an invitation code for a specific user
 * @param {string} code 
 * @param {string} userId 
 * @returns {Promise<boolean>}
 */
export async function consumeCode(code, userId) {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase
      .rpc('consume_invite_code', {
        p_code: code.trim(),
        p_user_id: userId
      });

    if (error) throw error;
    return !!data;
  } catch (err) {
    console.error('Error consuming code:', err);
    return false;
  }
}
