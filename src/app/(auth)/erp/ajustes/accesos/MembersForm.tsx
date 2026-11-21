"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import FormLayout from "@/components/ui/form/FormLayout";
import FieldRelationTag from "@/components/ui/form/FieldRelationTag";
import { useFormLeaveGuard } from "@/components/ui/form/FormNavigationProvider";
import type { Many2OneLoader } from "@/lib/many2one/model-lookup";
import { saveMembers, type AccessActionState } from "./actions";

type User = { id: string; name: string; login: string; member: boolean };
const membersSchema = z.strictObject({ users: z.array(z.string().min(1).max(100)).max(1000) });

export default function MembersForm({ group, users }: { group: string; users: User[] }) {
  const router = useRouter();
  const methods = useForm<{ users: string[] }>({ resolver: zodResolver(membersSchema), defaultValues: { users: users.filter(user => user.member).map(user => user.id) } });
  const [result, setResult] = useState<AccessActionState>(null);
  const clean = useFormLeaveGuard(methods.formState.isDirty, methods.reset);
  const load = useCallback<Many2OneLoader>(async request => {
    const ids = request.ids ?? (request.id ? [request.id] : undefined);
    const words = (request.query ?? "").toLocaleLowerCase("es-MX").split(/\s+/).filter(Boolean);
    const matches = users.filter(user => ids ? ids.includes(user.id) : words.every(word => `${user.name} ${user.login}`.toLocaleLowerCase("es-MX").includes(word)));
    const pageSize = ids ? Math.max(1, ids.length) : request.pageSize ?? 10;
    const page = Math.min(request.page ?? 1, Math.max(1, Math.ceil(matches.length / pageSize)));
    return { ok: true, total: matches.length, page, pageSize, items: matches.slice((page - 1) * pageSize, page * pageSize).map(user => ({ value: user.id, label: `${user.name} (${user.login})`, record: { id: user.id } })) };
  }, [users]);
  return <FormLayout methods={methods} className="space-y-3" onSubmit={async values => {
    const form = new FormData();
    form.set("group", group);
    values.users.forEach(id => form.append("user", id));
    const response = await saveMembers(null, form);
    setResult(response);
    if (response?.ok) { methods.reset(values); clean(); router.refresh(); }
  }} onSubmitError={() => setResult({ ok: false, message: "No se pudieron guardar los usuarios. Conserva la selección e inténtalo de nuevo." })}>
    <FieldRelationTag name="users" label="Usuarios" load={load} readOnly={methods.formState.isSubmitting} />
    <p className="text-xs text-base-content/60">Un usuario puede tener un grupo por módulo. Para cambiarlo, retíralo primero del anterior.</p>
    <button type="submit" className="btn btn-primary btn-sm" disabled={methods.formState.isSubmitting}>{methods.formState.isSubmitting ? "Guardando…" : "Guardar usuarios"}</button>
    {result && <p role="status" className={`text-sm ${result.ok ? "text-success" : "text-error"}`}>{result.message}</p>}
  </FormLayout>;
}
