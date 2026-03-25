let _lzReady = typeof LZString !== 'undefined';
function _ensureLZ(cb){
  if(_lzReady){ cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js';
  s.onload = () => { _lzReady = true; cb(); };
  s.onerror = () => cb(); // fallback: btoa ishlaydi
  document.head.appendChild(s);
}


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
      title:"eLink ga\nxush kelibsiz!",
      subtitle:"O'zbekistonning eng katta onlayn resurslar katalogi. 3000+ foydali sayt va ilova — bitta joyda.",
      feats:[
        {faIco:'fa-layer-group',     bg:'from-violet-500 to-fuchsia-500', title:'3000+ resurs katalogi',     desc:"Ta'lim, davlat xizmatlari, AI vositalar va yana ko'plab sohalar"},
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