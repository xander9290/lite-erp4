"use client";

import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FieldText from "@/components/ui/form/FieldText";
import FormGroup from "@/components/ui/form/FormGroup";
import Stack from "@/components/ui/form/Stack";

export default function PartnerExtraForm() {
  return (
    <FormGroup legend="Datos fiscales">
      <FieldText name="street" />

      <Stack>
        <FieldText name="exteriorNumber" className="text-end" />
        <FieldText name="interiorNumber" className="text-end" />
        <FieldText name="zip" className="text-center" />
        <FieldText name="vat" />
        <FieldMany2One name="paisId" />
        <FieldMany2One name="estadoId" />
      </Stack>
    </FormGroup>
  );
}
