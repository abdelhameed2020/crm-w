// ==============================================================================
// WhatsApp Gateway - PM2 Process Management Configuration
// Use this for bare-metal VPS or Linux servers running Node.js directly
// ==============================================================================
module.exports = {
  apps: [
    {
      name: 'omnicrm-whatsapp-gateway',
      script: './dist/index.js',
      instances: 1, // Baileys MUST run as a single instance to prevent session conflicts
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 5000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        GATEWAY_PORT: 5001,
      },
    },
  ],
};
