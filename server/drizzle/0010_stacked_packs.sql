PRAGMA foreign_keys=off;
--> statement-breakpoint
DROP TABLE IF EXISTS team_slots;
--> statement-breakpoint
DROP TABLE IF EXISTS tracked_box;
--> statement-breakpoint
DROP TABLE IF EXISTS box_pokemon;
--> statement-breakpoint
DROP TABLE IF EXISTS game_allowed_items;
--> statement-breakpoint
DROP TABLE IF EXISTS game_allowed_abilities;
--> statement-breakpoint
DROP TABLE IF EXISTS game_allowed_species;
--> statement-breakpoint
DROP TABLE IF EXISTS game_species_evolutions;
--> statement-breakpoint
DROP TABLE IF EXISTS game_species_abilities;
--> statement-breakpoint
DROP TABLE IF EXISTS game_items;
--> statement-breakpoint
DROP TABLE IF EXISTS game_abilities;
--> statement-breakpoint
DROP TABLE IF EXISTS game_species;
--> statement-breakpoint
DROP TABLE IF EXISTS game_type_effectiveness;
--> statement-breakpoint
DROP TABLE IF EXISTS game_types;
--> statement-breakpoint
DROP TABLE IF EXISTS game_packs;
--> statement-breakpoint
DROP TABLE IF EXISTS games;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "games" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "name" text NOT NULL,
  "notes" text,
  "disable_abilities" integer NOT NULL DEFAULT 0,
  "disable_held_items" integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "games_name_idx" ON "games" ("name");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_packs" (
  "game_id" integer NOT NULL,
  "pack_id" integer NOT NULL,
  "sort_order" integer NOT NULL,
  PRIMARY KEY ("game_id", "pack_id"),
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("pack_id") REFERENCES "packs"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "game_packs_game_sort_idx" ON "game_packs" ("game_id", "sort_order");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_types" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "game_id" integer NOT NULL,
  "name" text NOT NULL,
  "metadata" text,
  "color" text,
  "exclude_in_chart" integer NOT NULL DEFAULT 0,
  FOREIGN KEY ("game_id") REFERENCES "games"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "game_types_game_name_idx" ON "game_types" ("game_id", "name");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_type_effectiveness" (
  "game_id" integer NOT NULL,
  "attacking_type_id" integer NOT NULL,
  "defending_type_id" integer NOT NULL,
  "multiplier" real NOT NULL,
  PRIMARY KEY ("game_id", "attacking_type_id", "defending_type_id"),
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("attacking_type_id") REFERENCES "game_types"("id"),
  FOREIGN KEY ("defending_type_id") REFERENCES "game_types"("id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_species" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "game_id" integer NOT NULL,
  "dex_number" integer NOT NULL DEFAULT 1,
  "base_species_id" integer,
  "name" text NOT NULL,
  "type1_id" integer NOT NULL,
  "type2_id" integer,
  "hp" integer NOT NULL,
  "atk" integer NOT NULL,
  "def" integer NOT NULL,
  "spa" integer NOT NULL,
  "spd" integer NOT NULL,
  "spe" integer NOT NULL,
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("base_species_id") REFERENCES "game_species"("id"),
  FOREIGN KEY ("type1_id") REFERENCES "game_types"("id"),
  FOREIGN KEY ("type2_id") REFERENCES "game_types"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "game_species_game_name_idx" ON "game_species" ("game_id", "name");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_abilities" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "game_id" integer NOT NULL,
  "name" text NOT NULL,
  "tags" text NOT NULL DEFAULT '[]',
  FOREIGN KEY ("game_id") REFERENCES "games"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "game_abilities_game_name_idx" ON "game_abilities" ("game_id", "name");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_items" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "game_id" integer NOT NULL,
  "name" text NOT NULL,
  "tags" text NOT NULL DEFAULT '[]',
  FOREIGN KEY ("game_id") REFERENCES "games"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "game_items_game_name_idx" ON "game_items" ("game_id", "name");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_species_abilities" (
  "game_id" integer NOT NULL,
  "species_id" integer NOT NULL,
  "ability_id" integer NOT NULL,
  "slot" text NOT NULL,
  PRIMARY KEY ("game_id", "species_id", "ability_id", "slot"),
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("species_id") REFERENCES "game_species"("id"),
  FOREIGN KEY ("ability_id") REFERENCES "game_abilities"("id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_species_evolutions" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "game_id" integer NOT NULL,
  "from_species_id" integer NOT NULL,
  "to_species_id" integer NOT NULL,
  "method" text NOT NULL,
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("from_species_id") REFERENCES "game_species"("id"),
  FOREIGN KEY ("to_species_id") REFERENCES "game_species"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "game_species_evo_game_from_to_method_idx" ON "game_species_evolutions" (
  "game_id",
  "from_species_id",
  "to_species_id",
  "method"
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_allowed_species" (
  "game_id" integer NOT NULL,
  "species_id" integer NOT NULL,
  PRIMARY KEY ("game_id", "species_id"),
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("species_id") REFERENCES "game_species"("id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_allowed_abilities" (
  "game_id" integer NOT NULL,
  "ability_id" integer NOT NULL,
  PRIMARY KEY ("game_id", "ability_id"),
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("ability_id") REFERENCES "game_abilities"("id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_allowed_items" (
  "game_id" integer NOT NULL,
  "item_id" integer NOT NULL,
  PRIMARY KEY ("game_id", "item_id"),
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("item_id") REFERENCES "game_items"("id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "box_pokemon" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "game_id" integer NOT NULL,
  "species_id" integer NOT NULL,
  "ability_id" integer,
  "item_id" integer,
  "nickname" text,
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("species_id") REFERENCES "game_species"("id"),
  FOREIGN KEY ("ability_id") REFERENCES "game_abilities"("id"),
  FOREIGN KEY ("item_id") REFERENCES "game_items"("id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tracked_box" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "game_id" integer NOT NULL,
  "species_id" integer NOT NULL,
  "ability_id" integer,
  "item_id" integer,
  "nickname" text,
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("species_id") REFERENCES "game_species"("id"),
  FOREIGN KEY ("ability_id") REFERENCES "game_abilities"("id"),
  FOREIGN KEY ("item_id") REFERENCES "game_items"("id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "team_slots" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "game_id" integer NOT NULL,
  "slot_index" integer NOT NULL,
  "box_pokemon_id" integer,
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("box_pokemon_id") REFERENCES "box_pokemon"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_slots_game_slot_idx" ON "team_slots" ("game_id", "slot_index");
--> statement-breakpoint
PRAGMA foreign_keys=on;
