"use client";

import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FormButton from "@/components/ui/form/FormButton";
import FormHeader from "@/components/ui/form/FormHeader";
import { Inserter } from "@/components/ui/form/insertions/Insertions";
import { DirectoryCoreUserActions } from "@/generated/orm/actions/directory/DirectoryCoreUser.actions";
import { useWatch } from "react-hook-form";

export default function UserDirectoryForm() {
  const partnerId = useWatch({ name: "partnerId" });
  return (
    <>
      <FormHeader>
        <FormButton
          action={DirectoryCoreUserActions.crearContacto}
          variant="secondary"
          invisible={Boolean(partnerId)}
          confirm="¿Crear un contacto en Directorio con los datos de este usuario?"
        />
      </FormHeader>
      <Inserter target="group:otherInfoGroup" position="inside">
        <FieldMany2One name="partnerId" direction="inline" readOnly />
      </Inserter>
    </>
  );
}
