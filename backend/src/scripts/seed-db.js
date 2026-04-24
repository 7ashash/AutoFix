import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import { env } from "../config/env.js";
import { createConnection, executeSqlFile } from "./db-utils.js";

async function listSeedFiles(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && (entry.name.endsWith(".sql") || entry.name.endsWith(".js")))
    .map((entry) => path.join(directoryPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

async function executeSeedFile(connection, filePath) {
  if (filePath.endsWith(".sql")) {
    return executeSqlFile(connection, filePath, { hashPasswords: true });
  }

  const seedModule = await import(pathToFileURL(filePath).href);
  const runner = seedModule.runSeed || seedModule.default;

  if (typeof runner !== "function") {
    throw new Error(`Seed file "${path.basename(filePath)}" must export a default function or runSeed(connection)`);
  }

  await runner(connection);
  return path.basename(filePath);
}

export async function runSeeds() {
  const seedsDir = path.join(env.backendRoot, "src", "database", "seeds");
  const files = await listSeedFiles(seedsDir);
  const connection = await createConnection({ database: true, multipleStatements: true });

  try {
    const executed = [];
    for (const file of files) {
      executed.push(await executeSeedFile(connection, file));
    }

    console.log(`Seed complete. Executed ${executed.length} file(s).`);
    if (executed.length) {
      console.log(executed.join("\n"));
    }
  } finally {
    await connection.end();
  }
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  runSeeds().catch((error) => {
    console.error("Seed failed:", error.message);
    process.exit(1);
  });
}
