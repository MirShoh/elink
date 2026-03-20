function safeParse(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch (e) {
    return fallback;
  }
}


(function(){
  if(typeof _D === 'undefined'){ window.DATA=[]; return; }
  try{
    const key = 'elink_uz_2026_secure';
    const b64  = atob(_D);
    const bytes = new Uint8Array(b64.length);
    for(let i=0;i<b64.length;i++)
      bytes[i] = b64.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    window.DATA = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    if(!Array.isArray(window.DATA) || !window.DATA.length) throw new Error('Empty DATA');
  }catch(e){
    console.error('[E-Link] Decode failed:', e.message);
    window.DATA = [];
    if('caches' in window){
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
  }
})();


function escHtml(str){
  if(!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

const SUPA_PROXY = '/.netlify/functions/supabase';


function getOrCreateUserId(){
  let uid = localStorage.getItem('lh_uid');
  if(!uid){
    uid = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,9);
    localStorage.setItem('lh_uid', uid);
  }
  return uid;
}
const USER_ID = getOrCreateUserId();


async function loadUserDataFromSupabase(){
  try{
    const res = await fetch(SUPA_PROXY,{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        path: '/rest/v1/user_data?user_id=eq.'+encodeURIComponent(USER_ID)+'&select=custom_apps,favorites',
        method: 'GET'
      })
    });
    if(!res.ok) return null;
    const rows = await res.json();
    if(Array.isArray(rows) && rows[0]){
      return { customApps: rows[0].custom_apps||[], favorites: rows[0].favorites||[] };
    }
    return null;
  }catch(e){ console.warn('[sync] load error:', e.message); return null; }
}


let _syncTimer = null;


// ─── Drag-and-drop: shaxsiy ro'yxat tartibini o'zgartirish ───────────────────
function _initMyAppsDnD(grid){
  let dragSrc = null;
  let dropIndicator = null;

  function getIndicator(){
    if(!dropIndicator){
      dropIndicator = document.createElement('div');
      dropIndicator.className = 'dnd-drop-indicator';
      dropIndicator.innerHTML = '<div class="dnd-drop-line"></div>';
    }
    return dropIndicator;
  }
  function clearIndicator(){
    if(dropIndicator && dropIndicator.parentNode)
      dropIndicator.parentNode.removeChild(dropIndicator);
    grid.querySelectorAll('[data-appname]').forEach(c=>{
      c.classList.remove('dnd-over-left','dnd-over-right');
    });
  }

  grid.querySelectorAll('[data-appname]').forEach(el => {
    el.addEventListener('dragstart', e => {
      dragSrc = el;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', el.dataset.appname);
      setTimeout(() => {
        el.classList.add('opacity-30','scale-95','ring-2','ring-violet-400/50');
      }, 0);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('opacity-30','scale-95','ring-2','ring-violet-400/50');
      clearIndicator();
      dragSrc = null;
    });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if(!dragSrc || dragSrc === el) return;
      // Karta markaziga nisbatan chap yoki o'ng tomonini aniqla
      const rect = el.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const insertBefore = e.clientX < midX;
      clearIndicator();
      const ind = getIndicator();
      ind.style.cssText = `position:absolute;top:0;bottom:0;width:3px;background:linear-gradient(to bottom,#8b5cf6,#d946ef);border-radius:99px;z-index:50;pointer-events:none;box-shadow:0 0 8px #8b5cf666;`;
      if(insertBefore){
        el.style.position='relative';
        ind.style.left='-6px'; ind.style.right='';
        el.insertBefore(ind, el.firstChild);
      } else {
        el.style.position='relative';
        ind.style.right='-6px'; ind.style.left='';
        el.appendChild(ind);
      }
      el.dataset.insertBefore = insertBefore ? '1' : '0';
    });
    el.addEventListener('dragleave', () => {
      clearIndicator();
    });
    el.addEventListener('drop', e => {
      e.preventDefault();
      if(!dragSrc || dragSrc === el) return;
      clearIndicator();
      const insertBefore = el.dataset.insertBefore !== '0';
      delete el.dataset.insertBefore;
      if(insertBefore) el.before(dragSrc);
      else el.after(dragSrc);
      // customApps massivini yangi tartibga keltirish
      const newOrder = [...grid.querySelectorAll('[data-appname]')].map(c => c.dataset.appname);
      customApps.sort((a,b) => newOrder.indexOf(a.n) - newOrder.indexOf(b.n));
      localStorage.setItem('lh_custom_apps', JSON.stringify(customApps));
      const cat = DATA.find(c=>c.id==='my_apps');
      if(cat) cat.items = customApps;
      saveUserDataToSupabase();
      // Mini animatsiya
      dragSrc.classList.add('scale-105');
      setTimeout(()=>dragSrc?.classList.remove('scale-105'),200);
    });
  });

  // Drag handle
  grid.querySelectorAll('.drag-handle').forEach(handle => {
    handle.addEventListener('mousedown', e => {
      const wrapper = handle.closest('[data-appname]');
      if(wrapper) wrapper.draggable = true;
    });
  });
}

function saveUserDataToSupabase(){
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async ()=>{
    try{
      await fetch(SUPA_PROXY,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          path: '/rest/v1/rpc/upsert_user_data', method:'POST',
          body: {
            p_user_id: USER_ID,
            p_custom_apps: customApps,
            p_favorites:   favorites
          }
        })
      });
    }catch(e){ console.warn('[sync] save error:', e.message); }
  }, 900);
}

async function sendTelegram(text){
  try {
    await fetch('/.netlify/functions/telegram', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ text })
    });
  } catch(e){ console.warn('[TG]', e.message); }
}


// globalClicks — localStorage cache bilan ishlanadi
// Sahifa yangilanganda eski qiymatlar darhol yuklanadi, Supabase kelganda merge bo'ladi
let globalClicks = safeParse('lh_clicks_cache', {});

function _saveClicksCache(){
  try{ localStorage.setItem('lh_clicks_cache', JSON.stringify(globalClicks)); }catch(e){}
}

async function initGlobalClicks() {
  // 1) Avval localStorage cache ni ko'rsatamiz — sahifa darhol to'g'ri ko'rinadi
  if(Object.keys(globalClicks).length){
    Object.entries(globalClicks).forEach(([n, c]) => _updateCountEl(n, c));
    renderTrending();
    updateSidebarStats();
  }
  // 2) Serverdan yangi ma'lumot olamiz va merge qilamiz
  try {
    const res = await fetch(SUPA_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/rest/v1/clicks?select=name,count&limit=1000', method: 'GET' })
    });
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows)) return;
    // Server qiymati kattaroq bo'lsa — serverniki ustun
    rows.forEach(r => {
      if(r.count > 0){
        globalClicks[r.name] = Math.max(r.count, globalClicks[r.name]||0);
      }
    });
    _saveClicksCache();
    Object.entries(globalClicks).forEach(([n, c]) => _updateCountEl(n, c));
    renderTrending();
    updateSidebarStats();
  } catch (e) { console.warn('[E-Link] Supabase error:', e.message); }
}

async function _supaIncrement(name) {
  try {
    const res = await fetch(SUPA_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/rest/v1/rpc/increment_click', method: 'POST', body: { p_name: name } })
    });
    if (!res.ok) return null;
    const val = await res.json();
    return typeof val === 'number' ? val : null;
  } catch (e) { return null; }
}

function _updateCountEl(name, count){
const id = 'cb-' + name.replace(/[^a-zA-Z0-9]/g,'_');
const el = document.getElementById(id);
if(!el) return;
el.querySelector('span').textContent = count;
if(count > 0){
  // opacity-0 va group-hover klasslarini ham olib tashlaymiz — aks holda ko'rinmaydi
  el.classList.remove(
    'text-slate-300','dark:text-slate-600','bg-slate-50','dark:bg-slate-800/40',
    'opacity-0','group-hover:opacity-100','transition-opacity'
  );
  el.classList.add('text-violet-500','dark:text-violet-400','bg-violet-50','dark:bg-violet-500/10');
}
}

let customApps = safeParse('lh_custom_apps', []);
async function _syncUserData(){
  const remote = await loadUserDataFromSupabase();
  if(!remote) return false;
  let changed = false;
  if(remote.customApps.length >= customApps.length){
    customApps = remote.customApps;
    localStorage.setItem('lh_custom_apps', JSON.stringify(customApps));
    if(typeof DATA !== 'undefined'){
      const cat = DATA?.find(c=>c.id==='my_apps');
      if(cat) cat.items = customApps;
    }
    changed = true;
  }
  if(remote.favorites.length >= favorites.length){
    favorites = remote.favorites;
    localStorage.setItem('lh_favs', JSON.stringify(favorites));
    changed = true;
  }
  return changed;
}



function initCustomApps() {
  if(typeof DATA === 'undefined' || !Array.isArray(DATA)) {
    console.warn('[E-Link] DATA yuklanmagan, initCustomApps kechiktirildi');
    return;
  }
  const myAppsCategory = DATA.find(c => c.id === 'my_apps');
  if (myAppsCategory) myAppsCategory.items = customApps;
}



let activeCat  = 'all';
let query      = '';
let filters    = [];
let sortMode   = 'def';
let favorites      = safeParse('lh_favs', []);
let srchHist       = safeParse('lh_hist', []);
let recentlyVisited = safeParse('lh_recent', []); // So'nggi ko'rilgan resurslar

const MAX_HIST = 5;
const FILTERS  = [
{id:'bepul',  label:'Bepul',    icon:'fa-solid fa-check-circle', color:'emerald'},
{id:'mobil',  label:'Ilova',    icon:'fa-solid fa-mobile-screen-button', color:'sky'},
{id:'web',    label:'Veb',      icon:'fa-solid fa-globe',        color:'blue'},
];

const $=id=>document.getElementById(id);


function getDomain(url){ try{return new URL(url).hostname.replace('www.','');}catch(e){return '';} }

function getFallbackColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['ef4444','f97316','f59e0b','10b981','14b8a6','06b6d4','3b82f6','6366f1','8b5cf6','d946ef','f43f5e'];
  return colors[Math.abs(hash) % colors.length];
}

window._logoFail = function(img) {
  img.onerror = null;
  const wrap = img.closest('.card-logo-wrap') || img.parentElement;
  if(wrap && !wrap.dataset.avatarSet){
    wrap.dataset.avatarSet = '1';
    // img ning haqiqiy o'lchamini olish — 0 bo'lsa Tailwind classdan topamiz
    let sz = img.offsetWidth;
    if(!sz){
      const m = (img.className||'').match(/\bw-(\d+)\b/);
      sz = m ? parseInt(m[1])*4 : 44;
    }
    img.style.display = 'none';
    const palettes = [
      ['#6366f1','#8b5cf6'],['#ec4899','#f97316'],['#06b6d4','#6366f1'],
      ['#10b981','#06b6d4'],['#f59e0b','#ef4444'],['#8b5cf6','#ec4899'],
      ['#14b8a6','#3b82f6'],['#f97316','#fbbf24'],['#d946ef','#6366f1'],
      ['#ef4444','#f97316'],['#84cc16','#10b981'],['#a855f7','#ec4899'],
      ['#0ea5e9','#06b6d4'],['#f43f5e','#fb7185'],['#7c3aed','#4f46e5'],
      ['#059669','#84cc16'],['#ea580c','#f59e0b'],['#be185d','#9333ea'],
      ['#0284c7','#0ea5e9'],['#16a34a','#15803d'],['#dc2626','#b91c1c'],
      ['#7c3aed','#c026d3'],['#0891b2','#0e7490'],['#ca8a04','#b45309']
    ];
    let hash = 0;
    for(let i=0;i<(img.alt||'').length;i++) hash = (img.alt||'').charCodeAt(i)+((hash<<5)-hash);
    const [c1,c2] = palettes[Math.abs(hash) % palettes.length];
    const av = document.createElement('div');
    // O'lchov img bilan bir xil, kengaymaydi
    av.style.cssText = `width:${sz}px;height:${sz}px;min-width:${sz}px;min-height:${sz}px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,${c1},${c2});border-radius:inherit;`;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svgEl = document.createElementNS(svgNS,'svg');
    svgEl.setAttribute('viewBox','0 0 64 64');
    svgEl.style.cssText = 'width:72%;height:72%;';
    const shapes = [
      ['circle',{cx:32,cy:32,r:18,fill:'none',stroke:'rgba(255,255,255,0.92)','stroke-width':2.4}],
      ['line',{x1:14,y1:32,x2:50,y2:32,stroke:'rgba(255,255,255,0.75)','stroke-width':1.8}],
      ['line',{x1:32,y1:14,x2:32,y2:50,stroke:'rgba(255,255,255,0.75)','stroke-width':1.8}],
      ['path',{d:'M32 14 Q20 32 32 50',fill:'none',stroke:'rgba(255,255,255,0.65)','stroke-width':1.8}],
      ['path',{d:'M32 14 Q44 32 32 50',fill:'none',stroke:'rgba(255,255,255,0.65)','stroke-width':1.8}],
    ];
    shapes.forEach(([tag,attrs])=>{
      const el = document.createElementNS(svgNS,tag);
      Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
      svgEl.appendChild(el);
    });
    av.appendChild(svgEl);
    wrap.appendChild(av);
  }
};

/* Google S2 favicon xizmati mavjud bo'lmagan domenlar uchun
   16×16 px xira globus qaytaradi (onerror o'rniga 200 OK).
   onload orqali o'lchamni tekshirib, kichik bo'lsa fallbackga o'tamiz. */
window._logoLoaded = function(img) {
  if (img.src.startsWith('data:')) return; // boshlang'ich SVG placeholder — o'tkazib yubor
  /* Google S2 servisi favicon yo'q domenlar uchun 16×16 px xira globus qaytaradi.
     Faqat Google URL, step=1 va kichik rasm bo'lsa fallbackga o'tamiz. */
  if (parseInt(img.dataset.step) === 1 &&
      img.src.includes('google.com/s2/favicons') &&
      img.naturalWidth > 0 && img.naturalWidth <= 16) {
    window._logoFail(img);
  }
};

function _globeSVG(c1, c2) {
  /* MUHIM: url(#id) gradient referansi <img src> da ishlamaydi,
     shuning uchun to'g'ridan-to'g'ri c1 solid fill ishlatamiz. */
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="14" fill="${c1}"/>` +
    `<circle cx="32" cy="32" r="18" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2.2"/>` +
    `<line x1="14" y1="32" x2="50" y2="32" stroke="rgba(255,255,255,0.7)" stroke-width="1.7"/>` +
    `<line x1="32" y1="14" x2="32" y2="50" stroke="rgba(255,255,255,0.7)" stroke-width="1.7"/>` +
    `<path d="M32 14 Q20 32 32 50" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1.7"/>` +
    `<path d="M32 14 Q44 32 32 50" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1.7"/>` +
    `</svg>`
  )}`;
}

function _gradientGlobeDiv(c1, c2, cls) {
  // cls dan o'lcham klaslarini saqlaymiz (w-*, h-*, rounded-*)
  // object-contain olib tashlangan, lekin size klaslari qoladi
  return `<div class="${cls} transition-transform group-hover:scale-110 flex items-center justify-center flex-shrink-0"
    style="background:linear-gradient(135deg,${c1},${c2});border-radius:inherit;overflow:hidden;">
    <svg viewBox="0 0 64 64" style="width:72%;height:72%;min-width:0;min-height:0;" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="18" fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="2.4"/>
      <line x1="14" y1="32" x2="50" y2="32" stroke="rgba(255,255,255,0.75)" stroke-width="1.8"/>
      <line x1="32" y1="14" x2="32" y2="50" stroke="rgba(255,255,255,0.75)" stroke-width="1.8"/>
      <path d="M32 14 Q20 32 32 50" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1.8"/>
      <path d="M32 14 Q44 32 32 50" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="1.8"/>
    </svg>
  </div>`;
}

function iconHTML(item, cls="w-10 h-10 object-contain drop-shadow-sm") {
const domain = getDomain(item.u);

const palettes = [
  ['#6366f1','#8b5cf6'],['#ec4899','#f97316'],['#06b6d4','#6366f1'],
  ['#10b981','#06b6d4'],['#f59e0b','#ef4444'],['#8b5cf6','#ec4899'],
  ['#14b8a6','#3b82f6'],['#f97316','#fbbf24'],['#d946ef','#6366f1'],
  ['#ef4444','#f97316'],['#84cc16','#10b981'],['#a855f7','#ec4899'],
  ['#0ea5e9','#06b6d4'],['#f43f5e','#fb7185'],['#7c3aed','#4f46e5'],
  ['#059669','#84cc16'],['#ea580c','#f59e0b'],['#be185d','#9333ea'],
  ['#0284c7','#0ea5e9'],['#16a34a','#15803d'],['#dc2626','#b91c1c'],
  ['#7c3aed','#c026d3'],['#0891b2','#0e7490'],['#ca8a04','#b45309']
];
let hash = 0;
for(let i=0;i<item.n.length;i++) hash = item.n.charCodeAt(i)+((hash<<5)-hash);
const [c1,c2] = palettes[Math.abs(hash) % palettes.length];

const customLogo = item.logoUrl || item.logo_url || '';

/* Real domain: kamida bitta nuqta bo'lishi kerak (masalan google.com, uzb.uz).
   'sad', 'as', 'localhost' kabi TLD'siz domenlar uchun ham gradient globe. */
const hasRealDomain = domain && domain.includes('.');
if (!hasRealDomain && !customLogo) {
  return _gradientGlobeDiv(c1, c2, cls.replace('object-contain',''));
}

const svgData = _globeSVG(c1, c2);
const faviconSrc = customLogo || `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

return `<img src="${svgData}" data-src="${faviconSrc}" alt="${item.n}" loading="lazy"
  class="${cls} transition-transform group-hover:scale-110 lz-img"
  data-domain="${domain}"
  data-svg="${svgData}"
  data-step="${customLogo ? '2' : '1'}"
  onload="window._logoLoaded(this)"
  onerror="window._logoFail(this)">`;
}



function getClicks(name){
return globalClicks[name] || 0;
}

/* Klik qayd qilish — 2 soatda 1 marta (har foydalanuvchi, har resurs uchun) */
const CLICK_THROTTLE_MS = 2 * 60 * 60 * 1000; // 2 soat
function _canClick(name){
  const key = 'lh_ct_' + name.replace(/[^a-zA-Z0-9]/g,'_');
  const last = parseInt(localStorage.getItem(key)||'0',10);
  return Date.now() - last > CLICK_THROTTLE_MS;
}
function _markClicked(name){
  const key = 'lh_ct_' + name.replace(/[^a-zA-Z0-9]/g,'_');
  localStorage.setItem(key, String(Date.now()));
}

function addClick(name){
/* 2 soat o'tmagan bo'lsa faqat recentlyVisited ga qo'shamiz, click hisoblamaymiz */
const doCount = _canClick(name);
if(doCount){
  _markClicked(name);
  globalClicks[name] = (globalClicks[name]||0) + 1;
  _saveClicksCache(); // darhol localStorage ga saqlaymiz
  _updateCountEl(name, globalClicks[name]);
  renderTrending();
  updateSidebarStats();
  _supaIncrement(name).then(serverVal => {
    if(serverVal !== null && serverVal !== globalClicks[name]){
      globalClicks[name] = serverVal;
      _saveClicksCache(); // server qiymati kelganda ham saqlaymiz
      _updateCountEl(name, serverVal);
      updateSidebarStats();
    }
  });
}

let foundItem = null;
DATA.forEach(c=>c.items.forEach(i=>{ if(i.n===name) foundItem=i; }));
if(foundItem){
  recentlyVisited = [foundItem, ...recentlyVisited.filter(i=>i.n!==name)].slice(0,8);
  localStorage.setItem('lh_recent', JSON.stringify(recentlyVisited));
  renderRecent();
}
}


function renderTrending() {
  const sec = $('trendingSection'), grid = $('trendingGrid');
  if (query && query.trim()) { sec.classList.add('hidden'); return; }
  const all = [];
  DATA.forEach(c => {
    if (c.id !== 'my_apps') c.items.forEach(i => { if (getClicks(i.n) > 0) all.push({ ...i, _cat: c }); });
  });
  all.sort((a, b) => getClicks(b.n) - getClicks(a.n));
  const top = all.slice(0, 7);
  if (!top.length) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');
  grid.innerHTML = top.map((item, idx) => {
    const esc    = item.n.replace(/'/g, "\\'");
    const escUrl = item.u.replace(/'/g, "\\'");
    const isMob  = item.t?.includes('mobil');
    const hasWeb = item.t?.includes('web');
    const clickAct = (isMob || item.androidUrl)
      ? `openPlatformModal('${esc}','${escUrl}',${hasWeb},true)`
      : `addClick('${esc}');setTimeout(()=>rerenderClickFor('${esc}'),50);window.open('${escUrl}','_blank','noopener,noreferrer')`;
    const rankCls = idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-orange-500' : 'text-violet-400';
    return `
      <div onclick="${clickAct}" class="trend-card group">
        <span class="text-[9px] font-black ${rankCls} w-5 text-center">#${idx + 1}</span>
        <div class="shrink-0">${iconHTML(item, 'w-7 h-7 rounded-lg shadow-sm object-contain')}</div>
        <span class="text-[11px] font-bold text-slate-800 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">${item.n}</span>
        <span class="flex items-center gap-0.5 text-[10px] font-black text-orange-500"><i class="fa-solid fa-fire text-[8px]"></i>${getClicks(item.n)}</span>
      </div>`;
  }).join('');
  if (_imgObserver) grid.querySelectorAll('.lz-img').forEach(img => _imgObserver.observe(img));
}

function hl(s,q){
if(!q||!s) return s||'';
const rx=new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
return s.replace(rx,'<mark>$1</mark>');
}

function matchItem(item, cat){
const q2=query.toLowerCase().trim();
const textOk=!q2||item.n.toLowerCase().includes(q2)||(item.d||'').toLowerCase().includes(q2)||(cat?.title||'').toLowerCase().includes(q2);
const tagOk=!filters.length||filters.every(f=>item.t&&item.t.includes(f));
return textOk&&tagOk;
}
function sortItems(arr){
if(sortMode==='az') return [...arr].sort((a,b)=>a.n.localeCompare(b.n));
if(sortMode==='za') return [...arr].sort((a,b)=>b.n.localeCompare(a.n));
if(sortMode==='popular') return [...arr].sort((a,b)=>getClicks(b.n)-getClicks(a.n));
return arr;
}


function card(item){
const isFav      = favorites.includes(item.n);
const isBepul    = item.t?.includes('bepul');
const isPullik   = item.t?.includes('pullik');
const isMob      = item.t?.includes('mobil');
const hasWeb     = item.t?.includes('web') || item.isCustom ||
  (item.u && !item.u.includes('play.google.com') && !item.u.includes('apps.apple.com') && !item.u.includes('appgallery.huawei'));
const isCustom   = item.isCustom;
const isVerified = !!item.v;
const q2         = query.trim();
const c          = getClicks(item.n);
const isHot      = !!item._isTop;
const esc        = item.n.replace(/'/g,"\\'");
const escUrl     = item.u.replace(/'/g,"\\'");
const safeName   = isCustom ? escHtml(item.n) : item.n;
const safeDesc   = isCustom ? escHtml(item.d||'') : (item.d||'');

const mainClick = isCustom
  ? `window.open('${escUrl}','_blank','noopener,noreferrer')`
  : (isMob || item.androidUrl)
    ? `openPlatformModal('${esc}','${escUrl}',${hasWeb},${!!(isMob||item.androidUrl)})`
    : `addClick('${esc}');setTimeout(()=>rerenderClickFor('${esc}'),50);window.open('${escUrl}','_blank','noopener,noreferrer')`;

const badges = [
  isBepul  ? `<span class="badge-bepul">✓ Bepul</span>` : '',
  isPullik ? `<span class="badge-pullik">💎 Pullik</span>` : '',
  isCustom ? `<span class="badge-custom">Shaxsiy</span>` : '',
  hasWeb && isMob ? `<span class="badge-web" title="Veb-sayt"><i class="fa-solid fa-globe text-[9px]"></i></span>` : '',
  isMob    ? `<span class="badge-mob" title="Mobil ilova"><i class="fa-solid fa-mobile-screen-button text-[9px]"></i></span>` : '',
].filter(Boolean).join('');

return `
<div onclick="${mainClick}" class="card glass rounded-2xl p-4 flex flex-col h-full group relative cursor-pointer">
  ${isHot ? `<div class="ribbon-top" aria-label="Top"><i class="fa-solid fa-fire text-[8px] mr-0.5"></i>Top</div>` : ''}

  <!-- TOP RIGHT: fav + drag handle for custom -->
  <div class="absolute top-3 right-3 flex items-center gap-1.5 z-20">
    ${isCustom ? `
    <div class="drag-handle opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" title="Tartibni o'zgartirish">
      <i class="fa-solid fa-grip-dots-vertical text-[9px]"></i>
    </div>` : ''}
    <button onclick="event.stopPropagation();toggleFav('${esc}',this)"
        class="fav-btn w-7 h-7 rounded-full flex items-center justify-center text-[11px] shadow-sm backdrop-blur-sm transition-colors ${isFav?'bg-rose-100 text-rose-500 dark:bg-rose-500/20':isCustom?'bg-transparent text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10':'bg-white/80 dark:bg-slate-800/80 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'}">
        <i class="fa-${isFav?'solid':'regular'} fa-heart"></i>
    </button>
  </div>

  <!-- LOGO + NAME + BADGES -->
  <div class="flex items-start gap-3 mb-2.5 relative z-10 pr-9">
    <div class="shrink-0">
      <div class="card-logo-wrap">
        ${iconHTML(item, 'w-11 h-11 object-contain')}
      </div>
    </div>
    <div class="flex-1 min-w-0 pt-0.5">
      <div class="font-black text-[14px] text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors leading-snug flex items-center gap-1.5">
        <span class="truncate">${hl(safeName,q2)}</span>
        ${isVerified ? `<span class="verified-icon" title="Rasmiy va ishonchli platforma"><i class="fa-solid fa-shield-halved"></i></span>` : ''}
      </div>
      <div class="flex flex-wrap gap-1 mt-1.5 items-center">${badges}</div>
    </div>
  </div>

  <!-- DESCRIPTION -->
  <p class="text-[11.5px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed ${isCustom?'':'flex-1'} relative z-10">${hl(safeDesc,q2)}</p>

  <!-- CARD FOOTER -->
  <div class="flex items-center justify-between ${isCustom?'mt-1.5 pt-1.5':'mt-2.5 pt-2'} border-t border-slate-100/80 dark:border-slate-800/50 relative z-10">
    ${isCustom ? `
    <!-- Shaxsiy: o'ng pastda hover ikonkalar -->
    <div class="flex-1"></div>
    <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onclick="event.stopPropagation();openEditModal('${esc}')" title="Tahrirlash"
          class="card-action-btn text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10">
          <i class="fa-solid fa-pen text-[11px]"></i>
      </button>
      <button onclick="event.stopPropagation();deleteCustomApp('${esc}')" title="O'chirish"
          class="card-action-btn text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
          <i class="fa-solid fa-trash text-[11px]"></i>
      </button>
    </div>
    ` : `
    <!-- Oddiy: Ko'rishlar + Report + Share -->
    <div class="flex items-center gap-1 text-[10px] font-bold rounded-full px-1.5 py-0.5
      ${c ? 'text-violet-500 dark:text-violet-400' : 'text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity'}"
      id="cb-${item.n.replace(/[^a-zA-Z0-9]/g,'_')}">
      <i class="fa-regular fa-eye text-[9px]"></i>
      <span>${c||0}</span>
    </div>
    <div class="flex items-center gap-1.5">
      <button onclick="event.stopPropagation();openReportModal('${esc}','${escUrl}')"
          title="Muammo bildirish"
          class="card-action-btn text-slate-400 dark:text-slate-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10">
          <i class="fa-solid fa-triangle-exclamation text-sm"></i>
      </button>
      <button onclick="event.stopPropagation();shareCard('${esc}','${escUrl}')"
          title="Ulashish"
          class="card-action-btn text-slate-400 dark:text-slate-500 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10">
          <i class="fa-solid fa-share-nodes text-sm"></i>
      </button>
    </div>
    `}
  </div>

</div>`;
}

window.rerenderClickFor = function(name){
const id='cb-'+name.replace(/[^a-zA-Z0-9]/g,'_');
const el=document.getElementById(id);
if(!el) return;
const c=getClicks(name);
el.innerHTML = `<i class="fa-regular fa-eye text-[9px]"></i><span>${c}</span>`;
el.classList.remove('text-slate-300','dark:text-slate-600','opacity-0','group-hover:opacity-100','transition-opacity');
el.classList.add('text-violet-500','dark:text-violet-400','do-pop');
setTimeout(()=>el.classList.remove('do-pop'),200);
renderTrending();
};

window.toggleFav = function(name, btn, silent){
  if(!name) return;
  var wasIn = favorites.includes(name);
  favorites = wasIn ? favorites.filter(function(n){ return n !== name; }) : favorites.concat([name]);
  localStorage.setItem('lh_favs', JSON.stringify(favorites));
  saveUserDataToSupabase();
  var on = favorites.includes(name);
  if(!silent && on) showToast("Saqlanganlarga qo'shildi!", 'fa-heart text-rose-400');
  // Bosilgan tugmani yangilaymiz
  if(btn){
    var isCv = btn.classList.contains('cv-fav-btn');
    var sz = btn.classList.contains('w-6') ? 'w-6 h-6' : 'w-7 h-7';
    btn.className = (isCv ? 'cv-fav-btn ' : '') + 'fav-btn ' + sz + ' rounded-full flex items-center justify-center shrink-0 text-[11px] transition-colors ' + (on ? 'bg-rose-100 text-rose-500 dark:bg-rose-500/20' : 'text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10');
    btn.innerHTML = '<i class="fa-' + (on ? 'solid' : 'regular') + ' fa-heart"></i>';
  }
  renderNav();
  if(activeCat === 'favorites') renderContent();
};

function renderNav(){
const total=DATA.reduce((a,c)=> c.id !== 'my_apps' ? a+c.items.length : a,0);
$('sidebarCount').textContent=`${total} ta resurs`;

const mobCnt = $('mobResCount');
if(mobCnt) mobCnt.textContent = total + ' ta resurs';


const navBtn = (onclick, title, icon, label, count, extraClass='', countClass='') => {
  return `<button onclick="${onclick}" title="${title}"
    class="sb-nav-item ${extraClass} w-full flex items-center justify-between px-3 py-1 rounded-xl transition-all text-sm group">
    <div class="flex items-center gap-2.5 min-w-0 overflow-hidden">
      <i class="fa-solid ${icon} w-4 text-center text-xs opacity-55 group-hover:opacity-100 transition-opacity shrink-0"></i>
      <span class="truncate text-left">${label}</span>
    </div>
    ${count ? `<span class="text-[9px] px-1.5 py-0.5 rounded-full ${countClass} shrink-0 font-bold">${count}</span>` : ''}
  </button>`;
};


const myActive = activeCat==='my_apps';
const myCountCls = myActive ? 'bg-violet-200 dark:bg-violet-500/30 text-violet-600 dark:text-violet-300' : 'bg-slate-200 dark:bg-slate-700/80 text-slate-500';
const myExtraCls = myActive ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50';
const pinned = navBtn(`setCat('my_apps')`, "Shaxsiy ro'yxat", 'fa-folder-open',
  "Shaxsiy ro'yxat", customApps.length||'', myExtraCls, myCountCls);


  const favActive = activeCat==='favorites';
const favCountCls = favActive ? 'bg-rose-200 dark:bg-rose-500/30 text-rose-600' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-500';
const favExtraCls = favActive ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50';
const favPinned = navBtn(`setCat('favorites')`, 'Saqlanganlar', 'fa-heart', 'Saqlanganlar',
  favorites.length||'', favExtraCls, favCountCls);

const collActive = activeCat==='collections';
const collExtraCls = collActive ? 'bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50';
const collBtn = navBtn(`setCat('collections')`, 'Kolleksiyalar', 'fa-rectangle-list', 'Kolleksiyalar',
  getCollections().length||'', collExtraCls, collActive?'bg-violet-200 dark:bg-violet-500/30 text-violet-600':'bg-slate-200 dark:bg-slate-700/80 text-slate-500');
$('sidebarPinned').innerHTML = pinned + favPinned + collBtn +
  `<div class="h-px w-full bg-slate-100 dark:bg-slate-800/80 mt-1.5 mb-0.5"></div>`;


  const allActive = activeCat==='all';

let s = navBtn(`setCat('all')`, 'Barchasi', 'fa-border-all', 'Barchasi', total,
  allActive ? 'nav-active' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50',
  allActive ? 'bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-200' : 'bg-slate-200 dark:bg-slate-700/80 text-slate-500');

DATA.forEach(c=>{
  if(c.id==='my_apps') return;
  const cnt = c.items.filter(i=>matchItem(i,c)).length;
  const isAct = activeCat===c.id;
  s += navBtn(`setCat('${c.id}')`, c.title, c.icon, c.title, cnt,
    isAct ? 'nav-active' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50',
    isAct ? 'bg-violet-200 dark:bg-violet-500/25 text-violet-600 dark:text-violet-300' : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400');
});

$('sidebarNav').innerHTML = s;


let m=`
  <button onclick="openCustomModal()" class="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/20 transition-all active:scale-95"><i class="fa-solid fa-plus"></i></button>
  <button onclick="setCat('my_apps')" class="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${activeCat==='my_apps'?'pill-active':'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">🛠️ Shaxsiy${customApps.length?` <span class="text-[9px] bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 px-1 rounded-full font-black">${customApps.length}</span>`:''}</button>
  <button onclick="setCat('favorites')" class="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${favActive?'bg-rose-500 text-white border-transparent shadow-lg shadow-rose-500/30':'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">
    <i class="fa-solid fa-heart"></i>${favorites.length?` <span class="text-[9px] ${favActive?'bg-white/25':'bg-rose-100 text-rose-500'} px-1 rounded-full font-black">${favorites.length}</span>`:''}
  </button>
  <button onclick="setCat('all')" class="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${allActive?'pill-active':'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">Barchasi <span class="text-[9px] ${allActive?'bg-white/25 text-white':'bg-slate-100 dark:bg-slate-700 text-slate-400'} px-1.5 rounded-full font-black">${total}</span></button>`;
DATA.forEach(c=>{
  if (c.id === 'my_apps') return;
  const cnt = c.items.filter(i=>matchItem(i,c)).length;
  const isAct = activeCat===c.id;
  m+=`<button onclick="setCat('${c.id}')" class="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all whitespace-nowrap ${isAct?'pill-active':'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">${c.title} <span class="text-[9px] ${isAct?'bg-white/25 text-white':'bg-slate-100 dark:bg-slate-700 text-slate-400'} px-1.5 rounded-full font-black">${cnt}</span></button>`;
});

$('mobNav').innerHTML=m;
renderChips(); renderActiveBadges();
}

function renderChips(){
const colorMap = {
  emerald:['bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400',
            'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/25'],
  amber:  ['bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400',
            'bg-amber-500 border-amber-500 text-white shadow-amber-500/25'],
  sky:    ['bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-400',
            'bg-sky-500 border-sky-500 text-white shadow-sky-500/25'],
  blue:   ['bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400',
            'bg-blue-500 border-blue-500 text-white shadow-blue-500/25'],
  green:  ['bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-400',
            'bg-green-500 border-green-500 text-white shadow-green-500/25'],
  violet: ['bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-500/10 dark:border-violet-500/30 dark:text-violet-400',
            'bg-violet-500 border-violet-500 text-white shadow-violet-500/25'],
};
const h=FILTERS.map(f=>{
  const on = filters.includes(f.id);
  const [offCls, onCls] = colorMap[f.color] || colorMap.violet;
  return `
  <button onclick="toggleFilter('${f.id}')" class="filter-chip inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all ${on ? onCls+' shadow-md' : offCls}">
    <i class="${f.icon} text-[10px]"></i>
    <span>${f.label}</span>
    ${on ? '<i class="fa-solid fa-xmark text-[9px] opacity-80 ml-0.5"></i>' : ''}
  </button>`;
}).join('');
$('deskChips').innerHTML=h; $('mobChips').innerHTML=h;
const hasFilter=filters.length>0||sortMode!=='def';
$('clrFilters').style.opacity=hasFilter?'1':'0';
$('clrFilters').style.pointerEvents=hasFilter?'auto':'none';
}

function renderActiveBadges(){
const b=filters.map(f=>{
  const fo=FILTERS.find(x=>x.id===f);
  return `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
    ${fo?.label||f} <button onclick="toggleFilter('${f}')" class="hover:text-red-500 ml-0.5 leading-none">×</button>
  </span>`;
}).join('');
$('activeBadges').innerHTML=b;
}

window.toggleFilter=function(id){
filters=filters.includes(id)?filters.filter(x=>x!==id):[...filters,id];
renderNav(); renderContent();
};
window.clearAll=function(){
filters=[];sortMode='def';
if($('sSort')) $('sSort').value='def';
if($('topSort')) $('topSort').value='def';
renderNav(); renderContent();
};

window.setCat=function(id){
activeCat=id; query='';
$('deskSrc').value=$('mobSrc').value='';
if($('catSrc')) $('catSrc').value='';
$('deskClr').classList.add('opacity-0', 'pointer-events-none');
$('mobClr').classList.add('opacity-0', 'pointer-events-none');
const catClr=$('catClr');
if(catClr){catClr.classList.add('opacity-0','pointer-events-none');}
hideDrop();


const catWrap=$('catSWrap');
const isSpecificCat = id!=='all' && id!=='favorites' && id!=='my_apps' && id!=='collections';

if(catWrap){
  if(isSpecificCat){
    catWrap.classList.remove('hidden');
    catWrap.style.display = 'flex';
  } else {
    catWrap.classList.add('hidden');
  }
}

if(id==='all'){
  $('pageTitle').textContent='Barcha Resurslar';
} else if(id==='favorites'){
  $('pageTitle').textContent='Saqlanganlar';
} else if(id==='my_apps'){
  $('pageTitle').textContent="Shaxsiy ro'yxat";
} else if(id==='collections'){
  $('pageTitle').textContent='Kolleksiyalar';
} else {
  const catTitle=DATA.find(c=>c.id===id)?.title||'';
  $('pageTitle').textContent=catTitle;
  if($('catSrc')) $('catSrc').placeholder=`${catTitle} ichida qidirish...`;
}
renderNav(); renderContent();
$('mainScroll').scrollTo({top:0,behavior:'smooth'});
};



function skeletonCard(){
  return `<div class="skel-card glass rounded-2xl p-4 flex flex-col h-full">
    <div class="flex items-start gap-3 mb-3">
      <div class="skel-box w-11 h-11 rounded-2xl shrink-0"></div>
      <div class="flex-1 pt-1 space-y-2">
        <div class="skel-box h-3.5 w-3/4 rounded-lg"></div>
        <div class="skel-box h-2.5 w-1/3 rounded-lg"></div>
      </div>
    </div>
    <div class="space-y-1.5 flex-1">
      <div class="skel-box h-2.5 w-full rounded-lg"></div>
      <div class="skel-box h-2.5 w-5/6 rounded-lg"></div>
    </div>
    <div class="mt-3 pt-2 border-t border-slate-100/80 dark:border-slate-800/50 flex justify-between">
      <div class="skel-box h-2.5 w-8 rounded-lg"></div>
      <div class="flex gap-1.5">
        <div class="skel-box w-7 h-7 rounded-xl"></div>
        <div class="skel-box w-7 h-7 rounded-xl"></div>
      </div>
    </div>
  </div>`;
}


let _renderToken = 0;

let _imgObserver = null;


/* ═══════════════════════════════════════════════════════════
   KOLLEKSIYALAR TIZIMI — v2
   ═══════════════════════════════════════════════════════════ */
const DEFAULT_COLLECTIONS = [
  // ── TA'LIM ──────────────────────────────────────────────────────
  {
    id:'c_school_student', faIcon:'fa-school', title:"Maktab o'quvchisi", emoji:'🏫',
    group:'ta\'lim', groupIcon:'fa-graduation-cap',
    color:'from-emerald-500 to-green-600',
    desc:"5–11 sinf o'quvchilari uchun eng foydali o'quv resurslari",
    items:['Khan Academy','Photomath','Duolingo','Brainly','Quizlet','YouTube','Canva','Google Classroom','Slovosite.uz','EduPage','Engli.uz','Zoom']
  },
  {
    id:'c_teacher', faIcon:'fa-chalkboard-teacher', title:"O'qituvchi vositalari", emoji:'👩‍🏫',
    group:'ta\'lim', groupIcon:'fa-graduation-cap',
    color:'from-teal-500 to-cyan-600',
    desc:"Dars tayyorlash, baholash va sinf boshqaruvi uchun",
    items:['Google Classroom','Google Forms','Canva','Quizlet','Zoom','Microsoft Teams','Kahoot!','Miro','Notion','YouTube','EduPage','ChatGPT']
  },
  {
    id:'c_professor', faIcon:'fa-user-tie', title:"Professor-o'qituvchi", emoji:'🎓',
    group:'ta\'lim', groupIcon:'fa-graduation-cap',
    color:'from-indigo-600 to-violet-700',
    desc:"Ilmiy tadqiqot, nashr va ma'ruza tayyorlash uchun",
    items:['Google Scholar','Mendeley','Overleaf','Grammarly','Zoom','Microsoft Teams','Notion','ResearchGate','Turnitin','Miro','ChatGPT','Wolfram Alpha']
  },
  {
    id:'c_student', faIcon:'fa-book-open', title:"Talaba (oliy ta'lim)", emoji:'📚',
    group:'ta\'lim', groupIcon:'fa-graduation-cap',
    color:'from-blue-500 to-indigo-600',
    desc:"OTM talabasi uchun o'qish, yozish va loyiha ishlash",
    items:['HEMIS','Notion','Google Docs','Google Drive','Grammarly','DeepL','Coursera','Khan Academy','Quizlet','YouTube','Wolfram Alpha','Overleaf']
  },
  {
    id:'c_abitur', faIcon:'fa-graduation-cap', title:"Abituriyent to'plami", emoji:'🎯',
    group:'ta\'lim', groupIcon:'fa-graduation-cap',
    color:'from-lime-500 to-emerald-600',
    desc:"DTM va universitetga kirish uchun tayyorlov resurslari",
    items:['My.gov.uz','HEMIS','Khan Academy','Duolingo','Photomath','Brainly','Google Classroom','Quizlet','Engli.uz','YouTube']
  },
  // ── IT & DASTURLASH ─────────────────────────────────────────────
  {
    id:'c_frontend', faIcon:'fa-code', title:"Frontend dasturchi", emoji:'💻',
    group:'it', groupIcon:'fa-laptop-code',
    color:'from-violet-500 to-purple-600',
    desc:"Zamonaviy frontend dasturlash uchun eng kerakli vositalar",
    items:['Visual Studio Code','GitHub','Figma','Vercel','Netlify','Stack Overflow','CodePen','MDN Web Docs','Tailwind CSS','Chrome DevTools','Postman','npm']
  },
  {
    id:'c_backend', faIcon:'fa-server', title:"Backend dasturchi", emoji:'⚙️',
    group:'it', groupIcon:'fa-laptop-code',
    color:'from-slate-600 to-zinc-700',
    desc:"Server, API va infratuzilma uchun kerakli vositalar",
    items:['GitHub','Supabase','Vercel','Railway','Postman','Docker','Linux','MongoDB','PostgreSQL','Redis','Nginx','AWS']
  },
  {
    id:'c_ai_start', faIcon:'fa-robot', title:"AI boshlang'ich", emoji:'🤖',
    group:'it', groupIcon:'fa-laptop-code',
    color:'from-sky-500 to-blue-600',
    desc:"AI vositalarini birinchi marta ishlatuvchilar uchun",
    items:['ChatGPT','Gemini','Microsoft Copilot','Claude','Perplexity AI','Midjourney','Canva','Grammarly','DeepL','Notion']
  },
  // ── IJOD & DIZAYN ───────────────────────────────────────────────
  {
    id:'c_designer', faIcon:'fa-palette', title:"Dizayner vositalari", emoji:'🎨',
    group:'ijod', groupIcon:'fa-paintbrush',
    color:'from-pink-500 to-rose-500',
    desc:"Professional dizaynerlar uchun eng foydali vositalar",
    items:['Figma','Adobe Photoshop','Canva','Dribbble','Behance','Unsplash','Adobe Color','Coolors','Google Fonts','Framer','Blender','Spline']
  },
  // ── ISH & BIZNES ────────────────────────────────────────────────
  {
    id:'c_freelance', faIcon:'fa-briefcase', title:"O'zbek frilanser", emoji:'🚀',
    group:'biznes', groupIcon:'fa-chart-line',
    color:'from-orange-500 to-amber-500',
    desc:"Masofadan ishlash va daromad topish uchun kerakli platformalar",
    items:['Upwork','Freelancer.com','Fiverr','Toptal','Payoneer','Wise','Trello','Slack','Zoom','Notion','HH.uz','LinkedIn']
  },
  // ── KUNDALIK ────────────────────────────────────────────────────
  {
    id:'c_uzb_daily', faIcon:'fa-flag', title:"O'zbek kundalik", emoji:'🇺🇿',
    group:'kundalik', groupIcon:'fa-sun',
    color:'from-blue-500 to-cyan-500',
    desc:"O'zbekistonda kundalik hayotda eng ko'p ishlatiladigan xizmatlar",
    items:['Payme','Click','MyGov.uz','Telegram','YouTube','Instagram','Uzum Market','OLX.uz','HH.uz','2GIS','Express24','Yandex Maps']
  },
];

let userCollections = safeParse('lh_collections', []);

function getCollections(){ return [...DEFAULT_COLLECTIONS, ...userCollections]; }
function saveUserCollections(){ localStorage.setItem('lh_collections', JSON.stringify(userCollections)); }

function _colAccentColor(color){
  if(color.includes('violet')||color.includes('purple')) return {text:'text-violet-600 dark:text-violet-400', bg:'bg-violet-50 dark:bg-violet-500/10', border:'border-violet-200 dark:border-violet-500/30'};
  if(color.includes('emerald')||color.includes('teal'))  return {text:'text-emerald-600 dark:text-emerald-400', bg:'bg-emerald-50 dark:bg-emerald-500/10', border:'border-emerald-200 dark:border-emerald-500/30'};
  if(color.includes('sky')||color.includes('blue')||color.includes('cyan')) return {text:'text-sky-600 dark:text-sky-400', bg:'bg-sky-50 dark:bg-sky-500/10', border:'border-sky-200 dark:border-sky-500/30'};
  if(color.includes('orange')||color.includes('amber'))  return {text:'text-orange-600 dark:text-orange-400', bg:'bg-orange-50 dark:bg-orange-500/10', border:'border-orange-200 dark:border-orange-500/30'};
  if(color.includes('pink')||color.includes('rose'))     return {text:'text-pink-600 dark:text-pink-400', bg:'bg-pink-50 dark:bg-pink-500/10', border:'border-pink-200 dark:border-pink-500/30'};
  if(color.includes('indigo'))                           return {text:'text-indigo-600 dark:text-indigo-400', bg:'bg-indigo-50 dark:bg-indigo-500/10', border:'border-indigo-200 dark:border-indigo-500/30'};
  return {text:'text-slate-600 dark:text-slate-400', bg:'bg-slate-50 dark:bg-slate-800', border:'border-slate-200 dark:border-slate-600'};
}

function _getColItems(col){
  const found=[];
  DATA.forEach(cat=>{ if(cat.id==='my_apps') return; cat.items.forEach(i=>{ if(col.items.includes(i.n)) found.push({...i,_cat:cat}); }); });
  return found;
}

/* ── RENDER COLLECTIONS PAGE ── */
function _renderCollections(container, token){
  const skelEl=document.getElementById('_skelGrid');
  if(skelEl) skelEl.remove();
  $('appsContainer').classList.remove('hidden');
  $('noResults').classList.add('hidden');
  const collections=getCollections();
  $('resultCount').textContent=collections.length+' ta kolleksiya';

  const wrap=document.createElement('div');
  wrap.className='animate-fade-up';

  wrap.innerHTML=`
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
      <div class="relative flex-1 w-full">
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
        <input id="colSearch" placeholder="Kolleksiya qidirish..." oninput="filterCollections(this.value)"
          class="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-400 placeholder-slate-400">
      </div>
      <button onclick="openNewCollectionModal()"
        class="shrink-0 flex items-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 text-white font-bold rounded-xl px-4 py-2.5 text-[12px] transition-all shadow-lg shadow-violet-500/25 active:scale-[0.98] whitespace-nowrap">
        <i class="fa-solid fa-plus text-[10px]"></i> Yangi kolleksiya
      </button>
    </div>
    <div id="collectionsGrid"></div>`;

  container.appendChild(wrap);
  _fillCollectionGrid(collections);
}

window.filterCollections = function(q){
  const all=getCollections();
  const filtered=q.trim()?all.filter(c=>c.title.toLowerCase().includes(q.toLowerCase())||c.desc.toLowerCase().includes(q.toLowerCase())):all;
  _fillCollectionGrid(filtered);
};

const GROUP_META = {
  "ta'lim":  { label:"Ta'lim",         icon:'fa-graduation-cap', color:'text-emerald-600 dark:text-emerald-400', bg:'bg-emerald-50 dark:bg-emerald-500/10', border:'border-emerald-200 dark:border-emerald-500/20' },
  'it':      { label:'IT & Dasturlash', icon:'fa-laptop-code',    color:'text-violet-600 dark:text-violet-400',   bg:'bg-violet-50 dark:bg-violet-500/10',   border:'border-violet-200 dark:border-violet-500/20' },
  'ijod':    { label:'Ijod & Dizayn',   icon:'fa-paintbrush',     color:'text-pink-600 dark:text-pink-400',       bg:'bg-pink-50 dark:bg-pink-500/10',       border:'border-pink-200 dark:border-pink-500/20' },
  'biznes':  { label:'Ish & Biznes',    icon:'fa-chart-line',     color:'text-orange-600 dark:text-orange-400',   bg:'bg-orange-50 dark:bg-orange-500/10',   border:'border-orange-200 dark:border-orange-500/20' },
  'kundalik':{ label:'Kundalik hayot',  icon:'fa-sun',            color:'text-sky-600 dark:text-sky-400',         bg:'bg-sky-50 dark:bg-sky-500/10',         border:'border-sky-200 dark:border-sky-500/20' },
  'my':      { label:'Mening kolleksiyalarim', icon:'fa-folder-heart', color:'text-fuchsia-600 dark:text-fuchsia-400', bg:'bg-fuchsia-50 dark:bg-fuchsia-500/10', border:'border-fuchsia-200 dark:border-fuchsia-500/20' },
};

function _fillCollectionGrid(collections){
  const grid=document.getElementById('collectionsGrid');
  if(!grid) return;
  grid.innerHTML='';

  if(collections.length===0){
    grid.innerHTML=`<div class="flex flex-col items-center py-16 text-center">
      <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
        <i class="fa-solid fa-folder-open text-3xl text-slate-300 dark:text-slate-600"></i>
      </div>
      <p class="text-sm font-bold text-slate-400">Hech narsa topilmadi</p>
    </div>`;
    return;
  }

  // Group by: default collections have .group, user collections => 'my'
  const grouped = {};
  const ORDER = ["ta'lim",'it','ijod','biznes','kundalik','my'];
  collections.forEach(col=>{
    const g = col.id.startsWith('uc_') ? 'my' : (col.group||'other');
    if(!grouped[g]) grouped[g]=[];
    grouped[g].push(col);
  });

  // Render each group
  ORDER.concat(Object.keys(grouped).filter(k=>!ORDER.includes(k))).forEach(gKey=>{
    const cols = grouped[gKey];
    if(!cols||!cols.length) return;
    const meta = GROUP_META[gKey] || { label:gKey, icon:'fa-layer-group', color:'text-slate-500', bg:'bg-slate-50 dark:bg-slate-800', border:'border-slate-200' };

    // Group header
    const section = document.createElement('div');
    section.className='mb-4';
    section.innerHTML=`
      <div class="flex items-center gap-2.5 mb-3">
        <div class="flex items-center gap-2 ${meta.bg} border ${meta.border} rounded-xl px-3 py-1.5">
          <i class="fa-solid ${meta.icon} ${meta.color} text-[11px]"></i>
          <span class="text-[12px] font-black ${meta.color} tracking-tight">${meta.label}</span>
          <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 ml-0.5">${cols.length}</span>
        </div>
        <div class="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 col-group-grid"></div>`;

    const cardGrid = section.querySelector('.col-group-grid');
    cols.forEach(col=>{
      const isUser=col.id.startsWith('uc_');
      const acc=_colAccentColor(col.color);
      const found=_getColItems(col).length;
      const previewItems=[];
      DATA.forEach(cat=>{ col.items.slice(0,6).forEach(name=>{ const it=cat.items.find(i=>i.n===name); if(it&&!previewItems.find(p=>p.n===name)) previewItems.push(it); }); });
      const previewHtml=previewItems.slice(0,5).map(it=>{
        const dm=getDomain(it.u||'');
        const hasRealDomain=dm&&dm.includes('.');
        const palettes=['#6366f1,#8b5cf6','#ec4899,#f97316','#06b6d4,#6366f1','#10b981,#06b6d4','#f59e0b,#ef4444','#8b5cf6,#ec4899'];
        let hash=0; for(let i=0;i<it.n.length;i++) hash=it.n.charCodeAt(i)+((hash<<5)-hash);
        const [c1,c2]=palettes[Math.abs(hash)%palettes.length].split(',');
        if(hasRealDomain) return `<img src="https://www.google.com/s2/favicons?domain=${dm}&sz=32" class="w-7 h-7 rounded-lg object-contain bg-white dark:bg-slate-700 border-2 border-white dark:border-slate-800 shadow-sm" onerror="this.outerHTML='<div style=\\'background:linear-gradient(135deg,${c1},${c2})\\' class=\\'w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-bold border-2 border-white dark:border-slate-800\\'>${it.n[0]}</div>'" loading="lazy">`;
        return `<div style="background:linear-gradient(135deg,${c1},${c2})" class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-bold border-2 border-white dark:border-slate-800">${it.n[0]}</div>`;
      }).join('');

      const card=document.createElement('div');
      card.className='col-card group cursor-pointer rounded-2xl overflow-hidden border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-800/90 hover:shadow-xl hover:shadow-black/8 dark:hover:shadow-black/30 hover:-translate-y-0.5 transition-all duration-200';
      card.onclick=()=>openCollectionView(col.id);
      card.innerHTML=`
        <div class="bg-gradient-to-br ${col.color} relative overflow-hidden px-4 pt-4 pb-3">
          <div class="absolute inset-0 opacity-20" style="background:radial-gradient(circle at 85% 15%,rgba(255,255,255,0.6),transparent 55%)"></div>
          <div class="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/10"></div>
          <div class="relative z-10 flex items-start justify-between gap-2">
            <div class="w-10 h-10 rounded-xl bg-white/25 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-sm">
              <i class="fa-solid ${col.faIcon||'fa-layer-group'} text-white text-[16px]"></i>
            </div>
            <div class="flex gap-1 shrink-0">
              ${isUser?`
                <button onclick="event.stopPropagation();openEditCollection('${col.id}')" title="Tahrirlash"
                  class="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                  <i class="fa-solid fa-pen text-[9px]"></i>
                </button>
                <button onclick="event.stopPropagation();deleteUserCollection('${col.id}')" title="O'chirish"
                  class="w-7 h-7 rounded-full bg-white/20 hover:bg-red-400/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                  <i class="fa-solid fa-trash text-[9px]"></i>
                </button>`
              :`<span class="text-[9px] font-bold bg-white/25 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">✦ Tavsiya</span>`}
            </div>
          </div>
          <div class="relative z-10 mt-2.5">
            <h4 class="text-[13px] font-black text-white leading-snug">${col.title}</h4>
            <p class="text-[10px] text-white/70 leading-snug mt-0.5 line-clamp-1">${col.desc}</p>
          </div>
        </div>
        <div class="px-4 py-3">
          <div class="flex items-center -space-x-1.5 mb-3">
            ${previewHtml}
            ${found>5?`<div class="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-slate-400 border-2 border-white dark:border-slate-800">+${found-5}</div>`:''}
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold ${acc.text} flex items-center gap-1.5 ${acc.bg} px-2.5 py-1 rounded-full border ${acc.border}">
              <i class="fa-solid fa-layer-group text-[8px]"></i> ${found} ta resurs
            </span>
            <span class="flex items-center gap-1 text-[10px] text-slate-400 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors font-semibold">
              Ochish <i class="fa-solid fa-arrow-right text-[9px] transition-transform group-hover:translate-x-1"></i>
            </span>
          </div>
        </div>`;
      cardGrid.appendChild(card);
    });

    grid.appendChild(section);
  });
}

/* ── COLLECTION VIEW MODAL ── */
window.openCollectionView=function(colId){
  const col=getCollections().find(c=>c.id===colId);
  if(!col) return;
  const items=_getColItems(col);
  const acc=_colAccentColor(col.color);
  const isUser=col.id.startsWith('uc_');

  if(!document.getElementById('collectionViewModal')) _buildCollectionViewModal();
  const m=document.getElementById('collectionViewModal');

  // Header gradient
  document.getElementById('cvGrad').className=`bg-gradient-to-br ${col.color} px-6 py-6 relative overflow-hidden shrink-0`;
  document.getElementById('cvGrad').innerHTML=`
    <div class="absolute inset-0" style="background:radial-gradient(circle at 80% 0%,rgba(255,255,255,0.18),transparent 60%)"></div>
    <div class="absolute -bottom-8 -right-8 w-36 h-36 rounded-full bg-white/8 pointer-events-none"></div>
    <div class="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-white/6 pointer-events-none"></div>
    <div class="relative z-10 flex items-start justify-between gap-3">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-lg">
          <i class="fa-solid ${col.faIcon||'fa-layer-group'} text-white text-2xl"></i>
        </div>
        <div>
          <div class="flex items-center gap-2 mb-1">
            <h3 class="text-[20px] font-black text-white leading-tight">${col.title}</h3>
            ${!isUser?'<span class="text-[9px] font-bold bg-white/25 text-white px-2 py-0.5 rounded-full">✦ Tavsiya</span>':''}
          </div>
          <p class="text-[12px] text-white/75 leading-snug max-w-md">${col.desc}</p>
          <div class="flex items-center gap-3 mt-2.5">
            <span class="flex items-center gap-1.5 text-[11px] font-bold text-white/90 bg-white/20 px-2.5 py-1 rounded-full">
              <i class="fa-solid fa-layer-group text-[9px]"></i> ${items.length} ta resurs
            </span>
            ${isUser?`<button onclick="openAddToCollection('${col.id}')" class="flex items-center gap-1.5 text-[11px] font-bold text-white bg-white/20 hover:bg-white/35 px-2.5 py-1 rounded-full transition-all">
              <i class="fa-solid fa-plus text-[9px]"></i> Resurs qo'shish
            </button>`:''}
            <button onclick="shareCollection('${col.id}')" class="flex items-center gap-1.5 text-[11px] font-bold text-white/80 hover:text-white hover:bg-white/20 px-2.5 py-1 rounded-full transition-all">
              <i class="fa-solid fa-share-nodes text-[9px]"></i> Ulashish
            </button>
          </div>
        </div>
      </div>
      <button onclick="closeCollectionView()" class="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-all shrink-0 mt-0.5">
        <i class="fa-solid fa-xmark text-sm"></i>
      </button>
    </div>`;

  const body=document.getElementById('cvBody');
  body.innerHTML='';

  if(items.length===0){
    body.innerHTML=`<div class="flex flex-col items-center py-16 text-center">
      <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <i class="fa-solid fa-inbox text-3xl text-slate-300 dark:text-slate-600"></i>
      </div>
      <p class="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Hali resurslar yo'q</p>
      <p class="text-xs text-slate-400">${isUser?'Yuqoridagi "+ Resurs qo\'shish" tugmasini bosing':'Resurslar topilmadi'}</p>
    </div>`;
  } else {
    const grid=document.createElement('div');
    grid.className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';
    items.forEach(item=>{
      const dm=getDomain(item.u||'');
      const hasRealDomain=dm&&dm.includes('.');
      const palettes=['#6366f1,#8b5cf6','#ec4899,#f97316','#06b6d4,#6366f1','#10b981,#06b6d4','#f59e0b,#ef4444','#8b5cf6,#ec4899'];
      let hash=0; for(let i=0;i<item.n.length;i++) hash=item.n.charCodeAt(i)+((hash<<5)-hash);
      const [c1,c2]=palettes[Math.abs(hash)%palettes.length].split(',');
      const logoHtml = hasRealDomain
        ? `<img src="https://www.google.com/s2/favicons?domain=${dm}&sz=64" class="w-full h-full object-contain p-1" onerror="this.parentElement.innerHTML='<span class=\\'text-white font-black text-lg\\'>${item.n[0]}</span>';this.parentElement.style='background:linear-gradient(135deg,${c1},${c2})'" loading="lazy">`
        : `<span class="text-white font-black text-lg">${item.n[0]}</span>`;
      const logoWrap = hasRealDomain
        ? `<div class="w-12 h-12 rounded-xl bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">`
        : `<div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style="background:linear-gradient(135deg,${c1},${c2})">`;

      // Badges — asosiy card() dagi kabi
      const cvIsBepul = item.t?.includes('bepul');
      const cvIsPullik= item.t?.includes('pullik');
      const cvIsMob   = item.t?.includes('mobil');
      const cvHasWeb  = item.t?.includes('web') ||
        (item.u && !item.u.includes('play.google.com') && !item.u.includes('apps.apple.com'));
      const isFav = favorites.includes(item.n);
      const clicks = getClicks(item.n);

      const cvBadges = [
        cvIsBepul  ? `<span class="badge-bepul">✓ Bepul</span>` : '',
        cvIsPullik ? `<span class="badge-pullik">💎 Pullik</span>` : '',
        cvHasWeb && cvIsMob ? `<span class="badge-web" title="Veb-sayt"><i class="fa-solid fa-globe text-[9px]"></i></span>` : '',
        cvIsMob    ? `<span class="badge-mob" title="Mobil ilova"><i class="fa-solid fa-mobile-screen-button text-[9px]"></i></span>` : '',
      ].filter(Boolean).join('');

      const wrapper=document.createElement('div');
      wrapper.className='cv-item-card relative group/cvitem bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl p-4 flex items-start gap-3 cursor-pointer hover:shadow-lg hover:border-violet-300 dark:hover:border-violet-600/50 hover:-translate-y-0.5 transition-all duration-150';

      wrapper.innerHTML=`
        ${logoWrap}${logoHtml}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-1 mb-1">
            <h4 class="cv-item-title text-[13px] font-black text-slate-800 dark:text-white leading-snug line-clamp-1 group-hover/cvitem:text-violet-600 dark:group-hover/cvitem:text-violet-400 transition-colors">${item.n}</h4>
            <button onclick="event.stopPropagation();toggleFav(this.dataset.favname,this)"
              data-favname="${item.n.replace(/"/g,'&quot;')}"
              class="cv-fav-btn fav-btn shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[11px] transition-colors ${isFav?'bg-rose-100 text-rose-500 dark:bg-rose-500/20':'text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'}">
              <i class="fa-${isFav?'solid':'regular'} fa-heart"></i>
            </button>
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2 mb-2">${item.d||''}</p>
          <div class="flex items-center justify-between">
            <div class="flex flex-wrap gap-1">${cvBadges}</div>
            <span id="cvcb-${item.n.replace(/[^a-zA-Z0-9]/g,'_')}"
              class="flex items-center gap-1 text-[10px] font-bold rounded-full px-1.5 py-0.5 transition-all ${clicks ? 'text-violet-500 dark:text-violet-400' : 'text-slate-300 dark:text-slate-600 opacity-0'}">
              <i class="fa-regular fa-eye text-[9px]"></i>
              <span>${clicks||0}</span>
            </span>
          </div>
        </div>
        ${item.u?`<a data-href="${item.u}" class="cv-open-btn shrink-0 w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:bg-violet-500 hover:text-white transition-all mt-0.5" title="Ochish">
          <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
        </a>`:''}`;

      // ── Yurakcha va link: delegated listener global darajada ishlaydi ──
      const openBtn = wrapper.querySelector('.cv-open-btn');
      if(openBtn){
        openBtn.addEventListener('click', function(e){
          e.stopPropagation();
          const href = this.dataset.href;
          if(href) window.open(href,'_blank','noopener,noreferrer');
        });
      }

      // ── Wrapper klik: faqat kartani bosganda (yurakcha/link emas) ──
      wrapper.addEventListener('click', function(e){
        if(e.target.closest('.cv-fav-btn') || e.target.closest('.cv-open-btn')) return;
        addClick(item.n);
        setTimeout(()=>{
          const cbEl = document.getElementById('cvcb-'+item.n.replace(/[^a-zA-Z0-9]/g,'_'));
          if(cbEl){
            const c = getClicks(item.n);
            cbEl.querySelector('span').textContent = c;
            cbEl.classList.remove('opacity-0');
            cbEl.classList.add('text-violet-500','dark:text-violet-400');
          }
        }, 50);
        if(item.u) window.open(item.u,'_blank','noopener,noreferrer');
      });

      if(isUser){
        const removeBtn = document.createElement('button');
        removeBtn.className='absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-red-500 text-white text-[9px] items-center justify-center shadow-md z-30 hidden group-hover/cvitem:flex transition-all hover:bg-red-600 hover:scale-110 active:scale-95';
        removeBtn.title="Olib tashlash";
        removeBtn.innerHTML='<i class="fa-solid fa-minus"></i>';
        removeBtn.onclick=(e)=>{ e.stopPropagation(); removeFromCollection(col.id, item.n); };
        wrapper.appendChild(removeBtn);
      }
      grid.appendChild(wrapper);
    });
    body.appendChild(grid);
  }

  m.classList.remove('hidden'); m.classList.add('flex');
};

window.closeCollectionView=function(){
  const m=document.getElementById('collectionViewModal');
  if(m){ m.classList.add('hidden'); m.classList.remove('flex'); }
};

function _buildCollectionViewModal(){
  const m=document.createElement('div');
  m.id='collectionViewModal';
  m.className='fixed inset-0 z-50 hidden items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm';
  m.innerHTML=`
    <div class="bg-slate-50 dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
      <div id="cvGrad" class="shrink-0"></div>
      <div id="cvBody" class="flex-1 overflow-y-auto p-5"></div>
    </div>`;
  document.body.appendChild(m);
  m.addEventListener('click',e=>{ if(e.target===m) closeCollectionView(); });
  document.addEventListener('keydown', function _cvEsc(e){
    if(e.key==='Escape'){
      const m=document.getElementById('collectionViewModal');
      if(m && m.classList.contains('flex')) closeCollectionView();
    }
  });
}

/* ── ADD ITEMS TO COLLECTION ── */
window.openAddToCollection=function(colId){
  const col=getCollections().find(c=>c.id===colId);
  if(!col) return;
  const existing=new Set(col.items);

  let modal=document.getElementById('addToColModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='addToColModal';
    modal.className='fixed inset-0 z-[60] hidden items-center justify-center p-4 bg-black/50 backdrop-blur-sm';
    modal.innerHTML=`
      <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div class="px-5 pt-5 pb-3 shrink-0">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
              <i class="fa-solid fa-plus text-white text-sm"></i>
            </div>
            <div class="flex-1">
              <h3 class="text-[13px] font-black text-slate-800 dark:text-white" id="atcTitle">Resurs qo'shish</h3>
              <p class="text-[10px] text-slate-400">Kolleksiyaga resurs qo'shing</p>
            </div>
            <button onclick="document.getElementById('addToColModal').classList.add('hidden');document.getElementById('addToColModal').classList.remove('flex')"
              class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors">
              <i class="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>
          <div class="relative">
            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
            <input id="atcSearch" placeholder="Resurs nomi..." oninput="searchForCollection(this.value)"
              class="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-violet-400">
          </div>
        </div>
        <div id="atcList" class="flex-1 overflow-y-auto px-4 pb-4 space-y-1"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{ if(e.target===modal){ modal.classList.add('hidden'); modal.classList.remove('flex'); } });
  }

  modal.dataset.colId=colId;
  document.getElementById('atcTitle').textContent=`"${col.title}" ga qo'shish`;
  modal.classList.remove('hidden'); modal.classList.add('flex');
  searchForCollection('');
  setTimeout(()=>document.getElementById('atcSearch')?.focus(),100);
};

window.searchForCollection=function(q){
  const modal=document.getElementById('addToColModal');
  if(!modal) return;
  const colId=modal.dataset.colId;
  const col=getCollections().find(c=>c.id===colId);
  if(!col) return;
  const existing=new Set(col.items);

  const allItems=[];
  DATA.forEach(cat=>{ if(cat.id==='my_apps') return; cat.items.forEach(i=>allItems.push(i)); });
  const filtered=q.trim()?allItems.filter(i=>i.n.toLowerCase().includes(q.toLowerCase())||(i.d||'').toLowerCase().includes(q.toLowerCase())):allItems.slice(0,40);

  const list=document.getElementById('atcList');
  list.innerHTML=filtered.slice(0,50).map(item=>{
    const dm=getDomain(item.u||'');
    const hasReal=dm&&dm.includes('.');
    const inCol=existing.has(item.n);
    const palettes=['#6366f1,#8b5cf6','#ec4899,#f97316','#06b6d4,#6366f1','#10b981,#06b6d4'];
    let hash=0; for(let k=0;k<item.n.length;k++) hash=item.n.charCodeAt(k)+((hash<<5)-hash);
    const [c1,c2]=palettes[Math.abs(hash)%palettes.length].split(',');
    const icoHtml=hasReal
      ?`<img src="https://www.google.com/s2/favicons?domain=${dm}&sz=32" class="w-8 h-8 rounded-xl object-contain" onerror="this.outerHTML='<div style=\\'background:linear-gradient(135deg,${c1},${c2})\\' class=\\'w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold\\'>${item.n[0]}</div>'" loading="lazy">`
      :`<div style="background:linear-gradient(135deg,${c1},${c2})" class="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold">${item.n[0]}</div>`;
    return `<div class="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors cursor-pointer group/atc" onclick="toggleInCollection('${colId}','${item.n.replace(/'/g,"\\'")}',this)">
      <div class="shrink-0">${icoHtml}</div>
      <div class="flex-1 min-w-0">
        <p class="text-[12px] font-bold text-slate-800 dark:text-white truncate">${item.n}</p>
        ${item.d?`<p class="text-[10px] text-slate-400 truncate">${item.d.slice(0,50)}</p>`:''}
      </div>
      <div class="shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${inCol?'bg-violet-500 border-violet-500':'border-slate-300 dark:border-slate-600 group-hover/atc:border-violet-400'}" data-checked="${inCol?'1':'0'}">
        ${inCol?'<i class="fa-solid fa-check text-white text-[9px]"></i>':''}
      </div>
    </div>`;
  }).join('');
};

window.toggleInCollection=function(colId, name, el){
  const col=userCollections.find(c=>c.id===colId);
  if(!col) return;
  const check=el.querySelector('[data-checked]');
  const inCol=check.dataset.checked==='1';
  if(inCol){
    col.items=col.items.filter(n=>n!==name);
    check.dataset.checked='0';
    check.className='shrink-0 w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center transition-all';
    check.innerHTML='';
  } else {
    if(!col.items.includes(name)) col.items.push(name);
    check.dataset.checked='1';
    check.className='shrink-0 w-6 h-6 rounded-full border-2 bg-violet-500 border-violet-500 flex items-center justify-center transition-all';
    check.innerHTML='<i class="fa-solid fa-check text-white text-[9px]"></i>';
  }
  saveUserCollections();
  // Refresh open collection view if same
  const m=document.getElementById('collectionViewModal');
  if(m&&!m.classList.contains('hidden')) openCollectionView(colId);
};

window.removeFromCollection=function(colId, name){
  const col=userCollections.find(c=>c.id===colId);
  if(!col) return;
  col.items=col.items.filter(n=>n!==name);
  saveUserCollections();
  openCollectionView(colId);
};

/* ── SHARE COLLECTION ── */
window.shareCollection=function(colId){
  const col=getCollections().find(c=>c.id===colId);
  if(!col) return;
  const items=_getColItems(col);
  const text=`📚 ${col.emoji} *${col.title}*\n\n${items.slice(0,10).map((it,i)=>`${i+1}. ${it.n} — ${it.u}`).join('\n')}\n\n🔗 eLink UZ — https://elink.uz`;
  if(navigator.share){ navigator.share({title:col.title, text}); }
  else { navigator.clipboard?.writeText(text).then(()=>showToast('Nusxalandi!','fa-circle-check text-emerald-400')); }
};

/* ── EDIT USER COLLECTION ── */
window.openEditCollection=function(colId){
  const col=userCollections.find(c=>c.id===colId);
  if(!col) return;
  // Reuse new collection modal with prefill
  openNewCollectionModal();
  setTimeout(()=>{
    const t=document.getElementById('ncTitle'); if(t) t.value=col.title;
    const e=document.getElementById('ncEmoji'); if(e) e.value=col.emoji;
    const d=document.getElementById('ncDesc');  if(d) d.value=col.desc||'';
    // Set color
    document.querySelectorAll('.nc-color').forEach(b=>{
      b.classList.remove('ring-2','ring-offset-1','ring-violet-500');
      if(b.dataset.color===col.color) b.classList.add('ring-2','ring-offset-1','ring-violet-500');
    });
    // Change save button to update
    const btn=document.querySelector('#newCollectionModal button[onclick="saveNewCollection()"]');
    if(btn){ btn.onclick=()=>updateUserCollection(colId); btn.innerHTML='<i class="fa-solid fa-check mr-2"></i> Yangilash'; }
    const h=document.querySelector('#newCollectionModal h3'); if(h) h.textContent='Kolleksiyani tahrirlash';
  },50);
};

window.updateUserCollection=function(colId){
  const col=userCollections.find(c=>c.id===colId);
  if(!col) return;
  col.title=document.getElementById('ncTitle')?.value.trim()||col.title;
  col.emoji=document.getElementById('ncEmoji')?.value.trim()||col.emoji;
  col.desc=document.getElementById('ncDesc')?.value.trim()||'';
  const colorBtn=document.querySelector('.nc-color.ring-2');
  if(colorBtn) col.color=colorBtn.dataset.color;
  col.faIcon = col.faIcon||'fa-layer-group';
  saveUserCollections();
  document.getElementById('newCollectionModal')?.classList.add('hidden');
  document.getElementById('newCollectionModal')?.classList.remove('flex');
  renderContent();
  showToast('Kolleksiya yangilandi!','fa-circle-check text-emerald-400');
};

/* ── NEW COLLECTION MODAL ── */
window.openNewCollectionModal=function(){
  let modal=document.getElementById('newCollectionModal');
  if(modal){ modal.remove(); }
  modal=document.createElement('div');
  modal.id='newCollectionModal';
  modal.className='fixed inset-0 z-[60] hidden items-center justify-center p-4 bg-black/50 backdrop-blur-sm';
  const COLORS=[
    ['from-violet-500 to-fuchsia-500','bg-gradient-to-br from-violet-500 to-fuchsia-500'],
    ['from-sky-500 to-blue-600','bg-gradient-to-br from-sky-500 to-blue-600'],
    ['from-emerald-500 to-teal-600','bg-gradient-to-br from-emerald-500 to-teal-600'],
    ['from-orange-500 to-amber-500','bg-gradient-to-br from-orange-500 to-amber-500'],
    ['from-pink-500 to-rose-500','bg-gradient-to-br from-pink-500 to-rose-500'],
    ['from-indigo-500 to-violet-600','bg-gradient-to-br from-indigo-500 to-violet-600'],
    ['from-red-500 to-orange-500','bg-gradient-to-br from-red-500 to-orange-500'],
    ['from-cyan-500 to-sky-600','bg-gradient-to-br from-cyan-500 to-sky-600'],
    ['from-slate-600 to-slate-800','bg-gradient-to-br from-slate-600 to-slate-800'],
    ['from-lime-500 to-green-600','bg-gradient-to-br from-lime-500 to-green-600'],
  ];
  modal.innerHTML=`
    <div class="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
      <div class="px-5 pt-5 pb-4 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
          <i class="fa-solid fa-folder-plus text-white text-sm"></i>
        </div>
        <h3 class="text-[13px] font-black text-slate-800 dark:text-white flex-1">Yangi kolleksiya</h3>
        <button onclick="document.getElementById('newCollectionModal').classList.add('hidden');document.getElementById('newCollectionModal').classList.remove('flex')"
          class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors">
          <i class="fa-solid fa-xmark text-sm"></i>
        </button>
      </div>
      <div class="p-5 space-y-4">
        <div>
          <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Emoji va nomi *</label>
          <div class="flex gap-2">
            <input id="ncEmoji" maxlength="2" value="📁" class="w-12 text-center text-xl rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-violet-400 py-2.5">
            <input id="ncTitle" placeholder="Masalan: Mening AI to'plamim" class="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-400">
          </div>
        </div>
        <div>
          <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Qisqacha tavsif</label>
          <input id="ncDesc" placeholder="Bu to'plam nima uchun?" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-400">
        </div>
        <div>
          <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 block">Rang tanlang</label>
          <div class="grid grid-cols-5 gap-2">
            ${COLORS.map(([val,cls],i)=>`<button class="nc-color w-full aspect-square rounded-xl ${cls} transition-all hover:scale-105 active:scale-95 ${i===0?'ring-2 ring-offset-2 ring-violet-500':''}" data-color="${val}" onclick="document.querySelectorAll('.nc-color').forEach(b=>b.classList.remove('ring-2','ring-offset-2','ring-violet-500'));this.classList.add('ring-2','ring-offset-2','ring-violet-500')"></button>`).join('')}
          </div>
        </div>
      </div>
      <div class="px-5 pb-5">
        <button onclick="saveNewCollection()" class="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 text-white font-bold rounded-xl py-3 text-sm transition-all shadow-lg shadow-violet-500/25 active:scale-[0.98]">
          <i class="fa-solid fa-check mr-2 text-[11px]"></i> Yaratish
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{ if(e.target===modal){ modal.classList.add('hidden'); modal.classList.remove('flex'); } });
  modal.classList.remove('hidden'); modal.classList.add('flex');
  setTimeout(()=>document.getElementById('ncTitle')?.focus(),100);
};

window.saveNewCollection=function(){
  const title=document.getElementById('ncTitle')?.value.trim();
  const emoji=document.getElementById('ncEmoji')?.value.trim()||'📁';
  const desc=document.getElementById('ncDesc')?.value.trim()||'';
  const colorBtn=document.querySelector('.nc-color.ring-2');
  const color=colorBtn?.dataset.color||'from-violet-500 to-fuchsia-500';
  if(!title){ showToast('Nomi kiritilishi shart!','fa-circle-xmark text-red-400'); return; }
  userCollections.push({ id:'uc_'+Date.now(), title, emoji, desc, color, faIcon:'fa-layer-group', items:[] });
  saveUserCollections();
  document.getElementById('newCollectionModal')?.classList.add('hidden');
  document.getElementById('newCollectionModal')?.classList.remove('flex');
  renderNav(); renderContent();
  showToast(`"${title}" yaratildi! Endi resurs qo'shing.`,'fa-circle-check text-emerald-400');
};

window.deleteUserCollection=function(id){
  if(!confirm("Kolleksiyani o'chirmoqchimisiz?")) return;
  userCollections=userCollections.filter(c=>c.id!==id);
  saveUserCollections();
  renderContent();
  showToast("Kolleksiya o'chirildi",'fa-circle-check text-emerald-400');
};


function renderContent(){

if(!window.DATA || !Array.isArray(window.DATA) || window.DATA.length === 0){
  setTimeout(()=>{ if(window.DATA?.length) renderContent(); }, 100);
  return;
}
// Qidiruv holatiga qarab trending ko'rsat/yashir
const _tSec=$('trendingSection');
if(_tSec){ if(query&&query.trim()) _tSec.classList.add('hidden'); else renderTrending(); }
const myToken = ++_renderToken;
const container = $('appsContainer');
container.innerHTML = '';
$('noResults').classList.add('hidden');
$('noResults').classList.remove('flex');


const SKEL_COUNT = 10;
const skelFrag = document.createDocumentFragment();
const skelGrid = document.createElement('div');
skelGrid.id = '_skelGrid';
skelGrid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 md:gap-3';
skelGrid.innerHTML = Array(SKEL_COUNT).fill(skeletonCard()).join('');
skelFrag.appendChild(skelGrid);
container.appendChild(skelFrag);


setTimeout(()=>{
  if(myToken !== _renderToken) return; 


  let sections = []; 
  let totalFound = 0;

  if(activeCat==='collections'){
    _renderCollections(container, myToken);
    return;
  } else if(activeCat==='favorites'){
    const fItems=[];
    DATA.forEach(c=>c.items.forEach(i=>{ if(favorites.includes(i.n)&&matchItem(i,c)) fItems.push(i); }));
    if(fItems.length){
      sections.push({heading:null, gr:'from-rose-400 to-rose-600', catId:null, items:sortItems(fItems)});
      totalFound = fItems.length;
    } else {
      // Bo'sh saqlanganlar — maxsus yo'riqnoma ko'rsat
      const skelEl2 = document.getElementById('_skelGrid');
      if(skelEl2) skelEl2.remove();
      container.innerHTML = '';
      $('noResults').classList.add('hidden');
      $('noResults').classList.remove('flex');
      $('resultCount').textContent = '';
      $('appsContainer').classList.remove('hidden');
      const favEmpty = document.createElement('div');
      favEmpty.className = 'animate-fade-up flex flex-col items-center text-center py-12 px-4';
      favEmpty.innerHTML = `
        <div class="w-20 h-20 rounded-3xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white text-3xl shadow-lg shadow-rose-400/30 mb-5">
          <i class="fa-solid fa-heart"></i>
        </div>
        <h3 class="text-xl font-black text-slate-800 dark:text-white mb-2">Saqlanganlar bo'sh</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-6">
          Yoqtirgan resursingizni saqlash uchun istalgan kartaning <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/15 text-rose-500 font-bold text-xs border border-rose-200 dark:border-rose-500/30"><i class="fa-regular fa-heart text-[10px]"></i> yurakcha</span> belgisini bosing
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md w-full mb-6 text-left">
          <div class="p-3 rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20">
            <i class="fa-solid fa-globe text-violet-500 text-base mb-1.5 block"></i>
            <p class="text-xs font-bold text-slate-700 dark:text-slate-300">Veb-saytlar</p>
            <p class="text-[10px] text-slate-400 mt-0.5">Sevimli saytlaringiz</p>
          </div>
          <div class="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
            <i class="fa-solid fa-robot text-emerald-500 text-base mb-1.5 block"></i>
            <p class="text-xs font-bold text-slate-700 dark:text-slate-300">AI vositalar</p>
            <p class="text-[10px] text-slate-400 mt-0.5">Eng ko'p ishlatadiganlar</p>
          </div>
          <div class="p-3 rounded-2xl bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/20">
            <i class="fa-solid fa-mobile-screen-button text-sky-500 text-base mb-1.5 block"></i>
            <p class="text-xs font-bold text-slate-700 dark:text-slate-300">Mobil ilovalar</p>
            <p class="text-[10px] text-slate-400 mt-0.5">Qulay ilova havolalar</p>
          </div>
        </div>
        <button onclick="setCat('all')" class="flex items-center gap-2 bg-gradient-to-r from-rose-400 to-pink-500 hover:opacity-90 text-white font-bold rounded-xl px-5 py-3 text-sm transition-all shadow-lg shadow-rose-400/25 active:scale-[0.98]">
          <i class="fa-solid fa-border-all text-sm"></i> Barcha resurslarga o'tish
        </button>`;
      container.appendChild(favEmpty);
      return;
    }
  } else if(activeCat==='my_apps'){
    _renderMyApps(container, myToken);
    return;
  } else {
    DATA.forEach(c=>{
      if(activeCat!=='all'&&activeCat!==c.id) return;
      const items=sortItems(c.items.filter(i=>matchItem(i,c)));
      if(!items.length) return;
      totalFound += items.length;
      sections.push({
        heading: (activeCat==='all'||query.trim())?c.title:null,
        gr: c.gr, catId: c.id, items
      });
    });
  }


  const skelEl = document.getElementById('_skelGrid');
  if(skelEl) skelEl.remove();

  if(totalFound===0){
    container.innerHTML='';
    $('resultCount').textContent='';
    $('appsContainer').classList.add('hidden');
    $('noResults').classList.remove('hidden');
    $('noResults').classList.add('flex');
    return;
  }

  $('resultCount').textContent = `${totalFound} ta resurs`;
  $('appsContainer').classList.remove('hidden');


  _renderSectionsProgressively(sections, container, myToken);
}, 0);
}


function _renderSectionsProgressively(sections, container, token){
  const FIRST_BATCH = 2; // birinchi 2 ta section darhol
  const frag = document.createDocumentFragment();


  const immediate = sections.slice(0, FIRST_BATCH);
  const deferred  = sections.slice(FIRST_BATCH);

  immediate.forEach(s => frag.appendChild(_buildSectionEl(s)));
  container.appendChild(frag);

  if(!deferred.length) return;


  let idx = 0;
  function scheduleNext(){
    if(token !== _renderToken) return;
    if(idx >= deferred.length) return;
    const s = deferred[idx++];
    const el = _buildSectionEl(s);
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    container.appendChild(el);

    requestAnimationFrame(()=>{
      el.style.transition = 'opacity .2s ease-out, transform .2s ease-out';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
    const schedule = typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : (cb=>setTimeout(cb,16));
    schedule(scheduleNext);
  }
  const schedule = typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : (cb=>setTimeout(cb,16));
  schedule(scheduleNext);
}


function _buildSectionEl(s){
  const sec = document.createElement('div');
  sec.className = 'animate-fade-up';

  const shareUrl = s.catId ? ('https://elink.uz/?cat=' + s.catId) : 'https://elink.uz';
  const shareTitle = s.heading ? s.heading + ' — E-Link UZ' : 'E-Link UZ';
  const shareBtn = s.heading ? `
    <button onclick="shareCat('${shareTitle.replace(/'/g,"\\'")}','${shareUrl.replace(/'/g,"\\'")}',this)"
      class="ml-auto flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors border border-transparent hover:border-violet-200 dark:hover:border-violet-500/20">
      <i class="fa-solid fa-share-nodes text-[10px]"></i>
      <span class="hidden sm:inline">Ulashish</span>
    </button>` : '';
  const heading = s.heading ? `<div class="flex items-center gap-3 mb-1.5">
    <div class="w-1 h-5 rounded-full bg-gradient-to-b ${s.gr}"></div>
    <h3 class="text-base font-black text-slate-800 dark:text-white">${s.heading}</h3>
    <span class="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">${s.items.length} ta</span>
    ${shareBtn}
  </div>` : '';

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 md:gap-3';

  // Top 3 ni kliklarga qarab aniqlash va tepaga chiqarish
  const itemsWithMeta = s.items.map(i => ({...i, _clicks: getClicks(i.n), _isTop: false}));
  const byClicks = [...itemsWithMeta].sort((a, b) => b._clicks - a._clicks);
  const top3Names = new Set(byClicks.slice(0, 3).filter(i => i._clicks > 0).map(i => i.n));
  const topItems = itemsWithMeta.filter(i => top3Names.has(i.n)).map(i => ({...i, _isTop: true}));
  const restItems = itemsWithMeta.filter(i => !top3Names.has(i.n));
  const finalItems = [...topItems, ...restItems];
  grid.innerHTML = finalItems.map(i => card(i)).join('');

  sec.innerHTML = heading;
  sec.appendChild(grid);
  return sec;
}


function _renderMyApps(container, token){
  const skelEl = document.getElementById('_skelGrid');
  if(skelEl) skelEl.remove();

  const items = sortItems(customApps.filter(i=>matchItem(i,null)));
  const found = items.length + 1;

  const sec = document.createElement('div');
  sec.className = 'animate-fade-up space-y-1.5';


  const banner = document.createElement('div');
  banner.innerHTML = `
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 dark:from-violet-500/20 dark:to-fuchsia-500/20 border-2 border-violet-300/50 dark:border-violet-600/50 shadow-sm">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/30 shrink-0">
          <i class="fa-solid fa-list-check text-base"></i>
        </div>
        <div class="min-w-0">
          <p class="text-sm font-black text-slate-800 dark:text-white leading-snug">Ro'yxat tuzish va ulashish</p>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Resurslarni qo'shing va qisqa havola orqali ulashing</p>
        </div>
      </div>
      <button onclick="openListBuilderModal()" class="shrink-0 flex items-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 text-white font-black rounded-xl px-4 py-2.5 text-[12px] transition-all shadow-lg shadow-violet-500/30 active:scale-[0.98] whitespace-nowrap">
        <i class="fa-solid fa-wand-magic-sparkles text-[11px]"></i> Ro'yxat tuzish
      </button>
    </div>`;
  sec.appendChild(banner);


  if(customApps.length === 0){
    const emptyGuide = document.createElement('div');
    emptyGuide.innerHTML = `
      <div class="rounded-2xl border-2 border-dashed border-violet-200 dark:border-violet-800/50 p-8 flex flex-col items-center text-center">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-500/15 dark:to-fuchsia-500/15 flex items-center justify-center text-3xl mb-4 shadow-sm">📌</div>
        <h3 class="text-base font-black text-slate-800 dark:text-white mb-1.5">Shaxsiy resurslaringizni qo'shing</h3>
        <p class="text-[12px] text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed mb-5">Istalgan sayt, ilova yoki havola — bitta joyda saqlang va 1 klik bilan kiring</p>
        <div class="flex flex-wrap justify-center gap-2 mb-6 text-[11px] font-bold">
          <span class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20"><i class="fa-solid fa-globe text-[10px]"></i> Veb-sayt</span>
          <span class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20"><i class="fa-brands fa-android text-[10px]"></i> Android</span>
          <span class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"><i class="fa-brands fa-apple text-[10px]"></i> iOS</span>
        </div>
        <button onclick="openCustomModal()" class="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 text-white font-bold rounded-xl px-5 py-3 text-sm transition-all shadow-lg shadow-violet-500/25 active:scale-[0.98]">
          <i class="fa-solid fa-plus"></i> Birinchi resursni qo'shish
        </button>
      </div>`;
    sec.appendChild(emptyGuide);
    container.appendChild(sec);
    $('resultCount').textContent = '';
    $('appsContainer').classList.remove('hidden');
    return;
  }

  const grid = document.createElement('div');
  grid.id = 'myAppsGrid';
  grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 md:gap-3';

  const addCard = document.createElement('div');
  addCard.onclick = openCustomModal;
  addCard.className = 'add-card glass rounded-2xl p-4 flex flex-col items-center justify-center h-full cursor-pointer group border-2 border-dashed border-violet-200 dark:border-violet-800/50 hover:border-violet-400 dark:hover:border-violet-600 transition-all min-h-[130px]';
  addCard.dataset.addcard = '1';
  addCard.innerHTML = `
    <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/25 mb-2.5 group-hover:scale-110 transition-transform">
      <i class="fa-solid fa-plus text-base"></i>
    </div>
    <p class="text-sm font-black text-slate-700 dark:text-slate-300 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">Yangi qo'shish</p>
    <p class="text-[10px] text-slate-400 mt-0.5">Shaxsiy link qo'shing va istalgan vaqtda 1 klikda oching</p>`;
  grid.appendChild(addCard);
  items.forEach(i => {
    const wrapper = document.createElement('div');
    wrapper.dataset.appname = i.n;
    wrapper.draggable = true;
    wrapper.innerHTML = card(i);
    grid.appendChild(wrapper);
  });

  sec.appendChild(grid);
  container.appendChild(sec);
  $('resultCount').textContent = `${found} ta resurs`;
  $('appsContainer').classList.remove('hidden');
  $('noResults').classList.add('hidden');

  // Drag-and-drop
  _initMyAppsDnD(grid);
  $('noResults').classList.remove('flex');
}

function saveHist(q){
q=q.trim(); if(q.length<2) return;
srchHist=[q,...srchHist.filter(x=>x!==q)].slice(0,MAX_HIST);
localStorage.setItem('lh_hist',JSON.stringify(srchHist));
}
window.removeHist=function(q){
srchHist=srchHist.filter(x=>x!==q);
localStorage.setItem('lh_hist',JSON.stringify(srchHist));
updateDrops($('deskSrc').value);
};
window.applySearch=function(q){
query=q; $('deskSrc').value=$('mobSrc').value=q;
$('deskClr').classList.toggle('opacity-0',!q);
$('deskClr').classList.toggle('pointer-events-none',!q);
$('mobClr').classList.toggle('opacity-0',!q);
$('mobClr').classList.toggle('pointer-events-none',!q);
hideDrop(); renderContent();
};


window.applyGlobalSearch=function(q){
  activeCat='all';
  $('pageTitle').textContent='Barcha Resurslar';
  const catWrap=$('catSWrap');
  if(catWrap) catWrap.classList.add('hidden');
  query=q;
  $('deskSrc').value=$('mobSrc').value=q;
  if($('catSrc')){ $('catSrc').value=''; }
  $('deskClr').classList.remove('opacity-0','pointer-events-none');
  $('mobClr').classList.remove('opacity-0','pointer-events-none');
  hideDrop(); renderNav(); renderContent();
};

function buildDropHTML(q){
  const histFiltered = q
    ? srchHist.filter(h => h.toLowerCase().includes(q.toLowerCase()))
    : srchHist;

  const isGlobal = activeCat === 'all' || activeCat === 'favorites';
  let catSugg = [], otherSugg = [];

  if(q.length >= 1){
    if(false){ // my_apps da ham global suggest — bu blok endi ishlatilmaydi
      void 0;
    } else {
      DATA.forEach(c => {
        if(c.id === 'my_apps') return;
        c.items.forEach(i => {
          const nm  = i.n.toLowerCase();
          const dsc = (i.d||'').toLowerCase();
          const qL  = q.toLowerCase();
          const score = nm.startsWith(qL) ? 3 : nm.includes(qL) ? 2 : dsc.includes(qL) ? 1 : 0;
          if(!score) return;
          if(isGlobal || c.id === activeCat){
            if(catSugg.length < 8) catSugg.push({...i, _c:c, _score:score});
          } else {
            if(otherSugg.length < 3) otherSugg.push({...i, _c:c, _score:score});
          }
        });
      });
      catSugg.sort((a,b) => (b._score||0) - (a._score||0));
    }
  }

  const hasResults = catSugg.length || otherSugg.length || histFiltered.length;
  if(!hasResults) return '';

  let html = '';


  if(!isGlobal && activeCat !== 'my_apps' && (catSugg.length || otherSugg.length)){
    const cat = DATA.find(c => c.id === activeCat);
    html += `<div class="flex items-center gap-2 px-3 pt-2.5 pb-1">
      <i class="fa-solid ${cat?.icon||'fa-filter'} text-[9px] text-violet-400"></i>
      <span class="text-[10px] font-black text-violet-500 uppercase tracking-wider flex-1">${cat?.title||''} ichida</span>
    </div>`;
  }


  if(catSugg.length){
    html += `<div class="flex items-center gap-1.5 px-3 pt-2 pb-1">
      <i class="fa-solid fa-magnifying-glass text-[9px] text-slate-300 dark:text-slate-600"></i>
      <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Natijalar</span>
      <span class="ml-auto text-[10px] font-bold text-slate-300 dark:text-slate-600">${catSugg.length} ta</span>
    </div>`;

    catSugg.forEach((i, idx) => {
      const nm    = i.n.replace(/'/g, "\\'");
      const isMob = i.t?.includes('mobil');
      const isBep = i.t?.includes('bepul');
      const isPul = i.t?.includes('pullik');
      const hasW  = i.t?.includes('web') || i.isCustom || (i.u && !i.u.includes('play.google.com') && !i.u.includes('apps.apple.com'));
      const clk   = getClicks(i.n);

      const catLabel = isGlobal && i._c
        ? i._c.title.replace(/^\S+\s/, '').substring(0, 22)
        : '';

      html += `<button onclick="applySearch('${nm}')"
        class="s-row w-full text-left flex items-center gap-3 px-3 py-2.5 ${idx === 0 && q ? 'bg-violet-50/60 dark:bg-violet-500/8' : ''}">
        <div class="shrink-0 w-9 h-9 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 flex items-center justify-center shadow-sm">
          ${iconHTML(i, 'w-7 h-7 object-contain')}
        </div>
        <div class="flex-1 min-w-0">
          ${catLabel ? `<div class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">${catLabel}</div>` : ''}
          <div class="flex items-center gap-1.5 flex-wrap">
            <p class="text-[13px] font-bold text-slate-800 dark:text-slate-100 leading-snug group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">${hl(i.n, q)}</p>
            ${i.v ? `<span class="verified-icon" title="Rasmiy platforma"><i class="fa-solid fa-shield-halved"></i></span>` : ''}
          </div>
          ${i.d ? `<p class="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">${hl(i.d, q)}</p>` : ''}
          <div class="flex items-center gap-1.5 mt-1 flex-wrap">
            ${isBep ? `<span class="badge-bepul">✓ Bepul</span>` : ''}
            ${isPul ? `<span class="badge-pullik">💎 Pullik</span>` : ''}
            ${hasW && isMob ? `<span class="badge-web" title="Veb-sayt"><i class="fa-solid fa-globe text-[9px]"></i></span>` : ''}
            ${isMob ? `<span class="badge-mob" title="Mobil ilova"><i class="fa-solid fa-mobile-screen-button text-[9px]"></i></span>` : ''}
            ${clk > 0 ? `<span class="inline-flex items-center gap-0.5 text-[9px] font-black text-orange-400"><i class="fa-solid fa-fire text-[8px]"></i>${clk}</span>` : ''}
          </div>
        </div>
      </button>`;
    });
  }


  if(!isGlobal && activeCat !== 'my_apps' && otherSugg.length){
    const qEsc = q.replace(/'/g, "\\'");
    html += `<div class="mx-2 my-1.5 border-t border-slate-100 dark:border-slate-700/50"></div>
    <button onclick="applyGlobalSearch('${qEsc}')"
      class="s-row w-full flex items-center gap-2 px-3 py-1.5 group">
      <i class="fa-solid fa-earth-asia text-[9px] text-slate-300 dark:text-slate-600 group-hover:text-violet-400 transition-colors"></i>
      <span class="text-[10px] font-black text-slate-400 group-hover:text-violet-500 uppercase tracking-wider transition-colors flex-1">Barcha resurslardan qidirish</span>
      <span class="text-[9px] font-bold bg-violet-100 dark:bg-violet-500/15 text-violet-500 px-1.5 py-0.5 rounded-md">${otherSugg.length}+</span>
    </button>`;

    otherSugg.slice(0, 2).forEach(i => {
      html += `<button onclick="applyGlobalSearch('${q.replace(/'/g,"\\'")}')"
        class="s-row w-full text-left flex items-center gap-2.5 px-3 py-2 opacity-55 hover:opacity-100 group">
        <div class="shrink-0 w-7 h-7 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800 flex items-center justify-center">
          ${iconHTML(i, 'w-5 h-5 object-contain')}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[12px] font-semibold text-slate-600 dark:text-slate-400 truncate">${hl(i.n, q)}</p>
          ${i.d ? `<p class="text-[10px] text-slate-400 dark:text-slate-500 truncate">${i.d}</p>` : ''}
        </div>
        <span class="text-[9px] text-slate-300 dark:text-slate-600 whitespace-nowrap shrink-0">${(i._c?.title||'').replace(/^\S+\s/, '').substring(0,16)}</span>
      </button>`;
    });
  }


  if(histFiltered.length){
    if(catSugg.length || otherSugg.length)
      html += `<div class="mx-2 my-1.5 border-t border-slate-100 dark:border-slate-700/50"></div>`;

    html += `<div class="flex items-center gap-1.5 px-3 pt-1.5 pb-1">
      <i class="fa-solid fa-clock-rotate-left text-[9px] text-slate-300 dark:text-slate-600"></i>
      <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Oxirgi qidiruvlar</span>
    </div>`;

    histFiltered.slice(0, 4).forEach(h => {
      const hEsc = h.replace(/'/g, "\\'");
      html += `<div class="s-row flex items-center gap-2 px-3 py-1.5 group">
        <button onclick="applySearch('${hEsc}')" class="flex-1 text-left flex items-center gap-2.5">
          <div class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <i class="fa-solid fa-clock-rotate-left text-[9px] text-slate-300 dark:text-slate-600"></i>
          </div>
          <span class="text-[12.5px] font-semibold text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">${hl(h, q)}</span>
        </button>
        <button onclick="event.stopPropagation();removeHist('${hEsc}')"
          class="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all text-[9px]">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>`;
    });
  }


  if(q.length >= 1 && (catSugg.length > 0 || otherSugg.length > 0)){
    html += `<div class="px-3 py-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-2">
      <span class="text-[10px] text-slate-300 dark:text-slate-600 flex items-center gap-1">
        <kbd class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 font-mono text-[9px]">↵</kbd>
        barcha natijalar
      </span>
      <span class="ml-auto text-[10px] text-slate-300 dark:text-slate-600 flex items-center gap-1">
        <kbd class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 font-mono text-[9px]">Esc</kbd>
        yopish
      </span>
    </div>`;
  }

  return html;
}

function updateDrops(q){
const h=buildDropHTML(q);
$('deskDropIn').innerHTML=h; $('mobDropIn').innerHTML=h;
$('deskDrop').classList.toggle('hidden',!h);
$('mobDrop').classList.toggle('hidden',!h);
}
function hideDrop(){ $('deskDrop').classList.add('hidden'); $('mobDrop').classList.add('hidden'); }

let sTimer;
function setupSearch(){

  const catSrcEl=$('catSrc'), catClrEl=$('catClr');
const handleCat=e=>{
  query=e.target.value;
  $('deskSrc').value=$('mobSrc').value=query;
  if(catClrEl){catClrEl.classList.toggle('opacity-0',!query);catClrEl.classList.toggle('pointer-events-none',!query);}
  $('deskClr').classList.toggle('opacity-0',!query);$('deskClr').classList.toggle('pointer-events-none',!query);
  $('mobClr').classList.toggle('opacity-0',!query);$('mobClr').classList.toggle('pointer-events-none',!query);
  clearTimeout(sTimer);
  sTimer=setTimeout(()=>{ if(query.trim()) saveHist(query); renderContent(); },160);
};
const clearCat=()=>{
  query='';
  if(catSrcEl) catSrcEl.value='';
  $('deskSrc').value=$('mobSrc').value='';
  if(catClrEl){catClrEl.classList.add('opacity-0','pointer-events-none');}
  $('deskClr').classList.add('opacity-0','pointer-events-none');
  $('mobClr').classList.add('opacity-0','pointer-events-none');
  hideDrop(); renderContent();
  if(catSrcEl) catSrcEl.focus();
};
if(catSrcEl){catSrcEl.addEventListener('input',handleCat);catSrcEl.addEventListener('keydown',e=>{if(e.key==='Escape')clearCat();if(e.key==='Enter')renderContent();});}
if(catClrEl) catClrEl.addEventListener('click',clearCat);

const handle=e=>{
  query=e.target.value;
  $('deskSrc').value=$('mobSrc').value=query;
  if(catSrcEl) catSrcEl.value=query;
  if(catClrEl){catClrEl.classList.toggle('opacity-0',!query);catClrEl.classList.toggle('pointer-events-none',!query);}
  $('deskClr').classList.toggle('opacity-0',!query);
  $('deskClr').classList.toggle('pointer-events-none',!query);
  $('mobClr').classList.toggle('opacity-0',!query);
  $('mobClr').classList.toggle('pointer-events-none',!query);
  /* Yuqori qidiruv DOIM global — my_apps yoki favorites da bo'lsa 'all' ga o'tkazamiz */
  if(query.trim() && (activeCat === 'my_apps' || activeCat === 'favorites')){
    activeCat = 'all';
    $('pageTitle').textContent = 'Barcha Resurslar';
    const catWrap=$('catSWrap');
    if(catWrap) catWrap.classList.add('hidden');
    renderNav();
  }
  updateDrops(query);
  clearTimeout(sTimer);
  sTimer=setTimeout(()=>{ if(query.trim()) saveHist(query); renderContent(); },160);
};
const clearS=()=>{
  query=''; $('deskSrc').value=$('mobSrc').value='';
  if(catSrcEl) catSrcEl.value='';
  if(catClrEl){catClrEl.classList.add('opacity-0','pointer-events-none');}
  $('deskClr').classList.add('opacity-0', 'pointer-events-none'); 
  $('mobClr').classList.add('opacity-0', 'pointer-events-none');
  hideDrop(); renderContent();
  (window.innerWidth>768?$('deskSrc'):$('mobSrc')).focus();
};
$('deskSrc').addEventListener('input',handle);
$('mobSrc').addEventListener('input',handle);
$('deskClr').addEventListener('click',clearS);
$('mobClr').addEventListener('click',clearS);
$('deskSrc').addEventListener('focus',()=>updateDrops($('deskSrc').value));
$('mobSrc').addEventListener('focus', ()=>updateDrops($('mobSrc').value));
[$('deskSrc'),$('mobSrc')].forEach(el=>el.addEventListener('keydown',e=>{
  if(e.key==='Escape') clearS();
  if(e.key==='Enter'){ hideDrop(); renderContent(); }
}));
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){ 
      e.preventDefault(); 
      const inp = window.innerWidth > 768 ? $('deskSrc') : $('mobSrc');
      inp.focus(); inp.select(); 
  }
});
document.addEventListener('click',e=>{
  if(!$('deskSWrap').contains(e.target)) $('deskDrop').classList.add('hidden');
  if(!$('mobSWrap').contains(e.target))  $('mobDrop').classList.add('hidden');

  const sd = $('sortDropMenu'), sw = $('sortDropWrap');
  if(sd && sw && !sw.contains(e.target)){ sd.classList.add('hidden'); const ch=$('sortChevron'); if(ch) ch.style.transform=''; }
  const td = $('topSortDropMenu'), tw = $('topSortDropWrap');
  if(td && tw && !tw.contains(e.target)){ td.classList.add('hidden'); const tc=$('topSortChevron'); if(tc) tc.style.transform=''; }
});

const handleSort=e=>{ sortMode=e.target.value; if($('sSort')) $('sSort').value=sortMode; if($('topSort')) $('topSort').value=sortMode; renderNav(); renderContent(); };
$('sSort')?.addEventListener('change',handleSort);
$('topSort')?.addEventListener('change',handleSort);
$('clrFilters')?.addEventListener('click',clearAll);
}

function setupTheme(){
const html=document.documentElement;
const iDesk = $('themeIco');
const iMob = $('themeIcoMob');
const iTop = $('themeIcoTop');
const tTxt = $('themeTxt');

const upd=dark=>{
  if(iDesk) { iDesk.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'; }
  if(iMob) { iMob.className = dark ? 'fa-solid fa-sun text-sm' : 'fa-solid fa-moon text-sm'; }
  if(iTop) { iTop.className = dark ? 'fa-solid fa-sun text-sm' : 'fa-solid fa-moon text-sm'; }
  if(tTxt) tTxt.textContent=dark?'Kunduzgi rejim':'Tungi rejim';
};
upd(html.classList.contains('dark'));
[$('themeBtn'),$('themeBtnMob'),$('themeBtnTop')].forEach(btn=>btn?.addEventListener('click',()=>{
  const dark=html.classList.toggle('dark');
  localStorage.lh_theme=dark?'dark':'light';
  upd(dark);
}));
}


window.shareCat = async function(title, url, btn) {
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
if (isMobile && navigator.share) {
  try { await navigator.share({ title, text: title + ' — barcha resurslar!', url }); return; } catch(e) {}
}
try { await navigator.clipboard.writeText(url); }
catch(e) {
  const t=document.createElement('input');t.value=url;
  document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);
}

if(btn){
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-check text-[10px]"></i><span class="hidden sm:inline">Nusxalandi</span>';
  btn.classList.add('text-emerald-500','border-emerald-200');
  setTimeout(()=>{ btn.innerHTML=orig; btn.classList.remove('text-emerald-500','border-emerald-200'); }, 1800);
}
showToast(`"${title}" havolasi nusxalandi!`, 'fa-link text-violet-400');
};




window.shareCard = async function(name, url) {
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const shareData = { title: name + ' — E-Link UZ', text: name + ' — E-Link UZ da toping!', url };
if (isMobile && navigator.share) {
  try { await navigator.share(shareData); return; } catch(e) {}
}
// Desktop: clipboard copy
try { await navigator.clipboard.writeText(url); }
catch(e) {
  const t=document.createElement('input');t.value=url;
  document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);
}
showToast(`"${name}" havolasi nusxalandi!`, 'fa-link text-violet-400');
};

function setupShare(){
const fn=async()=>{
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const d={title:"E-Link UZ — O'zbekiston onlayn resurslar",text:"300+ resurs bitta joyda! O'zbekiston aholisi uchun mukammal platforma",url:'https://elink.uz'};
  if(isMobile && navigator.share){try{await navigator.share(d);return;}catch(e){}}
  try{await navigator.clipboard.writeText(location.href);}
  catch(e){const t=document.createElement('input');t.value=location.href;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);}
  showToast('Havola nusxalandi!','fa-link text-violet-400');
};
[$('shareBtn'),$('shareBtnDesk')].forEach(b=>b?.addEventListener('click',fn));
}

function setupScroll(){
const btn=$('scrollTop'), ms=$('mainScroll'), prog=$('scrollProgress');
if(!btn||!ms) return;

ms.addEventListener('scroll',()=>{
  const st = ms.scrollTop;
  const max = ms.scrollHeight - ms.clientHeight;
  const pct = max > 0 ? (st / max) * 100 : 0;


  if(prog) prog.style.width = pct + '%';


  const show = st > 220;
  btn.classList.toggle('opacity-0', !show);
  btn.classList.toggle('translate-y-4', !show);
  btn.classList.toggle('pointer-events-none', !show);
}, {passive:true});

btn.addEventListener('click',()=> ms.scrollTo({top:0,behavior:'smooth'}));
}

function showToast(msg, ic='fa-circle-check text-emerald-400'){
const t=$('toast'), i=$('toastIco'), m=$('toastMsg');
if(!t||!i||!m) return;
m.textContent=msg; i.className=`fa-solid ${ic}`;
t.classList.remove('opacity-0','pointer-events-none');
setTimeout(()=>t.classList.add('opacity-0','pointer-events-none'),2500);
}




let _caEnabled = {web:true, android:false, ios:false};

window.caToggle = function(type){
  _caEnabled[type] = !_caEnabled[type];
  const map = {
    web:     {btn:'caToggleWeb',  field:'caWebField',     on:'border-violet-400 bg-violet-50 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400', off:'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'},
    android: {btn:'caToggleAndroid', field:'caAndroidField', on:'border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400', off:'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'},
    ios:     {btn:'caToggleIos',  field:'caIosField',     on:'border-slate-600 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', off:'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'},
  };
  const cfg = map[type];
  const btn = $(cfg.btn), field = $(cfg.field);
  if(_caEnabled[type]){
    btn.className = btn.className.replace(/border-\S+|bg-\S+|text-\S+(?=\s|$)/g,'').trim();
    btn.className += ' flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-xs font-bold transition-all ' + cfg.on;
    field.classList.remove('hidden');
  } else {
    btn.className = btn.className.replace(/border-\S+|bg-\S+|text-\S+(?=\s|$)/g,'').trim();
    btn.className += ' flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-xs font-bold transition-all ' + cfg.off;
    field.classList.add('hidden');
  }
};

function _resetCaModal(){
  _caEnabled = {web:true, android:false, ios:false};
  $('caName').value=''; $('caDesc').value='';
  $('caUrl').value=''; $('caAndroidUrl').value=''; $('caIosUrl').value='';
  $('caEditName').value='';

  const map2 = {
    web:     {btn:'caToggleWeb',  field:'caWebField',     on:'border-violet-400 bg-violet-50 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400'},
    android: {btn:'caToggleAndroid', field:'caAndroidField', off:'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'},
    ios:     {btn:'caToggleIos',  field:'caIosField',     off:'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'},
  };
  $('caToggleWeb').className = 'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-xs font-bold transition-all border-violet-400 bg-violet-50 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400';
  $('caToggleAndroid').className = 'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-xs font-bold transition-all border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500';
  $('caToggleIos').className = 'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-xs font-bold transition-all border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500';
  $('caWebField').classList.remove('hidden');
  $('caAndroidField').classList.add('hidden');
  $('caIosField').classList.add('hidden');
  $('caModalTitle').innerHTML = '<i class="fa-solid fa-circle-plus text-violet-500"></i> Yangi resurs';
  $('caSaveTxt').textContent = 'Saqlash';
}

window.openCustomModal = function() {
  _resetCaModal();
  const m=$('caModal'), mc=$('caModalContent');
  m.classList.remove('hidden'); m.classList.add('flex');
  setTimeout(()=>{ mc.classList.remove('scale-95','opacity-0'); mc.classList.add('scale-100','opacity-100'); },10);
  $('caName').focus();
};

window.openEditModal = function(name){
  const app = customApps.find(a=>a.n===name);
  if(!app) return;
  _resetCaModal();
  $('caModalTitle').innerHTML = '<i class="fa-solid fa-pen text-blue-500"></i> Tahrirlash';
  $('caSaveTxt').textContent = 'Yangilash';
  $('caName').value = app.n;
  $('caDesc').value = app.d||'';
  $('caEditName').value = app.n;


  const hasWeb = app.t?.includes('web') || app.u;
  const hasMob = app.t?.includes('mobil') || app.androidUrl || app.iosUrl;

  if(hasWeb){ $('caUrl').value = app.u||''; }
  else { _caEnabled.web=true; caToggle('web'); _caEnabled.web=false; caToggle('web'); }

  if(app.androidUrl){
    _caEnabled.android=false; caToggle('android');
    $('caAndroidUrl').value = app.androidUrl;
  }
  if(app.iosUrl){
    _caEnabled.ios=false; caToggle('ios');
    $('caIosUrl').value = app.iosUrl;
  }

  const m=$('caModal'), mc=$('caModalContent');
  m.classList.remove('hidden'); m.classList.add('flex');
  setTimeout(()=>{ mc.classList.remove('scale-95','opacity-0'); mc.classList.add('scale-100','opacity-100'); },10);
  $('caName').focus();
};

window.closeCustomModal = function() {
  const m=$('caModal'), mc=$('caModalContent');
  mc.classList.remove('scale-100','opacity-100'); mc.classList.add('scale-95','opacity-0');
  setTimeout(()=>{ m.classList.add('hidden'); m.classList.remove('flex'); },200);
};

window.saveCustomApp = function() {
  const n    = $('caName').value.trim();
  let   u    = $('caUrl').value.trim();
  const d    = $('caDesc').value.trim();
  let   aUrl = $('caAndroidUrl').value.trim();
  let   iUrl = $('caIosUrl').value.trim();
  const editName = $('caEditName').value.trim();

  if(!n) return showToast("Nomi kiritilishi shart!", "fa-circle-xmark text-red-500");
  if(!u && !aUrl && !iUrl) return showToast("Kamida bitta URL kiritilishi shart!", "fa-circle-xmark text-red-500");

  const fixUrl = s => (!s?'': (!s.startsWith('http://')&&!s.startsWith('https://'))?'https://'+s:s);
  u = fixUrl(u); aUrl = fixUrl(aUrl); iUrl = fixUrl(iUrl);


  if(editName){
    const idx = customApps.findIndex(a=>a.n===editName);
    if(idx===-1) return;

    if(n!==editName && customApps.find(a=>a.n.toLowerCase()===n.toLowerCase()))
      return showToast("Bu nomdagi ilova allaqachon bor!", "fa-triangle-exclamation text-amber-500");

    const tags = ['shaxsiy'];
    if(u) tags.push('web');
    if(aUrl||iUrl) tags.push('mobil');
    const updated = {...customApps[idx], n, u, d, t:tags, isCustom:true};
    if(aUrl) updated.androidUrl=aUrl; else delete updated.androidUrl;
    if(iUrl) updated.iosUrl=iUrl;     else delete updated.iosUrl;
    customApps[idx]=updated;

    if(n!==editName){
      favorites=favorites.map(f=>f===editName?n:f);
      localStorage.setItem('lh_favs',JSON.stringify(favorites));
    }
  } else {
    if(customApps.find(a=>a.n.toLowerCase()===n.toLowerCase()))
      return showToast("Bu nomdagi ilova allaqachon bor!", "fa-triangle-exclamation text-amber-500");
    const tags=['shaxsiy'];
    if(u) tags.push('web');
    if(aUrl||iUrl) tags.push('mobil');
    const newItem={n, u, d, t:tags, isCustom:true};
    if(aUrl) newItem.androidUrl=aUrl;
    if(iUrl) newItem.iosUrl=iUrl;
    customApps.unshift(newItem);
  }

  localStorage.setItem('lh_custom_apps', JSON.stringify(customApps));
  saveUserDataToSupabase();
  const cat = DATA.find(c=>c.id==='my_apps');
  if(cat) cat.items=customApps;
  closeCustomModal();
  showToast(editName ? "Muvaffaqiyatli yangilandi!" : "Ilova muvaffaqiyatli qo'shildi!");
  if(activeCat!=='my_apps') setCat('my_apps');
  else { renderNav(); renderContent(); }
};

window.deleteCustomApp = function(name) {

  const existing = document.getElementById('deleteConfirmModal');
  if(existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'deleteConfirmModal';
  modal.className = 'fixed inset-0 z-[600] flex items-center justify-center px-4';
  modal.innerHTML = `
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" id="deleteModalBg"></div>
    <div class="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-xs p-6 border border-slate-200 dark:border-slate-700 transform scale-95 opacity-0 transition-all duration-200" id="deleteModalBox">
      <div class="flex flex-col items-center text-center">
        <div class="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-500/15 flex items-center justify-center mb-4">
          <i class="fa-solid fa-trash-can text-red-500 text-2xl"></i>
        </div>
        <h3 class="text-base font-black text-slate-900 dark:text-white mb-1">O'chirib tashlaysizmi?</h3>
        <p class="text-[12px] text-slate-400 leading-relaxed mb-5">
          <span class="font-bold text-slate-600 dark:text-slate-300">"${name}"</span> shaxsiy ro'yxatingizdan o'chiriladi
        </p>
        <div class="flex gap-2.5 w-full">
          <button id="deleteCancelBtn" class="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            Bekor qilish
          </button>
          <button id="deleteConfirmBtn" class="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors shadow-lg shadow-red-500/25 active:scale-[0.97]">
            <i class="fa-solid fa-trash-can mr-1.5 text-xs"></i> O'chirish
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const box = document.getElementById('deleteModalBox');
  const close = () => {
    box.classList.add('scale-95','opacity-0');
    setTimeout(() => modal.remove(), 180);
  };

  setTimeout(() => {
    box.classList.remove('scale-95','opacity-0');
    box.classList.add('scale-100','opacity-100');
  }, 10);

  document.getElementById('deleteCancelBtn').onclick = close;
  document.getElementById('deleteModalBg').onclick = close;
  document.getElementById('deleteConfirmBtn').onclick = () => {
    close();
    setTimeout(() => {
      customApps = customApps.filter(a=>a.n!==name);
      localStorage.setItem('lh_custom_apps', JSON.stringify(customApps));
      const cat = DATA.find(c=>c.id==='my_apps');
      if(cat) cat.items = customApps;
      favorites = favorites.filter(n=>n!==name);
      localStorage.setItem('lh_favs', JSON.stringify(favorites));
      saveUserDataToSupabase();
      showToast("Ilova o'chirildi", "fa-trash text-red-500");
      renderNav(); renderContent();
    }, 200);
  };
};




function renderRecent(){
const wrap = document.getElementById('recentSection');
if(!wrap) return;
if(!recentlyVisited.length){ wrap.classList.add('hidden'); return; }
wrap.classList.remove('hidden');
  wrap.style.display = 'flex';
const grid = wrap.querySelector('#recentGrid');
if(!grid) return;
grid.innerHTML = recentlyVisited.map(item=>{
  const esc=item.n.replace(/'/g,"\\'");
  const isMob=item.t?.includes('mobil');
  const hasWeb=item.t?.includes('web');
  const clickAct=isMob
    ? `openPlatformModal('${esc}','${item.u}',${hasWeb},true);addClick('${esc}')`
    : `addClick('${esc}');window.open('${item.u}','_blank','noopener,noreferrer')`;
  return `
  <div onclick="${clickAct}" class="flex-shrink-0 glass rounded-xl p-2.5 flex items-center gap-3 min-w-[155px] max-w-[180px] hover:shadow-md transition-all group cursor-pointer">
    <div class="shrink-0">${iconHTML(item,'w-8 h-8 rounded-lg shadow-sm object-contain')}</div>
    <div class="min-w-0">
      <p class="text-[12px] font-bold text-slate-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">${item.n}</p>
      <p class="text-[9px] text-slate-400 truncate">${(item.d||'').slice(0,30)}</p>
    </div>
  </div>`;}).join('');

  if(_imgObserver) grid.querySelectorAll('.lz-img').forEach(img => _imgObserver.observe(img));
}




function updateSidebarStats() {
  const el = document.getElementById('sidebarStats');
  if (!el) return;
  const total = DATA.reduce((a, c) => c.id !== 'my_apps' ? a + c.items.length : a, 0);
  const totalClicks = Object.values(globalClicks).reduce((a, b) => a + b, 0);
  el.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
        <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400">Jonli statistika</span>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-2 mt-1.5">
      <div class="bg-violet-50 dark:bg-violet-500/10 rounded-lg px-2.5 py-2 text-center">
        <div class="text-[15px] font-black text-violet-600 dark:text-violet-400">${total}</div>
        <div class="text-[9px] text-slate-400 font-bold">Resurs</div>
      </div>
      <div class="bg-fuchsia-50 dark:bg-fuchsia-500/10 rounded-lg px-2.5 py-2 text-center">
        <div class="text-[15px] font-black text-fuchsia-600 dark:text-fuchsia-400">${totalClicks}</div>
        <div class="text-[9px] text-slate-400 font-bold">Klik</div>
      </div>
    </div>`;
}



window.openPlatformModal = function(name, url, hasWeb, hasMobil){
  let item = null;
  DATA.forEach(c=>c.items.forEach(i=>{ if(i.n===name) item=i; }));
  const modal=$('platModal'), content=$('platModalContent'), body=$('platModalBody');
  if(!item){ addClick(name); window.open(url,'_blank','noopener,noreferrer'); return; }

  const escN  = name.replace(/'/g,"\'");
  const q     = encodeURIComponent(name);


  const isStoreUrl = u => u && (
    u.includes('play.google.com') ||
    u.includes('apps.apple.com') ||
    u.includes('appgallery.huawei')
  );


  const webUrl  = item.webUrl  || (!isStoreUrl(item.u) ? item.u  : null);

  const playUrl = item.androidUrl || (item.u?.includes('play.google.com') ? item.u : `https://play.google.com/store/search?q=${q}&c=apps`);

  const iosUrl  = item.iosUrl  || (item.u?.includes('apps.apple.com')    ? item.u : `https://apps.apple.com/search?term=${q}`);

  const showWeb = !!(webUrl && webUrl.trim());
  const showMob = !!(hasMobil || item.t?.includes('mobil'));
  const domain  = showWeb ? getDomain(webUrl) : '';
  const webEsc  = (webUrl  || '').replace(/'/g,"\'");
  const playEsc = playUrl.replace(/'/g, "\'");
  const iosEsc  = iosUrl.replace(/'/g,  "\'");

  body.innerHTML = `
    <div class="flex flex-col items-center mb-5">
      <div class="w-[72px] h-[72px] rounded-[20px] overflow-hidden border border-slate-100 dark:border-slate-700/60 shadow-xl mb-3 flex items-center justify-center bg-white dark:bg-slate-800">
        ${iconHTML(item,'w-[72px] h-[72px] object-contain')}
      </div>
      <h3 class="text-[17px] font-black text-slate-900 dark:text-white">${name}</h3>
      <p class="text-[11px] text-slate-400 text-center mt-1 max-w-[240px] leading-relaxed">${item.d||''}</p>
    </div>
    <div class="flex items-center gap-2 mb-3">
      <div class="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
      <span class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ochish usulini tanlang</span>
      <div class="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
    </div>
    <div class="space-y-2">
      ${showWeb ? `
      <button onclick="addClick('${escN}');setTimeout(()=>rerenderClickFor('${escN}'),50);window.open('${webEsc}','_blank','noopener,noreferrer');closePlatformModal()"
        class="plat-link flex items-center gap-3.5 w-full rounded-2xl px-4 py-3.5 group">
        <div class="w-11 h-11 rounded-[14px] bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/25 shrink-0">
          <i class="fa-solid fa-globe text-[15px]"></i>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="font-bold text-[13.5px] text-slate-800 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">Veb-sayt orqali kirish</div>
          <div class="text-[10px] text-slate-400 truncate mt-0.5">${domain}</div>
        </div>
        <i class="fa-solid fa-chevron-right text-slate-300 group-hover:text-violet-400 text-xs shrink-0 transition-transform group-hover:translate-x-0.5"></i>
      </button>` : ''}
      ${showMob ? `
      <button onclick="addClick('${escN}');setTimeout(()=>rerenderClickFor('${escN}'),50);window.open('${playEsc}','_blank','noopener,noreferrer');closePlatformModal()"
        class="plat-link flex items-center gap-3.5 w-full rounded-2xl px-4 py-3.5 group">
        <div class="w-11 h-11 rounded-[14px] bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 shrink-0">
          <i class="fa-brands fa-google-play text-[15px]"></i>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="font-bold text-[13.5px] text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Android ilovasi</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Google Play Store</div>
        </div>
        <i class="fa-solid fa-chevron-right text-slate-300 group-hover:text-emerald-400 text-xs shrink-0 transition-transform group-hover:translate-x-0.5"></i>
      </button>
      <button onclick="addClick('${escN}');setTimeout(()=>rerenderClickFor('${escN}'),50);window.open('${iosEsc}','_blank','noopener,noreferrer');closePlatformModal()"
        class="plat-link flex items-center gap-3.5 w-full rounded-2xl px-4 py-3.5 group">
        <div class="w-11 h-11 rounded-[14px] bg-gradient-to-br from-slate-600 to-slate-900 flex items-center justify-center text-white shadow-lg shrink-0">
          <i class="fa-brands fa-apple text-[18px]"></i>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="font-bold text-[13.5px] text-slate-800 dark:text-white group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">iPhone / iPad ilovasi</div>
          <div class="text-[10px] text-slate-400 mt-0.5">App Store</div>
        </div>
        <i class="fa-solid fa-chevron-right text-slate-300 group-hover:text-slate-500 text-xs shrink-0 transition-transform group-hover:translate-x-0.5"></i>
      </button>` : ''}
    </div>`
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  if(_imgObserver) body.querySelectorAll('.lz-img').forEach(img => _imgObserver.observe(img));
  setTimeout(()=>{
    content.classList.remove('scale-95','opacity-0');
    content.classList.add('scale-100','opacity-100');
  },10);
};

window.closePlatformModal = function(){
  const modal=$('platModal'), content=$('platModalContent');
  content.classList.remove('scale-100','opacity-100');
  content.classList.add('scale-95','opacity-0');
  setTimeout(()=>{
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  },200);
};

function setupTrendingScroll(){
  const grid = $('trendingGrid');
  if(!grid) return;
  let raf = null;

  grid.parentElement.addEventListener('mousemove', e => {
    const rect = grid.parentElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    const zone = 90; 
    const maxSpeed = 5; 

    cancelAnimationFrame(raf);

    if(x > w - zone) {

      const speed = maxSpeed * ((x - (w - zone)) / zone);
      const scroll = () => {
        grid.scrollLeft += speed;
        if(grid.scrollLeft < grid.scrollWidth - grid.clientWidth)
          raf = requestAnimationFrame(scroll);
      };
      raf = requestAnimationFrame(scroll);
    } else if(x < zone) {
      const speed = maxSpeed * ((zone - x) / zone);

      const scroll = () => {
        grid.scrollLeft -= speed;
        if(grid.scrollLeft > 0)
          raf = requestAnimationFrame(scroll);
      };
      raf = requestAnimationFrame(scroll);
    }
  });

  grid.parentElement.addEventListener('mouseleave', () => {
    cancelAnimationFrame(raf);
  });
}



window.openReportModal = function(name, url){
  const m=$('reportModal'), mc=$('reportModalContent');
  $('reportSiteName').textContent = name;
  $('reportSiteUrl').value = url;
  $('reportSiteNameHidden').value = name;
  $('reportReason').value = '';

  document.querySelectorAll('.reason-btn').forEach(b => {
    b.classList.remove('border-amber-400','text-amber-600','bg-amber-50','dark:bg-amber-500/10');
    b.classList.add('border-slate-200','dark:border-slate-700','text-slate-600','dark:text-slate-400');
  });

  const wrap = document.getElementById('otherReasonWrap');
  if(wrap){ wrap.style.maxHeight='0'; wrap.style.opacity='0'; wrap.classList.add('hidden'); }
  const ta = document.getElementById('otherReasonText');
  if(ta) ta.value = '';
  m.classList.remove('hidden'); m.classList.add('flex');
  setTimeout(()=>{ mc.classList.remove('scale-95','opacity-0'); mc.classList.add('scale-100','opacity-100'); },10);
};
window.closeReportModal = function(){
  const m=$('reportModal'), mc=$('reportModalContent');
  mc.classList.remove('scale-100','opacity-100'); mc.classList.add('scale-95','opacity-0');
  setTimeout(()=>{ m.classList.add('hidden'); m.classList.remove('flex'); },200);
};
window.submitReport = async function(){
  const name = $('reportSiteNameHidden').value;
  const url  = $('reportSiteUrl').value;
  let reason = $('reportReason').value.trim() || 'Sabab ko\'rsatilmagan';
  if(reason === 'Boshqa muammo'){
    const extra = ($('otherReasonText').value||'').trim();
    if(extra) reason = 'Boshqa muammo: ' + extra;
  }
  const btn = $('reportSubmitBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-1.5"></i> Yuborilmoqda...';
  try {
    await fetch(SUPA_PROXY, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ path: '/rest/v1/reports', method: 'POST', prefer: 'return=minimal', body: { site_name: name, site_url: url, reason, created_at: new Date().toISOString() } })
    });
    sendTelegram(`⚠️ <b>Muammo bildirish</b>\n\n🌐 Sayt: <b>${name}</b>\n🔗 ${url}\n❗ Sabab: ${reason}\n⏰ ${new Date().toLocaleString('uz')}`);
    closeReportModal();
    showToast("Xabar yuborildi, rahmat! Ko'rib chiqamiz.", 'fa-circle-check text-emerald-400');
  } catch(e){
    showToast("Xato yuz berdi, qayta urining", 'fa-circle-xmark text-red-400');
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-paper-plane mr-1.5"></i> Yuborish';
};



window.openSuggestModal = function(){
  const m=$('suggestModal'), mc=$('suggestModalContent');
  ['suggestName','suggestUrl','suggestDesc','suggestContact'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
  m.classList.remove('hidden'); m.classList.add('flex');
  setTimeout(()=>{ mc.classList.remove('scale-95','opacity-0'); mc.classList.add('scale-100','opacity-100'); },10);
  setTimeout(()=>$('suggestName')?.focus(), 150);
};
window.closeSuggestModal = function(){
  const m=$('suggestModal'), mc=$('suggestModalContent');
  mc.classList.remove('scale-100','opacity-100'); mc.classList.add('scale-95','opacity-0');
  setTimeout(()=>{ m.classList.add('hidden'); m.classList.remove('flex'); },200);
};
window.submitSuggest = async function(){
  const name    = $('suggestName').value.trim();
  let   url     = $('suggestUrl').value.trim();
  const desc    = $('suggestDesc').value.trim();
  const contact = $('suggestContact').value.trim();
  if(!name || !url) return showToast("Nomi va URL kiritilishi shart!", 'fa-circle-xmark text-red-400');
  if(!url.startsWith('http')) url = 'https://'+url;
  const btn = $('suggestSubmitBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-1.5"></i> Yuborilmoqda...';
  try {
    await fetch(SUPA_PROXY, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ path: '/rest/v1/suggestions', method: 'POST', prefer: 'return=minimal', body: { name, url, description: desc, contact, created_at: new Date().toISOString(), status:'pending' } })
    });
    sendTelegram(`💡 <b>Yangi resurs taklifi</b>\n\n📌 Nomi: <b>${name}</b>\n🔗 ${url}${desc?'\n📝 '+desc:''}${contact?'\n👤 '+contact:''}\n⏰ ${new Date().toLocaleString('uz')}`);
    closeSuggestModal();
    showToast("Taklifingiz qabul qilindi! Tez orada ko'rib chiqamiz 🙏", 'fa-circle-check text-emerald-400');
  } catch(e){
    showToast("Xato yuz berdi, qayta urining", 'fa-circle-xmark text-red-400');
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-paper-plane mr-1.5"></i> Taklif qilish';
};

function init() {
  _imgObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      const realSrc = img.dataset.src;
      if (realSrc && img.src !== realSrc) img.src = realSrc;
      obs.unobserve(img);
    });
  }, { rootMargin: '200px 0px' });

  const _mutObs = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.classList?.contains('lz-img')) _imgObserver.observe(node);
        node.querySelectorAll?.('.lz-img').forEach(img => _imgObserver.observe(img));
      });
    });
  });
  _mutObs.observe(document.body, { childList: true, subtree: true });

  async function _syncSiteResources() {
    try {
      const res = await fetch(SUPA_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/rest/v1/site_resources?select=*&is_active=eq.true', method: 'GET' })
      });
      if (!res.ok) return false;
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) return false;
      rows.forEach(sr => {
        if (!sr.name || !sr.url) return;
        let found = false;
        DATA.forEach(cat => {
          const idx = cat.items.findIndex(i => i.n?.toLowerCase() === sr.name?.toLowerCase());
          if (idx !== -1) {
            found = true;
            cat.items[idx] = {
              ...cat.items[idx],
              u: sr.url || cat.items[idx].u,
              d: sr.description || cat.items[idx].d,
              t: sr.tags?.length ? sr.tags : cat.items[idx].t,
              v: sr.verified ?? cat.items[idx].v,
              ...(sr.logo_url ? { logoUrl: sr.logo_url } : {}),
              ...(sr.android  ? { androidUrl: sr.android } : {}),
              ...(sr.ios      ? { iosUrl: sr.ios } : {}),
            };
          }
        });
        if (!found) {
          const newItem = {
            n: sr.name, u: sr.url, d: sr.description || '',
            t: sr.tags?.length ? sr.tags : ['web'],
            v: sr.verified ?? true, _fromAdmin: true,
            ...(sr.logo_url ? { logoUrl: sr.logo_url } : {}),
            ...(sr.android  ? { androidUrl: sr.android } : {}),
            ...(sr.ios      ? { iosUrl: sr.ios } : {}),
          };
          const targetCat  = sr.category_id ? DATA.find(c => c.id === sr.category_id) : null;
          const fallbackCat = DATA.find(c => c.id === 'uzbekistan') || DATA[1];
          const cat = targetCat || fallbackCat;
          if (cat) cat.items.unshift(newItem);
        }
      });
      return true;
    } catch (e) { console.warn('[sync] site_resources:', e.message); return false; }
  }

  initCustomApps();
  setupSearch();
  setupTheme();
  setupShare();
  setupScroll();
  setupTrendingScroll();

  Promise.all([_syncUserData(), _syncSiteResources()]).then(() => {
    renderNav();
    renderContent(); // globalClicks cache dan yuklanadi — to'g'ri sonlar ko'rinadi
    const idle = typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : cb => setTimeout(cb, 100);
    idle(() => {
      renderTrending();
      renderRecent();
      initGlobalClicks(); // server bilan sinxronlaydi va DOM ni yangilaydi
      updateSidebarStats();
    });
  });
}
init();


window.selectReason = function(btn, reason) {

  document.querySelectorAll('.reason-btn').forEach(b => {
    b.classList.remove('border-amber-400','text-amber-600','bg-amber-50','dark:bg-amber-500/10');
    b.classList.add('border-slate-200','dark:border-slate-700','text-slate-600','dark:text-slate-400');
  });

  btn.classList.add('border-amber-400','text-amber-600','bg-amber-50','dark:bg-amber-500/10');
  btn.classList.remove('border-slate-200','dark:border-slate-700');
  document.getElementById('reportReason').value = reason;


  const wrap = document.getElementById('otherReasonWrap');
  const ta   = document.getElementById('otherReasonText');
  if(reason === 'Boshqa muammo'){
    wrap.classList.remove('hidden');
  wrap.style.display = 'flex';
    requestAnimationFrame(()=>{ wrap.style.maxHeight='200px'; wrap.style.opacity='1'; });
    ta.focus();
  } else {
    wrap.style.maxHeight='0';
    wrap.style.opacity='0';
    setTimeout(()=>{ wrap.classList.add('hidden'); ta.value=''; }, 280);
  }
};

const SORT_LABELS = {
  def:     { label: 'Standart tartib', icon: 'fa-bars-staggered' },
  popular: { label: '🔥 Eng mashhur',  icon: null },
  az:      { label: 'A → Z',           icon: 'fa-arrow-down-a-z' },
  za:      { label: 'Z → A',           icon: 'fa-arrow-up-a-z' },
};

function updateSortDropLabel(val){
  const info = SORT_LABELS[val] || SORT_LABELS.def;
  const labelEl = document.getElementById('sortDropLabel');
  const iconEl  = document.getElementById('sortDropIcon');
  if(labelEl) labelEl.textContent = info.label;
  if(iconEl){
    if(info.icon){ iconEl.className = `fa-solid ${info.icon} text-violet-400 text-[10px]`; iconEl.textContent = ''; }
    else { iconEl.className = ''; iconEl.textContent = ''; }
  }

  document.querySelectorAll('.sort-opt').forEach(b => {
    const isActive = b.dataset.val === val;
    b.classList.toggle('bg-violet-50', isActive);
    b.classList.toggle('dark:bg-violet-500/10', isActive);
    b.classList.toggle('text-violet-600', isActive);
    b.classList.toggle('dark:text-violet-400', isActive);
    b.classList.toggle('font-bold', isActive);
  });
}

window.toggleSortDrop = function(){
  const menu = document.getElementById('sortDropMenu');
  const chevron = document.getElementById('sortChevron');
  if(!menu) return;
  const isOpen = !menu.classList.contains('hidden');
  if(isOpen){
    menu.classList.add('hidden');
    if(chevron) chevron.style.transform = '';
  } else {
    menu.classList.remove('hidden');
    if(chevron) chevron.style.transform = 'rotate(180deg)';
  }
};

window.setSortMode = function(val){
  sortMode = val;

  const ss = document.getElementById('sSort');
  if(ss) ss.value = val;
  const ts = document.getElementById('topSort');
  if(ts) ts.value = val;
  updateSortDropLabel(val);

  const menu = document.getElementById('sortDropMenu');
  const chevron = document.getElementById('sortChevron');
  if(menu) menu.classList.add('hidden');
  if(chevron) chevron.style.transform = '';
  renderNav(); renderContent();
};


document.addEventListener('click', function(e){
  const wrap = document.getElementById('sortDropWrap');
  if(wrap && !wrap.contains(e.target)){
    const menu = document.getElementById('sortDropMenu');
    const chevron = document.getElementById('sortChevron');
    if(menu) menu.classList.add('hidden');
    if(chevron) chevron.style.transform = '';
  }
});


const TOP_SORT_LABELS = {
  def:     'Standart',
  popular: '🔥 Mashhur',
  az:      'A → Z',
  za:      'Z → A',
};

function updateTopSortLabel(val){
  const lbl = document.getElementById('topSortDropLabel');
  if(lbl) lbl.textContent = TOP_SORT_LABELS[val] || 'Standart';
  const icon = document.getElementById('topSortDropIcon');
  const icons = { def:'fa-bars-staggered', az:'fa-arrow-down-a-z', za:'fa-arrow-up-a-z', popular:'' };
  if(icon){
    if(icons[val]) icon.className = `fa-solid ${icons[val]} text-violet-400 text-[10px]`;
    else { icon.className=''; icon.textContent=''; }
  }
  document.querySelectorAll('.top-sort-opt').forEach(b => {
    const active = b.dataset.top === val;
    b.classList.toggle('bg-violet-50', active);
    b.classList.toggle('dark:bg-violet-500/10', active);
    b.classList.toggle('text-violet-600', active);
    b.classList.toggle('font-bold', active);
  });
}

window.toggleTopSortDrop = function(){
  const menu = document.getElementById('topSortDropMenu');
  const chev = document.getElementById('topSortChevron');
  if(!menu) return;
  const open = !menu.classList.contains('hidden');
  menu.classList.toggle('hidden', open);
  if(chev) chev.style.transform = open ? '' : 'rotate(180deg)';
};


document.addEventListener('click', function(e){
  const wrap = document.getElementById('topSortDropWrap');
  if(wrap && !wrap.contains(e.target)){
    const menu = document.getElementById('topSortDropMenu');
    const chev = document.getElementById('topSortChevron');
    if(menu) menu.classList.add('hidden');
    if(chev) chev.style.transform = '';
  }
});


const _origSetSortMode = window.setSortMode;
window.setSortMode = function(val){
  _origSetSortMode(val);
  updateTopSortLabel(val);

  const menu = document.getElementById('topSortDropMenu');
  const chev = document.getElementById('topSortChevron');
  if(menu) menu.classList.add('hidden');
  if(chev) chev.style.transform = '';
};

// ═══════════════════════════════════════════════════════════
//  📤 RO'YXAT TUZISH VA ULASHISH TIZIMI
//  Shaxsiy ro'yxat = faqat o'zi uchun (private)
//  Bu tizim = do'stlar uchun alohida ro'yxat tuzish + ulashish
// ═══════════════════════════════════════════════════════════


function encodeShareList(data){
  try{
    const json = JSON.stringify(data);
    if(typeof LZString !== 'undefined')
      return LZString.compressToEncodedURIComponent(json);
    return btoa(unescape(encodeURIComponent(json)));
  }catch(e){ return null; }
}
function decodeShareList(str){
  try{
    let json;
    if(typeof LZString !== 'undefined')
      json = LZString.decompressFromEncodedURIComponent(str);
    if(!json) json = decodeURIComponent(escape(atob(str))); 
    return JSON.parse(json);
  }catch(e){ return null; }
}


function getAllCatalogItems(){
  const all = [];
  DATA.forEach(cat => {
    if(cat.id === 'my_apps') return; 
    cat.items.forEach(item => all.push({...item, _catId: cat.id, _catTitle: cat.title}));
  });
  return all;
}


let _builderSelected = new Map(); 

window.openListBuilderModal = function(){
  const existing = document.getElementById('listBuilderModal');
  if(existing) existing.remove();
  _builderSelected = new Map();

  const allItems = getAllCatalogItems();
  const cats = {};
  allItems.forEach(i => {
    if(!cats[i._catId]) cats[i._catId] = {title: i._catTitle, items:[]};
    cats[i._catId].items.push(i);
  });

  const modal = document.createElement('div');
  modal.id = 'listBuilderModal';
  modal.className = 'fixed inset-0 z-[550] flex items-end sm:items-center justify-center';
  modal.innerHTML = `
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="closeListBuilderModal()"></div>
    <div id="listBuilderBox" class="relative glass w-full max-w-3xl sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col transform translate-y-4 opacity-0 transition-all duration-200" style="max-height:92dvh">

      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-slate-700/60 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow shadow-violet-500/30 shrink-0">
            <i class="fa-solid fa-list-check text-sm"></i>
          </div>
          <div>
            <h3 class="text-sm font-black text-slate-900 dark:text-white">Ro'yxat tuzish va ulashish</h3>
            <p class="text-[10px] text-slate-400">Resurslarni tanlang yoki o'zinikini qo'shing</p>
          </div>
        </div>
        <button onclick="closeListBuilderModal()" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700/80 text-slate-400 hover:bg-red-100 hover:text-red-500 transition-colors flex items-center justify-center">
          <i class="fa-solid fa-xmark text-sm"></i>
        </button>
      </div>

      <!-- Search + count/select bar + "O'z resursimni qo'shish" -->
      <div class="px-4 pt-3 pb-2 shrink-0 space-y-2">
        <!-- Search with X clear button -->
        <div class="relative flex items-center">
          <i class="fa-solid fa-magnifying-glass absolute left-3 text-slate-300 text-xs pointer-events-none"></i>
          <input id="builderSearch" type="text" placeholder="Resurs qidirish..."
            class="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-slate-800 dark:text-slate-200 transition-all"
            oninput="filterBuilderItems(this.value); builderSearchToggleX(this.value)">
          <button id="builderSearchX" onclick="clearBuilderSearch()" title="Tozalash"
            class="absolute right-2.5 hidden w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 hover:bg-red-100 hover:text-red-500 transition-all flex items-center justify-center">
            <i class="fa-solid fa-xmark text-[10px]"></i>
          </button>
        </div>
        <!-- Select all / clear / count bar -->
        <div class="flex items-center justify-between px-0.5">
          <div class="flex gap-3">
            <button onclick="builderSelectAll(true)" class="text-[11px] font-bold text-violet-500 hover:text-violet-700 transition-colors">Barchasi</button>
            <span class="text-slate-300 dark:text-slate-600">|</span>
            <button onclick="builderSelectAll(false)" class="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Tozalash</button>
          </div>
          <span id="builderCount" class="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">0 tanlandi</span>
        </div>
        <!-- Shaxsiy resurs qo'shish paneli -->
        <div id="builderAddWrap" class="rounded-2xl border border-dashed border-violet-300/60 dark:border-violet-600/40 overflow-hidden">
          <button onclick="toggleBuilderAddForm()" id="builderAddToggleBtn"
            class="w-full flex items-center gap-2 px-3.5 py-2 text-[11px] font-bold text-violet-500 hover:bg-violet-50/80 dark:hover:bg-violet-500/10 transition-all">
            <div class="w-5 h-5 rounded-md bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center shrink-0">
              <i class="fa-solid fa-plus text-[9px]"></i>
            </div>
            O'z resursimni qo'shish
            <i id="builderAddChevron" class="fa-solid fa-chevron-down text-[9px] ml-auto text-slate-400 transition-transform duration-200"></i>
          </button>
          <div id="builderAddForm" class="hidden px-3 pb-3 space-y-2">
            <!-- Nomi + Tavsif -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nomi <span class="text-red-400">*</span></label>
                <input id="bcName" type="text" placeholder="Mening blogim" maxlength="40"
                  class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-slate-800 dark:text-slate-200 transition-all">
              </div>
              <div>
                <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tavsif</label>
                <input id="bcDesc" type="text" placeholder="Qisqacha..." maxlength="60"
                  class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-slate-800 dark:text-slate-200 transition-all">
              </div>
            </div>
            <!-- Veb-sayt -->
            <div>
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5 block">
                <i class="fa-solid fa-globe text-blue-400 text-[9px]"></i> Veb-sayt URL
              </label>
              <input id="bcUrl" type="url" placeholder="https://sayt.uz"
                class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-800 dark:text-slate-200 transition-all">
            </div>
            <!-- Mobil ilovalar toggle -->
            <div>
              <button type="button" onclick="toggleBcMobile()" id="bcMobileToggleBtn"
                class="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-violet-500 transition-colors">
                <i id="bcMobileChevron" class="fa-solid fa-chevron-right text-[8px] transition-transform duration-200"></i>
                <i class="fa-solid fa-mobile-screen-button text-[9px]"></i>
                Mobil ilova (ixtiyoriy)
              </button>
              <div id="bcMobileFields" class="hidden mt-2 space-y-1.5">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <i class="fa-brands fa-android text-emerald-600 dark:text-emerald-400 text-[11px]"></i>
                  </div>
                  <input id="bcAndroid" type="url" placeholder="https://play.google.com/store/apps/details?id=..."
                    class="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-slate-800 dark:text-slate-200 transition-all">
                </div>
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    <i class="fa-brands fa-apple text-slate-700 dark:text-slate-300 text-[11px]"></i>
                  </div>
                  <input id="bcIos" type="url" placeholder="https://apps.apple.com/app/..."
                    class="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-slate-500/30 text-slate-800 dark:text-slate-200 transition-all">
                </div>
              </div>
            </div>
            <button onclick="addBuilderCustomItem()"
              class="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold rounded-xl py-2.5 text-xs transition-all hover:opacity-90 active:scale-[0.98] shadow-sm shadow-violet-500/25">
              <i class="fa-solid fa-plus-circle"></i> Ro'yxatga qo'shish
            </button>
          </div>
        </div>
      </div>

      <!-- Items list — 2 col grid -->
      <div id="builderList" class="flex-1 overflow-y-auto px-3 pb-2 space-y-3">
        <!-- Shaxsiy qo'shilgan resurslar -->
        <div id="builderCustomGroup" class="hidden">
          <p class="text-[10px] font-black text-violet-400 uppercase tracking-wider px-1 py-1.5 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10"><i class="fa-solid fa-star mr-1"></i>O'zim qo'shganlarim</p>
          <div id="builderCustomItems" class="grid grid-cols-2 sm:grid-cols-3 gap-2"></div>
        </div>
        ${Object.entries(cats).map(([catId, cat])=>`
          <div class="builder-cat-group" data-cat="${catId}">
            <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1 py-2 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 border-b border-slate-100 dark:border-slate-800/80 mb-1">${cat.title}</p>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              ${cat.items.map(item=>{
                const key = item.n;
                const hasMob  = item.t?.includes('mobil');
                const hasWeb  = item.t?.includes('web');
                const isBepul = item.t?.includes('bepul');
                return `<label class="builder-item flex items-start gap-3 p-3 rounded-2xl border border-transparent hover:border-violet-200 dark:hover:border-violet-600/40 hover:bg-violet-50/60 dark:hover:bg-violet-500/10 cursor-pointer transition-all group has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50 dark:has-[:checked]:bg-violet-500/15 dark:has-[:checked]:border-violet-500/60" data-name="${(item.n||'').toLowerCase()}" data-desc="${(item.d||'').toLowerCase()}">
                  <input type="checkbox" class="builder-chk mt-0.5 w-4 h-4 rounded accent-violet-500 shrink-0" data-key="${key}" onchange="builderToggle(this,'${key.replace(/'/g,"\'")}')">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-0.5">
                      <div class="card-logo-wrap w-8 h-8 rounded-xl shrink-0">
                        ${iconHTML(item, 'w-full h-full object-contain')}
                      </div>
                      <p class="text-[13px] font-bold text-slate-800 dark:text-slate-200 truncate leading-tight group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">${item.n}</p>
                    </div>
                    ${item.d ? `<p class="text-[11px] text-slate-400 truncate leading-snug mt-0.5">${item.d}</p>` : ''}
                    <div class="flex gap-1 mt-1 flex-wrap">
                      ${isBepul ? `<span class="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">Bepul</span>` : ''}
                      ${hasWeb  ? `<span class="text-[9px] font-bold bg-blue-100 dark:bg-blue-500/15 text-blue-500 dark:text-blue-400 px-2 py-0.5 rounded-full"><i class="fa-solid fa-globe text-[8px] mr-0.5"></i>Web</span>` : ''}
                      ${hasMob  ? `<span class="text-[9px] font-bold bg-sky-100 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-full"><i class="fa-solid fa-mobile-screen-button text-[8px] mr-0.5"></i>Ilova</span>` : ''}
                    </div>
                  </div>
                </label>`;
              }).join('')}
            </div>
          </div>`).join('')}
      </div>
      <!-- Footer — faqat "Davom etish" tugmasi -->
      <div class="shrink-0 border-t border-slate-200/60 dark:border-slate-700/60 px-4 py-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm sm:rounded-b-3xl rounded-b-none">
        <button onclick="openBuilderShareStep()" id="builderNextBtn"
          disabled
          class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold rounded-xl py-3 text-sm transition-all shadow-lg shadow-violet-500/25 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed">
          <i class="fa-solid fa-share-nodes text-sm"></i> Davom etish va ulashish
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  requestAnimationFrame(()=> requestAnimationFrame(()=>{
    const box = document.getElementById('listBuilderBox');
    if(box){ box.classList.remove('translate-y-4','opacity-0'); box.classList.add('translate-y-0','opacity-100'); }
  }));
};
window.builderToggle = function(chk, key){
  const allItems = getAllCatalogItems();
  const item = allItems.find(i => i.n === key);
  if(chk.checked && item) _builderSelected.set(key, item);
  else _builderSelected.delete(key);
  updateBuilderCount();
};

window.filterBuilderItems = function(q){
  const term = q.trim().toLowerCase();
  document.querySelectorAll('.builder-item').forEach(el=>{
    const match = !term || el.dataset.name?.includes(term) || el.dataset.desc?.includes(term);
    el.style.display = match ? '' : 'none';
  });
  document.querySelectorAll('.builder-cat-group').forEach(g=>{
    const visible = [...g.querySelectorAll('.builder-item')].some(el=>el.style.display!=='none');
    g.style.display = visible ? '' : 'none';
  });
};


window.toggleBcMobile = function(){
  const fields = document.getElementById('bcMobileFields');
  const chev   = document.getElementById('bcMobileChevron');
  if(!fields) return;
  const hidden = fields.classList.contains('hidden');
  fields.classList.toggle('hidden', !hidden);
  if(chev) chev.style.transform = hidden ? 'rotate(90deg)' : '';
  if(hidden) setTimeout(()=> document.getElementById('bcAndroid')?.focus(), 80);
};

window.builderSelectAll = function(val){
  document.querySelectorAll('.builder-chk').forEach(chk=>{
    if(chk.closest('.builder-item')?.style.display === 'none') return;
    chk.checked = val;
    const key = chk.dataset.key;
    if(val){
      const allItems = getAllCatalogItems();
      const item = allItems.find(i=>i.n===key);
      if(item) _builderSelected.set(key, item);
    } else _builderSelected.delete(key);
  });
  updateBuilderCount();
};

function updateBuilderCount(){
  const n = _builderSelected.size;
  const el = document.getElementById('builderCount');
  if(el) el.textContent = `${n} tanlandi`;
  const btn = document.getElementById('builderNextBtn');
  if(btn) btn.disabled = n === 0;
}


window.builderSearchToggleX = function(val){
  const xBtn = document.getElementById('builderSearchX');
  if(!xBtn) return;
  if(val && val.trim()){
    xBtn.classList.remove('hidden'); xBtn.classList.add('flex');
  } else {
    xBtn.classList.add('hidden'); xBtn.classList.remove('flex');
  }
};
window.clearBuilderSearch = function(){
  const inp = document.getElementById('builderSearch');
  if(inp){ inp.value=''; inp.focus(); }
  filterBuilderItems('');
  const xBtn = document.getElementById('builderSearchX');
  if(xBtn){ xBtn.classList.add('hidden'); xBtn.classList.remove('flex'); }
};

window.toggleBuilderAddForm = function(){
  const form = document.getElementById('builderAddForm');
  const chev = document.getElementById('builderAddChevron');
  if(!form) return;
  const hidden = form.classList.contains('hidden');
  form.classList.toggle('hidden', !hidden);
  if(chev) chev.style.transform = hidden ? 'rotate(180deg)' : '';
  if(hidden) setTimeout(()=> document.getElementById('bcName')?.focus(), 80);
};

window.addBuilderCustomItem = function(){
  const nameEl    = document.getElementById('bcName');
  const urlEl     = document.getElementById('bcUrl');
  const descEl    = document.getElementById('bcDesc');
  const androidEl = document.getElementById('bcAndroid');
  const iosEl     = document.getElementById('bcIos');
  const name    = nameEl?.value.trim();
  const url     = urlEl?.value.trim()     || '';
  const desc    = descEl?.value.trim()    || '';
  const android = androidEl?.value.trim() || '';
  const ios     = iosEl?.value.trim()     || '';
  if(!name){ showToast("Nomi kiritilishi shart!", "fa-circle-xmark text-red-500"); nameEl?.focus(); return; }
  if(!url && !android && !ios){ showToast("Kamida bitta URL kiritilishi shart!", "fa-circle-xmark text-red-500"); urlEl?.focus(); return; }
  const key = '__c__' + name;
  if(_builderSelected.has(key)){ showToast("Bu resurs allaqachon qo'shilgan!", "fa-triangle-exclamation text-amber-500"); return; }

  const tags = [];
  if(url)     tags.push('web');
  if(android || ios) tags.push('mobil');
  const item = { n:name, u:url, d:desc, t:tags, isCustom:true,
    ...(android ? {android} : {}), ...(ios ? {ios} : {}) };
  _builderSelected.set(key, item);
  updateBuilderCount();

  const group = document.getElementById('builderCustomGroup');
  const list  = document.getElementById('builderCustomItems');
  if(group) group.classList.remove('hidden');
  if(list){
    const domain = getDomain(url||android||'');
    const row = document.createElement('div');
    row.className = 'builder-item flex items-start gap-2 p-2.5 rounded-2xl border border-violet-300 dark:border-violet-500/50 bg-violet-50 dark:bg-violet-500/15 animate-fade-up relative';
    row.dataset.customKey = key;
    row.innerHTML = `
      <i class="fa-solid fa-check-circle text-violet-500 text-xs mt-0.5 shrink-0"></i>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 mb-0.5">
          <div class="w-6 h-6 rounded-lg overflow-hidden bg-white dark:bg-slate-800 border border-violet-200/60 dark:border-violet-600/30 flex items-center justify-center shrink-0">
            ${domain ? `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" class="w-5 h-5 object-contain" onerror="this.style.display='none'">` : '<i class="fa-solid fa-star text-violet-400 text-[9px]"></i>'}
          </div>
          <p class="text-xs font-bold text-violet-700 dark:text-violet-300 truncate leading-tight">${name}</p>
        </div>
        ${desc ? `<p class="text-[9px] text-slate-400 truncate">${desc}</p>` : ''}
        <div class="flex gap-1 mt-1 flex-wrap">
          ${url     ? '<span class="text-[8px] font-black bg-blue-100 dark:bg-blue-500/15 text-blue-500 px-1.5 py-0.5 rounded-full"><i class="fa-solid fa-globe text-[7px] mr-0.5"></i>Web</span>' : ''}
          ${android ? '<span class="text-[8px] font-black bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 px-1.5 py-0.5 rounded-full"><i class="fa-brands fa-android text-[8px] mr-0.5"></i>Android</span>' : ''}
          ${ios     ? '<span class="text-[8px] font-black bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full"><i class="fa-brands fa-apple text-[8px] mr-0.5"></i>iOS</span>' : ''}
        </div>
      </div>
      <button onclick="removeBuilderCustomItem('${key.replace(/'/g,"\'")}',this.closest('[data-custom-key]'))"
        class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all">
        <i class="fa-solid fa-xmark text-[9px]"></i>
      </button>`;
    list.appendChild(row);
  }

  [nameEl,urlEl,descEl,androidEl,iosEl].forEach(el=>{ if(el) el.value=''; });
  showToast(`"${name}" qo'shildi ✨`, 'fa-circle-check text-violet-400');
};

window.removeBuilderCustomItem = function(key, rowEl){
  _builderSelected.delete(key);
  updateBuilderCount();
  if(rowEl){ rowEl.style.transition='all .15s'; rowEl.style.opacity='0'; rowEl.style.transform='scale(.95)'; setTimeout(()=>rowEl.remove(),150); }
  setTimeout(()=>{
    const list = document.getElementById('builderCustomItems');
    const group = document.getElementById('builderCustomGroup');
    if(list && group && list.querySelectorAll('[data-custom-key]').length===0) group.classList.add('hidden');
  },200);
};

window.closeListBuilderModal = function(){
  const modal = document.getElementById('listBuilderModal');
  if(!modal) return;
  const box = document.getElementById('listBuilderBox');
  box.classList.add('translate-y-4','opacity-0');
  setTimeout(()=>modal.remove(), 200);
};


window.openBuilderShareStep = function(){
  if(!_builderSelected.size) return;
  const existing = document.getElementById('builderShareModal');
  if(existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'builderShareModal';
  modal.className = 'fixed inset-0 z-[560] flex items-center justify-center px-4';
  modal.innerHTML = `
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="closeBuilderShareModal()"></div>
    <div id="builderShareBox" class="relative glass rounded-3xl shadow-2xl w-full max-w-sm p-6 transform scale-95 opacity-0 transition-all duration-200 border border-slate-200 dark:border-slate-700">
      <button onclick="closeBuilderShareModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-red-100 hover:text-red-500 transition-colors flex items-center justify-center">
        <i class="fa-solid fa-xmark text-sm"></i>
      </button>

      <!-- Back -->
      <button onclick="closeBuilderShareModal()" class="flex items-center gap-1.5 text-[11px] font-bold text-violet-500 hover:text-violet-700 mb-4 transition-colors">
        <i class="fa-solid fa-chevron-left text-[10px]"></i> Orqaga
      </button>

      <!-- Header -->
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/30 shrink-0">
          <i class="fa-solid fa-share-nodes text-base"></i>
        </div>
        <div>
          <h3 class="text-sm font-black text-slate-900 dark:text-white">Ro'yxatni ulashish</h3>
          <p class="text-[11px] text-slate-400">${_builderSelected.size} ta resurs tanlandi</p>
        </div>
      </div>

      <!-- Preview favicons -->
      <div class="flex items-center gap-1 mb-4 flex-wrap">
        ${[..._builderSelected.values()].slice(0,7).map(i=>{
          const domain = getDomain(i.u||'');
          return `<div class="w-7 h-7 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
            ${domain ? `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" class="w-6 h-6 object-contain" onerror="this.style.display='none'">` : `<i class="fa-solid fa-globe text-slate-300 text-xs"></i>`}
          </div>`;
        }).join('')}
        ${_builderSelected.size > 7 ? `<span class="text-[11px] font-bold text-slate-400 ml-1">+${_builderSelected.size-7}</span>` : ''}
      </div>

      <!-- Form -->
      <div class="space-y-3 mb-4">
        <div>
          <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ro'yxat nomi</label>
          <input id="bsTitle" type="text" maxlength="40"
            placeholder="Masalan: Dev vositalarim 🚀"
            value="Mening tavsiyalarim"
            class="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-slate-800 dark:text-slate-200 transition-all">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Muallif <span class="font-normal normal-case">(ixtiyoriy)</span></label>
          <input id="bsAuthor" type="text" maxlength="30"
            placeholder="@telegram yoki ismingiz"
            class="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 text-slate-800 dark:text-slate-200 transition-all">
        </div>
      </div>

      <!-- Link output -->
      <div id="bsLinkWrap" class="hidden mb-4">
        <div class="flex items-center justify-between mb-1">
          <label class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tayyor havola</label>
          <span id="bsLinkBadge" class="text-[10px] font-bold text-emerald-500"></span>
        </div>
        <div class="flex gap-2 mb-2.5">
          <div class="flex-1 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 rounded-xl px-3 py-2.5 text-[11px] font-mono text-violet-700 dark:text-violet-300 truncate cursor-default select-text" id="bsLinkText"></div>
          <button onclick="copyBuilderLink()" id="bsCopyBtn"
            class="shrink-0 w-10 flex items-center justify-center bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-all active:scale-95">
            <i class="fa-solid fa-copy text-xs"></i>
          </button>
        </div>
        <!-- Ulashish tugmalari -->
        <div class="grid grid-cols-3 gap-1.5">
          <button onclick="shareVia('tg')" class="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 text-[#2AABEE] text-[11px] font-bold transition-all border border-[#2AABEE]/20 active:scale-95">
            <i class="fa-brands fa-telegram text-sm"></i> Telegram
          </button>
          <button onclick="shareVia('wa')" class="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] text-[11px] font-bold transition-all border border-[#25D366]/20 active:scale-95">
            <i class="fa-brands fa-whatsapp text-sm"></i> WhatsApp
          </button>
          <button onclick="shareVia('qr')" id="bsQrBtn" class="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-500/20 text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 text-[11px] font-bold transition-all border border-slate-200 dark:border-slate-700 active:scale-95">
            <i class="fa-solid fa-qrcode text-sm"></i> QR kod
          </button>
        </div>
        <!-- QR panel -->
        <div id="bsQrWrap" class="hidden mt-2 items-center justify-center py-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700" style="display:none">
          <img id="bsQrImg" src="" class="rounded-lg" alt="QR kod" width="150" height="150">
        </div>
      </div>

      <!-- Buttons -->
      <div class="flex gap-2">
        <button onclick="generateBuilderLink()" id="bsGenBtn"
          class="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 text-white font-bold rounded-xl py-3 text-sm transition-all shadow-lg shadow-violet-500/25 active:scale-[0.98]">
          <i class="fa-solid fa-wand-magic-sparkles"></i> Havola yaratish
        </button>
        <button id="bsNativeBtn" onclick="nativeBuilderShare()" class="hidden shrink-0 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-violet-100 dark:hover:bg-violet-500/20 hover:text-violet-600 transition-all items-center justify-center">
          <i class="fa-solid fa-share-nodes text-sm"></i>
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  setTimeout(()=>{
    document.getElementById('builderShareBox').classList.remove('scale-95','opacity-0');
    document.getElementById('builderShareBox').classList.add('scale-100','opacity-100');
  },10);
  if(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && navigator.share){
    const nb = document.getElementById('bsNativeBtn');
    nb.classList.remove('hidden'); nb.classList.add('flex');
  }
};

window.closeBuilderShareModal = function(){
  const m = document.getElementById('builderShareModal');
  if(!m) return;
  document.getElementById('builderShareBox').classList.add('scale-95','opacity-0');
  setTimeout(()=>m.remove(), 200);
};


function genShortCode(len){
  len = len||8;
  const ch='abcdefghijklmnopqrstuvwxyz0123456789';
  let s=''; for(let i=0;i<len;i++) s+=ch[Math.floor(Math.random()*ch.length)]; return s;
}

window.generateBuilderLink = async function(){
  const genBtn = document.getElementById('bsGenBtn');
  const title  = document.getElementById('bsTitle')?.value.trim() || "Mening tavsiyalarim";
  const author = document.getElementById('bsAuthor')?.value.trim() || '';
  if(genBtn){ genBtn.disabled=true; genBtn.innerHTML='<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saqlanmoqda...'; }

  const items = [..._builderSelected.values()].map(i=>({
    n:i.n, u:i.u||'',
    ...(i.d?{d:i.d}:{}),
    ...(i.t&&i.t.length?{t:i.t}:{}),
    ...(i.isCustom?{c:1}:{})
  }));
  const data = {v:3, title, ...(author?{a:author}:{}), items, ts:Date.now()};

  let shortCode=null;
  try{
    const code = genShortCode(8);
    const res = await fetch(SUPA_PROXY,{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({path:'/rest/v1/shared_lists',method:'POST',body:{id:code,data:JSON.stringify(data),views:0}})
    });
    if(res.ok) shortCode=code;
  }catch(e){console.warn('[share]',e.message);}

  let url;
  if(shortCode){
    url='https://elink.uz/share-'+shortCode;
  } else {
    const enc=encodeShareList(data);
    if(!enc){showToast("Xato yuz berdi","fa-circle-xmark text-red-500");
      if(genBtn){genBtn.disabled=false;genBtn.innerHTML='<i class="fa-solid fa-wand-magic-sparkles"></i> Havola yaratish';} return;}
    url='https://elink.uz/#s='+enc;
  }
  window._bsUrl=url; window._bsTitle=title;

  const wrap=document.getElementById('bsLinkWrap');
  const txt=document.getElementById('bsLinkText');
  if(wrap) wrap.classList.remove('hidden');
  if(txt)  txt.textContent=url;
  const badge=document.getElementById('bsLinkBadge');
  if(badge) badge.textContent = shortCode ? `✓ ${url.length} belgi` : '(offline)';
  if(genBtn){genBtn.disabled=false; genBtn.innerHTML='<i class="fa-solid fa-rotate-right mr-1"></i> Yangilash';}


  if(/Mobi|Android|iPhone/i.test(navigator.userAgent)&&navigator.share){
    const nb=document.getElementById('bsNativeBtn');
    if(nb){nb.classList.remove('hidden');nb.classList.add('flex');}
  }
};
window.copyBuilderLink = async function(){
  const url = window._bsUrl;
  if(!url) return;
  try{ await navigator.clipboard.writeText(url); }
  catch(e){
    const t=document.createElement('input');t.value=url;
    document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);
  }
  const btn = document.getElementById('bsCopyBtn');
  if(btn){ btn.innerHTML='<i class="fa-solid fa-check text-xs"></i>'; btn.classList.add('bg-emerald-500'); }
  showToast('Havola nusxalandi! 🎉', 'fa-link text-violet-400');
  setTimeout(()=>{
    const b = document.getElementById('bsCopyBtn');
    if(b){ b.innerHTML='<i class="fa-solid fa-copy text-xs"></i>'; b.classList.remove('bg-emerald-500'); }
  }, 2200);
};

window.nativeBuilderShare = async function(){
  if(!window._bsUrl){ generateBuilderLink(); }
  const url = window._bsUrl;
  const title = window._bsTitle || "Mening tavsiyalarim";
  try{ await navigator.share({ title: title + ' — E-Link UZ', text: `${_builderSelected.size} ta foydali resursni ko'ring!`, url }); }
  catch(e){}
};




window.shareVia = function(via){
  const url   = window._bsUrl;
  const title = window._bsTitle||"E-Link ro'yxati";
  if(!url){showToast('Avval havola yarating!','fa-circle-xmark text-amber-500');return;}
  if(via==='tg') window.open('https://t.me/share/url?url='+encodeURIComponent(url)+'&text='+encodeURIComponent(title+' — E-Link UZ'),'_blank');
  else if(via==='wa') window.open('https://wa.me/?text='+encodeURIComponent(title+' — E-Link UZ\n'+url),'_blank');
  else if(via==='qr') toggleBuilderQr(url);
};

function toggleBuilderQr(url){
  const wrap = document.getElementById('bsQrWrap');
  const img  = document.getElementById('bsQrImg');
  const btn  = document.getElementById('bsQrBtn');
  if(!wrap) return;
  if(!wrap.classList.contains('hidden')){
    wrap.classList.add('hidden');
    if(btn) btn.classList.remove('bg-violet-100','dark:bg-violet-500/20','text-violet-600','dark:text-violet-400');
    return;
  }
  if(img) img.src='https://api.qrserver.com/v1/create-qr-code/?size=150x150&data='+encodeURIComponent(url)+'&color=6D28D9&bgcolor=FFFFFF&qzone=1&margin=8';
  wrap.classList.remove('hidden');
  wrap.style.display = 'flex';
  if(btn) btn.classList.add('bg-violet-100','dark:bg-violet-500/20','text-violet-600','dark:text-violet-400');
}


async function detectShareHash(){

  const pathMatch = location.pathname.match(/\/share-([a-z0-9]{4,16})$/i);

  const hashLMatch = !pathMatch && location.hash.match(/^#l=([a-z0-9]{4,16})$/);

  const code = (pathMatch||hashLMatch)?.[1];
  if(code){

    if(pathMatch) history.replaceState(null,'', '/');
    else history.replaceState(null,'', location.pathname + location.search);


    showListPage({title:'Yuklanmoqda...', items:[]}, code, 0);

    try{
      const res = await fetch(SUPA_PROXY,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({path:'/rest/v1/shared_lists?id=eq.'+code+'&select=data,views',method:'GET'})
      });
      if(res.ok){
        const rows = await res.json();
        if(Array.isArray(rows)&&rows[0]){
          const data = JSON.parse(rows[0].data);
          if(data&&Array.isArray(data.items)&&data.items.length){
            fetch(SUPA_PROXY,{method:'POST',headers:{'Content-Type':'application/json'},
              body:JSON.stringify({path:'/rest/v1/rpc/increment_list_views',method:'POST',body:{p_id:code}})
            }).catch(()=>{});

            const existing = document.getElementById('importListModal');
            if(existing) existing.remove();
            showListPage(data, code, (rows[0].views||0)+1);
            return;
          }
        }
      }
    }catch(e){console.warn('[share]',e.message);}

    const existing = document.getElementById('importListModal');
    if(existing) existing.remove();
    showToast("Ro'yxat topilmadi yoki muddati o'tgan","fa-circle-xmark text-red-500");
    return;
  }


  const hash = location.hash;
  if(!hash || hash.length < 3) return;
  history.replaceState(null,'', location.pathname + location.search);
  const fullMatch = hash.match(/^#s=(.+)/);
  if(!fullMatch) return;
  const data = decodeShareList(fullMatch[1]);
  if(!data||!Array.isArray(data.items)||!data.items.length) return;
  showListPage(data, null, 0);
}


function showListPage(data, shortCode, viewCount){
  const existing = document.getElementById('importListModal');
  if(existing) existing.remove();
  const items    = data.items||[];
  const title    = data.title||"Ulashilgan ro'yxat";
  const author   = data.a||data.author||'';
  const ts       = data.ts ? new Date(data.ts).toLocaleDateString('uz-UZ',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';
  const shareUrl = shortCode ? `https://elink.uz/share-${shortCode}` : location.href;
  const existNames = new Set([
    ...customApps.map(i=>i.n.toLowerCase()),
    ...DATA.flatMap(c=>c.items.map(i=>i.n.toLowerCase()))
  ]);

  const modal = document.createElement('div');
  modal.id = 'importListModal';
  modal.className = 'fixed inset-0 z-[600] flex items-end sm:items-center justify-center';
  modal.innerHTML = `
    <div class="absolute inset-0 bg-slate-900/75 backdrop-blur-md"></div>
    <div id="importListBox" class="relative glass w-full max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col transform translate-y-4 opacity-0 transition-all duration-200 overflow-hidden" style="max-height:92dvh">

      <!-- Gradient banner -->
      <div class="relative bg-gradient-to-br from-violet-600 via-fuchsia-500 to-pink-500 px-5 pt-5 pb-5 shrink-0 overflow-hidden">
        <div class="absolute inset-0 opacity-10" style="background-image:radial-gradient(circle,white 1px,transparent 1px);background-size:20px 20px"></div>
        <div class="relative flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 mb-2">
              <span class="bg-white/25 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">E-Link UZ · Ulashilgan ro'yxat</span>
            </div>
            <h2 class="text-xl font-black text-white leading-tight mb-2 pr-8">${title}</h2>
            <div class="flex items-center gap-2 flex-wrap">
              ${author ? `<span class="flex items-center gap-1 bg-white/25 text-white text-[11px] font-bold px-2.5 py-1 rounded-full"><i class="fa-solid fa-user text-[9px]"></i>${author}</span>` : ''}
              <span class="flex items-center gap-1 bg-white/25 text-white text-[11px] font-bold px-2.5 py-1 rounded-full"><i class="fa-solid fa-boxes-stacked text-[9px]"></i>${items.length} ta resurs</span>
              ${viewCount ? `<span class="flex items-center gap-1 bg-white/25 text-white text-[11px] font-bold px-2.5 py-1 rounded-full"><i class="fa-solid fa-eye text-[9px]"></i>${viewCount.toLocaleString()}</span>` : ''}
              ${ts ? `<span class="text-white/60 text-[10px] ml-1">${ts}</span>` : ''}
            </div>
          </div>
          <button onclick="closeImportModal()" class="w-9 h-9 rounded-full bg-white/25 hover:bg-white/40 text-white flex items-center justify-center transition-all shrink-0 absolute top-0 right-0">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>
        <!-- Favicon strip -->
        <div class="flex items-center gap-1.5 mt-3 flex-wrap">
          ${items.slice(0,12).map(item=>{
            const d=getDomain(item.u||'');
            return d ? `<div class="w-7 h-7 rounded-lg bg-white/25 overflow-hidden flex items-center justify-center shrink-0 border border-white/20">
              <img src="https://www.google.com/s2/favicons?domain=${d}&sz=32" class="w-5 h-5" loading="lazy" onerror="this.style.display='none'">
            </div>` : '';
          }).join('')}
          ${items.length>12?`<span class="text-white/70 text-[11px] font-bold">+${items.length-12}</span>`:''}
        </div>
      </div>

      <!-- Share bar -->
      <div class="shrink-0 px-3 py-2 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2">
        <div class="flex-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate select-text">${shareUrl}</div>
        <button onclick="copyImportUrl('${shareUrl.replace(/'/g,"\\'")}','this')" class="w-8 h-8 flex items-center justify-center bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all active:scale-95 shrink-0" title="Nusxalash">
          <i class="fa-solid fa-copy text-xs"></i>
        </button>
        <button onclick="window.open('https://t.me/share/url?url='+encodeURIComponent('${shareUrl}')+'&text='+encodeURIComponent('${title.replace(/'/g,"\\'")} — E-Link UZ'),'_blank')"
          class="w-8 h-8 flex items-center justify-center bg-[#2AABEE]/15 hover:bg-[#2AABEE]/30 text-[#2AABEE] rounded-lg transition-all active:scale-95 shrink-0" title="Telegram">
          <i class="fa-brands fa-telegram text-sm"></i>
        </button>
        <button onclick="window.open('https://wa.me/?text='+encodeURIComponent('${title.replace(/'/g,"\\'")} — E-Link UZ\n${shareUrl}'),'_blank')"
          class="w-8 h-8 flex items-center justify-center bg-[#25D366]/15 hover:bg-[#25D366]/30 text-[#25D366] rounded-lg transition-all active:scale-95 shrink-0" title="WhatsApp">
          <i class="fa-brands fa-whatsapp text-sm"></i>
        </button>
      </div>

      <!-- Items -->
      <div class="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" id="importItemsList">
        ${items.map((item,idx)=>{
          const exists = existNames.has((item.n||'').toLowerCase());
          const isBepul= (item.t||[]).includes('bepul');
          const hasWeb = (item.t||[]).includes('web');
          const isMob  = (item.t||[]).includes('mobil');
          const isCustom = item.isCustom || item.c;
          const openUrl  = item.u || item.android || item.ios || '';
          return `<label class="flex items-center gap-3 px-2.5 py-2.5 rounded-2xl hover:bg-violet-50/60 dark:hover:bg-violet-500/10 cursor-pointer transition-all group ${exists?'bg-emerald-50/40 dark:bg-emerald-500/5':''}">
            <input type="checkbox" class="import-chk w-4 h-4 rounded accent-violet-500 shrink-0" data-idx="${idx}" ${exists?'':'checked'}>
            <div class="card-logo-wrap w-9 h-9 rounded-xl shrink-0 relative shadow-sm ${exists?'ring-2 ring-emerald-400/60':''}">
              ${iconHTML(item, 'w-full h-full object-contain')}
              ${exists?`<div class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm z-10"><i class="fa-solid fa-check text-white text-[7px]"></i></div>`:''}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-sm font-bold text-slate-800 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">${item.n||''}</span>
                ${exists?`<span class="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full"><i class="fa-solid fa-check text-[7px] mr-0.5"></i>Saqlangan</span>`:''}
                ${isCustom?`<span class="text-[9px] font-bold bg-violet-100 dark:bg-violet-500/15 text-violet-600 px-1.5 py-0.5 rounded-full"><i class="fa-solid fa-star text-[8px] mr-0.5"></i>Shaxsiy</span>`:''}
              </div>
              ${item.d?`<p class="text-[10px] text-slate-400 truncate mt-0.5">${item.d}</p>`:''}
              ${domain?`<p class="text-[10px] text-slate-300 dark:text-slate-600 truncate font-mono">${domain}</p>`:''}
              <div class="flex gap-1 mt-0.5">${isBepul?`<span class="badge-bepul">✓ Bepul</span>`:''} ${hasWeb?`<span class="badge-web"><i class="fa-solid fa-globe text-[9px]"></i></span>`:''} ${isMob?`<span class="badge-mob"><i class="fa-solid fa-mobile-screen-button text-[9px]"></i></span>`:''}</div>
            </div>
            <div class="flex flex-col gap-1 shrink-0">
              ${openUrl?`<a href="${openUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:text-blue-500 transition-all" title="Ochib ko'rish"><i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i></a>`:''}
            </div>
          </label>`;
        }).join('')}
      </div>

      <!-- Footer -->
      <div class="shrink-0 px-4 py-3 border-t border-slate-200/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm sm:rounded-b-3xl">
        <div class="flex items-center justify-between mb-2.5">
          <div class="flex gap-3">
            <button onclick="importToggleAll(true)" class="text-[11px] font-bold text-violet-500 hover:text-violet-700">Barchasi</button>
            <span class="text-slate-300 dark:text-slate-600">|</span>
            <button onclick="importToggleAll(false)" class="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Hech biri</button>
          </div>
          <span id="importSelCount" class="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg"></span>
        </div>
        <button onclick="doImport()" id="doImportBtn"
          class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 text-white font-bold rounded-xl py-3 text-sm transition-all shadow-lg shadow-violet-500/25 active:scale-[0.98]">
          <i class="fa-solid fa-download"></i>
          <span id="doImportBtnTxt">Shaxsiy ro'yxatga qo'shish</span>
        </button>
        <p class="text-[10px] text-slate-400 text-center mt-1.5">Tanlangan resurslar "Shaxsiy ro'yxat"ga qo'shiladi</p>
      </div>
    </div>`;

  document.body.appendChild(modal);
  window._importData = data;
  requestAnimationFrame(()=> requestAnimationFrame(()=>{
    const box = document.getElementById('importListBox');
    if(box){box.classList.remove('translate-y-4','opacity-0');box.classList.add('translate-y-0','opacity-100');}
  }));
  updateImportSelCount();
  modal.querySelectorAll('.import-chk').forEach(c=>c.addEventListener('change',updateImportSelCount));
}


function showImportModal(data){ showListPage(data,null,0); }


window.copyImportUrl = async function(url){
  try{ await navigator.clipboard.writeText(url); }
  catch(e){ const t=document.createElement('input');t.value=url;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t); }
  showToast('Havola nusxalandi! 🎉','fa-link text-violet-400');
};


function updateImportSelCount(){
  const chks = document.querySelectorAll('.import-chk');
  const n = [...chks].filter(c=>c.checked).length;
  const el = document.getElementById('importSelCount');
  if(el) el.textContent = `${n} tanlandi`;
  const btn = document.getElementById('doImportBtnTxt');
  if(btn) btn.textContent = n ? `${n} ta resursni qo'shish` : "Shaxsiy ro'yxatga qo'shish";
}

window.importToggleAll = function(val){
  document.querySelectorAll('.import-chk').forEach(c=>{ c.checked=val; });
  updateImportSelCount();
};

window.closeImportModal = function(){
  const m = document.getElementById('importListModal');
  if(!m) return;
  const box = document.getElementById('importListBox');
  if(box){
    box.classList.remove('translate-y-0','opacity-100');
    box.classList.add('translate-y-4','opacity-0');
  }
  setTimeout(()=>{ if(m.parentNode) m.remove(); }, 250);
};

window.doImport = function(){
  const data = window._importData;
  if(!data) return;
  const items = data.items||[];
  const chks  = document.querySelectorAll('.import-chk');
  const selected = [...chks].filter(c=>c.checked).map(c=>items[+c.dataset.idx]).filter(Boolean);
  if(!selected.length){ showToast("Hech narsa tanlanmadi!", "fa-circle-xmark text-amber-500"); return; }

  let added=0, skipped=0;
  selected.forEach(item=>{
    const already = customApps.some(a=>a.n.toLowerCase()===(item.n||'').toLowerCase());
    if(already){ skipped++; return; }
    const newApp = { n:item.n, u:item.u||'', d:item.d||'', t:item.t||[], isCustom:true };

    const aUrl = item.androidUrl || item.android || '';
    const iUrl = item.iosUrl     || item.ios     || '';
    if(aUrl) newApp.androidUrl = aUrl;
    if(iUrl) newApp.iosUrl     = iUrl;
    customApps.push(newApp);
    added++;
  });
  if(!added && skipped){ showToast("Tanlangan resurslar allaqachon mavjud!", "fa-circle-info text-blue-500"); return; }
  if(!added){ showToast("Hech narsa tanlanmadi!", "fa-circle-xmark text-amber-500"); return; }
  localStorage.setItem('lh_custom_apps', JSON.stringify(customApps));
  saveUserDataToSupabase();

  window.closeImportModal();
  setTimeout(()=>{
    showToast(`🎉 ${added} ta resurs shaxsiy ro'yxatga qo'shildi!`, 'fa-circle-check text-emerald-400');
    if(activeCat!=='my_apps') setCat('my_apps');
    else{ renderNav(); renderContent(); }
  }, 280);
};



detectShareHash();


(function initOnboarding(){
  if(localStorage.getItem('lh_onboarded')) return;
  if(location.hash && location.hash.startsWith('#import')) return;
  if(new URLSearchParams(location.search).get('list')) return;

  /* Oq SVG ikonalar — fa-solid Font Awesome */
  const _obi = (fa) => `<i class="fa-solid ${fa} text-white text-xl"></i>`;
  const STEPS = [
    {
      id:0, iconFA:'fa-link',
      title:"eLink UZ ga\nxush kelibsiz!",
      subtitle:"O'zbekistonning eng katta onlayn resurslar katalogi. 1700+ foydali sayt va ilova — bitta joyda.",
      feats:[
        {faIco:'fa-layer-group',     bg:'from-violet-500 to-fuchsia-500', title:'1700+ resurs katalogi',     desc:"Ta'lim, davlat xizmatlari, AI vositalar va yana ko'plab sohalar"},
        {faIco:'fa-magnifying-glass',bg:'from-violet-400 to-purple-600',  title:'Tez va aqlli qidiruv',      desc:"Kategoriya bo'yicha yoki barcha resurslardan bir zumda toping"},
        {faIco:'fa-moon',            bg:'from-slate-600 to-slate-900',    title:'Qulay interfeys',           desc:"Tungi rejim, mobil va kompyuter uchun optimallashtirilgan"}
      ]
    },
    {
      id:1, iconFA:'fa-thumbtack',
      title:"Shaxsiy linklar\nqo'shing va saqlang",
      subtitle:"O'zingizning sevimli saytlaringizni qo'shing — istalgan vaqt 1 klik bilan kiring.",
      feats:[
        {faIco:'fa-plus',        bg:'from-sky-500 to-cyan-500',    title:"Har qanday saytni qo'shing", desc:"O'z shaxsiy resurslaringizni katalogga qo'shing va boshqaring"},
        {faIco:'fa-heart',       bg:'from-rose-500 to-pink-500',   title:"Sevimlilar ro'yxati",        desc:"Tez-tez foydalanayotgan resurslarni ♥ bilan belgilang"},
        {faIco:'fa-cloud',       bg:'from-blue-500 to-indigo-600', title:'Bulutda sinxronlanadi',      desc:"Ro'yxatingiz barcha qurilmalaringizda avtomatik saqlanadi"}
      ]
    },
    {
      id:2, iconFA:'fa-share-nodes',
      title:"Ro'yxat tuzing\nva ulashing",
      subtitle:"Telegram kanal yoki guruhingiz uchun foydali resurslar to'plamini tuzing va bitta qisqa URL orqali ulashing.",
      feats:[
        {faIco:'fa-rectangle-list', bg:'from-emerald-500 to-teal-600', title:"Maxsus to'plam yarating",   desc:"Kerakli resurslarni tanlang, sarlavha bering va kutubxona hosil qiling"},
        {faIco:'fa-link',           bg:'from-teal-500 to-cyan-600',    title:"1 ta qisqa URL",            desc:"Bir marta ulashing — barcha a'zolar tezda foydalansin"},
        {faIco:'fa-paper-plane',    bg:'from-cyan-500 to-blue-600',    title:"Telegram / WhatsApp orqali",desc:"Havola orqali do'stlar to'plamingizni bir bosishda import qilsin"}
      ]
    }
  ];

  let step=0;

  function render(dir){
    const s=STEPS[step];
    const box=document.getElementById('onboardBox');
    box.className=box.className.replace(/ob-step-\d/g,'').trim()+' ob-step-'+s.id;


    document.getElementById('obDots').innerHTML=
      STEPS.map((_,i)=>`<div class="ob-dot${i===step?' active':''}"></div>`).join('');


      let pb=box.querySelector('.ob-progress');
    if(!pb){pb=document.createElement('div');pb.className='ob-progress';box.querySelector('.ob-header').appendChild(pb);}
    pb.style.width=((step+1)/STEPS.length*100)+'%';

    const cls=dir>=0?'ob-slide-in':'ob-slide-in-left';
    const anim=el=>{el.classList.remove('ob-slide-in','ob-slide-in-left');void el.offsetWidth;el.classList.add(cls);};

    const ico=document.getElementById('obIcon');
    ico.innerHTML=`<i class="fa-solid ${s.iconFA} text-white text-2xl"></i>`; anim(ico);

    const ttl=document.getElementById('obTitle');
    ttl.innerHTML=s.title.replace('\n','<br>'); anim(ttl);

    const sub=document.getElementById('obSubtitle');
    sub.textContent=s.subtitle; anim(sub);

    const body=document.getElementById('obBody');
    body.innerHTML=s.feats.map((f,i)=>`
      <div class="ob-feat" style="animation-delay:${i*0.06}s">
        <div class="ob-feat-ico bg-gradient-to-br ${f.bg} flex items-center justify-center"><i class="fa-solid ${f.faIco} text-white text-base"></i></div>
        <div class="min-w-0">
          <p class="text-sm font-black text-slate-800 dark:text-white leading-snug">${f.title}</p>
          <p class="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">${f.desc}</p>
        </div>
      </div>`).join('');
    anim(body);

    const back=document.getElementById('obBack');
    back.classList.toggle('opacity-0',step===0);
    back.classList.toggle('pointer-events-none',step===0);

    document.getElementById('obNextTxt').textContent=step===STEPS.length-1?'Boshlash':'Davom etish';
    document.getElementById('obNextIco').className=step===STEPS.length-1?'fa-solid fa-rocket text-sm':'fa-solid fa-arrow-right text-sm';
  }

  window.obStep=function(dir){
    if(dir>0&&step<STEPS.length-1){step++;render(dir);}
    else if(dir<0&&step>0){step--;render(dir);}
    else if(dir>0&&step===STEPS.length-1){closeOnboard();}
  };

  window.closeOnboard=function(){
    localStorage.setItem('lh_onboarded','1');
    const modal=document.getElementById('onboardModal');
    const box=document.getElementById('onboardBox');
    box.style.transform='translateY(16px) scale(0.97)';
    box.style.opacity='0';
    setTimeout(()=>{modal.classList.add('hidden');modal.classList.remove('flex');},300);
  };

  document.addEventListener('keydown',e=>{
    const modal=document.getElementById('onboardModal');
    if(modal?.classList.contains('hidden')) return;
    if(e.key==='ArrowRight'||e.key==='Enter') obStep(1);
    if(e.key==='ArrowLeft') obStep(-1);
    if(e.key==='Escape') closeOnboard();
  });

  // Swipe
  let _tx=null;
  document.getElementById('onboardBox')?.addEventListener('touchstart',e=>{_tx=e.touches[0].clientX;},{passive:true});
  document.getElementById('onboardBox')?.addEventListener('touchend',e=>{
    if(_tx===null) return;
    const dx=e.changedTouches[0].clientX-_tx;
    if(Math.abs(dx)>50) obStep(dx<0?1:-1);
    _tx=null;
  });

  setTimeout(()=>{
    const modal=document.getElementById('onboardModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    render(1);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const box=document.getElementById('onboardBox');
      box.style.transform='translateY(0)';
      box.style.opacity='1';
    }));
  },900);
})();