import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { PackAbilityRow, PackSpeciesRow, PackTypeRow } from "../lib/types";
import { Button, Card, CardHeader, Input } from "../components/ui";
import { TagBuilder } from "../components/TagBuilder";

function parseStoredTags(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
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
  const [tags, setTags] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);

  const { data: types = [] } = useQuery<PackTypeRow[]>({
    queryKey: ["packs", packId, "types"],
    queryFn: () => api.get(`/packs/${packId}/types`)
  });
  const { data: species = [] } = useQuery<PackSpeciesRow[]>({
    queryKey: ["packs", packId, "species"],
    queryFn: () => api.get(`/packs/${packId}/species`)
  });

  const typeNames = types.map((t) => t.name);
  const speciesNames = species.map((s) => s.name);

  const create = useMutation({
    mutationFn: (payload: { name: string; tags: string[] }) => api.post(`/packs/${packId}/abilities`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs", packId, "abilities"] });
      setName("");
      setTags([]);
    }
  });

  const update = useMutation({
    mutationFn: (payload: { id: number; name: string; tags: string[] }) =>
      api.put(`/packs/${packId}/abilities/${payload.id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "abilities"] })
  });

  const remove = useMutation({
    mutationFn: (idValue: number) => api.del(`/packs/${packId}/abilities/${idValue}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packs", packId, "abilities"] })
  });

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <Card>
        <CardHeader title="Add Ability" subtitle="Use tags like mult:atk:1.2, immune:ground." />
        <div className="space-y-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <TagBuilder
            tags={tags}
            onChange={setTags}
            types={typeNames}
            species={speciesNames}
            allowedKinds={[
              "mult_stat",
              "mult_defeff",
              "mult_off",
              "mult_off_type",
              "mult_stat_if_type",
              "immune",
              "resist",
              "weak",
              "species",
              "crit_chance",
              "crit_damage",
              "crit_stage",
              "flag_wonder_guard"
            ]}
          />
          <Button onClick={() => create.mutate({ name, tags })}>Save</Button>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <div className="font-semibold text-slate-600 mb-1">Available tag patterns</div>
            <div className="grid grid-cols-2 gap-2">
              <span className="rounded-md bg-white px-2 py-1">mult:stat:multiplier</span>
              <span className="rounded-md bg-white px-2 py-1">mult:defeff:N</span>
              <span className="rounded-md bg-white px-2 py-1">mult:off:N</span>
              <span className="rounded-md bg-white px-2 py-1">mult:off_type:type:N</span>
              <span className="rounded-md bg-white px-2 py-1">mult:stat_if_type:stat:type:N</span>
              <span className="rounded-md bg-white px-2 py-1">immune:type</span>
              <span className="rounded-md bg-white px-2 py-1">resist:type</span>
              <span className="rounded-md bg-white px-2 py-1">weak:type</span>
              <span className="rounded-md bg-white px-2 py-1">flag:wonder_guard</span>
              <span className="rounded-md bg-white px-2 py-1">species:name</span>
              <span className="rounded-md bg-white px-2 py-1">crit:chance:+N</span>
              <span className="rounded-md bg-white px-2 py-1">crit:damage:xN</span>
              <span className="rounded-md bg-white px-2 py-1">crit:stage:+N</span>
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Abilities" subtitle="Pack ability tags." />
        <div className="space-y-2">
          {abilities.map((a) => (
            <div key={a.id} className="border border-slate-100 rounded-xl p-3">
              {editingId === a.id ? (
                <div className="space-y-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <TagBuilder
                    tags={editTags}
                    onChange={setEditTags}
                    types={typeNames}
                    species={speciesNames}
                    allowedKinds={[
                      "mult_stat",
                      "mult_defeff",
                      "mult_off",
                      "mult_off_type",
                      "mult_stat_if_type",
                      "immune",
                      "resist",
                      "weak",
                      "species",
                      "crit_chance",
                      "crit_damage",
                      "crit_stage",
                      "flag_wonder_guard"
                    ]}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        update.mutate({ id: a.id, name: editName.trim(), tags: editTags });
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
                </div>
              ) : (
                <>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-slate-500 mt-1">{a.tags}</div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      onClick={() => {
                        setEditingId(a.id);
                        setEditName(a.name);
                        setEditTags(parseStoredTags(a.tags));
                      }}
                      type="button"
                    >
                      Edit
                    </Button>
                    <Button onClick={() => remove.mutate(a.id)} type="button">
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
