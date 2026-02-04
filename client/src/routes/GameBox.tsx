import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { api } from "../lib/api";
import {
  BoxRow,
  GameRow,
  PackAbilityRow,
  PackItemRow,
  PackSpeciesAbilityRow,
  PackSpeciesEvolutionRow,
  PackSpeciesRow,
  PackTypeRow
} from "../lib/types";
import { Button, Card, CardHeader, Input, Select, Modal, GhostButton } from "../components/ui";
import { DataTable } from "../components/DataTable";

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

function formatEvolutionMethod(method: string) {
  const levelMatch = method.match(/^Level\s+(\d+)$/i);
  if (levelMatch) return levelMatch[1];

  const useMatch = method.match(/^Use\s+(.+)$/i);
  if (useMatch) return useMatch[1];

  const stoneMatch = method.match(/^Stone:\s+(.+)$/i);
  if (stoneMatch) return stoneMatch[1];

  const tradeMatch = method.match(/^Trade(?:\s+with\s+(.+))?$/i);
  if (tradeMatch) {
    const item = tradeMatch[1];
    return item ? `Trade (${item})` : "Trade";
  }

  return method;
}

export default function GameBox() {
  const { id } = useParams();
  const gameId = Number(id);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeId, setTypeId] = useState("");
  const [minOverall, setMinOverall] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [evolveOpen, setEvolveOpen] = useState(false);
  const [evolveTargets, setEvolveTargets] = useState<PackSpeciesEvolutionRow[]>([]);
  const [evolveBoxId, setEvolveBoxId] = useState<number | null>(null);
  const [evolveTargetId, setEvolveTargetId] = useState<number | "">("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAbilityId, setEditAbilityId] = useState<string>("");
  const [editItemId, setEditItemId] = useState<string>("");

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
  const { data: speciesAbilities = [] } = useQuery<PackSpeciesAbilityRow[]>({
    queryKey: ["packs", packId, "species-abilities"],
    queryFn: () => api.get(`/packs/${packId}/species-abilities`),
    enabled: !!packId
  });
  const { data: evolutions = [] } = useQuery<PackSpeciesEvolutionRow[]>({
    queryKey: ["packs", packId, "species-evolutions"],
    queryFn: () => api.get(`/packs/${packId}/species-evolutions`),
    enabled: !!packId
  });

  const allowedSpeciesList = species.filter((s) => allowedSpecies.includes(s.id));
  const allowedAbilitiesList = abilities.filter((a) => allowedAbilities.includes(a.id));
  const allowedItemsList = items.filter((i) => allowedItems.includes(i.id));
  const usableItems = allowedItemsList.filter((i) => !parseStoredTags(i.tags).some((t) => t.startsWith("evolution:")));

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

  const speciesAbilityIds = speciesAbilities
    .filter((row) => row.speciesId === Number(form.speciesId))
    .map((row) => row.abilityId);
  const speciesAbilityOptions = allowedAbilitiesList.filter((a) => speciesAbilityIds.includes(a.id));
  const abilitiesLocked = speciesAbilityOptions.length === 0;

  useEffect(() => {
    if (abilitiesLocked && form.abilityId) {
      setForm((prev) => ({ ...prev, abilityId: "" }));
    }
  }, [abilitiesLocked, form.abilityId]);

  const create = useMutation({
    mutationFn: (payload: any) => api.post(`/games/${gameId}/box`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "box"] })
  });

  const update = useMutation({
    mutationFn: (payload: { id: number; data: any }) => api.put(`/games/${gameId}/box/${payload.id}`, payload.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "box"] })
  });

  const remove = useMutation({
    mutationFn: (idValue: number) => api.del(`/games/${gameId}/box/${idValue}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "box"] })
  });

  const evolve = useMutation({
    mutationFn: (payload: { id: number; toSpeciesId: number }) =>
      api.put(`/games/${gameId}/box/${payload.id}/evolve`, { toSpeciesId: payload.toSpeciesId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "box"] })
  });

  const clearBox = useMutation({
    mutationFn: () => api.del(`/games/${gameId}/box`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "box"] })
  });

  const evolutionsBySpecies = useMemo(() => {
    const map = new Map<number, PackSpeciesEvolutionRow[]>();
    evolutions.forEach((evo) => {
      const current = map.get(evo.fromSpeciesId) ?? [];
      current.push(evo);
      map.set(evo.fromSpeciesId, current);
    });
    return map;
  }, [evolutions]);

  const speciesNameById = useMemo(() => new Map(species.map((s) => [s.id, s.name])), [species]);

  const columns: ColumnDef<BoxRow>[] = [
    {
      id: "pokemon",
      header: "Pokemon",
      accessorFn: (row) => row.nickname || row.speciesName,
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
      accessorFn: (row) => [row.type1Name, row.type2Name].filter(Boolean).join(" / "),
      cell: ({ row }) => [row.original.type1Name, row.original.type2Name].filter(Boolean).join(" / ")
    },
    {
      id: "evolution",
      header: "Evolution",
      accessorFn: (row) => {
        const evoList = evolutionsBySpecies.get(row.speciesId) ?? [];
        if (evoList.length === 0) return "-";
        if (evoList.length > 1) return "Multiple";
        return formatEvolutionMethod(evoList[0].method);
      },
      cell: ({ row }) => {
        const evoList = evolutionsBySpecies.get(row.original.speciesId) ?? [];
        if (evoList.length === 0) return "-";
        if (evoList.length > 1) {
          const list = evoList.map((e) => formatEvolutionMethod(e.method)).join(", ");
          return (
            <span className="inline-flex items-center gap-1 text-slate-600">
              Multiple
              <span
                title={list}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-slate-300 text-[10px] text-slate-500 cursor-help"
              >
                i
              </span>
            </span>
          );
        }
        return formatEvolutionMethod(evoList[0].method);
      }
    },
    {
      id: "ability",
      header: "Ability",
      accessorKey: "abilityName",
      cell: ({ row }) => {
        if (editingId !== row.original.id) return row.original.abilityName ?? "-";
        const abilityIds = speciesAbilities
          .filter((s) => s.speciesId === row.original.speciesId)
          .map((s) => s.abilityId);
        const options = allowedAbilitiesList.filter((a) => abilityIds.includes(a.id));
        const locked = options.length === 0;
        return (
          <Select value={editAbilityId} onChange={(e) => setEditAbilityId(e.target.value)} disabled={locked}>
            <option value="">No Ability</option>
            {options.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        );
      }
    },
    {
      id: "item",
      header: "Item",
      accessorKey: "itemName",
      cell: ({ row }) => {
        if (editingId !== row.original.id) return row.original.itemName ?? "-";
        return (
          <Select value={editItemId} onChange={(e) => setEditItemId(e.target.value)}>
            <option value="">No Item</option>
            {usableItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        );
      }
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
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          {(evolutionsBySpecies.get(row.original.speciesId) ?? []).length > 0 ? (
            <Button
              onClick={() => {
                const evoList = evolutionsBySpecies.get(row.original.speciesId) ?? [];
                if (evoList.length === 1) {
                  evolve.mutate({ id: row.original.id, toSpeciesId: evoList[0].toSpeciesId });
                  return;
                }
                setEvolveTargets(evoList);
                setEvolveBoxId(row.original.id);
                setEvolveTargetId(evoList[0]?.toSpeciesId ?? "");
                setEvolveOpen(true);
              }}
              type="button"
            >
              Evolve
            </Button>
          ) : null}
          {editingId === row.original.id ? (
            <>
              <Button
                onClick={() => {
                  const abilityIds = speciesAbilities
                    .filter((s) => s.speciesId === row.original.speciesId)
                    .map((s) => s.abilityId);
                  const options = allowedAbilitiesList.filter((a) => abilityIds.includes(a.id));
                  const abilityIdValue = options.length > 0 && editAbilityId ? Number(editAbilityId) : null;
                  update.mutate({
                    id: row.original.id,
                    data: {
                      speciesId: row.original.speciesId,
                      abilityId: abilityIdValue,
                      itemId: editItemId ? Number(editItemId) : null,
                      nickname: row.original.nickname,
                      notes: row.original.notes
                    }
                  });
                  setEditingId(null);
                }}
                type="button"
              >
                Save
              </Button>
              <GhostButton onClick={() => setEditingId(null)} type="button">
                Cancel
              </GhostButton>
            </>
          ) : (
            <>
              <Button
                onClick={() => {
                  setEditingId(row.original.id);
                  setEditAbilityId(row.original.abilityId ? String(row.original.abilityId) : "");
                  setEditItemId(row.original.itemId ? String(row.original.itemId) : "");
                }}
                type="button"
              >
                Edit
              </Button>
              <Button onClick={() => remove.mutate(row.original.id)} type="button">
                Remove
              </Button>
            </>
          )}
        </div>
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
          <Select
            value={form.abilityId}
            onChange={(e) => setForm((f) => ({ ...f, abilityId: e.target.value }))}
            disabled={abilitiesLocked}
          >
            <option value="">No Ability</option>
            {speciesAbilityOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select value={form.itemId} onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value }))}>
            <option value="">No Item</option>
            {usableItems.map((i) => (
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
              setConfirmOpen(true);
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
      <Modal title="Clear Box?" isOpen={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="text-sm text-slate-600">This will remove all box entries for this game.</div>
        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => {
              clearBox.mutate();
              setConfirmOpen(false);
            }}
            type="button"
          >
            Clear Box
          </Button>
          <GhostButton onClick={() => setConfirmOpen(false)} type="button">
            Cancel
          </GhostButton>
        </div>
      </Modal>
      <Modal title="Choose Evolution" isOpen={evolveOpen} onClose={() => setEvolveOpen(false)}>
        <div className="text-sm text-slate-600 mb-3">Select a target species.</div>
        <Select value={evolveTargetId} onChange={(e) => setEvolveTargetId(e.target.value ? Number(e.target.value) : "")}>
          {evolveTargets.map((evo) => (
            <option key={`${evo.id}-${evo.toSpeciesId}`} value={evo.toSpeciesId}>
              {speciesNameById.get(evo.toSpeciesId) ?? "Unknown"}
            </option>
          ))}
        </Select>
        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => {
              if (evolveBoxId && evolveTargetId) {
                evolve.mutate({ id: evolveBoxId, toSpeciesId: Number(evolveTargetId) });
              }
              setEvolveOpen(false);
            }}
            type="button"
          >
            Evolve
          </Button>
          <GhostButton onClick={() => setEvolveOpen(false)} type="button">
            Cancel
          </GhostButton>
        </div>
      </Modal>
    </div>
  );
}
