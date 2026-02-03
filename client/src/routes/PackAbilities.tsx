import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { PackAbilityRow } from "../lib/types";
import { Button, Card, CardHeader, Input } from "../components/ui";

function parseTags(input: string) {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function PackAbilities() {
  const { id } = useParams();
  const packId = Number(id);
  const queryClient = useQueryClient();

  const { data: abilities = [] } = useQuery<PackAbilityRow[]>({
    queryKey: ["packs", packId, "abilities"],
    queryFn: () => api.get(`/packs/${packId}/abilities`)
  });

  const [name, setName] = useState("");
  const [tags, setTags] = useState("");

  const create = useMutation({
    mutationFn: (payload: { name: string; tags: string[] }) => api.post(`/packs/${packId}/abilities`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs", packId, "abilities"] });
      setName("");
      setTags("");
    }
  });

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <Card>
        <CardHeader title="Add Ability" subtitle="Use tags like mult:atk:1.2, immune:ground." />
        <div className="space-y-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          <Button onClick={() => create.mutate({ name, tags: parseTags(tags) })}>Save</Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Abilities" subtitle="Pack ability tags." />
        <div className="space-y-2">
          {abilities.map((a) => (
            <div key={a.id} className="border border-slate-100 rounded-xl p-3">
              <div className="font-medium">{a.name}</div>
              <div className="text-xs text-slate-500 mt-1">{a.tags}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}