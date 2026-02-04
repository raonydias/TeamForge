import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
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
  PackTypeRow,
  TrackedRow
} from "../lib/types";
import { Button, Card, CardHeader, Input, Select, Modal, GhostButton, TypePill } from "../components/ui";
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
  const [confirmClearTrackedOpen, setConfirmClearTrackedOpen] = useState(false);
  const [evolveOpen, setEvolveOpen] = useState(false);
  const [evolveTargets, setEvolveTargets] = useState<PackSpeciesEvolutionRow[]>([]);
  const [evolveBoxId, setEvolveBoxId] = useState<number | null>(null);
  const [evolveTargetId, setEvolveTargetId] = useState<number | "">("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAbilityId, setEditAbilityId] = useState<string>("");
  const [editItemId, setEditItemId] = useState<string>("");
  const [addToTeamOpen, setAddToTeamOpen] = useState(false);
  const [addToTeamSlotIndex, setAddToTeamSlotIndex] = useState<number | "">("");
  const [addToTeamBox, setAddToTeamBox] = useState<BoxRow | null>(null);

  const { data: game } = useQuery<GameRow | null>({
    queryKey: ["games", gameId],
    queryFn: () => api.get(`/games/${gameId}`)
  });

  const packId = game?.packId ?? 0;

  const { data: box = [] } = useQuery<BoxRow[]>({
    queryKey: ["games", gameId, "box"],
    queryFn: () => api.get(`/games/${gameId}/box`)
  });
  const { data: tracked = [] } = useQuery<TrackedRow[]>({
    queryKey: ["games", gameId, "tracked"],
    queryFn: () => api.get(`/games/${gameId}/tracked`)
  });
  const { data: team } = useQuery<{
    slots: { id: number; slotIndex: number; boxPokemonId: number | null }[];
    members: ({ boxPokemonId: number; nickname: string | null; speciesName: string; type1Id: number; type2Id: number | null; type1Name: string | null; type2Name: string | null } | null)[];
    defenseMatrix: { attackingTypeId: number; attackingTypeName: string; attackingTypeColor?: string | null; multipliers: (number | null)[]; totalWeak: number; totalResist: number }[];
  }>({
    queryKey: ["games", gameId, "team"],
    queryFn: () => api.get(`/games/${gameId}/team`)
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
    nickname: ""
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
  const abilitiesLocked = !!game?.disableAbilities || speciesAbilityOptions.length === 0;
  const showAbilities = !game?.disableAbilities;
  const showItems = !game?.disableHeldItems;

  useEffect(() => {
    if (abilitiesLocked && form.abilityId) {
      setForm((prev) => ({ ...prev, abilityId: "" }));
    }
  }, [abilitiesLocked, form.abilityId]);

  const create = useMutation({
    mutationFn: (payload: any) => api.post(`/games/${gameId}/box`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games", gameId, "box"] });
      setForm((prev) => ({ ...prev, nickname: "" }));
    }
  });

  const update = useMutation({
    mutationFn: (payload: { id: number; data: any }) => api.put(`/games/${gameId}/box/${payload.id}`, payload.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "box"] })
  });

  const remove = useMutation({
    mutationFn: (idValue: number) => api.del(`/games/${gameId}/box/${idValue}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "box"] })
  });

  const track = useMutation({
    mutationFn: (payload: any) => api.post(`/games/${gameId}/tracked`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games", gameId, "tracked"] });
      setForm((prev) => ({ ...prev, nickname: "" }));
    }
  });

  const sendTracked = useMutation({
    mutationFn: (trackId: number) => api.post(`/games/${gameId}/tracked/${trackId}/send`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games", gameId, "tracked"] });
      queryClient.invalidateQueries({ queryKey: ["games", gameId, "box"] });
    }
  });

  const removeTracked = useMutation({
    mutationFn: (trackId: number) => api.del(`/games/${gameId}/tracked/${trackId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "tracked"] })
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

  const clearTracked = useMutation({
    mutationFn: () => api.del(`/games/${gameId}/tracked`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "tracked"] })
  });

  const saveTeam = useMutation({
    mutationFn: (slots: { slotIndex: number; boxPokemonId: number | null }[]) => api.put(`/games/${gameId}/team`, { slots }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "team"] })
  });

  const preview = useMutation({
    mutationFn: (payload: { slotIndex: number; boxPokemonId: number }) =>
      api.post(`/games/${gameId}/team/preview`, { slots: [payload] })
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

  const typeColorById = useMemo(() => new Map(types.map((t) => [t.id, t.color])), [types]);

  const teamMembers = team?.members ?? [];
  const teamSlots = team?.slots ?? [];
  const currentMatrix = team?.defenseMatrix ?? [];
  const previewMatrix = addToTeamSlotIndex && addToTeamBox ? preview.data?.defenseMatrix ?? [] : currentMatrix;

  function openAddToTeam(row: BoxRow) {
    const emptySlot = teamSlots.find((s) => !s.boxPokemonId);
    if (emptySlot) {
      const nextSlots = teamSlots.map((slot) =>
        slot.slotIndex === emptySlot.slotIndex ? { ...slot, boxPokemonId: row.id } : slot
      );
      saveTeam.mutate(nextSlots.map((s) => ({ slotIndex: s.slotIndex, boxPokemonId: s.boxPokemonId })));
      return;
    }
    setAddToTeamBox(row);
    setAddToTeamSlotIndex("");
    setAddToTeamOpen(true);
  }

  function renderMatrix(
    matrix: { attackingTypeId: number; attackingTypeName: string; attackingTypeColor?: string | null; multipliers: (number | null)[]; totalWeak: number; totalResist: number }[],
    members: ({ boxPokemonId: number; nickname: string | null; speciesName: string } | null)[]
  ) {
    const totalClass = (value: number, mode: "weak" | "resist") => {
      if (value <= 0) return "text-slate-500";
      if (mode === "weak") {
        if (value === 1) return "bg-rose-50 text-rose-700";
        if (value === 2) return "bg-rose-100 text-rose-700";
        return "bg-rose-200 text-rose-900";
      }
      if (value === 1) return "bg-emerald-50 text-emerald-700";
      if (value === 2) return "bg-emerald-100 text-emerald-700";
      return "bg-emerald-200 text-emerald-900";
    };

    return (
      <div className="overflow-y-auto overflow-x-visible border border-slate-200 rounded-xl">
        <table className="w-max text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 px-2">Move</th>
              {members.map((member, idx) => (
                <th key={idx} className="py-2 px-2 text-center">
                  {member ? (
                    <div className="text-[11px] text-slate-600">{member.nickname || member.speciesName}</div>
                  ) : (
                    <div className="text-[11px] text-slate-300">Empty</div>
                  )}
                </th>
              ))}
              <th className="py-2 px-2 text-center">Weak</th>
              <th className="py-2 px-2 text-center">Resist</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.attackingTypeId} className="border-t border-slate-100">
                <td className="py-2 px-2">
                  <TypePill name={row.attackingTypeName} color={row.attackingTypeColor ?? null} />
                </td>
                {row.multipliers.map((mult, idx) => {
                  const formatted = (() => {
                    if (mult === null) return { label: "—", className: "text-slate-300" };
                    const rounded = Math.round(mult * 100) / 100;
                    if (rounded === 1) return { label: "", className: "" };
                    if (rounded === 0) return { label: "immune", className: "bg-slate-200 text-slate-700" };
                    if (rounded === 0.25) return { label: "1/4", className: "bg-emerald-100 text-emerald-700" };
                    if (rounded === 0.5) return { label: "1/2", className: "bg-emerald-50 text-emerald-700" };
                    if (rounded === 2) return { label: "2x", className: "bg-rose-50 text-rose-700" };
                    if (rounded === 4) return { label: "4x", className: "bg-rose-200 text-rose-900 border border-rose-300" };
                    return { label: `${rounded}x`, className: "bg-slate-100 text-slate-700" };
                  })();
                  return (
                    <td key={idx} className="px-2 py-2 text-center">
                      {formatted.label ? (
                        <span className={`inline-flex min-w-[2rem] justify-center rounded-lg px-2 py-1 text-[11px] font-semibold ${formatted.className}`}>
                          {formatted.label}
                        </span>
                      ) : null}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center">
                  <span className={`inline-flex min-w-[1.75rem] justify-center rounded-md px-2 py-1 text-[11px] font-semibold ${totalClass(row.totalWeak, "weak")}`}>
                    {row.totalWeak}
                  </span>
                </td>
                <td className="px-2 py-2 text-center">
                  <span className={`inline-flex min-w-[1.75rem] justify-center rounded-md px-2 py-1 text-[11px] font-semibold ${totalClass(row.totalResist, "resist")}`}>
                    {row.totalResist}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

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
      cell: ({ row }) => {
        const entries = [
          { id: row.original.type1Id, name: row.original.type1Name },
          { id: row.original.type2Id, name: row.original.type2Name }
        ].filter((entry) => entry.name) as { id: number; name: string }[];
        return (
          <div className="flex flex-wrap gap-2">
            {entries.map((entry) => (
              <TypePill key={`${row.original.id}-${entry.id}`} name={entry.name} color={typeColorById.get(entry.id) ?? null} />
            ))}
          </div>
        );
      }
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
    showAbilities
      ? {
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
        }
      : null,
    showItems
      ? {
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
    }
      : null,
    {
      id: "offP",
      header: "Physical Attacker",
      accessorFn: (row) => row.potentials.offensivePhysical,
      cell: ({ row }) => row.original.potentials.offensivePhysical.toFixed(2)
    },
    {
      id: "offS",
      header: "Special Attacker",
      accessorFn: (row) => row.potentials.offensiveSpecial,
      cell: ({ row }) => row.original.potentials.offensiveSpecial.toFixed(2)
    },
    {
      id: "defP",
      header: "Physical Tank",
      accessorFn: (row) => row.potentials.defensivePhysical,
      cell: ({ row }) => row.original.potentials.defensivePhysical.toFixed(2)
    },
    {
      id: "defS",
      header: "Special Tank",
      accessorFn: (row) => row.potentials.defensiveSpecial,
      cell: ({ row }) => row.original.potentials.defensiveSpecial.toFixed(2)
    },
    {
      id: "rank",
      header: "Box Rank",
      accessorFn: (row) => row.potentials.boxRank,
      cell: ({ row }) => <span className="font-semibold text-ink">{row.original.potentials.boxRank.toFixed(2)}</span>
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
          <Button onClick={() => openAddToTeam(row.original)} type="button">
            Add to Team
          </Button>
          {editingId === row.original.id ? (
            <>
              <Button
                onClick={() => {
                  const abilityIds = speciesAbilities
                    .filter((s) => s.speciesId === row.original.speciesId)
                    .map((s) => s.abilityId);
                  const options = allowedAbilitiesList.filter((a) => abilityIds.includes(a.id));
                  const abilityIdValue =
                    game?.disableAbilities || options.length === 0 || !editAbilityId ? null : Number(editAbilityId);
                  update.mutate({
                    id: row.original.id,
                    data: {
                      speciesId: row.original.speciesId,
                      abilityId: abilityIdValue,
                      itemId: game?.disableHeldItems ? null : editItemId ? Number(editItemId) : null,
                      nickname: row.original.nickname
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
  ].filter(Boolean) as ColumnDef<BoxRow>[];

  const trackedColumns: ColumnDef<TrackedRow>[] = [
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
      cell: ({ row }) => {
        const entries = [
          { id: row.original.type1Id, name: row.original.type1Name },
          { id: row.original.type2Id, name: row.original.type2Name }
        ].filter((entry) => entry.name) as { id: number; name: string }[];
        return (
          <div className="flex flex-wrap gap-2">
            {entries.map((entry) => (
              <TypePill key={`${row.original.id}-${entry.id}`} name={entry.name} color={typeColorById.get(entry.id) ?? null} />
            ))}
          </div>
        );
      }
    },
    showAbilities
      ? {
          id: "ability",
          header: "Ability",
          accessorKey: "abilityName",
          cell: ({ row }) => row.original.abilityName ?? "-"
        }
      : null,
    showItems
      ? {
          id: "item",
          header: "Item",
          accessorKey: "itemName",
          cell: ({ row }) => row.original.itemName ?? "-"
        }
      : null,
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          <Button onClick={() => sendTracked.mutate(row.original.id)} type="button">
            Send to Box
          </Button>
          <Button onClick={() => removeTracked.mutate(row.original.id)} type="button">
            Remove
          </Button>
        </div>
      )
    }
  ].filter(Boolean) as ColumnDef<TrackedRow>[];

  const filteredBox = box.filter((row) => {
    const matchesSearch = search
      ? row.speciesName.toLowerCase().includes(search.toLowerCase()) || (row.nickname ?? "").toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesType = typeId ? row.type1Id === Number(typeId) || row.type2Id === Number(typeId) : true;
    const matchesOverall = minOverall ? row.potentials.boxRank >= Number(minOverall) : true;
    return matchesSearch && matchesType && matchesOverall;
  });

  const balanceWarnings = box
    .filter((row) => row.potentials.balanceInvalid)
    .map((row) => (row.nickname ? `${row.nickname} (${row.speciesName})` : row.speciesName));
  const uniqueWarnings = Array.from(new Set(balanceWarnings));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Add Box Pokemon" subtitle="Choose species, ability, and item." />
        <div
          className={`grid gap-3 ${
            showAbilities && showItems
              ? "md:grid-cols-[1fr_1fr_1fr]"
              : showAbilities || showItems
              ? "md:grid-cols-[1fr_1fr]"
              : "md:grid-cols-[1fr]"
          }`}
        >
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
          {showAbilities ? (
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
          ) : null}
          {showItems ? (
            <Select value={form.itemId} onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value }))}>
              <option value="">No Item</option>
              {usableItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Input
            placeholder="Nickname"
            value={form.nickname}
            onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
          />
        </div>
        <div className="mt-3">
          <div className="flex gap-2">
            <Button
              onClick={() =>
                create.mutate({
                  speciesId: Number(form.speciesId),
                  abilityId: form.abilityId ? Number(form.abilityId) : null,
                  itemId: form.itemId ? Number(form.itemId) : null,
                  nickname: form.nickname
                })
              }
            >
              Add to Box
            </Button>
            <Button
              onClick={() =>
                track.mutate({
                  speciesId: Number(form.speciesId),
                  abilityId: form.abilityId ? Number(form.abilityId) : null,
                  itemId: form.itemId ? Number(form.itemId) : null,
                  nickname: form.nickname
                })
              }
            >
              Track
            </Button>
            <Link to={`/games/${gameId}/team`} className="inline-flex">
              <GhostButton type="button">Go to Team</GhostButton>
            </Link>
          </div>
        </div>
      </Card>

      {tracked.length > 0 ? (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <CardHeader title="Wild List" subtitle="Tracked targets not yet in the box." />
            <div className="mt-4 mr-4 flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                {tracked.length}
              </span>
              <GhostButton type="button" onClick={() => setConfirmClearTrackedOpen(true)}>
                Clear Wild List
              </GhostButton>
            </div>
          </div>
          <div className="overflow-auto">
            <DataTable data={tracked} columns={trackedColumns} />
          </div>
        </Card>
      ) : null}

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
          <Input placeholder="Min Rank" value={minOverall} onChange={(e) => setMinOverall(e.target.value)} />
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
        {uniqueWarnings.length > 0 ? (
          <div className="mt-3 text-sm text-amber-700">
            Warning: Box Rank could not be balanced for{" "}
            <span className="font-semibold">{uniqueWarnings.join(", ")}</span>.
          </div>
        ) : null}
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
      <Modal
        title="Clear Wild List?"
        isOpen={confirmClearTrackedOpen}
        onClose={() => setConfirmClearTrackedOpen(false)}
      >
        <div className="text-sm text-slate-600">This will remove all tracked entries for this game.</div>
        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => {
              clearTracked.mutate();
              setConfirmClearTrackedOpen(false);
            }}
            type="button"
          >
            Clear Wild List
          </Button>
          <GhostButton onClick={() => setConfirmClearTrackedOpen(false)} type="button">
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
      <Modal
        title="Swap Team Slot"
        isOpen={addToTeamOpen}
        onClose={() => setAddToTeamOpen(false)}
        className="w-fit max-w-[95vw] max-h-[85vh]"
      >
        <div className="grid lg:grid-cols-[240px_1fr] gap-4 h-full">
          <div className="space-y-2">
            <div className="text-sm text-slate-600">
              {addToTeamBox ? `Add ${addToTeamBox.nickname || addToTeamBox.speciesName} to team` : "Add to team"}
            </div>
            <Select
              value={addToTeamSlotIndex}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : "";
                setAddToTeamSlotIndex(value);
                if (value && addToTeamBox) {
                  preview.mutate({ slotIndex: value as number, boxPokemonId: addToTeamBox.id });
                }
              }}
            >
              <option value="">(none)</option>
              {teamSlots.map((slot) => {
                const member = teamMembers.find((m) => m?.boxPokemonId === slot.boxPokemonId) ?? null;
                return (
                  <option key={slot.slotIndex} value={slot.slotIndex}>
                    Slot {slot.slotIndex} - {member ? member.nickname || member.speciesName : "Empty"}
                  </option>
                );
              })}
            </Select>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => {
                  if (!addToTeamBox || !addToTeamSlotIndex) return;
                  const nextSlots = teamSlots.map((slot) =>
                    slot.slotIndex === addToTeamSlotIndex ? { ...slot, boxPokemonId: addToTeamBox.id } : slot
                  );
                  saveTeam.mutate(nextSlots.map((s) => ({ slotIndex: s.slotIndex, boxPokemonId: s.boxPokemonId })));
                  setAddToTeamOpen(false);
                  setAddToTeamBox(null);
                  setAddToTeamSlotIndex("");
                }}
                type="button"
              >
                Confirm Swap
              </Button>
              <GhostButton
                onClick={() => {
                  setAddToTeamOpen(false);
                  setAddToTeamBox(null);
                  setAddToTeamSlotIndex("");
                }}
                type="button"
              >
                Cancel
              </GhostButton>
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto overflow-x-visible">
            {renderMatrix(
              previewMatrix,
              addToTeamSlotIndex && addToTeamBox
                ? teamSlots.map((slot) => {
                    if (slot.slotIndex === addToTeamSlotIndex) {
                      return {
                        boxPokemonId: addToTeamBox.id,
                        nickname: addToTeamBox.nickname,
                        speciesName: addToTeamBox.speciesName,
                        type1Id: addToTeamBox.type1Id,
                        type2Id: addToTeamBox.type2Id,
                        type1Name: addToTeamBox.type1Name ?? null,
                        type2Name: addToTeamBox.type2Name ?? null
                      };
                    }
                    const member = teamMembers.find((m) => m?.boxPokemonId === slot.boxPokemonId) ?? null;
                    return member ?? null;
                  })
                : teamMembers
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
