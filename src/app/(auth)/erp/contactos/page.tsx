import Link from "next/link";
import { ChevronLeft, UsersRound } from "lucide-react";
import ListView from "@/components/ui/list/ListView";

export default function ContactsPage() {
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-6">
    <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col gap-4">
      <Link href="/erp" className="inline-flex w-fit shrink-0 items-center gap-1 rounded-sm text-sm text-base-content/60 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"><ChevronLeft size={16} aria-hidden="true" />Aplicaciones</Link>
      <ListView model="partner" title="Contactos" description="Filtra cada columna para encontrar tus contactos." icon={<UsersRound size={22} />}
        searchFields={["name", "user.login"]} columns={[{ field: "name", label: "Nombre", widget: "partner", avatarField: "avatarUrl", sortable: true }, { field: "user.login", label: "Usuario", sortable: true }]} />
    </div>
  </div>;
}
