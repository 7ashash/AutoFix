import path from "path";
import { pathToFileURL } from "url";
import { env } from "../config/env.js";
import { createConnection, executeSqlFile, listSqlFiles } from "./db-utils.js";

export async function runMigrations() {
  const migrationsDir = path.join(env.backendRoot, "src", "database", "migrations");
  const files = await listSqlFiles(migrationsDir);
  const connection = await createConnection({ database: true, multipleStatements: true });

  try {
    const executed = [];
    for (const file of files) {
      executed.push(await executeSqlFile(connection, file));
    }

    console.log(`Migrations complete. Executed ${executed.length} file(s).`);
    if (executed.length) {
      console.log(executed.join("\n"));
    }
  } finally {
    await connection.end();
  }
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  runMigrations().catch((error) => {
    console.error("Migration failed:", error.message);
    process.exit(1);
  });
}
