import { supabase } from './supabase.js';
import { getCurrentUser } from './auth.js';
import { t } from './i18n.js';

let activeCarId = null;
let currentUser = null;

// DOM elements
const elModal = document.getElementById('shareModal');
const elBtnShare = document.getElementById('btnShare');
const elBtnCancel = document.getElementById('btnCancelShare');
const elShareForm = document.getElementById('shareForm');
const elGamertagInput = document.getElementById('shareGamertagInput');
const elModalStatus = document.getElementById('modalStatus');
const elSharedUsersContainer = document.getElementById('sharedUsersContainer');

// Friends elements
const elFriendsContainer = document.getElementById('friendsContainer');
const elAddFriendInput = document.getElementById('addFriendGamertagInput');
const elBtnAddFriend = document.getElementById('btnAddFriend');

/**
 * Initialize share modal behavior for a car
 * @param {string} carId 
 */
export async function initShareModal(carId) {
  activeCarId = carId;
  currentUser = await getCurrentUser();
  if (!currentUser) return;

  // Open modal click
  if (elBtnShare) {
    // Clone to remove previous listeners if re-initialized
    const newBtnShare = elBtnShare.cloneNode(true);
    elBtnShare.parentNode.replaceChild(newBtnShare, elBtnShare);
    
    newBtnShare.addEventListener('click', () => {
      if (elModal) elModal.classList.add('open');
      if (elModalStatus) {
        elModalStatus.textContent = '';
        elModalStatus.className = 'status-text';
      }
      if (elGamertagInput) elGamertagInput.value = '';
      if (elAddFriendInput) elAddFriendInput.value = '';
      loadSharedUsers();
      loadFriends();
    });
  }

  // Close modal click
  if (elBtnCancel) {
    elBtnCancel.onclick = () => {
      if (elModal) elModal.classList.remove('open');
    };
  }

  // Close when clicking overlay
  if (elModal) {
    elModal.onclick = (e) => {
      if (e.target === elModal) {
        elModal.classList.remove('open');
      }
    };
  }

  // Form submit (Conceder Acesso)
  if (elShareForm) {
    elShareForm.onsubmit = handleShareSubmit;
  }

  // Add friend click
  if (elBtnAddFriend) {
    elBtnAddFriend.onclick = handleAddFriend;
  }
}

/**
 * Handle share form submission
 */
async function handleShareSubmit(e) {
  e.preventDefault();
  if (!supabase || !activeCarId || !currentUser) return;

  elModalStatus.textContent = '';
  elModalStatus.className = 'status-text';

  const targetGamertag = elGamertagInput.value.trim();
  if (!targetGamertag) {
    elModalStatus.textContent = t('car.share_modal.messages.enter_gamertag');
    elModalStatus.className = 'status-text error';
    return;
  }

  try {
    // 1. Fetch current profile to verify we are not sharing with ourselves
    const { data: ownProfile, error: ownProfErr } = await supabase
      .from('profiles')
      .select('gamertag')
      .eq('id', currentUser.id)
      .single();

    if (ownProfErr) throw ownProfErr;
    if (ownProfile.gamertag.toLowerCase() === targetGamertag.toLowerCase()) {
      throw new Error(t('car.share_modal.messages.self_share_error'));
    }

    // 2. Fetch target profile
    const { data: targetProfile, error: targetProfErr } = await supabase
      .from('profiles')
      .select('id, gamertag')
      .eq('gamertag', targetGamertag)
      .maybeSingle();

    if (targetProfErr) throw targetProfErr;
    if (!targetProfile) {
      throw new Error(t('car.share_modal.messages.not_found', { gamertag: targetGamertag }));
    }

    // 3. Check if already shared
    const { data: existingShare, error: shareCheckErr } = await supabase
      .from('car_shares')
      .select('id')
      .eq('car_id', activeCarId)
      .eq('shared_with', targetProfile.id)
      .maybeSingle();

    if (shareCheckErr) throw shareCheckErr;
    if (existingShare) {
      throw new Error(t('car.share_modal.messages.already_shared', { gamertag: targetProfile.gamertag }));
    }

    // 4. Insert share entry
    const { error: insertErr } = await supabase
      .from('car_shares')
      .insert({
        car_id: activeCarId,
        owner_id: currentUser.id,
        shared_with: targetProfile.id
      });

    if (insertErr) throw insertErr;

    elModalStatus.textContent = t('car.share_modal.messages.access_granted', { gamertag: targetProfile.gamertag });
    elModalStatus.className = 'status-text success';
    elGamertagInput.value = '';

    // Reload list
    await loadSharedUsers();
  } catch (err) {
    console.error('Error sharing build:', err);
    elModalStatus.textContent = err.message || t('car.share_modal.messages.share_error');
    elModalStatus.className = 'status-text error';
  }
}

/**
 * Load list of users who have access to this build
 */
async function loadSharedUsers() {
  if (!supabase || !activeCarId) return;

  if (elSharedUsersContainer) {
    elSharedUsersContainer.innerHTML = `<div style="color: var(--muted); font-size: 0.8rem; font-family: var(--cond);">${t('car.share_modal.loading_pilots')}</div>`;
  }

  try {
    const { data: shares, error } = await supabase
      .from('car_shares')
      .select('id, shared_with')
      .eq('car_id', activeCarId);

    if (error) throw error;

    if (!shares || shares.length === 0) {
      elSharedUsersContainer.innerHTML = `<div style="color: var(--muted); font-size: 0.8rem; font-family: var(--cond); text-transform: uppercase;">${t('car.share_modal.no_pilots')}</div>`;
      return;
    }

    // Fetch gamertags
    const userIds = shares.map(s => s.shared_with);
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, gamertag')
      .in('id', userIds);

    if (profErr) throw profErr;

    const profileLookup = {};
    profiles.forEach(p => {
      profileLookup[p.id] = p.gamertag;
    });

    elSharedUsersContainer.innerHTML = '';
    
    shares.forEach(share => {
      const gamertag = profileLookup[share.shared_with] || t('car.share_modal.unknown_pilot');
      
      const item = document.createElement('div');
      item.className = 'share-item';
      item.innerHTML = `
        <span class="share-gamertag">@${gamertag}</span>
        <button class="btn-clear" style="border-color: rgba(232,53,58,0.2); color: var(--red); font-size: 0.65rem;" data-id="${share.id}">${t('car.share_modal.revoke')}</button>
      `;

      // Bind revoke click
      item.querySelector('button').addEventListener('click', () => revokeAccess(share.id, gamertag));

      elSharedUsersContainer.appendChild(item);
    });

  } catch (err) {
    console.error('Error loading shared users:', err);
    elSharedUsersContainer.innerHTML = `<div style="color: var(--red); font-size: 0.8rem;">${t('car.share_modal.messages.loading_error')}</div>`;
  }
}

/**
 * Revoke shared access
 */
async function revokeAccess(shareId, gamertag) {
  if (!supabase) return;

  const confirmRevoke = confirm(t('car.share_modal.messages.confirm_revoke', { gamertag }));
  if (!confirmRevoke) return;

  try {
    const { error } = await supabase
      .from('car_shares')
      .delete()
      .eq('id', shareId);

    if (error) throw error;

    elModalStatus.textContent = t('car.share_modal.messages.access_revoked', { gamertag });
    elModalStatus.className = 'status-text success';
    await loadSharedUsers();
  } catch (err) {
    console.error('Error revoking access:', err);
    elModalStatus.textContent = t('car.share_modal.messages.revoke_error') + err.message;
    elModalStatus.className = 'status-text error';
  }
}

/**
 * Load list of friends from Supabase
 */
async function loadFriends() {
  if (!supabase || !currentUser || !elFriendsContainer) return;

  elFriendsContainer.innerHTML = `<div style="color: var(--muted); font-size: 0.72rem; font-family: var(--cond);">${t('car.share_modal.loading_pilots')}</div>`;

  try {
    const { data: friendships, error } = await supabase
      .from('friends')
      .select(`
        id,
        friend_id,
        profiles!friends_friend_id_fkey(gamertag)
      `)
      .eq('user_id', currentUser.id);

    if (error) throw error;

    if (!friendships || friendships.length === 0) {
      elFriendsContainer.innerHTML = `<div style="color: var(--muted); font-size: 0.72rem; font-family: var(--cond); text-transform: uppercase;">${t('car.share_modal.no_friends')}</div>`;
      return;
    }

    elFriendsContainer.innerHTML = '';

    friendships.forEach(friendship => {
      const gamertag = friendship.profiles?.gamertag || t('car.share_modal.unknown_pilot');

      const tag = document.createElement('div');
      tag.className = 'friend-tag-pill';
      tag.style.cssText = `
        background: rgba(255, 0, 127, 0.08);
        border: 1px solid rgba(255, 0, 127, 0.25);
        padding: 5px 12px;
        border-radius: 16px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-family: var(--cond);
        font-size: 0.72rem;
        cursor: pointer;
        color: var(--pink);
        transition: all 0.2s ease;
      `;

      // Hover effect via JS to ensure premium quality styling
      tag.onmouseenter = () => {
        tag.style.background = 'rgba(255, 0, 127, 0.15)';
        tag.style.borderColor = 'var(--pink)';
      };
      tag.onmouseleave = () => {
        tag.style.background = 'rgba(255, 0, 127, 0.08)';
        tag.style.borderColor = 'rgba(255, 0, 127, 0.25)';
      };

      // Fill main input on click
      tag.onclick = (e) => {
        if (elGamertagInput) {
          elGamertagInput.value = gamertag;
          elGamertagInput.focus();
        }
      };

      const nameSpan = document.createElement('span');
      nameSpan.textContent = `@${gamertag}`;
      
      const removeBtn = document.createElement('span');
      removeBtn.textContent = '×';
      removeBtn.style.cssText = `
        color: var(--muted);
        font-weight: bold;
        font-size: 0.85rem;
        cursor: pointer;
        transition: color 0.2s;
        padding-left: 2px;
      `;
      removeBtn.onmouseenter = () => { removeBtn.style.color = 'var(--red)'; };
      removeBtn.onmouseleave = () => { removeBtn.style.color = 'var(--muted)'; };

      removeBtn.onclick = async (e) => {
        e.stopPropagation(); // Avoid triggering filling input
        await removeFriend(friendship.id, gamertag);
      };

      tag.appendChild(nameSpan);
      tag.appendChild(removeBtn);
      elFriendsContainer.appendChild(tag);
    });

  } catch (err) {
    console.error('Error loading friends list:', err);
    elFriendsContainer.innerHTML = `<div style="color: var(--red); font-size: 0.72rem;">Erro ao carregar amigos.</div>`;
  }
}

/**
 * Handle adding a new friend
 */
async function handleAddFriend() {
  if (!supabase || !currentUser) return;

  elModalStatus.textContent = '';
  elModalStatus.className = 'status-text';

  const friendGamertag = elAddFriendInput.value.trim();
  if (!friendGamertag) return;

  try {
    // 1. Fetch own profile to check we are not adding ourselves
    const { data: ownProfile, error: ownErr } = await supabase
      .from('profiles')
      .select('gamertag')
      .eq('id', currentUser.id)
      .single();

    if (ownErr) throw ownErr;
    if (ownProfile.gamertag.toLowerCase() === friendGamertag.toLowerCase()) {
      throw new Error(t('car.share_modal.messages.friend_self_error'));
    }

    // 2. Fetch target profile
    const { data: targetProfile, error: targetErr } = await supabase
      .from('profiles')
      .select('id, gamertag')
      .eq('gamertag', friendGamertag)
      .maybeSingle();

    if (targetErr) throw targetErr;
    if (!targetProfile) {
      throw new Error(t('car.share_modal.messages.friend_not_found', { gamertag: friendGamertag }));
    }

    // 3. Check if already friends
    const { data: existingFriend, error: checkErr } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('friend_id', targetProfile.id)
      .maybeSingle();

    if (checkErr) throw checkErr;
    if (existingFriend) {
      throw new Error(t('car.share_modal.messages.friend_already'));
    }

    // 4. Insert friendship entry
    const { error: insertErr } = await supabase
      .from('friends')
      .insert({
        user_id: currentUser.id,
        friend_id: targetProfile.id
      });

    if (insertErr) throw insertErr;

    elModalStatus.textContent = t('car.share_modal.messages.friend_added');
    elModalStatus.className = 'status-text success';
    elAddFriendInput.value = '';

    await loadFriends();
  } catch (err) {
    console.error('Error adding friend:', err);
    elModalStatus.textContent = err.message || (t('car.share_modal.messages.friend_error') + err.message);
    elModalStatus.className = 'status-text error';
  }
}

/**
 * Remove friend friendship from Supabase
 */
async function removeFriend(friendshipId, gamertag) {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('friends')
      .delete()
      .eq('id', friendshipId);

    if (error) throw error;

    elModalStatus.textContent = t('car.share_modal.messages.friend_removed');
    elModalStatus.className = 'status-text success';

    await loadFriends();
  } catch (err) {
    console.error('Error removing friend:', err);
    elModalStatus.textContent = t('car.share_modal.messages.friend_error') + err.message;
    elModalStatus.className = 'status-text error';
  }
}
