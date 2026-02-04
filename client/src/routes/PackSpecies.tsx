import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { PackAbilityRow, PackSpeciesAbilityRow, PackSpeciesRow, PackTypeRow } from "../lib/types";
import { Button, Card, CardHeader, Input, Select, GhostButton } from "../components/ui";

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
  const { data: species = [] } = useQuery<PackSpeciesRow[]>({
    queryKey: ["packs", packId, "species"],
    queryFn: () => api.get(`/packs/${packId}/species`)
  });
  const { data: speciesAbilities = [] } = useQuery<PackSpeciesAbilityRow[]>({
    queryKey: ["packs", packId, "species-abilities"],
    queryFn: () => api.get(`/packs/${packId}/species-abilities`)
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

  useEffect(() => {
    if (!selectedSpeciesId) return;
    const rows = speciesAbilities.filter((row) => row.speciesId === Number(selectedSpeciesId));
    setSlot1(rows.find((r) => r.slot === "1")?.abilityId?.toString() ?? "");
    setSlot2(rows.find((r) => r.slot === "2")?.abilityId?.toString() ?? "");
    setHiddenSlots(rows.filter((r) => r.slot === "H").map((r) => r.abilityId));
  }, [selectedSpeciesId, speciesAbilities]);

  const saveAbilities = useMutation({
    mutationFn: async () => {
      if (!selectedSpeciesId) return;
      const slots = [] as { abilityId: number; slot: "1" | "2" | "H" }[];
      if (slot1) slots.push({ abilityId: Number(slot1), slot: "1" });
      if (slot2) slots.push({ abilityId: Number(slot2), slot: "2" });
      hiddenSlots.forEach((idValue) => slots.push({ abilityId: idValue, slot: "H" }));
      await api.post(`/packs/${packId}/species-abilities`, {
        speciesId: Number(selectedSpeciesId),
        slots
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "species-abilities"] })
  });

  const abilityOptions = useMemo(() => abilities.map((a) => ({ id: a.id, name: a.name })), [abilities]);

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
                    <td>{[s.type1Name, s.type2Name].filter(Boolean).join(" /")}</td>
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
      </div>
    </div>
  );
}
