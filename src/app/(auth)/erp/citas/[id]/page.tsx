import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/access";
import AppointmentForm from "../views/AppointmentForm";

async function AppointmentRecord({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  if (!user) redirect("/auth");
  if (!user.isAdmin) redirect("/erp");
  return <AppointmentForm id={id} />;
}

export default function AppointmentRecordPage(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-base-content/60">Cargando cita…</p>}><AppointmentRecord {...props} /></Suspense>;
}
