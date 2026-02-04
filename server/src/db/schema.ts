import { sqliteTable, text, integer, real, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";

export const packs = sqliteTable(
  "packs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    description: text("description"),
    useSingleSpecial: integer("use_single_special").notNull().default(0)
  },
  (t) => ({
    nameIdx: uniqueIndex("packs_name_idx").on(t.name)
  })
);

export const packTypes = sqliteTable(
  "pack_types",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    packId: integer("pack_id").notNull().references(() => packs.id),
    name: text("name").notNull(),
    metadata: text("metadata"),
    color: text("color"),
    excludeInChart: integer("exclude_in_chart").notNull().default(0)
  },
  (t) => ({
    packTypeIdx: uniqueIndex("pack_types_pack_name_idx").on(t.packId, t.name)
  })
);

export const packTypeEffectiveness = sqliteTable(
  "pack_type_effectiveness",
  {
    packId: integer("pack_id").notNull().references(() => packs.id),
    attackingTypeId: integer("attacking_type_id").notNull().references(() => packTypes.id),
    defendingTypeId: integer("defending_type_id").notNull().references(() => packTypes.id),
    multiplier: real("multiplier").notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.packId, t.attackingTypeId, t.defendingTypeId] })
  })
);

export const packSpecies = sqliteTable(
  "pack_species",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    packId: integer("pack_id").notNull().references(() => packs.id),
    dexNumber: integer("dex_number").notNull().default(1),
    name: text("name").notNull(),
    type1Id: integer("type1_id").notNull().references(() => packTypes.id),
    type2Id: integer("type2_id").references(() => packTypes.id),
    hp: integer("hp").notNull(),
    atk: integer("atk").notNull(),
    def: integer("def").notNull(),
    spa: integer("spa").notNull(),
    spd: integer("spd").notNull(),
    spe: integer("spe").notNull()
  },
  (t) => ({
    packSpeciesIdx: uniqueIndex("pack_species_pack_name_idx").on(t.packId, t.name)
  })
);

export const packAbilities = sqliteTable(
  "pack_abilities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    packId: integer("pack_id").notNull().references(() => packs.id),
    name: text("name").notNull(),
    tags: text("tags").notNull().default("[]")
  },
  (t) => ({
    packAbilityIdx: uniqueIndex("pack_abilities_pack_name_idx").on(t.packId, t.name)
  })
);

export const packItems = sqliteTable(
  "pack_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    packId: integer("pack_id").notNull().references(() => packs.id),
    name: text("name").notNull(),
    tags: text("tags").notNull().default("[]")
  },
  (t) => ({
    packItemIdx: uniqueIndex("pack_items_pack_name_idx").on(t.packId, t.name)
  })
);

export const packSpeciesAbilities = sqliteTable(
  "pack_species_abilities",
  {
    packId: integer("pack_id").notNull().references(() => packs.id),
    speciesId: integer("species_id").notNull().references(() => packSpecies.id),
    abilityId: integer("ability_id").notNull().references(() => packAbilities.id),
    slot: text("slot").notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.packId, t.speciesId, t.abilityId, t.slot] })
  })
);

export const packSpeciesEvolutions = sqliteTable(
  "pack_species_evolutions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    packId: integer("pack_id").notNull().references(() => packs.id),
    fromSpeciesId: integer("from_species_id").notNull().references(() => packSpecies.id),
    toSpeciesId: integer("to_species_id").notNull().references(() => packSpecies.id),
    method: text("method").notNull()
  },
  (t) => ({
    packEvoIdx: uniqueIndex("pack_species_evo_pack_from_to_method_idx").on(
      t.packId,
      t.fromSpeciesId,
      t.toSpeciesId,
      t.method
    )
  })
);

export const games = sqliteTable(
  "games",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    packId: integer("pack_id").notNull().references(() => packs.id),
    name: text("name").notNull(),
    notes: text("notes"),
    disableAbilities: integer("disable_abilities").notNull().default(0),
    disableHeldItems: integer("disable_held_items").notNull().default(0)
  },
  (t) => ({
    nameIdx: uniqueIndex("games_name_idx").on(t.name)
  })
);

export const gameSpecies = sqliteTable(
  "game_species",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    speciesId: integer("species_id").notNull().references(() => packSpecies.id)
  },
  (t) => ({
    pk: primaryKey({ columns: [t.gameId, t.speciesId] })
  })
);

export const gameAbilities = sqliteTable(
  "game_abilities",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    abilityId: integer("ability_id").notNull().references(() => packAbilities.id)
  },
  (t) => ({
    pk: primaryKey({ columns: [t.gameId, t.abilityId] })
  })
);

export const gameItems = sqliteTable(
  "game_items",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    itemId: integer("item_id").notNull().references(() => packItems.id)
  },
  (t) => ({
    pk: primaryKey({ columns: [t.gameId, t.itemId] })
  })
);

export const gameSpeciesOverrides = sqliteTable(
  "game_species_overrides",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    speciesId: integer("species_id").notNull().references(() => packSpecies.id),
    type1Id: integer("type1_id").references(() => packTypes.id),
    type2Id: integer("type2_id").references(() => packTypes.id),
    hp: integer("hp"),
    atk: integer("atk"),
    def: integer("def"),
    spa: integer("spa"),
    spd: integer("spd"),
    spe: integer("spe")
  },
  (t) => ({
    pk: primaryKey({ columns: [t.gameId, t.speciesId] })
  })
);

export const gameSpeciesAbilities = sqliteTable(
  "game_species_abilities",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    speciesId: integer("species_id").notNull().references(() => packSpecies.id),
    abilityId: integer("ability_id").notNull().references(() => packAbilities.id),
    slot: text("slot").notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.gameId, t.speciesId, t.abilityId, t.slot] })
  })
);

export const boxPokemon = sqliteTable(
  "box_pokemon",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull().references(() => games.id),
    speciesId: integer("species_id").notNull().references(() => packSpecies.id),
    abilityId: integer("ability_id").references(() => packAbilities.id),
    itemId: integer("item_id").references(() => packItems.id),
    nickname: text("nickname")
  }
);

export const trackedBox = sqliteTable(
  "tracked_box",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull().references(() => games.id),
    speciesId: integer("species_id").notNull().references(() => packSpecies.id),
    abilityId: integer("ability_id").references(() => packAbilities.id),
    itemId: integer("item_id").references(() => packItems.id),
    nickname: text("nickname")
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
