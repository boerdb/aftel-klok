/** PM2 — Aftelklok (poort 3020). */
module.exports = {
  apps: [
    {
      name: 'aftelklok',
      cwd: '/var/www/aftelklok',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3020,
        TZ: 'Europe/Amsterdam',
      },
    },
  ],
};
