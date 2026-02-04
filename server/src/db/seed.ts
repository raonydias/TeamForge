import { eq } from "drizzle-orm";
import { db } from "./index.js";
import {
  packs,
  packTypes,
  packTypeEffectiveness,
  packSpecies,
  packAbilities,
  packItems,
  packSpeciesAbilities,
  settings
} from "./schema.js";

const defaultWeights = {
  attack: 0.9,
  spa: 0.9,
  speed: 1.2,
  hp: 1.0,
  def: 1.0,
  spd: 1.0
};

export async function seedIfEmpty() {
  const existingPacks = await db.select().from(packs).limit(1);
  let packId: number | null = null;

  if (existingPacks.length === 0) {
    const [pack] = await db
      .insert(packs)
      .values({ name: "Canonical Core", description: "Starter pack with core types/species." })
      .returning();
    packId = pack.id;
  } else {
    packId = existingPacks[0].id;
  }

  const existingTypes = await db.select().from(packTypes).where(eq(packTypes.packId, packId!)).limit(1);
  if (existingTypes.length === 0) {
    await db.insert(packTypes).values([
      { packId: packId!, name: "Normal" },
      { packId: packId!, name: "Fire" },
      { packId: packId!, name: "Water" },
      { packId: packId!, name: "Grass" },
      { packId: packId!, name: "Electric" },
      { packId: packId!, name: "Ground" }
    ]);
  }

  const existingTypeRows = await db.select().from(packTypeEffectiveness).where(eq(packTypeEffectiveness.packId, packId!)).limit(1);
  if (existingTypeRows.length === 0) {
    const allTypes = await db.select().from(packTypes).where(eq(packTypes.packId, packId!));
    const byName = new Map(allTypes.map((t) => [t.name, t.id]));

    const pairs: { packId: number; attackingTypeId: number; defendingTypeId: number; multiplier: number }[] = [];

    for (const atk of allTypes) {
      for (const def of allTypes) {
        pairs.push({ packId: packId!, attackingTypeId: atk.id, defendingTypeId: def.id, multiplier: 1 });
      }
    }

    const set = (a: string, d: string, m: number) => {
      const aId = byName.get(a);
      const dId = byName.get(d);
      if (!aId || !dId) return;
      const row = pairs.find((p) => p.attackingTypeId === aId && p.defendingTypeId === dId);
      if (row) row.multiplier = m;
    };

    set("Fire", "Grass", 2);
    set("Fire", "Water", 0.5);
    set("Water", "Fire", 2);
    set("Water", "Grass", 0.5);
    set("Grass", "Water", 2);
    set("Grass", "Fire", 0.5);
    set("Electric", "Water", 2);
    set("Electric", "Ground", 0);
    set("Ground", "Electric", 2);
    set("Ground", "Fire", 2);
    set("Ground", "Grass", 0.5);

    await db.insert(packTypeEffectiveness).values(pairs);
  }

  const existingAbilities = await db.select().from(packAbilities).where(eq(packAbilities.packId, packId!)).limit(1);
  if (existingAbilities.length === 0) {
    await db.insert(packAbilities).values([
      { packId: packId!, name: "Overgrow", tags: JSON.stringify([]) },
      { packId: packId!, name: "Blaze", tags: JSON.stringify([]) },
      { packId: packId!, name: "Torrent", tags: JSON.stringify([]) },
      { packId: packId!, name: "Static", tags: JSON.stringify([]) },
      { packId: packId!, name: "Swift Feet", tags: JSON.stringify(["mult:speed:1.2"]) },
      { packId: packId!, name: "Rock Skin", tags: JSON.stringify(["mult:def:1.1", "resist:fire"]) }
    ]);
  }

  const existingItems = await db.select().from(packItems).where(eq(packItems.packId, packId!)).limit(1);
  if (existingItems.length === 0) {
    await db.insert(packItems).values([
      { packId: packId!, name: "Power Band", tags: JSON.stringify(["mult:atk:1.2"]) },
      { packId: packId!, name: "Insulating Boots", tags: JSON.stringify(["immune:ground"]) }
    ]);
  }

  const existingSpecies = await db.select().from(packSpecies).where(eq(packSpecies.packId, packId!)).limit(1);
  if (existingSpecies.length === 0) {
    const allTypes = await db.select().from(packTypes).where(eq(packTypes.packId, packId!));
    const byName = new Map(allTypes.map((t) => [t.name, t.id]));

    await db.insert(packSpecies).values([
      {
        packId: packId!,
        dexNumber: 1,
        name: "Bulbasaur",
        type1Id: byName.get("Grass")!,
        type2Id: null,
        hp: 45,
        atk: 49,
        def: 49,
        spa: 65,
        spd: 65,
        spe: 45
      },
      {
        packId: packId!,
        dexNumber: 4,
        name: "Charmander",
        type1Id: byName.get("Fire")!,
        type2Id: null,
        hp: 39,
        atk: 52,
        def: 43,
        spa: 60,
        spd: 50,
        spe: 65
      },
      {
        packId: packId!,
        dexNumber: 7,
        name: "Squirtle",
        type1Id: byName.get("Water")!,
        type2Id: null,
        hp: 44,
        atk: 48,
        def: 65,
        spa: 50,
        spd: 64,
        spe: 43
      },
      {
        packId: packId!,
        dexNumber: 25,
        name: "Pikachu",
        type1Id: byName.get("Electric")!,
        type2Id: null,
        hp: 35,
        atk: 55,
        def: 40,
        spa: 50,
        spd: 50,
        spe: 90
      }
    ]);
  }

  const existingSpeciesAbilities = await db
    .select()
    .from(packSpeciesAbilities)
    .where(eq(packSpeciesAbilities.packId, packId!))
    .limit(1);

  if (existingSpeciesAbilities.length === 0) {
    const speciesList = await db.select().from(packSpecies).where(eq(packSpecies.packId, packId!));
    const abilitiesList = await db.select().from(packAbilities).where(eq(packAbilities.packId, packId!));
    const speciesByName = new Map(speciesList.map((s) => [s.name, s.id]));
    const abilityByName = new Map(abilitiesList.map((a) => [a.name, a.id]));

    const rows = [
      { species: "Bulbasaur", ability: "Overgrow" },
      { species: "Charmander", ability: "Blaze" },
      { species: "Squirtle", ability: "Torrent" },
      { species: "Pikachu", ability: "Static" }
    ]
      .map((entry) => {
        const speciesId = speciesByName.get(entry.species);
        const abilityId = abilityByName.get(entry.ability);
        if (!speciesId || !abilityId) return null;
        return { packId: packId!, speciesId, abilityId, slot: "1" as const };
      })
      .filter(Boolean) as { packId: number; speciesId: number; abilityId: number; slot: "1" }[];

    if (rows.length > 0) {
      await db.insert(packSpeciesAbilities).values(rows);
    }
  }

  const existingSettings = await db.select().from(settings).limit(1);
  if (existingSettings.length === 0) {
    await db.insert(settings).values(
      Object.entries(defaultWeights).map(([key, value]) => ({
        key: `weight.${key}`,
        value: String(value)
      }))
    );
  }
}
