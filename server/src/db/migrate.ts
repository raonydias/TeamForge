import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "./index.js";
import { resolve } from "node:path";

const migrationsFolder = resolve(process.cwd(), "drizzle");

migrate(db, { migrationsFolder });

sqlite.close();
