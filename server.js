/**
 * eLink VDS Proxy Server
 * Netlify Functions o'rnini bosadi:
 *   /.netlify/functions/supabase  → Supabase REST API proxy
 *   /.netlify/functions/telegram  → Telegram bot proxy
 *
 * O'rnatish:
 *   npm install
 *   node server.js   yoki   pm2 start server.js --name elink-proxy
 */


const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

// ─── SOZLAMALAR — shu yerga to'ldiring ─────────────────────────
const CONFIG = {
  PORT: process.env.PORT || 3000,

  // Supabase → Dashboard > Settings > API
  SUPABASE_URL:  process.env.SUPABASE_URL  || 'https://XXXX.supabase.co',
  SUPABASE_KEY:  process.env.SUPABASE_KEY  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.XXXX',

  // Telegram → @BotFather bot tokeni + kanal/guruh chat ID
  TG_BOT_TOKEN:  process.env.TG_BOT_TOKEN  || '1234567890:AAXXXX',
  TG_CHAT_ID:    process.env.TG_CHAT_ID    || '-100XXXXXXXX',

  // Statik fayllar katalogi (index.html, core.js, data.js ...)
  STATIC_DIR:    process.env.STATIC_DIR    || path.join(__dirname, 'public'),
};
// ───────────────────────────────────────────────────────────────

// MIME types — kengaytmalarni to'ldirish mumkin
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.txt':  'text/plain; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// ─── Yordamchi: JSON body o'qish ───────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end',  () => { try { resolve(JSON.parse(data || '{}')); } catch(e) { resolve({}); } });
    req.on('error', reject);
  });
}

// ─── Yordamchi: tashqi HTTPS so'rov ───────────────────────────
function httpsRequest(reqUrl, options, postData) {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(reqUrl);
    const opts = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   options.method || 'GET',
      headers:  options.headers || {},
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end',  () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// ─── Handler: /.netlify/functions/supabase ─────────────────────
async function handleSupabase(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405); res.end('Method Not Allowed'); return;
  }

  const payload = await readBody(req);
  const { path: supaPath, method = 'GET', body } = payload;

  if (!supaPath) {
    res.writeHead(400); res.end(JSON.stringify({ error: 'path required' })); return;
  }

  const targetUrl = CONFIG.SUPABASE_URL + supaPath;
  const headers = {
    'apikey':        CONFIG.SUPABASE_KEY,
    'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
  };

  try {
    const postData = (method !== 'GET' && body) ? JSON.stringify(body) : undefined;
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);

    const result = await httpsRequest(targetUrl, { method, headers }, postData);

    res.writeHead(result.status, {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(result.body);
  } catch (e) {
    console.error('[supabase proxy error]', e.message);
    res.writeHead(502);
    res.end(JSON.stringify({ error: e.message }));
  }
}

// ─── Handler: /.netlify/functions/telegram ────────────────────
async function handleTelegram(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405); res.end('Method Not Allowed'); return;
  }

  const payload = await readBody(req);
  const text = payload.text || '(bo\'sh xabar)';

  try {
    const tgUrl    = `https://api.telegram.org/bot${CONFIG.TG_BOT_TOKEN}/sendMessage`;
    const tgBody   = JSON.stringify({ chat_id: CONFIG.TG_CHAT_ID, text, parse_mode: 'HTML' });
    const tgHeaders = {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(tgBody),
    };
    const result = await httpsRequest(tgUrl, { method: 'POST', headers: tgHeaders }, tgBody);

    res.writeHead(result.status, {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(result.body);
  } catch (e) {
    console.error('[telegram proxy error]', e.message);
    res.writeHead(502);
    res.end(JSON.stringify({ error: e.message }));
  }
}

// ─── Handler: check-admin ──────────────────────────────────────
async function handleCheckAdmin(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405); res.end('Method Not Allowed'); return;
  }
  const payload = await readBody(req);
  const ok = payload.password === process.env.ADMIN_PASS;
  res.writeHead(ok ? 200 : 401, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify({ ok, error: ok ? null : 'Parol noto\'g\'ri' }));
}

// ─── Handler: statik fayllar ──────────────────────────────────
function handleStatic(req, res) {
  // URL decode va ".." himoyasi
  let filePath;
  try {
    filePath = decodeURIComponent(url.parse(req.url).pathname || '/');
  } catch(e) {
    filePath = '/';
  }
  // SPA: "/" yoki ".html" bo'lmagan yo'llar → index.html
  if (filePath === '/' || (!path.extname(filePath) && !filePath.startsWith('/.'))) {
    filePath = '/index.html';
  }

  const absPath = path.join(CONFIG.STATIC_DIR, filePath);

  // Xavfsizlik: STATIC_DIR dan tashqariga chiqmasin
  if (!absPath.startsWith(CONFIG.STATIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(absPath, (err, data) => {
    if (err) {
      // Fayl topilmasa SPA fallback
      fs.readFile(path.join(CONFIG.STATIC_DIR, 'index.html'), (err2, indexData) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
        res.end(indexData);
      });
      return;
    }
    const ext  = path.extname(absPath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';

    // Cache strategiyasi
    const isData    = ['/data.js','/core.js','/render.js','/builder.js','/index.html'].some(f => filePath === f);
    const cache = isData
      ? 'public, max-age=0, must-revalidate'
      : 'public, max-age=31536000, immutable';

    res.writeHead(200, {
      'Content-Type':  mime,
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(data);
  });
}

// ─── Asosiy server ─────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const reqPath = url.parse(req.url).pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(); return;
  }

  if (reqPath === '/api/supabase' || reqPath === '/.netlify/functions/supabase') {
    await handleSupabase(req, res);
} else if (reqPath === '/api/telegram' || reqPath === '/.netlify/functions/telegram') {
    await handleTelegram(req, res);
} else if (reqPath === '/api/check-admin' || reqPath === '/.netlify/functions/check-admin') {
    await handleCheckAdmin(req, res);
} else {
    handleStatic(req, res);
}
});

server.listen(CONFIG.PORT, () => {
  console.log(`✅ eLink proxy server ishga tushdi → http://localhost:${CONFIG.PORT}`);
  console.log(`   Statik fayllar: ${CONFIG.STATIC_DIR}`);
  console.log(`   Supabase proxy: /.netlify/functions/supabase → ${CONFIG.SUPABASE_URL}`);
});

server.on('error', err => {
  console.error('❌ Server xatosi:', err.message);
  process.exit(1);
});