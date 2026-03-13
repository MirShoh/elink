// ═══════════════════════════════════════════════════════════
//  XAVFSIZ JSON PARSE (JS xatolar oldini olish uchun)
// ═══════════════════════════════════════════════════════════
function safeParse(key, fallback) {
  try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
  } catch (e) {
      return fallback;
  }
}

const SUPA_PROXY = '/.netlify/functions/supabase';

// ── Foydalanuvchi noyob ID (UUID, bir marta yaratiladi) ──────
function getOrCreateUserId(){
  let uid = localStorage.getItem('lh_uid');
  if(!uid){
    uid = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,9);
    localStorage.setItem('lh_uid', uid);
  }
  return uid;
}
const USER_ID = getOrCreateUserId();

// ── Supabase dan foydalanuvchi ma'lumotlarini yuklash ─────────
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

// ── Supabase ga saqlash (debounced 1.5s) ─────────────────────
let _syncTimer = null;
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
  }, 1500);
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

// Xotira
let globalClicks = {};

// ── Sahifa ochilganda: barcha kliklarni BIR so'rovda yuklash ──
async function initGlobalClicks(){
try {
  const res = await fetch(SUPA_PROXY, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ path: '/rest/v1/clicks?select=name,count&limit=1000', method: 'GET' })
  });
  if(!res.ok) return;
  const rows = await res.json();
  if(!Array.isArray(rows)) return;
  rows.forEach(r => { if(r.count > 0) globalClicks[r.name] = r.count; });
  Object.entries(globalClicks).forEach(([n, c]) => _updateCountEl(n, c));
  renderTrending();
  updateSidebarStats();
} catch(e){ console.warn('[E-Link] Supabase error:', e.message); }
}

// ── Klik: atomic increment (race-condition xavfsiz) ──
async function _supaIncrement(name){
try {
  const res = await fetch(SUPA_PROXY, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ path: '/rest/v1/rpc/increment_click', method: 'POST', body: { p_name: name } })
  });
  if(!res.ok) return null;
  const val = await res.json();
  return typeof val === 'number' ? val : null;
} catch(e){ return null; }
}

// ── DOM element yangilash ──
// DOM dagi klik elementini yangilash
function _updateCountEl(name, count){
const id = 'cb-' + name.replace(/[^a-zA-Z0-9]/g,'_');
const el = document.getElementById(id);
if(!el) return;
el.querySelector('span').textContent = count;
if(count > 0){
  el.classList.remove('text-slate-300','dark:text-slate-600','bg-slate-50','dark:bg-slate-800/40');
  el.classList.add('text-violet-500','dark:text-violet-400','bg-violet-50','dark:bg-violet-500/10');
}
}

// ═══════════════════════════════════════════════════════════
//  DATA — 330+ Premium va mahalliy resurslar to'plami
// ═══════════════════════════════════════════════════════════
let customApps = safeParse('lh_custom_apps', []);
// Supabase dan sinxronlash (sahifa yuklanganda)
(async ()=>{
  const remote = await loadUserDataFromSupabase();
  if(remote){
    // Agar remote yangroq bo'lsa — undan foydalan
    if(remote.customApps.length >= customApps.length){
      customApps = remote.customApps;
      localStorage.setItem('lh_custom_apps', JSON.stringify(customApps));
      const cat = DATA?.find(c=>c.id==='my_apps');
      if(cat){ cat.items = customApps; renderNav(); renderContent(); }
    }
    if(remote.favorites.length >= favorites.length){
      favorites = remote.favorites;
      localStorage.setItem('lh_favs', JSON.stringify(favorites));
      renderNav();
    }
  }
})();

const DATA = [
{id:'my_apps', title:"🛠️ Shaxsiy Ilovalarim", icon:"fa-folder-plus", gr:"from-slate-500 to-gray-500", items:customApps},

{id:'uzbekistan',title:"O'zbekiston (Mahalliy)",icon:"fa-star-and-crescent",gr:"from-blue-600 to-emerald-500",
items:[
{n:"Payme", u:"https://payme.uz/", d:"Ishonchli to'lovlar va o'tkazmalar", t:['uz','bepul','web','mobil'],v:true},
{n:"Click", u:"https://click.uz/", d:"Tezkor to'lov tizimi va keshbeklar", t:['uz','bepul','web','mobil'],v:true},
{n:"Uzum Market", u:"https://uzum.uz/", d:"1 kunda bepul yetkazib beriladigan market", t:['uz','bepul','web','mobil'],v:true},
{n:"Uzum Nasiya", u:"https://uzumnasiya.uz/", d:"Muddatli to'lovga muddatli xaridlar qilish", t:['uz','bepul','mobil']},
{n:"Uzum Tezkor", u:"https://tezkor.uzum.uz/", d:"Oziq-ovqat va taomlarni tezkor yetkazib berish", t:['uz','bepul','mobil']},
{n:"Mutolaa", u:"https://mutolaa.uz/", d:"Kitoblar va audiokitoblar milliy platformasi", t:['uz','bepul','web','mobil']},
{n:"Ustoz AI", u:"https://ustoz.ai/", d:"O'zbek tilidagi mukammal ta'lim yordamchisi", t:['uz','bepul','web']},
{n:"Ibrat academy", u:"https://ibrat.uz/", d:"Xorijiy tillarni bepul o'rganish loyihasi", t:['uz','bepul','web','mobil']},
{n:"Bek va lola", u:"https://bekvalola.uz/", d:"Bolalar kiyimlari va o'yinchoqlar online do'koni", t:['uz','bepul','web','mobil']},
{n:"My.gov.uz", u:"https://my.gov.uz/", d:"Yagona elektron davlat xizmatlari", t:['uz','bepul','web','mobil'],v:true},
{n:"MyTaxi", u:"https://mytaxi.uz/", d:"Milliy taksi va yetkazib berish xizmati", t:['uz','bepul','mobil']},
{n:"eMaktab", u:"https://emaktab.uz/", d:"Elektron kundalik va raqamli ta'lim tizimi", t:['uz','bepul','web','mobil'],v:true},
{n:"Soliq.uz", u:"https://soliq.uz/", d:"Soliq xizmatlari, keshbek va hisobotlar", t:['uz','bepul','web','mobil'],v:true},
{n:"OLX.uz", u:"https://www.olx.uz/", d:"Eng yirik bepul e'lonlar doskasi", t:['uz','bepul','web','mobil']},
{n:"Humans.uz", u:"https://humans.uz/", d:"Milliy mobil operator va keshbek bank", t:['uz','bepul','web','mobil']},
{n:"Macbro", u:"https://macbro.uz/", d:"Apple texnika va gadjetlar premium do'koni", t:['uz','bepul','web']},
{n:"Asaxiy", u:"https://asaxiy.uz/", d:"Internet do'kon va mashhur jahon kitoblari", t:['uz','bepul','web']},
{n:"Texnomart", u:"https://texnomart.uz/", d:"Maishiy texnika va muddatli to'lov do'koni", t:['uz','bepul','web']},
{n:"Express24", u:"https://express24.uz/", d:"Tezkor ovqat va dorilar yetkazib berish xizmati", t:['uz','bepul','web','mobil']},
{n:"Yandex Go", u:"https://go.yandex/", d:"Taksi, kurier xizmatlari tarmog'i", t:['uz','bepul','mobil']},
{n:"Yandex Eats", u:"https://eda.yandex.uz/", d:"Restoran va kafelardan taom buyurtma qilish", t:['uz','bepul','mobil']},
{n:"Uzum Bank", u:"https://uzumbank.uz/", d:"Raqamli bank va qulay xizmatlar", t:['uz','bepul','mobil']},
{n:"Anorbank", u:"https://anorbank.uz/", d:"Birinchi raqamli tijorat banki", t:['uz','bepul','mobil']},
{n:"TBC Bank", u:"https://tbcbank.uz/", d:"Raqamli mikromoliya va innovatsion bank xizmati", t:['uz','bepul','mobil']},
{n:"Kapitalbank", u:"https://kapitalbank.uz/", d:"Xususiy aksiyadorlik tijorat banki ilovasi", t:['uz','bepul','mobil']},
{n:"Ipak Yuli Mobile", u:"https://ipakyulibank.uz/", d:"Ipak yuli bankining zamonaviy mobil ilovasi", t:['uz','bepul','mobil']},
{n:"Kun.uz", u:"https://kun.uz/", d:"O'zbekistonning eng yirik yangiliklar portali", t:['uz','bepul','web','mobil'],v:true},
{n:"Daryo.uz", u:"https://daryo.uz/", d:"Milliy media va tezkor yangiliklar portali", t:['uz','bepul','web','mobil']},
{n:"Gazeta.uz", u:"https://www.gazeta.uz/", d:"Ijtimoiy-iqtisodiy ob'ektiv tahliliy yangiliklar", t:['uz','bepul','web']},
{n:"Qalampir.uz", u:"https://qalampir.uz/", d:"Siyosiy va jamiyatga oid qaynoq yangiliklar", t:['uz','bepul','web']},
{n:"Zamin.uz", u:"https://zamin.uz/", d:"Milliy axborot agentligi va ob-havo xabarlari", t:['uz','bepul','web']},
{n:"Podrobno.uz", u:"https://podrobno.uz/", d:"O'zbekistonning so'nggi va tezkor yangiliklari", t:['uz','bepul','web']},
{n:"Afisha.uz", u:"https://afisha.uz/", d:"Toshkent tadbirlari va kino, teatr afishasi", t:['uz','bepul','web']},
{n:"Ticketon.uz", u:"https://ticketon.uz/", d:"Konsert, teatr va sport chiptalariga buyurtma", t:['uz','bepul','web']},
{n:"iTicket.uz", u:"https://iticket.uz/", d:"Elektron tadbir chiptalari xarid qilish portali", t:['uz','bepul','web']},
{n:"UzAuto Tickets", u:"https://uzavtotrans.uz/", d:"Avtobus chiptalarini onlayn xarid qilish xizmati", t:['uz','bepul','web'],v:true},
{n:"UzRailways", u:"https://chipta.railway.uz/", d:"Poyezd chiptalarini elektron onlayn bron qilish", t:['uz','bepul','web'],v:true},
{n:"Makro", u:"https://makromarket.uz/", d:"Oziq-ovqat va mahsulotlar supermarketlar tarmog'i", t:['uz','bepul','web']},
{n:"Korzinka", u:"https://korzinka.uz/", d:"Supermarketlar tarmog'i va onlayn yetkazib berish", t:['uz','bepul','web']},
{n:"ZiyoNET", u:"https://ziyonet.uz/", d:"Ta'limga oid milliy elektron resurslar tarmog'i", t:['uz','bepul','web'],v:true},
{n:"Lex.uz", u:"https://lex.uz/", d:"O'zbekiston Respublikasi qonun hujjatlari bazasi", t:['uz','bepul','web'],v:true},
{n:"Xarid.uz", u:"https://xarid.uzex.uz/", d:"Davlat xaridlari shaffof elektron portali", t:['uz','bepul','web'],v:true},
{n:"E-qaror", u:"https://e-qaror.gov.uz/", d:"Hokimlik qarorlari ochiq elektron portali", t:['uz','bepul','web'],v:true},
{n:"Mening Fikrim", u:"https://meningfikrim.uz/", d:"Jamoaviy jamoat murojaatlari ochiq portali", t:['uz','bepul','web'],v:true},
{n:"Dtm.uz", u:"https://uzbmb.uz/", d:"Bilim va malakalarni baholash agentligi (Sobiq DTM)", t:['uz','bepul','web'],v:true},
{n:"Hemis", u:"https://hemis.uz/", d:"Oliy ta'lim tizimi va talabalar platformasi", t:['uz','bepul','web'],v:true},
{n:"Dmed.uz", u:"https://dmed.uz/", d:"Sog'liqni saqlash vazirligi rasmiy portali", t:['uz','bepul','web'],v:true},
{n:"Beeline Uz", u:"https://beeline.uz/", d:"Beeline aloqa operatori shaxsiy kabineti", t:['uz','bepul','mobil']},
{n:"Ucell", u:"https://ucell.uz/", d:"Ucell abonentlari uchun raqamli xizmatlar", t:['uz','bepul','mobil']},
{n:"Uztelecom", u:"https://uztelecom.uz/", d:"Milliy operator aloqa va internet xizmati", t:['uz','bepul','mobil']}
]},

{id:'ai_chat',title:"AI Chat va Qidiruv",icon:"fa-robot",gr:"from-indigo-500 to-blue-500",
items:[
{n:"ChatGPT", u:"https://chatgpt.com/", d:"Eng mashhur va ko'p funksiyali aqlli AI yordamchi", t:['dunyo','bepul','web','mobil'],v:true},
{n:"Gemini", u:"https://gemini.google.com/", d:"Google'ning so'nggi kuchli multimodal modeli", t:['dunyo','bepul','web','mobil']},
{n:"Copilot", u:"https://copilot.microsoft.com/", d:"Microsoftning bepul internetli yordamchisi", t:['dunyo','bepul','web','mobil']},
{n:"Claude", u:"https://claude.ai/", d:"Katta matnlar, xujjatlar va kodlash uchun ideal AI", t:['dunyo','bepul','web','mobil']},
{n:"Grok", u:"https://grok.com/", d:"xAI tomonidan yasalgan real-vaqt ma'lumotli aqlli bot", t:['dunyo','bepul','web']},
{n:"Perplexity", u:"https://www.perplexity.ai/", d:"Internetdan faktlarni tezkor va aniq qidiruv tizimi", t:['dunyo','bepul','web','mobil']},
{n:"Google AI Studio", u:"https://aistudio.google.com/", d:"Eng so'nggi Gemini modellarini bepul sinash muhiti", t:['dunyo','bepul','web'],v:true},
{n:"Google flow", u:"https://cloud.google.com/dialogflow", d:"Biznes uchun suhbat botlari yaratish platformasi", t:['dunyo','bepul','web']},
{n:"Poe", u:"https://poe.com/", d:"Barcha turdagi AI modellar to'plangan bitta joy", t:['dunyo','bepul','web','mobil']},
{n:"Mistral", u:"https://chat.mistral.ai/", d:"Evropaning eng kuchli open-source AI modeli", t:['dunyo','bepul','web']},
{n:"DeepSeek", u:"https://chat.deepseek.com/", d:"Matematika va kodlashga ixtisoslashgan kuchli model", t:['dunyo','bepul','web']},
{n:"Character.AI", u:"https://character.ai/", d:"Minglab rol o'ynovchi AI personajlar bilan suhbat", t:['dunyo','bepul','web','mobil']},
{n:"HuggingChat", u:"https://huggingface.co/chat/", d:"Llama va boshqa ochiq modellar bilan bepul chat", t:['dunyo','bepul','web']},
{n:"Pi.ai", u:"https://pi.ai/", d:"Sizning shaxsiy va hissiyotli AI psixolog hamrohingiz", t:['dunyo','bepul','web']},
{n:"ChatSonic", u:"https://writesonic.com/chat", d:"Faktlarni tekshirib kontent yozish uchun maxsus AI", t:['dunyo','bepul','web']},
{n:"Ora.ai", u:"https://ora.ai/", d:"O'z shaxsiy AI botingizni bitta joyda yig'ish tizimi", t:['dunyo','bepul','web']},
{n:"Replika", u:"https://replika.com/", d:"Doimiy virtual AI do'st va suhbatdosh avatar", t:['dunyo','bepul','mobil']},
{n:"Llama 3", u:"https://huggingface.co/meta-llama", d:"Meta'ning bepul, sifatli va tezkor matn modeli", t:['dunyo','bepul','web']},
{n:"Qwen", u:"https://chat.qwenlm.ai/", d:"Alibaba kompaniyasining yuqori mantiqli ochiq modeli", t:['dunyo','bepul','web']},
{n:"Falcon", u:"https://falconllm.tii.ae/", d:"Kuchli va eng katta tekin open-source modellaridan biri", t:['dunyo','bepul','web']},
{n:"Cohere", u:"https://cohere.com/", d:"Biznes va Enterprise xizmatlar uchun murakkab AI", t:['dunyo','pullik','web']},
{n:"Jasper", u:"https://www.jasper.ai/", d:"Professional kopirayting va SMM kontent yozish", t:['dunyo','pullik','web']},
{n:"Writesonic", u:"https://writesonic.com/", d:"Maqolalar, blog va SEO matnlarni yaratuvchi AI", t:['dunyo','bepul','web']},
{n:"Copy.ai", u:"https://www.copy.ai/", d:"Sotuv va marketing matnlarini osongina yaratish", t:['dunyo','bepul','web']},
{n:"Rytr", u:"https://rytr.me/", d:"Arzon va tezkor xat yoki maqola yozib beruvchi neyrotarmoq", t:['dunyo','bepul','web']},
{n:"You.com", u:"https://you.com/", d:"AI hamda kodlash bilan birlashgan xavfsiz qidiruv", t:['dunyo','bepul','web']},
{n:"Phind", u:"https://www.phind.com/", d:"Dasturchilar uchun kod xatolarini izlovchi maxsus qidiruv", t:['dunyo','bepul','web']}
]},

{id:'ai_image',title:"AI Rasm va Dizayn",icon:"fa-image",gr:"from-pink-500 to-rose-500",
items:[
{n:"Midjourney", u:"https://www.midjourney.com/", d:"Dunyodagi eng san'atkorona va chiroyli rasm AI", t:['dunyo','pullik','web']},
{n:"Designer", u:"https://designer.microsoft.com/", d:"Microsoft DALL-E yordamida tekin rasm generatsiyasi", t:['dunyo','bepul','web']},
{n:"Freepik", u:"https://www.freepik.com/", d:"Dizaynerlar va oddiy foydalanuvchilar uchun AI rasm tizimi", t:['dunyo','bepul','web']},
{n:"DALL-E 3", u:"https://openai.com/dall-e-3", d:"ChatGPT ning preimum rasmlar chizuvchi qismi", t:['dunyo','pullik','web']},
{n:"Leonardo AI", u:"https://leonardo.ai/", d:"Midjourney ning eng kuchli bepul alternativasi", t:['dunyo','bepul','web']},
{n:"Ideogram", u:"https://ideogram.ai/", d:"Rasmga sifatli va to'g'ri inglizcha yozuv qo'shuvchi AI", t:['dunyo','bepul','web']},
{n:"Civitai", u:"https://civitai.com/", d:"Katta formatli AI rasm modellarining tekin bazasi", t:['dunyo','bepul','web']},
{n:"Canva AI", u:"https://www.canva.com/ai-image-generator/", d:"Canva platformasi ichiga qurilgan qulay generator", t:['dunyo','bepul','web']},
{n:"Adobe Firefly", u:"https://firefly.adobe.com/", d:"Rasmga ob'ekt qo'shish va generatsiya uchun eng xavfsizi", t:['dunyo','bepul','web']},
{n:"Flux AI", u:"https://flux.ai/", d:"Mantiqiyligi bilan mashhur yangi avlod chizuvchi modeli", t:['dunyo','bepul','web']},
{n:"Playground AI", u:"https://playgroundai.com/", d:"Bepul onlayn mukammal rasm yaratish va oson tahrirlash", t:['dunyo','bepul','web']},
{n:"Lexica", u:"https://lexica.art/", d:"Stable Diffusion orqali ishlangan rasm va promp qidiruvi", t:['dunyo','bepul','web']},
{n:"Artbreeder", u:"https://www.artbreeder.com/", d:"Yuzlarni va rasmlarni genetik usulda birlashtirish", t:['dunyo','bepul','web']},
{n:"SeaArt", u:"https://seaart.ai/", d:"Juda murakkab san'at asarlarini bepul yaratish interfeysi", t:['dunyo','bepul','web']},
{n:"Krea", u:"https://www.krea.ai/", d:"Tezlikda, aynan siz chizayotgan vaqtda tasvir tuzuvchi AI", t:['dunyo','bepul','web']},
{n:"NightCafe", u:"https://creator.nightcafe.studio/", d:"Oson, hamma tushunadigan AI rasm san'at vositasi", t:['dunyo','bepul','web']},
{n:"Tensor.art", u:"https://tensor.art/", d:"Barcha qimmat rasm modellarini onlayn ishlatish markazi", t:['dunyo','bepul','web']},
{n:"PromeAI", u:"https://promeai.com/", d:"Soddagina 2D eskizlarni professional 3D renderga aylantirish", t:['dunyo','bepul','web']},
{n:"Recraft", u:"https://www.recraft.ai/", d:"Vektorli ikonka va illustratsiyalar chizuvchi generator", t:['dunyo','bepul','web']},
{n:"Craiyon", u:"https://www.craiyon.com/", d:"Sobiq matnli rasm izlovchi DALL-E mini platformasi", t:['dunyo','bepul','web']},
{n:"Mage.space", u:"https://www.mage.space/", d:"Stable Diffusion ning mutlaqo bepul variantlar markazi", t:['dunyo','bepul','web']},
{n:"DreamStudio", u:"https://beta.dreamstudio.ai/", d:"Stability AI ning rasmiy yuqori tezlikdagi dasturi", t:['dunyo','pullik','web']},
{n:"InvokeAI", u:"https://invoke.com/", d:"Studio mutaxassislari uchun maxsus rasm arxitekturasi", t:['dunyo','pullik','web']}
]},

{id:'ai_media',title:"AI Video va Audio",icon:"fa-film",gr:"from-fuchsia-500 to-purple-500",
items:[
{n:"Runway", u:"https://runwayml.com/", d:"Kino va reklama darajasidagi AI video generatori (Gen-3)", t:['dunyo','bepul','web']},
{n:"Hedra video", u:"https://www.hedra.com/", d:"Rasmdagi yuzlarni va xarakterlarni gapirtiradigan vosita", t:['dunyo','bepul','web']},
{n:"Voice AI", u:"https://voice.ai/", d:"Real vaqt rejimida qahramonlar ovozini klonlash va o'zgartirish", t:['dunyo','bepul','web']},
{n:"Ovoz AI", u:"https://ovoz.ai/", d:"O'zbek matnlarini aniq va tabiiy ravishda o'qib beruvchi", t:['uz','bepul','web']},
{n:"Luma Dream Machine", u:"https://lumalabs.ai/dream-machine", d:"Rasmdan yuqori sifatli golografik videolarni yaratish", t:['dunyo','bepul','web']},
{n:"HeyGen", u:"https://www.heygen.com/", d:"Matn orqali boshlovchi AI avatarli prezetatsiya videolar", t:['dunyo','bepul','web']},
{n:"Suno", u:"https://suno.com/", d:"Prodyusserlik darajasidagi qo'shiq va kuylarni yarating", t:['dunyo','bepul','web']},
{n:"Udio", u:"https://www.udio.com/", d:"Raqobatchilardan baland ovoz sifatidagi musiqiy tarmoq", t:['dunyo','bepul','web']},
{n:"ElevenLabs", u:"https://elevenlabs.io/", d:"Ovoz yaratish va 29+ tilda jumladan o'zbekchada gapirish", t:['dunyo','bepul','web']},
{n:"Kling AI", u:"https://klingai.com/", d:"Fizika qonunlariga bo'ysunuvchi eng realistik videobot", t:['dunyo','bepul','web']},
{n:"Pika Labs", u:"https://pika.art/", d:"Videolarga matn bilan animatsion effektlar bering", t:['dunyo','bepul','web']},
{n:"Synthesia", u:"https://www.synthesia.io/", d:"Yuzlab tillarda sun'iy boshlovchi ishtirokidagi e'lonlar", t:['dunyo','pullik','web']},
{n:"Murf.ai", u:"https://murf.ai/", d:"Videolar uchun professional ovoz beruvchi dublyaj studiyasi", t:['dunyo','bepul','web']},
{n:"Invideo", u:"https://invideo.io/", d:"Yozuvli skript orqali vizual kadrlarni yig'ib beruvchi algoritm", t:['dunyo','bepul','web']},
{n:"D-ID", u:"https://www.d-id.com/", d:"Oddiy rasmga ovoz berib haqiqiy harakatlantiruvchi platform", t:['dunyo','bepul','web']},
{n:"Fliki", u:"https://fliki.ai/", d:"Blog post va maqolalaringizni tayyor videoga aylantiradi", t:['dunyo','bepul','web']},
{n:"Descript", u:"https://www.descript.com/", d:"Video o'rniga matnni tahrirlab videoni qirqadigan innovatsiya", t:['dunyo','bepul','web']},
{n:"Veed.io", u:"https://www.veed.io/", d:"Avtomatik subtitr qadovchi va vizual tahrirlash portali", t:['dunyo','bepul','web']},
{n:"Vocal Remover", u:"https://vocalremover.org/", d:"Istalgan taronadan inson ovozini va instrumentalni ajratish", t:['dunyo','bepul','web']},
{n:"CapCut AI", u:"https://www.capcut.com/", d:"Mobil dunyodagi eng zo'r kesish, effektlar va AI shablonlari", t:['dunyo','bepul','web','mobil']},
{n:"Opus Clip", u:"https://www.opus.pro/", d:"YouTube/Podcast formatidan o'nlab TikTok/Reels kesib oling", t:['dunyo','bepul','web']},
{n:"Pictory", u:"https://pictory.ai/", d:"Skript yozib stok kadrlardan iborat ajoyib videolar yig'ish", t:['dunyo','pullik','web']},
{n:"Kaiber", u:"https://kaiber.ai/", d:"Rasmlarni musiqaga moslab psixodelik videolarga o'girish", t:['dunyo','pullik','web']}
]},

{id:'developer',title:"Dasturlash va Web",icon:"fa-code",gr:"from-cyan-500 to-blue-600",
items:[
{n:"Lovable | Sayt va MVP", u:"https://lovable.dev/", d:"AI bilan bir zumda dizayn va kodni ishga tushirish", t:['dunyo','bepul','web']},
{n:"Cursor", u:"https://cursor.sh/", d:"Yangi avlod, ichiga kuchli AI o'rnatilgan kod yozish dasturi", t:['dunyo','bepul','web']},
{n:"GitHub Copilot", u:"https://github.com/features/copilot", d:"Minglab qatorlarni davom ettiruvchi yordamchi AI", t:['dunyo','pullik','web']},
{n:"v0 by Vercel", u:"https://v0.dev/", d:"Faqat matn orqali to'liq React UI va ko'rinish yasash", t:['dunyo','bepul','web']},
{n:"Bolt.new", u:"https://bolt.new/", d:"Brauzerni yopmasdan turib Full-Stack ilovalarni kodlash", t:['dunyo','bepul','web']},
{n:"Windsurf", u:"https://codeium.com/windsurf", d:"Mustaqil masalalarni hal qiladigan Agentik AI IDE", t:['dunyo','bepul','web']},
{n:"GitHub", u:"https://github.com/", d:"Dunyodagi eng yirik jamoaviy va ochiq kodlar maydoni", t:['dunyo','bepul','web'],v:true},
{n:"GitLab", u:"https://about.gitlab.com/", d:"Korporativ CI/CD quvvatiga ega markazlashtirilgan repo", t:['dunyo','bepul','web']},
{n:"Bitbucket", u:"https://bitbucket.org/", d:"Jira hamda Trello tizimlariga integratsiyalashgan bulut", t:['dunyo','bepul','web']},
{n:"Firebase", u:"https://firebase.google.com/", d:"Autentifikatsiya, bildirishnomalar va bulutli backend", t:['dunyo','bepul','web']},
{n:"Supabase", u:"https://supabase.com/", d:"Ochiq kodli va oson Postgres ma'lumotlar bazasi backend", t:['dunyo','bepul','web']},
{n:"Appwrite", u:"https://appwrite.io/", d:"Serverless ishlovchilar uchun qulay hisob boshqaruvi", t:['dunyo','bepul','web']},
{n:"Cloudflare", u:"https://www.cloudflare.com/", d:"Vebsayt xavfsizligi, CDN tarmoqlari va domen himoyasi", t:['dunyo','bepul','web']},
{n:"Vercel", u:"https://vercel.com/", d:"Next.js yaratuvchilaridan loyihani bepul va tezkor host qilish", t:['dunyo','bepul','web']},
{n:"Netlify", u:"https://www.netlify.com/", d:"Frontend ilovalarni avtomatik deploy va onlayn qilish", t:['dunyo','bepul','web']},
{n:"Render", u:"https://render.com/", d:"Murakkab bo'lmagan backend serverlari va DB host qilish", t:['dunyo','bepul','web']},
{n:"Railway", u:"https://railway.app/", d:"Terminal va sozlamalarsiz loyihalarni internetga yuklash", t:['dunyo','bepul','web']},
{n:"Heroku", u:"https://www.heroku.com/", d:"Python, Node va PHP ni host qiluvchi mashhur klassik cloud", t:['dunyo','pullik','web']},
{n:"Stack Overflow", u:"https://stackoverflow.com/", d:"Dasturchilar yo'liqadigan barcha xatolar uchun savol-javob", t:['dunyo','bepul','web']},
{n:"Tailwind CSS", u:"https://tailwindcss.com/", d:"Zamonaviy loyihalar uchun yengil Utility CSS tizimi", t:['dunyo','bepul','web']},
{n:"Replit", u:"https://replit.com/", d:"Hech nima o'rnatmasdan brauzer yoki telefonda kod yozish", t:['dunyo','bepul','web','mobil']},
{n:"Codeium", u:"https://codeium.com/", d:"VS Code va boshqalar uchun bepul Copilot alternativi", t:['dunyo','bepul','web']},
{n:"Docker", u:"https://www.docker.com/", d:"Loyiha arxitekturasini istalgan tizimda o'zgarishsiz ishlashi", t:['dunyo','bepul','web']},
{n:"Postman", u:"https://www.postman.com/", d:"REST va GraphQL API larni chaqirish hamda hujjatlashtirish", t:['dunyo','bepul','web']},
{n:"CodePen", u:"https://codepen.io/", d:"O'rgatuvchi HTML, CSS, JS komponentlarni onlayn izlash", t:['dunyo','bepul','web']},
{n:"CodeSandbox", u:"https://codesandbox.io/", d:"Veb dasturlarni papkalari bilan onlayn muharrirda yozish", t:['dunyo','bepul','web']},
{n:"PlanetScale", u:"https://planetscale.com/", d:"Uzilishlarsiz ishlovchi va katta tezlikdagi MySQL bazasi", t:['dunyo','bepul','web']}
]},

{id:'business',title:"Biznes va SMM",icon:"fa-chart-line",gr:"from-orange-500 to-red-500",
items:[
{n:"SMM AI", u:"https://predis.ai/", d:"Biznesingiz uchun tayyor ijtimoiy tarmoq postlari va g'oyalar", t:['dunyo','bepul','web']},
{n:"Notion", u:"https://www.notion.so/", d:"Kompaniya xodimlari uchun yagona ish joyi, ro'yxat va maqolalar", t:['dunyo','bepul','web','mobil']},
{n:"Trello", u:"https://trello.com/", d:"Kichik jamoalar uchun vizual topshiriq va doskalar (Kanban)", t:['dunyo','bepul','web','mobil']},
{n:"Slack", u:"https://slack.com/", d:"Ishchi guruhlar va loyihalar uchun chat, qo'ng'iroq, fayllar", t:['dunyo','bepul','web','mobil']},
{n:"Canva", u:"https://www.canva.com/", d:"Dizayner bo'lmaganlar uchun tezkor SMM va post shablonlari", t:['dunyo','bepul','web','mobil']},
{n:"Gamma", u:"https://gamma.app/", d:"Sarlavha yozilsa o'zi dizaynli prezentatsiyalarni qilib beradi", t:['dunyo','bepul','web']},
{n:"Asana", u:"https://asana.com/", d:"Muddatli loyihalarni katta guruhlar bo'lib birgalikda boshqarish", t:['dunyo','bepul','web','mobil']},
{n:"Zoom", u:"https://zoom.us/", d:"Onlayn video konferensiyalar, uchrashuvlar va displey ulashish", t:['dunyo','bepul','web','mobil']},
{n:"Google Meet", u:"https://meet.google.com/", d:"Google akkaunti orqali bepul 100 kishilik onlayn qo'ng'iroqlar", t:['dunyo','bepul','web','mobil']},
{n:"Microsoft Teams", u:"https://www.microsoft.com/en-us/microsoft-teams/group-chat-software", d:"Korporativ miqyosda onlayn ofis hamda hujjatlarni yuritish", t:['dunyo','bepul','web','mobil']},
{n:"Jira", u:"https://www.atlassian.com/software/jira", d:"Dasturiy ta'minot kompaniyalari uchun bug va sprint trekeri", t:['dunyo','pullik','web']},
{n:"Monday.com", u:"https://monday.com/", d:"Barcha ish tizimini va hisobotlarni bir platformaga yig'ish", t:['dunyo','bepul','web']},
{n:"ClickUp", u:"https://clickup.com/", d:"Vazifalar, xujjatlar va chatlarni mujassam etgan yagona app", t:['dunyo','bepul','web']},
{n:"HubSpot", u:"https://www.hubspot.com/", d:"Sotuv (CRM), marketing avtomatizatsiyasi va mijozlarga xizmat", t:['dunyo','bepul','web']},
{n:"Buffer", u:"https://buffer.com/", d:"Telegram, Instagramga postlarni belgilangan vaqtda yuklash", t:['dunyo','bepul','web']},
{n:"Hootsuite", u:"https://www.hootsuite.com/", d:"Turli SMM tarmoqlarni yagona oynadan kuzatish va nashr", t:['dunyo','pullik','web']},
{n:"Mailchimp", u:"https://mailchimp.com/", d:"Mijozlarga professional elektron xat (email) larni yuborish", t:['dunyo','bepul','web']},
{n:"Miro", u:"https://miro.com/", d:"Onlayn chizish, sxema va fikrlarni vizualizatsiya qilish doskasi", t:['dunyo','bepul','web']},
{n:"Metricool", u:"https://metricool.com/", d:"Tarmoqlar obunachilari statistikasi va aktivlik darajasi tahlili", t:['dunyo','bepul','web']},
{n:"Later", u:"https://later.com/", d:"Instagram vizual ko'rinishini postlarni qo'yishdan avval tekshirish", t:['dunyo','bepul','web']},
{n:"Airtable", u:"https://airtable.com/", d:"Excel kabi ko'rinishga ega qudratli relyatsion baza va dastur", t:['dunyo','bepul','web']}
]},

{id:'design',title:"Dizayn va Kreativ",icon:"fa-palette",gr:"from-rose-500 to-pink-500",
items:[
{n:"Behance", u:"https://www.behance.net/", d:"Dunyodagi eng kuchli dizaynerlar portfoliosi va kesyslar portali", t:['dunyo','bepul','web','mobil']},
{n:"Pinterest", u:"https://www.pinterest.com/", d:"Barcha mavzulardagi rasm, g'oya, va vizual ilhomlar izlash uchun", t:['dunyo','bepul','web','mobil']},
{n:"Figma", u:"https://www.figma.com/", d:"Guruh bo'lib veb-sayt va ilovalarga chiroyli dizayn va prototip chizish", t:['dunyo','bepul','web']},
{n:"Framer", u:"https://www.framer.com/", d:"No-code yo'li bilan super tezkor va harakatlanuvchi saytlar yasash", t:['dunyo','bepul','web']},
{n:"Webflow", u:"https://webflow.com/", d:"Hech qanday kod yozmasdan vizual interfeys orqali professional HTML tuzish", t:['dunyo','bepul','web']},
{n:"Coolors", u:"https://coolors.co/", d:"Sayt yoki brend uchun mos keluvchi ranglar uyg'unligini avto topish", t:['dunyo','bepul','web']},
{n:"Unsplash", u:"https://unsplash.com/", d:"100% litsenziyasiz, tijorat maqsadida ishlatiladigan fotografiyalar", t:['dunyo','bepul','web']},
{n:"Pexels", u:"https://www.pexels.com/", d:"Ijtimoiy tarmoq videolari va postlari uchun bepul fond kadrlari", t:['dunyo','bepul','web']},
{n:"Flaticon", u:"https://www.flaticon.com/", d:"Taqdimotlar va saytlar uchun millionlab png, svg formati ikonkalar", t:['dunyo','bepul','web']},
{n:"Dribbble", u:"https://dribbble.com/", d:"Logotiplar, animatsiyalar va zamonaviy UX interfeyslarni izlash joyi", t:['dunyo','bepul','web']},
{n:"Adobe Color", u:"https://color.adobe.com/", d:"Professional dizaynerlik g'ildiragi va rasm ranglarini sug'urib olish", t:['dunyo','bepul','web']},
{n:"LottieFiles", u:"https://lottiefiles.com/", d:"Ilovalarga gif lardan ko'ra 10 barobar yengil bo'lgan interaktiv elementlar", t:['dunyo','bepul','web']},
{n:"Spline", u:"https://spline.design/", d:"Web 3D modellarini, effektlarni va ob'ektlarni brauzer orqali yaratish", t:['dunyo','bepul','web']},
{n:"Sketch", u:"https://www.sketch.com/", d:"Apple Mac kompyuterlaridagi eng silliq vektorli dizayn ilovasi", t:['dunyo','pullik','web']},
{n:"InVision", u:"https://www.invisionapp.com/", d:"Mijozlarga dizayn qanday ishlashini klikli versiyada ko'rsatib berish", t:['dunyo','bepul','web']},
{n:"Pixabay", u:"https://pixabay.com/", d:"Tijoriy litsenziya talab etmaydigan bepul video effektlar va MP3 lar", t:['dunyo','bepul','web']},
{n:"Iconify", u:"https://iconify.design/", d:"Kod orqali kiritish mumkin bo'lgan dasturchilar uchun ikonka kutubxonasi", t:['dunyo','bepul','web']},
{n:"FontAwesome", u:"https://fontawesome.com/", d:"Web-saytlar uchun standart va eng ko'p ishlatiladigan vektor ikonlar", t:['dunyo','bepul','web']},
{n:"Google Fonts", u:"https://fonts.google.com/", d:"Saytlarga ulash uchun tekin va barcha qurilmaga tushadigan shriftlar", t:['dunyo','bepul','web']},
{n:"UXwing", u:"https://uxwing.com/", d:"Eng kerakli xavfsiz va chiroyli SVG va veb ikonkalar (mutlaqo bepul)", t:['dunyo','bepul','web']},
{n:"ColorHunt", u:"https://colorhunt.co/", d:"Mutaxassislar tomonidan tanlangan palitralarning eng didli variantlari", t:['dunyo','bepul','web']}
]},

{id:'mobile_apps',title:"Top Mobil Ilovalar",icon:"fa-mobile-screen-button",gr:"from-yellow-500 to-amber-500",
items:[
{n:"Telegram", u:"https://telegram.org/", d:"Eng tezkor va fayllar uzatish bo'yicha kuchli chat va messenjer", t:['dunyo','bepul','mobil']},
{n:"WhatsApp", u:"https://www.whatsapp.com/", d:"Butun dunyo bo'ylab ommabop, ishonchli xabarlar va aloqa vositasi", t:['dunyo','bepul','mobil']},
{n:"Instagram", u:"https://www.instagram.com/", d:"Rasmlar va qisqa Reels videolari bilan bo'lishish ijtimoiy olami", t:['dunyo','bepul','mobil']},
{n:"YouTube", u:"https://www.youtube.com/", d:"Sayyoramizning eng katta video xosting va vlogerlar platformasi", t:['dunyo','bepul','mobil']},
{n:"Spotify", u:"https://open.spotify.com/", d:"Barcha san'atkorlarning qo'shiq va sifatli podkastlar musiqa tarmog'i", t:['dunyo','bepul','mobil']},
{n:"TikTok", u:"https://www.tiktok.com/", d:"Zamonaviy trend, memlar va kreativ qisqa qiziqarli videolar qatorlari", t:['dunyo','bepul','mobil']},
{n:"CapCut", u:"https://www.capcut.com/", d:"Sifatli filtrlari bor, eng qulay va kuchli mobil video muharrir qirquvchisi", t:['dunyo','bepul','mobil']},
{n:"Duolingo", u:"https://www.duolingo.com/", d:"O'yin, reyting va muloqot shaklida turli tillarni qiziqarli o'rganish", t:['dunyo','bepul','mobil']},
{n:"Shazam", u:"https://www.shazam.com/", d:"Qayerdadir chalinayotgan notanish qo'shiqning nomini darhol aniqlab berish", t:['dunyo','bepul','mobil']},
{n:"Google Maps", u:"https://maps.google.com/", d:"Yer yuzining deyarli har bir burchagiga aniq marshrut qurish tizimi", t:['dunyo','bepul','mobil']},
{n:"Waze", u:"https://www.waze.com/", d:"Haydovchilar tomonidan aytiladigan probkalar va xavf xaritalari avtoyo'llari", t:['dunyo','bepul','mobil']},
{n:"InShot", u:"https://inshot.com/", d:"Kliplar, rasmlar, kollajlar yaratuvchi musiqali ijtimoiy tahrirlagich", t:['dunyo','bepul','mobil']},
{n:"VN Video Editor", u:"https://www.vlognow.me/", d:"Reklamasiz, professional va detallar ustida ishlovchi vlog mobil video edit", t:['dunyo','bepul','mobil']},
{n:"Snapseed", u:"https://snapseed.online/", d:"Rasmga rang, yorug'lik va boshqa pro effektlarni beruvchi Google dasturi", t:['dunyo','bepul','mobil']},
{n:"Lightroom", u:"https://lightroom.adobe.com/", d:"Mobil fotograflar va qimmat kameralarga xos rasm ranglarini jilosi", t:['dunyo','bepul','mobil']},
{n:"Picsart", u:"https://picsart.com/", d:"Fonni kesish, rangli stikerlar va ajoyib kreativ rasm effektlarini tuzuvchi", t:['dunyo','bepul','mobil']},
{n:"Facebook", u:"https://www.facebook.com/", d:"Guruhlar, postlar, bozorcha va qarindoshlar global klassik tarmog'i", t:['dunyo','bepul','mobil']},
{n:"X (Twitter)", u:"https://x.com/", d:"Dunyodagi eng muhim va tezkor biznes yangiliklari tahlillar hamda tvitlar", t:['dunyo','bepul','web','mobil']},
{n:"LinkedIn", u:"https://www.linkedin.com/", d:"Faoliyat yuzasidan mutaxassislarni izlash, portfolio va ish o'rinlari tarmog'i", t:['dunyo','bepul','web','mobil']},
{n:"Snapchat", u:"https://www.snapchat.com/", d:"Ko'rilgach o'chib ketadigan tezkor rasmlar, filtrlar va xabarlar avlod tarmog'i", t:['dunyo','bepul','mobil']},
{n:"Reddit", u:"https://www.reddit.com/", d:"Barcha kichik va qiziq yo'nalishlar muhokamasi uchun minglab sub-forum jamoasi", t:['dunyo','bepul','web','mobil']},
{n:"Discord", u:"https://discord.com/", d:"Geymerlar, ta'lim, va loyiha guruhlari qulay kanalli ovozli aloqa serverlari", t:['dunyo','bepul','web','mobil']},
{n:"Twitch", u:"https://www.twitch.tv/", d:"O'yin, suhbat va onlayn kazino streamlarni real vaqtda jonli ko'rish", t:['dunyo','bepul','web','mobil']},
{n:"Netflix", u:"https://www.netflix.com/", d:"Eng shov shuvli seriallar, kinolar, eksklyuziv loyihalarning pullik videoxostingi", t:['dunyo','pullik','mobil']}
]},

{id:'productivity',title:"Ish va O'qish",icon:"fa-brain",gr:"from-orange-500 to-amber-500",
items:[
{n:"ChatPDF", u:"https://www.chatpdf.com/", d:"Kitob va hujjatlaringiz (PDF) mazmuni bilan savol-javob qilish roboti", t:['dunyo','bepul','web']},
{n:"QuillBot", u:"https://quillbot.com/", d:"Ingliz tilidagi yozilgan gap va insholarni xatosini to'g'rilab sinonimlaydi", t:['dunyo','bepul','web']},
{n:"Coursera", u:"https://www.coursera.org/", d:"Stenford va Google kabi gigantlardan yuqori litsenziyali ta'lim va kurslar", t:['dunyo','bepul','web']},
{n:"Udemy", u:"https://www.udemy.com/", d:"Har qanday qiziqish uchun mutaxassislardan arzon, juda ko'p bilim kurslari", t:['dunyo','pullik','web']},
{n:"Khan Academy", u:"https://www.khanacademy.org/", d:"Barcha yosh va fanlar bo'yicha nodavlat, to'liq bepul onlayn maktab va oliygoh", t:['dunyo','bepul','web']},
{n:"Grammarly", u:"https://www.grammarly.com/", d:"Matn yozayotganda uslub, vergul va grammatik xatolarni darhol belgilaydi", t:['dunyo','bepul','web']},
{n:"Obsidian", u:"https://obsidian.md/", d:"Kompyuterda maxfiy saqlanadigan, matn va ma'lumotlarni o'zaro bog'laydigan tarmoq", t:['dunyo','bepul','web']},
{n:"Todoist", u:"https://todoist.com/", d:"Eng kuchli va integratsiyasi boy bo'lgan professional xodimlar kunlik ro'yxati", t:['dunyo','bepul','web','mobil']},
{n:"Evernote", u:"https://evernote.com/", d:"Fikrlar, hujjatlar, rasmlar va qo'lyozmalarni tartibda bulutli xotirada saqlash", t:['dunyo','bepul','web','mobil']},
{n:"TickTick", u:"https://ticktick.com/", d:"Odatlar va vaqtni tahlil qilib boruvchi, eslatuvchi tezkor vazifalar platformasi", t:['dunyo','bepul','web','mobil']},
{n:"Microsoft To Do", u:"https://todo.microsoft.com/", d:"Mening kunim (My Day) orqali oddiy rejalarni tuzishga ixtisoslashgan ofis jurnali", t:['dunyo','bepul','web','mobil']},
{n:"Any.do", u:"https://www.any.do/", d:"Ovoz orqali ro'yxatlar va WhatsApp eslatmalar qoldiradigan mukammal tracker", t:['dunyo','bepul','web','mobil']},
{n:"Bear", u:"https://bear.app/", d:"Ekranni chalg'itmaydigan fokus rejimiga ega Apple iOS/Mac ekotizim qulay blonkot", t:['dunyo','pullik','mobil']},
{n:"Roam Research", u:"https://roamresearch.com/", d:"Ikkinchi miya arxitekturasi! Yo'naltirilgan xabarlarni vizualizatsiya xaritasi", t:['dunyo','pullik','web']},
{n:"EdX", u:"https://www.edx.org/", d:"Harvard, MIT olimlari tomonidan tayyorlangan kompyuter fani akademik leksiyalar", t:['dunyo','bepul','web']},
{n:"Skillshare", u:"https://www.skillshare.com/", d:"Rasm chizish, video olay olish, musiqa kabi soft skill ustalaridan bilim bazasi", t:['dunyo','pullik','web']},
{n:"MasterClass", u:"https://www.masterclass.com/", d:"Kinorejissiyor, aktyor, yoki bosh oshpaz kabi afsonaviy ustalar master klasslari", t:['dunyo','pullik','web']},
{n:"Pluralsight", u:"https://www.pluralsight.com/", d:"IT dasturchilar o'z ustida ishlab darajalarini tekshirish premium video darsliklari", t:['dunyo','pullik','web']},
{n:"Quizlet", u:"https://quizlet.com/", d:"O'rgangan ma'lumotlarni imtihon orqali va chet el so'zlarini eslab qolish kartalari", t:['dunyo','bepul','web','mobil']},
{n:"Kahoot", u:"https://kahoot.com/", d:"Ta'lim jarayonlarini va savollarni jonli shou o'yini yoki test ko'rinishida guruh bo'lib o'ynash", t:['dunyo','bepul','web']},
{n:"Memrise", u:"https://www.memrise.com/", d:"Asociatsiya va o'zaro tasavvur qoidalari evaziga nutqni tez esda qoldirish ta'limi", t:['dunyo','bepul','web','mobil']},
{n:"Babbel", u:"https://www.babbel.com/", d:"Faqat gapirish va amaliyot qilish orqali chet tilining asosiy iboralariga o'rganish", t:['dunyo','pullik','web','mobil']},
{n:"Busuu", u:"https://www.busuu.com/", d:"Berilgan javob va matnlarni asil chet ellik o'quvchilar tahrirlab beradigan muhit", t:['dunyo','pullik','web','mobil']},
{n:"Notion Calendar", u:"https://www.notion.so/product/calendar", d:"Jamoa va Notion bazasidagi ma'lumotlar, mitinglar bilan moslangan kalendar ishi", t:['dunyo','bepul','web']},
{n:"Google Keep", u:"https://keep.google.com/", d:"Alohida oynachalarda vizual stiker eslatmalarni ranglab devorga yopishtirganday yozish", t:['dunyo','bepul','web','mobil']},
{n:"GoodNotes", u:"https://www.goodnotes.com/", d:"Stylus bilan konspektlar va iPad planhetlarida raqamli varoqlarni dars uchun yozish", t:['dunyo','pullik','mobil']}
]},

{id:'crypto_finance',title:"Kripto va Moliya",icon:"fa-bitcoin-sign",gr:"from-green-500 to-emerald-600",
items:[
{n:"Binance", u:"https://www.binance.com/", d:"Trillionlab valyuta aylanadigan dunyodagi eng yirik va xavfsiz kriptovalyuta birjasi", t:['dunyo','bepul','web','mobil']},
{n:"CoinMarketCap", u:"https://coinmarketcap.com/", d:"Har bir chiqqan kriptovalyuta, token grafiki, narxi va kapitalizatsiya analitika o'chog'i", t:['dunyo','bepul','web','mobil']},
{n:"TradingView", u:"https://www.tradingview.com/", d:"Jahon qimmatli qog'ozlar, forex va birja moliya o'zgarishlari eng aniq treyding grafikalari", t:['dunyo','bepul','web','mobil']},
{n:"Bybit", u:"https://www.bybit.com/", d:"Yangi tokenlar airdroplari, tezkor xarid tizimi ishlaydigan kuchli va ishonchli birja", t:['dunyo','bepul','web','mobil']},
{n:"CoinGecko", u:"https://www.coingecko.com/", d:"Birjalardagi kripto pullarning kunlik obyekti hisob-kitoblar tahlili va portfel balansi trekeri", t:['dunyo','bepul','web','mobil']},
{n:"Trust Wallet", u:"https://trustwallet.com/", d:"Qurilmada lokal saqlanuvchi web3 va tokenlarning mutlaq markazlashmagan kripto hamyoni", t:['dunyo','bepul','mobil']},
{n:"MetaMask", u:"https://metamask.io/", d:"Smart kontaktlar, Ethereum DApp'lar, va swap loyihalarni kompyuterda o'qish imkoni hamyon", t:['dunyo','bepul','web','mobil']},
{n:"Investing.com", u:"https://www.investing.com/", d:"Aksiyalar qiymati, indexlar, muhim iqtisodiy taqvim, investorlar oqimi hisob-kitobi va tahlillar", t:['dunyo','bepul','web','mobil']},
{n:"OKX", u:"https://www.okx.com/", d:"Fyuçers savdosi uchun mashhur va katta summalarda hisoblangan ikkinchi xavfsiz tizim", t:['dunyo','bepul','web','mobil']},
{n:"KuCoin", u:"https://www.kucoin.com/", d:"Xavfsizlik chegaralari bo'lmagan ko'p xil kichik xavfli tokenlar ham joylashtiriladigan tarmoq", t:['dunyo','bepul','web','mobil']},
{n:"Coinbase", u:"https://www.coinbase.com/", d:"Qonuniy regulyatsiya o'tgan, g'arb mamlakatlarining eng rasmiy va katta toza kripto hamyoni", t:['dunyo','bepul','web','mobil']},
{n:"Kraken", u:"https://www.kraken.com/", d:"Yevropa davlatlarida doim o'rinda turuvchi eng eski ishonchli yirik bitkoin va valyuta savdo birjasi", t:['dunyo','bepul','web','mobil']},
{n:"Phantom", u:"https://phantom.app/", d:"Yangi Solana va Ethereum dApp uchun yuqori darajada tezkor ishlash uchun sozlangan lokal Web3 hamyon", t:['dunyo','bepul','web','mobil']},
{n:"DexScreener", u:"https://dexscreener.com/", d:"Yaqindagina yaratilgan barcha alt-koinlar (shitcoinlar)ning jonli blokcheynda narx analizator", t:['dunyo','bepul','web']},
{n:"Dextools", u:"https://www.dextools.io/", d:"Bot va tranzaksiya izlarini tekshirib markazlashmagan yangi kripto xaridlarni nazorat qilish", t:['dunyo','bepul','web']},
{n:"Uniswap", u:"https://uniswap.org/", d:"Pulingizni Ethereum blokcheyni tarmog'ida markazsiz barcha tokenlarga 1 klikda xarid qilish", t:['dunyo','bepul','web']},
{n:"PancakeSwap", u:"https://pancakeswap.finance/", d:"Binance (BNB) Smart Chain zanjirida yaratilgan kontrakt va loyiha pullarini birja ro'yxatsiz almashtirish", t:['dunyo','bepul','web']},
{n:"1inch", u:"https://1inch.io/", d:"Pulingiz kamroq foyz bilan swap qilinishi uchun yuzlab dex (birja) larni taqqoslovchi agregator", t:['dunyo','bepul','web']},
{n:"Yahoo Finance", u:"https://finance.yahoo.com/", d:"Fond bozori kompaniyalari tushum grafiki, AQSH moliya olami ishonchli katta rasmiy yangiliklari", t:['dunyo','bepul','web']},
{n:"Bloomberg", u:"https://www.bloomberg.com/", d:"Jahon yetakchilari foydalanadigan premium biznes, neft va yirik moliya iqtisodiyoti tezkor axboroti", t:['dunyo','pullik','web']},
{n:"Reuters", u:"https://www.reuters.com/", d:"Geosiyosat va valyutalarga ta'sir etuvchi ob'yektiv, tezkor xalqaro biznes holatlari va konfliktlar xabarlari", t:['dunyo','bepul','web']},
{n:"Forbes", u:"https://www.forbes.com/", d:"Haftalik trendlar, milliarderlar xarajatlari hamda xususiy kapital bozorini kuzatuvchi biznes onlayn nashri", t:['dunyo','pullik','web']},
{n:"CoinDesk", u:"https://www.coindesk.com/", d:"Butun Kripto texnologiya hamda Web3 sohalariga ixtisoslashgan markaziy jurnal va axborot yig'indisi", t:['dunyo','bepul','web']}
]},

{id:'tools',title:"Kundalik Vositalar",icon:"fa-toolbox",gr:"from-sky-500 to-indigo-500",
items:[
{n:"DeepL", u:"https://www.deepl.com/", d:"Aksariyat insoniyat tarjimasidan aniqroq ishlangan neyron tarmoqli dunyoning eng zo'r AI mutaxassis tarjimoni", t:['dunyo','bepul','web','mobil']},
{n:"PDF24", u:"https://www.pdf24.org/", d:"Boshqa servislar kabi pul so'ramaydigan cheksiz PDF o'qish, siqish, burish va tahrirlash platformasi 100% bepul", t:['dunyo','bepul','web']},
{n:"WeTransfer", u:"https://wetransfer.com/", d:"Xotira, yoki telegram limti tugaganda katta gigabaytli arxiv va fayllarni mail orqali 2GB gacha tez yuborish", t:['dunyo','bepul','web']},
{n:"Remove.bg", u:"https://www.remove.bg/", d:"Selfi yoki buyumlar orqasidagi fon ko'rinishini atigi 1 soniyada mukammal olib tashlab .png qilib berish", t:['dunyo','bepul','web']},
{n:"Star Walk 2", u:"https://starwalk.space/", d:"Telefon kamerasini tungi osmonga qaratib, sayyoralar, yulduzlar va koinotning go'zallik xaritasini kashf qiling", t:['dunyo','bepul','mobil']},
{n:"Radio Garden", u:"http://radio.garden/", d:"Yer shari globusini aylantirgan holda butunjahon shahar, chekka hududlaridagi jonli va qiziq radiolarni tinglash", t:['dunyo','bepul','web','mobil']},
{n:"Wolfram Alpha", u:"https://www.wolframalpha.com/", d:"Statistika qoidalari, murakkab oliy matematika va har qanday sohadagi chigal funksional muammolar hisoblagichi", t:['dunyo','bepul','web']},
{n:"IlovePDF", u:"https://www.ilovepdf.com/", d:"Internet yordamida qulay interfeys bilan istalgan PDF ni Word yozuviga, yoki Excell formatga aylantirib olish vositasi", t:['dunyo','bepul','web']},
{n:"Smallpdf", u:"https://smallpdf.com/", d:"Xujjat imzolash, kattalashib ketgan hujjat megabaytlarini kichraytirish va parollangan qog'ozlarni oson qirqish tizimi", t:['dunyo','bepul','web']},
{n:"123apps", u:"https://123apps.com/", d:"Hech narsa o'rnatmasdan oddiy brauzer oynasida video, audio qirqish ekran zapis qilish kabi 10lab vositalar markazi", t:['dunyo','bepul','web']},
{n:"TinyPNG", u:"https://tinypng.com/", d:"Web saytlar, bloger va SMM ustalari uchun suratning sifat ko'rinishini umuman yo'qotmasdan hajmini piksel siqish", t:['dunyo','bepul','web']},
{n:"VirusTotal", u:"https://www.virustotal.com/", d:"Shubhali havola linklari, crack qilingan kompyuter va mobil ilovalarni Google o'zining yuzlab antivirular bazasida tekshirish", t:['dunyo','bepul','web']},
{n:"Speedtest", u:"https://www.speedtest.net/", d:"Dunyodagi eng asosiy, operatorlar provayderingiz qancha internet tezligini ko'tarib bera olayotganini aniq tezkor o'lchash", t:['dunyo','bepul','web','mobil']},
{n:"Fast.com", u:"https://fast.com/", d:"Videolar uchun zarur oqimni tekshirish maqsadida Netflix tomonidan tayyorlangan, kirganda avtomatik eng tez tezlik testi", t:['dunyo','bepul','web']},
{n:"Google Translate", u:"https://translate.google.com/", d:"Offline lug'atlar va jonli kamera o'girish imkoniga ega, 100+ eng ommabop global tillarni universal va onlayn oddiy o'girish", t:['dunyo','bepul','web','mobil']},
{n:"Yandex Translate", u:"https://translate.yandex.com/", d:"Rus va ingliz tarjimalari konteksti boy va kuchli hisoblangan MDH davlatlari grammatikasi hisobga olingan to'liq qulay tarjimon", t:['dunyo','bepul','web','mobil']},
{n:"Convertio", u:"https://convertio.co/", d:"Video formatlari, audio turlari, shrift, surat hamda dokument fayllarni mutlaqo xohlagan boshqa texnik qulay formatga osongina konvertatsiya qilish", t:['dunyo','bepul','web']},
{n:"CloudConvert", u:"https://cloudconvert.com/", d:"200 xildan ortiq hujjat, arxivlar turlari o'rtasida katta fayllarni xavfsiz va original detallarga putur yetkazmay, yuqori sifatda o'giruvchi server konvertori", t:['dunyo','bepul','web']},
{n:"Zamzar", u:"https://www.zamzar.com/", d:"Hech qanday dasturlarsiz eng qadimgi, 15 yillik obro'ga ega, internet olamining kompyuter formati o'zgartirish oddiy onlayn klassik konvertor ustozi", t:['dunyo','bepul','web']},
{n:"Calculator.net", u:"https://www.calculator.net/", d:"Mashina ijarasi, kredit stavkasi ipoteka tushumlari BMI indeksi va turli murakkab moliyaviy formulalarga maxsus, aniq tushunarli onlayn asbob", t:['dunyo','bepul','web']},
{n:"Desmos", u:"https://www.desmos.com/", d:"O'rta va Oliy Ta'lim muassasalari talabalari tenglamalarni vizual ravishda 2D, 3D da harakatga keltirib o'rganadigan zamonaviy ilmiy interaktiv chizmalar grafikali mashhur matematika kalkulyatori", t:['dunyo','bepul','web']},
{n:"Geogebra", u:"https://www.geogebra.org/", d:"Mantiqiy, Geometriya, algebra statistika muammolari va harakatlanuvchi shakllarni sintez integratsiya qilib o'rganish vositasi ta'lim sohasining yirik ustuni", t:['dunyo','bepul','web']}
]},

{id:'security',title:"Xavfsizlik va VPN",icon:"fa-shield-halved",gr:"from-slate-600 to-slate-900",
items:[
{n:"Bitwarden", u:"https://bitwarden.com/", d:"Butunlay tekin bulut saqlovchi va Open-source (Ochiq manba) kod orqali barcha qulaylikka ega eng mukammal super xavfsiz parollar va avtoform menejeri", t:['dunyo','bepul','web','mobil']},
{n:"ProtonVPN", u:"https://protonvpn.com/", d:"Shveysariya qattiq xavfsizlik maxfiylik qonuniy standartiga javob beruvchi dunyodagi eng toza ma'lumot saqlamaydigan, kuchli tekin cheksiz trafiklik VPN xizmati", t:['dunyo','bepul','web','mobil']},
{n:"AdGuard", u:"https://adguard.com/", d:"Saytlarning kuzatuv markerlarini (tracker), viruslarni hamda ko'zga tashlanadigan YouTube reklamalaridan tortib barcha bannerlarini butunlay xavfsiz va samarali bloklab ekranni tozalash", t:['dunyo','bepul','web','mobil']},
{n:"1Password", u:"https://1password.com/", d:"Yirik biznes kompaniyalar uchun to'liq optimallashtirilgan yashirin parollar xavfsizlik jurnali, kredit kartalar muhofazasi hamda premium passkey menejeri", t:['dunyo','pullik','web']},
{n:"Mullvad VPN", u:"https://mullvad.net/", d:"Dunyoda hech qanaqa email va akkaunt so'ramaydigan, faqatgina generatsiya qilingan raqam orqali ishlaydigan hukumatlardan mustaqil kriptografik ultra maxfiy VPN", t:['dunyo','pullik','web','mobil']},
{n:"Proton Mail", u:"https://proton.me/mail", d:"Uzatuvchi va qabul qiluvchi o'rtasida end-to-end (oxirigacha) shifrlangan, umuman reklamalarsiz hamda hukumatlar uchinchi shaxslarga topshirmaydigan ochiq xavfsiz pochtalar email xizmati", t:['dunyo','bepul','web','mobil']},
{n:"Authy", u:"https://authy.com/", d:"Barcha loginlarda va muhim tizimda (2FA) SMS kutmasdan ikki faktorli avtorizatsiya va bulutda xavfsiz ishonchli tiklanish zaxiraga ega qulay va shaxsiy autentifikatsiya raqamlarni uzatish mobil dasturi", t:['dunyo','bepul','mobil']},
{n:"Google Authenticator", u:"https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2", d:"Offlayn ishlaydigan va vaqt o'tishi bilan o'zgaradigan PIN kodlar asosida ijtimoiy xavfsiz internet hisoblaringiz kirish ruxsatnomalarini boshqarishning oddiy usuli (QR va avtomatik o'zgaruvchi kirish kodlari)", t:['dunyo','bepul','mobil']},
{n:"LastPass", u:"https://www.lastpass.com/", d:"Katta yosh avlodlar ham yoqtiradigan eski va eng mashhur avto to'ldiruvchi master passwordlarga qulay parol saqlovchisi shifrlangan ma'lumotlar menejeri platformasi", t:['dunyo','bepul','web','mobil']},
{n:"NordVPN", u:"https://nordvpn.com/", d:"Striming servislari uzilishi, geobloklar va sekinliklarni hal qilishga mo'ljallangan yashirin xizmat ko'rsatish server tarmoqli pullik tezkor maxfiy global VPN xizmati yo'nalishi", t:['dunyo','pullik','web','mobil']},
{n:"ExpressVPN", u:"https://www.expressvpn.com/", d:"Pingingizni, ping pastligi tufayli kompyuter o'yinlari qotishi hamda video sifatini buzilmasligi uchun eng katta jahon obro'ga ega barqaror aloqadagi eng tezkor yuqori VPN tarmog'i ulanishi", t:['dunyo','pullik','web','mobil']},
{n:"Surfshark", u:"https://surfshark.com/", d:"Arzon pullik rejada hech qanday qurilma miqdorini chegaralamay, bitta hisob yordamida oila va hamma texnikaga ishlaydigan hamda reklamani yo'qotuvchi anti-tracker blokirovka VPN aloqasi", t:['dunyo','pullik','web','mobil']},
{n:"CyberGhost", u:"https://www.cyberghostvpn.com/", d:"O'yin pingni minimallashtiruvchi protokollar va torrent oqim xotiralari, striming uchun mukammal optimallashtirilgan katta global maxfiy shifrlash uskunasi hamda qulay pullik himoyalanuvchi tarmoq", t:['dunyo','pullik','web','mobil']},
{n:"WireGuard", u:"https://www.wireguard.com/", d:"Loyiha va Linux uchun murakkab, eski, OpenVPN ga nisbatan eng yangi o'ta tez, ancha yengil kodlardan yozilgan tizim shifrlash protokoli ochiq marshrut platformasi standart VPN yadrosi", t:['dunyo','bepul','web','mobil']},
{n:"Outline", u:"https://getoutline.org/", d:"Jigsaw tomonidan yaratilgan Google'ning cheklov qo'yilgan senzuradan ishonch bilan xavfsiz chetlab o'tuvchi davlatlar va IT kompaniyalar qo'llaydigan bepul mustaqil himoya qobiq protokoli va shaxsiy server VPN", t:['dunyo','bepul','web','mobil']},
{n:"Tuta", u:"https://tuta.com/", d:"O'zini nemis maxfiylik huquqi orqasida bekinib foydalanuvchilar ob'ektiv erkinligi kafolatlangan shaxsiy manzillardan kelgan maktublar, taqvim xabarlarini oxirigacha shifrlab barcha maxfiy pochtani saqlaydigan xizmat tizimi", t:['dunyo','bepul','web','mobil']},
{n:"DuckDuckGo", u:"https://duckduckgo.com/", d:"Google qidiruvidan farqli o'laroq profilingiz yoki oldingi nima yozib tarixini eslamaydigan sizni aslo kuzatmaydigan trackinglarsiz qidiruv tizimi, qidirish so'zlari maxsus maqsadlarga sarflanmaydigan himoyalangan ochiq aloqa", t:['dunyo','bepul','web','mobil']},
{n:"Brave", u:"https://brave.com/", d:"Saytlarga kirganda kripto mukofot ishlab topsa bo'ladigan blokcheyn standartidagi trackerlar cookie va Youtube reklamalarini ulashmagan xavfsiz Chrome singari asosiydan yengil va eng xavfsiz Chromium brauzer tizimi", t:['dunyo','bepul','web','mobil']},
{n:"Tor Browser", u:"https://www.torproject.org/", d:"Kuzatuvchilar IP ma'lumot va kuzatish kameralaridan uch mingdan ortiq marshrutga IP ni almashtirib DarkWeb tarmoq hamda shunchaki ishonchli yashirinish uchun sozlangan shifrlangan qidiruv ko'rishi maxsus universal tizim brauzeri vositasi", t:['dunyo','bepul','web','mobil']},
{n:"Signal", u:"https://signal.org/", d:"Hatto yaratuvchilari ham chatni o'qiy olmaydigan jamoat mutaxassislari, kiberxavfsizlik ekspertlari va afsonaviy Edward Snowden doimiy ishlatib tavsiya qilgan dunyodagi yagona eng maxfiy shifrlangan audio-video open-source mustaqil aloqa messenjeri", t:['dunyo','bepul','mobil']},
{n:"Threema", u:"https://threema.ch/", d:"Yevropadagi ma'lumot standartiga ro'yihasidan chiqqan Shveytsariyada joylashgan telefon yoki shaxsga tegishli nomlarsiz shunchaki unikal ismli kodi orqali ochiladigan guruh suhbatlari, korporativ maxfiy himoyalangan pullik mukammal chat va onlayn messenjer logikasi", t:['dunyo','pullik','mobil']},
{n:"Malwarebytes", u:"https://www.malwarebytes.com/", d:"Har qanday shubhali fayl ichidagi troyan va standart antiviruslarga tushib qolmaydigan maxfiy zararkunandalarni tez aniqlab yo'q qiluvchi barcha kompyuter o'zida ishonch bilan xavfsiz holda tekshirish vositasi dasturlarni tizimni tozalash qiruvchisi", t:['dunyo','bepul','web','mobil']}
]}
]; // END DATA

// ═══════════════════════════════════════════════════════════
//  STATE & INIT
// ═══════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════
//  LOGO LOGIC (FONSZ, BITTALIK TOZA LOGOTIP / AVATAR)
// ═══════════════════════════════════════════════════════════
function getDomain(url){ try{return new URL(url).hostname.replace('www.','');}catch(e){return '';} }

function getFallbackColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['ef4444','f97316','f59e0b','10b981','14b8a6','06b6d4','3b82f6','6366f1','8b5cf6','d946ef','f43f5e'];
  return colors[Math.abs(hash) % colors.length];
}

// ── Global logo fallback — qo'shtirnoq muamosiz
window._logoFail = function(img) {
  const domain = img.dataset.domain;
  const svg    = img.dataset.svg;
  const step   = parseInt(img.dataset.step || '0');
  if (step === 1 && domain) {
    // 2-urinish: DuckDuckGo favicon
    img.dataset.step = '2';
    img.src = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  } else {
    // Oxirgi: tiniq globus SVG
    img.onerror = null;
    img.src = svg;
  }
};

function _globeSVG(c1, c2) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<defs>` +
    `<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient>` +
    `</defs>` +
    `<rect width="64" height="64" rx="14" fill="url(#bg)"/>` +
    // Globe circle
    `<circle cx="32" cy="32" r="16" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2"/>` +
    // Equator line
    `<line x1="16" y1="32" x2="48" y2="32" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>` +
    // Vertical center line
    `<line x1="32" y1="16" x2="32" y2="48" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>` +
    // Left longitude arc
    `<path d="M32 16 Q22 32 32 48" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>` +
    // Right longitude arc
    `<path d="M32 16 Q42 32 32 48" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>` +
    `</svg>`
  )}`;
}

function iconHTML(item, cls="w-10 h-10 object-contain drop-shadow-sm") {
const domain = getDomain(item.u);

// Har bir ilova uchun o'ziga xos gradient rang
const palettes = [
  ['#6366f1','#8b5cf6'],['#8b5cf6','#d946ef'],['#06b6d4','#3b82f6'],
  ['#10b981','#059669'],['#f59e0b','#ef4444'],['#f97316','#ec4899'],
  ['#14b8a6','#6366f1'],['#3b82f6','#0ea5e9'],['#d946ef','#f43f5e'],
  ['#ef4444','#f97316'],['#84cc16','#10b981'],['#a855f7','#6366f1']
];
let hash = 0;
for(let i=0;i<item.n.length;i++) hash = item.n.charCodeAt(i)+((hash<<5)-hash);
const [c1,c2] = palettes[Math.abs(hash) % palettes.length];

// Logo topilmasa — tiniq globus ikonkasi (har biri o'z rangida)
const svgData = _globeSVG(c1, c2);

// Boshlang'ich manba: Google favicon (ishonchli)
const src = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : svgData;

return `<img src="${src}" alt="${item.n}" loading="lazy"
  class="${cls} transition-transform group-hover:scale-110"
  data-domain="${domain}"
  data-svg="${svgData}"
  data-step="1"
  onerror="window._logoFail(this)">`;
}

// ═══════════════════════════════════════════════════════════
//  CLICK TRACKING — optimistic UI + Supabase atomic increment
// ═══════════════════════════════════════════════════════════
function getClicks(name){
return globalClicks[name] || 0;
}

function addClick(name){
// 1. Optimistic: UI ni darhol oshir (tez ko'rinsin)
globalClicks[name] = (globalClicks[name]||0) + 1;
_updateCountEl(name, globalClicks[name]);
renderTrending();
updateSidebarStats();

// 2. Supabase ga atomic increment — haqiqiy global qiymat
_supaIncrement(name).then(serverVal => {
  if(serverVal !== null && serverVal !== globalClicks[name]){
    globalClicks[name] = serverVal;
    _updateCountEl(name, serverVal);
    updateSidebarStats();
  }
});

// 3. So'nggi ko'rilganlar
let foundItem = null;
DATA.forEach(c=>c.items.forEach(i=>{ if(i.n===name) foundItem=i; }));
if(foundItem){
  recentlyVisited = [foundItem, ...recentlyVisited.filter(i=>i.n!==name)].slice(0,8);
  localStorage.setItem('lh_recent', JSON.stringify(recentlyVisited));
  renderRecent();
}
}

// ═══════════════════════════════════════════════════════════
//  TRENDING SECTION
// ═══════════════════════════════════════════════════════════
function renderTrending(){
const all=[];
DATA.forEach(c=>{
  if(c.id !== 'my_apps') c.items.forEach(i=>{ if(getClicks(i.n)>0) all.push({...i,_cat:c}); });
});
all.sort((a,b)=>getClicks(b.n)-getClicks(a.n));
const top=all.slice(0,7);
const sec=$('trendingSection'), grid=$('trendingGrid');
if(!top.length){sec.classList.add('hidden');return;}
sec.classList.remove('hidden');
grid.innerHTML=top.map((item,idx)=>{
  const esc=item.n.replace(/'/g,"\\'");
  const escUrl=item.u.replace(/'/g,"\\'");
  const isMob=item.t?.includes('mobil');
  const hasWeb=item.t?.includes('web');
  const clickAct=(isMob||item.androidUrl)
    ? `openPlatformModal('${esc}','${escUrl}',${hasWeb},true)`
    : `addClick('${esc}');setTimeout(()=>rerenderClickFor('${esc}'),50);window.open('${escUrl}','_blank','noopener,noreferrer')`;
  const rankColor = idx===0?'from-yellow-400 to-amber-500': idx===1?'from-slate-400 to-slate-500': idx===2?'from-orange-400 to-amber-600':'from-violet-500 to-fuchsia-500';
  return `
  <div onclick="${clickAct}" class="trend-card group">
    <span class="text-[9px] font-black ${idx===0?'text-amber-500':idx===1?'text-slate-400':idx===2?'text-orange-500':'text-violet-400'} w-5 text-center">#${idx+1}</span>
    <div class="shrink-0">${iconHTML(item, 'w-7 h-7 rounded-lg shadow-sm object-contain')}</div>
    <span class="text-[11px] font-bold text-slate-800 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">${item.n}</span>
    <span class="flex items-center gap-0.5 text-[10px] font-black text-orange-500"><i class="fa-solid fa-fire text-[8px]"></i>${getClicks(item.n)}</span>
  </div>`}).join('');
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

// ═══════════════════════════════════════════════════════════
//  CARD HTML
// ═══════════════════════════════════════════════════════════
function card(item){
const isFav      = favorites.includes(item.n);
const isBepul    = item.t?.includes('bepul');
const isPullik   = item.t?.includes('pullik');
const isMob      = item.t?.includes('mobil');
const hasWeb     = item.t?.includes('web') || item.isCustom;
const isCustom   = item.isCustom;
const isVerified = !!item.v;
const q2         = query.trim();
const c          = getClicks(item.n);
const isHot      = c >= 5;
const esc        = item.n.replace(/'/g,"\\'");
const escUrl     = item.u.replace(/'/g,"\\'");

const mainClick = (isMob || item.androidUrl)
  ? `openPlatformModal('${esc}','${escUrl}',${hasWeb},${!!(isMob||item.androidUrl)})`
  : `addClick('${esc}');setTimeout(()=>rerenderClickFor('${esc}'),50);window.open('${escUrl}','_blank','noopener,noreferrer')`;

// Platforma badgelari
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

  <!-- TOP RIGHT: fav always, edit/delete for custom (hover) -->
  <div class="absolute top-3 right-3 flex items-center gap-1.5 z-20">
    ${isCustom ? `
    <div class="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onclick="event.stopPropagation();openEditModal('${esc}')" title="Tahrirlash" class="w-7 h-7 rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-400 hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-500/20 transition-colors flex items-center justify-center shadow-sm backdrop-blur-sm"><i class="fa-solid fa-pen text-[9px]"></i></button>
      <button onclick="event.stopPropagation();deleteCustomApp('${esc}')" title="O'chirish" class="w-7 h-7 rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/20 transition-colors flex items-center justify-center shadow-sm backdrop-blur-sm"><i class="fa-solid fa-trash text-[9px]"></i></button>
    </div>` : ''}
    <button onclick="event.stopPropagation();toggleFav('${esc}',this)"
        class="fav-btn w-7 h-7 rounded-full flex items-center justify-center text-[11px] shadow-sm backdrop-blur-sm transition-colors ${isFav?'bg-rose-100 text-rose-500 dark:bg-rose-500/20':'bg-white/80 dark:bg-slate-800/80 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'}">
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
        <span class="truncate">${hl(item.n,q2)}</span>
        ${isVerified ? `<span class="verified-icon" title="Rasmiy va ishonchli platforma"><i class="fa-solid fa-shield-halved"></i></span>` : ''}
      </div>
      <div class="flex flex-wrap gap-1 mt-1.5 items-center">${badges}</div>
    </div>
  </div>

  <!-- DESCRIPTION -->
  <p class="text-[11.5px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed flex-1 relative z-10">${hl(item.d||'',q2)}</p>

  <!-- CARD FOOTER: views(left) — report+share(right) -->
  <div class="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100/80 dark:border-slate-800/50 relative z-10">
    <!-- Ko'rishlar soni — chap -->
    <div class="flex items-center gap-1 text-[10px] font-bold rounded-full px-1.5 py-0.5
      ${c ? 'text-violet-500 dark:text-violet-400' : 'text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity'}"
      id="cb-${item.n.replace(/[^a-zA-Z0-9]/g,'_')}">
      <i class="fa-regular fa-eye text-[9px]"></i>
      <span>${c||0}</span>
    </div>
    <!-- Report + Share — o'ng -->
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

window.toggleFav = function(name, btn, silent=false){
favorites = favorites.includes(name)
  ? favorites.filter(n=>n!==name)
  : [...favorites, name];
localStorage.setItem('lh_favs', JSON.stringify(favorites));
saveUserDataToSupabase();
const on = favorites.includes(name);
if(!silent && on) showToast("Saqlanganlarga qo'shildi!", 'fa-heart text-rose-400');
if(btn) {
    btn.className = `fav-btn w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] ${on?'bg-rose-100 text-rose-500 dark:bg-rose-500/20':'bg-slate-100 dark:bg-slate-700/50 text-slate-400 hover:text-rose-500'}`;
    btn.innerHTML = `<i class="fa-${on?'solid':'regular'} fa-heart"></i>`;
}
if(activeCat==='favorites') renderContent();
renderNav();
};

function renderNav(){
const total=DATA.reduce((a,c)=> c.id !== 'my_apps' ? a+c.items.length : a,0);
$('sidebarCount').textContent=`${total} ta resurs`;

// ── Helper: build one nav item ──
const navBtn = (onclick, title, icon, label, count, extraClass='', countClass='') => {
  return `<button onclick="${onclick}" title="${title}"
    class="sb-nav-item ${extraClass} w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-sm group">
    <div class="flex items-center gap-2.5 min-w-0 overflow-hidden">
      <i class="fa-solid ${icon} w-4 text-center text-xs opacity-55 group-hover:opacity-100 transition-opacity shrink-0"></i>
      <span class="truncate text-left">${label}</span>
    </div>
    ${count ? `<span class="text-[9px] px-1.5 py-0.5 rounded-full ${countClass} shrink-0 font-bold">${count}</span>` : ''}
  </button>`;
};

// ── Shaxsiy ro'yxat (pinned) ──
const myActive = activeCat==='my_apps';
const myCountCls = myActive ? 'bg-violet-200 dark:bg-violet-500/30 text-violet-600 dark:text-violet-300' : 'bg-slate-200 dark:bg-slate-700/80 text-slate-500';
const myExtraCls = myActive ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50';
const pinned = navBtn(`setCat('my_apps')`, "Shaxsiy ro'yxat", 'fa-folder-open',
  "Shaxsiy ro'yxat", customApps.length||'', myExtraCls, myCountCls);
$('sidebarPinned').innerHTML = pinned +
  `<div class="h-px w-full bg-slate-200 dark:bg-slate-700/60 mt-2 mb-1"></div>`;

// ── Kategoriyalar ──
const allActive = activeCat==='all';
const favActive = activeCat==='favorites';

let s = navBtn(`setCat('all')`, 'Barchasi', 'fa-border-all', 'Barchasi', total,
  allActive ? 'nav-active' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50',
  allActive ? 'bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-200' : 'bg-slate-200 dark:bg-slate-700/80 text-slate-500');

s += navBtn(`setCat('favorites')`, 'Saqlanganlar', 'fa-heart', 'Saqlanganlar',
  favorites.length||'',
  favActive ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50',
  favActive ? 'bg-rose-200 dark:bg-rose-500/30 text-rose-600' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-500');

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
  <button onclick="setCat('my_apps')" class="flex-shrink-0 text-[11px] font-bold px-4 py-1.5 rounded-full border transition-all ${activeCat==='my_apps'?'pill-active':'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">🛠️ Shaxsiy (${customApps.length})</button>
  <button onclick="setCat('all')" class="flex-shrink-0 text-[11px] font-bold px-4 py-1.5 rounded-full border transition-all ${activeCat==='all'?'pill-active':'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">Barchasi</button>
  <button onclick="setCat('favorites')" class="flex-shrink-0 flex items-center gap-2 text-[11px] font-bold px-4 py-1.5 rounded-full border transition-all ${activeCat==='favorites'?'bg-rose-500 text-white border-transparent shadow-lg shadow-rose-500/30':'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">
    <i class="fa-solid fa-heart"></i> ${favorites.length||''}
  </button>`;
DATA.forEach(c=>{
  if (c.id === 'my_apps') return;
  m+=`<button onclick="setCat('${c.id}')" class="flex-shrink-0 text-[11px] font-bold px-4 py-1.5 rounded-full border transition-all whitespace-nowrap ${activeCat===c.id?'pill-active':'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">${c.title}</button>`;
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
$('deskClr').classList.add('opacity-0', 'pointer-events-none');
$('mobClr').classList.add('opacity-0', 'pointer-events-none');
hideDrop();
if(id==='all') $('pageTitle').textContent='Barcha Resurslar';
else if(id==='favorites') $('pageTitle').textContent='Saqlanganlar';
else $('pageTitle').textContent=DATA.find(c=>c.id===id)?.title||'';
renderNav(); renderContent();
$('mainScroll').scrollTo({top:0,behavior:'smooth'});
};

function renderContent(){
$('appsContainer').innerHTML='';
let found=0, delay=0;
const buildSec=(items, heading, gr, catId)=>{
  if(!items.length) return;
  found+=items.length;
  const sec=document.createElement('div');
  sec.className='animate-fade-up';
  sec.style.animationDelay=`${delay}s`;
  delay+=0.025;
  // Category share URL
const shareUrl = catId ? ('https://elink.uz/?cat=' + catId) : 'https://elink.uz';
  const shareTitle = heading ? heading + ' — E-Link UZ' : 'E-Link UZ';
  const shareBtn = heading ? `
    <button onclick="shareCat('${shareTitle.replace(/'/g,"\\'")}','${shareUrl.replace(/'/g,"\\'")}',this)"
      class="ml-auto flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors border border-transparent hover:border-violet-200 dark:hover:border-violet-500/20">
      <i class="fa-solid fa-share-nodes text-[10px]"></i>
      <span class="hidden sm:inline">Ulashish</span>
    </button>` : '';
  const h=heading?`<div class="flex items-center gap-3 mb-4">
    <div class="w-1 h-5 rounded-full bg-gradient-to-b ${gr}"></div>
    <h3 class="text-base font-black text-slate-800 dark:text-white">${heading}</h3>
    <span class="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">${items.length} ta</span>
    ${shareBtn}
  </div>`:'';
  const grid=`<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
    ${items.map(i=>card(i)).join('')}
  </div>`;
  sec.innerHTML=h+grid;
  $('appsContainer').appendChild(sec);
};

if(activeCat==='favorites'){
  const fItems=[];
  DATA.forEach(c=>c.items.forEach(i=>{ if(favorites.includes(i.n)&&matchItem(i,c)) fItems.push(i); }));
  buildSec(sortItems(fItems), null, 'from-rose-400 to-rose-600');
  if(!fItems.length){
    $('appsContainer').innerHTML=`<div class="flex flex-col items-center justify-center py-24 text-slate-400">
      <i class="fa-regular fa-heart text-5xl mb-4"></i>
      <p class="font-bold text-lg">Hali saqlangan ilovalar yo'q</p>
      <p class="text-sm mt-1">Ilovalarni ❤️ bilan saqlang</p>
    </div>`;
    found=1;
  }
} else if(activeCat==='my_apps'){
  // my_apps uchun — faqat shaxsiy, share tugmasi yo'q
  const items = sortItems(customApps.filter(i=>matchItem(i,null)));
  found += items.length + 1;

  const sec = document.createElement('div');
  sec.className = 'animate-fade-up';
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4';

  // "+" qo'shish kartasi — birinchi
  const addCard = document.createElement('div');
  addCard.onclick = openCustomModal;
  addCard.className = 'add-card glass rounded-2xl p-4 flex flex-col items-center justify-center h-full cursor-pointer group border-2 border-dashed border-violet-200 dark:border-violet-800/50 hover:border-violet-400 dark:hover:border-violet-600 transition-all min-h-[130px]';
  addCard.innerHTML = `
    <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/25 mb-2.5 group-hover:scale-110 transition-transform">
      <i class="fa-solid fa-plus text-base"></i>
    </div>
    <p class="text-sm font-black text-slate-700 dark:text-slate-300 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">Yangi qo'shish</p>
    <p class="text-[10px] text-slate-400 mt-0.5">Shaxsiy resurs qo'shing</p>`;
  grid.appendChild(addCard);

  items.forEach(i=>{
    const wrapper = document.createElement('div');
    wrapper.innerHTML = card(i);
    grid.appendChild(wrapper.firstElementChild);
  });

  sec.appendChild(grid);
  $('appsContainer').appendChild(sec);

} else {
  DATA.forEach(c=>{
    if(activeCat!=='all'&&activeCat!==c.id) return;
    const items=sortItems(c.items.filter(i=>matchItem(i,c)));
    buildSec(items, (activeCat==='all'||query.trim())?c.title:null, c.gr, c.id);
  });
}

$('resultCount').textContent=found?`${found} ta resurs`:'';
const noR=$('noResults');
if(found===0){ $('appsContainer').classList.add('hidden'); noR.classList.remove('hidden'); noR.classList.add('flex'); }
else{ $('appsContainer').classList.remove('hidden'); noR.classList.add('hidden'); noR.classList.remove('flex'); }
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

function buildDropHTML(q){
const histFiltered=q?srchHist.filter(h=>h.toLowerCase().includes(q.toLowerCase())):srchHist;
let sugg=[];
if(q.length>=2){
  DATA.forEach(c=>c.items.forEach(i=>{ if(i.n.toLowerCase().includes(q.toLowerCase())&&sugg.length<6) sugg.push({...i,_c:c}); }));
}
if(!histFiltered.length&&!sugg.length) return '';
let html='';
if(sugg.length){
  html+=`<p class="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2 py-1.5">💡 Taklif</p>`;
  sugg.forEach(i=>{
    html+=`<button onclick="applySearch('${i.n.replace(/'/g,"\\'")}')" class="s-row w-full text-left flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300">
      <div class="shrink-0 flex items-center justify-center">
          ${iconHTML(i, 'w-5 h-5 object-contain drop-shadow-sm')}
      </div>
      <span class="flex-1 font-bold truncate">${hl(i.n,q)}</span>
      <span class="text-[10px] text-slate-400 truncate max-w-[120px] hidden sm:block">${(i.d||'').slice(0,40)}…</span>
    </button>`;
  });
}
if(histFiltered.length){
  html+=`<p class="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2 py-1.5 mt-1">🕐 Oxirgi qidiruvlar</p>`;
  histFiltered.forEach(h=>{
    html+=`<div class="s-row flex items-center gap-2 px-2 py-1.5 group">
      <button onclick="applySearch('${h.replace(/'/g,"\\'")}') " class="flex-1 text-left flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
        <i class="fa-solid fa-clock-rotate-left text-slate-300 text-xs w-4 shrink-0"></i>
        <span class="truncate">${hl(h,q)}</span>
      </button>
      <button onclick="removeHist('${h.replace(/'/g,"\\'")}')" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all text-xs px-1">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>`;
  });
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
const handle=e=>{
  query=e.target.value;
  $('deskSrc').value=$('mobSrc').value=query;
  $('deskClr').classList.toggle('opacity-0',!query);
  $('deskClr').classList.toggle('pointer-events-none',!query);
  $('mobClr').classList.toggle('opacity-0',!query);
  $('mobClr').classList.toggle('pointer-events-none',!query);
  updateDrops(query);
  clearTimeout(sTimer);
  sTimer=setTimeout(()=>{ if(query.trim()) saveHist(query); renderContent(); },160);
};
const clearS=()=>{
  query=''; $('deskSrc').value=$('mobSrc').value='';
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
const tTxt = $('themeTxt');

const upd=dark=>{
  if(iDesk) { iDesk.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'; }
  if(iMob) { iMob.className = dark ? 'fa-solid fa-sun text-sm' : 'fa-solid fa-moon text-sm'; }
  if(tTxt) tTxt.textContent=dark?'Kunduzgi rejim':'Tungi rejim';
};
upd(html.classList.contains('dark'));
[$('themeBtn'),$('themeBtnMob')].forEach(btn=>btn?.addEventListener('click',()=>{
  const dark=html.classList.toggle('dark');
  localStorage.lh_theme=dark?'dark':'light';
  upd(dark);
}));
}

// ═══════════════════════════════════════════════════════════
//  SHARE CATEGORY — kategoriya ulashish
// ═══════════════════════════════════════════════════════════
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
// Brief visual feedback on the button
if(btn){
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-check text-[10px]"></i><span class="hidden sm:inline">Nusxalandi</span>';
  btn.classList.add('text-emerald-500','border-emerald-200');
  setTimeout(()=>{ btn.innerHTML=orig; btn.classList.remove('text-emerald-500','border-emerald-200'); }, 1800);
}
showToast(`"${title}" havolasi nusxalandi!`, 'fa-link text-violet-400');
};


// ═══════════════════════════════════════════════════════════
//  SHARE CARD — har bir kartochka uchun ulashish
// ═══════════════════════════════════════════════════════════
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

  // Progress bar
  if(prog) prog.style.width = pct + '%';

  // Scroll-to-top button
  const show = st > 220;
  btn.classList.toggle('opacity-0', !show);
  btn.classList.toggle('translate-y-4', !show);
  btn.classList.toggle('pointer-events-none', !show);
}, {passive:true});

btn.addEventListener('click',()=> ms.scrollTo({top:0,behavior:'smooth'}));
}

function showToast(msg, ic='fa-circle-check text-emerald-400'){
const t=$('toast'), i=$('toastIco'), m=$('toastMsg');
m.textContent=msg; i.className=`fa-solid ${ic}`;
t.classList.remove('opacity-0','pointer-events-none');
setTimeout(()=>t.classList.add('opacity-0','pointer-events-none'),2500);
}

// ═══════════════════════════════════════════════════════════
//  CUSTOM APPS LOGIC
// ═══════════════════════════════════════════════════════════
//  CUSTOM APP MODAL LOGIC
// ═══════════════════════════════════════════════════════════
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
  // Reset toggles
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

  // URL fields — detect which platforms enabled
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

  // Edit mode
  if(editName){
    const idx = customApps.findIndex(a=>a.n===editName);
    if(idx===-1) return;
    // Name change conflict check
    if(n!==editName && customApps.find(a=>a.n.toLowerCase()===n.toLowerCase()))
      return showToast("Bu nomdagi ilova allaqachon bor!", "fa-triangle-exclamation text-amber-500");

    const tags = ['shaxsiy'];
    if(u) tags.push('web');
    if(aUrl||iUrl) tags.push('mobil');
    const updated = {...customApps[idx], n, u, d, t:tags, isCustom:true};
    if(aUrl) updated.androidUrl=aUrl; else delete updated.androidUrl;
    if(iUrl) updated.iosUrl=iUrl;     else delete updated.iosUrl;
    customApps[idx]=updated;
    // update favs if name changed
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
  // Custom confirm modal — browser confirm() o'rniga
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


// ═══════════════════════════════════════════════════════════
//  SO'NGGI KO'RILGAN RESURSLAR
// ═══════════════════════════════════════════════════════════
function renderRecent(){
const wrap = document.getElementById('recentSection');
if(!wrap) return;
if(!recentlyVisited.length){ wrap.classList.add('hidden'); return; }
wrap.classList.remove('hidden');
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
}

// ═══════════════════════════════════════════════════════════
//  SIDEBAR STATS YANGILASH
// ═══════════════════════════════════════════════════════════
function updateSidebarStats(){
const el = document.getElementById('sidebarStats');
if(!el) return;
const total = DATA.reduce((a,c)=> c.id !== 'my_apps' ? a+c.items.length : a, 0);
const totalClicks = Object.values(globalClicks).reduce((a,b)=>a+b,0) ||
                    Object.values(localClicks).reduce((a,b)=>a+b,0);
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

// ═══════════════════════════════════════════════════════════
//  PLATFORM MODAL — sayt, Android yoki iOS tanlash
// ═══════════════════════════════════════════════════════════
window.openPlatformModal = function(name, url, hasWeb, hasMobil){
  let item = null;
  DATA.forEach(c=>c.items.forEach(i=>{ if(i.n===name) item=i; }));
  const modal=$('platModal'), content=$('platModalContent'), body=$('platModalBody');
  if(!item){ addClick(name); window.open(url,'_blank','noopener,noreferrer'); return; }

  const esc = name.replace(/'/g,"\\'");
  const q   = encodeURIComponent(name);
  // Custom app'da o'z Play/AppStore URL'lari bo'lsa ishlatamiz
  const playUrl = item.androidUrl || `https://play.google.com/store/search?q=${q}&c=apps`;
  const iosUrl  = item.iosUrl || `https://apps.apple.com/search?term=${q}`;
  const domain  = getDomain(url).replace(/\/$/, '');

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
      ${hasWeb ? `
      <button onclick="addClick('${esc}');setTimeout(()=>rerenderClickFor('${esc}'),50);window.open('${url.replace(/'/g,"\\'")}','_blank','noopener,noreferrer');closePlatformModal()"
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
      ${hasMobil ? `
      <button onclick="addClick('${esc}');setTimeout(()=>rerenderClickFor('${esc}'),50);window.open('${playUrl.replace(/'/g,"\\'")}','_blank','noopener,noreferrer');closePlatformModal()"
        class="plat-link flex items-center gap-3.5 w-full rounded-2xl px-4 py-3.5 group">
        <div class="w-11 h-11 rounded-[14px] bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 shrink-0">
          <i class="fa-brands fa-google-play text-[15px]"></i>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="font-bold text-[13.5px] text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Android ilovasi</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Google Play Store'dan yuklab oling</div>
        </div>
        <i class="fa-solid fa-chevron-right text-slate-300 group-hover:text-emerald-400 text-xs shrink-0 transition-transform group-hover:translate-x-0.5"></i>
      </button>
      <button onclick="addClick('${esc}');setTimeout(()=>rerenderClickFor('${esc}'),50);window.open('${iosUrl.replace(/'/g,"\\'")}','_blank','noopener,noreferrer');closePlatformModal()"
        class="plat-link flex items-center gap-3.5 w-full rounded-2xl px-4 py-3.5 group">
        <div class="w-11 h-11 rounded-[14px] bg-gradient-to-br from-slate-600 to-slate-900 flex items-center justify-center text-white shadow-lg shrink-0">
          <i class="fa-brands fa-apple text-[18px]"></i>
        </div>
        <div class="text-left flex-1 min-w-0">
          <div class="font-bold text-[13.5px] text-slate-800 dark:text-white group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">iPhone / iPad ilovasi</div>
          <div class="text-[10px] text-slate-400 mt-0.5">App Store'dan yuklab oling</div>
        </div>
        <i class="fa-solid fa-chevron-right text-slate-300 group-hover:text-slate-500 text-xs shrink-0 transition-transform group-hover:translate-x-0.5"></i>
      </button>` : ''}
    </div>`;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
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
    const zone = 90; // px — chetdan qancha masofada ishlaydi
    const maxSpeed = 5; // px per frame

    cancelAnimationFrame(raf);

    if(x > w - zone) {
      // O'ng tomon — oldinga sura
      const speed = maxSpeed * ((x - (w - zone)) / zone);
      const scroll = () => {
        grid.scrollLeft += speed;
        if(grid.scrollLeft < grid.scrollWidth - grid.clientWidth)
          raf = requestAnimationFrame(scroll);
      };
      raf = requestAnimationFrame(scroll);
    } else if(x < zone) {
      // Chap tomon — orqaga sura
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

// ═══════════════════════════════════════════════════════════
//  REPORT MODAL — "Ishlamayapti" xabari
// ═══════════════════════════════════════════════════════════
window.openReportModal = function(name, url){
  const m=$('reportModal'), mc=$('reportModalContent');
  $('reportSiteName').textContent = name;
  $('reportSiteUrl').value = url;
  $('reportSiteNameHidden').value = name;
  $('reportReason').value = '';
  // Reason tugmalarini reset
  document.querySelectorAll('.reason-btn').forEach(b => {
    b.classList.remove('border-amber-400','text-amber-600','bg-amber-50','dark:bg-amber-500/10');
    b.classList.add('border-slate-200','dark:border-slate-700','text-slate-600','dark:text-slate-400');
  });
  // Textarea yashirish
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

// ═══════════════════════════════════════════════════════════
//  SUGGEST MODAL — yangi resurs taklifi
// ═══════════════════════════════════════════════════════════
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

function init(){
renderNav();
renderContent();
renderTrending();
renderRecent();
setupSearch();
setupTheme();
setupShare();
setupScroll();
setupTrendingScroll();
initGlobalClicks();
updateSidebarStats();
}
init();
// selectReason — report modal
window.selectReason = function(btn, reason) {
  // Barcha tugmalardan active classni olib tashlash
  document.querySelectorAll('.reason-btn').forEach(b => {
    b.classList.remove('border-amber-400','text-amber-600','bg-amber-50','dark:bg-amber-500/10');
    b.classList.add('border-slate-200','dark:border-slate-700','text-slate-600','dark:text-slate-400');
  });
  // Bosilgan tugmani belgilash
  btn.classList.add('border-amber-400','text-amber-600','bg-amber-50','dark:bg-amber-500/10');
  btn.classList.remove('border-slate-200','dark:border-slate-700');
  document.getElementById('reportReason').value = reason;

  // "Boshqa muammo" tanlanganda textarea ko'rsatish
  const wrap = document.getElementById('otherReasonWrap');
  const ta   = document.getElementById('otherReasonText');
  if(reason === 'Boshqa muammo'){
    wrap.classList.remove('hidden');
    requestAnimationFrame(()=>{ wrap.style.maxHeight='200px'; wrap.style.opacity='1'; });
    ta.focus();
  } else {
    wrap.style.maxHeight='0';
    wrap.style.opacity='0';
    setTimeout(()=>{ wrap.classList.add('hidden'); ta.value=''; }, 280);
  }
};
// ── CUSTOM SORT DROPDOWN ──────────────────────────────────
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
  // Highlight active option
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
  // sync hidden select
  const ss = document.getElementById('sSort');
  if(ss) ss.value = val;
  const ts = document.getElementById('topSort');
  if(ts) ts.value = val;
  updateSortDropLabel(val);
  // close dropdown
  const menu = document.getElementById('sortDropMenu');
  const chevron = document.getElementById('sortChevron');
  if(menu) menu.classList.add('hidden');
  if(chevron) chevron.style.transform = '';
  renderNav(); renderContent();
};

// Close on outside click
document.addEventListener('click', function(e){
  const wrap = document.getElementById('sortDropWrap');
  if(wrap && !wrap.contains(e.target)){
    const menu = document.getElementById('sortDropMenu');
    const chevron = document.getElementById('sortChevron');
    if(menu) menu.classList.add('hidden');
    if(chevron) chevron.style.transform = '';
  }
});

// ── TOP SORT CUSTOM DROPDOWN ──────────────────────────────
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

// Close top sort on outside click
document.addEventListener('click', function(e){
  const wrap = document.getElementById('topSortDropWrap');
  if(wrap && !wrap.contains(e.target)){
    const menu = document.getElementById('topSortDropMenu');
    const chev = document.getElementById('topSortChevron');
    if(menu) menu.classList.add('hidden');
    if(chev) chev.style.transform = '';
  }
});

// Patch setSortMode to also update top sort label
const _origSetSortMode = window.setSortMode;
window.setSortMode = function(val){
  _origSetSortMode(val);
  updateTopSortLabel(val);
  // close top sort dropdown too
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

// ── Compress / Decompress (LZ-string → 3-4x qisqa URL) ───
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
    if(!json) json = decodeURIComponent(escape(atob(str))); // fallback eski format
    return JSON.parse(json);
  }catch(e){ return null; }
}

// ── Barcha resurslar (katalog + shaxsiy) ─────────────────
function getAllCatalogItems(){
  const all = [];
  DATA.forEach(cat => {
    if(cat.id === 'my_apps') return; // shaxsiy ro'yxatni chiqarma
    cat.items.forEach(item => all.push({...item, _catId: cat.id, _catTitle: cat.title}));
  });
  return all;
}

// ── Yangi ro'yxat tuzish modali ──────────────────────────
let _builderSelected = new Map(); // n → item

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
                const domain = getDomain(item.u||'');
                const src = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : '';
                const key = item.n;
                const hasMob  = item.t?.includes('mobil');
                const hasWeb  = item.t?.includes('web');
                const isBepul = item.t?.includes('bepul');
                return `<label class="builder-item flex items-start gap-3 p-3 rounded-2xl border border-transparent hover:border-violet-200 dark:hover:border-violet-600/40 hover:bg-violet-50/60 dark:hover:bg-violet-500/10 cursor-pointer transition-all group has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50 dark:has-[:checked]:bg-violet-500/15 dark:has-[:checked]:border-violet-500/60" data-name="${(item.n||'').toLowerCase()}" data-desc="${(item.d||'').toLowerCase()}">
                  <input type="checkbox" class="builder-chk mt-0.5 w-4 h-4 rounded accent-violet-500 shrink-0" data-key="${key}" onchange="builderToggle(this,'${key.replace(/'/g,"\'")}')">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-0.5">
                      <div class="w-8 h-8 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center shrink-0">
                        ${src ? `<img src="${src}" class="w-6 h-6 object-contain" loading="lazy" onerror="this.style.display='none'">` : `<i class="fa-solid fa-globe text-slate-300 text-xs"></i>`}
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

// ── toggleBcMobile — Android/iOS maydonlarini ko'rsatish/yashirish ──
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

// ── Builder: shaxsiy resurs qo'shish ────────────────────
// ── Builder qidiruv X tugmasi ─────────────────────────────
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
  // Tags
  const tags = [];
  if(url)     tags.push('web');
  if(android || ios) tags.push('mobil');
  const item = { n:name, u:url, d:desc, t:tags, isCustom:true,
    ...(android ? {android} : {}), ...(ios ? {ios} : {}) };
  _builderSelected.set(key, item);
  updateBuilderCount();
  // DOM card (2-col grid)
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
  // Reset inputs
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

// ── Step 2: Nom va muallif kiritib havola olish ───────────
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
        <div id="bsQrWrap" class="hidden mt-2 flex items-center justify-center py-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
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

// ── Qisqa kod: 8 ta belgi a-z0-9 ─────────────────────────
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

  // Native share button show
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



// ── Ulashish helperlari ───────────────────────────────────
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
  if(btn) btn.classList.add('bg-violet-100','dark:bg-violet-500/20','text-violet-600','dark:text-violet-400');
}

// ── IMPORT — havoladan kiritish ───────────────────────────
async function detectShareHash(){
  // Format 1: /share-XXXXXXXX (yangi format)
  const pathMatch = location.pathname.match(/\/share-([a-z0-9]{4,16})$/i);
  // Format 2: #l=XXXXXXXX (eski uygunlik)
  const hashLMatch = !pathMatch && location.hash.match(/^#l=([a-z0-9]{4,16})$/);

  const code = (pathMatch||hashLMatch)?.[1];
  if(code){
    // URL ni tozalash (path bo'lsa)
    if(pathMatch) history.replaceState(null,'', '/');
    else history.replaceState(null,'', location.pathname + location.search);

    // Modal tezkor: avval skeleton ko'rsat
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
            // Mavjud modalni yangilash
            const existing = document.getElementById('importListModal');
            if(existing) existing.remove();
            showListPage(data, code, (rows[0].views||0)+1);
            return;
          }
        }
      }
    }catch(e){console.warn('[share]',e.message);}
    // Skeleton modalni yopib xato
    const existing = document.getElementById('importListModal');
    if(existing) existing.remove();
    showToast("Ro'yxat topilmadi yoki muddati o'tgan","fa-circle-xmark text-red-500");
    return;
  }

  // Format 3: #s=... (offline fallback)
  const hash = location.hash;
  if(!hash || hash.length < 3) return;
  history.replaceState(null,'', location.pathname + location.search);
  const fullMatch = hash.match(/^#s=(.+)/);
  if(!fullMatch) return;
  const data = decodeShareList(fullMatch[1]);
  if(!data||!Array.isArray(data.items)||!data.items.length) return;
  showListPage(data, null, 0);
}

// ── Chiroyli ulashilgan ro'yxat sahifasi ─────────────────
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
          const domain = getDomain(item.u||'');
          const src    = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : '';
          const exists = existNames.has((item.n||'').toLowerCase());
          const isBepul= (item.t||[]).includes('bepul');
          const hasWeb = (item.t||[]).includes('web');
          const isMob  = (item.t||[]).includes('mobil');
          const isCustom = item.isCustom || item.c;
          const openUrl  = item.u || item.android || item.ios || '';
          return `<label class="flex items-center gap-3 px-2.5 py-2.5 rounded-2xl hover:bg-violet-50/60 dark:hover:bg-violet-500/10 cursor-pointer transition-all group ${exists?'bg-emerald-50/40 dark:bg-emerald-500/5':''}">
            <input type="checkbox" class="import-chk w-4 h-4 rounded accent-violet-500 shrink-0" data-idx="${idx}" ${exists?'':'checked'}>
            <div class="w-9 h-9 rounded-xl overflow-hidden border ${exists?'border-emerald-200 dark:border-emerald-600/30':'border-slate-100 dark:border-slate-700/60'} bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-sm relative">
              ${src?`<img src="${src}" class="w-7 h-7 object-contain" loading="lazy" onerror="this.style.display='none'">` : `<i class="fa-solid fa-${isCustom?'star':'globe'} text-${isCustom?'violet':'slate'}-300 text-xs"></i>`}
              ${exists?`<div class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm"><i class="fa-solid fa-check text-white text-[7px]"></i></div>`:''}
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

// Eski nom bilan compat alias
function showImportModal(data){ showListPage(data,null,0); }

// ── Nusxalash helper ──────────────────────────────────────
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
  if(box){ box.classList.add('translate-y-4','opacity-0'); }
  setTimeout(()=>m.remove(), 200);
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
    customApps.push({ n:item.n, u:item.u||'', d:item.d||'', t:item.t||[], isCustom:true,
      ...(item.android?{android:item.android}:{}), ...(item.ios?{ios:item.ios}:{}) });
    added++;
  });
  if(!added && skipped){ showToast("Tanlangan resurslar allaqachon mavjud!", "fa-circle-info text-blue-500"); return; }
  if(!added){ showToast("Hech narsa tanlanmadi!", "fa-circle-xmark text-amber-500"); return; }
  localStorage.setItem('lh_custom_apps', JSON.stringify(customApps));
  saveUserDataToSupabase();
  window.closeImportModal();
  showToast(`🎉 ${added} ta resurs shaxsiy ro'yxatga qo'shildi!`, 'fa-circle-check text-emerald-400');
  if(activeCat!=='my_apps') setCat('my_apps');
  else{ renderNav(); renderContent(); }
};


// ── Detect on load ───────────────────────────────────────
detectShareHash();