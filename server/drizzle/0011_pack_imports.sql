CREATE TABLE IF NOT EXISTS "pack_imports" (
  "pack_id" integer NOT NULL,
  "import_pack_id" integer NOT NULL,
  "sort_order" integer NOT NULL,
  PRIMARY KEY ("pack_id", "import_pack_id"),
  FOREIGN KEY ("pack_id") REFERENCES "packs"("id"),
  FOREIGN KEY ("import_pack_id") REFERENCES "packs"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pack_imports_pack_sort_idx" ON "pack_imports" ("pack_id", "sort_order");
