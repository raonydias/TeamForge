import { useEffect, useState } from "react";
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
  packId: z.coerce.number().int()
});

type FormValues = z.infer<typeof schema>;

export default function Games() {
  const queryClient = useQueryClient();
  const { data: games = [] } = useQuery<GameRow[]>({ queryKey: ["games"], queryFn: () => api.get("/games") });
  const { data: packs = [] } = useQuery<PackRow[]>({ queryKey: ["packs"], queryFn: () => api.get("/packs") });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", notes: "", packId: packs[0]?.id ?? 0 }
  });

  useEffect(() => {
    if (packs.length > 0) {
      form.setValue("packId", packs[0].id);
    }
  }, [packs, form]);

  const create = useMutation({
    mutationFn: (payload: FormValues) => api.post("/games", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      form.reset();
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
  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <Card>
        <CardHeader title="Create Game" subtitle="Choose a base pack for this game." />
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
          <Input placeholder="Game name" {...form.register("name")} />
          <Input placeholder="Notes / rules" {...form.register("notes")} />
          <Select {...form.register("packId")}>
            {packs.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.name}
              </option>
            ))}
          </Select>
          <Button type="submit">Create</Button>
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
                  <div className="flex gap-2 text-sm">
                    <Button
                      onClick={() => {
                        update.mutate({
                          id: game.id,
                          data: { name: editName.trim(), notes: editNotes.trim() || null, packId: game.packId }
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
                    Pack: {packs.find((p) => p.id === game.packId)?.name ?? "Unknown"}
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
