-- 0000_initial.sql
CREATE TABLE IF NOT EXISTS "packs" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "name" text NOT NULL,
  "description" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "packs_name_idx" ON "packs" ("name");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pack_types" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "pack_id" integer NOT NULL,
  "name" text NOT NULL,
  "metadata" text,
  FOREIGN KEY ("pack_id") REFERENCES "packs"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pack_types_pack_name_idx" ON "pack_types" ("pack_id", "name");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pack_type_effectiveness" (
  "pack_id" integer NOT NULL,
  "attacking_type_id" integer NOT NULL,
  "defending_type_id" integer NOT NULL,
  "multiplier" real NOT NULL,
  PRIMARY KEY ("pack_id", "attacking_type_id", "defending_type_id"),
  FOREIGN KEY ("pack_id") REFERENCES "packs"("id"),
  FOREIGN KEY ("attacking_type_id") REFERENCES "pack_types"("id"),
  FOREIGN KEY ("defending_type_id") REFERENCES "pack_types"("id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pack_species" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "pack_id" integer NOT NULL,
  "name" text NOT NULL,
  "type1_id" integer NOT NULL,
  "type2_id" integer,
  "hp" integer NOT NULL,
  "atk" integer NOT NULL,
  "def" integer NOT NULL,
  "spa" integer NOT NULL,
  "spd" integer NOT NULL,
  "spe" integer NOT NULL,
  FOREIGN KEY ("pack_id") REFERENCES "packs"("id"),
  FOREIGN KEY ("type1_id") REFERENCES "pack_types"("id"),
  FOREIGN KEY ("type2_id") REFERENCES "pack_types"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pack_species_pack_name_idx" ON "pack_species" ("pack_id", "name");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pack_abilities" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "pack_id" integer NOT NULL,
  "name" text NOT NULL,
  "tags" text NOT NULL DEFAULT '[]',
  FOREIGN KEY ("pack_id") REFERENCES "packs"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pack_abilities_pack_name_idx" ON "pack_abilities" ("pack_id", "name");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pack_items" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "pack_id" integer NOT NULL,
  "name" text NOT NULL,
  "tags" text NOT NULL DEFAULT '[]',
  FOREIGN KEY ("pack_id") REFERENCES "packs"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pack_items_pack_name_idx" ON "pack_items" ("pack_id", "name");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pack_species_abilities" (
  "pack_id" integer NOT NULL,
  "species_id" integer NOT NULL,
  "ability_id" integer NOT NULL,
  "slot" text NOT NULL,
  PRIMARY KEY ("pack_id", "species_id", "ability_id", "slot"),
  FOREIGN KEY ("pack_id") REFERENCES "packs"("id"),
  FOREIGN KEY ("species_id") REFERENCES "pack_species"("id"),
  FOREIGN KEY ("ability_id") REFERENCES "pack_abilities"("id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "games" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "pack_id" integer NOT NULL,
  "name" text NOT NULL,
  "notes" text,
  FOREIGN KEY ("pack_id") REFERENCES "packs"("id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "games_name_idx" ON "games" ("name");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_species" (
  "game_id" integer NOT NULL,
  "species_id" integer NOT NULL,
  PRIMARY KEY ("game_id", "species_id"),
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("species_id") REFERENCES "pack_species"("id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_abilities" (
  "game_id" integer NOT NULL,
  "ability_id" integer NOT NULL,
  PRIMARY KEY ("game_id", "ability_id"),
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("ability_id") REFERENCES "pack_abilities"("id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_items" (
  "game_id" integer NOT NULL,
  "item_id" integer NOT NULL,
  PRIMARY KEY ("game_id", "item_id"),
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("item_id") REFERENCES "pack_items"("id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_species_overrides" (
  "game_id" integer NOT NULL,
  "species_id" integer NOT NULL,
  "type1_id" integer,
  "type2_id" integer,
  "hp" integer,
  "atk" integer,
  "def" integer,
  "spa" integer,
  "spd" integer,
  "spe" integer,
  PRIMARY KEY ("game_id", "species_id"),
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("species_id") REFERENCES "pack_species"("id"),
  FOREIGN KEY ("type1_id") REFERENCES "pack_types"("id"),
  FOREIGN KEY ("type2_id") REFERENCES "pack_types"("id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "game_species_abilities" (
  "game_id" integer NOT NULL,
  "species_id" integer NOT NULL,
  "ability_id" integer NOT NULL,
  "slot" text NOT NULL,
  PRIMARY KEY ("game_id", "species_id", "ability_id", "slot"),
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("species_id") REFERENCES "pack_species"("id"),
  FOREIGN KEY ("ability_id") REFERENCES "pack_abilities"("id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "box_pokemon" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "game_id" integer NOT NULL,
  "species_id" integer NOT NULL,
  "ability_id" integer,
  "item_id" integer,
  "nickname" text,
  "notes" text,
  FOREIGN KEY ("game_id") REFERENCES "games"("id"),
  FOREIGN KEY ("species_id") REFERENCES "pack_species"("id"),
  FOREIGN KEY ("ability_id") REFERENCES "pack_abilities"("id"),
  FOREIGN KEY ("item_id") REFERENCES "pack_items"("id")
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

CREATE TABLE IF NOT EXISTS "settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL
);