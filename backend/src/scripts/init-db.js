import { pathToFileURL } from "url";
import { env } from "../config/env.js";
import { createConnection } from "./db-utils.js";
import { runMigrations } from "./migrate-db.js";
import { runSeeds } from "./seed-db.js";

export async function initDatabase() {
  const connection = await createConnection({ database: false, multipleStatements: true });

  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${env.db.name}\`; CREATE DATABASE \`${env.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  } finally {
    await connection.end();
  }

  await runMigrations();
  await runSeeds();
  console.log(`Database "${env.db.name}" initialized successfully.`);
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  initDatabase().catch((error) => {
    console.error("Database init failed:", error.message);
    process.exit(1);
  });
}
