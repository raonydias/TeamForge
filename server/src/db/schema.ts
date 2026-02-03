import { sqliteTable, text, integer, real, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";

export const types = sqliteTable(
  "types",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    metadata: text("metadata")
  },
  (t) => ({
    nameIdx: uniqueIndex("types_name_idx").on(t.name)
  })
);

export const typeEffectiveness = sqliteTable(
  "type_effectiveness",
  {
    attackingTypeId: integer("attacking_type_id").notNull().references(() => types.id),
    defendingTypeId: integer("defending_type_id").notNull().references(() => types.id),
    multiplier: real("multiplier").notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.attackingTypeId, t.defendingTypeId] })
  })
);

export const species = sqliteTable(
  "species",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    type1Id: integer("type1_id").notNull().references(() => types.id),
    type2Id: integer("type2_id").references(() => types.id),
    hp: integer("hp").notNull(),
    atk: integer("atk").notNull(),
    def: integer("def").notNull(),
    spa: integer("spa").notNull(),
    spd: integer("spd").notNull(),
    spe: integer("spe").notNull()
  },
  (t) => ({
    nameIdx: uniqueIndex("species_name_idx").on(t.name)
  })
);

export const abilities = sqliteTable(
  "abilities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    tags: text("tags").notNull().default("[]")
  },
  (t) => ({
    nameIdx: uniqueIndex("abilities_name_idx").on(t.name)
  })
);

export const items = sqliteTable(
  "items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    tags: text("tags").notNull().default("[]")
  },
  (t) => ({
    nameIdx: uniqueIndex("items_name_idx").on(t.name)
  })
);

export const games = sqliteTable(
  "games",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    notes: text("notes")
  },
  (t) => ({
    nameIdx: uniqueIndex("games_name_idx").on(t.name)
  })
);

export const gameSpecies = sqliteTable(
  "game_species",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    speciesId: integer("species_id").notNull().references(() => species.id)
  },
  (t) => ({
    pk: primaryKey({ columns: [t.gameId, t.speciesId] })
  })
);

export const gameAbilities = sqliteTable(
  "game_abilities",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    abilityId: integer("ability_id").notNull().references(() => abilities.id)
  },
  (t) => ({
    pk: primaryKey({ columns: [t.gameId, t.abilityId] })
  })
);

export const gameItems = sqliteTable(
  "game_items",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    itemId: integer("item_id").notNull().references(() => items.id)
  },
  (t) => ({
    pk: primaryKey({ columns: [t.gameId, t.itemId] })
  })
);

export const boxPokemon = sqliteTable(
  "box_pokemon",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull().references(() => games.id),
    speciesId: integer("species_id").notNull().references(() => species.id),
    abilityId: integer("ability_id").references(() => abilities.id),
    itemId: integer("item_id").references(() => items.id),
    nickname: text("nickname"),
    notes: text("notes")
  }
);

export const teamSlots = sqliteTable(
  "team_slots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull().references(() => games.id),
    slotIndex: integer("slot_index").notNull(),
    boxPokemonId: integer("box_pokemon_id").references(() => boxPokemon.id)
  },
  (t) => ({
    uniqueSlot: uniqueIndex("team_slots_game_slot_idx").on(t.gameId, t.slotIndex)
  })
);

export const settings = sqliteTable(
  "settings",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull()
  }
);