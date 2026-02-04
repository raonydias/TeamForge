import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { api } from "../lib/api";
import { GameRow, GameSpeciesRow, GameTypeRow } from "../lib/types";
import { Card, CardHeader, Input, Select, TypePill } from "../components/ui";
import { DataTable } from "../components/DataTable";

export default function GameDex() {
  const { id } = useParams();
  const gameId = Number(id);
  const [search, setSearch] = useState("");
  const [typeId, setTypeId] = useState("");
  const [minStats, setMinStats] = useState({
    hp: "",
    atk: "",
    def: "",
    spa: "",
    spd: "",
    spe: "",
    special: "",
    bst: ""
  });

  const { data: game } = useQuery<GameRow | null>({
    queryKey: ["games", gameId],
    queryFn: () => api.get(`/games/${gameId}`)
  });

  const useSingleSpecial = game?.useSingleSpecial ?? false;

  const { data: types = [] } = useQuery<GameTypeRow[]>({
    queryKey: ["games", gameId, "types"],
    queryFn: () => api.get(`/games/${gameId}/types`),
    enabled: !!gameId
  });

  const { data: dex = [] } = useQuery<GameSpeciesRow[]>({
    queryKey: ["games", gameId, "dex", search, typeId, minStats, useSingleSpecial],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (typeId) params.set("typeId", typeId);
      if (minStats.hp) params.set("minHp", minStats.hp);
      if (minStats.atk) params.set("minAtk", minStats.atk);
      if (minStats.def) params.set("minDef", minStats.def);
      if (useSingleSpecial) {
        if (minStats.special) params.set("minSpecial", minStats.special);
      } else {
        if (minStats.spa) params.set("minSpa", minStats.spa);
        if (minStats.spd) params.set("minSpd", minStats.spd);
      }
      if (minStats.spe) params.set("minSpe", minStats.spe);
      if (minStats.bst) params.set("minBst", minStats.bst);
      const qs = params.toString();
      return api.get(`/games/${gameId}/dex${qs ? `?${qs}` : ""}`);
    }
  });

  const typeColorByName = useMemo(() => new Map(types.map((t) => [t.name, t.color])), [types]);

  const columns: ColumnDef<GameSpeciesRow>[] = [
    { id: "dexNumber", header: "Dex #", accessorKey: "dexNumber" },
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      cell: (info) => <span className="font-medium">{info.getValue<string>()}</span>
    },
    {
      id: "types",
      header: "Types",
      cell: ({ row }) => {
        const names = [row.original.type1Name, row.original.type2Name].filter(Boolean) as string[];
        return (
          <div className="flex flex-wrap gap-2">
            {names.map((name) => (
              <TypePill key={name} name={name} color={typeColorByName.get(name) ?? null} />
            ))}
          </div>
        );
      }
    },
    { id: "hp", header: "HP", accessorKey: "hp" },
    { id: "atk", header: "Atk", accessorKey: "atk" },
    { id: "def", header: "Def", accessorKey: "def" },
    useSingleSpecial
      ? { id: "special", header: "Special", accessorKey: "spa" }
      : { id: "spa", header: "SpA", accessorKey: "spa" },
    ...(useSingleSpecial ? [] : [{ id: "spd", header: "SpD", accessorKey: "spd" }]),
    { id: "spe", header: "Spe", accessorKey: "spe" },
    {
      id: "bst",
      header: "BST",
      accessorFn: (row) =>
        row.hp +
        row.atk +
        row.def +
        row.spa +
        (useSingleSpecial ? 0 : row.spd) +
        row.spe,
      cell: ({ row }) =>
        row.original.hp +
        row.original.atk +
        row.original.def +
        row.original.spa +
        (useSingleSpecial ? 0 : row.original.spd) +
        row.original.spe
    }
  ];

  return (
    <Card>
      <CardHeader title="Game Dex" subtitle="Allowed species for this game." />
      <div className="flex gap-3 mb-4">
        <Input placeholder="Search species" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">All Types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        <Input placeholder="Min HP" value={minStats.hp} onChange={(e) => setMinStats((s) => ({ ...s, hp: e.target.value }))} />
        <Input placeholder="Min Atk" value={minStats.atk} onChange={(e) => setMinStats((s) => ({ ...s, atk: e.target.value }))} />
        <Input placeholder="Min Def" value={minStats.def} onChange={(e) => setMinStats((s) => ({ ...s, def: e.target.value }))} />
        {useSingleSpecial ? (
          <Input
            placeholder="Min Special"
            value={minStats.special}
            onChange={(e) => setMinStats((s) => ({ ...s, special: e.target.value }))}
          />
        ) : (
          <>
            <Input placeholder="Min SpA" value={minStats.spa} onChange={(e) => setMinStats((s) => ({ ...s, spa: e.target.value }))} />
            <Input placeholder="Min SpD" value={minStats.spd} onChange={(e) => setMinStats((s) => ({ ...s, spd: e.target.value }))} />
          </>
        )}
        <Input placeholder="Min Spe" value={minStats.spe} onChange={(e) => setMinStats((s) => ({ ...s, spe: e.target.value }))} />
        <Input placeholder="Min BST" value={minStats.bst} onChange={(e) => setMinStats((s) => ({ ...s, bst: e.target.value }))} />
      </div>
      <div className="overflow-auto">
        <DataTable data={dex} columns={columns} />
      </div>
    </Card>
  );
}
