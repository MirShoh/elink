/* ═══════════════════════════════════════════════════════════════════
   eLink UZ — widgets.js  v11
   1) Statistika pill — o'ng pastki burchak  [NEW]
   2) Ob-havo  — top-bar inject              [OLD v6]
   3) Dark/Light toggle                      [OLD v6]
   4) Sticky Category Bar                    [NEW]
   ═══════════════════════════════════════════════════════════════════ */


/* ── BLOK 1: STATISTIKA PILL (o'ng pastki) ───────────────────────── */
(function () {
  'use strict';

  /* ─── Tarixiy base offsetlar ─────────────────────────────────────
     Supabase tracking boshlanishidan AVVALGI foydalanuvchilar soni.
     Real Supabase qiymati + bu offset = ko'rsatiladigan raqam.
  ────────────────────────────────────────────────────────────────── */
  var TODAY_BASE = 52;   // bugungi tarixiy sessiyalar
  var TOTAL_BASE = 3100; // jami tarixiy foydalanuvchilar

  function _inject() {
    if (document.getElementById('elinkStatsFloat')) return;
    var el = document.createElement('div');
    el.id = 'elinkStatsFloat';
    el.innerHTML =
      '<div class="esf-cell"><div class="esf-icon esf-icon-green"><svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.2" fill="currentColor"/><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4" opacity=".35"/></svg></div><div class="esf-info"><b id="esfOnline">—</b><span>onlayn</span></div></div>' +
      '<div class="esf-sep"></div>' +
      '<div class="esf-cell"><div class="esf-icon esf-icon-violet"><svg viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3" width="13" height="11.5" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 6.5h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M5 1.5v2M11 1.5v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><rect x="4" y="9" width="2" height="2" rx=".5" fill="currentColor"/><rect x="7" y="9" width="2" height="2" rx=".5" fill="currentColor"/><rect x="10" y="9" width="2" height="2" rx=".5" fill="currentColor"/></svg></div><div class="esf-info"><b id="esfToday">—</b><span>bugun</span></div></div>' +
      '<div class="esf-sep"></div>' +
      '<div class="esf-cell"><div class="esf-icon esf-icon-blue"><svg viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5.5" r="2.2" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="11.5" cy="5" r="1.8" stroke="currentColor" stroke-width="1.3"/><path d="M13.5 13c0-2-1.2-3.2-3-3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></div><div class="esf-info"><b id="esfTotal">—</b><span>jami</span></div></div>';
    document.body.appendChild(el);
  }

  function _uid() {
    if (typeof USER_ID !== 'undefined' && USER_ID) return USER_ID;
    var k='elink_uid', v=localStorage.getItem(k);
    if(!v){v='u_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);localStorage.setItem(k,v);}
    return v;
  }

  /* ─── Heartbeat: har 30s upsert_visit chaqiriladi (last_seen yangilanadi) ─── */
  function _upsert() {
    if (typeof SUPA_PROXY === 'undefined') return;
    fetch(SUPA_PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/rest/v1/rpc/upsert_visit', method: 'POST', body: { p_user_id: _uid() } })
    }).catch(function () {});
  }

  /* ─── get_site_stats: bugun + jami ─── */
  function _stats(cb) {
    if (typeof SUPA_PROXY === 'undefined') { cb(null); return; }
    fetch(SUPA_PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/rest/v1/rpc/get_site_stats', method: 'POST', body: {} })
    }).then(function (r) { return r.ok ? r.json() : null; }).then(cb).catch(function () { cb(null); });
  }

  /* ─── get_online_count: so'nggi 5 daqiqada aktiv userlar ─── */
  var _onlineFallback = null; // agar RPC yo'q bo'lsa eski qiymat
  function _fetchOnline(cb) {
    if (typeof SUPA_PROXY === 'undefined') { cb(null); return; }
    fetch(SUPA_PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/rest/v1/rpc/get_online_count', method: 'POST', body: {} })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        // RPC natijasi: raqam yoki {count: N} yoki {online: N}
        if (d === null || d === undefined) { cb(null); return; }
        var n = typeof d === 'number' ? d : (d.count !== undefined ? d.count : (d.online !== undefined ? d.online : null));
        cb(n);
      }).catch(function () { cb(null); });
  }

  function _drawOnline(n) {
    var eO = document.getElementById('esfOnline');
    if (!eO) return;
    if (n !== null && !isNaN(n)) { _onlineFallback = n; eO.textContent = String(Math.max(1, n)); }
    else if (_onlineFallback !== null) { eO.textContent = String(Math.max(1, _onlineFallback)); }
    else { eO.textContent = '—'; }
  }

  function _fmt(n) {
    if (n == null || isNaN(n)) return '—';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  function _draw(today, total) {
    var eD = document.getElementById('esfToday');
    var eT = document.getElementById('esfTotal');
    if (eD) eD.textContent = today != null ? _fmt(Math.max(0, today) + TODAY_BASE) : _fmt(TODAY_BASE);
    if (eT) eT.textContent = total != null ? _fmt(Math.max(0, total) + TOTAL_BASE) : _fmt(TOTAL_BASE);
  }

  var CK = 'elink_stats_cache', TTL = 5 * 60 * 1000;
  function _cGet() {
    try { var d = JSON.parse(localStorage.getItem(CK) || 'null'); if (d && Date.now() - d.ts < TTL) return d; } catch (e) {}
    return null;
  }
  function _cSet(d) {
    try { localStorage.setItem(CK, JSON.stringify({ today: d.today, total: d.total, ts: Date.now() })); } catch (e) {}
  }

  function _init() {
    _inject();
    _upsert(); // birinchi heartbeat + visit yozish

    // Bugun/jami: cache'dan yoki Supabase'dan
    var c = _cGet();
    if (c) _draw(c.today, c.total); else _draw(null, null);
    _stats(function (d) {
      if (d && (d.today !== undefined || d.total !== undefined)) { _cSet(d); _draw(d.today, d.total); }
    });

    // Online: darhol so'ra
    _fetchOnline(_drawOnline);

    // Har 30s: heartbeat + online yangilash
    setInterval(function () {
      _upsert();
      _fetchOnline(_drawOnline);
    }, 30 * 1000);

    // Har 5 daqiqa: bugun/jami yangilash
    setInterval(function () {
      _stats(function (d) {
        if (d && (d.today !== undefined || d.total !== undefined)) { _cSet(d); _draw(d.today, d.total); }
      });
    }, 5 * 60 * 1000);
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', _init) : _init();
})();


/* ── BLOK 2 + 3: OB-HAVO & DARK/LIGHT (OLD v6) ──────────────────── */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  function waitFor(id, cb, n) {
    n = n || 0;
    var el = $(id);
    if (el) { cb(el); return; }
    if (n > 80) return;
    setTimeout(function () { waitFor(id, cb, n + 1); }, 120);
  }

  /* ═══════════════════════════════════════════════════════════
     OB-HAVO — open-meteo.com (key yo'q, CORS yo'q)
     ═══════════════════════════════════════════════════════════ */
  var EW_CACHE = 'elink_ew6';
  var EW_CITY  = 'elink_ew6_city';
  var EW_TTL   = 20 * 60 * 1000;

  // Viloyatlar + shaharlar (alifbo tartibida)
  var REGIONS = [
    { region: "Andijon viloyati", cities: [
      { n:'Andijon',    lat:40.7831, lon:72.3442 },
      { n:'Asaka',      lat:40.6439, lon:72.2306 },
      { n:'Xonobod',    lat:40.7897, lon:72.3453 },
    ]},
    { region: "Buxoro viloyati", cities: [
      { n:'Buxoro',     lat:39.7747, lon:64.4286 },
      { n:'Kogon',      lat:39.7239, lon:64.5456 },
    ]},
    { region: "Farg'ona viloyati", cities: [
      { n:"Farg'ona",   lat:40.3842, lon:71.7843 },
      { n:"Margʻilon",  lat:40.4736, lon:71.7228 },
      { n:"Qoʻqon",    lat:40.5283, lon:70.9425 },
    ]},
    { region: "Jizzax viloyati", cities: [
      { n:'Jizzax',     lat:40.1158, lon:67.8422 },
    ]},
    { region: "Xorazm viloyati", cities: [
      { n:'Urganch',    lat:41.5500, lon:60.6333 },
      { n:'Xiva',       lat:41.3783, lon:60.3622 },
    ]},
    { region: "Namangan viloyati", cities: [
      { n:'Namangan',   lat:41.0011, lon:71.6725 },
      { n:'Chortoq',    lat:41.0800, lon:71.8333 },
    ]},
    { region: "Navoiy viloyati", cities: [
      { n:'Navoiy',     lat:40.0844, lon:65.3792 },
      { n:'Zarafshon',  lat:41.5736, lon:64.2003 },
    ]},
    { region: "Qashqadaryo viloyati", cities: [
      { n:'Qarshi',     lat:38.8600, lon:65.7900 },
      { n:'Shahrisabz', lat:39.0589, lon:66.8317 },
    ]},
    { region: "Qoraqalpog'iston", cities: [
      { n:'Nukus',      lat:42.4539, lon:59.6103 },
      { n:"Xoʻjayli",  lat:41.9667, lon:60.3833 },
    ]},
    { region: "Samarqand viloyati", cities: [
      { n:'Samarqand',  lat:39.6542, lon:66.9597 },
      { n:"Kattaqoʻrgʻon", lat:39.8983, lon:66.2572 },
    ]},
    { region: "Sirdaryo viloyati", cities: [
      { n:'Guliston',   lat:40.4897, lon:68.7839 },
    ]},
    { region: "Surxondaryo viloyati", cities: [
      { n:'Termiz',     lat:37.2242, lon:67.2783 },
      { n:'Denov',      lat:38.2739, lon:67.8886 },
    ]},
    { region: "Toshkent viloyati", cities: [
      { n:'Olmaliq',    lat:40.8483, lon:69.5997 },
      { n:'Angren',     lat:41.0167, lon:70.1500 },
      { n:'Chirchiq',   lat:41.4686, lon:69.5819 },
    ]},
    { region: "Toshkent shahri", cities: [
      { n:'Toshkent',   lat:41.2995, lon:69.2401 },
    ]},
  ];

  // Barcha shaharlar tekis ro'yxati (mavjud CITIES o'rnida)
  var CITIES = [];
  REGIONS.forEach(function(r){ r.cities.forEach(function(c){ CITIES.push(c); }); });

  var WMO = {
     0:{fa:'fa-sun',                desc:'Toza',             bg:'#fbbf24,#f97316'},
     1:{fa:'fa-sun',                desc:'Asosan toza',      bg:'#fbbf24,#f97316'},
     2:{fa:'fa-cloud-sun',          desc:"Qisman bulutli",   bg:'#60a5fa,#3b82f6'},
     3:{fa:'fa-cloud',              desc:'Bulutli',          bg:'#94a3b8,#64748b'},
    45:{fa:'fa-smog',               desc:'Tumanli',          bg:'#9ca3af,#6b7280'},
    48:{fa:'fa-smog',               desc:'Ayoz tuman',       bg:'#9ca3af,#6b7280'},
    51:{fa:'fa-cloud-drizzle',      desc:"Sekin yomg'ir",    bg:'#38bdf8,#0284c7'},
    53:{fa:'fa-cloud-drizzle',      desc:"Sekin yomg'ir",    bg:'#38bdf8,#0284c7'},
    55:{fa:'fa-cloud-drizzle',      desc:"Kuchli sekin",     bg:'#0ea5e9,#0369a1'},
    61:{fa:'fa-cloud-rain',         desc:"Yomg'ir",          bg:'#38bdf8,#0284c7'},
    63:{fa:'fa-cloud-rain',         desc:"Yomg'ir",          bg:'#38bdf8,#0284c7'},
    65:{fa:'fa-cloud-showers-heavy',desc:"Kuchli yomg'ir",   bg:'#0ea5e9,#0369a1'},
    71:{fa:'fa-snowflake',          desc:'Qor',              bg:'#bae6fd,#7dd3fc'},
    73:{fa:'fa-snowflake',          desc:'Qor',              bg:'#bae6fd,#7dd3fc'},
    75:{fa:'fa-snowflake',          desc:'Kuchli qor',       bg:'#bae6fd,#7dd3fc'},
    80:{fa:'fa-cloud-rain',         desc:'Jala',             bg:'#38bdf8,#0284c7'},
    81:{fa:'fa-cloud-showers-heavy',desc:'Kuchli jala',      bg:'#0ea5e9,#0369a1'},
    95:{fa:'fa-cloud-bolt',         desc:'Momaqaldiroq',     bg:'#818cf8,#4338ca'},
    96:{fa:'fa-cloud-bolt',         desc:"Do'l",             bg:'#818cf8,#4338ca'},
    99:{fa:'fa-cloud-bolt',         desc:"Kuchli do'l",      bg:'#6366f1,#3730a3'},
  };
  function _wmo(c){ return WMO[c] || {fa:'fa-cloud-sun', desc:'Ob-havo', bg:'#94a3b8,#64748b'}; }

  waitFor('themeBtnTop', function (themeBtn) {
    if ($('ewTopWidget')) return;
    var wrap = document.createElement('div');
    wrap.id = 'ewTopWidget';
    wrap.className = 'ew-top-wrap';
    wrap.innerHTML =
      '<button class="ew-top-btn" id="ewTopBtn" onclick="window._ewToggle()" title="Ob-havo">' +
        '<span class="ew-t-icon" id="ewTIcon"><i class="fa-solid fa-cloud-sun" id="ewTIco"></i></span>' +
        '<span class="ew-t-temp" id="ewTTemp">—°</span>' +
        '<span class="ew-t-city" id="ewTCity">...</span>' +
        '<i class="fa-solid fa-chevron-down ew-t-chev" id="ewTChev"></i>' +
      '</button>' +
      '<div class="ew-dropdown" id="ewDropdown" style="display:none">' +
        '<div class="ew-detail-row">' +
          '<span class="ew-d-pill" id="ewDDesc">—</span>' +
          '<span class="ew-d-pill"><i class="fa-solid fa-droplet"></i><span id="ewDHum">—</span></span>' +
          '<span class="ew-d-pill"><i class="fa-solid fa-wind"></i><span id="ewDWind">—</span></span>' +
          '<span class="ew-d-pill"><i class="fa-solid fa-temperature-half"></i><span id="ewDFeel">—</span></span>' +
        '</div>' +
        '<div class="ew-divider"></div>' +
        '<div class="ew-cities" id="ewCities"></div>' +
        '<button class="ew-geo-btn" onclick="window._ewGeoClick()">' +
          '<i class="fa-solid fa-location-crosshairs"></i> Avtomatik aniqlash' +
        '</button>' +
      '</div>';
    themeBtn.parentNode.insertBefore(wrap, themeBtn);
    document.addEventListener('click', function (e) {
      var w = $('ewTopWidget');
      if (w && !w.contains(e.target)) _ewClose();
    });
    _ewInit();
  });

  function _ewInit() {
    _ewBuildCities();
    var cached = _ewCacheGet();
    if (cached) { _ewRender(cached); return; }
    var saved = localStorage.getItem(EW_CITY);
    if (saved) {
      var c = CITIES.filter(function (x) { return x.n === saved; })[0] || _ewDefaultCity();
      _ewFetch({ type: 'city', city: c });
    } else {
      // Geo ruxsat so'ramasdan, default Toshkent ko'rsatamiz
      _ewFetch({ type: 'city', city: _ewDefaultCity() });
    }
  }
  function _ewCacheGet() {
    try {
      var d = JSON.parse(localStorage.getItem(EW_CACHE) || 'null');
      if (d && Date.now() - d.ts < EW_TTL) return d;
    } catch (e) {}
    return null;
  }
  function _ewBuildCities() {
    var el = $('ewCities'); if (!el) return;
    var active = localStorage.getItem(EW_CITY);
    var html = '';
    REGIONS.forEach(function(r) {
      html += '<div class="ew-region-label">' + r.region + '</div>';
      html += '<div class="ew-region-row">';
      r.cities.forEach(function(c, ri) {
        var idx = CITIES.indexOf(c);
        html += '<button class="ew-chip' + (c.n === active ? ' ew-chip-on' : '') +
          '" data-cidx="' + idx + '" onclick="window._ewPickIdx(this.dataset.cidx)">' + c.n + '</button>';
      });
      html += '</div>';
    });
    el.innerHTML = html;
  }
  // Default shahar: Toshkent (yoki CITIES[0])
  function _ewDefaultCity() {
    return CITIES.filter(function(x){ return x.n === 'Toshkent'; })[0] || CITIES[0];
  }

  window._ewPickIdx = function (idx) {
    var c = CITIES[parseInt(idx, 10)] || _ewDefaultCity();
    localStorage.setItem(EW_CITY, c.n); localStorage.removeItem(EW_CACHE);
    _ewClose(); _ewBuildCities();
    _ewFetch({ type: 'city', city: c });
  };
  window._ewPick = function (name) {
    var c = CITIES.filter(function (x) { return x.n === name; })[0] || _ewDefaultCity();
    localStorage.setItem(EW_CITY, c.n); localStorage.removeItem(EW_CACHE);
    _ewClose(); _ewBuildCities();
    _ewFetch({ type: 'city', city: c });
  };
  window._ewToggle = function () {
    var d = $('ewDropdown'), ch = $('ewTChev'); if (!d) return;
    var open = d.style.display !== 'none';
    d.style.display = open ? 'none' : 'block';
    if (ch) ch.style.transform = open ? '' : 'rotate(180deg)';
  };
  function _ewClose() {
    var d = $('ewDropdown'), ch = $('ewTChev');
    if (d) d.style.display = 'none';
    if (ch) ch.style.transform = '';
  }
  window._ewGeoClick = function () {
    _ewClose(); localStorage.removeItem(EW_CACHE); localStorage.removeItem(EW_CITY);
    var el = $('ewTCity'); if (el) el.textContent = '📍 Aniqlanmoqda...';
    _ewGeoFull();
  };
  function _ewGeoSilent() {
    if (!navigator.geolocation) { _ewFetch({ type: 'city', city: _ewDefaultCity() }); return; }
    navigator.geolocation.getCurrentPosition(
      function (p) { _ewFetch({ type: 'coords', lat: p.coords.latitude, lon: p.coords.longitude }); },
      function ()  { _ewFetch({ type: 'city', city: _ewDefaultCity() }); }, { timeout: 5000 }
    );
  }
  function _ewGeoFull() {
    if (!navigator.geolocation) { _ewFetch({ type: 'city', city: _ewDefaultCity() }); return; }
    navigator.geolocation.getCurrentPosition(
      function (p) { _ewFetch({ type: 'coords', lat: p.coords.latitude, lon: p.coords.longitude }); },
      function ()  { _ewFetch({ type: 'city', city: _ewDefaultCity() }); }, { timeout: 8000 }
    );
  }
  function _ewFetch(opts) {
    if (opts.type === 'coords') {
      var lat = opts.lat, lon = opts.lon;
      // Nominatim — to'g'ri reverse geocoding (lat/lon → shahar nomi)
      fetch('https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lon +
            '&format=json&accept-language=uz', { headers: { 'Accept-Language': 'uz,ru;q=0.8,en;q=0.5' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (g) {
          var name = 'Joylashuv';
          if (g && g.address) {
            name = g.address.city || g.address.town || g.address.village ||
                   g.address.county || g.address.state || 'Joylashuv';
          }
          _ewFetchWeather(lat, lon, name);
        })
        .catch(function () { _ewFetchWeather(lat, lon, 'Joylashuv'); });
    } else {
      _ewFetchWeather(opts.city.lat, opts.city.lon, opts.city.n);
    }
  }
  function _ewFetchWeather(lat, lon, cityName) {
    // Yuklash holati
    var elC = $('ewTCity'); if (elC) elC.textContent = cityName;
    var elT = $('ewTTemp'); if (elT && elT.textContent === '—°') elT.textContent = '...';

    fetch('https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code' +
      '&wind_speed_unit=ms&timezone=auto')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        var cur = j.current, w = _wmo(cur.weather_code);
        var data = {
          temp:  Math.round(cur.temperature_2m),
          feels: Math.round(cur.apparent_temperature),
          hum:   Math.round(cur.relative_humidity_2m),
          wind:  Math.round(cur.wind_speed_10m * 10) / 10,
          fa:    w.fa,
          desc:  w.desc,
          bg:    w.bg,
          city:  cityName,
          ts:    Date.now()
        };
        try { localStorage.setItem(EW_CACHE, JSON.stringify(data)); } catch (e) {}
        _ewRender(data);
      })
      .catch(function () {
        var el = $('ewTCity'); if (el) el.textContent = cityName || '—';
        var tt = $('ewTTemp'); if (tt) tt.textContent = '—°';
      });
  }
  function _ewRender(d) {
    var iw=$('ewTIcon');  if(iw)  iw.style.background='linear-gradient(135deg,'+d.bg+')';
    var ic=$('ewTIco');   if(ic)  ic.className='fa-solid '+d.fa;
    var t=$('ewTTemp');   if(t)   t.textContent=d.temp+'°';
    var c=$('ewTCity');   if(c)   c.textContent=d.city;
    var dd=$('ewDDesc');  if(dd)  dd.textContent=d.desc;
    var dh=$('ewDHum');   if(dh)  dh.textContent=''+d.hum+'%';
    var dw=$('ewDWind');  if(dw)  dw.textContent=''+d.wind+' m/s';
    var df=$('ewDFeel');  if(df)  df.textContent=''+d.feels+'° his';
  }
  setInterval(function () {
    localStorage.removeItem(EW_CACHE);
    var saved = localStorage.getItem(EW_CITY);
    if (saved) {
      var c = CITIES.filter(function (x) { return x.n === saved; })[0] || _ewDefaultCity();
      _ewFetch({ type: 'city', city: c });
    } else { _ewFetch({ type: 'city', city: _ewDefaultCity() }); }
  }, EW_TTL);

  /* ═══════════════════════════════════════════════════════════
     DARK/LIGHT TOGGLE — tez, animatsiyasiz, sodda
     ═══════════════════════════════════════════════════════════ */
  waitFor('themeBtnTop', function (btn) {
    btn.className = 'ew-theme-btn';
    btn.title = 'Tungi / Kunduzgi rejim';
    btn.innerHTML =
      '<i class="fa-solid fa-moon" id="ewThemeIco"></i>' +
      '<span id="ewThemeLbl">Tun</span>';

    function _sync() {
      var dark = document.documentElement.classList.contains('dark');
      var ico = $('ewThemeIco');
      var lbl = $('ewThemeLbl');
      if (ico) ico.className = 'fa-solid ' + (dark ? 'fa-sun' : 'fa-moon');
      if (lbl) lbl.textContent = dark ? 'Kun' : 'Tun';
      btn.classList.toggle('ew-theme-dark', dark);
    }
    _sync();
    btn.addEventListener('click', function () { setTimeout(_sync, 10); });
  });

})();


/* ── BLOK 4: STICKY CATEGORY BAR ─────────────────────────────────── */
(function () {
  'use strict';

  var bar, nameEl, countEl, stripeEl, progressEl;
  var observer = null;
  var sections = [];
  var currentIdx = -1;

  var GR_MAP = {
    'from-violet-400':  'linear-gradient(to bottom,#a78bfa,#7c3aed)',
    'from-emerald-400': 'linear-gradient(to bottom,#34d399,#059669)',
    'from-sky-400':     'linear-gradient(to bottom,#38bdf8,#0284c7)',
    'from-blue-400':    'linear-gradient(to bottom,#60a5fa,#2563eb)',
    'from-orange-400':  'linear-gradient(to bottom,#fb923c,#ea580c)',
    'from-rose-400':    'linear-gradient(to bottom,#fb7185,#e11d48)',
    'from-amber-400':   'linear-gradient(to bottom,#fbbf24,#d97706)',
    'from-teal-400':    'linear-gradient(to bottom,#2dd4bf,#0d9488)',
    'from-indigo-400':  'linear-gradient(to bottom,#818cf8,#4338ca)',
    'from-pink-400':    'linear-gradient(to bottom,#f472b6,#db2777)',
    'from-cyan-400':    'linear-gradient(to bottom,#22d3ee,#0891b2)',
    'from-green-400':   'linear-gradient(to bottom,#4ade80,#16a34a)',
    'from-lime-400':    'linear-gradient(to bottom,#a3e635,#65a30d)',
    'from-fuchsia-400': 'linear-gradient(to bottom,#e879f9,#a21caf)',
    'from-purple-400':  'linear-gradient(to bottom,#c084fc,#7e22ce)',
    'from-red-400':     'linear-gradient(to bottom,#f87171,#dc2626)',
    'from-yellow-400':  'linear-gradient(to bottom,#facc15,#ca8a04)',
  };

  function _grStyle(el) {
    if (!el) return 'linear-gradient(to bottom,#8b5cf6,#ec4899)';
    var cls = el.className || '', parts = cls.split(' ');
    for (var i = 0; i < parts.length; i++) { var g = GR_MAP[parts[i]]; if (g) return g; }
    return 'linear-gradient(to bottom,#8b5cf6,#ec4899)';
  }

  function _inject() {
    if (document.getElementById('catStickyBar')) return;
    bar = document.createElement('div');
    bar.id = 'catStickyBar';
    bar.innerHTML =
      '<div class="csb-inner">' +
        '<div class="csb-stripe" id="csbStripe"></div>' +
        '<span class="csb-name" id="csbName"></span>' +
        '<span class="csb-count" id="csbCount"></span>' +
      '</div>' +
      '<div class="csb-progress" id="csbProgress"></div>';
    var cont = document.getElementById('appsContainer');
    if (cont && cont.parentNode) cont.parentNode.insertBefore(bar, cont);
    else document.body.appendChild(bar);
    nameEl     = document.getElementById('csbName');
    countEl    = document.getElementById('csbCount');
    stripeEl   = document.getElementById('csbStripe');
    progressEl = document.getElementById('csbProgress');
  }

  function _show(name, count, grStyle) {
    if (!bar) return;
    if (nameEl)   nameEl.textContent  = name  || '';
    if (countEl)  countEl.textContent = count ? count + ' ta' : '';
    if (stripeEl) stripeEl.style.background = grStyle;
    bar.classList.add('csb--visible');
  }
  function _hide() { if (bar) bar.classList.remove('csb--visible'); }

  function _updateProgress() {
    if (!progressEl || currentIdx < 0 || currentIdx >= sections.length) return;
    var sec = sections[currentIdx].el;
    var total = sec.offsetHeight;
    var scrolled = -sec.getBoundingClientRect().top;
    var pct = total > 0 ? Math.max(0, Math.min(100, (scrolled / total) * 100)) : 0;
    progressEl.style.width = pct + '%';
  }

  function _observeSections() {
    if (observer) { observer.disconnect(); observer = null; }
    sections = []; currentIdx = -1;
    var cont = document.getElementById('appsContainer'); if (!cont) return;
    var h3s = cont.querySelectorAll('h3');
    if (!h3s.length) { _hide(); return; }
    h3s.forEach(function (h3) {
      var wrap = h3.parentElement;
      sections.push({
        el:     wrap ? (wrap.closest('.animate-fade-up') || h3) : h3,
        h3:     h3,
        stripe: wrap ? wrap.querySelector('.rounded-full') : null,
        name:   h3.textContent.trim(),
        count:  (wrap && wrap.querySelector('span.text-xs')) ? wrap.querySelector('span.text-xs').textContent.replace(' ta','').trim() : ''
      });
    });
    if (!sections.length) { _hide(); return; }
    var ms = document.getElementById('mainScroll');
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var idx = -1;
        for (var i = 0; i < sections.length; i++) { if (sections[i].h3 === entry.target) { idx = i; break; } }
        if (idx < 0) return;
        if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
          var lastAbove = -1;
          for (var j = 0; j < sections.length; j++) {
            if (sections[j].h3.getBoundingClientRect().top < 50) lastAbove = j;
          }
          if (lastAbove >= 0 && lastAbove !== currentIdx) {
            currentIdx = lastAbove;
            var s = sections[lastAbove];
            _show(s.name, s.count, _grStyle(s.stripe));
          }
        } else if (entry.isIntersecting && idx === 0) {
          if (sections[0].h3.getBoundingClientRect().top > 0) { _hide(); currentIdx = -1; }
        }
      });
    }, { root: ms, threshold: 0, rootMargin: '-50px 0px 0px 0px' });
    sections.forEach(function (s) { observer.observe(s.h3); });
  }

  function _onScroll() {
    _updateProgress();
    var ms = document.getElementById('mainScroll');
    if (ms && ms.scrollTop < 60) { _hide(); currentIdx = -1; }
  }

  function _init() {
    _inject();
    var ms = document.getElementById('mainScroll');
    if (ms) ms.addEventListener('scroll', _onScroll, { passive: true });
    var cont = document.getElementById('appsContainer'); if (!cont) return;
    var mo = new MutationObserver(function () { clearTimeout(mo._t); mo._t = setTimeout(_observeSections, 140); });
    mo.observe(cont, { childList: true, subtree: false });
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', _init) : _init();
})();