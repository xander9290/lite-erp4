import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/access";
import AppointmentForm from "../views/AppointmentForm";

async function NewAppointment() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");
  if (!user.isAdmin) redirect("/erp");
  return <AppointmentForm />;
}

export default function NewAppointmentPage() {
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-base-content/60">Cargando…</p>}><NewAppointment /></Suspense>;
}
