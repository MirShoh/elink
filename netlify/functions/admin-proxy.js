// netlify/functions/admin-proxy.js
// Admin panel uchun xavfsiz Supabase proxy (service_role key)

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ── Token tekshirish ─────────────────────────────────────
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token || !token.startsWith('admin-ok-')) {
    return new Response(JSON.stringify({ error: 'Ruxsat yoq' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ── Mavjud env vars (SUPA_URL, SUPA_KEY) ────────────────
  const SUPABASE_URL     = process.env.SUPA_URL;
  const SUPABASE_SERVICE = process.env.SUPA_SERVICE_KEY; // yangi kalit — faqat admin uchun

  if (!SUPABASE_URL || !SUPABASE_SERVICE) {
    console.error('[admin-proxy] SUPA_URL va SUPA_SERVICE_KEY topilmadi!');
    return new Response(JSON.stringify({ error: 'Server sozlanmagan' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ── Body ─────────────────────────────────────────────────
  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { path, method = 'GET', body, prefer } = payload;

  if (!path || !path.startsWith('/rest/v1/')) {
    return new Response(JSON.stringify({ error: "Noto'g'ri path" }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ── Supabase ga yuborish (service_role — RLS bypass) ─────
  const headers = {
    'apikey':        SUPABASE_SERVICE,
    'Authorization': 'Bearer ' + SUPABASE_SERVICE,
    'Content-Type':  'application/json',
  };
  if (prefer) headers['Prefer'] = prefer;

  const opts = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  try {
    const res = await fetch(SUPABASE_URL + path, opts);
    if (res.status === 204) return new Response(null, { status: 204 });

    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('[admin-proxy] Xato:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
