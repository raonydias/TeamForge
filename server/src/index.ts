import express from "express";
import cors from "cors";
import { and, eq, inArray, like, or } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db/index.js";
import {
  packs,
  packTypes,
  packTypeEffectiveness,
  packSpecies,
  packAbilities,
  packItems,
  packImports,
  packSpeciesAbilities,
  packSpeciesEvolutions,
  games,
  gamePacks,
  gameTypes,
  gameTypeEffectiveness,
  gameSpecies,
  gameAbilities,
  gameItems,
  gameSpeciesAbilities,
  gameSpeciesEvolutions,
  gameAllowedSpecies,
  gameAllowedAbilities,
  gameAllowedItems,
  boxPokemon,
  trackedBox,
  teamSlots,
} from "./db/schema.js";
import { computePotentials, computeTeamChart, computeDefenseMatrix, parseTags } from "./scoring.js";
import { z } from "zod";
import { sql } from "drizzle-orm";

const app = express();
app.use(cors());
app.use(express.json());

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, "..", "drizzle");
migrate(db, { migrationsFolder });

const idSchema = z.coerce.number().int().positive();

const packSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  useSingleSpecial: z.boolean().optional().nullable(),
  importPackIds: z.array(idSchema).optional().default([])
});

const typeSchema = z.object({
  name: z.string().min(1),
  metadata: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  excludeInChart: z.boolean().optional().nullable()
});

const typeChartSchema = z.object({
  attackingTypeId: idSchema,
  defendingTypeId: idSchema,
  multiplier: z.number().min(0).max(4)
});

const typeChartImportSchema = z.object({
  types: z.array(
    z.object({
      name: z.string().min(1),
      metadata: z.string().optional().nullable(),
      color: z.string().optional().nullable(),
      excludeInChart: z.boolean().optional().nullable()
    })
  ),
  chart: z.array(
    z.object({
      attackingTypeName: z.string().min(1),
      defendingTypeName: z.string().min(1),
      multiplier: z.number().min(0).max(4)
    })
  )
});

const speciesSchema = z.object({
  dexNumber: z.coerce.number().int().min(1),
  baseSpeciesId: idSchema.optional().nullable(),
  name: z.string().min(1),
  type1Id: idSchema,
  type2Id: idSchema.optional().nullable(),
  hp: z.number().int().min(1),
  atk: z.number().int().min(1),
  def: z.number().int().min(1),
  spa: z.number().int().min(1),
  spd: z.number().int().min(1),
  spe: z.number().int().min(1)
});

const tagSchema = z.object({
  name: z.string().min(1),
  tags: z.array(z.string()).default([])
});

const speciesAbilitiesSchema = z.object({
  speciesId: idSchema,
  slots: z.array(
    z.object({
      abilityId: idSchema,
      slot: z.enum(["1", "2", "H"])
    })
  )
});

const speciesEvolutionSchema = z.object({
  fromSpeciesId: idSchema,
  toSpeciesId: idSchema,
  method: z.string().min(1)
});

const speciesImportSchema = z.object({
  mode: z.enum(["replace", "merge"]).optional().default("replace"),
  species: z.array(
    z.object({
      dexNumber: z.coerce.number().int().min(1),
      name: z.string().min(1),
      baseSpeciesName: z.string().optional().nullable(),
      type1Name: z.string().min(1),
      type2Name: z.string().optional().nullable(),
      hp: z.number().int().min(1),
      atk: z.number().int().min(1),
      def: z.number().int().min(1),
      spa: z.number().int().min(1),
      spd: z.number().int().min(1),
      spe: z.number().int().min(1)
    })
  ),
  abilities: z
    .array(
      z.object({
        speciesName: z.string().min(1),
        abilityName: z.string().min(1),
        slot: z.enum(["1", "2", "H"])
      })
    )
    .optional()
    .default([]),
  evolutions: z
    .array(
      z.object({
        fromSpeciesName: z.string().min(1),
        toSpeciesName: z.string().min(1),
        method: z.string().min(1)
      })
    )
    .optional()
    .default([])
});

const gameCreateSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional().nullable(),
  packIds: z.array(idSchema).min(1),
  disableAbilities: z.boolean().optional().nullable(),
  disableHeldItems: z.boolean().optional().nullable(),
  critStagePreset: z.enum(["gen2", "gen3_5", "gen6", "gen7"]).optional().nullable(),
  critBaseDamageMult: z.coerce.number().min(0).optional().nullable()
});

const gameUpdateSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional().nullable(),
  disableAbilities: z.boolean().optional().nullable(),
  disableHeldItems: z.boolean().optional().nullable(),
  critStagePreset: z.enum(["gen2", "gen3_5", "gen6", "gen7"]).optional().nullable(),
  critBaseDamageMult: z.coerce.number().min(0).optional().nullable()
});

const allowedSchema = z.object({
  ids: z.array(idSchema)
});

const boxSchema = z.object({
  speciesId: idSchema,
  abilityId: idSchema.optional().nullable(),
  itemId: idSchema.optional().nullable(),
  nickname: z.string().optional().nullable()
});

const evolveSchema = z.object({
  toSpeciesId: idSchema
});

const teamSchema = z.object({
  slots: z.array(
    z.object({
      slotIndex: z.number().int().min(1).max(6),
      boxPokemonId: idSchema.optional().nullable()
    })
  )
});

const teamPreviewSchema = z.object({
  slots: z
    .array(
      z.object({
        slotIndex: z.number().int().min(1).max(6),
        boxPokemonId: idSchema.optional().nullable()
      })
    )
    .optional()
});

async function getPackTypesMap(packId: number) {
  const typesList = await db.select().from(packTypes).where(eq(packTypes.packId, packId));
  const map = new Map(typesList.map((t) => [t.id, t.name]));
  return { typesList, typeNameById: map };
}

async function getGameTypesMap(gameId: number) {
  const typesList = await db.select().from(gameTypes).where(eq(gameTypes.gameId, gameId));
  const map = new Map(typesList.map((t) => [t.id, t.name]));
  return { typesList, typeNameById: map };
}

async function getPackById(packId: number) {
  const [row] = await db.select().from(packs).where(eq(packs.id, packId)).limit(1);
  if (!row) return null;
  return { ...row, useSingleSpecial: !!row.useSingleSpecial };
}

async function getPackImportChainAsync(packId: number, cache = new Map<number, number[]>(), visiting = new Set<number>()) {
  if (cache.has(packId)) return cache.get(packId)!;
  if (visiting.has(packId)) return [];
  visiting.add(packId);
  const rows = await db
    .select()
    .from(packImports)
    .where(eq(packImports.packId, packId))
    .orderBy(packImports.sortOrder);
  const result: number[] = [];
  for (const row of rows) {
    const sub = await getPackImportChainAsync(row.importPackId, cache, visiting);
    for (const id of sub) {
      if (!result.includes(id)) result.push(id);
    }
    if (!result.includes(row.importPackId)) result.push(row.importPackId);
  }
  visiting.delete(packId);
  cache.set(packId, result);
  return result;
}

function applySpeciesOverride(base: any, override: any | null) {
  return {
    ...base,
    type1Id: override?.type1Id ?? base.type1Id,
    type2Id: override?.type2Id ?? base.type2Id,
    hp: override?.hp ?? base.hp,
    atk: override?.atk ?? base.atk,
    def: override?.def ?? base.def,
    spa: override?.spa ?? base.spa,
    spd: override?.spd ?? base.spd,
    spe: override?.spe ?? base.spe
  };
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function buildPackImportChain(
  tx: any,
  packId: number,
  cache: Map<number, number[]>,
  visiting: Set<number>
) {
  if (cache.has(packId)) return cache.get(packId)!;
  if (visiting.has(packId)) return [];
  visiting.add(packId);
  const rows = tx
    .select()
    .from(packImports)
    .where(eq(packImports.packId, packId))
    .orderBy(packImports.sortOrder)
    .all();
  const result: number[] = [];
  for (const row of rows) {
    const sub = buildPackImportChain(tx, row.importPackId, cache, visiting);
    for (const id of sub) {
      if (!result.includes(id)) result.push(id);
    }
    if (!result.includes(row.importPackId)) result.push(row.importPackId);
  }
  visiting.delete(packId);
  cache.set(packId, result);
  return result;
}

async function getGameUseSingleSpecial(gameId: number) {
  const rows = await db
    .select({ useSingleSpecial: packs.useSingleSpecial })
    .from(gamePacks)
    .innerJoin(packs, eq(gamePacks.packId, packs.id))
    .where(eq(gamePacks.gameId, gameId))
    .orderBy(sql`${gamePacks.sortOrder} desc`)
    .limit(1);
  return rows.length > 0 ? !!rows[0].useSingleSpecial : false;
}

async function syncGameItems(gameId: number) {
  const packRows = await db
    .select({ packId: gamePacks.packId })
    .from(gamePacks)
    .where(eq(gamePacks.gameId, gameId))
    .orderBy(gamePacks.sortOrder);
  const packIds = packRows.map((row) => row.packId);
  if (packIds.length === 0) return;

  const importCache = new Map<number, number[]>();
  const importChains = new Map<number, number[]>();
  for (const packId of packIds) {
    const chain = await getPackImportChainAsync(packId, importCache, new Set<number>());
    importChains.set(packId, chain);
  }

  const sourcePackIds = Array.from(
    new Set(packIds.flatMap((packId) => [...(importChains.get(packId) ?? []), packId]))
  );
  const packItemsRows = sourcePackIds.length
    ? await db.select().from(packItems).where(inArray(packItems.packId, sourcePackIds))
    : [];
  const packItemsByPack = new Map<number, typeof packItemsRows>();
  for (const row of packItemsRows) {
    if (!packItemsByPack.has(row.packId)) packItemsByPack.set(row.packId, []);
    packItemsByPack.get(row.packId)!.push(row);
  }

  const resolvedItems = new Map<string, { name: string; tags: string }>();
  for (const packId of packIds) {
    const itemEffective = new Map<string, { name: string; tags: string }>();
    for (const importPackId of importChains.get(packId) ?? []) {
      for (const row of packItemsByPack.get(importPackId) ?? []) {
        itemEffective.set(normalizeKey(row.name), { name: row.name, tags: row.tags ?? "[]" });
      }
    }
    for (const row of packItemsByPack.get(packId) ?? []) {
      itemEffective.set(normalizeKey(row.name), { name: row.name, tags: row.tags ?? "[]" });
    }
    for (const [key, row] of itemEffective.entries()) {
      resolvedItems.set(key, row);
    }
  }

  const existing = await db.select().from(gameItems).where(eq(gameItems.gameId, gameId));
  const existingByKey = new Map(existing.map((row) => [normalizeKey(row.name), row]));

  for (const [key, row] of resolvedItems.entries()) {
    const current = existingByKey.get(key);
    if (!current) {
      await db
        .insert(gameItems)
        .values({ gameId, name: row.name, tags: row.tags ?? "[]" })
        .run();
      continue;
    }
    if (current.name !== row.name || current.tags !== row.tags) {
      await db
        .update(gameItems)
        .set({ name: row.name, tags: row.tags ?? "[]" })
        .where(eq(gameItems.id, current.id))
        .run();
    }
  }
}

async function syncGameSpeciesAbilities(gameId: number) {
  await syncGameAbilities(gameId);
  const packRows = await db
    .select({ packId: gamePacks.packId })
    .from(gamePacks)
    .where(eq(gamePacks.gameId, gameId))
    .orderBy(gamePacks.sortOrder);
  const packIds = packRows.map((row) => row.packId);
  if (packIds.length === 0) return;

  const importCache = new Map<number, number[]>();
  const importChains = new Map<number, number[]>();
  for (const packId of packIds) {
    const chain = await getPackImportChainAsync(packId, importCache, new Set<number>());
    importChains.set(packId, chain);
  }

  const sourcePackIds = Array.from(
    new Set(packIds.flatMap((packId) => [...(importChains.get(packId) ?? []), packId]))
  );

  const packSpeciesRows = await db.select().from(packSpecies).where(inArray(packSpecies.packId, packIds));
  const packAbilitiesRows = sourcePackIds.length
    ? await db.select().from(packAbilities).where(inArray(packAbilities.packId, sourcePackIds))
    : [];
  const packSpeciesAbilitiesRows = await db
    .select()
    .from(packSpeciesAbilities)
    .where(inArray(packSpeciesAbilities.packId, packIds));

  const speciesNameByPackId = new Map<string, string>();
  for (const row of packSpeciesRows) {
    speciesNameByPackId.set(`${row.packId}:${row.id}`, row.name);
  }

  const abilityNameById = new Map<number, string>();
  for (const row of packAbilitiesRows) {
    abilityNameById.set(row.id, row.name);
  }

  const abilitiesByPack = new Map<number, Map<string, { abilityName: string; slot: string }[]>>();
  for (const row of packSpeciesAbilitiesRows) {
    const speciesName = speciesNameByPackId.get(`${row.packId}:${row.speciesId}`);
    const abilityName = abilityNameById.get(row.abilityId);
    if (!speciesName || !abilityName) continue;
    if (!abilitiesByPack.has(row.packId)) abilitiesByPack.set(row.packId, new Map());
    const bySpecies = abilitiesByPack.get(row.packId)!;
    if (!bySpecies.has(speciesName)) bySpecies.set(speciesName, []);
    bySpecies.get(speciesName)!.push({ abilityName, slot: row.slot });
  }

  const resolved = new Map<string, { abilityName: string; slot: string }[]>();
  for (const packId of packIds) {
    const bySpecies = abilitiesByPack.get(packId);
    if (!bySpecies) continue;
    for (const [speciesName, entries] of bySpecies.entries()) {
      resolved.set(speciesName, entries);
    }
  }

  const gameSpeciesRows = await db.select().from(gameSpecies).where(eq(gameSpecies.gameId, gameId));
  const gameAbilitiesRows = await db.select().from(gameAbilities).where(eq(gameAbilities.gameId, gameId));

  const gameSpeciesByName = new Map(gameSpeciesRows.map((row) => [normalizeKey(row.name), row.id]));
  const gameAbilitiesByName = new Map(gameAbilitiesRows.map((row) => [normalizeKey(row.name), row.id]));

  await db.delete(gameSpeciesAbilities).where(eq(gameSpeciesAbilities.gameId, gameId));

  for (const [speciesName, entries] of resolved.entries()) {
    const speciesId = gameSpeciesByName.get(normalizeKey(speciesName));
    if (!speciesId) continue;
    for (const entry of entries) {
      const abilityId = gameAbilitiesByName.get(normalizeKey(entry.abilityName));
      if (!abilityId) continue;
      await db
        .insert(gameSpeciesAbilities)
        .values({ gameId, speciesId, abilityId, slot: entry.slot })
        .run();
    }
  }
}

async function syncGameAbilities(gameId: number) {
  const packRows = await db
    .select({ packId: gamePacks.packId })
    .from(gamePacks)
    .where(eq(gamePacks.gameId, gameId))
    .orderBy(gamePacks.sortOrder);
  const packIds = packRows.map((row) => row.packId);
  if (packIds.length === 0) return;

  const importCache = new Map<number, number[]>();
  const importChains = new Map<number, number[]>();
  for (const packId of packIds) {
    const chain = await getPackImportChainAsync(packId, importCache, new Set<number>());
    importChains.set(packId, chain);
  }

  const sourcePackIds = Array.from(
    new Set(packIds.flatMap((packId) => [...(importChains.get(packId) ?? []), packId]))
  );
  const packAbilitiesRows = sourcePackIds.length
    ? await db.select().from(packAbilities).where(inArray(packAbilities.packId, sourcePackIds))
    : [];
  const packAbilitiesByPack = new Map<number, typeof packAbilitiesRows>();
  for (const row of packAbilitiesRows) {
    if (!packAbilitiesByPack.has(row.packId)) packAbilitiesByPack.set(row.packId, []);
    packAbilitiesByPack.get(row.packId)!.push(row);
  }

  const resolvedAbilities = new Map<string, { name: string; tags: string }>();
  for (const packId of packIds) {
    const abilityEffective = new Map<string, { name: string; tags: string }>();
    for (const importPackId of importChains.get(packId) ?? []) {
      for (const row of packAbilitiesByPack.get(importPackId) ?? []) {
        abilityEffective.set(normalizeKey(row.name), { name: row.name, tags: row.tags ?? "[]" });
      }
    }
    for (const row of packAbilitiesByPack.get(packId) ?? []) {
      abilityEffective.set(normalizeKey(row.name), { name: row.name, tags: row.tags ?? "[]" });
    }
    for (const [key, row] of abilityEffective.entries()) {
      resolvedAbilities.set(key, row);
    }
  }

  const allowedRows = await db
    .select({ name: gameAbilities.name })
    .from(gameAllowedAbilities)
    .innerJoin(gameAbilities, eq(gameAllowedAbilities.abilityId, gameAbilities.id))
    .where(eq(gameAllowedAbilities.gameId, gameId));
  const allowedNames = new Set(allowedRows.map((row) => normalizeKey(row.name)));
  const hadAllowed = allowedNames.size > 0;

  await db.delete(gameSpeciesAbilities).where(eq(gameSpeciesAbilities.gameId, gameId));
  await db.delete(gameAllowedAbilities).where(eq(gameAllowedAbilities.gameId, gameId));
  await db.delete(gameAbilities).where(eq(gameAbilities.gameId, gameId));

  const insertValues = Array.from(resolvedAbilities.values()).map((row) => ({
    gameId,
    name: row.name,
    tags: row.tags ?? "[]"
  }));
  const inserted =
    insertValues.length > 0 ? await db.insert(gameAbilities).values(insertValues).returning() : [];

  if (hadAllowed && inserted.length > 0) {
    const idByName = new Map(inserted.map((row) => [normalizeKey(row.name), row.id]));
    const allowedIds = Array.from(allowedNames)
      .map((name) => idByName.get(name))
      .filter((id): id is number => typeof id === "number");
    if (allowedIds.length > 0) {
      await db
        .insert(gameAllowedAbilities)
        .values(allowedIds.map((abilityId) => ({ gameId, abilityId })));
    }
  }
}

function buildGameData(tx: any, gameId: number, packIds: number[]) {
  const packTypesRows = tx.select().from(packTypes).where(inArray(packTypes.packId, packIds)).all();

  const importCache = new Map<number, number[]>();
  const importChains = new Map<number, number[]>();
  for (const packId of packIds) {
    const chain = buildPackImportChain(tx, packId, importCache, new Set<number>());
    importChains.set(packId, chain);
  }

  const abilitySourcePackIds = Array.from(
    new Set(packIds.flatMap((packId) => [...(importChains.get(packId) ?? []), packId]))
  );
  const packAbilitiesRows = abilitySourcePackIds.length
    ? tx.select().from(packAbilities).where(inArray(packAbilities.packId, abilitySourcePackIds)).all()
    : [];

  const packItemsRows = abilitySourcePackIds.length
    ? tx.select().from(packItems).where(inArray(packItems.packId, abilitySourcePackIds)).all()
    : [];
  const packSpeciesRows = tx.select().from(packSpecies).where(inArray(packSpecies.packId, packIds)).all();
  const packSpeciesAbilitiesRows = tx
    .select()
    .from(packSpeciesAbilities)
    .where(inArray(packSpeciesAbilities.packId, packIds))
    .all();
  const packSpeciesEvoRows = tx
    .select()
    .from(packSpeciesEvolutions)
    .where(inArray(packSpeciesEvolutions.packId, packIds))
    .all();
  const packChartRows = tx
    .select()
    .from(packTypeEffectiveness)
    .where(inArray(packTypeEffectiveness.packId, packIds))
    .all();

  const packTypesByPack = new Map<number, typeof packTypesRows>();
  const packAbilitiesByPack = new Map<number, typeof packAbilitiesRows>();
  const packItemsByPack = new Map<number, typeof packItemsRows>();
  const packSpeciesByPack = new Map<number, typeof packSpeciesRows>();
  const packSpeciesById = new Map<string, (typeof packSpeciesRows)[number]>();
  const typeKeyByPackId = new Map<string, string>();
  const abilityKeyByPackId = new Map<string, string>();
  const itemKeyByPackId = new Map<string, string>();
  const abilityNameById = new Map<number, string>();

  for (const row of packTypesRows) {
    if (!packTypesByPack.has(row.packId)) packTypesByPack.set(row.packId, []);
    packTypesByPack.get(row.packId)!.push(row);
    typeKeyByPackId.set(`${row.packId}:${row.id}`, normalizeKey(row.name));
  }

  for (const row of packAbilitiesRows) {
    if (!packAbilitiesByPack.has(row.packId)) packAbilitiesByPack.set(row.packId, []);
    packAbilitiesByPack.get(row.packId)!.push(row);
    abilityKeyByPackId.set(`${row.packId}:${row.id}`, normalizeKey(row.name));
    abilityNameById.set(row.id, row.name);
  }

  for (const row of packItemsRows) {
    if (!packItemsByPack.has(row.packId)) packItemsByPack.set(row.packId, []);
    packItemsByPack.get(row.packId)!.push(row);
    itemKeyByPackId.set(`${row.packId}:${row.id}`, normalizeKey(row.name));
  }

  for (const row of packSpeciesRows) {
    if (!packSpeciesByPack.has(row.packId)) packSpeciesByPack.set(row.packId, []);
    packSpeciesByPack.get(row.packId)!.push(row);
    packSpeciesById.set(`${row.packId}:${row.id}`, row);
  }

  const resolvedTypes = new Map<string, { name: string; metadata: string | null; color: string | null; excludeInChart: number }>();
  const resolvedAbilities = new Map<string, { name: string; tags: string }>();
  const resolvedItems = new Map<string, { name: string; tags: string }>();

  for (const packId of packIds) {
    for (const row of packTypesByPack.get(packId) ?? []) {
      resolvedTypes.set(normalizeKey(row.name), {
        name: row.name,
        metadata: row.metadata ?? null,
        color: row.color ?? null,
        excludeInChart: row.excludeInChart ?? 0
      });
    }

    const abilityEffective = new Map<string, { name: string; tags: string }>();
    for (const importPackId of importChains.get(packId) ?? []) {
      for (const row of packAbilitiesByPack.get(importPackId) ?? []) {
        abilityEffective.set(normalizeKey(row.name), {
          name: row.name,
          tags: row.tags ?? "[]"
        });
      }
    }
    for (const row of packAbilitiesByPack.get(packId) ?? []) {
      abilityEffective.set(normalizeKey(row.name), {
        name: row.name,
        tags: row.tags ?? "[]"
      });
    }
    for (const [key, row] of abilityEffective.entries()) {
      resolvedAbilities.set(key, row);
    }

    const itemEffective = new Map<string, { name: string; tags: string }>();
    for (const importPackId of importChains.get(packId) ?? []) {
      for (const row of packItemsByPack.get(importPackId) ?? []) {
        itemEffective.set(normalizeKey(row.name), {
          name: row.name,
          tags: row.tags ?? "[]"
        });
      }
    }
    for (const row of packItemsByPack.get(packId) ?? []) {
      itemEffective.set(normalizeKey(row.name), {
        name: row.name,
        tags: row.tags ?? "[]"
      });
    }
    for (const [key, row] of itemEffective.entries()) {
      resolvedItems.set(key, row);
    }
  }

  const resolvedSpecies = new Map<
    string,
    {
      name: string;
      dexNumber: number;
      baseSpeciesKey: string | null;
      type1Key: string;
      type2Key: string | null;
      hp: number;
      atk: number;
      def: number;
      spa: number;
      spd: number;
      spe: number;
      sourcePackId: number;
      sourceSpeciesId: number;
    }
  >();

  for (const packId of packIds) {
    for (const row of packSpeciesByPack.get(packId) ?? []) {
      const baseRow = row.baseSpeciesId ? packSpeciesById.get(`${packId}:${row.baseSpeciesId}`) : null;
      const baseSpeciesKey = baseRow ? normalizeKey(baseRow.name) : null;
      const type1Key = typeKeyByPackId.get(`${packId}:${row.type1Id}`);
      if (!type1Key) continue;
      const type2Key = row.type2Id ? typeKeyByPackId.get(`${packId}:${row.type2Id}`) ?? null : null;
      resolvedSpecies.set(normalizeKey(row.name), {
        name: row.name,
        dexNumber: row.dexNumber,
        baseSpeciesKey,
        type1Key,
        type2Key,
        hp: row.hp,
        atk: row.atk,
        def: row.def,
        spa: row.spa,
        spd: row.spd,
        spe: row.spe,
        sourcePackId: packId,
        sourceSpeciesId: row.id
      });
    }
  }

  const gameTypeIdByKey = new Map<string, number>();
  for (const [key, row] of resolvedTypes.entries()) {
    const inserted = tx
      .insert(gameTypes)
      .values({
        gameId,
        name: row.name,
        metadata: row.metadata ?? null,
        color: row.color ?? null,
        excludeInChart: row.excludeInChart ?? 0
      })
      .returning()
      .get();
    gameTypeIdByKey.set(key, inserted.id);
  }

  const gameAbilityIdByKey = new Map<string, number>();
  for (const [key, row] of resolvedAbilities.entries()) {
    const inserted = tx
      .insert(gameAbilities)
      .values({
        gameId,
        name: row.name,
        tags: row.tags ?? "[]"
      })
      .returning()
      .get();
    gameAbilityIdByKey.set(key, inserted.id);
  }

  const gameItemIdByKey = new Map<string, number>();
  for (const [key, row] of resolvedItems.entries()) {
    const inserted = tx
      .insert(gameItems)
      .values({
        gameId,
        name: row.name,
        tags: row.tags ?? "[]"
      })
      .returning()
      .get();
    gameItemIdByKey.set(key, inserted.id);
  }

  const resolvedSpeciesList = Array.from(resolvedSpecies.entries()).map(([key, row]) => ({ key, ...row }));
  resolvedSpeciesList.sort((a, b) => {
    if (a.dexNumber !== b.dexNumber) return a.dexNumber - b.dexNumber;
    return a.name.localeCompare(b.name);
  });

  const gameSpeciesIdByKey = new Map<string, number>();
  const pendingBaseLinks: { speciesKey: string; baseKey: string }[] = [];

  for (const row of resolvedSpeciesList) {
    const type1Id = gameTypeIdByKey.get(row.type1Key);
    if (!type1Id) continue;
    const type2Id = row.type2Key ? gameTypeIdByKey.get(row.type2Key) ?? null : null;
    const inserted = tx
      .insert(gameSpecies)
      .values({
        gameId,
        dexNumber: row.dexNumber,
        baseSpeciesId: null,
        name: row.name,
        type1Id,
        type2Id,
        hp: row.hp,
        atk: row.atk,
        def: row.def,
        spa: row.spa,
        spd: row.spd,
        spe: row.spe
      })
      .returning()
      .get();
    gameSpeciesIdByKey.set(row.key, inserted.id);
    if (row.baseSpeciesKey) {
      pendingBaseLinks.push({ speciesKey: row.key, baseKey: row.baseSpeciesKey });
    }
  }

  for (const link of pendingBaseLinks) {
    const speciesId = gameSpeciesIdByKey.get(link.speciesKey);
    const baseId = gameSpeciesIdByKey.get(link.baseKey);
    if (!speciesId || !baseId) continue;
    tx.update(gameSpecies).set({ baseSpeciesId: baseId }).where(eq(gameSpecies.id, speciesId)).run();
  }

  const lastPackId = packIds[packIds.length - 1];
  const chartRows = packChartRows.filter((row: any) => row.packId === lastPackId);
  for (const row of chartRows) {
    const atkKey = typeKeyByPackId.get(`${lastPackId}:${row.attackingTypeId}`);
    const defKey = typeKeyByPackId.get(`${lastPackId}:${row.defendingTypeId}`);
    if (!atkKey || !defKey) continue;
    const atkId = gameTypeIdByKey.get(atkKey);
    const defId = gameTypeIdByKey.get(defKey);
    if (!atkId || !defId) continue;
    tx.insert(gameTypeEffectiveness)
      .values({
        gameId,
        attackingTypeId: atkId,
        defendingTypeId: defId,
        multiplier: row.multiplier
      })
      .run();
  }

  const packSpeciesAbilitiesByKey = new Map<string, typeof packSpeciesAbilitiesRows>();
  for (const row of packSpeciesAbilitiesRows) {
    const key = `${row.packId}:${row.speciesId}`;
    if (!packSpeciesAbilitiesByKey.has(key)) packSpeciesAbilitiesByKey.set(key, []);
    packSpeciesAbilitiesByKey.get(key)!.push(row);
  }

    for (const row of resolvedSpeciesList) {
      const key = `${row.sourcePackId}:${row.sourceSpeciesId}`;
      const abilityRows = packSpeciesAbilitiesByKey.get(key) ?? [];
      const gameSpeciesId = gameSpeciesIdByKey.get(row.key);
      if (!gameSpeciesId) continue;
      for (const abilityRow of abilityRows) {
        const abilityName = abilityNameById.get(abilityRow.abilityId);
        if (!abilityName) continue;
        const gameAbilityId = gameAbilityIdByKey.get(normalizeKey(abilityName));
        if (!gameAbilityId) continue;
        tx.insert(gameSpeciesAbilities)
          .values({
            gameId,
            speciesId: gameSpeciesId,
          abilityId: gameAbilityId,
          slot: abilityRow.slot
        })
        .run();
    }
  }

  const packEvoByKey = new Map<string, typeof packSpeciesEvoRows>();
  for (const row of packSpeciesEvoRows) {
    const key = `${row.packId}:${row.fromSpeciesId}`;
    if (!packEvoByKey.has(key)) packEvoByKey.set(key, []);
    packEvoByKey.get(key)!.push(row);
  }

  for (const row of resolvedSpeciesList) {
    const key = `${row.sourcePackId}:${row.sourceSpeciesId}`;
    const evoRows = packEvoByKey.get(key) ?? [];
    const fromId = gameSpeciesIdByKey.get(row.key);
    if (!fromId) continue;
    for (const evo of evoRows) {
      const toSpecies = packSpeciesById.get(`${evo.packId}:${evo.toSpeciesId}`);
      if (!toSpecies) continue;
      const toKey = normalizeKey(toSpecies.name);
      const toId = gameSpeciesIdByKey.get(toKey);
      if (!toId) continue;
      tx.insert(gameSpeciesEvolutions)
        .values({
          gameId,
          fromSpeciesId: fromId,
          toSpeciesId: toId,
          method: evo.method
        })
        .run();
    }
  }

  const allowedSpeciesIds = Array.from(gameSpeciesIdByKey.values());
  if (allowedSpeciesIds.length > 0) {
    tx.insert(gameAllowedSpecies).values(allowedSpeciesIds.map((speciesId) => ({ gameId, speciesId }))).run();
  }

  const allowedAbilityIds = Array.from(gameAbilityIdByKey.values());
  if (allowedAbilityIds.length > 0) {
    tx.insert(gameAllowedAbilities).values(allowedAbilityIds.map((abilityId) => ({ gameId, abilityId }))).run();
  }

  const allowedItemIds = Array.from(gameItemIdByKey.values());
  if (allowedItemIds.length > 0) {
    tx.insert(gameAllowedItems).values(allowedItemIds.map((itemId) => ({ gameId, itemId }))).run();
  }

  tx.insert(gamePacks)
    .values(
      packIds.map((packId, idx) => ({
        gameId,
        packId,
        sortOrder: idx
      }))
    )
    .run();
}

async function getGamePackStack(gameId: number) {
  return db
    .select({ packId: gamePacks.packId, name: packs.name, sortOrder: gamePacks.sortOrder })
    .from(gamePacks)
    .innerJoin(packs, eq(gamePacks.packId, packs.id))
    .where(eq(gamePacks.gameId, gameId))
    .orderBy(gamePacks.sortOrder);
}

// Packs
app.get("/api/packs", async (_req, res) => {
  const rows = await db.select().from(packs).orderBy(packs.name);
  res.json(rows.map((row) => ({ ...row, useSingleSpecial: !!row.useSingleSpecial })));
});

app.get("/api/packs/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const pack = await getPackById(id);
  res.json(pack);
});

app.get("/api/packs/:id/imports", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const rows = await db
    .select({ importPackId: packImports.importPackId, sortOrder: packImports.sortOrder, name: packs.name })
    .from(packImports)
    .innerJoin(packs, eq(packImports.importPackId, packs.id))
    .where(eq(packImports.packId, id))
    .orderBy(packImports.sortOrder);
  res.json(rows);
});

app.get("/api/packs/:id/abilities/all", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const chain = await getPackImportChainAsync(packId);
  const sourcePackIds = [...chain, packId];
  const rows =
    sourcePackIds.length === 0
      ? []
      : await db.select().from(packAbilities).where(inArray(packAbilities.packId, sourcePackIds));
  const byPack = new Map<number, typeof rows>();
  for (const row of rows) {
    if (!byPack.has(row.packId)) byPack.set(row.packId, []);
    byPack.get(row.packId)!.push(row);
  }
  const effective = new Map<string, (typeof rows)[number]>();
  for (const importPackId of chain) {
    for (const row of byPack.get(importPackId) ?? []) {
      effective.set(normalizeKey(row.name), row);
    }
  }
  for (const row of byPack.get(packId) ?? []) {
    effective.set(normalizeKey(row.name), row);
  }
  res.json(Array.from(effective.values()).sort((a, b) => a.name.localeCompare(b.name)));
});

app.get("/api/packs/:id/items/all", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const chain = await getPackImportChainAsync(packId);
  const sourcePackIds = [...chain, packId];
  const rows =
    sourcePackIds.length === 0
      ? []
      : await db.select().from(packItems).where(inArray(packItems.packId, sourcePackIds));
  const byPack = new Map<number, typeof rows>();
  for (const row of rows) {
    if (!byPack.has(row.packId)) byPack.set(row.packId, []);
    byPack.get(row.packId)!.push(row);
  }
  const effective = new Map<string, (typeof rows)[number]>();
  for (const importPackId of chain) {
    for (const row of byPack.get(importPackId) ?? []) {
      effective.set(normalizeKey(row.name), row);
    }
  }
  for (const row of byPack.get(packId) ?? []) {
    effective.set(normalizeKey(row.name), row);
  }
  res.json(Array.from(effective.values()).sort((a, b) => a.name.localeCompare(b.name)));
});

app.post("/api/packs", async (req, res) => {
  const data = packSchema.parse(req.body);
  const payload = {
    name: data.name,
    description: data.description ?? null,
    useSingleSpecial: data.useSingleSpecial ? 1 : 0
  };
  const [created] = await db.insert(packs).values(payload).returning();
  const importPackIds = (data.importPackIds ?? []).filter((id) => id !== created.id);
  if (importPackIds.length > 0) {
    await db.insert(packImports).values(
      importPackIds.map((importPackId, idx) => ({
        packId: created.id,
        importPackId,
        sortOrder: idx
      }))
    );
  }
  res.json({ ...created, useSingleSpecial: !!created.useSingleSpecial });
});

app.put("/api/packs/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = packSchema.parse(req.body);
  const payload = {
    name: data.name,
    description: data.description ?? null,
    useSingleSpecial: data.useSingleSpecial ? 1 : 0
  };
  const [row] = await db
    .update(packs)
    .set(payload)
    .where(eq(packs.id, id))
    .returning();
  if (Array.isArray(data.importPackIds)) {
    const importPackIds = data.importPackIds.filter((packId) => packId !== id);
    await db.delete(packImports).where(eq(packImports.packId, id));
    if (importPackIds.length > 0) {
      await db.insert(packImports).values(
        importPackIds.map((importPackId, idx) => ({
          packId: id,
          importPackId,
          sortOrder: idx
        }))
      );
    }
  }
  res.json({ ...row, useSingleSpecial: !!row.useSingleSpecial });
});

app.delete("/api/packs/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  db.transaction((tx) => {
    const gameRows = tx
      .select({ id: gamePacks.gameId })
      .from(gamePacks)
      .where(eq(gamePacks.packId, id))
      .all();
    const gameIds = gameRows.map((g) => g.id);

    if (gameIds.length > 0) {
      tx.delete(teamSlots).where(inArray(teamSlots.gameId, gameIds)).run();
      tx.delete(boxPokemon).where(inArray(boxPokemon.gameId, gameIds)).run();
      tx.delete(trackedBox).where(inArray(trackedBox.gameId, gameIds)).run();
      tx.delete(gameAllowedSpecies).where(inArray(gameAllowedSpecies.gameId, gameIds)).run();
      tx.delete(gameAllowedAbilities).where(inArray(gameAllowedAbilities.gameId, gameIds)).run();
      tx.delete(gameAllowedItems).where(inArray(gameAllowedItems.gameId, gameIds)).run();
      tx.delete(gameSpeciesAbilities).where(inArray(gameSpeciesAbilities.gameId, gameIds)).run();
      tx.delete(gameSpeciesEvolutions).where(inArray(gameSpeciesEvolutions.gameId, gameIds)).run();
      tx.delete(gameSpecies).where(inArray(gameSpecies.gameId, gameIds)).run();
      tx.delete(gameAbilities).where(inArray(gameAbilities.gameId, gameIds)).run();
      tx.delete(gameItems).where(inArray(gameItems.gameId, gameIds)).run();
      tx.delete(gameTypeEffectiveness).where(inArray(gameTypeEffectiveness.gameId, gameIds)).run();
      tx.delete(gameTypes).where(inArray(gameTypes.gameId, gameIds)).run();
      tx.delete(gamePacks).where(inArray(gamePacks.gameId, gameIds)).run();
      tx.delete(games).where(inArray(games.id, gameIds)).run();
    }

    tx.delete(packSpeciesAbilities).where(eq(packSpeciesAbilities.packId, id)).run();
    tx.delete(packSpeciesEvolutions).where(eq(packSpeciesEvolutions.packId, id)).run();
    tx.delete(packTypeEffectiveness).where(eq(packTypeEffectiveness.packId, id)).run();
    tx.delete(packSpecies).where(eq(packSpecies.packId, id)).run();
    tx.delete(packAbilities).where(eq(packAbilities.packId, id)).run();
    tx.delete(packItems).where(eq(packItems.packId, id)).run();
    tx.delete(packTypes).where(eq(packTypes.packId, id)).run();
    tx.delete(packImports).where(or(eq(packImports.packId, id), eq(packImports.importPackId, id))).run();
    tx.delete(packs).where(eq(packs.id, id)).run();
  });
  res.json({ ok: true });
});

app.get("/api/packs/:id/summary", async (req, res) => {
  const packId = idSchema.parse(req.params.id);

  const [typesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(packTypes)
    .where(eq(packTypes.packId, packId));
  const [speciesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(packSpecies)
    .where(eq(packSpecies.packId, packId));
  const [abilitiesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(packAbilities)
    .where(eq(packAbilities.packId, packId));
  const [itemsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(packItems)
    .where(eq(packItems.packId, packId));
  const gameRows = await db.select({ id: gamePacks.gameId }).from(gamePacks).where(eq(gamePacks.packId, packId));
  const gameIds = gameRows.map((g) => g.id);
  const gamesCount = gameIds.length;

  const [boxCount] = gameIds.length
    ? await db.select({ count: sql<number>`count(*)` }).from(boxPokemon).where(inArray(boxPokemon.gameId, gameIds))
    : [{ count: 0 }];
  const [teamSlotsCount] = gameIds.length
    ? await db.select({ count: sql<number>`count(*)` }).from(teamSlots).where(inArray(teamSlots.gameId, gameIds))
    : [{ count: 0 }];
  const [allowedSpeciesCount] = gameIds.length
    ? await db
        .select({ count: sql<number>`count(*)` })
        .from(gameAllowedSpecies)
        .where(inArray(gameAllowedSpecies.gameId, gameIds))
    : [{ count: 0 }];
  const [allowedAbilitiesCount] = gameIds.length
    ? await db
        .select({ count: sql<number>`count(*)` })
        .from(gameAllowedAbilities)
        .where(inArray(gameAllowedAbilities.gameId, gameIds))
    : [{ count: 0 }];
  const [allowedItemsCount] = gameIds.length
    ? await db
        .select({ count: sql<number>`count(*)` })
        .from(gameAllowedItems)
        .where(inArray(gameAllowedItems.gameId, gameIds))
    : [{ count: 0 }];
  const [speciesAbilitiesCount] = gameIds.length
    ? await db
        .select({ count: sql<number>`count(*)` })
        .from(gameSpeciesAbilities)
        .where(inArray(gameSpeciesAbilities.gameId, gameIds))
    : [{ count: 0 }];

  res.json({
    types: typesCount?.count ?? 0,
    species: speciesCount?.count ?? 0,
    abilities: abilitiesCount?.count ?? 0,
    items: itemsCount?.count ?? 0,
    games: gamesCount ?? 0,
    boxPokemon: boxCount?.count ?? 0,
    teamSlots: teamSlotsCount?.count ?? 0,
    allowedSpecies: allowedSpeciesCount?.count ?? 0,
    allowedAbilities: allowedAbilitiesCount?.count ?? 0,
    allowedItems: allowedItemsCount?.count ?? 0,
    speciesAbilities: speciesAbilitiesCount?.count ?? 0
  });
});

// Pack Types & Chart
app.get("/api/packs/:id/types", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const rows = await db.select().from(packTypes).where(eq(packTypes.packId, packId)).orderBy(packTypes.name);
  res.json(
    rows.map((row) => ({
      ...row,
      excludeInChart: !!row.excludeInChart
    }))
  );
});

app.post("/api/packs/:id/types", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const data = typeSchema.parse(req.body);
  try {
    const [row] = await db
      .insert(packTypes)
      .values({
        packId,
        name: data.name,
        metadata: data.metadata ?? null,
        color: data.color ?? null,
        excludeInChart: data.excludeInChart ? 1 : 0
      })
      .returning();
    res.json({ ...row, excludeInChart: !!row.excludeInChart });
  } catch (err: any) {
    if (err?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      res.status(409).json({ error: "Type name already exists in this pack." });
      return;
    }
    throw err;
  }
});

app.put("/api/packs/:id/types/:typeId", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const typeId = idSchema.parse(req.params.typeId);
  const data = typeSchema.parse(req.body);
  const [row] = await db
    .update(packTypes)
    .set({
      name: data.name,
      metadata: data.metadata ?? null,
      color: data.color ?? null,
      excludeInChart: data.excludeInChart ? 1 : 0
    })
    .where(and(eq(packTypes.id, typeId), eq(packTypes.packId, packId)))
    .returning();
  res.json({ ...row, excludeInChart: !!row.excludeInChart });
});

app.delete("/api/packs/:id/types/:typeId", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const typeId = idSchema.parse(req.params.typeId);
  db.transaction((tx) => {
    const normalType = tx
      .select({ id: packTypes.id })
      .from(packTypes)
      .where(and(eq(packTypes.packId, packId), eq(packTypes.name, "Normal")))
      .get();

    if (!normalType) {
      throw new Error("Normal type not found in pack.");
    }

    // Update pack species typing
    tx
      .update(packSpecies)
      .set({ type1Id: normalType.id })
      .where(and(eq(packSpecies.packId, packId), eq(packSpecies.type1Id, typeId)))
      .run();

    tx
      .update(packSpecies)
      .set({ type2Id: null })
      .where(and(eq(packSpecies.packId, packId), eq(packSpecies.type2Id, typeId)))
      .run();

    // Remove type chart rows for this type
    tx
      .delete(packTypeEffectiveness)
      .where(
        and(
          eq(packTypeEffectiveness.packId, packId),
          or(eq(packTypeEffectiveness.attackingTypeId, typeId), eq(packTypeEffectiveness.defendingTypeId, typeId))
        )
      )
      .run();

    tx.delete(packTypes).where(and(eq(packTypes.id, typeId), eq(packTypes.packId, packId))).run();
  });
  res.json({ ok: true });
});

app.get("/api/packs/:id/typechart", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const rows = await db.select().from(packTypeEffectiveness).where(eq(packTypeEffectiveness.packId, packId));
  res.json(rows);
});

app.get("/api/packs/:id/typechart/export", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const typesList = await db.select().from(packTypes).where(eq(packTypes.packId, packId)).orderBy(packTypes.name);
  const chartRows = await db.select().from(packTypeEffectiveness).where(eq(packTypeEffectiveness.packId, packId));
  const nameById = new Map(typesList.map((t) => [t.id, t.name]));
  res.json({
    types: typesList.map((t) => ({
      name: t.name,
      metadata: t.metadata ?? null,
      color: t.color ?? null,
      excludeInChart: !!t.excludeInChart
    })),
    chart: chartRows
      .map((row) => ({
        attackingTypeName: nameById.get(row.attackingTypeId) ?? "",
        defendingTypeName: nameById.get(row.defendingTypeId) ?? "",
        multiplier: row.multiplier
      }))
      .filter((row) => row.attackingTypeName && row.defendingTypeName)
  });
});

app.post("/api/packs/:id/typechart/import", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const data = typeChartImportSchema.parse(req.body);
  db.transaction((tx) => {
    const existingTypes = tx.select().from(packTypes).where(eq(packTypes.packId, packId)).all();
    const existingByKey = new Map(existingTypes.map((t) => [normalizeKey(t.name), t]));
    const typeIdByKey = new Map<string, number>();

    for (const type of data.types) {
      const key = normalizeKey(type.name);
      const existing = existingByKey.get(key);
      if (existing) {
        tx.update(packTypes)
          .set({
            name: type.name,
            metadata: type.metadata ?? null,
            color: type.color ?? null,
            excludeInChart: type.excludeInChart ? 1 : 0
          })
          .where(eq(packTypes.id, existing.id))
          .run();
        typeIdByKey.set(key, existing.id);
      } else {
        const inserted = tx
          .insert(packTypes)
          .values({
            packId,
            name: type.name,
            metadata: type.metadata ?? null,
            color: type.color ?? null,
            excludeInChart: type.excludeInChart ? 1 : 0
          })
          .returning()
          .get();
        typeIdByKey.set(key, inserted.id);
      }
    }

    tx.delete(packTypeEffectiveness).where(eq(packTypeEffectiveness.packId, packId)).run();

    for (const row of data.chart) {
      const atkId = typeIdByKey.get(normalizeKey(row.attackingTypeName));
      const defId = typeIdByKey.get(normalizeKey(row.defendingTypeName));
      if (!atkId || !defId) continue;
      tx.insert(packTypeEffectiveness)
        .values({
          packId,
          attackingTypeId: atkId,
          defendingTypeId: defId,
          multiplier: row.multiplier
        })
        .run();
    }
  });
  res.json({ ok: true });
});

app.post("/api/packs/:id/typechart", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const data = typeChartSchema.parse(req.body);
  await db
    .insert(packTypeEffectiveness)
    .values({ ...data, packId })
    .onConflictDoUpdate({
      target: [packTypeEffectiveness.packId, packTypeEffectiveness.attackingTypeId, packTypeEffectiveness.defendingTypeId],
      set: { multiplier: data.multiplier }
    });
  res.json({ ok: true });
});

app.get("/api/packs/:id/species/export", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const typesList = await db.select().from(packTypes).where(eq(packTypes.packId, packId));
  const typeNameById = new Map(typesList.map((t) => [t.id, t.name]));
  const speciesRows = await db
    .select()
    .from(packSpecies)
    .where(eq(packSpecies.packId, packId))
    .orderBy(packSpecies.dexNumber, packSpecies.name);
  const speciesNameById = new Map(speciesRows.map((s) => [s.id, s.name]));
  const abilityRows = await db.select().from(packAbilities).where(eq(packAbilities.packId, packId));
  const abilityNameById = new Map(abilityRows.map((a) => [a.id, a.name]));
  const speciesAbilityRows = await db
    .select()
    .from(packSpeciesAbilities)
    .where(eq(packSpeciesAbilities.packId, packId));
  const evoRows = await db
    .select()
    .from(packSpeciesEvolutions)
    .where(eq(packSpeciesEvolutions.packId, packId));

  res.json({
    species: speciesRows.map((s) => ({
      dexNumber: s.dexNumber,
      name: s.name,
      baseSpeciesName: s.baseSpeciesId ? speciesNameById.get(s.baseSpeciesId) ?? null : null,
      type1Name: typeNameById.get(s.type1Id) ?? "",
      type2Name: s.type2Id ? typeNameById.get(s.type2Id) ?? null : null,
      hp: s.hp,
      atk: s.atk,
      def: s.def,
      spa: s.spa,
      spd: s.spd,
      spe: s.spe
    })),
    abilities: speciesAbilityRows
      .map((row) => ({
        speciesName: speciesNameById.get(row.speciesId) ?? "",
        abilityName: abilityNameById.get(row.abilityId) ?? "",
        slot: row.slot
      }))
      .filter((row) => row.speciesName && row.abilityName),
    evolutions: evoRows
      .map((row) => ({
        fromSpeciesName: speciesNameById.get(row.fromSpeciesId) ?? "",
        toSpeciesName: speciesNameById.get(row.toSpeciesId) ?? "",
        method: row.method
      }))
      .filter((row) => row.fromSpeciesName && row.toSpeciesName)
  });
});

app.post("/api/packs/:id/species/import", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const data = speciesImportSchema.parse(req.body);
  const mode = data.mode ?? "replace";

  const typesList = await db.select().from(packTypes).where(eq(packTypes.packId, packId));
  const typeIdByName = new Map(typesList.map((t) => [normalizeKey(t.name), t.id]));
  const abilityRows = await db.select().from(packAbilities).where(eq(packAbilities.packId, packId));
  const abilityIdByName = new Map(abilityRows.map((a) => [normalizeKey(a.name), a.id]));

  const missingTypes = new Set<string>();
  data.species.forEach((s) => {
    if (!typeIdByName.has(normalizeKey(s.type1Name))) missingTypes.add(s.type1Name);
    if (s.type2Name && !typeIdByName.has(normalizeKey(s.type2Name))) missingTypes.add(s.type2Name);
  });

  const missingAbilities = new Set<string>();
  data.abilities.forEach((row) => {
    if (!abilityIdByName.has(normalizeKey(row.abilityName))) missingAbilities.add(row.abilityName);
  });

  if (missingTypes.size > 0) {
    return res.status(400).json({ error: "Missing types", missingTypes: Array.from(missingTypes) });
  }
  if (missingAbilities.size > 0) {
    return res.status(400).json({ error: "Missing abilities", missingAbilities: Array.from(missingAbilities) });
  }

  db.transaction((tx) => {
    if (mode === "replace") {
      tx.delete(packSpeciesAbilities).where(eq(packSpeciesAbilities.packId, packId)).run();
      tx.delete(packSpeciesEvolutions).where(eq(packSpeciesEvolutions.packId, packId)).run();
      tx.delete(packSpecies).where(eq(packSpecies.packId, packId)).run();
    }

    const existingSpecies = tx.select().from(packSpecies).where(eq(packSpecies.packId, packId)).all();
    const existingByName = new Map(existingSpecies.map((s) => [normalizeKey(s.name), s]));
    const speciesIdByName = new Map<string, number>();
    const baseLinks: { speciesKey: string; baseKey: string }[] = [];

    for (const row of data.species) {
      const key = normalizeKey(row.name);
      const type1Id = typeIdByName.get(normalizeKey(row.type1Name))!;
      const type2Id = row.type2Name ? typeIdByName.get(normalizeKey(row.type2Name)) ?? null : null;
      const existing = existingByName.get(key);
      if (existing) {
        tx.update(packSpecies)
          .set({
            dexNumber: row.dexNumber,
            name: row.name,
            type1Id,
            type2Id,
            hp: row.hp,
            atk: row.atk,
            def: row.def,
            spa: row.spa,
            spd: row.spd,
            spe: row.spe,
            baseSpeciesId: null
          })
          .where(eq(packSpecies.id, existing.id))
          .run();
        speciesIdByName.set(key, existing.id);
      } else {
        const inserted = tx
          .insert(packSpecies)
          .values({
            packId,
            dexNumber: row.dexNumber,
            baseSpeciesId: null,
            name: row.name,
            type1Id,
            type2Id,
            hp: row.hp,
            atk: row.atk,
            def: row.def,
            spa: row.spa,
            spd: row.spd,
            spe: row.spe
          })
          .returning()
          .get();
        speciesIdByName.set(key, inserted.id);
      }
      if (row.baseSpeciesName) {
        baseLinks.push({ speciesKey: key, baseKey: normalizeKey(row.baseSpeciesName) });
      }
    }

    for (const link of baseLinks) {
      const speciesId = speciesIdByName.get(link.speciesKey);
      const baseId = speciesIdByName.get(link.baseKey);
      if (!speciesId || !baseId) continue;
      tx.update(packSpecies).set({ baseSpeciesId: baseId }).where(eq(packSpecies.id, speciesId)).run();
    }

    if (mode === "merge") {
      const affectedSpeciesIds = Array.from(
        new Set(
          data.abilities
            .map((row) => speciesIdByName.get(normalizeKey(row.speciesName)))
            .filter(Boolean) as number[]
        )
      );
      if (affectedSpeciesIds.length > 0) {
        tx.delete(packSpeciesAbilities)
          .where(and(eq(packSpeciesAbilities.packId, packId), inArray(packSpeciesAbilities.speciesId, affectedSpeciesIds)))
          .run();
      }

      const affectedEvoIds = Array.from(
        new Set(
          data.evolutions
            .map((row) => speciesIdByName.get(normalizeKey(row.fromSpeciesName)))
            .filter(Boolean) as number[]
        )
      );
      if (affectedEvoIds.length > 0) {
        tx.delete(packSpeciesEvolutions)
          .where(and(eq(packSpeciesEvolutions.packId, packId), inArray(packSpeciesEvolutions.fromSpeciesId, affectedEvoIds)))
          .run();
      }
    } else {
      tx.delete(packSpeciesAbilities).where(eq(packSpeciesAbilities.packId, packId)).run();
      tx.delete(packSpeciesEvolutions).where(eq(packSpeciesEvolutions.packId, packId)).run();
    }

    for (const row of data.abilities) {
      const speciesId = speciesIdByName.get(normalizeKey(row.speciesName));
      const abilityId = abilityIdByName.get(normalizeKey(row.abilityName));
      if (!speciesId || !abilityId) continue;
      tx.insert(packSpeciesAbilities)
        .values({
          packId,
          speciesId,
          abilityId,
          slot: row.slot
        })
        .run();
    }

    for (const row of data.evolutions) {
      const fromId = speciesIdByName.get(normalizeKey(row.fromSpeciesName));
      const toId = speciesIdByName.get(normalizeKey(row.toSpeciesName));
      if (!fromId || !toId) continue;
      tx.insert(packSpeciesEvolutions)
        .values({
          packId,
          fromSpeciesId: fromId,
          toSpeciesId: toId,
          method: row.method
        })
        .run();
    }
  });

  res.json({ ok: true, mode, species: data.species.length, abilities: data.abilities.length, evolutions: data.evolutions.length });
});

// Pack Species
app.get("/api/packs/:id/species", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const { typesList, typeNameById } = await getPackTypesMap(packId);

  const rows = await db
    .select()
    .from(packSpecies)
    .where(eq(packSpecies.packId, packId))
    .orderBy(packSpecies.dexNumber, packSpecies.name);

  const withNames = rows.map((row) => ({
    ...row,
    type1Name: typeNameById.get(row.type1Id) ?? null,
    type2Name: row.type2Id ? typeNameById.get(row.type2Id) ?? null : null
  }));

  res.json(withNames);
});

app.post("/api/packs/:id/species", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const data = speciesSchema.parse(req.body);
  if (data.baseSpeciesId) {
    const baseRow = await db
      .select({ id: packSpecies.id, baseSpeciesId: packSpecies.baseSpeciesId })
      .from(packSpecies)
      .where(and(eq(packSpecies.id, data.baseSpeciesId), eq(packSpecies.packId, packId)))
      .limit(1);
    if (baseRow.length === 0) {
      return res.status(400).json({ error: "Base species not found in this pack." });
    }
    if (baseRow[0].baseSpeciesId) {
      return res.status(400).json({ error: "Base species must be a primary species." });
    }
  }
  try {
    const [row] = await db
      .insert(packSpecies)
      .values({ ...data, packId, baseSpeciesId: data.baseSpeciesId ?? null, type2Id: data.type2Id ?? null })
      .returning();
    res.json(row);
  } catch (err: any) {
    if (err?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      res.status(409).json({ error: "Species name already exists in this pack." });
      return;
    }
    throw err;
  }
});

app.put("/api/packs/:id/species/:speciesId", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const speciesId = idSchema.parse(req.params.speciesId);
  const data = speciesSchema.parse(req.body);
  if (data.baseSpeciesId) {
    if (data.baseSpeciesId === speciesId) {
      return res.status(400).json({ error: "Species cannot reference itself as base." });
    }
    const baseRow = await db
      .select({ id: packSpecies.id, baseSpeciesId: packSpecies.baseSpeciesId })
      .from(packSpecies)
      .where(and(eq(packSpecies.id, data.baseSpeciesId), eq(packSpecies.packId, packId)))
      .limit(1);
    if (baseRow.length === 0) {
      return res.status(400).json({ error: "Base species not found in this pack." });
    }
    if (baseRow[0].baseSpeciesId) {
      return res.status(400).json({ error: "Base species must be a primary species." });
    }
  }
  const [row] = await db
    .update(packSpecies)
    .set({ ...data, baseSpeciesId: data.baseSpeciesId ?? null, type2Id: data.type2Id ?? null })
    .where(and(eq(packSpecies.id, speciesId), eq(packSpecies.packId, packId)))
    .returning();
  res.json(row);
});

app.delete("/api/packs/:id/species/:speciesId", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const speciesId = idSchema.parse(req.params.speciesId);
  db.transaction((tx) => {
    tx.delete(packSpeciesAbilities).where(and(eq(packSpeciesAbilities.packId, packId), eq(packSpeciesAbilities.speciesId, speciesId))).run();
    tx
      .delete(packSpeciesEvolutions)
      .where(
        and(
          eq(packSpeciesEvolutions.packId, packId),
          or(eq(packSpeciesEvolutions.fromSpeciesId, speciesId), eq(packSpeciesEvolutions.toSpeciesId, speciesId))
        )
      )
      .run();
    tx.delete(packSpecies).where(and(eq(packSpecies.id, speciesId), eq(packSpecies.packId, packId))).run();
  });
  res.json({ ok: true });
});

// Pack Abilities
app.get("/api/packs/:id/abilities", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const rows = await db.select().from(packAbilities).where(eq(packAbilities.packId, packId)).orderBy(packAbilities.name);
  res.json(rows);
});

app.post("/api/packs/:id/abilities", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const data = tagSchema.parse(req.body);
  try {
    const [row] = await db
      .insert(packAbilities)
      .values({ packId, name: data.name, tags: JSON.stringify(data.tags ?? []) })
      .returning();
    res.json(row);
  } catch (err: any) {
    if (err?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      res.status(409).json({ error: "Ability name already exists in this pack." });
      return;
    }
    throw err;
  }
});

app.put("/api/packs/:id/abilities/:abilityId", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const abilityId = idSchema.parse(req.params.abilityId);
  const data = tagSchema.parse(req.body);
  const [row] = await db
    .update(packAbilities)
    .set({ name: data.name, tags: JSON.stringify(data.tags ?? []) })
    .where(and(eq(packAbilities.id, abilityId), eq(packAbilities.packId, packId)))
    .returning();
  res.json(row);
});

app.delete("/api/packs/:id/abilities/:abilityId", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const abilityId = idSchema.parse(req.params.abilityId);
  db.transaction((tx) => {
    tx.delete(packSpeciesAbilities).where(and(eq(packSpeciesAbilities.packId, packId), eq(packSpeciesAbilities.abilityId, abilityId))).run();
    tx.delete(packAbilities).where(and(eq(packAbilities.id, abilityId), eq(packAbilities.packId, packId))).run();
  });
  res.json({ ok: true });
});

// Pack Items
app.get("/api/packs/:id/items", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const rows = await db.select().from(packItems).where(eq(packItems.packId, packId)).orderBy(packItems.name);
  res.json(rows);
});

app.post("/api/packs/:id/items", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const data = tagSchema.parse(req.body);
  try {
    const [row] = await db
      .insert(packItems)
      .values({ packId, name: data.name, tags: JSON.stringify(data.tags ?? []) })
      .returning();
    res.json(row);
  } catch (err: any) {
    if (err?.code === "SQLITE_CONSTRAINT_UNIQUE") {
      res.status(409).json({ error: "Item name already exists in this pack." });
      return;
    }
    throw err;
  }
});

app.put("/api/packs/:id/items/:itemId", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const itemId = idSchema.parse(req.params.itemId);
  const data = tagSchema.parse(req.body);
  const [row] = await db
    .update(packItems)
    .set({ name: data.name, tags: JSON.stringify(data.tags ?? []) })
    .where(and(eq(packItems.id, itemId), eq(packItems.packId, packId)))
    .returning();
  res.json(row);
});

app.delete("/api/packs/:id/items/:itemId", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const itemId = idSchema.parse(req.params.itemId);
  db.transaction((tx) => {
    tx.delete(packItems).where(and(eq(packItems.id, itemId), eq(packItems.packId, packId))).run();
  });
  res.json({ ok: true });
});

// Pack Species Abilities
app.get("/api/packs/:id/species-abilities", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const rows = await db.select().from(packSpeciesAbilities).where(eq(packSpeciesAbilities.packId, packId));
  res.json(rows);
});

app.get("/api/packs/:id/species-evolutions", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const fromSpeciesId = typeof req.query.fromSpeciesId === "string" ? Number(req.query.fromSpeciesId) : null;
  const rows =
    Number.isFinite(fromSpeciesId) && fromSpeciesId
      ? await db
          .select()
          .from(packSpeciesEvolutions)
          .where(and(eq(packSpeciesEvolutions.packId, packId), eq(packSpeciesEvolutions.fromSpeciesId, fromSpeciesId)))
      : await db.select().from(packSpeciesEvolutions).where(eq(packSpeciesEvolutions.packId, packId));
  res.json(rows);
});

app.post("/api/packs/:id/species-evolutions", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const data = speciesEvolutionSchema.parse(req.body);
  const [row] = await db
    .insert(packSpeciesEvolutions)
    .values({ packId, fromSpeciesId: data.fromSpeciesId, toSpeciesId: data.toSpeciesId, method: data.method })
    .returning();
  res.json(row);
});

app.put("/api/packs/:id/species-evolutions/:evoId", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const evoId = idSchema.parse(req.params.evoId);
  const data = speciesEvolutionSchema.parse(req.body);
  const [row] = await db
    .update(packSpeciesEvolutions)
    .set({ fromSpeciesId: data.fromSpeciesId, toSpeciesId: data.toSpeciesId, method: data.method })
    .where(and(eq(packSpeciesEvolutions.id, evoId), eq(packSpeciesEvolutions.packId, packId)))
    .returning();
  res.json(row);
});

app.delete("/api/packs/:id/species-evolutions/:evoId", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const evoId = idSchema.parse(req.params.evoId);
  await db.delete(packSpeciesEvolutions).where(and(eq(packSpeciesEvolutions.id, evoId), eq(packSpeciesEvolutions.packId, packId)));
  res.json({ ok: true });
});

app.post("/api/packs/:id/species-abilities", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const data = speciesAbilitiesSchema.parse(req.body);
  if (!Number.isFinite(data.speciesId) || data.speciesId <= 0) {
    return res.status(400).json({ error: "Invalid speciesId." });
  }
  const cleanSlots = data.slots
    .filter((slot) => Number.isFinite(slot.abilityId) && slot.abilityId > 0)
    .map((slot) => ({ ...slot, abilityId: Number(slot.abilityId) }));
  await db
    .delete(packSpeciesAbilities)
    .where(and(eq(packSpeciesAbilities.packId, packId), eq(packSpeciesAbilities.speciesId, data.speciesId)));
  if (cleanSlots.length > 0) {
    await db.insert(packSpeciesAbilities).values(
      cleanSlots.map((slot) => ({
        packId,
        speciesId: data.speciesId,
        abilityId: slot.abilityId,
        slot: slot.slot
      }))
    );
  }
  res.json({ ok: true });
});

// Games
app.get("/api/games", async (_req, res) => {
  const rows = await db.select().from(games).orderBy(games.name);
  const payload = await Promise.all(
    rows.map(async (row) => {
      const packsStack = await getGamePackStack(row.id);
      const useSingleSpecial = await getGameUseSingleSpecial(row.id);
      return {
        ...row,
        packIds: packsStack.map((p) => p.packId),
        packNames: packsStack.map((p) => p.name),
        useSingleSpecial,
        disableAbilities: !!row.disableAbilities,
        disableHeldItems: !!row.disableHeldItems
      };
    })
  );
  res.json(payload);
});

app.get("/api/games/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const [row] = await db.select().from(games).where(eq(games.id, id));
  if (!row) {
    res.json(null);
    return;
  }
  const packsStack = await getGamePackStack(id);
  const useSingleSpecial = await getGameUseSingleSpecial(id);
  res.json({
    ...row,
    packIds: packsStack.map((p) => p.packId),
    packNames: packsStack.map((p) => p.name),
    useSingleSpecial,
    disableAbilities: !!row.disableAbilities,
    disableHeldItems: !!row.disableHeldItems
  });
});

app.post("/api/games", async (req, res) => {
  const data = gameCreateSchema.parse(req.body);
  const packIds = data.packIds.filter((value, idx, arr) => arr.indexOf(value) === idx);
  const packsCount = await db.select({ id: packs.id }).from(packs).where(inArray(packs.id, packIds));
  if (packsCount.length !== packIds.length) {
    return res.status(400).json({ error: "One or more packs do not exist." });
  }

  const result = db.transaction((tx) => {
    const newGame = tx
      .insert(games)
      .values({
        name: data.name,
        notes: data.notes ?? null,
        disableAbilities: data.disableAbilities ? 1 : 0,
        disableHeldItems: data.disableHeldItems ? 1 : 0,
        critStagePreset: data.critStagePreset ?? "gen7",
        critBaseDamageMult: data.critBaseDamageMult ?? 1.5
      })
      .returning()
      .get();

    buildGameData(tx, newGame.id, packIds);
    return newGame;
  });

  const packsStack = await getGamePackStack(result.id);
  const useSingleSpecial = await getGameUseSingleSpecial(result.id);
  res.json({
    ...result,
    packIds: packsStack.map((p) => p.packId),
    packNames: packsStack.map((p) => p.name),
    useSingleSpecial,
    disableAbilities: !!result.disableAbilities,
    disableHeldItems: !!result.disableHeldItems
  });
});

app.put("/api/games/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = gameUpdateSchema.parse(req.body);
  const [row] = await db
    .update(games)
    .set({
      name: data.name,
      notes: data.notes ?? null,
      disableAbilities: data.disableAbilities ? 1 : 0,
      disableHeldItems: data.disableHeldItems ? 1 : 0,
      critStagePreset: data.critStagePreset ?? "gen7",
      critBaseDamageMult: data.critBaseDamageMult ?? 1.5
    })
    .where(eq(games.id, id))
    .returning();

  const packsStack = await getGamePackStack(id);
  const useSingleSpecial = await getGameUseSingleSpecial(id);
  res.json({
    ...row,
    packIds: packsStack.map((p) => p.packId),
    packNames: packsStack.map((p) => p.name),
    useSingleSpecial,
    disableAbilities: !!row.disableAbilities,
    disableHeldItems: !!row.disableHeldItems
  });
});

app.delete("/api/games/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await db.delete(teamSlots).where(eq(teamSlots.gameId, id));
  await db.delete(boxPokemon).where(eq(boxPokemon.gameId, id));
  await db.delete(trackedBox).where(eq(trackedBox.gameId, id));
  await db.delete(gameAllowedSpecies).where(eq(gameAllowedSpecies.gameId, id));
  await db.delete(gameAllowedAbilities).where(eq(gameAllowedAbilities.gameId, id));
  await db.delete(gameAllowedItems).where(eq(gameAllowedItems.gameId, id));
  await db.delete(gameSpeciesAbilities).where(eq(gameSpeciesAbilities.gameId, id));
  await db.delete(gameSpeciesEvolutions).where(eq(gameSpeciesEvolutions.gameId, id));
  await db.delete(gameSpecies).where(eq(gameSpecies.gameId, id));
  await db.delete(gameAbilities).where(eq(gameAbilities.gameId, id));
  await db.delete(gameItems).where(eq(gameItems.gameId, id));
  await db.delete(gameTypeEffectiveness).where(eq(gameTypeEffectiveness.gameId, id));
  await db.delete(gameTypes).where(eq(gameTypes.gameId, id));
  await db.delete(gamePacks).where(eq(gamePacks.gameId, id));
  await db.delete(games).where(eq(games.id, id));
  res.json({ ok: true });
});

app.get("/api/games/:id/allowed-species", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const rows = await db.select().from(gameAllowedSpecies).where(eq(gameAllowedSpecies.gameId, id));
  res.json(rows.map((r) => r.speciesId));
});

app.put("/api/games/:id/allowed-species", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = allowedSchema.parse(req.body);
  await db.delete(gameAllowedSpecies).where(eq(gameAllowedSpecies.gameId, id));
  if (data.ids.length > 0) {
    await db.insert(gameAllowedSpecies).values(data.ids.map((speciesId) => ({ gameId: id, speciesId })));
  }
  res.json({ ok: true });
});

app.get("/api/games/:id/allowed-abilities", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await syncGameAbilities(id);
  const rows = await db.select().from(gameAllowedAbilities).where(eq(gameAllowedAbilities.gameId, id));
  res.json(rows.map((r) => r.abilityId));
});

app.put("/api/games/:id/allowed-abilities", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = allowedSchema.parse(req.body);
  await db.delete(gameAllowedAbilities).where(eq(gameAllowedAbilities.gameId, id));
  if (data.ids.length > 0) {
    await db.insert(gameAllowedAbilities).values(data.ids.map((abilityId) => ({ gameId: id, abilityId })));
  }
  res.json({ ok: true });
});

app.get("/api/games/:id/allowed-items", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const rows = await db.select().from(gameAllowedItems).where(eq(gameAllowedItems.gameId, id));
  res.json(rows.map((r) => r.itemId));
});

app.put("/api/games/:id/allowed-items", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = allowedSchema.parse(req.body);
  await db.delete(gameAllowedItems).where(eq(gameAllowedItems.gameId, id));
  if (data.ids.length > 0) {
    await db.insert(gameAllowedItems).values(data.ids.map((itemId) => ({ gameId: id, itemId })));
  }
  res.json({ ok: true });
});

app.get("/api/games/:id/types", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const rows = await db.select().from(gameTypes).where(eq(gameTypes.gameId, gameId)).orderBy(gameTypes.name);
  res.json(
    rows.map((row) => ({
      ...row,
      excludeInChart: !!row.excludeInChart
    }))
  );
});

app.get("/api/games/:id/species", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const { typeNameById } = await getGameTypesMap(gameId);
  const rows = await db
    .select()
    .from(gameSpecies)
    .where(eq(gameSpecies.gameId, gameId))
    .orderBy(gameSpecies.dexNumber, gameSpecies.name);
  const withNames = rows.map((row) => ({
    ...row,
    type1Name: typeNameById.get(row.type1Id) ?? null,
    type2Name: row.type2Id ? typeNameById.get(row.type2Id) ?? null : null
  }));
  res.json(withNames);
});

app.get("/api/games/:id/abilities", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  await syncGameAbilities(gameId);
  const rows = await db.select().from(gameAbilities).where(eq(gameAbilities.gameId, gameId)).orderBy(gameAbilities.name);
  res.json(rows);
});

app.get("/api/games/:id/items", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  await syncGameItems(gameId);
  const rows = await db.select().from(gameItems).where(eq(gameItems.gameId, gameId)).orderBy(gameItems.name);
  res.json(rows);
});

app.get("/api/games/:id/species-abilities", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  await syncGameSpeciesAbilities(gameId);
  const rows = await db.select().from(gameSpeciesAbilities).where(eq(gameSpeciesAbilities.gameId, gameId));
  res.json(rows);
});

app.get("/api/games/:id/species-evolutions", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const fromSpeciesId = typeof req.query.fromSpeciesId === "string" ? Number(req.query.fromSpeciesId) : null;
  const rows =
    Number.isFinite(fromSpeciesId) && fromSpeciesId
      ? await db
          .select()
          .from(gameSpeciesEvolutions)
          .where(and(eq(gameSpeciesEvolutions.gameId, gameId), eq(gameSpeciesEvolutions.fromSpeciesId, fromSpeciesId)))
      : await db.select().from(gameSpeciesEvolutions).where(eq(gameSpeciesEvolutions.gameId, gameId));
  res.json(rows);
});

app.get("/api/games/:id/dex", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const search = typeof req.query.search === "string" ? req.query.search : "";
  const typeId = typeof req.query.typeId === "string" ? Number(req.query.typeId) : null;
  const statMin = (key: string) => (typeof req.query[key] === "string" ? Number(req.query[key]) : null);
  const minSpecial = statMin("minSpecial");
  const minBst = statMin("minBst");

  const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (game.length === 0) return res.status(404).json({ error: "Game not found" });
  const useSingleSpecial = await getGameUseSingleSpecial(gameId);

  const typesList = await db.select().from(gameTypes).where(eq(gameTypes.gameId, gameId));
  const typeNameById = new Map(typesList.map((t) => [t.id, t.name]));

  const rows = await db
    .select({
      speciesId: gameSpecies.id,
      dexNumber: gameSpecies.dexNumber,
      baseSpeciesId: gameSpecies.baseSpeciesId,
      name: gameSpecies.name,
      type1Id: gameSpecies.type1Id,
      type2Id: gameSpecies.type2Id,
      hp: gameSpecies.hp,
      atk: gameSpecies.atk,
      def: gameSpecies.def,
      spa: gameSpecies.spa,
      spd: gameSpecies.spd,
      spe: gameSpecies.spe
    })
    .from(gameAllowedSpecies)
    .innerJoin(gameSpecies, eq(gameAllowedSpecies.speciesId, gameSpecies.id))
    .where(eq(gameAllowedSpecies.gameId, gameId))
    .orderBy(gameSpecies.dexNumber, gameSpecies.name);

  const normalized = rows
    .map((row) => ({
      id: row.speciesId,
      dexNumber: row.dexNumber,
      baseSpeciesId: row.baseSpeciesId ?? null,
      name: row.name,
      type1Id: row.type1Id,
      type2Id: row.type2Id,
      hp: row.hp,
      atk: row.atk,
      def: row.def,
      spa: row.spa,
      spd: useSingleSpecial ? row.spa : row.spd,
      spe: row.spe,
      type1Name: typeNameById.get(row.type1Id) ?? null,
      type2Name: row.type2Id ? typeNameById.get(row.type2Id) ?? null : null
    }))
    .filter((row) => (search ? row.name.toLowerCase().includes(search.toLowerCase()) : true))
    .filter((row) => (typeId ? row.type1Id === typeId || row.type2Id === typeId : true))
    .filter((row) => (statMin("minHp") ? row.hp >= statMin("minHp")! : true))
    .filter((row) => (statMin("minAtk") ? row.atk >= statMin("minAtk")! : true))
    .filter((row) => (statMin("minDef") ? row.def >= statMin("minDef")! : true))
    .filter((row) => {
      if (!useSingleSpecial) {
        if (statMin("minSpa") && row.spa < statMin("minSpa")!) return false;
        if (statMin("minSpd") && row.spd < statMin("minSpd")!) return false;
        return true;
      }
      const specialMin = minSpecial ?? statMin("minSpa") ?? statMin("minSpd");
      return specialMin ? row.spa >= specialMin : true;
    })
    .filter((row) => (statMin("minSpe") ? row.spe >= statMin("minSpe")! : true))
    .filter((row) => {
      if (!minBst) return true;
      const bst = row.hp + row.atk + row.def + row.spa + (useSingleSpecial ? 0 : row.spd) + row.spe;
      return bst >= minBst;
    });

  res.json(normalized);
});

app.get("/api/games/:id/box", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (game.length === 0) return res.status(404).json({ error: "Game not found" });
  const disableAbilities = !!game[0].disableAbilities;
  const disableHeldItems = !!game[0].disableHeldItems;
  const critStagePreset = game[0].critStagePreset ?? "gen7";
  const critBaseDamageMult = game[0].critBaseDamageMult ?? 1.5;
  const useSingleSpecial = await getGameUseSingleSpecial(gameId);

  const typesList = await db.select().from(gameTypes).where(eq(gameTypes.gameId, gameId));
  const typeNameById = new Map(typesList.map((t) => [t.id, t.name]));
  const chartRows = await db
    .select()
    .from(gameTypeEffectiveness)
    .where(eq(gameTypeEffectiveness.gameId, gameId));
  const scoringTypes = typesList.filter((t) => !t.excludeInChart);

  const rows = await db
    .select({
      id: boxPokemon.id,
      gameId: boxPokemon.gameId,
      speciesId: boxPokemon.speciesId,
      abilityId: boxPokemon.abilityId,
      itemId: boxPokemon.itemId,
      nickname: boxPokemon.nickname,
      speciesName: gameSpecies.name,
      type1Id: gameSpecies.type1Id,
      type2Id: gameSpecies.type2Id,
      hp: gameSpecies.hp,
      atk: gameSpecies.atk,
      def: gameSpecies.def,
      spa: gameSpecies.spa,
      spd: gameSpecies.spd,
      spe: gameSpecies.spe,
      abilityName: gameAbilities.name,
      abilityTags: gameAbilities.tags,
      itemName: gameItems.name,
      itemTags: gameItems.tags
    })
    .from(boxPokemon)
    .innerJoin(gameSpecies, eq(boxPokemon.speciesId, gameSpecies.id))
    .leftJoin(gameAbilities, eq(boxPokemon.abilityId, gameAbilities.id))
    .leftJoin(gameItems, eq(boxPokemon.itemId, gameItems.id))
    .where(eq(boxPokemon.gameId, gameId))
    .orderBy(gameSpecies.name);

  const withScores = rows.map((row) => {
    const tags = [
      ...(disableAbilities ? [] : parseTags(row.abilityTags)),
      ...(disableHeldItems ? [] : parseTags(row.itemTags))
    ];
    const effectiveSpd = useSingleSpecial ? row.spa : row.spd;
    const potentials = computePotentials(
      {
        hp: row.hp,
        atk: row.atk,
        def: row.def,
        spa: row.spa,
        spd: effectiveSpd,
        spe: row.spe
      },
      tags,
      row.type1Id,
      row.type2Id ?? null,
      scoringTypes.map((t) => ({ id: t.id, name: t.name, color: t.color ?? null })),
      chartRows.map((r) => ({
        attackingTypeId: r.attackingTypeId,
        defendingTypeId: r.defendingTypeId,
        multiplier: r.multiplier
      })),
      critStagePreset,
      critBaseDamageMult
    );

    return {
      ...row,
      abilityId: disableAbilities ? null : row.abilityId,
      abilityName: disableAbilities ? null : row.abilityName,
      abilityTags: disableAbilities ? null : row.abilityTags,
      itemId: disableHeldItems ? null : row.itemId,
      itemName: disableHeldItems ? null : row.itemName,
      itemTags: disableHeldItems ? null : row.itemTags,
      spd: effectiveSpd,
      type1Name: typeNameById.get(row.type1Id) ?? null,
      type2Name: row.type2Id ? typeNameById.get(row.type2Id) ?? null : null,
      potentials
    };
  });

  res.json(withScores);
});

app.post("/api/games/:id/box", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const data = boxSchema.parse(req.body);
  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  if (!game) return res.status(404).json({ error: "Game not found" });
  const disableAbilities = !!game.disableAbilities;
  const disableHeldItems = !!game.disableHeldItems;

  const [row] = await db
    .insert(boxPokemon)
    .values({
      gameId,
      speciesId: data.speciesId,
      abilityId: disableAbilities ? null : data.abilityId ?? null,
      itemId: disableHeldItems ? null : data.itemId ?? null,
      nickname: data.nickname ?? null
    })
    .returning();

  res.json(row);
});

app.put("/api/games/:id/box/:boxId", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const boxId = idSchema.parse(req.params.boxId);
  const data = boxSchema.parse(req.body);
  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  if (!game) return res.status(404).json({ error: "Game not found" });
  const disableAbilities = !!game.disableAbilities;
  const disableHeldItems = !!game.disableHeldItems;

  const [row] = await db
    .update(boxPokemon)
    .set({
      gameId,
      speciesId: data.speciesId,
      abilityId: disableAbilities ? null : data.abilityId ?? null,
      itemId: disableHeldItems ? null : data.itemId ?? null,
      nickname: data.nickname ?? null
    })
    .where(eq(boxPokemon.id, boxId))
    .returning();

  res.json(row);
});

app.put("/api/games/:id/box/:boxId/evolve", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const boxId = idSchema.parse(req.params.boxId);
  const data = evolveSchema.parse(req.body);

  const [gameRow] = await db.select().from(games).where(eq(games.id, gameId));
  if (!gameRow) return res.status(404).json({ error: "Game not found" });

  const [targetSpecies] = await db
    .select({ id: gameSpecies.id })
    .from(gameSpecies)
    .where(and(eq(gameSpecies.id, data.toSpeciesId), eq(gameSpecies.gameId, gameId)));
  if (!targetSpecies) return res.status(400).json({ error: "Target species not in this game." });

  const [allowed] = await db
    .select({ speciesId: gameAllowedSpecies.speciesId })
    .from(gameAllowedSpecies)
    .where(and(eq(gameAllowedSpecies.gameId, gameId), eq(gameAllowedSpecies.speciesId, data.toSpeciesId)));
  if (!allowed) return res.status(400).json({ error: "Target species not allowed in this game." });

  const [row] = await db
    .update(boxPokemon)
    .set({ speciesId: data.toSpeciesId, abilityId: null })
    .where(and(eq(boxPokemon.id, boxId), eq(boxPokemon.gameId, gameId)))
    .returning();

  res.json(row);
});

app.delete("/api/games/:id/box/:boxId", async (req, res) => {
  const boxId = idSchema.parse(req.params.boxId);
  await db.update(teamSlots).set({ boxPokemonId: null }).where(eq(teamSlots.boxPokemonId, boxId));
  await db.delete(boxPokemon).where(eq(boxPokemon.id, boxId));
  res.json({ ok: true });
});

app.delete("/api/games/:id/box", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  await db.update(teamSlots).set({ boxPokemonId: null }).where(eq(teamSlots.gameId, gameId));
  await db.delete(boxPokemon).where(eq(boxPokemon.gameId, gameId));
  res.json({ ok: true });
});

app.get("/api/games/:id/tracked", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (game.length === 0) return res.status(404).json({ error: "Game not found" });
  const disableAbilities = !!game[0].disableAbilities;
  const disableHeldItems = !!game[0].disableHeldItems;

  const typeRows = await db.select().from(gameTypes).where(eq(gameTypes.gameId, gameId));
  const typeNameById = new Map(typeRows.map((t) => [t.id, t.name]));

  const rows = await db
    .select({
      id: trackedBox.id,
      gameId: trackedBox.gameId,
      speciesId: trackedBox.speciesId,
      abilityId: trackedBox.abilityId,
      itemId: trackedBox.itemId,
      nickname: trackedBox.nickname,
      speciesName: gameSpecies.name,
      type1Id: gameSpecies.type1Id,
      type2Id: gameSpecies.type2Id,
      abilityName: gameAbilities.name,
      itemName: gameItems.name
    })
    .from(trackedBox)
    .innerJoin(gameSpecies, eq(trackedBox.speciesId, gameSpecies.id))
    .leftJoin(gameAbilities, eq(trackedBox.abilityId, gameAbilities.id))
    .leftJoin(gameItems, eq(trackedBox.itemId, gameItems.id))
    .where(eq(trackedBox.gameId, gameId))
    .orderBy(gameSpecies.name);

  const normalized = rows.map((row) => ({
    ...row,
    abilityId: disableAbilities ? null : row.abilityId,
    abilityName: disableAbilities ? null : row.abilityName,
    itemId: disableHeldItems ? null : row.itemId,
    itemName: disableHeldItems ? null : row.itemName,
    type1Name: typeNameById.get(row.type1Id) ?? null,
    type2Name: row.type2Id ? typeNameById.get(row.type2Id) ?? null : null
  }));

  res.json(normalized);
});

app.post("/api/games/:id/tracked", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const data = boxSchema.parse(req.body);
  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  if (!game) return res.status(404).json({ error: "Game not found" });
  const disableAbilities = !!game.disableAbilities;
  const disableHeldItems = !!game.disableHeldItems;

  const [row] = await db
    .insert(trackedBox)
    .values({
      gameId,
      speciesId: data.speciesId,
      abilityId: disableAbilities ? null : data.abilityId ?? null,
      itemId: disableHeldItems ? null : data.itemId ?? null,
      nickname: data.nickname ?? null
    })
    .returning();

  res.json(row);
});

app.delete("/api/games/:id/tracked/:trackId", async (req, res) => {
  const trackId = idSchema.parse(req.params.trackId);
  await db.delete(trackedBox).where(eq(trackedBox.id, trackId));
  res.json({ ok: true });
});

app.delete("/api/games/:id/tracked", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  await db.delete(trackedBox).where(eq(trackedBox.gameId, gameId));
  res.json({ ok: true });
});

app.post("/api/games/:id/tracked/:trackId/send", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const trackId = idSchema.parse(req.params.trackId);
  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  if (!game) return res.status(404).json({ error: "Game not found" });
  const disableAbilities = !!game.disableAbilities;
  const disableHeldItems = !!game.disableHeldItems;

  const [tracked] = await db
    .select()
    .from(trackedBox)
    .where(and(eq(trackedBox.id, trackId), eq(trackedBox.gameId, gameId)));
  if (!tracked) return res.status(404).json({ error: "Tracked entry not found" });

  const [row] = await db
    .insert(boxPokemon)
    .values({
      gameId,
      speciesId: tracked.speciesId,
      abilityId: disableAbilities ? null : tracked.abilityId ?? null,
      itemId: disableHeldItems ? null : tracked.itemId ?? null,
      nickname: tracked.nickname ?? null
    })
    .returning();

  await db.delete(trackedBox).where(eq(trackedBox.id, trackId));
  res.json(row);
});

async function ensureTeamSlots(gameId: number) {
  const rows = await db.select().from(teamSlots).where(eq(teamSlots.gameId, gameId));
  if (rows.length === 6) return;
  await db.delete(teamSlots).where(eq(teamSlots.gameId, gameId));
  const slots = Array.from({ length: 6 }).map((_, idx) => ({
    gameId,
    slotIndex: idx + 1,
    boxPokemonId: null
  }));
  await db.insert(teamSlots).values(slots);
}

async function buildTeamData(
  gameId: number,
  overrides?: { slotIndex: number; boxPokemonId: number | null }[]
) {
  const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (game.length === 0) return null;
  const disableAbilities = !!game[0].disableAbilities;
  const disableHeldItems = !!game[0].disableHeldItems;

  await ensureTeamSlots(gameId);

  const baseSlots = await db.select().from(teamSlots).where(eq(teamSlots.gameId, gameId)).orderBy(teamSlots.slotIndex);
  const overrideMap = new Map((overrides ?? []).map((o) => [o.slotIndex, o.boxPokemonId ?? null]));
  const slots = baseSlots.map((slot) =>
    overrideMap.has(slot.slotIndex) ? { ...slot, boxPokemonId: overrideMap.get(slot.slotIndex) } : slot
  );

  const selectedIds = slots.map((s) => s.boxPokemonId).filter(Boolean) as number[];

  const memberRows = selectedIds.length
    ? await db
        .select({
          id: boxPokemon.id,
          nickname: boxPokemon.nickname,
          speciesId: boxPokemon.speciesId,
          speciesName: gameSpecies.name,
          abilityTags: gameAbilities.tags,
          itemTags: gameItems.tags,
          type1Id: gameSpecies.type1Id,
          type2Id: gameSpecies.type2Id
        })
        .from(boxPokemon)
        .innerJoin(gameSpecies, eq(boxPokemon.speciesId, gameSpecies.id))
        .leftJoin(gameAbilities, eq(boxPokemon.abilityId, gameAbilities.id))
        .leftJoin(gameItems, eq(boxPokemon.itemId, gameItems.id))
        .where(inArray(boxPokemon.id, selectedIds))
    : [];

  const typesList = await db.select().from(gameTypes).where(eq(gameTypes.gameId, gameId));
  const typeNameById = new Map(typesList.map((t) => [t.id, t.name]));
  const chartRows = await db.select().from(gameTypeEffectiveness).where(eq(gameTypeEffectiveness.gameId, gameId));
  const visibleTypes = typesList.filter((t) => !t.excludeInChart);

  const membersByBoxId = new Map(
    memberRows.map((m) => {
      const type1Id = m.type1Id;
      const type2Id = m.type2Id ?? null;
      return [
        m.id,
        {
          boxPokemonId: m.id,
          nickname: m.nickname,
          speciesName: m.speciesName,
          type1Id,
          type2Id,
          type1Name: typeNameById.get(type1Id) ?? null,
          type2Name: type2Id ? typeNameById.get(type2Id) ?? null : null,
          tags: [
            ...(disableAbilities ? [] : parseTags(m.abilityTags)),
            ...(disableHeldItems ? [] : parseTags(m.itemTags))
          ]
        }
      ];
    })
  );

  const membersForMatrix = slots.map((slot) => {
    if (!slot.boxPokemonId) return null;
    const member = membersByBoxId.get(slot.boxPokemonId);
    if (!member) return null;
    return {
      type1Id: member.type1Id,
      type2Id: member.type2Id,
      tags: member.tags
    };
  });

  const defenseMatrix = computeDefenseMatrix(
    membersForMatrix,
    visibleTypes.map((t) => ({ id: t.id, name: t.name, color: t.color ?? null })),
    chartRows.map((r) => ({
      attackingTypeId: r.attackingTypeId,
      defendingTypeId: r.defendingTypeId,
      multiplier: r.multiplier
    }))
  );

  const members = slots.map((slot) => (slot.boxPokemonId ? membersByBoxId.get(slot.boxPokemonId) ?? null : null));

  return { slots, members, defenseMatrix };
}

app.get("/api/games/:id/team", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const data = await buildTeamData(gameId);
  if (!data) return res.status(404).json({ error: "Game not found" });
  res.json(data);
});

app.put("/api/games/:id/team", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const data = teamSchema.parse(req.body);
  await ensureTeamSlots(gameId);

  for (const slot of data.slots) {
    await db
      .update(teamSlots)
      .set({ boxPokemonId: slot.boxPokemonId ?? null })
      .where(and(eq(teamSlots.gameId, gameId), eq(teamSlots.slotIndex, slot.slotIndex)));
  }

  res.json({ ok: true });
});

app.post("/api/games/:id/team/preview", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const data = teamPreviewSchema.parse(req.body);
  const slotsOverride = data.slots?.map((slot) => ({
    slotIndex: slot.slotIndex,
    boxPokemonId: slot.boxPokemonId ?? null
  }));
  const preview = await buildTeamData(gameId, slotsOverride);
  if (!preview) return res.status(404).json({ error: "Game not found" });
  res.json({ defenseMatrix: preview.defenseMatrix });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`TeamForge server listening on http://localhost:${port}`);
});
