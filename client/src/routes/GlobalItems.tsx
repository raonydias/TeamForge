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

export default function GlobalItems() {
  const queryClient = useQueryClient();
  const { data: items = [] } = useQuery<TagRow[]>({
    queryKey: ["items"],
    queryFn: () => api.get("/items")
  });

  const [name, setName] = useState("");
  const [tags, setTags] = useState("");

  const create = useMutation({
    mutationFn: (payload: { name: string; tags: string[] }) => api.post("/items", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setName("");
      setTags("");
    }
  });

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <Card>
        <CardHeader title="Add Item" subtitle="Tags follow ability syntax." />
        <div className="space-y-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          <Button onClick={() => create.mutate({ name, tags: parseTags(tags) })}>Save</Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Items" subtitle="Global items with tags." />
        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} className="border border-slate-100 rounded-xl p-3">
              <div className="font-medium">{i.name}</div>
              <div className="text-xs text-slate-500 mt-1">{i.tags}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}