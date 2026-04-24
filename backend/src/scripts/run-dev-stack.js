import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { env } from "../config/env.js";
import { pingDatabase } from "../config/database.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDatabase(maxAttempts = 30) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pingDatabase();
      return true;
    } catch (_error) {
      await sleep(1000);
    }
  }

  return false;
}

const mysqlBinary = path.join(env.mysqlRuntimeBase, "bin", "mysqld.exe");
let mysqlProcess = null;

let ready = await waitForDatabase(2);
if (!ready) {
  if (!fs.existsSync(mysqlBinary)) {
    console.error(`MySQL binary was not found at ${mysqlBinary}`);
    process.exit(1);
  }

  const command = `& '${mysqlBinary.replace(/'/g, "''")}' --defaults-file='${env.mysqlRuntimeConfig.replace(/'/g, "''")}' --console`;

  mysqlProcess = spawn("powershell.exe", ["-NoProfile", "-Command", command], {
    cwd: env.mysqlRuntimeBase,
    stdio: ["ignore", "pipe", "pipe"]
  });

  mysqlProcess.stdout.on("data", (chunk) => {
    process.stdout.write(`[mysql] ${chunk}`);
  });

  mysqlProcess.stderr.on("data", (chunk) => {
    process.stderr.write(`[mysql] ${chunk}`);
  });

  mysqlProcess.on("exit", (code) => {
    if (!process.killed) {
      console.log(`MySQL process exited with code ${code ?? 0}.`);
    }
  });

  ready = await waitForDatabase();
}

if (!ready) {
  console.error("MySQL did not become ready in time.");
  if (mysqlProcess && !mysqlProcess.killed) {
    mysqlProcess.kill("SIGTERM");
  }
  process.exit(1);
}

const backendProcess = spawn("node", ["src/server.js"], {
  cwd: env.backendRoot,
  stdio: ["ignore", "inherit", "inherit"],
  shell: false
});

function shutdown() {
  if (!backendProcess.killed) {
    backendProcess.kill("SIGTERM");
  }

  if (mysqlProcess && !mysqlProcess.killed) {
    mysqlProcess.kill("SIGTERM");
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

backendProcess.on("exit", (code) => {
  shutdown();
  process.exit(code ?? 0);
});
