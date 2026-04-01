module.exports = {
  apps: [{
    name:    'elink-proxy',
    script:  'server.js',
    cwd:     '/var/www/elink.uz',
    instances: 1,
    autorestart: true,
    watch:   false,
    max_memory_restart: '256M',
    env_file: '/var/www/elink.uz/.env', 
    env: {
      NODE_ENV: 'production',
      PORT:     3001,
      STATIC_DIR: '/var/www/elink.uz',
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
};