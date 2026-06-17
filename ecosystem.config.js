module.exports = {
  apps: [
    {
      name: 'api',
      script: './backend/src/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
    {
      name: 'web',
      script: './frontend/server.js',
      cwd: './frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
    },
  ],
};
