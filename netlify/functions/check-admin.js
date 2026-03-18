exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Faqat POST sorovlar' };
  }

  try {
    const { password } = JSON.parse(event.body || '{}');

    if (!password) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, msg: 'Parol kiritilmadi' })
      };
    }

    if (password !== process.env.ADMIN_SECRET_PASSWORD) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, msg: "Noto'g'ri parol" })
      };
    }

    const token = 'admin-ok-' + Date.now();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        token,
        supaUrl: process.env.SUPA_URL || '',
        supaKey: process.env.SUPA_KEY || ''
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, msg: 'Server xatosi: ' + err.message })
    };
  }
};