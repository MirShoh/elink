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
        <span class="text-[11px] font-bold text-slate-800 dark:text-white">${item.n}</span>
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
      <div class="font-black text-[14px] text-slate-900 dark:text-white leading-snug flex items-center gap-1.5">
        <span class="truncate">${hl(safeName,q2)}</span>
        ${isVerified ? `<span class="verified-icon" title="Rasmiy va ishonchli platforma"><i class="fa-solid fa-shield-halved"></i></span>` : ''}
      </div>
      <div class="flex flex-wrap gap-1 mt-1.5 items-center">${badges}</div>
    </div>
  </div>

  <!-- DESCRIPTION -->
  <p class="text-[11.5px] text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors line-clamp-2 leading-relaxed ${isCustom?'':'flex-1'} relative z-10">${hl(safeDesc,q2)}</p>

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
const collBtn = navBtn(`setCat('collections')`, 'Tavsiyalar', 'fa-star', 'Tavsiyalar',
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
  $('pageTitle').textContent='Tavsiyalar';
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
  $('resultCount').textContent=collections.length+' ta tavsiya to\'plami';

  const wrap=document.createElement('div');
  wrap.className='animate-fade-up';

  wrap.innerHTML=`
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
      <div class="relative flex-1 w-full">
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]"></i>
        <input id="colSearch" placeholder="Tavsiya to'plamini qidirish..." oninput="filterCollections(this.value)"
          class="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-400 placeholder-slate-400">
      </div>
      <button onclick="openNewCollectionModal()"
        class="shrink-0 flex items-center gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 text-white font-bold rounded-xl px-4 py-2.5 text-[12px] transition-all shadow-lg shadow-violet-500/25 active:scale-[0.98] whitespace-nowrap">
        <i class="fa-solid fa-plus text-[10px]"></i> Yangi tavsiya
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
  'my':      { label:'Mening tavsiyalarim', icon:'fa-folder-heart', color:'text-fuchsia-600 dark:text-fuchsia-400', bg:'bg-fuchsia-50 dark:bg-fuchsia-500/10', border:'border-fuchsia-200 dark:border-fuchsia-500/20' },
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
              <p class="text-[10px] text-slate-400">Tavsiyaga resurs qo'shing</p>
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
    const h=document.querySelector('#newCollectionModal h3'); if(h) h.textContent='Tavsiyani tahrirlash';
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
  showToast('Tavsiya yangilandi!','fa-circle-check text-emerald-400');
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
        <h3 class="text-[13px] font-black text-slate-800 dark:text-white flex-1">Yangi tavsiya</h3>
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
  if(!confirm("Tavsiyani o'chirmoqchimisiz?")) return;
  userCollections=userCollections.filter(c=>c.id!==id);
  saveUserCollections();
  renderContent();
  showToast("Tavsiya o'chirildi",'fa-circle-check text-emerald-400');
};


function renderContent(){

if(!window.DATA || !Array.isArray(window.DATA) || window.DATA.length === 0){
  setTimeout(()=>{ if(window.DATA?.length) renderContent(); }, 100);
  return;
}
// Qidiruv holatiga qarab trending ko'rsat/yashir (renderTrending faqat click/load da chaqiriladi)
const _tSec=$('trendingSection');
if(_tSec){ if(query&&query.trim()) _tSec.classList.add('hidden'); else _tSec.classList.remove('hidden'); }
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
  const _histCount = (()=>{ try{ return JSON.parse(localStorage.getItem('lh_my_shares_v2')||'[]').length; }catch(e){ return 0; } })();
  const _histBtn = _histCount > 0
    ? `<button onclick="openShareHistoryDrawer()" style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.7);border:1px solid rgba(139,92,246,0.35);border-radius:12px;padding:7px 12px;font-size:12px;font-weight:800;color:#7c3aed;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all .15s" onmouseover="this.style.background='rgba(237,233,254,0.9)'" onmouseout="this.style.background='rgba(255,255,255,0.7)'"><i class="fa-solid fa-share-nodes" style="font-size:10px;"></i> Ulashganlar <span style="background:rgba(139,92,246,0.15);color:#7c3aed;font-size:10px;font-weight:700;padding:1px 6px;border-radius:99px;">${_histCount}</span></button>`
    : '';
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;padding:16px 20px;border-radius:16px;background:linear-gradient(to right,rgba(139,92,246,0.12),rgba(217,70,239,0.12));border:2px solid rgba(139,92,246,0.25);box-shadow:0 1px 4px rgba(139,92,246,0.08);">
      <!-- Icon -->
      <div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#8b5cf6,#d946ef);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 14px rgba(139,92,246,0.35);flex-shrink:0;">
        <i class="fa-solid fa-list-check" style="font-size:16px;"></i>
      </div>
      <!-- Text -->
      <div style="flex:1;min-width:0;">
        <p style="font-size:14px;font-weight:900;color:#1e1b4b;line-height:1.3;margin:0;">Ro\u2019yxat tuzish va ulashish</p>
        <p style="font-size:11px;color:#64748b;margin:3px 0 0;line-height:1.4;">Resurslarni qo\u2019shing va qisqa havola orqali ulashing</p>
      </div>
      <!-- Buttons -->
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
        ${_histBtn}
        <button onclick="openListBuilderModal()" style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#8b5cf6,#d946ef);color:#fff;font-size:12px;font-weight:800;border:none;border-radius:12px;padding:9px 18px;cursor:pointer;box-shadow:0 4px 14px rgba(139,92,246,0.35);white-space:nowrap;transition:opacity .15s;" onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">
          <i class="fa-solid fa-wand-magic-sparkles" style="font-size:11px;"></i> Ro\u2019yxat tuzish
        </button>
      </div>
    </div>`;
  sec.appendChild(banner);

  /* ── ULASHILGAN RO'YXATLAR — BANNER ICHIDA ─────────────────── */
  const hist = (()=>{ try{ return JSON.parse(localStorage.getItem('lh_my_shares_v2')||'[]'); }catch(e){ return []; } })();
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
  $('pageTitle').textContent='Barcha resurslar';
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
    $('pageTitle').textContent = 'Barcha resurslar';
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
  // themeBtnTop dagi ko'rinadigan matnni ham yangilaymiz
  const tTxtTop = $('themeBtnTop')?.querySelector('span');
  if(tTxtTop) tTxtTop.textContent = dark ? 'Kunduzgi rejim' : 'Tungi rejim';
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

  // _syncSiteResources() va applyDeletedResources() ketma-ket — avval sync, keyin delete
  // (parallel bo'lsa deleted resurs qayta qo'shilishi mumkin edi)
  Promise.all([_syncUserData(), _syncSiteResources()]).then(() => applyDeletedResources()).then(() => {
    renderNav();
    renderContent();
    if(typeof window._hideLoader === 'function') window._hideLoader();
    const idle = typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : cb => setTimeout(cb, 100);
    idle(() => {
      renderTrending();
      renderRecent();
      initGlobalClicks();
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

/* ── ULASHILGAN RO'YXATLAR — helper funksiyalar ──────────────────── */

async function _loadShareViews(histSlice){
  const codes = histSlice.map((h,idx)=>({code:h.code,idx})).filter(x=>x.code);
  if(!codes.length) return;
  try{
    const ids = codes.map(x=>x.code).join(',');
    const res = await fetch(typeof SUPA_PROXY!=='undefined'?SUPA_PROXY:'/.netlify/functions/supabase',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({path:'/rest/v1/shared_lists?id=in.('+ids+')&select=id,views',method:'GET'})
    });
    if(!res.ok) return;
    const rows = await res.json();
    if(!Array.isArray(rows)) return;
    rows.forEach(row=>{
      const entry = codes.find(x=>x.code===row.id);
      if(!entry) return;
      const el = document.getElementById('shViews_'+entry.idx);
      if(!el) return;
      const v = row.views||0;
      el.innerHTML = `<i class="fa-solid fa-eye text-violet-400 text-[9px]"></i><span class="text-violet-500 dark:text-violet-400 font-black">${v.toLocaleString()}</span><span class="text-slate-400 font-normal"> ko'rildi</span>`;
    });
  }catch(e){ console.warn('[shareViews]',e.message); }
}

window.copyShareHistUrl = async function(url, btn){
  try{ await navigator.clipboard.writeText(url); }
  catch(e){ const t=document.createElement('input');t.value=url;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t); }
  showToast('Havola nusxalandi! 🎉','fa-link text-violet-400');
  if(btn){
    const orig=btn.innerHTML;
    btn.innerHTML='<i class="fa-solid fa-check text-[10px]"></i> Nusxalandi';
    btn.classList.add('bg-emerald-50','dark:bg-emerald-500/15','text-emerald-600','dark:text-emerald-400','border-emerald-200');
    btn.classList.remove('bg-violet-50','dark:bg-violet-500/15','text-violet-600','dark:text-violet-400','border-violet-100');
    setTimeout(()=>{
      btn.innerHTML=orig;
      btn.classList.remove('bg-emerald-50','dark:bg-emerald-500/15','text-emerald-600','dark:text-emerald-400','border-emerald-200');
      btn.classList.add('bg-violet-50','dark:bg-violet-500/15','text-violet-600','dark:text-violet-400','border-violet-100');
    },2200);
  }
};

window.deleteShareHistory = function(url){
  // Tasdiqlash dialogi
  const existing = document.getElementById('_shareDelConfirm');
  if(existing) existing.remove();
  const dlg = document.createElement('div');
  dlg.id = '_shareDelConfirm';
  dlg.className = 'fixed inset-0 z-[700] flex items-center justify-center px-4';
  dlg.innerHTML = `
    <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onclick="document.getElementById('_shareDelConfirm').remove()"></div>
    <div class="relative glass rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 w-full max-w-xs text-center animate-fade-up">
      <div class="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/15 flex items-center justify-center mx-auto mb-3">
        <i class="fa-solid fa-trash text-red-500 text-sm"></i>
      </div>
      <p class="text-sm font-black text-slate-800 dark:text-white mb-1">O'chirilsinmi?</p>
      <p class="text-[11px] text-slate-400 mb-4">Bu ro'yxat tarixdan o'chiriladi</p>
      <div class="flex gap-2">
        <button onclick="document.getElementById('_shareDelConfirm').remove()"
          class="flex-1 py-2 rounded-xl text-[12px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
          Bekor
        </button>
        <button onclick="(function(){
          document.getElementById('_shareDelConfirm').remove();
          try{ const h=JSON.parse(localStorage.getItem('lh_my_shares_v2')||'[]'); localStorage.setItem('lh_my_shares_v2',JSON.stringify(h.filter(x=>x.url!=='${url.replace(/'/g,"\\'").replace(/\\/g,'\\\\')}')));  }catch(e){}
          const d=document.getElementById('shareHistDrawer'); if(d) d.remove();
          showToast('Ro\\'yxat o\\'chirildi','fa-trash text-slate-400');
          renderContent();
          setTimeout(openShareHistoryDrawer, 100);
        })()"
          class="flex-1 py-2 rounded-xl text-[12px] font-bold bg-red-500 hover:bg-red-600 text-white transition-all active:scale-95">
          O'chirish
        </button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
};

window.clearShareHistory = function(){
  const existing = document.getElementById('_shareDelConfirm');
  if(existing) existing.remove();
  const dlg = document.createElement('div');
  dlg.id = '_shareDelConfirm';
  dlg.className = 'fixed inset-0 z-[700] flex items-center justify-center px-4';
  dlg.innerHTML = `
    <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onclick="document.getElementById('_shareDelConfirm').remove()"></div>
    <div class="relative glass rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 w-full max-w-xs text-center animate-fade-up">
      <div class="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/15 flex items-center justify-center mx-auto mb-3">
        <i class="fa-solid fa-trash-can text-red-500 text-sm"></i>
      </div>
      <p class="text-sm font-black text-slate-800 dark:text-white mb-1">Barchasi o'chirilsinmi?</p>
      <p class="text-[11px] text-slate-400 mb-4">Barcha ulashgan ro'yxatlar tarixdan o'chiriladi</p>
      <div class="flex gap-2">
        <button onclick="document.getElementById('_shareDelConfirm').remove()"
          class="flex-1 py-2 rounded-xl text-[12px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
          Bekor
        </button>
        <button onclick="(function(){
          document.getElementById('_shareDelConfirm').remove();
          localStorage.removeItem('lh_my_shares_v2');
          const d=document.getElementById('shareHistDrawer'); if(d) d.remove();
          showToast('Tarix tozalandi','fa-trash text-slate-400');
          renderContent();
        })()"
          class="flex-1 py-2 rounded-xl text-[12px] font-bold bg-red-500 hover:bg-red-600 text-white transition-all active:scale-95">
          Tozalash
        </button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
};

/* ── ULASHILGAN RO'YXATLAR DRAWER ──────────────────────────────── */
window.openShareHistoryDrawer = function(){
  const existing = document.getElementById('shareHistDrawer');
  if(existing) existing.remove();

  const hist = (()=>{ try{ return JSON.parse(localStorage.getItem('lh_my_shares_v2')||'[]'); }catch(e){ return []; } })();
  if(!hist.length) return;

  const drawer = document.createElement('div');
  drawer.id = 'shareHistDrawer';
  drawer.className = 'fixed inset-0 z-[580] flex items-end sm:items-center justify-center';

  const rows = hist.map((h,idx)=>{
    const d = new Date(h.ts);
    const dateStr = d.toLocaleDateString('uz-UZ',{day:'2-digit',month:'2-digit',year:'2-digit'});
    const timeStr = d.toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'});
    const isShort = h.code && !h.url.includes('#s=');
    const safeUrl = h.url.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const safeTitle = (h.title||'E-Link ro\'yxati').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const tgUrl = 'https://t.me/share/url?url='+encodeURIComponent(h.url)+'&text='+encodeURIComponent((h.title||'E-Link ro\'yxati')+' — E-Link UZ');
    const waUrl = 'https://wa.me/?text='+encodeURIComponent((h.title||'E-Link ro\'yxati')+' — E-Link UZ\n'+h.url);
    return `
    <div class="flex items-center gap-3 px-4 py-3 hover:bg-violet-50/50 dark:hover:bg-violet-500/5 transition-colors group border-b border-slate-100 dark:border-slate-800/80 last:border-0">
      <!-- Icon -->
      <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
        <i class="fa-solid fa-share-nodes text-white text-[9px]"></i>
      </div>
      <!-- Info -->
      <div class="flex-1 min-w-0 cursor-pointer" onclick="openSharedListPreview('${safeUrl}')">
        <div class="flex items-center gap-1.5">
          <p class="text-[12px] font-black text-slate-800 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">${escHtml(h.title||"Ro'yxat")}</p>
          ${isShort
            ? `<span class="shrink-0 text-[8px] font-black bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">qisqa</span>`
            : `<span class="shrink-0 text-[8px] font-black bg-amber-50 dark:bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-full">hash</span>`}
        </div>
        <p class="text-[10px] text-slate-400 leading-none mt-0.5 flex items-center gap-1">
          <i class="fa-solid fa-layer-group text-[8px]"></i>${h.count||0} resurs
          <span class="text-slate-200 dark:text-slate-700">·</span>${dateStr} ${timeStr}
          ${isShort ? `<span class="text-slate-200 dark:text-slate-700">·</span><span id="shViews_${idx}"><i class="fa-solid fa-eye text-[8px] opacity-40"></i> —</span>` : ''}
        </p>
      </div>
      <!-- Actions -->
      <div class="flex items-center gap-0.5 shrink-0">
        <button onclick="copyShareHistUrl('${safeUrl}',this)" title="Nusxalash"
          class="h-7 px-2.5 flex items-center gap-1 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-[10px] font-bold transition-all active:scale-95 shadow-sm shadow-violet-500/20">
          <i class="fa-solid fa-copy text-[9px]"></i> <span class="hidden sm:inline text-[10px]">Nusxalash</span>
        </button>
        <button onclick="window.open('${tgUrl}','_blank')" title="Telegram"
          class="w-7 h-7 flex items-center justify-center rounded-lg text-[#2AABEE] hover:bg-[#2AABEE]/10 transition-all active:scale-95">
          <i class="fa-brands fa-telegram text-sm"></i>
        </button>
        <button onclick="window.open('${waUrl}','_blank')" title="WhatsApp"
          class="w-7 h-7 flex items-center justify-center rounded-lg text-[#25D366] hover:bg-[#25D366]/10 transition-all active:scale-95">
          <i class="fa-brands fa-whatsapp text-sm"></i>
        </button>
        <button onclick="deleteShareHistory('${safeUrl}')" title="O'chirish"
          class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all active:scale-95">
          <i class="fa-solid fa-trash text-[10px]"></i>
        </button>
      </div>
    </div>`;
  }).join('');

  drawer.innerHTML = `
    <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onclick="document.getElementById('shareHistDrawer').remove()"></div>
    <div id="shareHistBox" class="relative glass w-full max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col transform translate-y-4 opacity-0 transition-all duration-200 overflow-hidden" style="max-height:80dvh">

      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
            <i class="fa-solid fa-share-nodes text-white text-[10px]"></i>
          </div>
          <span class="text-[13px] font-black text-slate-800 dark:text-white">Ulashgan ro'yxatlarim</span>
          <span class="text-[10px] font-bold text-violet-500 bg-violet-50 dark:bg-violet-500/15 px-2 py-0.5 rounded-full">${hist.length}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <button onclick="clearShareHistory()" class="h-7 px-2.5 text-[10px] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all flex items-center gap-1">
            <i class="fa-solid fa-trash-can text-[9px]"></i> Hammasini o'chirish
          </button>
          <button onclick="document.getElementById('shareHistDrawer').remove()"
            class="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-all text-sm">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>
      </div>

      <!-- List -->
      <div class="flex-1 overflow-y-auto">
        ${rows}
      </div>
    </div>`;

  document.body.appendChild(drawer);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const box = document.getElementById('shareHistBox');
    if(box){ box.style.transform='translateY(0)'; box.style.opacity='1'; }
  }));

  // Esc
  const _esc = e=>{ if(e.key==='Escape'){ document.getElementById('shareHistDrawer')?.remove(); document.removeEventListener('keydown',_esc); } };
  document.addEventListener('keydown', _esc);

  // Views async yuklash
  _loadShareViews(hist.slice(0,30));
};

window.openSharedListPreview = async function(url){
  // URL dan code ni ajratib olish
  const m = url.match(/\/share-([a-z0-9]{4,16})\/?$/i);
  if(m){
    const code = m[1];
    showToast('Yuklanmoqda...','fa-spinner fa-spin text-violet-400');
    try{
      const res = await fetch(typeof SUPA_PROXY!=='undefined'?SUPA_PROXY:'/.netlify/functions/supabase',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({path:'/rest/v1/shared_lists?id=eq.'+code+'&select=data,views',method:'GET'})
      });
      if(res.ok){
        const rows=await res.json();
        if(Array.isArray(rows)&&rows[0]){
          const raw=rows[0].data;
          const data=typeof raw==='string'?JSON.parse(raw):raw;
          if(data&&data.items) { showListPage(data,code,(rows[0].views||0)); return; }
        }
      }
    }catch(e){}
    showToast("Ro'yxat topilmadi",'fa-circle-xmark text-red-500');
    return;
  }
  // Hash URL fallback
  const hm = url.match(/#s=(.+)/);
  if(hm){
    const data=decodeShareList(hm[1]);
    if(data&&data.items){ showListPage(data,null,0); return; }
  }
  window.open(url,'_blank');
};