import "server-only";
import {
  constraint,
  Fields,
  Model,
  ModelValidationError as Err,
  type DisplayRecord,
} from "@/lib/orm";
import { ModelTypes } from "@/types/model-types";

export class PartnerEmails extends Model {
  name = Fields.Text({
    label: "Correo",
    required: true,
    unique: true,
    maxLength: 120,
    tracking: true,
  });
  partnerId = Fields.Many2one("DirectoryPartner", {
    label: "Cliente",
    required: true,
    onDelete: "Restrict",
    tracking: true,
  });
  usage = Fields.Selection(
    [
      { label: "Facturación", value: "billing" },
      { label: "Cobranza", value: "collection" },
      { label: "Compras", value: "purchasing" },
      { label: "Ventas", value: "sales" },
      { label: "Logística", value: "logistics" },
      { label: "General", value: "general" },
    ],
    {
      label: "Uso",
      required: true,
      default: "general",
    },
  );
  sendDocuments = Fields.Boolean({
    label: "Enviar documentos",
    default: true,
    tracking: true,
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  displayName(record: DisplayRecord<PartnerEmails, "name">): string {
    return record.name;
  }

  // SE NORMALIZA EL CORREO EN MINÚSCULAS
  normalize(values: ModelTypes["values"]) {
    return {
      ...values,
      name:
        typeof values.name === "string"
          ? values.name.trim().toLowerCase()
          : values.name,
    };
  }

  // SE VALIDA EL CORREO
  @constraint("name")
  validateEmail(values: ModelTypes["values"]) {
    const { name } = values;
    if (name == null || name === "") return; // required ya lo reporta

    const pattern =
      /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

    if (
      typeof name !== "string" ||
      !pattern.test(name) ||
      name.split("@")[0].length > 64
    ) {
      throw new Err("Revisa el correo.", {
        name: "Introduce un correo válido, por ejemplo facturas@empresa.com.",
      });
    }
  }
}
