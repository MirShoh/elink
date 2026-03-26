/* ── BLOK 1: STATISTIKA PILL (o'ng pastki) ───────────────────────── */
(function () {
  'use strict';

  // Cache kalitlari va muddatlari
  var CK_STATS  = 'elink_stats_v2';
  var CK_ONLINE = 'elink_online_v2';
  var TTL_STATS  = 3 * 60 * 1000;
  var TTL_ONLINE = 2 * 60 * 1000;      // 2 daqiqa — sahifa ochilganda darhol ko'rsatish uchun

  // Interval sozlamalari
  var ONLINE_INTERVAL = 20 * 1000;      // online soni: har 20 soniyada
  var STATS_INTERVAL  = 3 * 60 * 1000; // bugun/jami: har 3 daqiqada

  // Oxirgi muvaffaqiyatli qiymatlar
  var _lastOnline = null;
  var _lastStats  = null;

  // AbortController-lar — alohida
  var _abortOnline = null;
  var _abortStats  = null;

  // BroadcastChannel: bir tab poll qiladi, qolganlar eshitadi
  var _bc = (typeof BroadcastChannel !== 'undefined')
    ? new BroadcastChannel('elink_stats')
    : null;

  // Timer-lar va fail hisoblagichlar
  var _onlineTimer = null;
  var _statsTimer  = null;
  var _onlineFail  = 0;
  var _statsFail   = 0;

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
    var k = 'elink_uid', v = localStorage.getItem(k);
    if (!v) { v = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); localStorage.setItem(k, v); }
    return v;
  }

  // Yangi Supabase bazasidan oldingi tarixiy foydalanuvchilar soni
  var TOTAL_BASE = 3100;

  function _fmt(n) {
    if (n == null || isNaN(n)) return '—';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  function _drawAll(online, today, total) {
    var eO = document.getElementById('esfOnline');
    var eD = document.getElementById('esfToday');
    var eT = document.getElementById('esfTotal');
    if (eO && online != null) eO.textContent = String(Math.max(1, online));
    if (eD) eD.textContent = today != null ? _fmt(Math.max(0, today)) : '—';
    // Jami: bazadagi son + tarixiy offset
    if (eT) eT.textContent = total != null ? _fmt(Math.max(0, total) + TOTAL_BASE) : '—';
  }

  // localStorage cache yozish/o'qish
  function _cacheGet(key, ttl) {
    try {
      var d = JSON.parse(localStorage.getItem(key) || 'null');
      if (d && (Date.now() - d.ts) < ttl) return d;
    } catch (e) {}
    return null;
  }
  function _cacheSet(key, data) {
    try { localStorage.setItem(key, JSON.stringify(Object.assign({}, data, { ts: Date.now() }))); } catch (e) {}
  }

  function _req(body, signal) {
    return fetch(SUPA_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: signal
    });
  }

  function _parseOnline(od) {
    if (od == null) return null;
    if (Array.isArray(od)) od = od[0];  // Supabase massiv qaytarsa
    if (od == null) return null;
    if (typeof od === 'number') return od;
    if (od.count != null) return Number(od.count);
    if (od.online != null) return Number(od.online);
    return null;
  }

  // ── ONLINE POLL: har 20 soniyada (upsert_visit + get_online_count) ──
  function _pollOnline() {
    clearTimeout(_onlineTimer);
    if (document.visibilityState === 'hidden') return;
    if (typeof SUPA_PROXY === 'undefined') return;

    if (_abortOnline) { _abortOnline.abort(); }
    _abortOnline = new AbortController();
    var sig = _abortOnline.signal;

    Promise.allSettled([
      _req({ path: '/rest/v1/rpc/upsert_visit',     method: 'POST', body: { p_user_id: _uid() } }, sig),
      _req({ path: '/rest/v1/rpc/get_online_count', method: 'POST', body: {} }, sig),
    ]).then(function(results) {
      var onlineRes = results[1];
      if (onlineRes.status === 'fulfilled' && onlineRes.value.ok) {
        return onlineRes.value.json().then(function(od) {
          var n = _parseOnline(od);
          if (n != null) {
            _lastOnline = n;
            _cacheSet(CK_ONLINE, { online: n });
            _drawAll(_lastOnline, _lastStats ? _lastStats.today : null, _lastStats ? _lastStats.total : null);
            if (_bc) { try { _bc.postMessage({ online: _lastOnline }); } catch(e) {} }
          }
          _onlineFail = 0;
        }).catch(function() {});
      }
      _onlineFail++;
    }).catch(function(e) {
      if (e && e.name === 'AbortError') return;
      _onlineFail++;
    }).then(function() {
      var delay = _onlineFail === 0
        ? ONLINE_INTERVAL
        : Math.min(ONLINE_INTERVAL * Math.pow(2, _onlineFail), 5 * 60 * 1000);
      _onlineTimer = setTimeout(_pollOnline, delay);
    });
  }

  // ── STATS POLL: har 3 daqiqada (get_site_stats) ──
  function _pollStats() {
    clearTimeout(_statsTimer);
    if (document.visibilityState === 'hidden') return;
    if (typeof SUPA_PROXY === 'undefined') return;

    if (_abortStats) { _abortStats.abort(); }
    _abortStats = new AbortController();

    _req({ path: '/rest/v1/rpc/get_site_stats', method: 'POST', body: {} }, _abortStats.signal)
      .then(function(res) {
        if (!res.ok) { _statsFail++; return; }
        return res.json().then(function(sd) {
          if (sd) {
            _lastStats = { today: sd.today, total: sd.total };
            _cacheSet(CK_STATS, _lastStats);
            _drawAll(_lastOnline, _lastStats.today, _lastStats.total);
            if (_bc) { try { _bc.postMessage({ today: _lastStats.today, total: _lastStats.total }); } catch(e) {} }
          }
          _statsFail = 0;
        });
      })
      .catch(function(e) {
        if (e && e.name === 'AbortError') return;
        _statsFail++;
      })
      .then(function() {
        var delay = _statsFail === 0
          ? STATS_INTERVAL
          : Math.min(STATS_INTERVAL * Math.pow(2, _statsFail), 15 * 60 * 1000);
        _statsTimer = setTimeout(_pollStats, delay);
      });
  }

  function _init() {
    _inject();

    // 1) Darhol — localStorage cache dan ko'rsatish (network kutilmaydi)
    var sc = _cacheGet(CK_STATS, TTL_STATS);
    var oc = _cacheGet(CK_ONLINE, TTL_ONLINE);
    if (sc) _lastStats = sc;
    if (oc) _lastOnline = oc.online;
    _drawAll(_lastOnline, _lastStats ? _lastStats.today : null, _lastStats ? _lastStats.total : null);

    // 2) Boshqa tablardan kelgan yangilanishlarni ting'la
    if (_bc) {
      _bc.onmessage = function(e) {
        var d = e.data;
        if (!d) return;
        if (d.online != null) _lastOnline = d.online;
        if (d.today  != null || d.total != null) _lastStats = { today: d.today, total: d.total };
        _drawAll(_lastOnline, _lastStats ? _lastStats.today : null, _lastStats ? _lastStats.total : null);
      };
    }

    // 3) Network so'rovlari — alohida sikllarda
    var _go = function() {
      _pollOnline(); // darhol, keyin har 20 soniyada
      _pollStats();  // darhol, keyin har 3 daqiqada
    };
    if (typeof requestIdleCallback !== 'undefined') requestIdleCallback(_go, { timeout: 2000 });
    else setTimeout(_go, 300);

    // 4) Tab ko'rinadigan bo'lganda pollni qayta boshlash
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') {
        _onlineFail = 0;
        _statsFail  = 0;
        _pollOnline();
        _pollStats();
      } else {
        clearTimeout(_onlineTimer);
        clearTimeout(_statsTimer);
        if (_abortOnline) { _abortOnline.abort(); _abortOnline = null; }
        if (_abortStats)  { _abortStats.abort();  _abortStats  = null; }
      }
    });
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', _init) : _init();
})()


/* ── BLOK 2: DARK/LIGHT TOGGLE ───────────────────────────────────── */
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
     DARK/LIGHT TOGGLE — tez, animatsiyasiz, sodda
     ═══════════════════════════════════════════════════════════ */
  waitFor('themeBtnTop', function (btn) {
    btn.classList.remove('hidden');
    // Agar render.js setupTheme() allaqachon ishlagan bo'lsa — ikki marta listener kerak emas
    // Faqat boshlang'ich ikonani sinxronlaymiz
    function _syncTop() {
      var dark = document.documentElement.classList.contains('dark');
      var ico = document.getElementById('themeIcoTop');
      if (ico) ico.className = 'fa-solid ' + (dark ? 'fa-sun' : 'fa-moon') + ' text-sm';
      btn.classList.toggle('ew-theme-dark', dark);
    }
    _syncTop();
    // setupTheme() allaqachon click ni boshqaradi — bu faqat vizual sinxron
    var ob = new MutationObserver(_syncTop);
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
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