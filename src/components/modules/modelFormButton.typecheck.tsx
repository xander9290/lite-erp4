import ModelFormButton from "./ModelFormButton";
import { PartnerForm } from "@/generated/orm/forms/core/Partner.form";
import { ContactosextraCorePartnerForm } from "@/generated/orm/forms/contactosextra/ContactosextraCorePartner.form";

export function FormButtonTypeChecks() {
  const valid = <ModelFormButton form={ContactosextraCorePartnerForm} defaults={{ parentId: "parent", partnerType: "delivery" }} origin={{ form: PartnerForm, id: "parent" }} onSaved={values => { const id: string = values.id; void id; }}>Agregar entrega</ModelFormButton>;
  // @ts-expect-error A raw model string is not a generated form reference.
  const raw = <ModelFormButton form="core.partner" />;
  // @ts-expect-error Unknown default fields must not widen the inferred reference.
  const typo = <ModelFormButton form={PartnerForm} defaults={{ naem: "Typo" }} />;
  // @ts-expect-error Identity is never an initial field.
  const identity = <ModelFormButton form={PartnerForm} defaults={{ id: "forged" }} />;
  // @ts-expect-error Invalid scalar type.
  const scalar = <ModelFormButton form={PartnerForm} defaults={{ name: false }} />;
  // @ts-expect-error Selection values come from the declaration.
  const selection = <ModelFormButton form={ContactosextraCorePartnerForm} defaults={{ partnerType: "invalid" }} />;
  // @ts-expect-error Only registered form presentations, not collections.
  const view = <ModelFormButton form={PartnerForm} view="kanban" />;
  return <>{valid}{raw}{typo}{identity}{scalar}{selection}{view}</>;
}
