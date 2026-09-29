/** Fengyun Nexus · PM2 企业托管 */
const path = require("node:path");

const root = __dirname;

module.exports = {
  apps: [
    {
      name: "nexus",
      cwd: root,
      script: path.join(root, "scripts", "boot.mjs"),
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      min_uptime: "8s",
      kill_timeout: 8000,
      env: {
        NEXUS_UNDER_PM2: "1",
        NODE_ENV: "production",
        CI: "true",
      },
    },
  ],
};
