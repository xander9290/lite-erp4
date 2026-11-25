"use client";

import FieldMany2One from "@/components/ui/form/FieldMany2One";
import { Inserter } from "@/components/ui/form/insertions/Insertions";

export default function UserDirectoryForm() {
  return (
    <Inserter target="group:otherInfoGroup" position="inside">
      <FieldMany2One name="partnerId" direction="inline" />
    </Inserter>
  );
}
