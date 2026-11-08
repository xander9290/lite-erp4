import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import ListView from "@/components/ui/list/ListView";
import { manifest } from "../manifest";
import { listRecords } from "../actions/record.actions";
import { recordColumns, recordSearchFields } from "./record.list";

export default function RecordList() {
  const Icon = manifest.icon;
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-3 sm:p-6">
    <Link href="/erp" className="inline-flex w-fit shrink-0 items-center gap-1 text-sm text-base-content/60 hover:text-primary"><ChevronLeft size={16} aria-hidden="true" />Aplicaciones</Link>
    <ListView model="FlotaRecord" title={manifest.name} description={manifest.description} icon={<Icon size={22} />} load={listRecords}
      columns={recordColumns} searchFields={recordSearchFields} createHref="/erp/flota/nuevo" createLabel="Nuevo registro" recordHref="/erp/flota/{id}" />
  </div>;
}
