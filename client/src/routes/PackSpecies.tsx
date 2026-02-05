import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import {
  PackAbilityRow,
  PackItemRow,
  PackRow,
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
  dexNumber: z.coerce.number().int().min(1),
  baseSpeciesId: z.coerce.number().int().optional().nullable(),
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
  const [importBusy, setImportBusy] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const evolutionSpeciesInputRef = useRef<HTMLInputElement | null>(null);

  const { data: types = [] } = useQuery<PackTypeRow[]>({
    queryKey: ["packs", packId, "types"],
    queryFn: () => api.get(`/packs/${packId}/types`)
  });
  const { data: pack } = useQuery<PackRow | null>({
    queryKey: ["packs", packId],
    queryFn: () => api.get(`/packs/${packId}`)
  });
  const { data: abilities = [] } = useQuery<PackAbilityRow[]>({
    queryKey: ["packs", packId, "abilities", "all"],
    queryFn: () => api.get(`/packs/${packId}/abilities/all`)
  });
  const { data: items = [] } = useQuery<PackItemRow[]>({
    queryKey: ["packs", packId, "items", "all"],
    queryFn: () => api.get(`/packs/${packId}/items/all`)
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

  const useSingleSpecial = pack?.useSingleSpecial ?? false;
  const [type1Query, setType1Query] = useState("");
  const [type2Query, setType2Query] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      dexNumber: 1,
      baseSpeciesId: null,
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

  const type1Id = form.watch("type1Id");
  const type2Id = form.watch("type2Id");

  useEffect(() => {
    const type1Name = types.find((t) => t.id === Number(type1Id))?.name ?? "";
    if (type1Name) setType1Query(type1Name);
  }, [types, type1Id]);

  useEffect(() => {
    const type2Name = types.find((t) => t.id === Number(type2Id))?.name ?? "";
    setType2Query(type2Name);
  }, [types, type2Id]);

  const create = useMutation({
    mutationFn: (payload: FormValues) => api.post(`/packs/${packId}/species`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs", packId, "species"] });
      form.reset();
      setTimeout(() => form.setFocus("name"), 0);
    }
  });

  const update = useMutation({
    mutationFn: (payload: { id: number; data: FormValues }) =>
      api.put(`/packs/${packId}/species/${payload.id}`, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs", packId, "species"] });
      setTimeout(() => form.setFocus("name"), 0);
    }
  });

  const remove = useMutation({
    mutationFn: (idValue: number) => api.del(`/packs/${packId}/species/${idValue}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "species"] })
  });

  async function exportSpecies() {
    const payload = await api.get(`/packs/${packId}/species/export`);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pack-${packId}-species.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    setImportBusy(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await api.post(`/packs/${packId}/species/import`, json);
      queryClient.invalidateQueries({ queryKey: ["packs", packId, "species"] });
      queryClient.invalidateQueries({ queryKey: ["packs", packId, "species-abilities"] });
      queryClient.invalidateQueries({ queryKey: ["packs", packId, "species-evolutions"] });
    } finally {
      setImportBusy(false);
    }
  }

  const [editingSpeciesId, setEditingSpeciesId] = useState<number | null>(null);

  useEffect(() => {
    if (editingSpeciesId) return;
    if (species.length === 0) return;
    const maxDex = species.reduce((acc, s) => Math.max(acc, s.dexNumber ?? 0), 0);
    form.setValue("dexNumber", maxDex + 1, { shouldDirty: false });
  }, [species, editingSpeciesId, form]);

  const [selectedSpeciesId, setSelectedSpeciesId] = useState<number | "">("");
  const [selectedSpeciesQuery, setSelectedSpeciesQuery] = useState("");
  const [slot1, setSlot1] = useState<string>("");
  const [slot2, setSlot2] = useState<string>("");
  const [hiddenSlots, setHiddenSlots] = useState<number[]>([]);

  const [selectedEvolutionSpeciesId, setSelectedEvolutionSpeciesId] = useState<number | "">("");
  const [selectedEvolutionSpeciesQuery, setSelectedEvolutionSpeciesQuery] = useState("");
  const [evolutionTargetId, setEvolutionTargetId] = useState<number | "">("");
  const [evolutionTargetQuery, setEvolutionTargetQuery] = useState("");
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
    if (!selectedSpeciesId) {
      setSelectedSpeciesQuery("");
      return;
    }
    const selected = species.find((s) => s.id === Number(selectedSpeciesId));
    if (selected) setSelectedSpeciesQuery(selected.name);
  }, [selectedSpeciesId, species]);

  useEffect(() => {
    if (!selectedEvolutionSpeciesId) return;
    setEvolutionTargetId("");
    setEvolutionTargetQuery("");
    setEvolutionType("Level");
    setEvolutionLevel("");
    setEvolutionItemId("");
    setEvolutionFriendshipTime("");
    setEvolutionCustom("");
    setEditingEvolutionId(null);
  }, [selectedEvolutionSpeciesId]);

  useEffect(() => {
    if (!selectedEvolutionSpeciesId) {
      setSelectedEvolutionSpeciesQuery("");
      return;
    }
    const selected = species.find((s) => s.id === Number(selectedEvolutionSpeciesId));
    if (selected) setSelectedEvolutionSpeciesQuery(selected.name);
  }, [selectedEvolutionSpeciesId, species]);

  useEffect(() => {
    if (!evolutionTargetId) {
      setEvolutionTargetQuery("");
      return;
    }
    const selected = species.find((s) => s.id === Number(evolutionTargetId));
    if (selected) setEvolutionTargetQuery(selected.name);
  }, [evolutionTargetId, species]);

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
      if (!Number.isFinite(Number(selectedSpeciesId))) return;
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs", packId, "species-evolutions"] });
    }
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs", packId, "species-evolutions"] });
    }
  });

  const removeEvolution = useMutation({
    mutationFn: (idValue: number) => api.del(`/packs/${packId}/species-evolutions/${idValue}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "species-evolutions"] })
  });

  const abilityOptions = useMemo(() => abilities.map((a) => ({ id: a.id, name: a.name })), [abilities]);
  const typeColorByName = useMemo(() => new Map(types.map((t) => [t.name, t.color])), [types]);
  const speciesMap = useMemo(() => new Map(species.map((s) => [s.id, s.name])), [species]);
  const baseSpeciesOptions = useMemo(
    () => species.filter((s) => !s.baseSpeciesId),
    [species]
  );
  const evolutionItems = useMemo(
    () => items.filter((i) => parseStoredTags(i.tags).includes("evolution:item")),
    [items]
  );
  const evolutionStones = useMemo(
    () => items.filter((i) => parseStoredTags(i.tags).includes("evolution:stone")),
    [items]
  );

  const evolutionsForSelected = evolutions.filter((e) => e.fromSpeciesId === Number(selectedEvolutionSpeciesId));
  const focusEvolutionSpecies = () => {
    evolutionSpeciesInputRef.current?.focus();
  };

  const submitEvolution = () => {
    if (editingEvolutionId) {
      updateEvolution.mutate();
      setEditingEvolutionId(null);
    } else {
      createEvolution.mutate();
    }
    setSelectedEvolutionSpeciesId("");
    setSelectedEvolutionSpeciesQuery("");
    setEvolutionTargetId("");
    setEvolutionTargetQuery("");
    focusEvolutionSpecies();
  };

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <Card>
        <CardHeader title="Add Species" subtitle="Base stats + typing." />
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((values) => {
            const payload = {
              ...values,
              baseSpeciesId: values.baseSpeciesId && values.baseSpeciesId > 0 ? values.baseSpeciesId : null,
              type2Id: values.type2Id && values.type2Id > 0 ? values.type2Id : null
            };
            if (editingSpeciesId) {
              update.mutate({ id: editingSpeciesId, data: payload });
              setEditingSpeciesId(null);
            } else {
              create.mutate(payload);
            }
          })}
        >
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <div>
              <div className="text-xs text-slate-500 mb-1">Dex #</div>
              <Input type="number" min={1} {...form.register("dexNumber")} />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Name</div>
              <Input {...form.register("name")} />
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Form Of (optional)</div>
            <Select {...form.register("baseSpeciesId")}>
              <option value="">None (base species)</option>
              {baseSpeciesOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-slate-500 mb-1">Type 1</div>
              <Input
                list={`type1-options-${packId}`}
                placeholder="Type 1"
                value={type1Query}
                onChange={(e) => {
                  const value = e.target.value;
                  setType1Query(value);
                  const match = types.find((t) => t.name.toLowerCase() === value.toLowerCase());
                  if (match) form.setValue("type1Id", match.id);
                }}
                onBlur={() => {
                  const selected = types.find((t) => t.id === Number(form.getValues("type1Id")));
                  if (selected) {
                    setType1Query(selected.name);
                  } else if (types.length > 0) {
                    form.setValue("type1Id", types[0].id);
                    setType1Query(types[0].name);
                  }
                }}
              />
              <datalist id={`type1-options-${packId}`}>
                {types.map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Type 2</div>
              <Input
                list={`type2-options-${packId}`}
                placeholder="Type 2"
                value={type2Query}
                onChange={(e) => {
                  const value = e.target.value;
                  setType2Query(value);
                  if (!value) {
                    form.setValue("type2Id", null);
                    return;
                  }
                  const match = types.find((t) => t.name.toLowerCase() === value.toLowerCase());
                  if (match) form.setValue("type2Id", match.id);
                }}
                onBlur={() => {
                  const selected = types.find((t) => t.id === Number(form.getValues("type2Id")));
                  if (selected) {
                    setType2Query(selected.name);
                  } else {
                    form.setValue("type2Id", null);
                    setType2Query("");
                  }
                }}
              />
              <datalist id={`type2-options-${packId}`}>
                <option value="None" />
                {types.map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-xs text-slate-500 mb-1">HP</div>
              <Input type="number" {...form.register("hp")} />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Atk</div>
              <Input type="number" {...form.register("atk")} />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Def</div>
              <Input type="number" {...form.register("def")} />
            </div>
            {useSingleSpecial ? (
              <div>
                <div className="text-xs text-slate-500 mb-1">Spe</div>
                <Input type="number" {...form.register("spe")} />
              </div>
            ) : (
              <div>
                <div className="text-xs text-slate-500 mb-1">SpA</div>
                <Input type="number" {...form.register("spa")} />
              </div>
            )}
            {useSingleSpecial ? (
              <>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Special</div>
                  <Input type="number" {...form.register("spa")} />
                </div>
                <input type="hidden" {...form.register("spd")} />
              </>
            ) : (
              <div>
                <div className="text-xs text-slate-500 mb-1">SpD</div>
                <Input type="number" {...form.register("spd")} />
              </div>
            )}
            {useSingleSpecial ? null : (
              <div>
                <div className="text-xs text-slate-500 mb-1">Spe</div>
                <Input type="number" {...form.register("spe")} />
              </div>
            )}
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
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={exportSpecies}>
            Export Species
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void handleImport(file);
              e.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            disabled={importBusy}
            onClick={() => importInputRef.current?.click()}
          >
            {importBusy ? "Importing..." : "Import Species"}
          </Button>
        </div>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Species List" subtitle="Pack dex." />
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th>Dex #</th>
                  <th>Name</th>
                  <th>Types</th>
                  <th>HP</th>
                  <th>Atk</th>
                  <th>Def</th>
                  <th>{useSingleSpecial ? "Special" : "SpA"}</th>
                  {useSingleSpecial ? null : <th>SpD</th>}
                  <th>Spe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {species.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="py-2">{s.dexNumber}</td>
                    <td className="py-2">
                      <div className="font-medium">{s.name}</div>
                      {s.baseSpeciesId ? (
                        <div className="text-xs text-slate-400">Form of {speciesMap.get(s.baseSpeciesId) ?? "Unknown"}</div>
                      ) : null}
                    </td>
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
                    {useSingleSpecial ? null : <td>{s.spd}</td>}
                    <td>{s.spe}</td>
                    <td className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          onClick={() => {
                            setEditingSpeciesId(s.id);
                            form.setValue("name", s.name);
                            form.setValue("dexNumber", s.dexNumber);
                            form.setValue("baseSpeciesId", s.baseSpeciesId ?? null);
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
            <div>
              <Input
                list={`species-abilities-options-${packId}`}
                placeholder="Select species"
                value={selectedSpeciesQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedSpeciesQuery(value);
                  const match = species.find((s) => s.name.toLowerCase() === value.toLowerCase());
                  setSelectedSpeciesId(match ? match.id : "");
                }}
                onBlur={() => {
                  const selected = species.find((s) => s.id === Number(selectedSpeciesId));
                  if (selected) {
                    setSelectedSpeciesQuery(selected.name);
                  } else {
                    setSelectedSpeciesId("");
                    setSelectedSpeciesQuery("");
                  }
                }}
              />
              <datalist id={`species-abilities-options-${packId}`}>
                {species.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>
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
                <Button onClick={() => saveAbilities.mutate()} type="button" disabled={!selectedSpeciesId}>
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
            <div>
              <Input
                ref={evolutionSpeciesInputRef}
                list={`species-evolutions-options-${packId}`}
                placeholder="Select species"
                value={selectedEvolutionSpeciesQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedEvolutionSpeciesQuery(value);
                  const match = species.find((s) => s.name.toLowerCase() === value.toLowerCase());
                  setSelectedEvolutionSpeciesId(match ? match.id : "");
                }}
                onBlur={() => {
                  const selected = species.find((s) => s.id === Number(selectedEvolutionSpeciesId));
                  if (selected) {
                    setSelectedEvolutionSpeciesQuery(selected.name);
                  } else {
                    setSelectedEvolutionSpeciesId("");
                    setSelectedEvolutionSpeciesQuery("");
                  }
                }}
              />
              <datalist id={`species-evolutions-options-${packId}`}>
                {species.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Evolves To</div>
                  <div>
                    <Input
                      list={`evolution-target-options-${packId}`}
                      placeholder="Select target"
                      value={evolutionTargetQuery}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEvolutionTargetQuery(value);
                        const match = species.find((s) => s.name.toLowerCase() === value.toLowerCase());
                        setEvolutionTargetId(match ? match.id : "");
                      }}
                      onBlur={() => {
                        const selected = species.find((s) => s.id === Number(evolutionTargetId));
                        if (selected) {
                          setEvolutionTargetQuery(selected.name);
                        } else {
                          setEvolutionTargetId("");
                          setEvolutionTargetQuery("");
                        }
                      }}
                    />
                    <datalist id={`evolution-target-options-${packId}`}>
                      {species
                        .filter((s) => s.id !== Number(selectedEvolutionSpeciesId))
                        .map((s) => (
                          <option key={s.id} value={s.name} />
                        ))}
                    </datalist>
                  </div>
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
                <Input
                  placeholder="Level (e.g. 16)"
                  value={evolutionLevel}
                  onChange={(e) => setEvolutionLevel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    submitEvolution();
                  }}
                />
              ) : null}

              {evolutionType === "Item" || evolutionType === "Stone" || evolutionType === "Trade" ? (
                <Select
                  value={evolutionItemId}
                  onChange={(e) => setEvolutionItemId(e.target.value ? Number(e.target.value) : "")}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    submitEvolution();
                  }}
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
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    submitEvolution();
                  }}
                >
                  <option value="">Any Time</option>
                  <option value="Day">Day</option>
                  <option value="Night">Night</option>
                </Select>
              ) : null}

              {evolutionType === "Custom" ? (
                <Input
                  placeholder="Custom method"
                  value={evolutionCustom}
                  onChange={(e) => setEvolutionCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    submitEvolution();
                  }}
                />
              ) : null}

              <div className="flex gap-2">
                <Button onClick={submitEvolution} type="button">
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
