import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { PackTypeChartRow, PackTypeRow } from "../lib/types";
import { Button, Card, CardHeader, Input, TypePill } from "../components/ui";

export default function PackTypes() {
  const { id } = useParams();
  const packId = Number(id);
  const queryClient = useQueryClient();

  const { data: types = [] } = useQuery<PackTypeRow[]>({
    queryKey: ["packs", packId, "types"],
    queryFn: () => api.get(`/packs/${packId}/types`)
  });
  const { data: chart = [] } = useQuery<PackTypeChartRow[]>({
    queryKey: ["packs", packId, "typechart"],
    queryFn: () => api.get(`/packs/${packId}/typechart`)
  });

  const [name, setName] = useState("");
  const [color, setColor] = useState("#cbd5f5");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editMeta, setEditMeta] = useState("");
  const [editColor, setEditColor] = useState("#cbd5f5");

  const createType = useMutation({
    mutationFn: (payload: { name: string; color: string | null }) => api.post<PackTypeRow>(`/packs/${packId}/types`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "types"] })
  });

  const updateType = useMutation({
    mutationFn: (payload: { id: number; name: string; metadata: string | null; color: string | null }) =>
      api.put(`/packs/${packId}/types/${payload.id}`, { name: payload.name, metadata: payload.metadata, color: payload.color }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "types"] })
  });

  const deleteType = useMutation({
    mutationFn: (idValue: number) => api.del(`/packs/${packId}/types/${idValue}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "types"] })
  });

  const updateChart = useMutation({
    mutationFn: (payload: Omit<PackTypeChartRow, "packId">) => api.post(`/packs/${packId}/typechart`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "typechart"] })
  });

  const chartMap = useMemo(() => {
    const map = new Map<string, number>();
    chart.forEach((row) => map.set(`${row.attackingTypeId}-${row.defendingTypeId}`, row.multiplier));
    return map;
  }, [chart]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Types" subtitle="Define types for this pack." />
        <div className="flex flex-wrap items-center gap-3 max-w-lg">
          <Input placeholder="Type name" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-10 rounded-lg border border-slate-200 bg-white p-1"
            aria-label="Type color"
          />
          <Button
            onClick={() => {
              if (!name.trim()) return;
              createType.mutate({ name: name.trim(), color: color || null });
              setName("");
            }}
          >
            Add
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {types.map((type) => (
            <div key={type.id} className="flex items-center gap-2">
              {editingId === type.id ? (
                <>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-[200px]" />
                  <Input value={editMeta} onChange={(e) => setEditMeta(e.target.value)} className="max-w-[240px]" placeholder="Metadata" />
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-10 w-10 rounded-lg border border-slate-200 bg-white p-1"
                    aria-label="Type color"
                  />
                  <Button
                    onClick={() => {
                      updateType.mutate({ id: type.id, name: editName.trim(), metadata: editMeta.trim() || null, color: editColor || null });
                      setEditingId(null);
                    }}
                    type="button"
                  >
                    Save
                  </Button>
                  <Button onClick={() => setEditingId(null)} type="button">
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <TypePill name={type.name} color={type.color} className="text-sm" />
                  <Button
                    onClick={() => {
                      setEditingId(type.id);
                      setEditName(type.name);
                      setEditMeta(type.metadata ?? "");
                      setEditColor(type.color ?? "#cbd5f5");
                    }}
                    type="button"
                  >
                    Edit
                  </Button>
                  <Button onClick={() => deleteType.mutate(type.id)} type="button">
                    Delete
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Type Chart" subtitle="Edit effectiveness multipliers for each matchup." />
        <div className="overflow-auto">
          <table className="min-w-[700px] text-sm border-separate border-spacing-2">
            <thead>
              <tr>
                <th className="text-left text-slate-500">Atk \ Def</th>
                {types.map((type) => (
                  <th key={type.id} className="text-left text-slate-600">
                    <TypePill name={type.name} color={type.color} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {types.map((atk) => (
                <tr key={atk.id}>
                  <td className="font-medium text-slate-700">
                    <TypePill name={atk.name} color={atk.color} />
                  </td>
                  {types.map((def) => {
                    const key = `${atk.id}-${def.id}`;
                    const value = chartMap.get(key) ?? 1;
                    return (
                      <td key={key}>
                        <Input
                          type="number"
                          step="0.5"
                          value={value}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            updateChart.mutate({
                              attackingTypeId: atk.id,
                              defendingTypeId: def.id,
                              multiplier: Number.isFinite(next) ? next : 1
                            });
                          }}
                          className="w-20"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
