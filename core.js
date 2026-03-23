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


