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
    baseSpeciesId: integer("base_species_id").references(() => packSpecies.id),
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

export const packImports = sqliteTable(
  "pack_imports",
  {
    packId: integer("pack_id").notNull().references(() => packs.id),
    importPackId: integer("import_pack_id").notNull().references(() => packs.id),
    sortOrder: integer("sort_order").notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.packId, t.importPackId] }),
    orderIdx: uniqueIndex("pack_imports_pack_sort_idx").on(t.packId, t.sortOrder)
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
    name: text("name").notNull(),
    notes: text("notes"),
    disableAbilities: integer("disable_abilities").notNull().default(0),
    disableHeldItems: integer("disable_held_items").notNull().default(0)
  },
  (t) => ({
    nameIdx: uniqueIndex("games_name_idx").on(t.name)
  })
);

export const gamePacks = sqliteTable(
  "game_packs",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    packId: integer("pack_id").notNull().references(() => packs.id),
    sortOrder: integer("sort_order").notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.gameId, t.packId] }),
    orderIdx: uniqueIndex("game_packs_game_sort_idx").on(t.gameId, t.sortOrder)
  })
);

export const gameTypes = sqliteTable(
  "game_types",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull().references(() => games.id),
    name: text("name").notNull(),
    metadata: text("metadata"),
    color: text("color"),
    excludeInChart: integer("exclude_in_chart").notNull().default(0)
  },
  (t) => ({
    gameTypeIdx: uniqueIndex("game_types_game_name_idx").on(t.gameId, t.name)
  })
);

export const gameTypeEffectiveness = sqliteTable(
  "game_type_effectiveness",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    attackingTypeId: integer("attacking_type_id").notNull().references(() => gameTypes.id),
    defendingTypeId: integer("defending_type_id").notNull().references(() => gameTypes.id),
    multiplier: real("multiplier").notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.gameId, t.attackingTypeId, t.defendingTypeId] })
  })
);

export const gameSpecies = sqliteTable(
  "game_species",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull().references(() => games.id),
    dexNumber: integer("dex_number").notNull().default(1),
    baseSpeciesId: integer("base_species_id").references(() => gameSpecies.id),
    name: text("name").notNull(),
    type1Id: integer("type1_id").notNull().references(() => gameTypes.id),
    type2Id: integer("type2_id").references(() => gameTypes.id),
    hp: integer("hp").notNull(),
    atk: integer("atk").notNull(),
    def: integer("def").notNull(),
    spa: integer("spa").notNull(),
    spd: integer("spd").notNull(),
    spe: integer("spe").notNull()
  },
  (t) => ({
    gameSpeciesIdx: uniqueIndex("game_species_game_name_idx").on(t.gameId, t.name)
  })
);

export const gameAbilities = sqliteTable(
  "game_abilities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull().references(() => games.id),
    name: text("name").notNull(),
    tags: text("tags").notNull().default("[]")
  },
  (t) => ({
    gameAbilityIdx: uniqueIndex("game_abilities_game_name_idx").on(t.gameId, t.name)
  })
);

export const gameItems = sqliteTable(
  "game_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull().references(() => games.id),
    name: text("name").notNull(),
    tags: text("tags").notNull().default("[]")
  },
  (t) => ({
    gameItemIdx: uniqueIndex("game_items_game_name_idx").on(t.gameId, t.name)
  })
);

export const gameSpeciesAbilities = sqliteTable(
  "game_species_abilities",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    speciesId: integer("species_id").notNull().references(() => gameSpecies.id),
    abilityId: integer("ability_id").notNull().references(() => gameAbilities.id),
    slot: text("slot").notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.gameId, t.speciesId, t.abilityId, t.slot] })
  })
);

export const gameSpeciesEvolutions = sqliteTable(
  "game_species_evolutions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull().references(() => games.id),
    fromSpeciesId: integer("from_species_id").notNull().references(() => gameSpecies.id),
    toSpeciesId: integer("to_species_id").notNull().references(() => gameSpecies.id),
    method: text("method").notNull()
  },
  (t) => ({
    gameEvoIdx: uniqueIndex("game_species_evo_game_from_to_method_idx").on(
      t.gameId,
      t.fromSpeciesId,
      t.toSpeciesId,
      t.method
    )
  })
);

export const gameAllowedSpecies = sqliteTable(
  "game_allowed_species",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    speciesId: integer("species_id").notNull().references(() => gameSpecies.id)
  },
  (t) => ({
    pk: primaryKey({ columns: [t.gameId, t.speciesId] })
  })
);

export const gameAllowedAbilities = sqliteTable(
  "game_allowed_abilities",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    abilityId: integer("ability_id").notNull().references(() => gameAbilities.id)
  },
  (t) => ({
    pk: primaryKey({ columns: [t.gameId, t.abilityId] })
  })
);

export const gameAllowedItems = sqliteTable(
  "game_allowed_items",
  {
    gameId: integer("game_id").notNull().references(() => games.id),
    itemId: integer("item_id").notNull().references(() => gameItems.id)
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
    speciesId: integer("species_id").notNull().references(() => gameSpecies.id),
    abilityId: integer("ability_id").references(() => gameAbilities.id),
    itemId: integer("item_id").references(() => gameItems.id),
    nickname: text("nickname")
  }
);

export const trackedBox = sqliteTable(
  "tracked_box",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull().references(() => games.id),
    speciesId: integer("species_id").notNull().references(() => gameSpecies.id),
    abilityId: integer("ability_id").references(() => gameAbilities.id),
    itemId: integer("item_id").references(() => gameItems.id),
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
