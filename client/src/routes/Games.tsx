import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { GameRow, PackRow } from "../lib/types";
import { Button, Card, CardHeader, Input, Select } from "../components/ui";

const schema = z.object({
  name: z.string().min(1),
  notes: z.string().optional().nullable(),
  disableAbilities: z.boolean().optional(),
  disableHeldItems: z.boolean().optional()
});

type FormValues = z.infer<typeof schema>;

export default function Games() {
  const queryClient = useQueryClient();
  const { data: games = [] } = useQuery<GameRow[]>({ queryKey: ["games"], queryFn: () => api.get("/games") });
  const { data: packs = [] } = useQuery<PackRow[]>({ queryKey: ["packs"], queryFn: () => api.get("/packs") });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      notes: "",
      disableAbilities: false,
      disableHeldItems: false
    }
  });

  const [selectedPackIds, setSelectedPackIds] = useState<number[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [nextPackId, setNextPackId] = useState<number | "">("");

  useEffect(() => {
    if (packs.length > 0 && selectedPackIds.length === 0) {
      setSelectedPackIds([packs[0].id]);
    }
  }, [packs, selectedPackIds.length]);

  const create = useMutation({
    mutationFn: (payload: FormValues & { packIds: number[] }) => api.post("/games", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      form.reset();
      setSelectedPackIds(packs[0]?.id ? [packs[0].id] : []);
    }
  });

  const update = useMutation({
    mutationFn: (payload: { id: number; data: FormValues }) => api.put(`/games/${payload.id}`, payload.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games"] })
  });

  const remove = useMutation({
    mutationFn: (idValue: number) => api.del(`/games/${idValue}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games"] })
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDisableAbilities, setEditDisableAbilities] = useState(false);
  const [editDisableHeldItems, setEditDisableHeldItems] = useState(false);

  const availablePacks = useMemo(
    () => packs.filter((pack) => !selectedPackIds.includes(pack.id)),
    [packs, selectedPackIds]
  );

  function movePack(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const next = [...selectedPackIds];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setSelectedPackIds(next);
  }

  function addPack(packId: number) {
    if (selectedPackIds.includes(packId)) return;
    setSelectedPackIds((prev) => [...prev, packId]);
  }

  function removePack(packId: number) {
    setSelectedPackIds((prev) => prev.filter((id) => id !== packId));
  }

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <Card>
        <CardHeader title="Create Game" subtitle="Choose and order packs for this game." />
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((values) =>
            create.mutate({
              ...values,
              packIds: selectedPackIds
            })
          )}
        >
          <Input placeholder="Game name" {...form.register("name")} />
          <Input placeholder="Notes / rules" {...form.register("notes")} />
          <div className="space-y-2">
            <div className="text-xs text-slate-500">Pack stack (last wins)</div>
            <div className="space-y-2">
              {selectedPackIds.length === 0 ? (
                <div className="text-xs text-slate-500">No packs selected.</div>
              ) : (
                selectedPackIds.map((packId, index) => {
                  const pack = packs.find((p) => p.id === packId);
                  return (
                    <div
                      key={packId}
                      className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex === null) return;
                        movePack(dragIndex, index);
                        setDragIndex(null);
                      }}
                    >
                      <span className="font-medium">{pack?.name ?? "Unknown Pack"}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-xs text-slate-400 hover:text-slate-600"
                          onClick={() => removePack(packId)}
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
              <Select value={nextPackId} onChange={(e) => setNextPackId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Add pack</option>
                {availablePacks.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                onClick={() => {
                  if (typeof nextPackId !== "number") return;
                  addPack(nextPackId);
                  setNextPackId("");
                }}
              >
                Add
              </Button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" {...form.register("disableAbilities")} />
            Disable Abilities
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" {...form.register("disableHeldItems")} />
            Disable Held Items
          </label>
          <Button type="submit" disabled={selectedPackIds.length === 0}>
            Create
          </Button>
        </form>
      </Card>
      <Card>
        <CardHeader title="Games" subtitle="Jump into setup and views." />
        <div className="space-y-3">
          {games.map((game) => (
            <div key={game.id} className="border border-slate-100 rounded-xl p-4 flex flex-col gap-2">
              {editingId === game.id ? (
                <>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes / rules" />
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={editDisableAbilities}
                      onChange={(e) => setEditDisableAbilities(e.target.checked)}
                    />
                    Disable Abilities
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={editDisableHeldItems}
                      onChange={(e) => setEditDisableHeldItems(e.target.checked)}
                    />
                    Disable Held Items
                  </label>
                  <div className="flex gap-2 text-sm">
                    <Button
                      onClick={() => {
                        update.mutate({
                          id: game.id,
                          data: {
                            name: editName.trim(),
                            notes: editNotes.trim() || null,
                            disableAbilities: editDisableAbilities,
                            disableHeldItems: editDisableHeldItems
                          }
                        });
                        setEditingId(null);
                      }}
                      type="button"
                    >
                      Save
                    </Button>
                    <Button onClick={() => setEditingId(null)} type="button">
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="font-semibold text-lg">{game.name}</div>
                  <div className="text-xs text-slate-500">
                    Packs: {game.packNames?.length ? game.packNames.join(" → ") : "None"}
                  </div>
                  {game.notes ? <div className="text-sm text-slate-500">{game.notes}</div> : null}
                  <div className="flex gap-3 text-sm">
                    <Link className="text-accent" to={`/games/${game.id}/setup`}>
                      Setup
                    </Link>
                    <Link className="text-accent" to={`/games/${game.id}/dex`}>
                      Dex
                    </Link>
                    <Link className="text-accent" to={`/games/${game.id}/box`}>
                      Box
                    </Link>
                    <Link className="text-accent" to={`/games/${game.id}/team`}>
                      Team
                    </Link>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <Button
                      onClick={() => {
                        setEditingId(game.id);
                        setEditName(game.name);
                        setEditNotes(game.notes ?? "");
                        setEditDisableAbilities(game.disableAbilities);
                        setEditDisableHeldItems(game.disableHeldItems);
                      }}
                      type="button"
                    >
                      Edit
                    </Button>
                    <Button onClick={() => remove.mutate(game.id)} type="button">
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
