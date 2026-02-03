import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { BoxRow, TeamChartRow, TeamSlot } from "../lib/types";
import { Button, Card, CardHeader, Select } from "../components/ui";

export default function GameTeam() {
  const { id } = useParams();
  const gameId = Number(id);
  const queryClient = useQueryClient();

  const { data: box = [] } = useQuery<BoxRow[]>({
    queryKey: ["games", gameId, "box"],
    queryFn: () => api.get(`/games/${gameId}/box`)
  });

  const { data } = useQuery<{ slots: TeamSlot[]; teamChart: TeamChartRow[] }>({
    queryKey: ["games", gameId, "team"],
    queryFn: () => api.get(`/games/${gameId}/team`)
  });

  const [slots, setSlots] = useState<TeamSlot[]>([]);

  useEffect(() => {
    if (data?.slots) setSlots(data.slots);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put(`/games/${gameId}/team`, { slots }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["games", gameId, "team"] })
  });

  return (
    <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
      <Card>
        <CardHeader title="Team Slots" subtitle="Pick 6 from your Box." />
        <div className="space-y-3">
          {slots.map((slot) => (
            <div key={slot.id} className="flex items-center gap-3">
              <div className="w-10 text-sm text-slate-500">#{slot.slotIndex}</div>
              <Select
                value={slot.boxPokemonId ?? ""}
                onChange={(e) => {
                  const value = e.target.value ? Number(e.target.value) : null;
                  setSlots((prev) =>
                    prev.map((s) => (s.id === slot.id ? { ...s, boxPokemonId: value } : s))
                  );
                }}
              >
                <option value="">Empty</option>
                {box.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nickname || b.speciesName}
                  </option>
                ))}
              </Select>
            </div>
          ))}
          <Button onClick={() => save.mutate()}>Save Team</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Team Type Chart" subtitle="Weaknesses, resistances, and immunities." />
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th>Type</th>
                <th>Weak</th>
                <th>Resist</th>
                <th>Immune</th>
              </tr>
            </thead>
            <tbody>
              {(data?.teamChart ?? []).map((row) => (
                <tr key={row.attackingTypeId} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{row.attackingTypeName}</td>
                  <td>{row.weak}</td>
                  <td>{row.resist}</td>
                  <td>{row.immune}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}