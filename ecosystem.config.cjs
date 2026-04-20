module.exports = {
  apps: [
    {
      name: "ads-as",
      script: "dist/index.js",
      env_file: "/root/.env",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
    },
  ],
};
