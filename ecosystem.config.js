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
      env: {
        NODE_ENV: 'production',
        HOSTNAME: '0.0.0.0',
      },
    },
  ],
};
