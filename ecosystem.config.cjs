module.exports = {
  apps: [{
    name: process.env.PM2_APP_NAME || "ads-as",
    script: "dist/index.cjs",
    cwd: process.env.APP_CURRENT_DIR || process.cwd(),
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    max_memory_restart: "750M",
    env: {
      NODE_ENV: "production",
      PORT: process.env.PORT || "5000",
      HOST: process.env.HOST || "127.0.0.1",
    },
  }],
};