const KEY='full_levels_v1', SESSION='full_admin_session';
const login=document.getElementById('login'), dash=document.getElementById('dashboard');
const password=document.getElementById('password'), loginBtn=document.getElementById('loginBtn');
const form=document.getElementById('levelForm'), editId=document.getElementById('editId'), nameEl=document.getElementById('name'), creator=document.getElementById('creator'), rank=document.getElementById('rank'), banner=document.getElementById('banner'), gmd=document.getElementById('gmd');
const adminList=document.getElementById('adminList'), cancel=document.getElementById('cancelBtn'), logout=document.getElementById('logout'), clearAll=document.getElementById('clearAll');
let editing=null;
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
function save(x){localStorage.setItem(KEY,JSON.stringify(x))}
function enter(){login.hidden=true;dash.hidden=false;renderAdmin()}
function doLogin(){if(password.value==='change-me'){sessionStorage.setItem(SESSION,'1');enter()}else alert('Incorrect admin password.')}
loginBtn.onclick=doLogin;password.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
if(sessionStorage.getItem(SESSION)==='1')enter();
logout.onclick=()=>{sessionStorage.removeItem(SESSION);location.reload()};
function fileData(file){return new Promise((res,rej)=>{if(!file)return res('');const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
function renderAdmin(){const data=load().sort((a,b)=>a.rank-b.rank);adminList.innerHTML='';if(!data.length){adminList.innerHTML='<div class="small">No levels yet.</div>';return}data.forEach(x=>{const row=document.createElement('div');row.className='admin-row';row.innerHTML=`<strong>#${x.rank}</strong><img src="${x.banner||'logo.png'}"><div><strong>${esc(x.name)}</strong><div class="small">${esc(x.creator)}</div></div><div class="small">${x.gmdName?'GMD attached':'No GMD'}</div><div class="row-actions"><button data-edit="${x.id}">Edit</button><button data-up="${x.id}">↑</button><button data-down="${x.id}">↓</button><button class="delete" data-delete="${x.id}">Delete</button></div>`;adminList.append(row)})}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
adminList.addEventListener('click',e=>{const id=e.target.dataset.edit||e.target.dataset.delete||e.target.dataset.up||e.target.dataset.down;if(!id)return;let data=load(),i=data.findIndex(x=>x.id===id);if(i<0)return;if(e.target.dataset.edit){const x=data[i];editing=x.id;editId.value=x.id;nameEl.value=x.name;creator.value=x.creator;rank.value=x.rank;gmd.required=false;document.getElementById('saveBtn').textContent='Save Changes';cancel.hidden=false;window.scrollTo({top:0,behavior:'smooth'})}else if(e.target.dataset.delete){if(confirm('Delete '+data[i].name+'?')){data.splice(i,1);save(data);renderAdmin()}}else if(e.target.dataset.up){data[i].rank=Math.max(1,data[i].rank-1);save(data);renderAdmin()}else if(e.target.dataset.down){data[i].rank++;save(data);renderAdmin()}});
form.addEventListener('submit',async e=>{e.preventDefault();let data=load();let existing=editing?data.find(x=>x.id===editing):null;const b=await fileData(banner.files[0]);const g=await fileData(gmd.files[0]);const obj={id:editing||crypto.randomUUID(),name:nameEl.value.trim(),creator:creator.value.trim(),rank:Number(rank.value),banner:b||existing?.banner||'',gmd:g||existing?.gmd||'',gmdName:gmd.files[0]?.name||existing?.gmdName||''};if(editing){const i=data.findIndex(x=>x.id===editing);data[i]=obj}else data.push(obj);save(data);reset();renderAdmin()});
function reset(){editing=null;editId.value='';form.reset();gmd.required=true;document.getElementById('saveBtn').textContent='Add Level';cancel.hidden=true}
cancel.onclick=reset;
clearAll.onclick=()=>{if(confirm('Clear the entire list? This cannot be undone.')){save([]);renderAdmin()}};
