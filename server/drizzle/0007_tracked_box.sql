CREATE TABLE IF NOT EXISTS "tracked_box" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "game_id" integer NOT NULL,
  "species_id" integer NOT NULL,
  "ability_id" integer,
  "item_id" integer,
  "nickname" text,
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("species_id") REFERENCES "pack_species"("id"),
  FOREIGN KEY ("ability_id") REFERENCES "pack_abilities"("id"),
  FOREIGN KEY ("item_id") REFERENCES "pack_items"("id")
);
