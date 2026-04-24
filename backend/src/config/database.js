import mysql from "mysql2/promise";
import { env } from "./env.js";

let pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.name,
      connectionLimit: env.db.connectionLimit,
      namedPlaceholders: true
    });
  }

  return pool;
}

export async function query(sql, params = {}) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

export async function withTransaction(work) {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function pingDatabase() {
  await query("SELECT 1 AS ok");
  return true;
}

export default {
  getPool,
  query,
  withTransaction,
  pingDatabase
};
