import { getPool, pingDatabase } from "../config/database.js";
import { env } from "../config/env.js";

pingDatabase()
  .then(() => {
    console.log(`MySQL runtime is alive on database "${env.db.name}".`);
  })
  .catch((error) => {
    console.error(`MySQL runtime is not responding: ${error.message}`);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // Ignore pool shutdown errors during ping.
    }
  });
