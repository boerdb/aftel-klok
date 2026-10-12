/** PM2 — Aftelklok (poort 3020). Publiek: https://timer.clvs.nl */
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
