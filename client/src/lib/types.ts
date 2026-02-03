export type PackRow = {
  id: number;
  name: string;
  description: string | null;
};

export type PackTypeRow = {
  id: number;
  packId: number;
  name: string;
  metadata: string | null;
};

export type PackTypeChartRow = {
  packId: number;
  attackingTypeId: number;
  defendingTypeId: number;
  multiplier: number;
};

export type PackSpeciesRow = {
  id: number;
  packId: number;
  name: string;
  type1Id: number;
  type2Id: number | null;
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  type1Name?: string | null;
  type2Name?: string | null;
};

export type PackAbilityRow = {
  id: number;
  packId: number;
  name: string;
  tags: string;
};

export type PackItemRow = {
  id: number;
  packId: number;
  name: string;
  tags: string;
};

export type PackSpeciesAbilityRow = {
  packId: number;
  speciesId: number;
  abilityId: number;
  slot: "1" | "2" | "H";
};

export type GameRow = {
  id: number;
  packId: number;
  name: string;
  notes: string | null;
};

export type BoxRow = {
  id: number;
  gameId: number;
  speciesId: number;
  abilityId: number | null;
  itemId: number | null;
  nickname: string | null;
  notes: string | null;
  speciesName: string;
  type1Id: number;
  type2Id: number | null;
  type1Name?: string | null;
  type2Name?: string | null;
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  abilityName: string | null;
  abilityTags: string | null;
  itemName: string | null;
  itemTags: string | null;
  potentials: {
    offensivePhysical: number;
    offensiveSpecial: number;
    defensivePhysical: number;
    defensiveSpecial: number;
    overall: number;
  };
};

export type TeamSlot = {
  id: number;
  gameId: number;
  slotIndex: number;
  boxPokemonId: number | null;
};

export type TeamChartRow = {
  attackingTypeId: number;
  attackingTypeName: string;
  weak: number;
  resist: number;
  immune: number;
};