import { supabase } from './supabase.js';
import { requireAuth } from './auth.js';
import { getLang, setLang, applyTranslations, t } from './i18n.js';
import { initProfileModal } from './profile.js';
import { getUnitSystem, setUnitSystem, savePrefsToProfile } from './unit-prefs.js';

let currentUser = null;
let currentProfile = null;


// DOM Elements
const elUserGamertag = document.getElementById('userGamertag');
const elUnitSystem = document.getElementById('headerUnitSystem');
const elBtnLogout = document.getElementById('btnLogout');
const elAdminStatus = document.getElementById('adminStatus');
const elGenerateForm = document.getElementById('generateInviteForm');
const elCodeInput = document.getElementById('inviteCodeInput');
const elLoadingTable = document.getElementById('loadingTable');
const elTableWrapper = document.getElementById('tableWrapper');
const elInvitesTableBody = document.getElementById('invitesTableBody');

/**
 * Initialize admin panel
 */
async function init() {
  const authInfo = await requireAuth();
  if (!authInfo) return;

  currentUser = authInfo.user;
  currentProfile = authInfo.profile;

  if (!currentProfile.is_admin) {
    alert('Acesso negado. Apenas administradores podem visualizar esta página.');
    window.location.href = 'dashboard.html';
    return;
  }

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
  
  applyTranslations();

  // Initialize Profile Settings Modal
  await initProfileModal();

  // Listen to lang changes to re-translate
  document.addEventListener('langchange', () => {
    fetchAndRenderInvites();
  });

  // Initialize header unit preset selector
  if (elUnitSystem) {
    elUnitSystem.value = getUnitSystem();
    elUnitSystem.addEventListener('change', async (e) => {
      const val = e.target.value;
      setUnitSystem(val);
      if (currentUser) {
        savePrefsToProfile(currentUser.id);
      }
      if (val === 'custom') {
        const drawerMenu = document.getElementById('drawerMenu');
        if (drawerMenu) drawerMenu.classList.remove('open');
        const { openProfileModal } = await import('./profile.js');
        await openProfileModal();
      }
    });
  }

  // Listen to unit system changes
  document.addEventListener('systemchange', (e) => {
    if (elUnitSystem) elUnitSystem.value = e.detail.system;
  });

  if (elUserGamertag) {
    elUserGamertag.innerHTML = `ADMIN: <span>${currentProfile.gamertag}</span>`;
  }

  if (elBtnLogout) {
    elBtnLogout.addEventListener('click', async () => {
      const { logout } = await import('./auth.js');
      await logout();
      window.location.href = 'index.html';
    });
  }

  if (elGenerateForm) {
    elGenerateForm.addEventListener('submit', handleGenerateSubmit);
  }

  await fetchAndRenderInvites();
}

/**
 * Fetch all invitation_codes and render table
 */
async function fetchAndRenderInvites() {
  if (!supabase) return;

  showTableLoading(true);

  try {
    const { data: invites, error } = await supabase
      .from('invitation_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Collect user IDs to look up gamertags
    const userIds = [...new Set([
      ...invites.map(i => i.created_by),
      ...invites.map(i => i.used_by)
    ].filter(Boolean))];

    let profileLookup = {};
    if (userIds.length > 0) {
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, gamertag')
        .in('id', userIds);

      if (profErr) throw profErr;
      profiles.forEach(p => { profileLookup[p.id] = p.gamertag; });
    }

    elInvitesTableBody.innerHTML = '';

    if (!invites || invites.length === 0) {
      elInvitesTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--muted); font-size: 0.85rem; padding: 24px;">
            ${t('admin.no_codes')}
          </td>
        </tr>
      `;
    } else {
      invites.forEach(invite => {
        const isUsed = !!invite.used_by;
        const statusClass = isUsed ? 'full' : 'available';
        const statusText = isUsed ? t('admin.status_used') : t('admin.status_available');

        const creatorGamertag = profileLookup[invite.created_by] || 'Sistema';
        const usedByGamertag = invite.used_by
          ? `@${profileLookup[invite.used_by] || 'Desconhecido'}`
          : '<span style="color: var(--muted);">—</span>';

        const createdDate = new Date(invite.created_at).toLocaleDateString(getLang() === 'pt' ? 'pt-BR' : 'en-US', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>
            <span class="code-badge">${invite.code}</span>
            <button class="btn-copy" title="Copiar código" onclick="navigator.clipboard.writeText('${invite.code}')">⧉</button>
          </td>
          <td><span class="usage-text ${statusClass}">${statusText}</span></td>
          <td>@${creatorGamertag}</td>
          <td>${usedByGamertag}</td>
          <td>${createdDate}</td>
        `;

        elInvitesTableBody.appendChild(row);
      });
    }

  } catch (err) {
    console.error('Erro ao carregar convites:', err);
    alert('Erro ao carregar lista de convites: ' + err.message);
  } finally {
    showTableLoading(false);
  }
}

/**
 * Handle code generation form submit
 */
async function handleGenerateSubmit(e) {
  e.preventDefault();
  if (!supabase || !currentUser) return;

  elAdminStatus.textContent = '';
  elAdminStatus.className = 'status-text';

  let customCode = elCodeInput ? elCodeInput.value.trim().toUpperCase() : '';

  if (customCode) {
    const codeRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!codeRegex.test(customCode)) {
      elAdminStatus.textContent = t('admin.error_invalid_code');
      elAdminStatus.className = 'status-text error';
      return;
    }
  } else {
    customCode = generateRandomCode();
  }

  try {
    const { error } = await supabase
      .from('invitation_codes')
      .insert({
        code: customCode,
        created_by: currentUser.id
      });

    if (error) throw error;

    elAdminStatus.textContent = t('admin.success_generated', { code: customCode });
    elAdminStatus.className = 'status-text success';
    if (elCodeInput) elCodeInput.value = '';

    await fetchAndRenderInvites();

  } catch (err) {
    console.error('Erro ao gerar convite:', err);
    elAdminStatus.textContent = t('admin.error_generating') + ': ' + err.message;
    elAdminStatus.className = 'status-text error';
  }
}

/**
 * Generate random code: FH6-XXXXX-XXXX
 */
function generateRandomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `FH6-${rand(5)}-${rand(4)}`;
}

function showTableLoading(show) {
  if (elLoadingTable) elLoadingTable.style.display = show ? 'flex' : 'none';
  if (elTableWrapper) elTableWrapper.style.display = show ? 'none' : 'block';
}

document.addEventListener('DOMContentLoaded', init);