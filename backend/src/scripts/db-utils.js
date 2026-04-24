import fs from "fs/promises";
import path from "path";
import mysql from "mysql2/promise";
import { env } from "../config/env.js";
import { hashPassword } from "../lib/passwords.js";

export async function createConnection({ database = true, multipleStatements = true } = {}) {
  return mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: database ? env.db.name : undefined,
    multipleStatements
  });
}

export async function listSqlFiles(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => path.join(directoryPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

export async function replaceHashPlaceholders(content) {
  const matches = Array.from(content.matchAll(/\{\{HASH:([^}]+)\}\}/g));
  let rendered = content;

  for (const match of matches) {
    const fullMatch = match[0];
    const password = match[1];
    const hash = await hashPassword(password);
    rendered = rendered.replace(fullMatch, hash);
  }

  return rendered;
}

export async function executeSqlFile(connection, filePath, { hashPasswords = false } = {}) {
  let content = await fs.readFile(filePath, "utf8");
  if (hashPasswords) {
    content = await replaceHashPlaceholders(content);
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return path.basename(filePath);
  }

  await connection.query(trimmed);
  return path.basename(filePath);
}
