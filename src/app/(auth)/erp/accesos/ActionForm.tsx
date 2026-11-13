"use client";

import { useActionState, type ReactNode } from "react";
import { Save } from "lucide-react";
import type { AccessActionState } from "./actions";

/** Plain form bound to a server action; shows the server's confirmation or error. */
export default function ActionForm({ action, label, children }: { action: (state: AccessActionState, form: FormData) => Promise<AccessActionState>; label: string; children: ReactNode }) {
  const [state, formAction, pending] = useActionState(action, null);
  return <form action={formAction} autoComplete="off" className="space-y-3" aria-busy={pending}>
    {children}
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}><Save size={16} />{pending ? "Guardando…" : label}</button>
      {state && <p role="status" className={`text-sm ${state.ok ? "text-success" : "text-error"}`}>{state.message}</p>}
    </div>
  </form>;
}
