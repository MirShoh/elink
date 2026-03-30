// PM2 konfiguratsiyasi
// Ishga tushirish: pm2 start ecosystem.config.js
// Reboot'dan keyin ham ishlasin: pm2 save && pm2 startup

module.exports = {
  apps: [{
    name:    'elink-proxy',
    script:  'server.js',
    cwd:     '/var/www/elink',          // server.js qayerda bo'lsa shu yo'l
    instances: 1,
    autorestart: true,
    watch:   false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV:      'production',
      PORT:          3000,
      STATIC_DIR:    '/var/www/elink',
      SUPABASE_URL:  'https://XXXXXXXXXXXX.supabase.co',
      SUPABASE_KEY:  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.XXXXXXXX',
      TG_BOT_TOKEN:  '1234567890:AAxxxxxxxx',
      TG_CHAT_ID:    '-100xxxxxxxxxx',
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
};
