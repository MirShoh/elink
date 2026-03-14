exports.handler = async (event) => {
  // Faqat POST so'rovlarni qabul qilish
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // Netlify Dashboard > Environment Variables dan olinadi
  const SUPA_URL = process.env.SUPA_URL;
  const SUPA_KEY = process.env.SUPA_KEY;

  if (!SUPA_URL || !SUPA_KEY) {
    console.error('[Supabase Proxy] Env vars topilmadi!');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server config xatosi' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "JSON parse xatosi" }) };
  }

  const { path, method = 'GET', body, prefer } = payload;

  if (!path) {
    return { statusCode: 400, body: JSON.stringify({ error: 'path kerak' }) };
  }

  const headers = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers['Prefer'] = prefer;

  try {
    const fetchOptions = {
      method,
      headers,
    };
    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const res = await fetch(`${SUPA_URL}${path}`, fetchOptions);
    const text = await res.text();

    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json' },
      body: text,
    };
  } catch (e) {
    console.error('[Supabase Proxy] Xato:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
