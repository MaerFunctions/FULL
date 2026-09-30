const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const search = document.getElementById('search');
const sort = document.getElementById('sort');
const reverse = document.getElementById('reverse');
let reversed = false;

function publicUrl(path) {
  if (!path) return '';
  return supabaseClient.storage.from('level-files').getPublicUrl(path).data.publicUrl;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

async function load() {
  const { data, error } = await supabaseClient
    .from('levels')
    .select('*')
    .order('rank', { ascending: true });
  if (error) throw error;
  return data || [];
}

function render(data) {
  const q = search.value.toLowerCase().trim();
  data = data.filter(x => !q || x.name.toLowerCase().includes(q) || x.creator.toLowerCase().includes(q));
  const s = sort.value;
  data.sort((a,b) => s === 'rank' ? a.rank - b.rank : s === 'name' ? a.name.localeCompare(b.name) : a.creator.localeCompare(b.creator));
  if (reversed) data.reverse();
  listEl.innerHTML = '';
  emptyEl.hidden = data.length !== 0;

  data.forEach(x => {
    const wrap = document.createElement('article');
    wrap.className = 'level-card';
    const rank = document.createElement('div');
    rank.className = 'rank ' + (x.rank === 1 ? 'gold' : x.rank === 2 ? 'silver' : x.rank === 3 ? 'bronze' : '');
    rank.textContent = '#' + x.rank;

    const card = document.createElement('div');
    card.className = 'card';
    const img = document.createElement('img');
    img.className = 'banner';
    img.src = publicUrl(x.banner_path) || 'logo.png';
    img.alt = 'Banner for ' + x.name;
    img.onerror = () => { img.src = 'logo.png'; };

    const info = document.createElement('div');
    info.className = 'info';
    const n = document.createElement('h2');
    n.className = 'name';
    n.textContent = x.name;
    const c = document.createElement('div');
    c.className = 'creator';
    c.textContent = x.creator;

    const a = document.createElement('a');
    a.className = 'download';
    a.textContent = 'Download GMD';
    a.href = publicUrl(x.gmd_path) || '#';
    a.target = '_blank';
    a.rel = 'noopener';
    if (x.gmd_path) {
      a.download = x.name + '.gmd';
    } else {
      a.classList.add('disabled');
      a.onclick = e => e.preventDefault();
    }

    info.append(n, c, a);
    card.append(img, info);
    wrap.append(rank, card);
    listEl.append(wrap);
  });
}

async function refresh() {
  try {
    render(await load());
  } catch (error) {
    listEl.innerHTML = `<div class="empty error">Could not load the list: ${esc(error.message)}</div>`;
    emptyEl.hidden = true;
  }
}

search.addEventListener('input', refresh);
sort.addEventListener('change', refresh);
reverse.addEventListener('click', () => {
  reversed = !reversed;
  reverse.textContent = reversed ? '↓' : '↑';
  refresh();
});

refresh();
