import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { SpeciesRow, TypeRow } from "../lib/types";
import { Button, Card, CardHeader, Input, Select } from "../components/ui";

const schema = z.object({
  name: z.string().min(1),
  type1Id: z.coerce.number().int(),
  type2Id: z.coerce.number().int().optional().nullable(),
  hp: z.coerce.number().int().min(1),
  atk: z.coerce.number().int().min(1),
  def: z.coerce.number().int().min(1),
  spa: z.coerce.number().int().min(1),
  spd: z.coerce.number().int().min(1),
  spe: z.coerce.number().int().min(1)
});

type FormValues = z.infer<typeof schema>;

export default function GlobalSpecies() {
  const queryClient = useQueryClient();
  const { data: types = [] } = useQuery<TypeRow[]>({ queryKey: ["types"], queryFn: () => api.get("/types") });
  const { data: species = [] } = useQuery<SpeciesRow[]>({
    queryKey: ["species"],
    queryFn: () => api.get("/species")
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      type1Id: types[0]?.id ?? 1,
      type2Id: null,
      hp: 50,
      atk: 50,
      def: 50,
      spa: 50,
      spd: 50,
      spe: 50
    }
  });

  useEffect(() => {
    if (types.length > 0) {
      form.setValue("type1Id", types[0].id);
    }
  }, [types, form]);

  const create = useMutation({
    mutationFn: (payload: FormValues) => api.post("/species", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["species"] });
      form.reset();
    }
  });

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <Card>
        <CardHeader title="Add Species" subtitle="Base stats + typing." />
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((values) =>
            create.mutate({
              ...values,
              type2Id: values.type2Id && values.type2Id > 0 ? values.type2Id : null
            })
          )}
        >
          <Input placeholder="Name" {...form.register("name")} />
          <div className="grid grid-cols-2 gap-2">
            <Select {...form.register("type1Id")}
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select {...form.register("type2Id")}>
              <option value="">None</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input type="number" placeholder="HP" {...form.register("hp")} />
            <Input type="number" placeholder="Atk" {...form.register("atk")} />
            <Input type="number" placeholder="Def" {...form.register("def")} />
            <Input type="number" placeholder="SpA" {...form.register("spa")} />
            <Input type="number" placeholder="SpD" {...form.register("spd")} />
            <Input type="number" placeholder="Spe" {...form.register("spe")} />
          </div>
          <Button type="submit">Save</Button>
        </form>
      </Card>
      <Card>
        <CardHeader title="Species List" subtitle="Global Dex." />
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th>Name</th>
                <th>Types</th>
                <th>HP</th>
                <th>Atk</th>
                <th>Def</th>
                <th>SpA</th>
                <th>SpD</th>
                <th>Spe</th>
              </tr>
            </thead>
            <tbody>
              {species.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{s.name}</td>
                  <td>{[s.type1Name, s.type2Name].filter(Boolean).join(" /")}</td>
                  <td>{s.hp}</td>
                  <td>{s.atk}</td>
                  <td>{s.def}</td>
                  <td>{s.spa}</td>
                  <td>{s.spd}</td>
                  <td>{s.spe}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
