import { supabase } from './supabase.js';
import { setLang } from './i18n.js';

/**
 * Get current session user
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
  if (!supabase) return null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch (e) {
    return null;
  }
}

/**
 * Get profile for user
 * @param {string} userId 
 * @returns {Promise<object|null>}
 */
export async function getUserProfile(userId) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

/**
 * Login user
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<object>}
 */
export async function login(email, password) {
  if (!supabase) throw new Error('Supabase client not initialized.');
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Register user validating gamertag uniqueness and consuming invite code
 * @param {string} email 
 * @param {string} password 
 * @param {string} gamertag 
 * @param {string} inviteCode 
 * @param {string} username 
 * @param {string} [preferredLanguage]
 * @returns {Promise<object>}
 */
export async function register(email, password, gamertag, inviteCode, username = '', preferredLanguage = 'en') {
  if (!supabase) throw new Error('Supabase client not initialized.');

  const trimmedGamertag = gamertag.trim();
  const trimmedCode = inviteCode.trim();

  // 1. Validate gamertag format (3-20 chars, alphanumeric/underscore/dash)
  const gamertagRegex = /^[a-zA-Z0-9_#-]+( [a-zA-Z0-9_#-]+)*$/;

  if (trimmedGamertag.length < 3 || trimmedGamertag.length > 20) {
    throw new Error('Gamertag deve ter entre 3 e 20 caracteres.');
  }
  if (!gamertagRegex.test(trimmedGamertag)) {
    throw new Error('Gamertag inválido. Use letras, números, _ ou - (espaços simples permitidos, mas não no início/fim).');
  }

  // 2. Validate gamertag uniqueness
  const { data: existingProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('gamertag', trimmedGamertag)
    .maybeSingle();
  
  if (profileErr) throw profileErr;
  if (existingProfile) {
    throw new Error('Este Gamertag já está em uso.');
  }

  // 3. Validate invitation code exists and is unused
  const { data: invite, error: inviteErr } = await supabase
    .from('invitation_codes')
    .select('id, used_by')
    .eq('code', trimmedCode)
    .maybeSingle();

  if (inviteErr) throw inviteErr;
  if (!invite) {
    throw new Error('Código de convite não encontrado.');
  }
  if (invite.used_by) {
    throw new Error('Este código de convite já foi utilizado.');
  }

  // 4. Create user in Supabase Auth, passing invitation code dynamically
  const { data: authData, error: signUpErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin + window.location.pathname,
      data: {
        gamertag: trimmedGamertag,
        username: username.trim(),
        invite_code: trimmedCode,
        preferred_language: preferredLanguage
      }
    }
  });

  if (signUpErr) throw signUpErr;

  const user = authData.user;
  if (!user) {
    throw new Error('Erro ao criar usuário no Supabase.');
  }

  // Update preferred language in profile if it was passed and is not the default
  if (preferredLanguage) {
    try {
      await supabase
        .from('profiles')
        .update({ preferred_language: preferredLanguage })
        .eq('id', user.id);
      
      setLang(preferredLanguage);
    } catch (e) {
      console.warn('Could not update preferred_language in profile client-side (maybe RLS/email confirmation pending):', e);
    }
  }

  return authData;
}

/**
 * Logout user
 */
export async function logout() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * requireAuth - check auth state and redirect if unauthorized
 * @returns {Promise<{user: object, profile: object}|null>}
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }
  
  const profile = await getUserProfile(user.id);
  if (!profile) {
    // Perfil ausente não significa "não logado" — não redirecione pro index
    // Retorne um perfil mínimo ou mostre erro, mas nunca crie o loop
    console.error('Perfil não encontrado para o usuário:', user.id);
    alert('Erro ao carregar seu perfil. Tente recarregar a página.');
    return null; // ← para a execução sem redirecionar
  }

  if (profile.preferred_language) {
    setLang(profile.preferred_language);
  }

  return { user, profile };
}

/**
 * requireAdmin - check auth and admin flag, redirect if unauthorized
 * @returns {Promise<{user: object, profile: object}|null>}
 */
export async function requireAdmin() {
  const authInfo = await requireAuth();
  if (!authInfo) return null;
  
  if (!authInfo.profile || !authInfo.profile.is_admin) {
    window.location.href = 'dashboard.html';
    return null;
  }
  return authInfo;
}
