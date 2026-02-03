import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const dataDir = resolve(process.cwd(), "data");
const dbPath = resolve(dataDir, "app.db");

mkdirSync(dataDir, { recursive: true });

export const sqlite = new Database(dbPath);
export const db = drizzle(sqlite);