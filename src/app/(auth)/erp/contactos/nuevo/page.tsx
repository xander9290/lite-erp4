import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/access";
import ContactForm from "../views/ContactForm";

async function NewContact() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");
  if (!user.isAdmin) redirect("/erp/contactos");
  return <ContactForm canEdit />;
}

export default function NewContactPage() {
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-base-content/60">Cargando…</p>}><NewContact /></Suspense>;
}
