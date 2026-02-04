import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { BoxRow, TeamDefenseRow, TeamMemberSummary, TeamSlot } from "../lib/types";
import { Button, Card, CardHeader, Select, TypePill, GhostButton } from "../components/ui";

function spriteKey(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatMultiplier(mult: number | null) {
  if (mult === null) return { label: "—", className: "text-slate-300" };
  const rounded = Math.round(mult * 100) / 100;
  if (rounded === 1) return { label: "", className: "" };
  if (rounded === 0) return { label: "immune", className: "bg-slate-200 text-slate-700" };
  if (rounded === 0.25) return { label: "1/4", className: "bg-emerald-100 text-emerald-700" };
  if (rounded === 0.5) return { label: "1/2", className: "bg-emerald-50 text-emerald-700" };
  if (rounded === 2) return { label: "2x", className: "bg-rose-50 text-rose-700" };
  if (rounded === 4) return { label: "4x", className: "bg-rose-200 text-rose-900 border border-rose-300" };
  return { label: `${rounded}x`, className: "bg-slate-100 text-slate-700" };
}

export default function GameTeam() {
  const { id } = useParams();
  const gameId = Number(id);
  const queryClient = useQueryClient();

  const { data: box = [] } = useQuery<BoxRow[]>({
    queryKey: ["games", gameId, "box"],
    queryFn: () => api.get(`/games/${gameId}/box`)
  });

  const { data } = useQuery<{ slots: TeamSlot[]; members: (TeamMemberSummary | null)[]; defenseMatrix: TeamDefenseRow[] }>({
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

  const members = data?.members ?? [];

  const totalClass = (value: number, mode: "weak" | "resist") => {
    if (value <= 0) return "text-slate-500";
    if (mode === "weak") {
      if (value === 1) return "bg-rose-50 text-rose-700";
      if (value === 2) return "bg-rose-100 text-rose-700";
      return "bg-rose-200 text-rose-900";
    }
    if (value === 1) return "bg-emerald-50 text-emerald-700";
    if (value === 2) return "bg-emerald-100 text-emerald-700";
    return "bg-emerald-200 text-emerald-900";
  };

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-6">
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
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()}>Save Team</Button>
            <Link to={`/games/${gameId}/box`} className="inline-flex">
              <GhostButton type="button">Go to Box</GhostButton>
            </Link>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Defensive Coverage" subtitle="How the team handles each attacking type." />
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-4">Move</th>
                {members.map((member, idx) => (
                  <th key={idx} className="py-2 px-2 text-center">
                    {member ? (
                      <div className="flex flex-col items-center gap-1">
                        <img
                          src={`/sprites/${spriteKey(member.speciesName)}.png`}
                          alt={member.speciesName}
                          className="h-10 w-10 object-contain"
                          onError={(event) => {
                            const target = event.currentTarget;
                            if (!target.dataset.fallback) {
                              target.dataset.fallback = "1";
                              target.src = "/sprites/000.png";
                            }
                          }}
                        />
                        <div className="text-xs text-slate-600">
                          {member.nickname || member.speciesName}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-xs text-slate-300">
                        <img src="/sprites/000.png" alt="Empty slot" className="h-10 w-10 object-contain opacity-70" />
                        Empty
                      </div>
                    )}
                  </th>
                ))}
                <th className="py-2 px-3 text-center">Total Weak</th>
                <th className="py-2 px-3 text-center">Total Resist</th>
              </tr>
            </thead>
            <tbody>
              {(data?.defenseMatrix ?? [])
                .filter((row) => row.attackingTypeName !== "???")
                .map((row) => (
                <tr key={row.attackingTypeId} className="border-t border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-700">
                    <TypePill name={row.attackingTypeName} color={row.attackingTypeColor ?? null} />
                  </td>
                  {row.multipliers.map((mult, idx) => {
                    const formatted = formatMultiplier(mult);
                    return (
                      <td key={idx} className="px-2 py-2 text-center">
                        {formatted.label ? (
                          <span className={`inline-flex min-w-[2.25rem] justify-center rounded-lg px-2 py-1 text-xs font-semibold ${formatted.className}`}>
                            {formatted.label}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex min-w-[1.75rem] justify-center rounded-md px-2 py-1 text-xs font-semibold ${totalClass(row.totalWeak, "weak")}`}>
                      {row.totalWeak}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex min-w-[1.75rem] justify-center rounded-md px-2 py-1 text-xs font-semibold ${totalClass(row.totalResist, "resist")}`}>
                      {row.totalResist}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
