import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { GameRow } from "../lib/types";
import { Button, Card, CardHeader, Input } from "../components/ui";

const schema = z.object({
  name: z.string().min(1),
  notes: z.string().optional().nullable()
});

type FormValues = z.infer<typeof schema>;

export default function Games() {
  const queryClient = useQueryClient();
  const { data: games = [] } = useQuery<GameRow[]>({ queryKey: ["games"], queryFn: () => api.get("/games") });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", notes: "" } });

  const create = useMutation({
    mutationFn: (payload: FormValues) => api.post("/games", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      form.reset();
    }
  });

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <Card>
        <CardHeader title="Create Game" subtitle="Profiles define allowed species, abilities, items." />
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
          <Input placeholder="Game name" {...form.register("name")} />
          <Input placeholder="Notes / rules" {...form.register("notes")} />
          <Button type="submit">Create</Button>
        </form>
      </Card>
      <Card>
        <CardHeader title="Games" subtitle="Jump into setup and views." />
        <div className="space-y-3">
          {games.map((game) => (
            <div key={game.id} className="border border-slate-100 rounded-xl p-4 flex flex-col gap-2">
              <div className="font-semibold text-lg">{game.name}</div>
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
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}