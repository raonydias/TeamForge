-- 0000_initial.sql
CREATE TABLE IF NOT EXISTS "types" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "name" text NOT NULL,
  "metadata" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "types_name_idx" ON "types" ("name");

CREATE TABLE IF NOT EXISTS "type_effectiveness" (
  "attacking_type_id" integer NOT NULL,
  "defending_type_id" integer NOT NULL,
  "multiplier" real NOT NULL,
  PRIMARY KEY ("attacking_type_id", "defending_type_id"),
  FOREIGN KEY ("attacking_type_id") REFERENCES "types"("id"),
  FOREIGN KEY ("defending_type_id") REFERENCES "types"("id")
);

CREATE TABLE IF NOT EXISTS "species" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "name" text NOT NULL,
  "type1_id" integer NOT NULL,
  "type2_id" integer,
  "hp" integer NOT NULL,
  "atk" integer NOT NULL,
  "def" integer NOT NULL,
  "spa" integer NOT NULL,
  "spd" integer NOT NULL,
  "spe" integer NOT NULL,
  FOREIGN KEY ("type1_id") REFERENCES "types"("id"),
  FOREIGN KEY ("type2_id") REFERENCES "types"("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "species_name_idx" ON "species" ("name");

CREATE TABLE IF NOT EXISTS "abilities" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "name" text NOT NULL,
  "tags" text NOT NULL DEFAULT '[]'
);
CREATE UNIQUE INDEX IF NOT EXISTS "abilities_name_idx" ON "abilities" ("name");

CREATE TABLE IF NOT EXISTS "items" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "name" text NOT NULL,
  "tags" text NOT NULL DEFAULT '[]'
);
CREATE UNIQUE INDEX IF NOT EXISTS "items_name_idx" ON "items" ("name");

CREATE TABLE IF NOT EXISTS "games" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "name" text NOT NULL,
  "notes" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "games_name_idx" ON "games" ("name");

CREATE TABLE IF NOT EXISTS "game_species" (
  "game_id" integer NOT NULL,
  "species_id" integer NOT NULL,
  PRIMARY KEY ("game_id", "species_id"),
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("species_id") REFERENCES "species"("id")
);

CREATE TABLE IF NOT EXISTS "game_abilities" (
  "game_id" integer NOT NULL,
  "ability_id" integer NOT NULL,
  PRIMARY KEY ("game_id", "ability_id"),
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("ability_id") REFERENCES "abilities"("id")
);

CREATE TABLE IF NOT EXISTS "game_items" (
  "game_id" integer NOT NULL,
  "item_id" integer NOT NULL,
  PRIMARY KEY ("game_id", "item_id"),
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("item_id") REFERENCES "items"("id")
);

CREATE TABLE IF NOT EXISTS "box_pokemon" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "game_id" integer NOT NULL,
  "species_id" integer NOT NULL,
  "ability_id" integer,
  "item_id" integer,
  "nickname" text,
  "notes" text,
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("species_id") REFERENCES "species"("id"),
  FOREIGN KEY ("ability_id") REFERENCES "abilities"("id"),
  FOREIGN KEY ("item_id") REFERENCES "items"("id")
);

CREATE TABLE IF NOT EXISTS "team_slots" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "game_id" integer NOT NULL,
  "slot_index" integer NOT NULL,
  "box_pokemon_id" integer,
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("box_pokemon_id") REFERENCES "box_pokemon"("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "team_slots_game_slot_idx" ON "team_slots" ("game_id", "slot_index");

CREATE TABLE IF NOT EXISTS "settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL
);