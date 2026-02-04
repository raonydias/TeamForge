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
  packSpeciesAbilities,
  packSpeciesEvolutions,
  games,
  gameSpecies,
  gameAbilities,
  gameItems,
  gameSpeciesOverrides,
  gameSpeciesAbilities,
  boxPokemon,
  teamSlots,
  settings
} from "./db/schema.js";
import { seedIfEmpty } from "./db/seed.js";
import { computePotentials, computeTeamChart, computeDefenseMatrix, parseTags } from "./scoring.js";
import { z } from "zod";
import { sql } from "drizzle-orm";

const app = express();
app.use(cors());
app.use(express.json());

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, "..", "drizzle");
migrate(db, { migrationsFolder });

await seedIfEmpty();

const idSchema = z.coerce.number().int().positive();

const packSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable()
});

const typeSchema = z.object({
  name: z.string().min(1),
  metadata: z.string().optional().nullable(),
  color: z.string().optional().nullable()
});

const typeChartSchema = z.object({
  attackingTypeId: idSchema,
  defendingTypeId: idSchema,
  multiplier: z.number().min(0).max(4)
});

const speciesSchema = z.object({
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

const gameSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional().nullable(),
  packId: idSchema
});

const allowedSchema = z.object({
  ids: z.array(idSchema)
});

const boxSchema = z.object({
  speciesId: idSchema,
  abilityId: idSchema.optional().nullable(),
  itemId: idSchema.optional().nullable(),
  nickname: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
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

// Packs
app.get("/api/packs", async (_req, res) => {
  const rows = await db.select().from(packs).orderBy(packs.name);
  res.json(rows);
});

app.post("/api/packs", async (req, res) => {
  const data = packSchema.parse(req.body);
  const [row] = await db.insert(packs).values({ name: data.name, description: data.description ?? null }).returning();
  res.json(row);
});

app.put("/api/packs/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = packSchema.parse(req.body);
  const [row] = await db
    .update(packs)
    .set({ name: data.name, description: data.description ?? null })
    .where(eq(packs.id, id))
    .returning();
  res.json(row);
});

app.delete("/api/packs/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  db.transaction((tx) => {
    const gameRows = tx.select({ id: games.id }).from(games).where(eq(games.packId, id)).all();
    const gameIds = gameRows.map((g) => g.id);

    if (gameIds.length > 0) {
      tx.delete(teamSlots).where(inArray(teamSlots.gameId, gameIds)).run();
      tx.delete(boxPokemon).where(inArray(boxPokemon.gameId, gameIds)).run();
      tx.delete(gameSpeciesAbilities).where(inArray(gameSpeciesAbilities.gameId, gameIds)).run();
      tx.delete(gameSpeciesOverrides).where(inArray(gameSpeciesOverrides.gameId, gameIds)).run();
      tx.delete(gameSpecies).where(inArray(gameSpecies.gameId, gameIds)).run();
      tx.delete(gameAbilities).where(inArray(gameAbilities.gameId, gameIds)).run();
      tx.delete(gameItems).where(inArray(gameItems.gameId, gameIds)).run();
      tx.delete(games).where(inArray(games.id, gameIds)).run();
    }

    tx.delete(packSpeciesAbilities).where(eq(packSpeciesAbilities.packId, id)).run();
    tx.delete(packSpeciesEvolutions).where(eq(packSpeciesEvolutions.packId, id)).run();
    tx.delete(packTypeEffectiveness).where(eq(packTypeEffectiveness.packId, id)).run();
    tx.delete(packSpecies).where(eq(packSpecies.packId, id)).run();
    tx.delete(packAbilities).where(eq(packAbilities.packId, id)).run();
    tx.delete(packItems).where(eq(packItems.packId, id)).run();
    tx.delete(packTypes).where(eq(packTypes.packId, id)).run();
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
  const [gamesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(games)
    .where(eq(games.packId, packId));

  const gameRows = await db.select({ id: games.id }).from(games).where(eq(games.packId, packId));
  const gameIds = gameRows.map((g) => g.id);

  const [boxCount] = gameIds.length
    ? await db.select({ count: sql<number>`count(*)` }).from(boxPokemon).where(inArray(boxPokemon.gameId, gameIds))
    : [{ count: 0 }];
  const [teamSlotsCount] = gameIds.length
    ? await db.select({ count: sql<number>`count(*)` }).from(teamSlots).where(inArray(teamSlots.gameId, gameIds))
    : [{ count: 0 }];
  const [allowedSpeciesCount] = gameIds.length
    ? await db.select({ count: sql<number>`count(*)` }).from(gameSpecies).where(inArray(gameSpecies.gameId, gameIds))
    : [{ count: 0 }];
  const [allowedAbilitiesCount] = gameIds.length
    ? await db.select({ count: sql<number>`count(*)` }).from(gameAbilities).where(inArray(gameAbilities.gameId, gameIds))
    : [{ count: 0 }];
  const [allowedItemsCount] = gameIds.length
    ? await db.select({ count: sql<number>`count(*)` }).from(gameItems).where(inArray(gameItems.gameId, gameIds))
    : [{ count: 0 }];
  const [speciesOverridesCount] = gameIds.length
    ? await db.select({ count: sql<number>`count(*)` }).from(gameSpeciesOverrides).where(inArray(gameSpeciesOverrides.gameId, gameIds))
    : [{ count: 0 }];
  const [speciesAbilitiesCount] = gameIds.length
    ? await db.select({ count: sql<number>`count(*)` }).from(gameSpeciesAbilities).where(inArray(gameSpeciesAbilities.gameId, gameIds))
    : [{ count: 0 }];

  res.json({
    types: typesCount?.count ?? 0,
    species: speciesCount?.count ?? 0,
    abilities: abilitiesCount?.count ?? 0,
    items: itemsCount?.count ?? 0,
    games: gamesCount?.count ?? 0,
    boxPokemon: boxCount?.count ?? 0,
    teamSlots: teamSlotsCount?.count ?? 0,
    allowedSpecies: allowedSpeciesCount?.count ?? 0,
    allowedAbilities: allowedAbilitiesCount?.count ?? 0,
    allowedItems: allowedItemsCount?.count ?? 0,
    speciesOverrides: speciesOverridesCount?.count ?? 0,
    speciesAbilities: speciesAbilitiesCount?.count ?? 0
  });
});

// Pack Types & Chart
app.get("/api/packs/:id/types", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const rows = await db.select().from(packTypes).where(eq(packTypes.packId, packId)).orderBy(packTypes.name);
  res.json(rows);
});

app.post("/api/packs/:id/types", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const data = typeSchema.parse(req.body);
  try {
    const [row] = await db
      .insert(packTypes)
      .values({ packId, name: data.name, metadata: data.metadata ?? null, color: data.color ?? null })
      .returning();
    res.json(row);
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
    .set({ name: data.name, metadata: data.metadata ?? null, color: data.color ?? null })
    .where(and(eq(packTypes.id, typeId), eq(packTypes.packId, packId)))
    .returning();
  res.json(row);
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

    // Update game overrides to keep consistency
    tx
      .update(gameSpeciesOverrides)
      .set({ type1Id: normalType.id })
      .where(eq(gameSpeciesOverrides.type1Id, typeId))
      .run();

    tx
      .update(gameSpeciesOverrides)
      .set({ type2Id: null })
      .where(eq(gameSpeciesOverrides.type2Id, typeId))
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

// Pack Species
app.get("/api/packs/:id/species", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const { typesList, typeNameById } = await getPackTypesMap(packId);

  const rows = await db.select().from(packSpecies).where(eq(packSpecies.packId, packId)).orderBy(packSpecies.name);

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
  try {
    const [row] = await db
      .insert(packSpecies)
      .values({ ...data, packId, type2Id: data.type2Id ?? null })
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
  const [row] = await db
    .update(packSpecies)
    .set({ ...data, type2Id: data.type2Id ?? null })
    .where(and(eq(packSpecies.id, speciesId), eq(packSpecies.packId, packId)))
    .returning();
  res.json(row);
});

app.delete("/api/packs/:id/species/:speciesId", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const speciesId = idSchema.parse(req.params.speciesId);
  db.transaction((tx) => {
    const gamesUsingPack = tx.select({ id: games.id }).from(games).where(eq(games.packId, packId)).all();
    const gameIds = gamesUsingPack.map((g) => g.id);

    if (gameIds.length > 0) {
      const boxRows = tx
        .select({ id: boxPokemon.id })
        .from(boxPokemon)
        .where(and(inArray(boxPokemon.gameId, gameIds), eq(boxPokemon.speciesId, speciesId)))
        .all();
      const boxIds = boxRows.map((b) => b.id);

      if (boxIds.length > 0) {
        tx
          .update(teamSlots)
          .set({ boxPokemonId: null })
          .where(inArray(teamSlots.boxPokemonId, boxIds))
          .run();
        tx.delete(boxPokemon).where(inArray(boxPokemon.id, boxIds)).run();
      }

      tx.delete(gameSpeciesAbilities).where(eq(gameSpeciesAbilities.speciesId, speciesId)).run();
      tx.delete(gameSpeciesOverrides).where(eq(gameSpeciesOverrides.speciesId, speciesId)).run();
      tx.delete(gameSpecies).where(and(inArray(gameSpecies.gameId, gameIds), eq(gameSpecies.speciesId, speciesId))).run();
    }

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
    const gamesUsingPack = tx.select({ id: games.id }).from(games).where(eq(games.packId, packId)).all();
    const gameIds = gamesUsingPack.map((g) => g.id);

    if (gameIds.length > 0) {
      tx.delete(gameSpeciesAbilities).where(eq(gameSpeciesAbilities.abilityId, abilityId)).run();
      tx.delete(gameAbilities).where(and(inArray(gameAbilities.gameId, gameIds), eq(gameAbilities.abilityId, abilityId))).run();
      tx.delete(boxPokemon).where(and(inArray(boxPokemon.gameId, gameIds), eq(boxPokemon.abilityId, abilityId))).run();
    }

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
    const gamesUsingPack = tx.select({ id: games.id }).from(games).where(eq(games.packId, packId)).all();
    const gameIds = gamesUsingPack.map((g) => g.id);

    if (gameIds.length > 0) {
      tx
        .update(boxPokemon)
        .set({ itemId: null })
        .where(and(inArray(boxPokemon.gameId, gameIds), eq(boxPokemon.itemId, itemId)))
        .run();
      tx.delete(gameItems).where(and(inArray(gameItems.gameId, gameIds), eq(gameItems.itemId, itemId))).run();
    }

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
  res.json(rows);
});

app.get("/api/games/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const [row] = await db.select().from(games).where(eq(games.id, id));
  res.json(row ?? null);
});

app.post("/api/games", async (req, res) => {
  const data = gameSchema.parse(req.body);
  const [row] = await db
    .insert(games)
    .values({ name: data.name, notes: data.notes ?? null, packId: data.packId })
    .returning();

  const packSpeciesRows = await db.select({ id: packSpecies.id }).from(packSpecies).where(eq(packSpecies.packId, data.packId));
  const packAbilitiesRows = await db
    .select({ id: packAbilities.id })
    .from(packAbilities)
    .where(eq(packAbilities.packId, data.packId));
  const packItemsRows = await db.select({ id: packItems.id }).from(packItems).where(eq(packItems.packId, data.packId));

  if (packSpeciesRows.length > 0) {
    await db.insert(gameSpecies).values(packSpeciesRows.map((s) => ({ gameId: row.id, speciesId: s.id })));
  }
  if (packAbilitiesRows.length > 0) {
    await db.insert(gameAbilities).values(packAbilitiesRows.map((a) => ({ gameId: row.id, abilityId: a.id })));
  }
  if (packItemsRows.length > 0) {
    await db.insert(gameItems).values(packItemsRows.map((i) => ({ gameId: row.id, itemId: i.id })));
  }
  res.json(row);
});

app.put("/api/games/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = gameSchema.parse(req.body);
  const [row] = await db
    .update(games)
    .set({ name: data.name, notes: data.notes ?? null, packId: data.packId })
    .where(eq(games.id, id))
    .returning();
  res.json(row);
});

app.delete("/api/games/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await db.delete(teamSlots).where(eq(teamSlots.gameId, id));
  await db.delete(boxPokemon).where(eq(boxPokemon.gameId, id));
  await db.delete(gameSpeciesAbilities).where(eq(gameSpeciesAbilities.gameId, id));
  await db.delete(gameSpeciesOverrides).where(eq(gameSpeciesOverrides.gameId, id));
  await db.delete(gameSpecies).where(eq(gameSpecies.gameId, id));
  await db.delete(gameAbilities).where(eq(gameAbilities.gameId, id));
  await db.delete(gameItems).where(eq(gameItems.gameId, id));
  await db.delete(games).where(eq(games.id, id));
  res.json({ ok: true });
});

app.get("/api/games/:id/allowed-species", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const rows = await db.select().from(gameSpecies).where(eq(gameSpecies.gameId, id));
  res.json(rows.map((r) => r.speciesId));
});

app.put("/api/games/:id/allowed-species", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = allowedSchema.parse(req.body);
  await db.delete(gameSpecies).where(eq(gameSpecies.gameId, id));
  if (data.ids.length > 0) {
    await db.insert(gameSpecies).values(data.ids.map((speciesId) => ({ gameId: id, speciesId })));
  }
  res.json({ ok: true });
});

app.get("/api/games/:id/allowed-abilities", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const rows = await db.select().from(gameAbilities).where(eq(gameAbilities.gameId, id));
  res.json(rows.map((r) => r.abilityId));
});

app.put("/api/games/:id/allowed-abilities", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = allowedSchema.parse(req.body);
  await db.delete(gameAbilities).where(eq(gameAbilities.gameId, id));
  if (data.ids.length > 0) {
    await db.insert(gameAbilities).values(data.ids.map((abilityId) => ({ gameId: id, abilityId })));
  }
  res.json({ ok: true });
});

app.get("/api/games/:id/allowed-items", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const rows = await db.select().from(gameItems).where(eq(gameItems.gameId, id));
  res.json(rows.map((r) => r.itemId));
});

app.put("/api/games/:id/allowed-items", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = allowedSchema.parse(req.body);
  await db.delete(gameItems).where(eq(gameItems.gameId, id));
  if (data.ids.length > 0) {
    await db.insert(gameItems).values(data.ids.map((itemId) => ({ gameId: id, itemId })));
  }
  res.json({ ok: true });
});

app.get("/api/games/:id/dex", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const search = typeof req.query.search === "string" ? req.query.search : "";
  const typeId = typeof req.query.typeId === "string" ? Number(req.query.typeId) : null;
  const statMin = (key: string) => (typeof req.query[key] === "string" ? Number(req.query[key]) : null);

  const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (game.length === 0) return res.status(404).json({ error: "Game not found" });
  const packId = game[0].packId;

  const { typesList, typeNameById } = await getPackTypesMap(packId);

  const rows = await db
    .select({
      speciesId: packSpecies.id,
      name: packSpecies.name,
      type1Id: packSpecies.type1Id,
      type2Id: packSpecies.type2Id,
      hp: packSpecies.hp,
      atk: packSpecies.atk,
      def: packSpecies.def,
      spa: packSpecies.spa,
      spd: packSpecies.spd,
      spe: packSpecies.spe,
      oType1Id: gameSpeciesOverrides.type1Id,
      oType2Id: gameSpeciesOverrides.type2Id,
      oHp: gameSpeciesOverrides.hp,
      oAtk: gameSpeciesOverrides.atk,
      oDef: gameSpeciesOverrides.def,
      oSpa: gameSpeciesOverrides.spa,
      oSpd: gameSpeciesOverrides.spd,
      oSpe: gameSpeciesOverrides.spe
    })
    .from(gameSpecies)
    .innerJoin(packSpecies, eq(gameSpecies.speciesId, packSpecies.id))
    .leftJoin(
      gameSpeciesOverrides,
      and(eq(gameSpeciesOverrides.gameId, gameId), eq(gameSpeciesOverrides.speciesId, packSpecies.id))
    )
    .where(eq(gameSpecies.gameId, gameId))
    .orderBy(packSpecies.name);

  const normalized = rows
    .map((row) => applySpeciesOverride(row, {
      type1Id: row.oType1Id,
      type2Id: row.oType2Id,
      hp: row.oHp,
      atk: row.oAtk,
      def: row.oDef,
      spa: row.oSpa,
      spd: row.oSpd,
      spe: row.oSpe
    }))
    .map((row) => ({
      id: row.speciesId,
      name: row.name,
      type1Id: row.type1Id,
      type2Id: row.type2Id,
      hp: row.hp,
      atk: row.atk,
      def: row.def,
      spa: row.spa,
      spd: row.spd,
      spe: row.spe,
      type1Name: typeNameById.get(row.type1Id) ?? null,
      type2Name: row.type2Id ? typeNameById.get(row.type2Id) ?? null : null
    }))
    .filter((row) => (search ? row.name.toLowerCase().includes(search.toLowerCase()) : true))
    .filter((row) => (typeId ? row.type1Id === typeId || row.type2Id === typeId : true))
    .filter((row) => (statMin("minHp") ? row.hp >= statMin("minHp")! : true))
    .filter((row) => (statMin("minAtk") ? row.atk >= statMin("minAtk")! : true))
    .filter((row) => (statMin("minDef") ? row.def >= statMin("minDef")! : true))
    .filter((row) => (statMin("minSpa") ? row.spa >= statMin("minSpa")! : true))
    .filter((row) => (statMin("minSpd") ? row.spd >= statMin("minSpd")! : true))
    .filter((row) => (statMin("minSpe") ? row.spe >= statMin("minSpe")! : true));

  res.json(normalized);
});

app.get("/api/games/:id/box", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (game.length === 0) return res.status(404).json({ error: "Game not found" });
  const packId = game[0].packId;

  const { typeNameById } = await getPackTypesMap(packId);

  const rows = await db
    .select({
      id: boxPokemon.id,
      gameId: boxPokemon.gameId,
      speciesId: boxPokemon.speciesId,
      abilityId: boxPokemon.abilityId,
      itemId: boxPokemon.itemId,
      nickname: boxPokemon.nickname,
      notes: boxPokemon.notes,
      speciesName: packSpecies.name,
      type1Id: packSpecies.type1Id,
      type2Id: packSpecies.type2Id,
      hp: packSpecies.hp,
      atk: packSpecies.atk,
      def: packSpecies.def,
      spa: packSpecies.spa,
      spd: packSpecies.spd,
      spe: packSpecies.spe,
      oType1Id: gameSpeciesOverrides.type1Id,
      oType2Id: gameSpeciesOverrides.type2Id,
      oHp: gameSpeciesOverrides.hp,
      oAtk: gameSpeciesOverrides.atk,
      oDef: gameSpeciesOverrides.def,
      oSpa: gameSpeciesOverrides.spa,
      oSpd: gameSpeciesOverrides.spd,
      oSpe: gameSpeciesOverrides.spe,
      abilityName: packAbilities.name,
      abilityTags: packAbilities.tags,
      itemName: packItems.name,
      itemTags: packItems.tags
    })
    .from(boxPokemon)
    .innerJoin(packSpecies, eq(boxPokemon.speciesId, packSpecies.id))
    .leftJoin(
      gameSpeciesOverrides,
      and(eq(gameSpeciesOverrides.gameId, gameId), eq(gameSpeciesOverrides.speciesId, packSpecies.id))
    )
    .leftJoin(packAbilities, eq(boxPokemon.abilityId, packAbilities.id))
    .leftJoin(packItems, eq(boxPokemon.itemId, packItems.id))
    .where(eq(boxPokemon.gameId, gameId))
    .orderBy(packSpecies.name);

  const withScores = await Promise.all(
    rows.map(async (row) => {
      const effective = applySpeciesOverride(row, {
        type1Id: row.oType1Id,
        type2Id: row.oType2Id,
        hp: row.oHp,
        atk: row.oAtk,
        def: row.oDef,
        spa: row.oSpa,
        spd: row.oSpd,
        spe: row.oSpe
      });

      const tags = [...parseTags(row.abilityTags), ...parseTags(row.itemTags)];
      const potentials = await computePotentials(
        {
          hp: effective.hp,
          atk: effective.atk,
          def: effective.def,
          spa: effective.spa,
          spd: effective.spd,
          spe: effective.spe
        },
        tags
      );

      return {
        ...row,
        type1Id: effective.type1Id,
        type2Id: effective.type2Id,
        hp: effective.hp,
        atk: effective.atk,
        def: effective.def,
        spa: effective.spa,
        spd: effective.spd,
        spe: effective.spe,
        type1Name: typeNameById.get(effective.type1Id) ?? null,
        type2Name: effective.type2Id ? typeNameById.get(effective.type2Id) ?? null : null,
        potentials
      };
    })
  );

  res.json(withScores);
});

app.post("/api/games/:id/box", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const data = boxSchema.parse(req.body);

  const [row] = await db
    .insert(boxPokemon)
    .values({
      gameId,
      speciesId: data.speciesId,
      abilityId: data.abilityId ?? null,
      itemId: data.itemId ?? null,
      nickname: data.nickname ?? null,
      notes: data.notes ?? null
    })
    .returning();

  res.json(row);
});

app.put("/api/games/:id/box/:boxId", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const boxId = idSchema.parse(req.params.boxId);
  const data = boxSchema.parse(req.body);

  const [row] = await db
    .update(boxPokemon)
    .set({
      gameId,
      speciesId: data.speciesId,
      abilityId: data.abilityId ?? null,
      itemId: data.itemId ?? null,
      nickname: data.nickname ?? null,
      notes: data.notes ?? null
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
    .select({ id: packSpecies.id })
    .from(packSpecies)
    .where(and(eq(packSpecies.id, data.toSpeciesId), eq(packSpecies.packId, gameRow.packId)));
  if (!targetSpecies) return res.status(400).json({ error: "Target species not in this pack." });

  const [allowed] = await db
    .select({ speciesId: gameSpecies.speciesId })
    .from(gameSpecies)
    .where(and(eq(gameSpecies.gameId, gameId), eq(gameSpecies.speciesId, data.toSpeciesId)));
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
  const packId = game[0].packId;

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
          speciesName: packSpecies.name,
          abilityTags: packAbilities.tags,
          itemTags: packItems.tags,
          type1Id: packSpecies.type1Id,
          type2Id: packSpecies.type2Id,
          oType1Id: gameSpeciesOverrides.type1Id,
          oType2Id: gameSpeciesOverrides.type2Id
        })
        .from(boxPokemon)
        .innerJoin(packSpecies, eq(boxPokemon.speciesId, packSpecies.id))
        .leftJoin(
          gameSpeciesOverrides,
          and(eq(gameSpeciesOverrides.gameId, gameId), eq(gameSpeciesOverrides.speciesId, packSpecies.id))
        )
        .leftJoin(packAbilities, eq(boxPokemon.abilityId, packAbilities.id))
        .leftJoin(packItems, eq(boxPokemon.itemId, packItems.id))
        .where(inArray(boxPokemon.id, selectedIds))
    : [];

  const { typesList, typeNameById } = await getPackTypesMap(packId);
  const chartRows = await db.select().from(packTypeEffectiveness).where(eq(packTypeEffectiveness.packId, packId));

  const membersByBoxId = new Map(
    memberRows.map((m) => {
      const type1Id = m.oType1Id ?? m.type1Id;
      const type2Id = m.oType2Id ?? m.type2Id ?? null;
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
          tags: [...parseTags(m.abilityTags), ...parseTags(m.itemTags)]
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
    typesList.map((t) => ({ id: t.id, name: t.name, color: t.color ?? null })),
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
