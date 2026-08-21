import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let database: Database.Database | null = null;

export function isCatalogBuild() {
  return process.env.CATALOG_BUILD === "1";
}

export function isCatalogReadOnly() {
  if (isCatalogBuild()) return false;
  return process.env.CATALOG_READ_ONLY === "1" || process.env.VERCEL === "1";
}

export function databasePath() {
  const configured = process.env.DATABASE_URL?.replace(/^file:/, "");
  const filename = path.basename(configured || "grocery-copilot.db");
  return path.join(process.cwd(), "data", filename);
}

export function getDb() {
  if (!database) {
    const file = databasePath();
    if (isCatalogReadOnly()) {
      database = new Database(file, { readonly: true, fileMustExist: true });
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      database = new Database(file);
      database.pragma(`journal_mode = ${isCatalogBuild() ? "DELETE" : "WAL"}`);
    }
    database.pragma("foreign_keys = ON");
  }
  return database;
}

export function closeDb() {
  database?.close();
  database = null;
}
