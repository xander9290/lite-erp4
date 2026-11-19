"use client";

import Column from "@/components/modules/Column";
import { Inserter } from "@/components/ui/form/insertions/Insertions";

export default function PartnerListInsertions() {
  return (
    <Inserter target="column:email" position="after">
      <Column field="vat" label="RFC" />
      <Column field="estadoId" label="Estado" />
    </Inserter>
  );
}
