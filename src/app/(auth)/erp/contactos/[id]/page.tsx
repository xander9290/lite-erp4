import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/access";
import ContactForm from "../views/ContactForm";

async function ContactRecord({ params }: PageProps<"/erp/contactos/[id]">) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  if (!user) redirect("/auth");
  return <ContactForm id={id} canEdit={user.isAdmin} />;
}

export default function ContactRecordPage(props: PageProps<"/erp/contactos/[id]">) {
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-base-content/60">Cargando contacto…</p>}><ContactRecord {...props} /></Suspense>;
}
