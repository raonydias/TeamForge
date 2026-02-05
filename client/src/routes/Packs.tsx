import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PackImportRow, PackRow } from "../lib/types";
import { Button, Card, CardHeader, Input, Modal, GhostButton, Select } from "../components/ui";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  useSingleSpecial: z.boolean().optional()
});

type FormValues = z.infer<typeof schema>;

export default function Packs() {
  const queryClient = useQueryClient();
  const { data: packs = [] } = useQuery<PackRow[]>({ queryKey: ["packs"], queryFn: () => api.get("/packs") });
  const { data: packImportsMap = new Map<number, PackImportRow[]>() } = useQuery({
    queryKey: ["packImports", packs.map((p) => p.id).join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        packs.map(async (pack) => {
          const rows = await api.get<PackImportRow[]>(`/packs/${pack.id}/imports`);
          return [pack.id, rows] as const;
        })
      );
      return new Map(entries);
    },
    enabled: packs.length > 0
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", useSingleSpecial: false }
  });

  const create = useMutation({
    mutationFn: (payload: FormValues & { importPackIds: number[] }) => api.post("/packs", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs"] });
      form.reset();
      setImportPackIds([]);
      setNextImportPackId("");
    }
  });

  const update = useMutation({
    mutationFn: (payload: {
      id: number;
      name: string;
      description: string | null;
      useSingleSpecial: boolean;
      importPackIds: number[];
    }) =>
      api.put(`/packs/${payload.id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs"] })
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/packs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs"] })
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSingleSpecial, setEditSingleSpecial] = useState(false);
  const [editImportPackIds, setEditImportPackIds] = useState<number[]>([]);
  const [editNextImportPackId, setEditNextImportPackId] = useState<number | "">("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [createDragIndex, setCreateDragIndex] = useState<number | null>(null);
  const [importPackIds, setImportPackIds] = useState<number[]>([]);
  const [nextImportPackId, setNextImportPackId] = useState<number | "">("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmBody, setConfirmBody] = useState<string[]>([]);
  const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);

  const availableImportPacks = packs.filter((pack) => !importPackIds.includes(pack.id));
  const availableEditImportPacks = packs.filter(
    (pack) => pack.id !== editingId && !editImportPackIds.includes(pack.id)
  );

  function moveImport(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const next = [...importPackIds];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setImportPackIds(next);
  }

  function moveEditImport(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const next = [...editImportPackIds];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setEditImportPackIds(next);
  }

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <Card>
        <CardHeader title="Create Pack" subtitle="Base datasets for canon or fangames." />
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((values) =>
            create.mutate({
              ...values,
              importPackIds
            })
          )}
        >
          <Input placeholder="Pack name" {...form.register("name")} />
          <Input placeholder="Description" {...form.register("description")} />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" {...form.register("useSingleSpecial")} />
            Gen 1 Special (SpA = SpD)
          </label>
          <div className="space-y-2">
            <div className="text-xs text-slate-500">Imported Abilities & Items (last wins)</div>
            <div className="space-y-2">
              {importPackIds.length === 0 ? (
                <div className="text-xs text-slate-500">No imports selected.</div>
              ) : (
                importPackIds.map((packId, index) => {
                  const pack = packs.find((p) => p.id === packId);
                  return (
                    <div
                      key={packId}
                      className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      draggable
                      onDragStart={() => setCreateDragIndex(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (createDragIndex === null) return;
                        moveImport(createDragIndex, index);
                        setCreateDragIndex(null);
                      }}
                    >
                      <span className="font-medium">{pack?.name ?? "Unknown Pack"}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-xs text-slate-400 hover:text-slate-600"
                          onClick={() => setImportPackIds((prev) => prev.filter((id) => id !== packId))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex gap-2">
              <Select
                value={nextImportPackId}
                onChange={(e) => setNextImportPackId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Add pack</option>
                {availableImportPacks.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                onClick={() => {
                  if (typeof nextImportPackId !== "number") return;
                  setImportPackIds((prev) => [...prev, nextImportPackId]);
                  setNextImportPackId("");
                }}
              >
                Add
              </Button>
            </div>
          </div>
          <Button type="submit">Create</Button>
        </form>
      </Card>
      <Card>
        <CardHeader title="Packs" subtitle="Manage pack data." />
        <div className="space-y-3">
          {packs.map((pack) => (
            <div key={pack.id} className="border border-slate-100 rounded-xl p-4 flex flex-col gap-2">
              {editingId === pack.id ? (
                <>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" />
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={editSingleSpecial}
                      onChange={(e) => setEditSingleSpecial(e.target.checked)}
                    />
                    Gen 1 Special (SpA = SpD)
                  </label>
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500">Imported Abilities & Items (last wins)</div>
                    <div className="space-y-2">
                      {editImportPackIds.length === 0 ? (
                        <div className="text-xs text-slate-500">No imports selected.</div>
                      ) : (
                        editImportPackIds.map((packId, index) => {
                          const entry = packs.find((p) => p.id === packId);
                          return (
                            <div
                              key={packId}
                              className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                              draggable
                              onDragStart={() => setDragIndex(index)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => {
                                if (dragIndex === null) return;
                                moveEditImport(dragIndex, index);
                                setDragIndex(null);
                              }}
                            >
                              <span className="font-medium">{entry?.name ?? "Unknown Pack"}</span>
                              <button
                                type="button"
                                className="text-xs text-slate-400 hover:text-slate-600"
                                onClick={() => setEditImportPackIds((prev) => prev.filter((id) => id !== packId))}
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={editNextImportPackId}
                        onChange={(e) =>
                          setEditNextImportPackId(e.target.value ? Number(e.target.value) : "")
                        }
                      >
                        <option value="">Add pack</option>
                        {availableEditImportPacks.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                      <Button
                        type="button"
                        onClick={() => {
                          if (typeof editNextImportPackId !== "number") return;
                          setEditImportPackIds((prev) => [...prev, editNextImportPackId]);
                          setEditNextImportPackId("");
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <Button
                      onClick={() => {
                        update.mutate({
                          id: pack.id,
                          name: editName.trim(),
                          description: editDesc.trim() || null,
                          useSingleSpecial: editSingleSpecial,
                          importPackIds: editImportPackIds
                        });
                        setEditingId(null);
                      }}
                      type="button"
                    >
                      Save
                    </Button>
                    <Button
                      onClick={() => setEditingId(null)}
                      type="button"
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="font-semibold text-lg">{pack.name}</div>
                  {pack.description ? <div className="text-sm text-slate-500">{pack.description}</div> : null}
                  <div className="text-xs text-slate-500">
                    Imports:{" "}
                    {(packImportsMap.get(pack.id) ?? []).length
                      ? (packImportsMap.get(pack.id) ?? [])
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((row) => row.name)
                          .join(" → ")
                      : "None"}
                  </div>
                  <div className="flex gap-2 text-sm">
                    <Button
                      onClick={() => {
                        (async () => {
                          setEditingId(pack.id);
                          setEditName(pack.name);
                          setEditDesc(pack.description ?? "");
                          setEditSingleSpecial(pack.useSingleSpecial);
                          setEditNextImportPackId("");
                          const imports = await api.get<PackImportRow[]>(`/packs/${pack.id}/imports`);
                          const ordered = [...imports].sort((a, b) => a.sortOrder - b.sortOrder);
                          setEditImportPackIds(ordered.map((row) => row.importPackId));
                        })();
                      }}
                      type="button"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={async () => {
                        const summary = await api.get<{
                          types: number;
                          species: number;
                          abilities: number;
                          items: number;
                          games: number;
                          boxPokemon: number;
                          teamSlots: number;
                          allowedSpecies: number;
                          allowedAbilities: number;
                          allowedItems: number;
                        speciesAbilities: number;
                          speciesAbilities: number;
                        }>(`/packs/${pack.id}/summary`);

                        setConfirmTitle(`Delete pack "${pack.name}"?`);
                        setConfirmBody([
                          `Types: ${summary.types}`,
                          `Species: ${summary.species}`,
                          `Abilities: ${summary.abilities}`,
                          `Items: ${summary.items}`,
                          `Games: ${summary.games}`,
                          `Game Allowed Species: ${summary.allowedSpecies}`,
                          `Game Allowed Abilities: ${summary.allowedAbilities}`,
                          `Game Allowed Items: ${summary.allowedItems}`,
                          `Game Species Abilities: ${summary.speciesAbilities}`,
                          `Game Species Abilities: ${summary.speciesAbilities}`,
                          `Box Pokemon: ${summary.boxPokemon}`,
                          `Team Slots: ${summary.teamSlots}`
                        ]);
                        setConfirmAction(() => () => remove.mutate(pack.id));
                        setConfirmOpen(true);
                      }}
                      type="button"
                    >
                      Delete
                    </Button>
                  </div>
                </>
              )}
              <div className="flex gap-3 text-sm">
                <Link className="text-accent" to={`/packs/${pack.id}/types`}>
                  Types & Chart
                </Link>
                <Link className="text-accent" to={`/packs/${pack.id}/species`}>
                  Species
                </Link>
                <Link className="text-accent" to={`/packs/${pack.id}/abilities`}>
                  Abilities
                </Link>
                <Link className="text-accent" to={`/packs/${pack.id}/items`}>
                  Items
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Modal title={confirmTitle} isOpen={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="text-sm text-slate-600 space-y-1">
          <div>This will also remove:</div>
          {confirmBody.map((line) => (
            <div key={line}>• {line}</div>
          ))}
          <div className="mt-3 text-xs text-slate-500">This action cannot be undone.</div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => {
              confirmAction?.();
              setConfirmOpen(false);
            }}
            type="button"
          >
            Delete
          </Button>
          <GhostButton onClick={() => setConfirmOpen(false)} type="button">
            Cancel
          </GhostButton>
        </div>
      </Modal>
    </div>
  );
}
