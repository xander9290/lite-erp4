import type { FormButtonProps } from "./formActions";
import { defineActionReferences } from "@/lib/orm/action-reference";

// Checked by tsc/build. These assertions fail if FormButton becomes stringly typed again.
const actions = defineActionReferences("TypedExample", ["confirmar", "cancelar"]);
const valid: FormButtonProps = { action: actions.confirmar };
// @ts-expect-error Only the published literal keys exist.
const typo: FormButtonProps = { action: actions.confimar };
// @ts-expect-error A raw string is not an action reference.
const raw: FormButtonProps = { action: "confirmar" };
// @ts-expect-error A handwritten object is not a generated/declared reference.
const object: FormButtonProps = { action: { model: "TypedExample", name: "confirmar" } };
const exactModel: "TypedExample" = actions.confirmar.model;
const exactName: "confirmar" = actions.confirmar.name;
void [valid, typo, raw, object, exactModel, exactName];
