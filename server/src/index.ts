import express from "express";
import cors from "cors";
import { and, eq, inArray, like, gte, or } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "node:path";
import { db } from "./db/index.js";
import {
  abilities,
  boxPokemon,
  gameAbilities,
  gameItems,
  gameSpecies,
  games,
  items,
  species,
  teamSlots,
  typeEffectiveness,
  types
} from "./db/schema.js";
import { seedIfEmpty } from "./db/seed.js";
import { computePotentials, computeTeamChart, parseTags } from "./scoring.js";
import { z } from "zod";

const app = express();
app.use(cors());
app.use(express.json());

const primaryMigrations = resolve(process.cwd(), "server", "drizzle");
const fallbackMigrations = resolve(process.cwd(), "drizzle");
try {
  migrate(db, { migrationsFolder: primaryMigrations });
} catch {
  migrate(db, { migrationsFolder: fallbackMigrations });
}

await seedIfEmpty();

const idSchema = z.coerce.number().int().positive();

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

const gameSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional().nullable()
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

const type1 = alias(types, "type1");
const type2 = alias(types, "type2");

app.get("/api/types", async (_req, res) => {
  const rows = await db.select().from(types).orderBy(types.name);
  res.json(rows);
});

app.post("/api/types", async (req, res) => {
  const data = typeSchema.parse(req.body);
  const [row] = await db.insert(types).values({ name: data.name, metadata: data.metadata ?? null }).returning();
  res.json(row);
});

app.put("/api/types/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = typeSchema.parse(req.body);
  const [row] = await db
    .update(types)
    .set({ name: data.name, metadata: data.metadata ?? null })
    .where(eq(types.id, id))
    .returning();
  res.json(row);
});

app.delete("/api/types/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await db.delete(types).where(eq(types.id, id));
  res.json({ ok: true });
});

app.get("/api/typechart", async (_req, res) => {
  const rows = await db.select().from(typeEffectiveness);
  res.json(rows);
});

app.post("/api/typechart", async (req, res) => {
  const data = typeChartSchema.parse(req.body);
  await db
    .insert(typeEffectiveness)
    .values(data)
    .onConflictDoUpdate({
      target: [typeEffectiveness.attackingTypeId, typeEffectiveness.defendingTypeId],
      set: { multiplier: data.multiplier }
    });
  res.json({ ok: true });
});

app.get("/api/species", async (_req, res) => {
  const rows = await db
    .select({
      id: species.id,
      name: species.name,
      type1Id: species.type1Id,
      type2Id: species.type2Id,
      hp: species.hp,
      atk: species.atk,
      def: species.def,
      spa: species.spa,
      spd: species.spd,
      spe: species.spe,
      type1Name: type1.name,
      type2Name: type2.name
    })
    .from(species)
    .leftJoin(type1, eq(species.type1Id, type1.id))
    .leftJoin(type2, eq(species.type2Id, type2.id))
    .orderBy(species.name);
  res.json(rows);
});

app.post("/api/species", async (req, res) => {
  const data = speciesSchema.parse(req.body);
  const [row] = await db.insert(species).values({
    ...data,
    type2Id: data.type2Id ?? null
  }).returning();
  res.json(row);
});

app.put("/api/species/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = speciesSchema.parse(req.body);
  const [row] = await db
    .update(species)
    .set({ ...data, type2Id: data.type2Id ?? null })
    .where(eq(species.id, id))
    .returning();
  res.json(row);
});

app.delete("/api/species/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await db.delete(species).where(eq(species.id, id));
  res.json({ ok: true });
});

app.get("/api/abilities", async (_req, res) => {
  const rows = await db.select().from(abilities).orderBy(abilities.name);
  res.json(rows);
});

app.post("/api/abilities", async (req, res) => {
  const data = tagSchema.parse(req.body);
  const [row] = await db
    .insert(abilities)
    .values({ name: data.name, tags: JSON.stringify(data.tags ?? []) })
    .returning();
  res.json(row);
});

app.put("/api/abilities/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = tagSchema.parse(req.body);
  const [row] = await db
    .update(abilities)
    .set({ name: data.name, tags: JSON.stringify(data.tags ?? []) })
    .where(eq(abilities.id, id))
    .returning();
  res.json(row);
});

app.delete("/api/abilities/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await db.delete(abilities).where(eq(abilities.id, id));
  res.json({ ok: true });
});

app.get("/api/items", async (_req, res) => {
  const rows = await db.select().from(items).orderBy(items.name);
  res.json(rows);
});

app.post("/api/items", async (req, res) => {
  const data = tagSchema.parse(req.body);
  const [row] = await db
    .insert(items)
    .values({ name: data.name, tags: JSON.stringify(data.tags ?? []) })
    .returning();
  res.json(row);
});

app.put("/api/items/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = tagSchema.parse(req.body);
  const [row] = await db
    .update(items)
    .set({ name: data.name, tags: JSON.stringify(data.tags ?? []) })
    .where(eq(items.id, id))
    .returning();
  res.json(row);
});

app.delete("/api/items/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await db.delete(items).where(eq(items.id, id));
  res.json({ ok: true });
});

app.get("/api/games", async (_req, res) => {
  const rows = await db.select().from(games).orderBy(games.name);
  res.json(rows);
});

app.post("/api/games", async (req, res) => {
  const data = gameSchema.parse(req.body);
  const [row] = await db.insert(games).values({ name: data.name, notes: data.notes ?? null }).returning();
  res.json(row);
});

app.put("/api/games/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const data = gameSchema.parse(req.body);
  const [row] = await db
    .update(games)
    .set({ name: data.name, notes: data.notes ?? null })
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

  const conditions = [eq(gameSpecies.gameId, gameId)];
  if (search) conditions.push(like(species.name, `%${search}%`));
  if (typeId) conditions.push(or(eq(species.type1Id, typeId), eq(species.type2Id, typeId)));
  const minHp = statMin("minHp");
  if (minHp) conditions.push(gte(species.hp, minHp));
  const minAtk = statMin("minAtk");
  if (minAtk) conditions.push(gte(species.atk, minAtk));
  const minDef = statMin("minDef");
  if (minDef) conditions.push(gte(species.def, minDef));
  const minSpa = statMin("minSpa");
  if (minSpa) conditions.push(gte(species.spa, minSpa));
  const minSpd = statMin("minSpd");
  if (minSpd) conditions.push(gte(species.spd, minSpd));
  const minSpe = statMin("minSpe");
  if (minSpe) conditions.push(gte(species.spe, minSpe));

  const rows = await db
    .select({
      id: species.id,
      name: species.name,
      type1Id: species.type1Id,
      type2Id: species.type2Id,
      hp: species.hp,
      atk: species.atk,
      def: species.def,
      spa: species.spa,
      spd: species.spd,
      spe: species.spe,
      type1Name: type1.name,
      type2Name: type2.name
    })
    .from(gameSpecies)
    .innerJoin(species, eq(gameSpecies.speciesId, species.id))
    .leftJoin(type1, eq(species.type1Id, type1.id))
    .leftJoin(type2, eq(species.type2Id, type2.id))
    .where(and(...conditions))
    .orderBy(species.name);

  res.json(rows);
});

app.get("/api/games/:id/box", async (req, res) => {
  const gameId = idSchema.parse(req.params.id);

  const ability = alias(abilities, "ability");
  const item = alias(items, "item");

  const rows = await db
    .select({
      id: boxPokemon.id,
      gameId: boxPokemon.gameId,
      speciesId: boxPokemon.speciesId,
      abilityId: boxPokemon.abilityId,
      itemId: boxPokemon.itemId,
      nickname: boxPokemon.nickname,
      notes: boxPokemon.notes,
      speciesName: species.name,
      type1Id: species.type1Id,
      type2Id: species.type2Id,
      hp: species.hp,
      atk: species.atk,
      def: species.def,
      spa: species.spa,
      spd: species.spd,
      spe: species.spe,
      abilityName: ability.name,
      abilityTags: ability.tags,
      itemName: item.name,
      itemTags: item.tags
    })
    .from(boxPokemon)
    .innerJoin(species, eq(boxPokemon.speciesId, species.id))
    .leftJoin(ability, eq(boxPokemon.abilityId, ability.id))
    .leftJoin(item, eq(boxPokemon.itemId, item.id))
    .where(eq(boxPokemon.gameId, gameId))
    .orderBy(species.name);

  const withScores = await Promise.all(
    rows.map(async (row) => {
      const tags = [...parseTags(row.abilityTags), ...parseTags(row.itemTags)];
      const potentials = await computePotentials(
        {
          hp: row.hp,
          atk: row.atk,
          def: row.def,
          spa: row.spa,
          spd: row.spd,
          spe: row.spe
        },
        tags
      );

      return {
        ...row,
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
  await ensureTeamSlots(gameId);

  const slots = await db.select().from(teamSlots).where(eq(teamSlots.gameId, gameId)).orderBy(teamSlots.slotIndex);
  const selectedIds = slots.map((s) => s.boxPokemonId).filter(Boolean) as number[];

  const ability = alias(abilities, "ability");
  const item = alias(items, "item");

  const members = selectedIds.length
    ? await db
        .select({
          id: boxPokemon.id,
          speciesId: boxPokemon.speciesId,
          abilityTags: ability.tags,
          itemTags: item.tags,
          type1Id: species.type1Id,
          type2Id: species.type2Id
        })
        .from(boxPokemon)
        .innerJoin(species, eq(boxPokemon.speciesId, species.id))
        .leftJoin(ability, eq(boxPokemon.abilityId, ability.id))
        .leftJoin(item, eq(boxPokemon.itemId, item.id))
        .where(inArray(boxPokemon.id, selectedIds))
    : [];

  const typeList = await db.select().from(types).orderBy(types.name);
  const chartRows = await db.select().from(typeEffectiveness);

  const teamChart = computeTeamChart(
    members.map((m) => ({
      type1Id: m.type1Id,
      type2Id: m.type2Id,
      tags: [...parseTags(m.abilityTags), ...parseTags(m.itemTags)]
    })),
    typeList,
    chartRows
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
