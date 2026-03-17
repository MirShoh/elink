// netlify/functions/supabase.js
// Oddiy foydalanuvchilar uchun Supabase proxy (anon key)

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const SUPABASE_URL  = process.env.SUPA_URL;
  const SUPABASE_ANON = process.env.SUPA_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error('[supabase proxy] SUPA_URL va SUPA_KEY env vars topilmadi!');
    return new Response(JSON.stringify({ error: 'Server config xatosi' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON parse xatosi' }), {
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

  const headers = {
    'apikey':        SUPABASE_ANON,
    'Authorization': 'Bearer ' + SUPABASE_ANON,
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
    console.error('[supabase proxy] Xato:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};