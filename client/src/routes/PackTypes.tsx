import { useMemo, useRef, useState } from "react";
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
  const [excludeInChart, setExcludeInChart] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editMeta, setEditMeta] = useState("");
  const [editColor, setEditColor] = useState("#cbd5f5");
  const [editExcludeInChart, setEditExcludeInChart] = useState(false);
  const [ruleAtk, setRuleAtk] = useState<number | "">("");
  const [ruleDef, setRuleDef] = useState<number[]>([]);
  const [ruleMult, setRuleMult] = useState<number>(2);
  const [hoverAtkId, setHoverAtkId] = useState<number | null>(null);
  const [hoverDefId, setHoverDefId] = useState<number | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  function normalizeHex(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return "";
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  }

  const createType = useMutation({
    mutationFn: (payload: { name: string; color: string | null; excludeInChart: boolean }) =>
      api.post<PackTypeRow>(`/packs/${packId}/types`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "types"] })
  });

  const updateType = useMutation({
    mutationFn: (payload: { id: number; name: string; metadata: string | null; color: string | null; excludeInChart: boolean }) =>
      api.put(`/packs/${packId}/types/${payload.id}`, {
        name: payload.name,
        metadata: payload.metadata,
        color: payload.color,
        excludeInChart: payload.excludeInChart
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "types"] })
  });

  const deleteType = useMutation({
    mutationFn: (idValue: number) => api.del(`/packs/${packId}/types/${idValue}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "types"] })
  });

  async function exportTypeChart() {
    const payload = await api.get(`/packs/${packId}/typechart/export`);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pack-${packId}-types.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    setImportBusy(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await api.post(`/packs/${packId}/typechart/import`, json);
      queryClient.invalidateQueries({ queryKey: ["packs", packId, "types"] });
      queryClient.invalidateQueries({ queryKey: ["packs", packId, "typechart"] });
    } finally {
      setImportBusy(false);
    }
  }

  const chartMap = useMemo(() => {
    const map = new Map<string, number>();
    chart.forEach((row) => map.set(`${row.attackingTypeId}-${row.defendingTypeId}`, row.multiplier));
    return map;
  }, [chart]);

  const visibleTypes = useMemo(() => types.filter((t) => !t.excludeInChart), [types]);

  async function applyRule() {
    if (!ruleAtk || ruleDef.length === 0) return;
    await Promise.all(
      ruleDef.map((defId) =>
        api.post(`/packs/${packId}/typechart`, {
          attackingTypeId: ruleAtk,
          defendingTypeId: defId,
          multiplier: ruleMult
        })
      )
    );
    queryClient.invalidateQueries({ queryKey: ["packs", packId, "typechart"] });
  }

  function formatMultiplier(value: number) {
    if (value === 0) return "0";
    if (value === 0.25) return "1/4";
    if (value === 0.5) return "1/2";
    if (value === 2) return "2x";
    if (value === 4) return "4x";
    return value.toString();
  }

  function multiplierBadgeClass(value: number) {
    if (value === 0) return "bg-slate-200 text-slate-700";
    if (value === 0.25) return "bg-emerald-100 text-emerald-700";
    if (value === 0.5) return "bg-emerald-50 text-emerald-700";
    if (value === 2) return "bg-rose-50 text-rose-700";
    if (value === 4) return "bg-rose-200 text-rose-900 border border-rose-300";
    return "bg-slate-100 text-slate-700";
  }

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
          <Input
            value={color}
            onChange={(e) => setColor(normalizeHex(e.target.value) || "#")}
            placeholder="#RRGGBB"
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={excludeInChart}
              onChange={(e) => setExcludeInChart(e.target.checked)}
            />
            Exclude from chart
          </label>
          <Button
            onClick={() => {
              if (!name.trim()) return;
              createType.mutate({ name: name.trim(), color: color || null, excludeInChart });
              setName("");
              setExcludeInChart(false);
            }}
          >
            Add
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={exportTypeChart}>
            Export Types + Chart
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
            {importBusy ? "Importing..." : "Import Types + Chart"}
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {types.map((type) => (
            <div key={type.id} className="rounded-xl border border-slate-200 p-3 bg-white/70">
              {editingId === type.id ? (
                <div className="space-y-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <Input value={editMeta} onChange={(e) => setEditMeta(e.target.value)} placeholder="Metadata" />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="h-9 w-9 rounded-lg border border-slate-200 bg-white p-1"
                      aria-label="Type color"
                    />
                    <Input
                      value={editColor}
                      onChange={(e) => setEditColor(normalizeHex(e.target.value) || "#")}
                      placeholder="#RRGGBB"
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={editExcludeInChart}
                        onChange={(e) => setEditExcludeInChart(e.target.checked)}
                      />
                      Exclude from chart
                    </label>
                    <Button
                      onClick={() => {
                        updateType.mutate({
                          id: type.id,
                          name: editName.trim(),
                          metadata: editMeta.trim() || null,
                          color: editColor || null,
                          excludeInChart: editExcludeInChart
                        });
                        setEditingId(null);
                      }}
                      type="button"
                      className="px-3 py-1 text-xs"
                    >
                      Save
                    </Button>
                    <Button onClick={() => setEditingId(null)} type="button" className="px-3 py-1 text-xs">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <TypePill name={type.name} color={type.color} className="text-sm" />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setEditingId(type.id);
                        setEditName(type.name);
                        setEditMeta(type.metadata ?? "");
                        setEditColor(type.color ?? "#cbd5f5");
                        setEditExcludeInChart(type.excludeInChart ?? false);
                      }}
                      type="button"
                      className="px-3 py-1 text-xs"
                    >
                      Edit
                    </Button>
                    <Button onClick={() => deleteType.mutate(type.id)} type="button" className="px-3 py-1 text-xs">
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Type Chart" subtitle="Define matchups via rules, then review the grid." />
        <div className="grid lg:grid-cols-[260px_1fr] gap-6 mb-6">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">Attacking Type</div>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                value={ruleAtk}
                onChange={(e) => setRuleAtk(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Select type</option>
                {visibleTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Defending Types</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {visibleTypes.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={ruleDef.includes(t.id)}
                      onChange={() =>
                        setRuleDef((prev) => (prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]))
                      }
                    />
                    <TypePill name={t.name} color={t.color} />
                  </label>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Button type="button" onClick={() => setRuleDef(visibleTypes.map((t) => t.id))}>
                  Select All
                </Button>
                <Button type="button" onClick={() => setRuleDef([])}>
                  Clear
                </Button>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Multiplier</div>
              <div className="grid grid-cols-3 gap-2">
                {[0, 0.25, 0.5, 1, 2, 4].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRuleMult(value)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold ${
                      ruleMult === value ? "border-accent text-accent" : "border-slate-200 text-slate-500"
                    }`}
                  >
                    {formatMultiplier(value)}
                  </button>
                ))}
              </div>
            </div>
            <Button type="button" onClick={applyRule}>
              Apply Rule
            </Button>
          </div>
          <div className="text-sm text-slate-500">
            Use rules to set multiple matchups at once. The grid below updates after applying.
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-[700px] text-sm border-separate border-spacing-2 text-center">
            <thead>
              <tr>
                <th className="text-left text-slate-500 sticky left-0 top-0 z-20">Atk \ Def</th>
                {visibleTypes.map((type) => (
                  <th
                    key={type.id}
                    className={`text-center text-slate-600 sticky top-0 z-10 ${
                      hoverDefId === type.id ? "bg-slate-100/80 ring-1 ring-slate-200 rounded-lg" : ""
                    }`}
                  >
                    <TypePill name={type.name} color={type.color} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleTypes.map((atk) => (
                <tr key={atk.id}>
                  <td
                    className={`font-medium text-slate-700 sticky left-0 z-10 text-left ${
                      hoverAtkId === atk.id ? "bg-slate-100/80 ring-1 ring-slate-200 rounded-lg" : ""
                    }`}
                  >
                    <TypePill name={atk.name} color={atk.color} />
                  </td>
                  {visibleTypes.map((def) => {
                    const key = `${atk.id}-${def.id}`;
                    const value = chartMap.get(key) ?? 1;
                    const isHoverRow = hoverAtkId === atk.id;
                    const isHoverCol = hoverDefId === def.id;
                    return (
                      <td
                        key={key}
                        className={`text-center ${
                          isHoverRow || isHoverCol ? "bg-slate-100/60 ring-1 ring-slate-200 rounded-lg" : ""
                        }`}
                        onMouseEnter={() => {
                          setHoverAtkId(atk.id);
                          setHoverDefId(def.id);
                        }}
                        onMouseLeave={() => {
                          setHoverAtkId(null);
                          setHoverDefId(null);
                        }}
                      >
                        <span
                          className={`inline-flex min-w-[2.75rem] justify-center rounded-lg px-2 py-1 text-xs font-semibold ${multiplierBadgeClass(
                            value
                          )}`}
                        >
                          {formatMultiplier(value)}
                        </span>
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
