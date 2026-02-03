import { db } from "./index.js";
import {
  abilities,
  items,
  settings,
  species,
  typeEffectiveness,
  types
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
  const existingTypes = await db.select().from(types).limit(1);
  if (existingTypes.length === 0) {
    await db.insert(types).values([
      { name: "Normal" },
      { name: "Fire" },
      { name: "Water" },
      { name: "Grass" },
      { name: "Electric" },
      { name: "Ground" }
    ]);
  }

  const existingTypeRows = await db.select().from(typeEffectiveness).limit(1);
  if (existingTypeRows.length === 0) {
    const allTypes = await db.select().from(types);
    const byName = new Map(allTypes.map((t) => [t.name, t.id]));

    const pairs: { attackingTypeId: number; defendingTypeId: number; multiplier: number }[] = [];

    for (const atk of allTypes) {
      for (const def of allTypes) {
        pairs.push({ attackingTypeId: atk.id, defendingTypeId: def.id, multiplier: 1 });
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

    await db.insert(typeEffectiveness).values(pairs);
  }

  const existingSpecies = await db.select().from(species).limit(1);
  if (existingSpecies.length === 0) {
    const allTypes = await db.select().from(types);
    const byName = new Map(allTypes.map((t) => [t.name, t.id]));

    await db.insert(species).values([
      {
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

  const existingAbilities = await db.select().from(abilities).limit(1);
  if (existingAbilities.length === 0) {
    await db.insert(abilities).values([
      { name: "Swift Feet", tags: JSON.stringify(["mult:speed:1.2"]) },
      { name: "Rock Skin", tags: JSON.stringify(["mult:def:1.1", "resist:fire"]) }
    ]);
  }

  const existingItems = await db.select().from(items).limit(1);
  if (existingItems.length === 0) {
    await db.insert(items).values([
      { name: "Power Band", tags: JSON.stringify(["mult:atk:1.2"]) },
      { name: "Insulating Boots", tags: JSON.stringify(["immune:ground"]) }
    ]);
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