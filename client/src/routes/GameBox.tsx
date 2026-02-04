import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { api } from "../lib/api";
import { BoxRow, GameRow, PackAbilityRow, PackItemRow, PackSpeciesRow, PackTypeRow } from "../lib/types";
import { Button, Card, CardHeader, Input, Select } from "../components/ui";
import { DataTable } from "../components/DataTable";

export default function GameBox() {
  const { id } = useParams();
  const gameId = Number(id);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeId, setTypeId] = useState("");
  const [minOverall, setMinOverall] = useState("");

  const { data: game } = useQuery<GameRow | null>({
    queryKey: ["games", gameId],
    queryFn: () => api.get(`/games/${gameId}`)
  });

  const packId = game?.packId ?? 0;

  const { data: box = [] } = useQuery<BoxRow[]>({
    queryKey: ["games", gameId, "box"],
    queryFn: () => api.get(`/games/${gameId}/box`)
  });

  const { data: allowedSpecies = [] } = useQuery<number[]>({
    queryKey: ["games", gameId, "allowed-species"],
    queryFn: () => api.get(`/games/${gameId}/allowed-species`)
  });
  const { data: allowedAbilities = [] } = useQuery<number[]>({
    queryKey: ["games", gameId, "allowed-abilities"],
    queryFn: () => api.get(`/games/${gameId}/allowed-abilities`)
  });
  const { data: allowedItems = [] } = useQuery<number[]>({
    queryKey: ["games", gameId, "allowed-items"],
    queryFn: () => api.get(`/games/${gameId}/allowed-items`)
  });

  const { data: species = [] } = useQuery<PackSpeciesRow[]>({
    queryKey: ["packs", packId, "species"],
    queryFn: () => api.get(`/packs/${packId}/species`),
    enabled: !!packId
  });
  const { data: abilities = [] } = useQuery<PackAbilityRow[]>({
    queryKey: ["packs", packId, "abilities"],
    queryFn: () => api.get(`/packs/${packId}/abilities`),
    enabled: !!packId
  });
  const { data: items = [] } = useQuery<PackItemRow[]>({
    queryKey: ["packs", packId, "items"],
    queryFn: () => api.get(`/packs/${packId}/items`),
    enabled: !!packId
  });
  const { data: types = [] } = useQuery<PackTypeRow[]>({
    queryKey: ["packs", packId, "types"],
    queryFn: () => api.get(`/packs/${packId}/types`),
    enabled: !!packId
  });

  const allowedSpeciesList = species.filter((s) => allowedSpecies.includes(s.id));
  const allowedAbilitiesList = abilities.filter((a) => allowedAbilities.includes(a.id));
  const allowedItemsList = items.filter((i) => allowedItems.includes(i.id));

  const [form, setForm] = useState({
    speciesId: allowedSpeciesList[0]?.id ?? 0,
    abilityId: "",
    itemId: "",
    nickname: "",
    notes: ""
  });

  useEffect(() => {
    if (form.speciesId === 0 && allowedSpeciesList.length > 0) {
      setForm((prev) => ({ ...prev, speciesId: allowedSpeciesList[0].id }));
    }
  }, [allowedSpeciesList, form.speciesId]);

  const create = useMutation({
    mutationFn: (payload: any) => api.post(`/games/${gameId}/box`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "box"] })
  });

  const remove = useMutation({
    mutationFn: (idValue: number) => api.del(`/games/${gameId}/box/${idValue}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "box"] })
  });

  const clearBox = useMutation({
    mutationFn: () => api.del(`/games/${gameId}/box`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "box"] })
  });

  const columns: ColumnDef<BoxRow>[] = [
    {
      id: "pokemon",
      header: "Pokemon",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.nickname || row.original.speciesName}</div>
          <div className="text-xs text-slate-400">{row.original.speciesName}</div>
        </div>
      )
    },
    {
      id: "types",
      header: "Types",
      cell: ({ row }) => [row.original.type1Name, row.original.type2Name].filter(Boolean).join(" / ")
    },
    {
      id: "ability",
      header: "Ability",
      accessorKey: "abilityName",
      cell: (info) => info.getValue<string>() ?? "-"
    },
    {
      id: "item",
      header: "Item",
      accessorKey: "itemName",
      cell: (info) => info.getValue<string>() ?? "-"
    },
    {
      id: "offP",
      header: "Off P",
      cell: ({ row }) => row.original.potentials.offensivePhysical.toFixed(1)
    },
    {
      id: "offS",
      header: "Off S",
      cell: ({ row }) => row.original.potentials.offensiveSpecial.toFixed(1)
    },
    {
      id: "defP",
      header: "Def P",
      cell: ({ row }) => row.original.potentials.defensivePhysical.toFixed(1)
    },
    {
      id: "defS",
      header: "Def S",
      cell: ({ row }) => row.original.potentials.defensiveSpecial.toFixed(1)
    },
    {
      id: "overall",
      header: "Overall",
      cell: ({ row }) => <span className="font-semibold text-ink">{row.original.potentials.overall.toFixed(1)}</span>
    },
    {
      id: "remove",
      header: "",
      cell: ({ row }) => (
        <Button onClick={() => remove.mutate(row.original.id)} type="button">
          Remove
        </Button>
      )
    }
  ];

  const filteredBox = box.filter((row) => {
    const matchesSearch = search
      ? row.speciesName.toLowerCase().includes(search.toLowerCase()) || (row.nickname ?? "").toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesType = typeId ? row.type1Id === Number(typeId) || row.type2Id === Number(typeId) : true;
    const matchesOverall = minOverall ? row.potentials.overall >= Number(minOverall) : true;
    return matchesSearch && matchesType && matchesOverall;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Add Box Pokemon" subtitle="Choose species, ability, and item." />
        <div className="grid md:grid-cols-[1fr_1fr_1fr] gap-3">
          <Select
            value={form.speciesId}
            onChange={(e) => setForm((f) => ({ ...f, speciesId: Number(e.target.value) }))}
          >
            {allowedSpeciesList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select value={form.abilityId} onChange={(e) => setForm((f) => ({ ...f, abilityId: e.target.value }))}>
            <option value="">No Ability</option>
            {allowedAbilitiesList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select value={form.itemId} onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value }))}>
            <option value="">No Item</option>
            {allowedItemsList.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Nickname"
            value={form.nickname}
            onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
          />
          <Input placeholder="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="mt-3">
          <Button
            onClick={() =>
              create.mutate({
                speciesId: Number(form.speciesId),
                abilityId: form.abilityId ? Number(form.abilityId) : null,
                itemId: form.itemId ? Number(form.itemId) : null,
                nickname: form.nickname,
                notes: form.notes
              })
            }
          >
            Add to Box
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Box" subtitle="Computed potentials are shown per entry." />
        <div className="flex gap-3 mb-4">
          <Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">All Types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Input placeholder="Min Overall" value={minOverall} onChange={(e) => setMinOverall(e.target.value)} />
          <Button
            onClick={() => {
              if (window.confirm("Clear all box entries for this game?")) {
                clearBox.mutate();
              }
            }}
            type="button"
          >
            Clear Box
          </Button>
        </div>
        <div className="overflow-auto">
          <DataTable data={filteredBox} columns={columns} />
        </div>
      </Card>
    </div>
  );
}
