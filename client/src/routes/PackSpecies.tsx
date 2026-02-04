import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import {
  PackAbilityRow,
  PackItemRow,
  PackSpeciesAbilityRow,
  PackSpeciesEvolutionRow,
  PackSpeciesRow,
  PackTypeRow
} from "../lib/types";
import { Button, Card, CardHeader, Input, Select, GhostButton, TypePill } from "../components/ui";

function parseStoredTags(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

const schema = z.object({
  name: z.string().min(1),
  type1Id: z.coerce.number().int(),
  type2Id: z.coerce.number().int().optional().nullable(),
  hp: z.coerce.number().int().min(1),
  atk: z.coerce.number().int().min(1),
  def: z.coerce.number().int().min(1),
  spa: z.coerce.number().int().min(1),
  spd: z.coerce.number().int().min(1),
  spe: z.coerce.number().int().min(1)
});

type FormValues = z.infer<typeof schema>;

export default function PackSpecies() {
  const { id } = useParams();
  const packId = Number(id);
  const queryClient = useQueryClient();

  const { data: types = [] } = useQuery<PackTypeRow[]>({
    queryKey: ["packs", packId, "types"],
    queryFn: () => api.get(`/packs/${packId}/types`)
  });
  const { data: abilities = [] } = useQuery<PackAbilityRow[]>({
    queryKey: ["packs", packId, "abilities"],
    queryFn: () => api.get(`/packs/${packId}/abilities`)
  });
  const { data: items = [] } = useQuery<PackItemRow[]>({
    queryKey: ["packs", packId, "items"],
    queryFn: () => api.get(`/packs/${packId}/items`)
  });
  const { data: species = [] } = useQuery<PackSpeciesRow[]>({
    queryKey: ["packs", packId, "species"],
    queryFn: () => api.get(`/packs/${packId}/species`)
  });
  const { data: speciesAbilities = [] } = useQuery<PackSpeciesAbilityRow[]>({
    queryKey: ["packs", packId, "species-abilities"],
    queryFn: () => api.get(`/packs/${packId}/species-abilities`)
  });
  const { data: evolutions = [] } = useQuery<PackSpeciesEvolutionRow[]>({
    queryKey: ["packs", packId, "species-evolutions"],
    queryFn: () => api.get(`/packs/${packId}/species-evolutions`)
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      type1Id: types[0]?.id ?? 1,
      type2Id: null,
      hp: 50,
      atk: 50,
      def: 50,
      spa: 50,
      spd: 50,
      spe: 50
    }
  });

  useEffect(() => {
    if (types.length > 0) {
      form.setValue("type1Id", types[0].id);
    }
  }, [types, form]);

  const create = useMutation({
    mutationFn: (payload: FormValues) => api.post(`/packs/${packId}/species`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs", packId, "species"] });
      form.reset();
    }
  });

  const update = useMutation({
    mutationFn: (payload: { id: number; data: FormValues }) =>
      api.put(`/packs/${packId}/species/${payload.id}`, payload.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "species"] })
  });

  const remove = useMutation({
    mutationFn: (idValue: number) => api.del(`/packs/${packId}/species/${idValue}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "species"] })
  });

  const [editingSpeciesId, setEditingSpeciesId] = useState<number | null>(null);

  const [selectedSpeciesId, setSelectedSpeciesId] = useState<number | "">("");
  const [slot1, setSlot1] = useState<string>("");
  const [slot2, setSlot2] = useState<string>("");
  const [hiddenSlots, setHiddenSlots] = useState<number[]>([]);

  const [selectedEvolutionSpeciesId, setSelectedEvolutionSpeciesId] = useState<number | "">("");
  const [evolutionTargetId, setEvolutionTargetId] = useState<number | "">("");
  const [evolutionType, setEvolutionType] = useState<"Level" | "Item" | "Stone" | "Trade" | "Friendship" | "Custom">(
    "Level"
  );
  const [evolutionLevel, setEvolutionLevel] = useState("");
  const [evolutionItemId, setEvolutionItemId] = useState<number | "">("");
  const [evolutionFriendshipTime, setEvolutionFriendshipTime] = useState<"" | "Day" | "Night">("");
  const [evolutionCustom, setEvolutionCustom] = useState("");
  const [editingEvolutionId, setEditingEvolutionId] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedSpeciesId) return;
    const rows = speciesAbilities.filter((row) => row.speciesId === Number(selectedSpeciesId));
    setSlot1(rows.find((r) => r.slot === "1")?.abilityId?.toString() ?? "");
    setSlot2(rows.find((r) => r.slot === "2")?.abilityId?.toString() ?? "");
    setHiddenSlots(rows.filter((r) => r.slot === "H").map((r) => r.abilityId));
  }, [selectedSpeciesId, speciesAbilities]);

  useEffect(() => {
    if (!selectedEvolutionSpeciesId) return;
    setEvolutionTargetId("");
    setEvolutionType("Level");
    setEvolutionLevel("");
    setEvolutionItemId("");
    setEvolutionFriendshipTime("");
    setEvolutionCustom("");
    setEditingEvolutionId(null);
  }, [selectedEvolutionSpeciesId]);

  function buildMethod(): string | null {
    if (evolutionType === "Level") {
      const value = Number(evolutionLevel);
      if (!Number.isFinite(value) || value <= 0) return null;
      return `Level ${value}`;
    }
    if (evolutionType === "Item") {
      const item = items.find((i) => i.id === Number(evolutionItemId));
      if (!item) return null;
      return `Use ${item.name}`;
    }
    if (evolutionType === "Stone") {
      const item = items.find((i) => i.id === Number(evolutionItemId));
      if (!item) return null;
      return `Stone: ${item.name}`;
    }
    if (evolutionType === "Trade") {
      const item = items.find((i) => i.id === Number(evolutionItemId));
      return item ? `Trade with ${item.name}` : "Trade";
    }
    if (evolutionType === "Friendship") {
      return evolutionFriendshipTime ? `Friendship (${evolutionFriendshipTime})` : "Friendship";
    }
    if (evolutionType === "Custom") {
      return evolutionCustom.trim() ? evolutionCustom.trim() : null;
    }
    return null;
  }

  type ParsedMethod =
    | { type: "Level"; level: string }
    | { type: "Item"; itemName: string }
    | { type: "Stone"; itemName: string }
    | { type: "Trade"; itemName?: string }
    | { type: "Friendship"; time?: "" | "Day" | "Night" }
    | { type: "Custom"; custom: string };

  function parseMethod(method: string): ParsedMethod {
    const levelMatch = method.match(/^Level\s+(\d+)$/i);
    if (levelMatch) return { type: "Level" as const, level: levelMatch[1] };
    const useMatch = method.match(/^Use\s+(.+)$/i);
    if (useMatch) return { type: "Item" as const, itemName: useMatch[1] };
    const stoneMatch = method.match(/^Stone:\s+(.+)$/i);
    if (stoneMatch) return { type: "Stone" as const, itemName: stoneMatch[1] };
    const tradeMatch = method.match(/^Trade(?:\s+with\s+(.+))?$/i);
    if (tradeMatch) return { type: "Trade" as const, itemName: tradeMatch[1] ?? "" };
    const friendMatch = method.match(/^Friendship(?:\s+\((Day|Night)\))?$/i);
    if (friendMatch) return { type: "Friendship" as const, time: (friendMatch[1] as "Day" | "Night" | undefined) ?? "" };
    return { type: "Custom" as const, custom: method };
  }

  const saveAbilities = useMutation({
    mutationFn: async () => {
      if (!selectedSpeciesId) return;
      const slots = [] as { abilityId: number; slot: "1" | "2" | "H" }[];
      if (slot1) {
        const idValue = Number(slot1);
        if (Number.isFinite(idValue)) slots.push({ abilityId: idValue, slot: "1" });
      }
      if (slot2) {
        const idValue = Number(slot2);
        if (Number.isFinite(idValue)) slots.push({ abilityId: idValue, slot: "2" });
      }
      hiddenSlots
        .filter((idValue) => Number.isFinite(idValue))
        .forEach((idValue) => slots.push({ abilityId: idValue, slot: "H" }));
      await api.post(`/packs/${packId}/species-abilities`, {
        speciesId: Number(selectedSpeciesId),
        slots
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "species-abilities"] })
  });

  const createEvolution = useMutation({
    mutationFn: async () => {
      if (!selectedEvolutionSpeciesId || !evolutionTargetId) return;
      const method = buildMethod();
      if (!method) return;
      await api.post(`/packs/${packId}/species-evolutions`, {
        fromSpeciesId: Number(selectedEvolutionSpeciesId),
        toSpeciesId: Number(evolutionTargetId),
        method
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "species-evolutions"] })
  });

  const updateEvolution = useMutation({
    mutationFn: async () => {
      if (!editingEvolutionId || !selectedEvolutionSpeciesId || !evolutionTargetId) return;
      const method = buildMethod();
      if (!method) return;
      await api.put(`/packs/${packId}/species-evolutions/${editingEvolutionId}`, {
        fromSpeciesId: Number(selectedEvolutionSpeciesId),
        toSpeciesId: Number(evolutionTargetId),
        method
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "species-evolutions"] })
  });

  const removeEvolution = useMutation({
    mutationFn: (idValue: number) => api.del(`/packs/${packId}/species-evolutions/${idValue}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "species-evolutions"] })
  });

  const abilityOptions = useMemo(() => abilities.map((a) => ({ id: a.id, name: a.name })), [abilities]);
  const typeColorByName = useMemo(() => new Map(types.map((t) => [t.name, t.color])), [types]);
  const speciesMap = useMemo(() => new Map(species.map((s) => [s.id, s.name])), [species]);
  const evolutionItems = useMemo(
    () => items.filter((i) => parseStoredTags(i.tags).includes("evolution:item")),
    [items]
  );
  const evolutionStones = useMemo(
    () => items.filter((i) => parseStoredTags(i.tags).includes("evolution:stone")),
    [items]
  );

  const evolutionsForSelected = evolutions.filter((e) => e.fromSpeciesId === Number(selectedEvolutionSpeciesId));

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <Card>
        <CardHeader title="Add Species" subtitle="Base stats + typing." />
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((values) => {
            const payload = { ...values, type2Id: values.type2Id && values.type2Id > 0 ? values.type2Id : null };
            if (editingSpeciesId) {
              update.mutate({ id: editingSpeciesId, data: payload });
              setEditingSpeciesId(null);
            } else {
              create.mutate(payload);
            }
          })}
        >
          <Input placeholder="Name" {...form.register("name")} />
          <div className="grid grid-cols-2 gap-2">
            <Select {...form.register("type1Id")}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select {...form.register("type2Id")}>
              <option value="">None</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input type="number" placeholder="HP" {...form.register("hp")} />
            <Input type="number" placeholder="Atk" {...form.register("atk")} />
            <Input type="number" placeholder="Def" {...form.register("def")} />
            <Input type="number" placeholder="SpA" {...form.register("spa")} />
            <Input type="number" placeholder="SpD" {...form.register("spd")} />
            <Input type="number" placeholder="Spe" {...form.register("spe")} />
          </div>
          <div className="flex gap-2">
            <Button type="submit">{editingSpeciesId ? "Update" : "Save"}</Button>
            {editingSpeciesId ? (
              <GhostButton
                onClick={() => {
                  setEditingSpeciesId(null);
                  form.reset();
                }}
              >
                Cancel
              </GhostButton>
            ) : null}
          </div>
        </form>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Species List" subtitle="Pack dex." />
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th>Name</th>
                  <th>Types</th>
                  <th>HP</th>
                  <th>Atk</th>
                  <th>Def</th>
                  <th>SpA</th>
                  <th>SpD</th>
                  <th>Spe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {species.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="py-2 font-medium">{s.name}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {[s.type1Name, s.type2Name]
                          .filter(Boolean)
                          .map((name) => {
                            const color = typeColorByName.get(name as string) ?? null;
                            return <TypePill key={name} name={name as string} color={color} />;
                          })}
                      </div>
                    </td>
                    <td>{s.hp}</td>
                    <td>{s.atk}</td>
                    <td>{s.def}</td>
                    <td>{s.spa}</td>
                    <td>{s.spd}</td>
                    <td>{s.spe}</td>
                    <td className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          onClick={() => {
                            setEditingSpeciesId(s.id);
                            form.setValue("name", s.name);
                            form.setValue("type1Id", s.type1Id);
                            form.setValue("type2Id", s.type2Id ?? null);
                            form.setValue("hp", s.hp);
                            form.setValue("atk", s.atk);
                            form.setValue("def", s.def);
                            form.setValue("spa", s.spa);
                            form.setValue("spd", s.spd);
                            form.setValue("spe", s.spe);
                          }}
                          type="button"
                        >
                          Edit
                        </Button>
                        <Button onClick={() => remove.mutate(s.id)} type="button">
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Species Abilities" subtitle="Assign Ability 1/2 and multiple Hidden abilities." />
          <div className="grid md:grid-cols-[240px_1fr] gap-4">
            <Select
              value={selectedSpeciesId}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedSpeciesId(value ? Number(value) : "");
              }}
            >
              <option value="">Select species</option>
              {species.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Ability Slot 1</div>
                  <Select value={slot1} onChange={(e) => setSlot1(e.target.value)}>
                    <option value="">None</option>
                    {abilityOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Ability Slot 2</div>
                  <Select value={slot2} onChange={(e) => setSlot2(e.target.value)}>
                    <option value="">None</option>
                    {abilityOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-2">Hidden Abilities</div>
                <div className="grid md:grid-cols-2 gap-2">
                  {abilityOptions.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={hiddenSlots.includes(a.id)}
                        onChange={() => {
                          setHiddenSlots((prev) =>
                            prev.includes(a.id) ? prev.filter((idValue) => idValue !== a.id) : [...prev, a.id]
                          );
                        }}
                      />
                      <span>{a.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => saveAbilities.mutate()} type="button">
                  Save Abilities
                </Button>
                <GhostButton onClick={() => {
                  setSlot1("");
                  setSlot2("");
                  setHiddenSlots([]);
                }}>Clear</GhostButton>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Species Evolutions" subtitle="Define evolutions and methods for a species." />
          <div className="grid md:grid-cols-[240px_1fr] gap-4">
            <Select
              value={selectedEvolutionSpeciesId}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedEvolutionSpeciesId(value ? Number(value) : "");
              }}
            >
              <option value="">Select species</option>
              {species.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Evolves To</div>
                  <Select
                    value={evolutionTargetId}
                    onChange={(e) => setEvolutionTargetId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">Select target</option>
                    {species
                      .filter((s) => s.id !== Number(selectedEvolutionSpeciesId))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </Select>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Method Preset</div>
                  <Select value={evolutionType} onChange={(e) => setEvolutionType(e.target.value as any)}>
                    <option value="Level">Level</option>
                    <option value="Item">Item</option>
                    <option value="Stone">Stone</option>
                    <option value="Trade">Trade</option>
                    <option value="Friendship">Friendship</option>
                    <option value="Custom">Custom</option>
                  </Select>
                </div>
              </div>

              {evolutionType === "Level" ? (
                <Input placeholder="Level (e.g. 16)" value={evolutionLevel} onChange={(e) => setEvolutionLevel(e.target.value)} />
              ) : null}

              {evolutionType === "Item" || evolutionType === "Stone" || evolutionType === "Trade" ? (
                <Select
                  value={evolutionItemId}
                  onChange={(e) => setEvolutionItemId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">No Item</option>
                  {(evolutionType === "Stone" ? evolutionStones : evolutionType === "Item" ? evolutionItems : items).map(
                    (i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    )
                  )}
                </Select>
              ) : null}

              {evolutionType === "Friendship" ? (
                <Select
                  value={evolutionFriendshipTime}
                  onChange={(e) => setEvolutionFriendshipTime(e.target.value as "" | "Day" | "Night")}
                >
                  <option value="">Any Time</option>
                  <option value="Day">Day</option>
                  <option value="Night">Night</option>
                </Select>
              ) : null}

              {evolutionType === "Custom" ? (
                <Input placeholder="Custom method" value={evolutionCustom} onChange={(e) => setEvolutionCustom(e.target.value)} />
              ) : null}

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (editingEvolutionId) {
                      updateEvolution.mutate();
                      setEditingEvolutionId(null);
                    } else {
                      createEvolution.mutate();
                    }
                  }}
                  type="button"
                >
                  {editingEvolutionId ? "Update Evolution" : "Add Evolution"}
                </Button>
                <GhostButton
                  onClick={() => {
                    setEvolutionTargetId("");
                    setEvolutionType("Level");
                    setEvolutionLevel("");
                    setEvolutionItemId("");
                    setEvolutionFriendshipTime("");
                    setEvolutionCustom("");
                    setEditingEvolutionId(null);
                  }}
                  type="button"
                >
                  Clear
                </GhostButton>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                {evolutionsForSelected.length === 0 ? (
                  <div className="text-xs text-slate-400">No evolutions defined yet.</div>
                ) : (
                  evolutionsForSelected.map((evo) => (
                    <div key={evo.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{speciesMap.get(evo.toSpeciesId) ?? "Unknown"}</span>
                        <span className="text-slate-500"> — {evo.method}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setEditingEvolutionId(evo.id);
                            setEvolutionTargetId(evo.toSpeciesId);
                            const parsed = parseMethod(evo.method);
                            setEvolutionType(parsed.type);
                            setEvolutionLevel(parsed.type === "Level" ? parsed.level : "");
                            if (parsed.type === "Item" || parsed.type === "Stone" || parsed.type === "Trade") {
                              const matchName = parsed.itemName ?? "";
                              const matchItem = items.find((i) => i.name === matchName);
                              setEvolutionItemId(matchItem ? matchItem.id : "");
                            } else {
                              setEvolutionItemId("");
                            }
                            if (parsed.type === "Friendship") {
                              setEvolutionFriendshipTime(parsed.time ?? "");
                            } else {
                              setEvolutionFriendshipTime("");
                            }
                            setEvolutionCustom(parsed.type === "Custom" ? parsed.custom ?? "" : "");
                          }}
                          type="button"
                        >
                          Edit
                        </Button>
                        <Button onClick={() => removeEvolution.mutate(evo.id)} type="button">
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
