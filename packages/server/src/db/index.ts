import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";

export type Db = BetterSQLite3Database<typeof schema>;

function findMigrationsDir(): string {
  const candidates = [
    path.resolve(import.meta.dirname, "../../drizzle"),
    path.resolve(import.meta.dirname, "../drizzle"),
    path.resolve(import.meta.dirname, "./drizzle"),
  ];
  for (const c of candidates) if (fs.existsSync(path.join(c, "meta", "_journal.json"))) return c;
  throw new Error("Could not locate the drizzle migrations folder");
}

/** Open (creating if needed) the SQLite database and apply pending migrations. */
export function openDb(file: string): Db {
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: findMigrationsDir() });
  return db;
}

export { schema };
