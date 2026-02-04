import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PackRow } from "../lib/types";
import { Button, Card, CardHeader, Input } from "../components/ui";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable()
});

type FormValues = z.infer<typeof schema>;

export default function Packs() {
  const queryClient = useQueryClient();
  const { data: packs = [] } = useQuery<PackRow[]>({ queryKey: ["packs"], queryFn: () => api.get("/packs") });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", description: "" } });

  const create = useMutation({
    mutationFn: (payload: FormValues) => api.post("/packs", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs"] });
      form.reset();
    }
  });

  const update = useMutation({
    mutationFn: (payload: { id: number; name: string; description: string | null }) =>
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

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <Card>
        <CardHeader title="Create Pack" subtitle="Base datasets for canon or fangames." />
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
          <Input placeholder="Pack name" {...form.register("name")} />
          <Input placeholder="Description" {...form.register("description")} />
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
                  <div className="flex gap-2 text-sm">
                    <Button
                      onClick={() => {
                        update.mutate({ id: pack.id, name: editName.trim(), description: editDesc.trim() || null });
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
                  <div className="flex gap-2 text-sm">
                    <Button
                      onClick={() => {
                        setEditingId(pack.id);
                        setEditName(pack.name);
                        setEditDesc(pack.description ?? "");
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
                          speciesOverrides: number;
                          speciesAbilities: number;
                        }>(`/packs/${pack.id}/summary`);

                        const message = `Delete pack "${pack.name}"?\n\nThis will also remove:\n- Types: ${summary.types}\n- Species: ${summary.species}\n- Abilities: ${summary.abilities}\n- Items: ${summary.items}\n- Games: ${summary.games}\n- Game Allowed Species: ${summary.allowedSpecies}\n- Game Allowed Abilities: ${summary.allowedAbilities}\n- Game Allowed Items: ${summary.allowedItems}\n- Game Species Overrides: ${summary.speciesOverrides}\n- Game Species Abilities: ${summary.speciesAbilities}\n- Box Pokemon: ${summary.boxPokemon}\n- Team Slots: ${summary.teamSlots}\n\nThis action cannot be undone.`;

                        if (window.confirm(message)) {
                          remove.mutate(pack.id);
                        }
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
    </div>
  );
}
