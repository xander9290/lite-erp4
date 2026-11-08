import { Suspense } from "react";
import ContactList from "./views/ContactList";

export default function ContactsPage() {
  return <Suspense fallback={<p role="status" className="p-6 text-sm text-base-content/60">Cargando contactos…</p>}><ContactList /></Suspense>;
}
