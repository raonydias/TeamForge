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

function applyStatMultipliers(stats: BaseStats, multipliers: Record<keyof BaseStats, number>) {
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
  const typeNameById = new Map(typesList.map((t) => [t.id, t.name.toLowerCase()]));
  const typeNames = new Set<string>();
  const type1Name = typeNameById.get(type1Id);
  const type2Name = type2Id ? typeNameById.get(type2Id) : null;
  if (type1Name) typeNames.add(type1Name);
  if (type2Name) typeNames.add(type2Name);

  const tagEffects = parseTagEffects(tags, typeNames);
  const adjusted = applyStatMultipliers(stats, tagEffects.statMultipliers);

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
    const inType = tagEffects.inTypeMult.get(atk.name.toLowerCase());
    if (inType) mult *= inType;
    if (tagEffects.hasWonderGuard && mult <= 1) {
      mult = 0;
    }
    incomingSum += mult ** 2;
  }
  const avgIncoming = incomingSum / typesCount;
  const safeIncoming = avgIncoming > 0 ? avgIncoming : 1e-6;
  const typeDef = 1 / Math.sqrt(safeIncoming);
  const typeDefAdj = Math.pow(typeDef, scoringDefaults.typeDefExponent);

  const bulkPhys = Math.sqrt(adjusted.hp * adjusted.def) * tagEffects.defEffMult;
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
  const offMult = tagEffects.offMult * tagEffects.offTypeMult;
  const offensivePhysical = baseOffPhys * stabAdj * critInfo.expectedMult * offMult;
  const offensiveSpecial = baseOffSpec * stabAdj * critInfo.expectedMult * offMult;
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

function tagMultiplierForType(tags: string[], typeName: string, options?: { treatInTypeAsResist?: boolean }) {
  const normalized = typeName.toLowerCase();
  let multiplier = 1;

  for (const rawTag of tags) {
    const parts = rawTag.split(":").map((part) => part.trim());
    const kind = parts[0]?.toLowerCase();
    if (!kind) continue;

    if (kind === "immune" && parts[1]?.toLowerCase() === normalized) {
      return 0;
    }
    if (kind === "resist" && parts[1]?.toLowerCase() === normalized) {
      multiplier *= 0.5;
    }
    if (kind === "weak" && parts[1]?.toLowerCase() === normalized) {
      multiplier *= 2;
    }
    if (
      options?.treatInTypeAsResist &&
      kind === "mult" &&
      parts[1]?.toLowerCase() === "in_type" &&
      parts[2]?.toLowerCase() === normalized
    ) {
      multiplier *= 0.5;
    }
  }

  return multiplier;
}

function parseTagEffects(tags: string[], typeNames: Set<string>) {
  const statMultipliers: Record<keyof BaseStats, number> = {
    hp: 1,
    atk: 1,
    def: 1,
    spa: 1,
    spd: 1,
    spe: 1
  };
  let defEffMult = 1;
  let offMult = 1;
  let offTypeMult = 1;
  const inTypeMult = new Map<string, number>();
  let hasWonderGuard = false;

  for (const rawTag of tags) {
    const tag = rawTag.trim();
    if (!tag) continue;
    const parts = tag.split(":").map((part) => part.trim());
    const kind = parts[0]?.toLowerCase();
    if (!kind) continue;

    if (kind === "flag" || kind === "special") {
      if (parts[1]?.toLowerCase() === "wonder_guard") {
        hasWonderGuard = true;
      }
      continue;
    }

    if (kind !== "mult") continue;

    const second = parts[1]?.toLowerCase();
    if (!second) continue;

    if (second === "defeff") {
      const parsed = Number(parts[2]);
      if (Number.isFinite(parsed)) defEffMult *= parsed;
      continue;
    }

    if (second === "off") {
      const parsed = Number(parts[2]);
      if (Number.isFinite(parsed)) offMult *= parsed;
      continue;
    }

    if (second === "off_type") {
      const typeName = parts[2]?.toLowerCase();
      const parsed = Number(parts[3]);
      if (!typeName || !Number.isFinite(parsed)) continue;
      if (typeNames.has(typeName)) offTypeMult *= parsed;
      continue;
    }

    if (second === "in_type") {
      const typeName = parts[2]?.toLowerCase();
      const parsed = Number(parts[3]);
      if (!typeName || !Number.isFinite(parsed)) continue;
      const current = inTypeMult.get(typeName) ?? 1;
      inTypeMult.set(typeName, current * parsed);
      continue;
    }

    if (second === "stat_if_type") {
      const stat = parts[2]?.toLowerCase() as keyof BaseStats | undefined;
      const typeName = parts[3]?.toLowerCase();
      const parsed = Number(parts[4]);
      if (!stat || !(stat in statMultipliers)) continue;
      if (!typeName || !Number.isFinite(parsed)) continue;
      if (typeNames.has(typeName)) statMultipliers[stat] *= parsed;
      continue;
    }

    if (second in statMultipliers) {
      const parsed = Number(parts[2]);
      if (Number.isFinite(parsed)) {
        statMultipliers[second as keyof BaseStats] *= parsed;
      }
    }
  }

  return { statMultipliers, defEffMult, offMult, offTypeMult, inTypeMult, hasWonderGuard };
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

      const tagMult = tagMultiplierForType(member.tags, atk.name, { treatInTypeAsResist: true });
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

      const tagMult = tagMultiplierForType(member.tags, atk.name, { treatInTypeAsResist: true });
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
