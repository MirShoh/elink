require('dotenv').config();
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');
const zlib  = require('zlib');

const CONFIG = {
  PORT: process.env.PORT || 3000,

  SUPABASE_URL:  process.env.SUPABASE_URL  || 'https://XXXX.supabase.co',
  SUPABASE_KEY:  process.env.SUPABASE_KEY  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.XXXX',

  TG_BOT_TOKEN:  process.env.TG_BOT_TOKEN  || '1234567890:AAXXXX',
  TG_CHAT_ID:    process.env.TG_CHAT_ID    || '-100XXXXXXXX',

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
  const { path: supaPath, method = 'GET', body, prefer } = payload;

  if (!supaPath) {
    res.writeHead(400); res.end(JSON.stringify({ error: 'path required' })); return;
  }

  const targetUrl = CONFIG.SUPABASE_URL + supaPath;
  const headers = {
    'apikey':        CONFIG.SUPABASE_KEY,
    'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
    'Content-Type':  'application/json',
    'Prefer':        prefer || 'return=representation',
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
  res.end(JSON.stringify({
    ok,
    token:   ok ? 'admin-ok-' + Date.now() : null,
    supaUrl: ok ? CONFIG.SUPABASE_URL : null,
    supaKey: ok ? CONFIG.SUPABASE_KEY : null,
    error:   ok ? null : "Parol noto'g'ri",
  }));
}

// ─── Yordamchi: gzip / deflate javob yuborish ─────────────────
const GZIP_TYPES = new Set([
  'text/html; charset=utf-8',
  'application/javascript; charset=utf-8',
  'text/css; charset=utf-8',
  'application/json; charset=utf-8',
  'image/svg+xml',
  'text/plain; charset=utf-8',
  'application/manifest+json',
]);

// In-memory gzip cache: { etag → gzipBuffer }
const _gzCache = new Map();

function sendCompressed(req, res, data, headers) {
  const mime = headers['Content-Type'] || '';
  const ae   = req.headers['accept-encoding'] || '';
  if (!GZIP_TYPES.has(mime) || data.length < 512 || !ae.includes('gzip')) {
    res.writeHead(200, headers);
    res.end(data);
    return;
  }
  const etag = headers['ETag'];
  if (etag && _gzCache.has(etag)) {
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' });
    res.end(_gzCache.get(etag));
    return;
  }
  zlib.gzip(data, { level: 6 }, (err, gz) => {
    if (err) { res.writeHead(200, headers); res.end(data); return; }
    if (etag) _gzCache.set(etag, gz);
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' });
    res.end(gz);
  });
}

// ─── Handler: statik fayllar ──────────────────────────────────
function handleStatic(req, res) {
  let filePath;
  try {
    filePath = decodeURIComponent(url.parse(req.url).pathname || '/');
  } catch(e) { filePath = '/'; }

  // SPA: "/" yoki ".html" bo'lmagan yo'llar → index.html
  if (filePath === '/' || (!path.extname(filePath) && !filePath.startsWith('/.'))) {
    filePath = '/index.html';
  }

  const absPath = path.join(CONFIG.STATIC_DIR, filePath);
  if (!absPath.startsWith(CONFIG.STATIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  // WebP auto-serving: PNG/JPG so'rovida browser WebP qabul qilsa, .webp faylini yuboradi
  const imageExts = new Set(['.png', '.jpg', '.jpeg']);
  const acceptsWebP = (req.headers['accept'] || '').includes('image/webp');
  if (imageExts.has(ext) && acceptsWebP) {
    const webpPath = absPath.replace(/\.(png|jpe?g)$/i, '.webp');
    if (require('fs').existsSync(webpPath)) {
      fs.readFile(webpPath, (werr, wdata) => {
        if (!werr) {
          const wstat = fs.statSync(webpPath, { throwIfNoEntry: false });
          const wetag = wstat ? `"${wstat.size}-${wstat.mtimeMs.toString(36)}"` : null;
          if (wetag && req.headers['if-none-match'] === wetag) {
            res.writeHead(304); res.end(); return;
          }
          const wheaders = {
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=604800',
            'X-Content-Type-Options': 'nosniff',
            'Vary': 'Accept',
          };
          if (wetag) wheaders['ETag'] = wetag;
          sendCompressed(req, res, wdata, wheaders);
          return;
        }
        // WebP yo'q, davom etadi
        serveOriginal();
      });
      return;
    }
  }
  serveOriginal();
  function serveOriginal() {

  fs.readFile(absPath, (err, data) => {
    if (err) {
      fs.readFile(path.join(CONFIG.STATIC_DIR, 'index.html'), (err2, indexData) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        sendCompressed(req, res, indexData, {
          'Content-Type': MIME['.html'],
          'Cache-Control': 'no-cache',
        });
      });
      return;
    }

    const ext  = path.extname(absPath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';

    let cache;
    if (filePath === '/index.html') {
      cache = 'public, no-cache';
    } else if (filePath === '/data.js') {
      cache = 'public, max-age=3600, stale-while-revalidate=86400';
    } else if (['/core.js','/render.js','/builder.js','/widgets.js'].includes(filePath)) {
      cache = 'public, max-age=86400, stale-while-revalidate=604800';
    } else if (ext === '.css') {
      cache = 'public, max-age=2592000, stale-while-revalidate=604800';
    } else if (['.png','.jpg','.jpeg','.webp','.svg','.ico'].includes(ext)) {
      cache = 'public, max-age=2592000, stale-while-revalidate=604800';
    } else if (['.woff2','.woff'].includes(ext)) {
      cache = 'public, max-age=31536000, immutable';
    } else {
      cache = 'public, max-age=86400, stale-while-revalidate=604800';
    }

    // ETag: fayl hajmi + mtime (tez hisoblanadi)
    const stat = fs.statSync(absPath, { throwIfNoEntry: false });
    const etag  = stat ? `"${stat.size}-${stat.mtimeMs.toString(36)}"` : null;

    // 304 Not Modified
    if (etag && req.headers['if-none-match'] === etag) {
      res.writeHead(304); res.end(); return;
    }

    const headers = {
      'Content-Type':             mime,
      'Cache-Control':            cache,
      'X-Content-Type-Options':   'nosniff',
      'Connection':               'keep-alive',
    };
    if (etag) headers['ETag'] = etag;
    // WebP/font fayllar uchun Vary headeri
    if (['.png','.jpg','.jpeg'].includes(ext)) headers['Vary'] = 'Accept';

    sendCompressed(req, res, data, headers);
  });
  } // end serveOriginal
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

server.keepAliveTimeout = 65000;   // 65s — nginx/LB dan yuqori
server.headersTimeout   = 70000;
server.maxHeadersCount  = 100;

server.listen(CONFIG.PORT, () => {
  console.log(`✅ eLink proxy server ishga tushdi → http://localhost:${CONFIG.PORT}`);
  console.log(`   Statik fayllar: ${CONFIG.STATIC_DIR}`);
  console.log(`   Supabase proxy: /.netlify/functions/supabase → ${CONFIG.SUPABASE_URL}`);
  console.log(`   Gzip kompressiya: yoqilgan`);
});

server.on('error', err => {
  console.error('❌ Server xatosi:', err.message);
  process.exit(1);
});