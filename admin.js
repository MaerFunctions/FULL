const login = document.getElementById('login');
const dash = document.getElementById('dashboard');
const emailEl = document.getElementById('email');
const password = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const form = document.getElementById('levelForm');
const editId = document.getElementById('editId');
const nameEl = document.getElementById('name');
const creator = document.getElementById('creator');
const rank = document.getElementById('rank');
const banner = document.getElementById('banner');
const gmd = document.getElementById('gmd');
const adminList = document.getElementById('adminList');
const cancel = document.getElementById('cancelBtn');
const logout = document.getElementById('logout');
const clearAll = document.getElementById('clearAll');
const loginStatus = document.getElementById('loginStatus');

let editing = null;
let currentLevels = [];

function setStatus(message, isError = false) {
  if (!loginStatus) return;
  loginStatus.textContent = message || '';
  loginStatus.className = isError ? 'hint error' : 'hint';
}

function safeName(value) {
  return String(value || 'level').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'level';
}

function extensionOf(file, fallback) {
  const name = file?.name || '';
  const match = name.match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : fallback;
}

function storagePath(prefix, levelId, file, fallbackExt) {
  return `${prefix}/${levelId}-${crypto.randomUUID()}${extensionOf(file, fallbackExt)}`;
}

async function isAdmin() {
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) return false;
  const { data, error: adminError } = await supabaseClient
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return !adminError && !!data;
}

async function showDashboard() {
  if (!(await isAdmin())) {
    await supabaseClient.auth.signOut();
    login.hidden = false;
    dash.hidden = true;
    setStatus('This account is not authorized as an F.U.L.L. admin.', true);
    return;
  }
  login.hidden = true;
  dash.hidden = false;
  await renderAdmin();
}

async function doLogin() {
  const email = emailEl.value.trim();
  const pass = password.value;
  if (!email || !pass) {
    setStatus('Enter your Supabase email and password.', true);
    return;
  }
  loginBtn.disabled = true;
  setStatus('Signing in...');
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
  loginBtn.disabled = false;
  if (error) {
    setStatus(error.message, true);
    return;
  }
  await showDashboard();
}

loginBtn.addEventListener('click', doLogin);
password.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
emailEl.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

logout.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  location.reload();
});

async function fetchLevels() {
  const { data, error } = await supabaseClient
    .from('levels')
    .select('*')
    .order('rank', { ascending: true });
  if (error) throw error;
  return data || [];
}

function publicUrl(path) {
  if (!path) return '';
  return supabaseClient.storage.from('level-files').getPublicUrl(path).data.publicUrl;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

async function renderAdmin() {
  try {
    currentLevels = await fetchLevels();
    adminList.innerHTML = '';
    if (!currentLevels.length) {
      adminList.innerHTML = '<div class="small">No levels yet.</div>';
      return;
    }
    currentLevels.forEach(x => {
      const row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML = `
        <strong>#${x.rank}</strong>
        <img src="${esc(publicUrl(x.banner_path) || 'logo.png')}" alt="">
        <div><strong>${esc(x.name)}</strong><div class="small">${esc(x.creator)}</div></div>
        <div class="small">${x.gmd_path ? 'GMD attached' : 'No GMD'}</div>
        <div class="row-actions">
          <button data-edit="${x.id}">Edit</button>
          <button data-up="${x.id}">↑</button>
          <button data-down="${x.id}">↓</button>
          <button class="delete" data-delete="${x.id}">Delete</button>
        </div>`;
      adminList.append(row);
    });
  } catch (error) {
    adminList.innerHTML = `<div class="small error">Could not load levels: ${esc(error.message)}</div>`;
  }
}

async function updateRank(id, newRank) {
  const item = currentLevels.find(x => x.id === id);
  if (!item || item.rank === newRank) return;
  const other = currentLevels.find(x => x.rank === newRank);
  if (!other) {
    const { error } = await supabaseClient.from('levels').update({ rank: newRank }).eq('id', id);
    if (error) throw error;
    return;
  }
  const tempA = -Math.floor(Math.random() * 1000000000) - 1;
  const tempB = tempA - 1;
  let result = await supabaseClient.from('levels').update({ rank: tempA }).eq('id', id);
  if (result.error) throw result.error;
  result = await supabaseClient.from('levels').update({ rank: tempB }).eq('id', other.id);
  if (result.error) throw result.error;
  result = await supabaseClient.from('levels').update({ rank: newRank }).eq('id', id);
  if (result.error) throw result.error;
  result = await supabaseClient.from('levels').update({ rank: item.rank }).eq('id', other.id);
  if (result.error) throw result.error;
}

adminList.addEventListener('click', async e => {
  const id = e.target.dataset.edit || e.target.dataset.delete || e.target.dataset.up || e.target.dataset.down;
  if (!id) return;
  try {
    const item = currentLevels.find(x => x.id === id);
    if (!item) return;

    if (e.target.dataset.edit) {
      editing = item.id;
      editId.value = item.id;
      nameEl.value = item.name;
      creator.value = item.creator;
      rank.value = item.rank;
      gmd.required = false;
      document.getElementById('saveBtn').textContent = 'Save Changes';
      cancel.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (e.target.dataset.delete) {
      if (!confirm(`Delete ${item.name}?`)) return;
      const paths = [item.banner_path, item.gmd_path].filter(Boolean);
      const { error } = await supabaseClient.from('levels').delete().eq('id', item.id);
      if (error) throw error;
      if (paths.length) await supabaseClient.storage.from('level-files').remove(paths);
      await renderAdmin();
      return;
    }

    if (e.target.dataset.up) {
      const target = currentLevels.find(x => x.rank === item.rank - 1);
      if (target) await updateRank(item.id, target.rank);
      await renderAdmin();
      return;
    }

    if (e.target.dataset.down) {
      const target = currentLevels.find(x => x.rank === item.rank + 1);
      if (target) await updateRank(item.id, target.rank);
      await renderAdmin();
    }
  } catch (error) {
    alert(`Action failed: ${error.message}`);
  }
});

async function uploadFile(file, path) {
  const { error } = await supabaseClient.storage.from('level-files').upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
    cacheControl: '3600'
  });
  if (error) throw error;
  return path;
}

async function makeRoomForRank(desiredRank, excludeId = null) {
  const levels = await fetchLevels();
  const maxRank = levels.length + 1;
  let affected = levels.filter(x => x.id !== excludeId && x.rank >= desiredRank).sort((a,b) => b.rank - a.rank);
  if (!affected.length) return;
  const tempBase = -1000000000;
  for (let i = 0; i < affected.length; i++) {
    const { error } = await supabaseClient.from('levels').update({ rank: tempBase - i }).eq('id', affected[i].id);
    if (error) throw error;
  }
  for (const x of affected) {
    const { error } = await supabaseClient.from('levels').update({ rank: x.rank + 1 }).eq('id', x.id);
    if (error) throw error;
  }
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  let uploadedPaths = [];
  try {
    const levelName = nameEl.value.trim();
    const levelCreator = creator.value.trim();
    const desiredRank = Math.max(1, Number(rank.value));
    if (!levelName || !levelCreator || !Number.isInteger(desiredRank)) throw new Error('Please enter a valid level name, creator, and rank.');

    if (editing) {
      const { data: existing, error: existingError } = await supabaseClient.from('levels').select('*').eq('id', editing).single();
      if (existingError) throw existingError;

      if (desiredRank !== existing.rank) {
        if (desiredRank < existing.rank) {
          const affected = (await fetchLevels()).filter(x => x.id !== editing && x.rank >= desiredRank && x.rank < existing.rank).sort((a,b)=>b.rank-a.rank);
          for (let i=0;i<affected.length;i++) {
            let r = await supabaseClient.from('levels').update({rank:-2000000000-i}).eq('id',affected[i].id); if(r.error) throw r.error;
          }
          for (const x of affected) { let r=await supabaseClient.from('levels').update({rank:x.rank+1}).eq('id',x.id); if(r.error) throw r.error; }
        } else {
          const affected = (await fetchLevels()).filter(x => x.id !== editing && x.rank > existing.rank && x.rank <= desiredRank).sort((a,b)=>a.rank-b.rank);
          for (let i=0;i<affected.length;i++) { let r=await supabaseClient.from('levels').update({rank:-2100000000-i}).eq('id',affected[i].id); if(r.error) throw r.error; }
          for (const x of affected) { let r=await supabaseClient.from('levels').update({rank:x.rank-1}).eq('id',x.id); if(r.error) throw r.error; }
        }
      }

      const updates = { name: levelName, creator: levelCreator, rank: desiredRank };
      if (banner.files[0]) {
        const path = storagePath('banners', editing, banner.files[0], '.png');
        await uploadFile(banner.files[0], path); uploadedPaths.push(path);
        updates.banner_path = path;
      }
      if (gmd.files[0]) {
        const path = storagePath('gmd', editing, gmd.files[0], '.gmd');
        await uploadFile(gmd.files[0], path); uploadedPaths.push(path);
        updates.gmd_path = path;
      }
      const { error } = await supabaseClient.from('levels').update(updates).eq('id', editing);
      if (error) throw error;
      const oldPaths = [];
      if (updates.banner_path && existing.banner_path) oldPaths.push(existing.banner_path);
      if (updates.gmd_path && existing.gmd_path) oldPaths.push(existing.gmd_path);
      if (oldPaths.length) await supabaseClient.storage.from('level-files').remove(oldPaths);
    } else {
      const levelId = crypto.randomUUID();
      await makeRoomForRank(desiredRank);
      const gmdFile = gmd.files[0];
      if (!gmdFile) throw new Error('Choose a .gmd file.');
      const gmdPath = storagePath('gmd', levelId, gmdFile, '.gmd');
      await uploadFile(gmdFile, gmdPath); uploadedPaths.push(gmdPath);
      let bannerPath = '';
      if (banner.files[0]) {
        bannerPath = storagePath('banners', levelId, banner.files[0], '.png');
        await uploadFile(banner.files[0], bannerPath); uploadedPaths.push(bannerPath);
      }
      const { error } = await supabaseClient.from('levels').insert({
        id: levelId,
        rank: desiredRank,
        name: levelName,
        creator: levelCreator,
        banner_path: bannerPath,
        gmd_path: gmdPath
      });
      if (error) throw error;
    }

    reset();
    await renderAdmin();
  } catch (error) {
    if (uploadedPaths.length) await supabaseClient.storage.from('level-files').remove(uploadedPaths);
    alert(`Could not save level: ${error.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = editing ? 'Save Changes' : 'Add Level';
  }
});

function reset() {
  editing = null;
  editId.value = '';
  form.reset();
  gmd.required = true;
  document.getElementById('saveBtn').textContent = 'Add Level';
  cancel.hidden = true;
}

cancel.addEventListener('click', reset);

clearAll.addEventListener('click', async () => {
  if (!confirm('Clear the entire list? This cannot be undone.')) return;
  try {
    const levels = await fetchLevels();
    const ids = levels.map(x => x.id);
    const paths = levels.flatMap(x => [x.banner_path, x.gmd_path]).filter(Boolean);
    if (ids.length) {
      const { error } = await supabaseClient.from('levels').delete().in('id', ids);
      if (error) throw error;
    }
    if (paths.length) await supabaseClient.storage.from('level-files').remove(paths);
    await renderAdmin();
  } catch (error) {
    alert(`Could not clear list: ${error.message}`);
  }
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) showDashboard();
});

(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) await showDashboard();
})();
