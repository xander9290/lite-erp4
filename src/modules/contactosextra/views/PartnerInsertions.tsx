"use client";

import { Inserter } from "@/components/ui/form/insertions/Insertions";
import FormGroup from "@/components/ui/form/FormGroup";
import Stack from "@/components/ui/form/Stack";
import FieldText from "@/components/ui/form/FieldText";
import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FieldRelationTag from "@/components/ui/form/FieldRelationTag";
import NotebookPage from "@/components/ui/form/NotebookPage";
import Notebook from "@/components/ui/form/Notebook";

export default function PartnerInsertions() {
  return (
    <>
      <Inserter target="stack:fiscal-data" position="inside">
        <FieldText name="vat" />
        <FieldText name="curp" />
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
        <Notebook id="extras" defaultPage="contacts">
          <NotebookPage name="contacts" label="Contactos">
            <h1>En construcción</h1>
          </NotebookPage>
          <NotebookPage name="sales" label="Venta" className="p-2">
            <FormGroup legend="Ventas">
              <FieldMany2One name="saleUserId" />
            </FormGroup>
          </NotebookPage>
          <NotebookPage name="purchase" label="Compra" className="p-2">
            <FormGroup legend="Compras">
              <FieldMany2One name="purchaseUserId" />
            </FormGroup>
          </NotebookPage>
        </Notebook>
      </Inserter>

      <Inserter target="group:contacto" position="inside">
        <FieldRelationTag name="tagIds" direction="inline" />
      </Inserter>
    </>
  );
}
