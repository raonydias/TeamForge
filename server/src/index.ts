import express from "express";
import cors from "cors";
import { and, eq, inArray, like } from "drizzle-orm";
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
import { computePotentials, computeTeamChart, parseTags } from "./scoring.js";
import { z } from "zod";

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
  metadata: z.string().optional().nullable()
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

const teamSchema = z.object({
  slots: z.array(
    z.object({
      slotIndex: z.number().int().min(1).max(6),
      boxPokemonId: idSchema.optional().nullable()
    })
  )
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
  await db.delete(packs).where(eq(packs.id, id));
  res.json({ ok: true });
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
  const [row] = await db
    .insert(packTypes)
    .values({ packId, name: data.name, metadata: data.metadata ?? null })
    .returning();
  res.json(row);
});

app.put("/api/packs/:id/types/:typeId", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const typeId = idSchema.parse(req.params.typeId);
  const data = typeSchema.parse(req.body);
  const [row] = await db
    .update(packTypes)
    .set({ name: data.name, metadata: data.metadata ?? null })
    .where(and(eq(packTypes.id, typeId), eq(packTypes.packId, packId)))
    .returning();
  res.json(row);
});

app.delete("/api/packs/:id/types/:typeId", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const typeId = idSchema.parse(req.params.typeId);
  await db.delete(packTypes).where(and(eq(packTypes.id, typeId), eq(packTypes.packId, packId)));
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
  const [row] = await db
    .insert(packSpecies)
    .values({ ...data, packId, type2Id: data.type2Id ?? null })
    .returning();
  res.json(row);
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
  await db.delete(packSpecies).where(and(eq(packSpecies.id, speciesId), eq(packSpecies.packId, packId)));
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
  const [row] = await db
    .insert(packAbilities)
    .values({ packId, name: data.name, tags: JSON.stringify(data.tags ?? []) })
    .returning();
  res.json(row);
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
  await db.delete(packAbilities).where(and(eq(packAbilities.id, abilityId), eq(packAbilities.packId, packId)));
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
  const [row] = await db
    .insert(packItems)
    .values({ packId, name: data.name, tags: JSON.stringify(data.tags ?? []) })
    .returning();
  res.json(row);
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
  await db.delete(packItems).where(and(eq(packItems.id, itemId), eq(packItems.packId, packId)));
  res.json({ ok: true });
});

// Pack Species Abilities
app.get("/api/packs/:id/species-abilities", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const rows = await db.select().from(packSpeciesAbilities).where(eq(packSpeciesAbilities.packId, packId));
  res.json(rows);
});

app.post("/api/packs/:id/species-abilities", async (req, res) => {
  const packId = idSchema.parse(req.params.id);
  const data = speciesAbilitiesSchema.parse(req.body);
  await db.delete(packSpeciesAbilities).where(and(eq(packSpeciesAbilities.packId, packId), eq(packSpeciesAbilities.speciesId, data.speciesId)));
  if (data.slots.length > 0) {
    await db.insert(packSpeciesAbilities).values(
      data.slots.map((slot) => ({
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
  const [row] = await db.insert(games).values({ name: data.name, notes: data.notes ?? null, packId: data.packId }).returning();
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

app.delete("/api/games/:id/box/:boxId", async (req, res) => {
  const boxId = idSchema.parse(req.params.boxId);
  await db.delete(boxPokemon).where(eq(boxPokemon.id, boxId));
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

app.get("/api/games/:id/team", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);
  const game = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (game.length === 0) return res.status(404).json({ error: "Game not found" });
  const packId = game[0].packId;

  await ensureTeamSlots(gameId);

  const slots = await db.select().from(teamSlots).where(eq(teamSlots.gameId, gameId)).orderBy(teamSlots.slotIndex);
  const selectedIds = slots.map((s) => s.boxPokemonId).filter(Boolean) as number[];

  const members = selectedIds.length
    ? await db
        .select({
          id: boxPokemon.id,
          speciesId: boxPokemon.speciesId,
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

  const { typesList } = await getPackTypesMap(packId);
  const chartRows = await db.select().from(packTypeEffectiveness).where(eq(packTypeEffectiveness.packId, packId));

  const teamChart = computeTeamChart(
    members.map((m) => ({
      type1Id: m.oType1Id ?? m.type1Id,
      type2Id: m.oType2Id ?? m.type2Id,
      tags: [...parseTags(m.abilityTags), ...parseTags(m.itemTags)]
    })),
    typesList.map((t) => ({ id: t.id, name: t.name })),
    chartRows.map((r) => ({
      attackingTypeId: r.attackingTypeId,
      defendingTypeId: r.defendingTypeId,
      multiplier: r.multiplier
    }))
  );

  res.json({ slots, teamChart });
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

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`TeamForge server listening on http://localhost:${port}`);
});