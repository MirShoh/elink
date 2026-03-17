// netlify/functions/check-admin.js
export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Faqat POST so‘rovlar', { status: 405 });
  }

  try {
    const { password } = await request.json();

    if (!password) {
      return new Response(JSON.stringify({ ok: false, msg: 'Parol kiritilmadi' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (password !== process.env.ADMIN_SECRET_PASSWORD) {
      return new Response(JSON.stringify({ ok: false, msg: 'Noto‘g‘ri parol' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = 'admin-ok-' + Date.now();

    return new Response(JSON.stringify({ ok: true, token }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, msg: 'Server xatosi' }), { status: 500 });
  }
};