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
  offense: number;
  defense: number;
  boxRank: number;
  balanceInvalid: boolean;
  critExpectedMult: number;
  critChance: number;
  critDamageMult: number;
  critStage: number;
  critTagsApplied: boolean;
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

const scoringDefaults = {
  speedWeight: 0.6,
  stabPower: 1.5,
  typeDefExponent: 0.65,
  stabExponent: 0.6
};

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

export function computePotentials(
  stats: BaseStats,
  tags: string[],
  type1Id: number,
  type2Id: number | null,
  typesList: TypeInfo[],
  chartRows: TypeChartRow[],
  critStagePreset: string,
  critBaseDamageMult: number,
  critBaseChance?: number
): Potentials {
  const adjusted = applyStatMultipliers(stats, tags);

  const chartMap = new Map<string, number>();
  for (const row of chartRows) {
    chartMap.set(`${row.attackingTypeId}-${row.defendingTypeId}`, row.multiplier);
  }

  const typesCount = typesList.length || 1;

  let incomingSum = 0;
  for (const atk of typesList) {
    let mult = chartMap.get(`${atk.id}-${type1Id}`) ?? 1;
    if (type2Id) {
      mult *= chartMap.get(`${atk.id}-${type2Id}`) ?? 1;
    }
    mult *= tagMultiplierForType(tags, atk.name);
    incomingSum += mult ** 2;
  }
  const avgIncoming = incomingSum / typesCount;
  const safeIncoming = avgIncoming > 0 ? avgIncoming : 1e-6;
  const typeDef = 1 / Math.sqrt(safeIncoming);
  const typeDefAdj = Math.pow(typeDef, scoringDefaults.typeDefExponent);

  const bulkPhys = Math.sqrt(adjusted.hp * adjusted.def);
  const bulkSpec = Math.sqrt(adjusted.hp * adjusted.spd);

  const speedWeight = scoringDefaults.speedWeight;
  const baseOffPhys = (1 - speedWeight) * adjusted.atk + speedWeight * adjusted.spe;
  const baseOffSpec = (1 - speedWeight) * adjusted.spa + speedWeight * adjusted.spe;

  let stabSum = 0;
  for (const def of typesList) {
    const m1 = chartMap.get(`${type1Id}-${def.id}`) ?? 1;
    let best = m1;
    if (type2Id) {
      const m2 = chartMap.get(`${type2Id}-${def.id}`) ?? 1;
      best = Math.max(m1, m2);
    }
    stabSum += best ** scoringDefaults.stabPower;
  }
  const avgStab = stabSum / typesCount;
  const stabCov = Math.pow(avgStab, 1 / scoringDefaults.stabPower);
  const stabAdj = Math.pow(stabCov, scoringDefaults.stabExponent);

  const critInfo = computeCritExpectedMult(tags, critStagePreset, critBaseDamageMult, critBaseChance);
  const offensivePhysical = baseOffPhys * stabAdj * critInfo.expectedMult;
  const offensiveSpecial = baseOffSpec * stabAdj * critInfo.expectedMult;
  const defensivePhysical = bulkPhys * typeDefAdj;
  const defensiveSpecial = bulkSpec * typeDefAdj;

  const off = 0.75 * Math.max(offensivePhysical, offensiveSpecial) + 0.25 * ((offensivePhysical + offensiveSpecial) / 2);
  const def = 0.75 * Math.max(defensivePhysical, defensiveSpecial) + 0.25 * ((defensivePhysical + defensiveSpecial) / 2);

  const boxRankRaw = 0.56 * off + 0.44 * def;
  const maxSide = Math.max(off, def);
  const balanceInvalid = maxSide === 0;
  const balance = balanceInvalid ? 1 : Math.min(off, def) / maxSide;
  const boxRank = boxRankRaw * (0.88 + 0.12 * balance);

  return {
    offensivePhysical,
    offensiveSpecial,
    defensivePhysical,
    defensiveSpecial,
    offense: off,
    defense: def,
    boxRank,
    balanceInvalid,
    critExpectedMult: critInfo.expectedMult,
    critChance: critInfo.chance,
    critDamageMult: critInfo.damageMult,
    critStage: critInfo.stage,
    critTagsApplied: critInfo.tagsApplied
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

const critStagePresets: Record<string, number[]> = {
  gen2: [17 / 256, 1 / 8, 1 / 4, 85 / 256, 1 / 2],
  gen3_5: [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2],
  gen6: [1 / 16, 1 / 8, 1 / 2, 1],
  gen7: [1 / 24, 1 / 8, 1 / 2, 1]
};

function computeCritExpectedMult(
  tags: string[],
  presetKey: string,
  baseDamageMult: number,
  fallbackBaseChance?: number
) {
  let chanceBonus = 0;
  let damageBonusMult = 1;
  let stageBonus = 0;
  let tagsApplied = false;

  for (const rawTag of tags) {
    const tag = rawTag.trim();
    if (!tag.toLowerCase().startsWith("crit:")) continue;
    const parts = tag.split(":");
    if (parts.length !== 3) continue;
    const kind = parts[1]?.toLowerCase();
    const value = parts[2]?.trim();
    if (!value) continue;
    if (kind === "chance") {
      const normalized = value.startsWith("+") ? value.slice(1) : value;
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) {
        chanceBonus += parsed;
        tagsApplied = true;
      }
    }
    if (kind === "damage") {
      const normalized = value.startsWith("x") || value.startsWith("X") ? value.slice(1) : value;
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) {
        damageBonusMult *= parsed;
        tagsApplied = true;
      }
    }
    if (kind === "stage") {
      const normalized = value.startsWith("+") ? value.slice(1) : value;
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) {
        stageBonus += parsed;
        tagsApplied = true;
      }
    }
  }

  const preset = critStagePresets[presetKey] ?? critStagePresets.gen7;
  const maxStage = Math.max(0, preset.length - 1);
  const stage = Math.max(0, Math.min(maxStage, Math.floor(stageBonus)));
  const baseChance = preset[stage] ?? fallbackBaseChance ?? 1 / 24;
  const chance = Math.max(0, Math.min(1, baseChance + chanceBonus));
  const damageMult = baseDamageMult * damageBonusMult;
  const expectedMult = 1 + chance * (damageMult - 1);

  return { chance, damageMult, expectedMult, tagsApplied, stage };
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
