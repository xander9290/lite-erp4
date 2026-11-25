"use client";

import FieldMany2One from "@/components/ui/form/FieldMany2One";
import FormGroup from "@/components/ui/form/FormGroup";
import FormHeader from "@/components/ui/form/FormHeader";
import FormButton from "@/components/ui/form/FormButton";
import { DirectoryCoreUserActions } from "@/generated/orm/actions/directory/DirectoryCoreUser.actions";
import { useWatch } from "react-hook-form";

export default function UserDirectoryForm() {
  const partnerId = useWatch<{ partnerId: string | null }>({
    name: "partnerId",
  });
  return (
    <>
      <FormHeader>
        <FormButton
          action={DirectoryCoreUserActions.crearContacto}
          invisible={Boolean(partnerId)}
        />
      </FormHeader>

      <FormGroup legend="Directorio">
        <FieldMany2One name="partnerId" direction="inline" readOnly />
      </FormGroup>
    </>
  );
}
