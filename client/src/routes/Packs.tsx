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
              <div className="font-semibold text-lg">{pack.name}</div>
              {pack.description ? <div className="text-sm text-slate-500">{pack.description}</div> : null}
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