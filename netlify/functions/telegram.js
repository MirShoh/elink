exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }


  const TG_TOKEN = process.env.TG_TOKEN;
  const TG_CHAT  = process.env.TG_CHAT;

  if (!TG_TOKEN || !TG_CHAT) {
    console.error('[Telegram] Env vars topilmadi!');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server config xatosi' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON parse xatosi' }) };
  }

  const { text } = payload;
  if (!text) {
    return { statusCode: 400, body: JSON.stringify({ error: 'text kerak' }) };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    const data = await res.json();
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: data.ok })
    };
  } catch (e) {
    console.error('[Telegram] Xato:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
