import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { GameRow, PackAbilityRow, PackItemRow, PackSpeciesRow } from "../lib/types";
import { Button, Card, CardHeader } from "../components/ui";

function ToggleList({
  title,
  items,
  selected,
  onToggle
}: {
  title: string;
  items: { id: number; name: string }[];
  selected: Set<number>;
  onToggle: (id: number) => void;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle="Toggle to include in this game." />
      <div className="space-y-2 max-h-[420px] overflow-auto">
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.has(item.id)} onChange={() => onToggle(item.id)} />
            <span>{item.name}</span>
          </label>
        ))}
      </div>
    </Card>
  );
}

export default function GameSetup() {
  const { id } = useParams();
  const gameId = Number(id);
  const queryClient = useQueryClient();

  const { data: game } = useQuery<GameRow | null>({
    queryKey: ["games", gameId],
    queryFn: () => api.get(`/games/${gameId}`)
  });

  const packId = game?.packId ?? 0;

  const { data: species = [] } = useQuery<PackSpeciesRow[]>({
    queryKey: ["packs", packId, "species"],
    queryFn: () => api.get(`/packs/${packId}/species`),
    enabled: !!packId
  });
  const { data: abilities = [] } = useQuery<PackAbilityRow[]>({
    queryKey: ["packs", packId, "abilities"],
    queryFn: () => api.get(`/packs/${packId}/abilities`),
    enabled: !!packId
  });
  const { data: items = [] } = useQuery<PackItemRow[]>({
    queryKey: ["packs", packId, "items"],
    queryFn: () => api.get(`/packs/${packId}/items`),
    enabled: !!packId
  });

  const { data: allowedSpecies } = useQuery<number[]>({
    queryKey: ["games", gameId, "allowed-species"],
    queryFn: () => api.get(`/games/${gameId}/allowed-species`)
  });
  const { data: allowedAbilities } = useQuery<number[]>({
    queryKey: ["games", gameId, "allowed-abilities"],
    queryFn: () => api.get(`/games/${gameId}/allowed-abilities`)
  });
  const { data: allowedItems } = useQuery<number[]>({
    queryKey: ["games", gameId, "allowed-items"],
    queryFn: () => api.get(`/games/${gameId}/allowed-items`)
  });

  const [speciesSet, setSpeciesSet] = useState<Set<number>>(new Set());
  const [abilitiesSet, setAbilitiesSet] = useState<Set<number>>(new Set());
  const [itemsSet, setItemsSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (allowedSpecies) setSpeciesSet(new Set(allowedSpecies));
  }, [allowedSpecies]);
  useEffect(() => {
    if (allowedAbilities) setAbilitiesSet(new Set(allowedAbilities));
  }, [allowedAbilities]);
  useEffect(() => {
    if (allowedItems) setItemsSet(new Set(allowedItems));
  }, [allowedItems]);

  const updateAllowed = useMutation({
    mutationFn: async () => {
      await api.put(`/games/${gameId}/allowed-species`, { ids: Array.from(speciesSet) });
      await api.put(`/games/${gameId}/allowed-abilities`, { ids: Array.from(abilitiesSet) });
      await api.put(`/games/${gameId}/allowed-items`, { ids: Array.from(itemsSet) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games", gameId] });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold font-display">Game Setup</div>
          <div className="text-sm text-slate-500">Select allowed entities for this game.</div>
        </div>
        <Button onClick={() => updateAllowed.mutate()}>Save Allowed Sets</Button>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <ToggleList
          title="Allowed Species"
          items={species}
          selected={speciesSet}
          onToggle={(idValue) => {
            const next = new Set(speciesSet);
            next.has(idValue) ? next.delete(idValue) : next.add(idValue);
            setSpeciesSet(next);
          }}
        />
        <ToggleList
          title="Allowed Abilities"
          items={abilities}
          selected={abilitiesSet}
          onToggle={(idValue) => {
            const next = new Set(abilitiesSet);
            next.has(idValue) ? next.delete(idValue) : next.add(idValue);
            setAbilitiesSet(next);
          }}
        />
        <ToggleList
          title="Allowed Items"
          items={items}
          selected={itemsSet}
          onToggle={(idValue) => {
            const next = new Set(itemsSet);
            next.has(idValue) ? next.delete(idValue) : next.add(idValue);
            setItemsSet(next);
          }}
        />
      </div>
    </div>
  );
}