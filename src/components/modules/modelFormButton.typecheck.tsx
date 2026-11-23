import ModelFormButton from "./ModelFormButton";
import { UserForm } from "@/generated/orm/forms/core/User.form";
import { UbicacionesPaisForm } from "@/generated/orm/forms/ubicaciones/UbicacionesPais.form";

export function FormButtonTypeChecks() {
  const valid = <ModelFormButton form={UbicacionesPaisForm} defaults={{ name: "México", active: true }} origin={{ form: UserForm, id: "parent" }} onSaved={values => { const id: string = values.id; void id; }}>Agregar entrega</ModelFormButton>;
  // @ts-expect-error A raw model string is not a generated form reference.
  const raw = <ModelFormButton form="core.user" />;
  // @ts-expect-error Unknown default fields must not widen the inferred reference.
  const typo = <ModelFormButton form={UserForm} defaults={{ naem: "Typo" }} />;
  // @ts-expect-error Identity is never an initial field.
  const identity = <ModelFormButton form={UserForm} defaults={{ id: "forged" }} />;
  // @ts-expect-error Invalid scalar type.
  const scalar = <ModelFormButton form={UserForm} defaults={{ name: false }} />;
  // @ts-expect-error Selection values come from the declaration.
  const selection = <ModelFormButton form={UbicacionesPaisForm} defaults={{ active: "invalid" }} />;
  // @ts-expect-error Only registered form presentations, not collections.
  const view = <ModelFormButton form={UserForm} view="kanban" />;
  return <>{valid}{raw}{typo}{identity}{scalar}{selection}{view}</>;
}
