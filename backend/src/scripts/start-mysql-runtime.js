import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { env } from "../config/env.js";

const mysqlBinary = path.join(env.mysqlRuntimeBase, "bin", "mysqld.exe");
if (!fs.existsSync(mysqlBinary)) {
  console.error(`MySQL binary was not found at ${mysqlBinary}`);
  process.exit(1);
}

const pidFile = path.join(env.backendRoot, "mysql-runtime", "data", "7ashash.pid");
if (fs.existsSync(pidFile)) {
  try {
    fs.unlinkSync(pidFile);
  } catch (_error) {
    // Ignore stale pid cleanup failures and continue with startup attempt.
  }
}

const startResult = spawnSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    [
      "$ErrorActionPreference = 'Stop'",
      `Start-Process -FilePath '${mysqlBinary}' -ArgumentList @('--defaults-file=${env.mysqlRuntimeConfig}', '--console') -WorkingDirectory '${env.mysqlRuntimeBase}' -WindowStyle Hidden`
    ].join("; ")
  ],
  { stdio: "inherit", shell: false }
);

if (startResult.status !== 0) {
  console.error("MySQL runtime failed to start.");
  process.exit(startResult.status || 1);
}

console.log("MySQL runtime start command was sent.");
console.log(`Binary: ${mysqlBinary}`);
