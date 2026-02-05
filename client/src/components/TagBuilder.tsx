import { useEffect, useMemo, useState } from "react";
import { Button, GhostButton, Input, Select } from "./ui";

type TagBuilderProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
  types: string[];
  species: string[];
  allowedKinds?: TagKind[];
};

type TagKind =
  | "mult_stat"
  | "mult_defeff"
  | "mult_spdeff"
  | "mult_off"
  | "mult_defense"
  | "mult_off_type"
  | "mult_in_type"
  | "mult_stat_if_type"
  | "immune"
  | "resist"
  | "weak"
  | "evolution_item"
  | "evolution_stone"
  | "species"
  | "crit_chance"
  | "crit_damage"
  | "crit_stage"
  | "flag_wonder_guard"
  | "flag_avoid";

const tagKinds: { id: TagKind; label: string }[] = [
  { id: "mult_stat", label: "Stat multiplier" },
  { id: "mult_defeff", label: "Defensive bulk (phys)" },
  { id: "mult_spdeff", label: "Defensive bulk (spec)" },
  { id: "mult_off", label: "Offense multiplier" },
  { id: "mult_defense", label: "Defense multiplier" },
  { id: "mult_off_type", label: "Offense by type" },
  { id: "mult_in_type", label: "Incoming by type" },
  { id: "mult_stat_if_type", label: "Stat if type" },
  { id: "immune", label: "Immune to type" },
  { id: "resist", label: "Resist type" },
  { id: "weak", label: "Weak to type" },
  { id: "evolution_item", label: "Evolution item" },
  { id: "evolution_stone", label: "Evolution stone" },
  { id: "species", label: "Species tag" },
  { id: "crit_chance", label: "Crit chance" },
  { id: "crit_damage", label: "Crit damage" },
  { id: "crit_stage", label: "Crit stage" },
  { id: "flag_wonder_guard", label: "Wonder Guard flag" },
  { id: "flag_avoid", label: "Avoid flag" }
];

const tagPatternsByKind: Record<TagKind, string> = {
  mult_stat: "mult:stat:multiplier",
  mult_defeff: "mult:defeff:N",
  mult_spdeff: "mult:spdeff:N",
  mult_off: "mult:off:N",
  mult_defense: "mult:defense:N",
  mult_off_type: "mult:off_type:type:N",
  mult_in_type: "mult:in_type:type:N",
  mult_stat_if_type: "mult:stat_if_type:stat:type:N",
  immune: "immune:type",
  resist: "resist:type",
  weak: "weak:type",
  evolution_item: "evolution:item",
  evolution_stone: "evolution:stone",
  species: "species:name",
  crit_chance: "crit:chance:+N",
  crit_damage: "crit:damage:xN",
  crit_stage: "crit:stage:+N",
  flag_wonder_guard: "flag:wonder_guard",
  flag_avoid: "flag:avoid"
};

const statOptions = ["hp", "atk", "def", "spa", "spd", "spe"];

function parseTags(input: string) {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function TagBuilder({ tags, onChange, types, species, allowedKinds }: TagBuilderProps) {
  const availableKinds = useMemo(() => {
    if (!allowedKinds || allowedKinds.length === 0) return tagKinds.map((k) => k.id);
    return allowedKinds;
  }, [allowedKinds]);
  const kindOptions = useMemo(
    () => tagKinds.filter((k) => availableKinds.includes(k.id)),
    [availableKinds]
  );
  const patternList = useMemo(
    () => kindOptions.map((opt) => tagPatternsByKind[opt.id]),
    [kindOptions]
  );
  const [kind, setKind] = useState<TagKind>(availableKinds[0] ?? "mult_stat");
  const [stat, setStat] = useState("atk");
  const [typeName, setTypeName] = useState("");
  const [speciesName, setSpeciesName] = useState("");
  const [value, setValue] = useState("");
  const [rawVisible, setRawVisible] = useState(false);
  const [rawText, setRawText] = useState("");

  useEffect(() => {
    setRawText(tags.join(", "));
  }, [tags]);

  useEffect(() => {
    if (availableKinds.includes(kind)) return;
    setKind(availableKinds[0] ?? "mult_stat");
  }, [availableKinds, kind]);

  useEffect(() => {
    if (!typeName && types.length > 0) setTypeName(types[0]);
  }, [types, typeName]);

  useEffect(() => {
    if (!speciesName && species.length > 0) setSpeciesName(species[0]);
  }, [species, speciesName]);

  const chips = useMemo(() => tags, [tags]);

  const addTag = () => {
    let built = "";
    switch (kind) {
      case "mult_stat":
        if (!stat || !value) return;
        built = `mult:${stat}:${value}`;
        break;
      case "mult_defeff":
        if (!value) return;
        built = `mult:defeff:${value}`;
        break;
      case "mult_spdeff":
        if (!value) return;
        built = `mult:spdeff:${value}`;
        break;
      case "mult_off":
        if (!value) return;
        built = `mult:off:${value}`;
        break;
      case "mult_defense":
        if (!value) return;
        built = `mult:defense:${value}`;
        break;
      case "mult_off_type":
        if (!typeName || !value) return;
        built = `mult:off_type:${typeName}:${value}`;
        break;
      case "mult_in_type":
        if (!typeName || !value) return;
        built = `mult:in_type:${typeName}:${value}`;
        break;
      case "mult_stat_if_type":
        if (!stat || !typeName || !value) return;
        built = `mult:stat_if_type:${stat}:${typeName}:${value}`;
        break;
      case "immune":
        if (!typeName) return;
        built = `immune:${typeName}`;
        break;
      case "resist":
        if (!typeName) return;
        built = `resist:${typeName}`;
        break;
      case "weak":
        if (!typeName) return;
        built = `weak:${typeName}`;
        break;
      case "evolution_item":
        built = "evolution:item";
        break;
      case "evolution_stone":
        built = "evolution:stone";
        break;
      case "species":
        if (!speciesName) return;
        built = `species:${speciesName}`;
        break;
      case "crit_chance":
        if (!value) return;
        built = `crit:chance:+${value.replace(/^\+/, "")}`;
        break;
      case "crit_damage":
        if (!value) return;
        built = `crit:damage:x${value.replace(/^x/i, "")}`;
        break;
      case "crit_stage":
        if (!value) return;
        built = `crit:stage:+${value.replace(/^\+/, "")}`;
        break;
      case "flag_wonder_guard":
        built = "flag:wonder_guard";
        break;
      case "flag_avoid":
        built = "flag:avoid";
        break;
    }

    if (!built) return;
    if (tags.includes(built)) return;
    onChange([...tags, built]);
    setValue("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {chips.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
            {tag}
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="space-y-2">
        <Select value={kind} onChange={(e) => setKind(e.target.value as TagKind)}>
          {kindOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap gap-2">
          {kind === "mult_stat" ? (
            <>
              <Select className="flex-1 min-w-[140px]" value={stat} onChange={(e) => setStat(e.target.value)}>
                {statOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Input
                className="flex-1 min-w-[140px]"
                placeholder="Multiplier"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </>
          ) : null}
          {kind === "mult_defeff" || kind === "mult_spdeff" || kind === "mult_off" || kind === "mult_defense" ? (
            <Input
              className="flex-1 min-w-[140px]"
              placeholder="Multiplier"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          ) : null}
          {kind === "mult_off_type" || kind === "mult_in_type" ? (
            <>
              <Select className="flex-[1.2] min-w-[160px]" value={typeName} onChange={(e) => setTypeName(e.target.value)}>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Input
                className="flex-1 min-w-[140px]"
                placeholder="Multiplier"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </>
          ) : null}
          {kind === "mult_stat_if_type" ? (
            <>
              <Select className="flex-[0.8] min-w-[120px]" value={stat} onChange={(e) => setStat(e.target.value)}>
                {statOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Select className="flex-[1.2] min-w-[160px]" value={typeName} onChange={(e) => setTypeName(e.target.value)}>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Input
                className="flex-1 min-w-[140px]"
                placeholder="Multiplier"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </>
          ) : null}
          {kind === "immune" || kind === "resist" || kind === "weak" ? (
            <Select className="flex-[1.2] min-w-[160px]" value={typeName} onChange={(e) => setTypeName(e.target.value)}>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          ) : null}
          {kind === "species" ? (
            <Input
              className="flex-[1.4] min-w-[200px]"
              list="species-tag-options"
              placeholder="Species"
              value={speciesName}
              onChange={(e) => setSpeciesName(e.target.value)}
            />
          ) : null}
          {kind === "crit_chance" || kind === "crit_damage" || kind === "crit_stage" ? (
            <Input
              className="flex-1 min-w-[140px]"
              placeholder="Value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          ) : null}
          {kind === "evolution_item" ||
          kind === "evolution_stone" ||
          kind === "flag_wonder_guard" ||
          kind === "flag_avoid" ? (
            <span className="text-xs text-slate-500 self-center">No extra fields</span>
          ) : null}
        </div>
      </div>
      <datalist id="species-tag-options">
        {species.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <div className="flex items-center gap-2">
        <Button type="button" onClick={addTag}>
          Add Tag
        </Button>
        <GhostButton type="button" onClick={() => setRawVisible((v) => !v)}>
          {rawVisible ? "Hide raw tags" : "Show raw tags"}
        </GhostButton>
      </div>
      {rawVisible ? (
        <div className="mt-2 space-y-2">
          <Input value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="tag, tag, tag" />
          <div className="text-xs text-slate-400">Comma-separated. Click Apply to sync.</div>
          <Button
            type="button"
            onClick={() => {
              onChange(parseTags(rawText));
            }}
          >
            Apply raw tags
          </Button>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <div className="font-semibold text-slate-600 mb-1">Available tag patterns</div>
            <div className="space-y-2">
              {patternList.map((pattern) => (
                <div key={pattern} className="rounded-md bg-white px-2 py-1">
                  <span className="block truncate max-w-[260px]" title={pattern}>
                    {pattern}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
