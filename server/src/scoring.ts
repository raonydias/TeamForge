import { db } from "./db/index.js";
import { settings } from "./db/schema.js";

export type BaseStats = {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
};

export type Potentials = {
  offensivePhysical: number;
  offensiveSpecial: number;
  defensivePhysical: number;
  defensiveSpecial: number;
  overall: number;
};

export type TypeChartRow = {
  attackingTypeId: number;
  defendingTypeId: number;
  multiplier: number;
};

export type TypeInfo = {
  id: number;
  name: string;
  color?: string | null;
};

export type TeamMember = {
  type1Id: number;
  type2Id: number | null;
  tags: string[];
};

const defaultWeights = {
  attack: 0.9,
  spa: 0.9,
  speed: 1.2,
  hp: 1.0,
  def: 1.0,
  spd: 1.0
};

export async function loadWeights() {
  const rows = await db.select().from(settings);
  const map = new Map(rows.map((r) => [r.key, Number(r.value)]));
  return {
    attack: map.get("weight.attack") ?? defaultWeights.attack,
    spa: map.get("weight.spa") ?? defaultWeights.spa,
    speed: map.get("weight.speed") ?? defaultWeights.speed,
    hp: map.get("weight.hp") ?? defaultWeights.hp,
    def: map.get("weight.def") ?? defaultWeights.def,
    spd: map.get("weight.spd") ?? defaultWeights.spd
  };
}

export function parseTags(raw: string | null | undefined) {
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    return [] as string[];
  }
  return [] as string[];
}

function applyStatMultipliers(stats: BaseStats, tags: string[]) {
  const multipliers: Record<keyof BaseStats, number> = {
    hp: 1,
    atk: 1,
    def: 1,
    spa: 1,
    spd: 1,
    spe: 1
  };

  for (const tag of tags) {
    const parts = tag.split(":");
    if (parts.length === 3 && parts[0] === "mult") {
      const stat = parts[1];
      const value = Number(parts[2]);
      if (Number.isFinite(value)) {
        if (stat === "hp") multipliers.hp *= value;
        if (stat === "atk") multipliers.atk *= value;
        if (stat === "def") multipliers.def *= value;
        if (stat === "spa") multipliers.spa *= value;
        if (stat === "spd") multipliers.spd *= value;
        if (stat === "speed" || stat === "spe") multipliers.spe *= value;
      }
    }
  }

  return {
    hp: stats.hp * multipliers.hp,
    atk: stats.atk * multipliers.atk,
    def: stats.def * multipliers.def,
    spa: stats.spa * multipliers.spa,
    spd: stats.spd * multipliers.spd,
    spe: stats.spe * multipliers.spe
  };
}

export async function computePotentials(stats: BaseStats, tags: string[]): Promise<Potentials> {
  const weights = await loadWeights();
  const adjusted = applyStatMultipliers(stats, tags);

  const offensivePhysical = adjusted.atk * weights.attack + adjusted.spe * weights.speed;
  const offensiveSpecial = adjusted.spa * weights.spa + adjusted.spe * weights.speed;
  const defensivePhysical = adjusted.hp * weights.hp + adjusted.def * weights.def;
  const defensiveSpecial = adjusted.hp * weights.hp + adjusted.spd * weights.spd;

  const overall = (offensivePhysical + offensiveSpecial + defensivePhysical + defensiveSpecial) / 4;

  return {
    offensivePhysical,
    offensiveSpecial,
    defensivePhysical,
    defensiveSpecial,
    overall
  };
}

function tagMultiplierForType(tags: string[], typeName: string) {
  const normalized = typeName.toLowerCase();
  let multiplier = 1;
  for (const tag of tags) {
    const [kind, tagType] = tag.split(":");
    if (!tagType) continue;
    if (tagType.toLowerCase() !== normalized) continue;
    if (kind === "immune") return 0;
    if (kind === "resist") multiplier *= 0.5;
    if (kind === "weak") multiplier *= 2;
  }
  return multiplier;
}

export function computeTeamChart(
  members: TeamMember[],
  typesList: TypeInfo[],
  chartRows: TypeChartRow[]
) {
  const chartMap = new Map<string, number>();
  for (const row of chartRows) {
    chartMap.set(`${row.attackingTypeId}-${row.defendingTypeId}`, row.multiplier);
  }

  return typesList.map((atk) => {
    let weak = 0;
    let resist = 0;
    let immune = 0;

    for (const member of members) {
      let mult = 1;
      const typeIds = [member.type1Id, member.type2Id].filter(Boolean) as number[];
      for (const defId of typeIds) {
        const value = chartMap.get(`${atk.id}-${defId}`) ?? 1;
        mult *= value;
      }

      const tagMult = tagMultiplierForType(member.tags, atk.name);
      mult *= tagMult;

      if (mult === 0) immune += 1;
      else if (mult > 1) weak += 1;
      else if (mult < 1) resist += 1;
    }

    return {
      attackingTypeId: atk.id,
      attackingTypeName: atk.name,
      weak,
      resist,
      immune
    };
  });
}

export function computeDefenseMatrix(
  members: (TeamMember | null)[],
  typesList: TypeInfo[],
  chartRows: TypeChartRow[]
) {
  const chartMap = new Map<string, number>();
  for (const row of chartRows) {
    chartMap.set(`${row.attackingTypeId}-${row.defendingTypeId}`, row.multiplier);
  }

  return typesList.map((atk) => {
    let weak = 0;
    let resist = 0;

    const multipliers = members.map((member) => {
      if (!member) return null;
      let mult = 1;
      const typeIds = [member.type1Id, member.type2Id].filter(Boolean) as number[];
      for (const defId of typeIds) {
        const value = chartMap.get(`${atk.id}-${defId}`) ?? 1;
        mult *= value;
      }

      const tagMult = tagMultiplierForType(member.tags, atk.name);
      mult *= tagMult;

      if (mult > 1) weak += 1;
      else if (mult < 1) resist += 1;

      return mult;
    });

    return {
      attackingTypeId: atk.id,
      attackingTypeName: atk.name,
      attackingTypeColor: atk.color ?? null,
      multipliers,
      totalWeak: weak,
      totalResist: resist
    };
  });
}
