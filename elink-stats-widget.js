/**
 * eLink Stats Widget — standalone embeddable
 * Ishlating:
 *   <script src="elink-stats-widget.js"
 *           data-proxy="https://yoursite.com/api/supabase"
 *           data-base="3100"
 *           data-labels='{"online":"onlayn","today":"bugun","total":"jami"}'
 *           data-position="bottom-right"
 *           data-theme="auto">
 *   </script>
 *
 * data-proxy    — sizning proxy endpoint (majburiy)
 * data-base     — jami soniga qo'shiladigan tarixiy offset (ixtiyoriy, default: 0)
 * data-labels   — yozuvlarni o'zgartirish (ixtiyoriy)
 * data-position — "bottom-right" | "bottom-left" (default: bottom-right)
 * data-theme    — "auto" | "light" | "dark" (default: auto)
 */
(function () {
  'use strict';

  /* ── Konfiguratsiya ── */
  var _script = document.currentScript || (function () {
    var s = document.querySelectorAll('script');
    return s[s.length - 1];
  })();

  var PROXY      = (_script && _script.getAttribute('data-proxy')) || '';
  var BASE       = parseInt((_script && _script.getAttribute('data-base')) || '0', 10) || 0;
  var POSITION   = (_script && _script.getAttribute('data-position')) || 'bottom-right';
  var THEME_MODE = (_script && _script.getAttribute('data-theme')) || 'auto';

  var _rawLabels = _script && _script.getAttribute('data-labels');
  var LABELS = { online: 'onlayn', today: 'bugun', total: 'jami' };
  if (_rawLabels) { try { Object.assign(LABELS, JSON.parse(_rawLabels)); } catch(e) {} }

  if (!PROXY) {
    console.warn('[eLink Widget] data-proxy ko\'rsatilmagan!');
    return;
  }

  /* ── CSS inject ── */
  var WIDGET_ID = 'elinkStatsWidget';
  var CSS = [
    '#' + WIDGET_ID + '{',
      'position:fixed;z-index:2147483647;',
      'display:flex;align-items:center;gap:2px;',
      'background:rgba(255,255,255,.96);',
      'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
      'border:1px solid rgba(0,0,0,.07);border-radius:16px;padding:6px 8px;',
      'box-shadow:0 4px 24px rgba(0,0,0,.08),0 1px 4px rgba(0,0,0,.04);',
      'font-family:"Plus Jakarta Sans",system-ui,sans-serif;',
      'transition:opacity .2s;',
    '}',
    '#' + WIDGET_ID + '.esw-pos-br{bottom:24px;right:72px;}',
    '#' + WIDGET_ID + '.esw-pos-bl{bottom:24px;left:16px;}',
    '#' + WIDGET_ID + '.esw-dark{background:rgba(10,14,30,.94);border-color:rgba(255,255,255,.08);',
      'box-shadow:0 4px 24px rgba(0,0,0,.45),0 1px 4px rgba(0,0,0,.2);}',
    '.esw-cell{display:flex;align-items:center;gap:7px;padding:4px 10px;border-radius:10px;',
      'transition:background .15s;cursor:default;}',
    '.esw-cell:hover{background:rgba(139,92,246,.06);}',
    '#' + WIDGET_ID + '.esw-dark .esw-cell:hover{background:rgba(139,92,246,.1);}',
    '.esw-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;',
      'justify-content:center;flex-shrink:0;}',
    '.esw-icon svg{width:14px;height:14px;}',
    '.esw-green{background:rgba(34,197,94,.12);color:#16a34a;}',
    '.esw-violet{background:rgba(139,92,246,.12);color:#7c3aed;}',
    '.esw-blue{background:rgba(59,130,246,.12);color:#2563eb;}',
    '#' + WIDGET_ID + '.esw-dark .esw-green{background:rgba(34,197,94,.15);color:#4ade80;}',
    '#' + WIDGET_ID + '.esw-dark .esw-violet{background:rgba(139,92,246,.18);color:#a78bfa;}',
    '#' + WIDGET_ID + '.esw-dark .esw-blue{background:rgba(59,130,246,.18);color:#60a5fa;}',
    '.esw-info{display:flex;flex-direction:column;line-height:1.2;}',
    '.esw-info b{font-size:14px;font-weight:900;color:#0f172a;letter-spacing:-.3px;}',
    '#' + WIDGET_ID + '.esw-dark .esw-info b{color:#f1f5f9;}',
    '.esw-info span{font-size:9.5px;font-weight:600;color:#94a3b8;}',
    '#' + WIDGET_ID + '.esw-dark .esw-info span{color:#475569;}',
    '.esw-sep{width:1px;height:24px;background:rgba(0,0,0,.06);flex-shrink:0;margin:0 2px;}',
    '#' + WIDGET_ID + '.esw-dark .esw-sep{background:rgba(255,255,255,.07);}',
    '@keyframes eswDot{0%,100%{opacity:1}50%{opacity:.5}}',
    '.esw-dot-anim{animation:eswDot 2s ease-in-out infinite;}',
    '@media(max-width:768px){',
      '#' + WIDGET_ID + '{bottom:72px!important;right:12px!important;left:auto!important;padding:5px 6px;gap:0;}',
      '.esw-cell{padding:3px 8px;}',
      '.esw-icon{width:24px;height:24px;}',
      '.esw-info b{font-size:12px;}',
    '}',
  ].join('');

  function _injectCSS() {
    if (document.getElementById('esw-style')) return;
    var s = document.createElement('style');
    s.id = 'esw-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ── DOM inject ── */
  function _injectHTML() {
    if (document.getElementById(WIDGET_ID)) return;

    var posClass = POSITION === 'bottom-left' ? 'esw-pos-bl' : 'esw-pos-br';

    var el = document.createElement('div');
    el.id = WIDGET_ID;
    el.className = posClass;
    el.innerHTML =
      '<div class="esw-cell">' +
        '<div class="esw-icon esw-green">' +
          '<svg viewBox="0 0 16 16" fill="none">' +
            '<circle class="esw-dot-anim" cx="8" cy="8" r="3.2" fill="currentColor"/>' +
            '<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4" opacity=".35"/>' +
          '</svg>' +
        '</div>' +
        '<div class="esw-info"><b id="eswOnline">—</b><span>' + LABELS.online + '</span></div>' +
      '</div>' +
      '<div class="esw-sep"></div>' +
      '<div class="esw-cell">' +
        '<div class="esw-icon esw-violet">' +
          '<svg viewBox="0 0 16 16" fill="none">' +
            '<rect x="1.5" y="3" width="13" height="11.5" rx="2" stroke="currentColor" stroke-width="1.4"/>' +
            '<path d="M1.5 6.5h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
            '<path d="M5 1.5v2M11 1.5v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
            '<rect x="4" y="9" width="2" height="2" rx=".5" fill="currentColor"/>' +
            '<rect x="7" y="9" width="2" height="2" rx=".5" fill="currentColor"/>' +
            '<rect x="10" y="9" width="2" height="2" rx=".5" fill="currentColor"/>' +
          '</svg>' +
        '</div>' +
        '<div class="esw-info"><b id="eswToday">—</b><span>' + LABELS.today + '</span></div>' +
      '</div>' +
      '<div class="esw-sep"></div>' +
      '<div class="esw-cell">' +
        '<div class="esw-icon esw-blue">' +
          '<svg viewBox="0 0 16 16" fill="none">' +
            '<circle cx="6" cy="5.5" r="2.2" stroke="currentColor" stroke-width="1.4"/>' +
            '<path d="M1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
            '<circle cx="11.5" cy="5" r="1.8" stroke="currentColor" stroke-width="1.3"/>' +
            '<path d="M13.5 13c0-2-1.2-3.2-3-3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
          '</svg>' +
        '</div>' +
        '<div class="esw-info"><b id="eswTotal">—</b><span>' + LABELS.total + '</span></div>' +
      '</div>';

    document.body.appendChild(el);
    _applyTheme();
  }

  /* ── Dark mode ── */
  var _mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');

  function _isDark() {
    if (THEME_MODE === 'dark') return true;
    if (THEME_MODE === 'light') return false;
    // auto: html/body da .dark klassi bormi yoki system preference
    if (document.documentElement.classList.contains('dark')) return true;
    if (document.body && document.body.classList.contains('dark')) return true;
    return _mq && _mq.matches;
  }

  function _applyTheme() {
    var el = document.getElementById(WIDGET_ID);
    if (!el) return;
    if (_isDark()) el.classList.add('esw-dark');
    else el.classList.remove('esw-dark');
  }

  if (_mq) _mq.addEventListener('change', _applyTheme);

  /* ── Yordamchi ── */
  function _fmt(n) {
    if (n == null || isNaN(n)) return '—';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  function _uid() {
    var k = 'esw_uid', v = localStorage.getItem(k);
    if (!v) {
      v = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(k, v);
    }
    return v;
  }

  function _draw(online, today, total) {
    var eO = document.getElementById('eswOnline');
    var eD = document.getElementById('eswToday');
    var eT = document.getElementById('eswTotal');
    if (eO && online != null) eO.textContent = String(Math.max(1, online));
    if (eD) eD.textContent = today != null ? _fmt(Math.max(0, today)) : '—';
    if (eT) eT.textContent = total != null ? _fmt(Math.max(0, total) + BASE) : '—';
  }

  /* ── Cache ── */
  var CK_S = 'esw_stats_v1', CK_O = 'esw_online_v1';
  var TTL_S = 3 * 60 * 1000, TTL_O = 2 * 60 * 1000;

  function _cGet(k, ttl) {
    try {
      var d = JSON.parse(localStorage.getItem(k) || 'null');
      if (d && (Date.now() - d.ts) < ttl) return d;
    } catch(e) {}
    return null;
  }
  function _cSet(k, d) {
    try { localStorage.setItem(k, JSON.stringify(Object.assign({}, d, { ts: Date.now() }))); } catch(e) {}
  }

  /* ── API ── */
  function _req(body, signal) {
    return fetch(PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: signal
    });
  }

  /* ── Polling ── */
  var _lastOnline = null, _lastStats = null;
  var _abortO = null, _abortS = null;
  var _timerO = null, _timerS = null;
  var _failO = 0, _failS = 0;

  var INTERVAL_O = 20 * 1000;
  var INTERVAL_S = 3 * 60 * 1000;

  var _bc = (typeof BroadcastChannel !== 'undefined')
    ? new BroadcastChannel('esw_stats') : null;

  function _pollOnline() {
    clearTimeout(_timerO);
    if (document.visibilityState === 'hidden') return;
    if (_abortO) _abortO.abort();
    _abortO = new AbortController();

    Promise.allSettled([
      _req({ path: '/rest/v1/rpc/upsert_visit',     method: 'POST', body: { p_user_id: _uid() } }, _abortO.signal),
      _req({ path: '/rest/v1/rpc/get_online_count', method: 'POST', body: {} }, _abortO.signal),
    ]).then(function(res) {
      var r = res[1];
      if (r.status === 'fulfilled' && r.value.ok) {
        return r.value.json().then(function(d) {
          var n = Array.isArray(d) ? d[0] : d;
          var cnt = n == null ? null : (typeof n === 'number' ? n : (n.count != null ? +n.count : (n.online != null ? +n.online : null)));
          if (cnt != null) {
            _lastOnline = cnt;
            _cSet(CK_O, { online: cnt });
            _draw(_lastOnline, _lastStats ? _lastStats.today : null, _lastStats ? _lastStats.total : null);
            if (_bc) { try { _bc.postMessage({ online: cnt }); } catch(e) {} }
          }
          _failO = 0;
        });
      }
      _failO++;
    }).catch(function(e) {
      if (e && e.name === 'AbortError') return;
      _failO++;
    }).then(function() {
      _timerO = setTimeout(_pollOnline, _failO === 0 ? INTERVAL_O : Math.min(INTERVAL_O * Math.pow(2, _failO), 5 * 60 * 1000));
    });
  }

  function _pollStats() {
    clearTimeout(_timerS);
    if (document.visibilityState === 'hidden') return;
    if (_abortS) _abortS.abort();
    _abortS = new AbortController();

    _req({ path: '/rest/v1/rpc/get_site_stats', method: 'POST', body: {} }, _abortS.signal)
      .then(function(res) {
        if (!res.ok) { _failS++; return; }
        return res.json().then(function(d) {
          if (d) {
            _lastStats = { today: d.today, total: d.total };
            _cSet(CK_S, _lastStats);
            _draw(_lastOnline, d.today, d.total);
            if (_bc) { try { _bc.postMessage({ today: d.today, total: d.total }); } catch(e) {} }
          }
          _failS = 0;
        });
      })
      .catch(function(e) {
        if (e && e.name === 'AbortError') return;
        _failS++;
      })
      .then(function() {
        _timerS = setTimeout(_pollStats, _failS === 0 ? INTERVAL_S : Math.min(INTERVAL_S * Math.pow(2, _failS), 15 * 60 * 1000));
      });
  }

  /* ── Init ── */
  function _init() {
    _injectCSS();
    _injectHTML();

    // Cache dan darhol ko'rsatish
    var sc = _cGet(CK_S, TTL_S);
    var oc = _cGet(CK_O, TTL_O);
    if (sc) _lastStats = sc;
    if (oc) _lastOnline = oc.online;
    _draw(_lastOnline, _lastStats ? _lastStats.today : null, _lastStats ? _lastStats.total : null);

    // BroadcastChannel — boshqa tablardan tinglash
    if (_bc) {
      _bc.onmessage = function(e) {
        var d = e.data;
        if (!d) return;
        if (d.online != null) _lastOnline = d.online;
        if (d.today != null || d.total != null) _lastStats = { today: d.today, total: d.total };
        _draw(_lastOnline, _lastStats ? _lastStats.today : null, _lastStats ? _lastStats.total : null);
      };
    }

    // Network polling
    var _go = function() { _pollOnline(); _pollStats(); };
    if (typeof requestIdleCallback !== 'undefined') requestIdleCallback(_go, { timeout: 2000 });
    else setTimeout(_go, 300);

    // Visibility change
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') {
        _failO = 0; _failS = 0;
        _pollOnline(); _pollStats();
      } else {
        clearTimeout(_timerO); clearTimeout(_timerS);
        if (_abortO) { _abortO.abort(); _abortO = null; }
        if (_abortS) { _abortS.abort(); _abortS = null; }
      }
    });

    // Dark mode o'zgarishini kuzatish (html.dark klassi)
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(_applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', _init)
    : _init();

})();
