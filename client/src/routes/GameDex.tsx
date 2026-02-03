import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { api } from "../lib/api";
import { SpeciesRow, TypeRow } from "../lib/types";
import { Card, CardHeader, Input, Select } from "../components/ui";
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
    spe: ""
  });

  const { data: types = [] } = useQuery<TypeRow[]>({ queryKey: ["types"], queryFn: () => api.get("/types") });

  const { data: dex = [] } = useQuery<SpeciesRow[]>({
    queryKey: ["games", gameId, "dex", search, typeId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (typeId) params.set("typeId", typeId);
      if (minStats.hp) params.set("minHp", minStats.hp);
      if (minStats.atk) params.set("minAtk", minStats.atk);
      if (minStats.def) params.set("minDef", minStats.def);
      if (minStats.spa) params.set("minSpa", minStats.spa);
      if (minStats.spd) params.set("minSpd", minStats.spd);
      if (minStats.spe) params.set("minSpe", minStats.spe);
      const qs = params.toString();
      return api.get(`/games/${gameId}/dex${qs ? `?${qs}` : ""}`);
    }
  });

  const columns: ColumnDef<SpeciesRow>[] = [
    { header: "Name", accessorKey: "name", cell: (info) => <span className="font-medium">{info.getValue<string>()}</span> },
    {
      header: "Types",
      cell: ({ row }) => [row.original.type1Name, row.original.type2Name].filter(Boolean).join(" / ")
    },
    { header: "HP", accessorKey: "hp" },
    { header: "Atk", accessorKey: "atk" },
    { header: "Def", accessorKey: "def" },
    { header: "SpA", accessorKey: "spa" },
    { header: "SpD", accessorKey: "spd" },
    { header: "Spe", accessorKey: "spe" }
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
        <Input placeholder="Min SpA" value={minStats.spa} onChange={(e) => setMinStats((s) => ({ ...s, spa: e.target.value }))} />
        <Input placeholder="Min SpD" value={minStats.spd} onChange={(e) => setMinStats((s) => ({ ...s, spd: e.target.value }))} />
        <Input placeholder="Min Spe" value={minStats.spe} onChange={(e) => setMinStats((s) => ({ ...s, spe: e.target.value }))} />
      </div>
      <div className="overflow-auto">
        <DataTable data={dex} columns={columns} />
      </div>
    </Card>
  );
}
