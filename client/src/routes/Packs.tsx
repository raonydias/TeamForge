import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PackRow } from "../lib/types";
import { Button, Card, CardHeader, Input, Modal, GhostButton } from "../components/ui";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmBody, setConfirmBody] = useState<string[]>([]);
  const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);

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
                          `Game Species Overrides: ${summary.speciesOverrides}`,
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
