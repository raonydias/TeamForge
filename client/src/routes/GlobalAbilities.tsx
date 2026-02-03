import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { TagRow } from "../lib/types";
import { Button, Card, CardHeader, Input } from "../components/ui";

function parseTags(input: string) {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function GlobalAbilities() {
  const queryClient = useQueryClient();
  const { data: abilities = [] } = useQuery<TagRow[]>({
    queryKey: ["abilities"],
    queryFn: () => api.get("/abilities")
  });

  const [name, setName] = useState("");
  const [tags, setTags] = useState("");

  const create = useMutation({
    mutationFn: (payload: { name: string; tags: string[] }) => api.post("/abilities", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abilities"] });
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
        <CardHeader title="Abilities" subtitle="Global ability tags." />
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