-- 0001_pack_species_evolutions.sql
CREATE TABLE IF NOT EXISTS "pack_species_evolutions" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "pack_id" integer NOT NULL,
  "from_species_id" integer NOT NULL,
  "to_species_id" integer NOT NULL,
  "method" text NOT NULL,
  FOREIGN KEY ("pack_id") REFERENCES "packs"("id"),
  FOREIGN KEY ("from_species_id") REFERENCES "pack_species"("id"),
  FOREIGN KEY ("to_species_id") REFERENCES "pack_species"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pack_species_evo_pack_from_to_method_idx" ON "pack_species_evolutions" ("pack_id", "from_species_id", "to_species_id", "method");
