"use client";

import { Inserter } from "@/components/ui/form/insertions/Insertions";
import FormGroup from "@/components/ui/form/FormGroup";
import Stack from "@/components/ui/form/Stack";
import FieldText from "@/components/ui/form/FieldText";
import FieldMany2One from "@/components/ui/form/FieldMany2One";

export default function PartnerInsertions() {
  return (
    <>
      <Inserter target="field:name" position="after">
        <FieldText name="vat" />
      </Inserter>

      <Inserter target="group:contacto" position="after">
        <FormGroup id="direccion" legend="Dirección">
          <FieldText name="street" />
          <Stack>
            <FieldText name="exteriorNumber" className="text-end" />
            <FieldText name="interiorNumber" className="text-end" />
            <FieldText name="zip" className="text-center" />
          </Stack>
          <Stack>
            <FieldMany2One name="paisId" />
            <FieldMany2One name="estadoId" />
            <FieldMany2One name="municipioId" />
            <FieldMany2One name="localidadId" />
          </Stack>
        </FormGroup>
      </Inserter>
    </>
  );
}
